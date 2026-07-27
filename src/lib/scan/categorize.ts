import { LARGE_VIDEO_BYTES, type AssetFact, type CategoryId } from '@/lib/scan/types';

/**
 * Per-asset categories. Group-based categories (exact duplicates, similar
 * photos) are assigned separately because they depend on other assets.
 *
 * Favourites are excluded entirely — if the user hearted it, we don't get a vote.
 */
export function categorize(asset: AssetFact): CategoryId[] {
  if (asset.isFavorite) return [];

  const categories: CategoryId[] = [];

  if (asset.subtype === 'screenshot') categories.push('screenshots');
  if (asset.subtype === 'screenRecording') categories.push('screenRecordings');

  if (
    (asset.subtype === 'video' || asset.subtype === 'screenRecording') &&
    asset.sizeBytes >= LARGE_VIDEO_BYTES
  ) {
    categories.push('largeVideos');
  }

  // Screenshots and recordings are obviously not camera originals, so
  // reporting them here too would double-count them for the user.
  if (asset.subtype === 'photo' && !asset.isCameraOriginal) {
    categories.push('notTakenByYou');
  }

  return categories;
}
