import type { AssetFact, AssetGroup } from '@/lib/scan/types';

/**
 * Every group member except its keeper.
 *
 * Keepers are collected across all groups first: an asset that keeps one group
 * alive must not be deleted because a different group happens to list it as a
 * non-keeper. Without that pass, overlapping groups can empty each other.
 */
export function deletableIds(groups: AssetGroup[]): Set<string> {
  const keepers = new Set(groups.map((g) => g.keeperId));

  const deletable = new Set<string>();
  for (const group of groups) {
    for (const id of group.assetIds) {
      if (!keepers.has(id)) deletable.add(id);
    }
  }
  return deletable;
}

/** Total bytes for the selected assets, counting each asset at most once. */
export function estimateFreed(assets: AssetFact[], ids: Set<string>): number {
  const counted = new Set<string>();
  let total = 0;

  for (const asset of assets) {
    if (!ids.has(asset.id) || counted.has(asset.id)) continue;
    counted.add(asset.id);
    total += asset.sizeBytes;
  }
  return total;
}

/** "4.2 GB", "780 MB" — plain units, never bytes or decimals below 1 MB. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${Math.round(bytes / 1e6)} MB`;
  if (bytes >= 1e3) return `${Math.round(bytes / 1e3)} KB`;
  return `${bytes} bytes`;
}

/**
 * The post-delete receipt: predict with the estimate, report the truth. With
 * iCloud "Optimize iPhone Storage" on, originals live in iCloud and only a
 * placeholder sits on the phone, so freeing a "4 GB" video can recover far
 * less locally. A large gap is the moment to name iCloud rather than quietly
 * show a smaller number. Shared by every screen that deletes, so the wording
 * cannot drift between them.
 */
export function freedMessage(estimatedBytes: number, actualBytes: number): string {
  const shortfall = estimatedBytes - actualBytes;
  const misleading = shortfall > estimatedBytes * 0.25;
  return misleading
    ? `Freed ${formatBytes(actualBytes)}. Less than expected because iCloud was already storing most of these for you.`
    : `Freed ${formatBytes(actualBytes)}.`;
}
