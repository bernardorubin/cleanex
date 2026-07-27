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
