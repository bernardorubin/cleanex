import { findSimilarPairs, inventory } from '@modules/photo-scan';

import { assemble } from '@/lib/scan/assemble';
import { groupExactDuplicates } from '@/lib/scan/duplicates';
import { clusterBySimilarity } from '@/lib/scan/similar';
import { openCache, pruneMissing, saveAssets, saveClusters } from '@/lib/scan/cache';
import type { AssetGroup, ScanProgress, ScanResult } from '@/lib/scan/types';

/**
 * Two-phase scan. Phase 1 is metadata only and produces the headline number
 * within seconds. Phase 2 runs Vision and refines the number upward, so the
 * caller renders twice rather than making the user watch a blank progress bar.
 */
export async function runScan(
  onProgress: (progress: ScanProgress) => void,
): Promise<ScanResult> {
  const db = await openCache();

  // --- Phase 1: fast inventory --------------------------------------------
  const { assets } = await inventory();
  onProgress({ phase: 'inventory', assetCount: assets.length });

  await saveAssets(db, assets);
  await pruneMissing(
    db,
    assets.map((a) => a.id),
  );

  const exactGroups = groupExactDuplicates(assets);
  onProgress({ phase: 'categorized', result: assemble(assets, exactGroups) });

  // --- Phase 2: similarity -------------------------------------------------
  const candidates = assets
    .filter((a) => a.subtype === 'photo' && !a.isFavorite)
    .map((a) => a.id);

  const { pairs } = await findSimilarPairs(candidates);
  const similarGroups = clusterBySimilarity(assets, pairs);
  await saveClusters(db, clusterMap(similarGroups));

  const final = assemble(assets, [...exactGroups, ...similarGroups]);
  onProgress({ phase: 'similarity', result: final });

  return final;
}

/** Flattens groups into the asset id → cluster id shape the cache stores. */
function clusterMap(groups: AssetGroup[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const group of groups) {
    for (const id of group.assetIds) map[id] = group.id;
  }
  return map;
}
