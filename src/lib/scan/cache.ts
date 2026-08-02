import * as SQLite from 'expo-sqlite';

import { SCAN_SCHEMA_VERSION, type AssetFact, type AssetSubtype } from '@/lib/scan/types';
import type { DiskSample } from '@/lib/storage/history';

type Row = {
  id: string;
  sizeBytes: number;
  width: number;
  height: number;
  durationSeconds: number;
  createdAt: number;
  subtype: string;
  isCameraOriginal: number;
  isFavorite: number;
  isLivePhoto: number;
};

export async function openCache(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(`make-room-v${SCAN_SCHEMA_VERSION}.db`);
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS assets (
      id               TEXT PRIMARY KEY NOT NULL,
      sizeBytes        INTEGER NOT NULL,
      width            INTEGER NOT NULL,
      height           INTEGER NOT NULL,
      durationSeconds  REAL    NOT NULL,
      createdAt        INTEGER NOT NULL,
      subtype          TEXT    NOT NULL,
      isCameraOriginal INTEGER NOT NULL,
      isFavorite       INTEGER NOT NULL,
      isLivePhoto      INTEGER NOT NULL DEFAULT 0,
      clusterId        TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_assets_created ON assets(createdAt);
    CREATE TABLE IF NOT EXISTS disk_history (
      sampledAt  INTEGER PRIMARY KEY NOT NULL,
      freeBytes  INTEGER NOT NULL,
      totalBytes INTEGER NOT NULL
    );
  `);
  await addMissingColumns(db);
  return db;
}

/**
 * Brings a cache written by an older build up to the current shape.
 *
 * `CREATE TABLE IF NOT EXISTS` only describes a *new* database — every phone
 * that has already run the app keeps the table it made first, so a column added
 * above would exist for new installs and be missing for everyone else, and the
 * first `saveAssets` would throw. SQLite has no `ADD COLUMN IF NOT EXISTS`, so
 * the existing columns are read and the missing ones added.
 *
 * The alternative, bumping `SCAN_SCHEMA_VERSION`, changes the database
 * filename: it orphans the old file on disk rather than replacing it, which
 * wastes storage in a storage app, and throws away a scan the user already paid
 * for. Additive migration is the cheaper truth.
 *
 * `isLivePhoto` defaults to 0, so rows cached before it existed read as "not a
 * Live Photo" until the next scan overwrites them — which is why `saveAssets`
 * updates it on conflict rather than only on insert.
 */
async function addMissingColumns(db: SQLite.SQLiteDatabase): Promise<void> {
  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(assets)');
  const present = new Set(columns.map((column) => column.name));

  if (!present.has('isLivePhoto')) {
    await db.execAsync('ALTER TABLE assets ADD COLUMN isLivePhoto INTEGER NOT NULL DEFAULT 0');
  }
}

export async function loadCached(db: SQLite.SQLiteDatabase): Promise<AssetFact[]> {
  const rows = await db.getAllAsync<Row>('SELECT * FROM assets');
  return rows.map(toAssetFact);
}

/** Assets created on or after `since` — the weekly review's only input. */
export async function loadSince(
  db: SQLite.SQLiteDatabase,
  since: number,
): Promise<AssetFact[]> {
  const rows = await db.getAllAsync<Row>(
    'SELECT * FROM assets WHERE createdAt >= ? ORDER BY createdAt DESC',
    since,
  );
  return rows.map(toAssetFact);
}

function toAssetFact(row: Row): AssetFact {
  return {
    id: row.id,
    sizeBytes: row.sizeBytes,
    width: row.width,
    height: row.height,
    durationSeconds: row.durationSeconds,
    createdAt: row.createdAt,
    subtype: row.subtype as AssetSubtype,
    isCameraOriginal: row.isCameraOriginal === 1,
    isFavorite: row.isFavorite === 1,
    isLivePhoto: row.isLivePhoto === 1,
  };
}

export async function saveAssets(
  db: SQLite.SQLiteDatabase,
  assets: AssetFact[],
): Promise<void> {
  if (assets.length === 0) return;

  const statement = await db.prepareAsync(`
    INSERT INTO assets
      (id, sizeBytes, width, height, durationSeconds, createdAt, subtype, isCameraOriginal, isFavorite, isLivePhoto)
    VALUES ($id, $size, $w, $h, $dur, $created, $subtype, $camera, $fav, $live)
    ON CONFLICT(id) DO UPDATE SET
      sizeBytes   = excluded.sizeBytes,
      isFavorite  = excluded.isFavorite,
      isLivePhoto = excluded.isLivePhoto
  `);
  try {
    await db.withTransactionAsync(async () => {
      for (const a of assets) {
        await statement.executeAsync({
          $id: a.id,
          $size: a.sizeBytes,
          $w: a.width,
          $h: a.height,
          $dur: a.durationSeconds,
          $created: a.createdAt,
          $subtype: a.subtype,
          $camera: a.isCameraOriginal ? 1 : 0,
          $fav: a.isFavorite ? 1 : 0,
          $live: a.isLivePhoto ? 1 : 0,
        });
      }
    });
  } finally {
    await statement.finalizeAsync();
  }
}

export async function saveClusters(
  db: SQLite.SQLiteDatabase,
  clusters: Record<string, string>,
): Promise<void> {
  const entries = Object.entries(clusters);
  if (entries.length === 0) return;

  const statement = await db.prepareAsync(
    'UPDATE assets SET clusterId = $cluster WHERE id = $id',
  );
  try {
    await db.withTransactionAsync(async () => {
      for (const [id, cluster] of entries) {
        await statement.executeAsync({ $id: id, $cluster: cluster });
      }
    });
  } finally {
    await statement.finalizeAsync();
  }
}

/** Drops cached rows for assets the user deleted outside CleanEx. */
export async function pruneMissing(
  db: SQLite.SQLiteDatabase,
  liveIds: string[],
): Promise<number> {
  const live = new Set(liveIds);
  const cached = await db.getAllAsync<{ id: string }>('SELECT id FROM assets');
  const stale = cached.filter((r) => !live.has(r.id)).map((r) => r.id);
  if (stale.length === 0) return 0;

  await db.withTransactionAsync(async () => {
    for (const id of stale) {
      await db.runAsync('DELETE FROM assets WHERE id = ?', id);
    }
  });
  return stale.length;
}

/** Records a disk-space reading. One row per timestamp — a repeat sampledAt overwrites. */
export async function recordDiskSample(
  db: SQLite.SQLiteDatabase,
  sample: DiskSample,
): Promise<void> {
  await db.runAsync(
    'INSERT OR REPLACE INTO disk_history (sampledAt, freeBytes, totalBytes) VALUES (?, ?, ?)',
    sample.sampledAt,
    sample.freeBytes,
    sample.totalBytes,
  );
}

/** Disk samples recorded on or after `since` — history.ts's only input. */
export async function loadDiskSamplesSince(
  db: SQLite.SQLiteDatabase,
  since: number,
): Promise<DiskSample[]> {
  return db.getAllAsync<DiskSample>(
    'SELECT sampledAt, freeBytes, totalBytes FROM disk_history WHERE sampledAt >= ? ORDER BY sampledAt ASC',
    since,
  );
}
