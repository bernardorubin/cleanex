import { formatBytes } from '@/lib/scan/estimate';
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

/**
 * Names the favourites within a selection, for the delete confirmation and
 * the selection footer. "Item" rather than "photo" because /browse is the one
 * screen that lists videos too, and favourites apply to both. Undefined when
 * nothing selected is a favourite: no note needed.
 */
export function favouriteNote(
  favouriteCount: number,
  selectedCount: number,
): string | undefined {
  if (favouriteCount === 0) return undefined;
  if (selectedCount === 1) return 'This item is a favourite.';
  if (favouriteCount === 1) return '1 of these items is a favourite.';
  return `${favouriteCount} of these items are favourites.`;
}

/**
 * The VoiceOver announcement for the selection footer: read aloud when it
 * first appears and whenever the favourite warning changes, since the footer
 * itself is silent otherwise and that warning is the only guard against
 * deleting a favourite. Built from favouriteNote so the wording can never
 * drift from the footer's own visible text.
 */
export function selectionAnnouncement(
  count: number,
  bytes: number,
  favouriteCount: number,
): string {
  const note = favouriteNote(favouriteCount, count);
  const base = `${count} ${count === 1 ? 'item' : 'items'} selected, ${formatBytes(bytes)}.`;
  return note ? `${base} ${note}` : base;
}
