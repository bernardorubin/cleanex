import { pickKeeper } from '@/lib/scan/keeper';
import type { AssetFact, AssetGroup } from '@/lib/scan/types';

/**
 * Groups assets from pairwise similarity edges using union-find.
 *
 * Transitivity matters: native code only compares assets inside the same time
 * bucket, so A~B and B~C can both be measured while A~C never is. All three
 * still belong to one group.
 *
 * Favourites are removed before clustering, not after. Removing them after
 * would let a favourite act as a bridge joining two otherwise unrelated
 * photos into a single group.
 */
export function clusterBySimilarity(
  assets: AssetFact[],
  pairs: [string, string][],
): AssetGroup[] {
  const byId = new Map(assets.filter((a) => !a.isFavorite).map((a) => [a.id, a]));

  const parent = new Map<string, string>();

  function find(id: string): string {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root) as string;
    let walk = id;
    while (parent.get(walk) !== root) {
      const next = parent.get(walk) as string;
      parent.set(walk, root);
      walk = next;
    }
    return root;
  }

  function union(a: string, b: string): void {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA === rootB) return;
    // Union toward the smaller id so group ids never depend on pair ordering.
    if (rootA < rootB) parent.set(rootB, rootA);
    else parent.set(rootA, rootB);
  }

  for (const [a, b] of pairs) {
    if (!byId.has(a) || !byId.has(b)) continue;
    if (!parent.has(a)) parent.set(a, a);
    if (!parent.has(b)) parent.set(b, b);
    union(a, b);
  }

  const members = new Map<string, AssetFact[]>();
  for (const id of parent.keys()) {
    const asset = byId.get(id);
    if (!asset) continue;
    const root = find(id);
    const bucket = members.get(root);
    if (bucket) bucket.push(asset);
    else members.set(root, [asset]);
  }

  const groups: AssetGroup[] = [];
  for (const [root, group] of members) {
    if (group.length < 2) continue;
    groups.push({
      id: `sim:${root}`,
      assetIds: group.map((a) => a.id),
      keeperId: pickKeeper(group).id,
    });
  }
  return groups;
}
