import type { AssetFact } from '@/lib/scan/types';

/**
 * Largest first — the whole point of the browser screen. Sorted on a copy so
 * callers can keep holding the scan result's own array.
 *
 * Array.prototype.sort is stable in every engine we target, so equal sizes keep
 * library order rather than shuffling between renders.
 */
export function sortBySizeDesc(assets: AssetFact[]): AssetFact[] {
  return [...assets].sort((a, b) => b.sizeBytes - a.sizeBytes);
}

/**
 * Pre-chunking into rows lets the grid be a FlatList of rows rather than of
 * cells. That is what makes getItemLayout exact: a row is always one fixed
 * height, whereas FlatList's own numColumns handling does not give reliable
 * offsets for a library this size.
 */
export function chunkIntoRows<T>(items: T[], columns: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns));
  }
  return rows;
}

/**
 * Favourites are selectable here — this screen recommends nothing, the user
 * chooses. The protection is naming them in the confirmation instead.
 */
export function countFavourites(assets: AssetFact[], ids: Set<string>): number {
  let count = 0;
  for (const asset of assets) {
    if (asset.isFavorite && ids.has(asset.id)) count += 1;
  }
  return count;
}

/** "2:05". Minutes are never rolled up into hours — "61:01" reads fine. */
export function formatDuration(seconds: number): string {
  const total = Math.max(Math.floor(seconds), 0);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${rest.toString().padStart(2, '0')}`;
}
