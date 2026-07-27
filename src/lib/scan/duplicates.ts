import { pickKeeper } from '@/lib/scan/keeper';
import type { AssetFact, AssetGroup } from '@/lib/scan/types';

/**
 * Exact duplicates need no Vision pass: byte-identical files have identical
 * size and dimensions. Free, exact, and with no false positives.
 */
export function groupExactDuplicates(assets: AssetFact[]): AssetGroup[] {
  const buckets = new Map<string, AssetFact[]>();

  for (const asset of assets) {
    if (asset.isFavorite) continue;
    // A zero size means the native size lookup failed; bucketing on it would
    // match unrelated photos together.
    if (asset.sizeBytes === 0) continue;

    const key = `${asset.sizeBytes}:${asset.width}x${asset.height}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(asset);
    else buckets.set(key, [asset]);
  }

  const groups: AssetGroup[] = [];
  for (const [key, members] of buckets) {
    if (members.length < 2) continue;
    groups.push({
      id: `exact:${key}`,
      assetIds: members.map((m) => m.id),
      keeperId: pickKeeper(members).id,
    });
  }
  return groups;
}
