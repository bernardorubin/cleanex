import { categorize } from '@/lib/scan/categorize';
import { deletableIds, estimateFreed } from '@/lib/scan/estimate';
import {
  ALL_CATEGORIES,
  type AssetFact,
  type AssetGroup,
  type CategoryBucket,
  type CategoryId,
  type ScanResult,
} from '@/lib/scan/types';

/**
 * Folds assets and groups into the shape the UI renders.
 *
 * Kept separate from `scanner.ts` so it can be unit-tested: scanner imports the
 * native module at module load, which Jest cannot resolve.
 */
export function assemble(assets: AssetFact[], groups: AssetGroup[]): ScanResult {
  // Keepers are computed across all groups at once, so an asset that keeps one
  // group alive is protected even if another group lists it as surplus.
  const deletable = deletableIds(groups);
  const keepers = new Set(groups.map((g) => g.keeperId));

  const buckets = new Map<CategoryId, Set<string>>(
    ALL_CATEGORIES.map((id) => [id, new Set<string>()]),
  );

  // Group-based categories: only the surplus members, never the keeper.
  for (const group of groups) {
    const category: CategoryId = group.id.startsWith('exact:')
      ? 'exactDuplicates'
      : 'similarPhotos';
    for (const id of group.assetIds) {
      if (deletable.has(id)) buckets.get(category)?.add(id);
    }
  }

  // Per-asset categories. A keeper stays out of every bucket: it is the copy we
  // promised to leave behind, even if it also happens to be a screenshot.
  for (const asset of assets) {
    if (keepers.has(asset.id)) continue;
    for (const category of categorize(asset)) {
      buckets.get(category)?.add(asset.id);
      deletable.add(asset.id);
    }
  }

  const perCategory = Object.fromEntries(
    ALL_CATEGORIES.map((id): [CategoryId, CategoryBucket] => {
      const ids = buckets.get(id) ?? new Set<string>();
      return [id, { assetIds: [...ids], bytes: estimateFreed(assets, ids) }];
    }),
  ) as Record<CategoryId, CategoryBucket>;

  return {
    assets,
    groups,
    perCategory,
    deletableIds: deletable,
    // Summed over the whole set, so an asset in two categories counts once.
    totalFreeableBytes: estimateFreed(assets, deletable),
  };
}
