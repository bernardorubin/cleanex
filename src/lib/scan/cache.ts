import * as SQLite from 'expo-sqlite';

import { SCAN_SCHEMA_VERSION, type AssetFact, type AssetSubtype } from '@/lib/scan/types';

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
};

export async function openCache(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(`limpio-v${SCAN_SCHEMA_VERSION}.db`);
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
      clusterId        TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_assets_created ON assets(createdAt);
  `);
  return db;
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
  };
}

export async function saveAssets(
  db: SQLite.SQLiteDatabase,
  assets: AssetFact[],
): Promise<void> {
  if (assets.length === 0) return;

  const statement = await db.prepareAsync(`
    INSERT INTO assets
      (id, sizeBytes, width, height, durationSeconds, createdAt, subtype, isCameraOriginal, isFavorite)
    VALUES ($id, $size, $w, $h, $dur, $created, $subtype, $camera, $fav)
    ON CONFLICT(id) DO UPDATE SET
      sizeBytes  = excluded.sizeBytes,
      isFavorite = excluded.isFavorite
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

/** Drops cached rows for assets the user deleted outside Limpio. */
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
