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

/**
 * Below this, what the scan found is not the answer to "my phone is full".
 *
 * A guess, like the noise floor — see CLAUDE.md's unmeasured list. It only
 * ever decides whether the Clean tab *adds* a pointer to the guides, never
 * whether the user can delete what was found, so being generous with it costs
 * a quiet line and being stingy costs the one person this app was built for.
 */
export const THIN_FINDING_BYTES = 1_000_000_000;

/**
 * Whether the scan came back with too little to be the whole story.
 *
 * The phone that started this project is permanently full of WhatsApp media,
 * which lives inside WhatsApp's own container where iOS forbids any app from
 * looking. A scan of that phone finds almost nothing and, left to itself, the
 * app declares victory — the worst possible answer for exactly the person it
 * was built for. This is the test that stops it.
 */
export function findingsAreThin(freeableBytes: number): boolean {
  return freeableBytes < THIN_FINDING_BYTES;
}

/** "4.2 GB", "780 MB" — plain units, never bytes or decimals below 1 MB. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${Math.round(bytes / 1e6)} MB`;
  if (bytes >= 1e3) return `${Math.round(bytes / 1e3)} KB`;
  return `${bytes} bytes`;
}

/**
 * The post-delete receipt. Shared by every screen that deletes, so the wording
 * cannot drift between them.
 *
 * It deliberately reports no measured free-space delta, because there is none
 * to measure. `PHAssetChangeRequest.deleteAssets` moves assets to Recently
 * Deleted, where their files keep occupying storage for thirty days — free
 * space right after a delete is unchanged, so sampling it either side reads
 * "Freed 0 bytes" on a successful delete of gigabytes.
 *
 * What is true and knowable at this moment is the size of what was removed and
 * where it went. The thirty-day wait is the same safety net the app already
 * promises at the moment of decision, so naming it here reads as reassurance
 * rather than a shortfall — and the "or sooner" clause is the route to space
 * today for someone who has none.
 *
 * `removedBytes` is the summed asset size, the same figure the confirmation
 * quoted. On an iCloud-optimized library those are full-size originals, so the
 * sentence describes the size of what left the library rather than promising an
 * exact number of bytes the phone gets back.
 */
export function freedMessage(removedBytes: number): string {
  return `Done. ${formatBytes(
    removedBytes,
  )} is now in Recently Deleted. Your phone gets that space back when Recently Deleted empties in 30 days — or sooner, if you empty it yourself in the Photos app.`;
}
