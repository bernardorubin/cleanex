import type { AssetFact } from '@/lib/scan/types';

/**
 * Chooses the one asset in a group that survives deletion.
 *
 * Order: favourite > highest resolution > largest file > oldest > lowest id.
 *
 * Throwing on an empty group is deliberate. Returning undefined would let a
 * caller delete every member of a group, which is the one failure mode that
 * loses a user's only copy of a photo.
 */
export function pickKeeper(members: AssetFact[]): AssetFact {
  if (members.length === 0) {
    throw new Error('pickKeeper requires at least one asset');
  }

  return members.reduce((best, candidate) =>
    isBetterKeeper(candidate, best) ? candidate : best,
  );
}

function isBetterKeeper(candidate: AssetFact, best: AssetFact): boolean {
  if (candidate.isFavorite !== best.isFavorite) return candidate.isFavorite;

  const candidatePixels = candidate.width * candidate.height;
  const bestPixels = best.width * best.height;
  if (candidatePixels !== bestPixels) return candidatePixels > bestPixels;

  if (candidate.sizeBytes !== best.sizeBytes) return candidate.sizeBytes > best.sizeBytes;

  if (candidate.createdAt !== best.createdAt) return candidate.createdAt < best.createdAt;

  // Total order on id so the result never depends on input ordering.
  return candidate.id < best.id;
}
