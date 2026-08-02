import { formatBytes } from '@/lib/scan/estimate';

/**
 * The one line of storage progress the Clean tab is allowed to print.
 *
 * `freedTotal` and `fillRatePerWeek` already refuse to answer when the sample
 * history cannot support a claim — they return null. This module turns what
 * survives that gate into a sentence, and returns null itself when there is
 * nothing worth saying. A new user sees nothing at all for their first two
 * weeks; that is the design, not a broken state.
 *
 * No chart, no graph, no percentage. A number and a sentence.
 */

/**
 * Below this, a week's movement is churn — a few cleared caches, one video
 * shot, an app update. Printing "filling up by about 40 MB a week" invites a
 * worry that the number cannot support.
 */
const MIN_CLAIMABLE_BYTES = 200_000_000;

/**
 * Deliberately *not* "you have freed 6.2 GB with CleanEx".
 *
 * `freedTotal` sums every rise in free space over the history, and free space
 * also rises when iOS purges its own caches or the user deletes something in
 * another app entirely. Claiming credit for all of it would be the same class
 * of mistake as reporting a freed-space delta after a delete: a real number
 * with a false cause attached. Time-scoping the claim keeps every word of it
 * true.
 */
export function freedTotalMessage(bytes: number): string {
  return `You have got ${formatBytes(bytes)} back since you started using CleanEx.`;
}

/** The trend, labelled "about" because it is one — a rate, not a reading. */
export function fillRateMessage(bytesPerWeek: number): string {
  return `Your phone is filling up by about ${formatBytes(bytesPerWeek)} a week.`;
}

/**
 * The other direction. `fillRatePerWeek` goes negative when free space is
 * trending up, which is the user winning — it deserves a sentence of its own
 * rather than a negative number in the filling-up one.
 */
export const GAINING_SPACE_MESSAGE = 'Your phone has been getting emptier, not fuller.';

/**
 * Both halves, joined, or null when neither can be said.
 *
 * Each half is suppressed on its own terms: a total too small to be worth a
 * sentence, or a rate small enough in either direction that the phone is
 * really just holding steady.
 */
export function storageProgressLine(
  freedBytes: number | null,
  fillRateBytesPerWeek: number | null,
): string | null {
  const parts: string[] = [];

  if (freedBytes !== null && freedBytes >= MIN_CLAIMABLE_BYTES) {
    parts.push(freedTotalMessage(freedBytes));
  }

  if (fillRateBytesPerWeek !== null) {
    if (fillRateBytesPerWeek >= MIN_CLAIMABLE_BYTES) {
      parts.push(fillRateMessage(fillRateBytesPerWeek));
    } else if (fillRateBytesPerWeek <= -MIN_CLAIMABLE_BYTES) {
      parts.push(GAINING_SPACE_MESSAGE);
    }
  }

  return parts.length > 0 ? parts.join(' ') : null;
}
