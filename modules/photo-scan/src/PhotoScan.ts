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

type NativeModule = {
  getPhotoPermission(): PhotoPermission;
  requestPhotoPermission(): Promise<PhotoPermission>;
  inventory(): Promise<InventoryResult>;
  findSimilarPairs(assetIds: string[]): Promise<SimilarPairsResult>;
  deleteAssets(assetIds: string[]): Promise<DeleteResult>;
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
