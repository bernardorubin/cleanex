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

type NativeModule = {
  getPhotoPermission(): PhotoPermission;
  requestPhotoPermission(): Promise<PhotoPermission>;
  inventory(): Promise<InventoryResult>;
  findSimilarPairs(assetIds: string[]): Promise<SimilarPairsResult>;
  deleteAssets(assetIds: string[]): Promise<DeleteResult>;
  playVideo(assetId: string): Promise<boolean>;
  compressVideo(assetId: string, preset: CompressionPreset): Promise<TransformResult>;
  flattenLivePhoto(assetId: string): Promise<TransformResult>;
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
