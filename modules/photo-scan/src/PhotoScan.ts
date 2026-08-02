import { requireNativeModule } from 'expo';

import type { AssetFact } from '@/lib/scan/types';

export type PhotoPermission = 'granted' | 'limited' | 'denied' | 'undetermined';

export type InventoryResult = { assets: AssetFact[]; elapsedMs: number };

export type SimilarPairsResult = {
  pairs: [string, string][];
  elapsedMs: number;
  comparedCount: number;
};

export type DeleteResult = { deleted: boolean; count: number };

/**
 * Named by outcome, not by resolution — this audience does not know what 1080p
 * means. `sharp` is 1920x1080, `phone` 1280x720, `smallest` 960x540.
 */
export type CompressionPreset = 'sharp' | 'phone' | 'smallest';

/**
 * The result of replacing one asset with a smaller version of itself.
 *
 * `oldBytes` and `newBytes` are measured file sizes, never estimates: the
 * figure shown before a transform is an estimate, the figure shown after it is
 * the truth. A transform that cannot measure the original refuses to run
 * rather than report a guess.
 *
 * `ok: false` covers every ordinary refusal — the asset is gone, it is the
 * wrong kind, it is slo-mo or time-lapse, the iCloud fetch or the encode
 * failed, another transform is still running, or the user cancelled the system
 * delete sheet. Nothing here rejects. When the refusal is "the new file came
 * out no smaller", both byte counts are still populated so the caller can say
 * why nothing changed; otherwise `newBytes` is 0.
 */
export type TransformResult = {
  ok: boolean;
  newAssetId: string | null;
  oldBytes: number;
  newBytes: number;
};

/** One asset that was actually replaced, with both measured byte counts. */
export type BatchTransformItem = {
  /** The asset that was replaced. It is now in Recently Deleted. */
  assetId: string;
  newAssetId: string;
  oldBytes: number;
  newBytes: number;
};

/**
 * The result of one bulk transform, which is also exactly one system
 * confirmation sheet.
 *
 * `ok` means at least one asset was replaced. The totals cover the converted
 * assets only and are measured, never estimated.
 *
 * The three id buckets are exhaustive over what was passed in, and the split
 * matters:
 *
 * - `converted` — done.
 * - `failedIds` — could not be prepared at all: not a Live Photo, no longer in
 *   the library, unmeasurable, or its data could not be fetched. Calling again
 *   with these is unlikely to help.
 * - `skippedIds` — never applied, for a reason that has nothing to do with the
 *   asset: the batch hit its staging ceiling, the user cancelled, or the
 *   confirmation sheet was dismissed. **Call again with these** — that is how a
 *   library larger than one batch gets finished, one sheet at a time.
 */
export type BatchTransformResult = {
  ok: boolean;
  convertedCount: number;
  oldBytes: number;
  newBytes: number;
  converted: BatchTransformItem[];
  failedIds: string[];
  skippedIds: string[];
};

type NativeModule = {
  getPhotoPermission(): PhotoPermission;
  requestPhotoPermission(): Promise<PhotoPermission>;
  inventory(): Promise<InventoryResult>;
  findSimilarPairs(assetIds: string[]): Promise<SimilarPairsResult>;
  deleteAssets(assetIds: string[]): Promise<DeleteResult>;
  playVideo(assetId: string): Promise<boolean>;
  compressVideo(assetId: string, preset: CompressionPreset): Promise<TransformResult>;
  flattenLivePhoto(assetId: string): Promise<TransformResult>;
  flattenLivePhotos(assetIds: string[]): Promise<BatchTransformResult>;
  cancelTransform(): Promise<boolean>;
};

const native = requireNativeModule<NativeModule>('PhotoScan');

export function getPhotoPermission(): PhotoPermission {
  return native.getPhotoPermission();
}

export function requestPhotoPermission(): Promise<PhotoPermission> {
  return native.requestPhotoPermission();
}

export function inventory(): Promise<InventoryResult> {
  return native.inventory();
}

export function findSimilarPairs(assetIds: string[]): Promise<SimilarPairsResult> {
  return native.findSimilarPairs(assetIds);
}

/**
 * Deletes in one batch, so iOS shows a single confirmation sheet.
 * `deleted: false` means the user cancelled — a normal outcome, not an error.
 */
export function deleteAssets(assetIds: string[]): Promise<DeleteResult> {
  return native.deleteAssets(assetIds);
}

/**
 * Presents the system video player full screen. Resolves false when the asset
 * is gone, is not a video, or no controller was available to present from —
 * all normal outcomes, never thrown.
 */
export function playVideo(assetId: string): Promise<boolean> {
  return native.playVideo(assetId);
}

/**
 * Re-encodes one video smaller and replaces the original in the library.
 *
 * PhotoKit has no way to replace an asset's data, so this creates a new asset
 * and deletes the old one, carrying creation date, location, favourite status
 * and user-album membership across by hand. The original goes to Recently
 * Deleted, so the space does not come back until the bin is emptied — say so
 * before offering this.
 *
 * This is the only irreversible action in the app: once the bin empties, the
 * quality is gone. Never call it without a confirmation that says that.
 *
 * Run one transform at a time and await each. Overlapping calls resolve
 * `ok: false` because each one raises its own system delete sheet.
 */
export async function compressVideo(
  assetId: string,
  preset: CompressionPreset
): Promise<TransformResult> {
  const result = await native.compressVideo(assetId, preset);
  return { ...result, newAssetId: result.newAssetId ?? null };
}

/**
 * Keeps a Live Photo's still image and drops the ~3s of video beside it.
 *
 * The still is copied out byte for byte, so nothing is recompressed — only the
 * video component goes. Same create-then-delete path, same carried metadata and
 * same late-arriving space as {@link compressVideo}.
 */
export async function flattenLivePhoto(assetId: string): Promise<TransformResult> {
  const result = await native.flattenLivePhoto(assetId);
  return { ...result, newAssetId: result.newAssetId ?? null };
}

/**
 * Flattens many Live Photos behind **one** system confirmation sheet.
 *
 * Use this, not a loop over {@link flattenLivePhoto}: iOS raises its delete
 * confirmation once per batch, so looping the single-asset version over a
 * library asks the user to confirm thousands of times. Nobody wants to review
 * 5,000 Live Photos — one number, one button, one confirmation.
 *
 * One call is one sheet, but not necessarily every id. Each still is copied to
 * disk before anything is deleted, and that staging is capped so a batch cannot
 * fill up an already-full phone. Whatever did not fit comes back in
 * `skippedIds`, and calling again with those finishes the job — so the number
 * of sheets the user sees is decided here, by how the caller loops, not
 * natively.
 *
 * Assets that cannot be prepared are left out of the batch rather than failing
 * it, so 200 good ones still convert when 300 are unusable.
 */
export function flattenLivePhotos(assetIds: string[]): Promise<BatchTransformResult> {
  return native.flattenLivePhotos(assetIds);
}

/**
 * Stops the running transform, resolving `false` when there was nothing to
 * stop. The in-flight call then resolves `ok: false` as an ordinary outcome.
 *
 * Required, not optional: a transform may have to pull the full-size original
 * down from iCloud first and PhotoKit puts no timeout on that, so on a slow
 * connection this is the user's only way out.
 */
export function cancelTransform(): Promise<boolean> {
  return native.cancelTransform();
}
