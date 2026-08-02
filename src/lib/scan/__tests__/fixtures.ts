import type { AssetFact } from '@/lib/scan/types';

/** A plain camera photo. Override only what a test cares about. */
export function asset(over: Partial<AssetFact> = {}): AssetFact {
  return {
    id: 'a1',
    sizeBytes: 2_000_000,
    width: 4032,
    height: 3024,
    durationSeconds: 0,
    createdAt: 1_700_000_000_000,
    subtype: 'photo',
    isCameraOriginal: true,
    isFavorite: false,
    isLivePhoto: false,
    ...over,
  };
}
