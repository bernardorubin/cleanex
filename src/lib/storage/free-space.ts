/**
 * Free space measured across a round trip out of the app and back.
 *
 * This is the only place in the product where a freed figure is a real
 * measurement rather than the size of what left the library: the user goes to
 * Photos (or another app), empties something there, and comes back, so free
 * space genuinely moves while CleanEx is in the background.
 */

/**
 * iOS purges caches and downloads iCloud assets on its own, so a small change
 * in free space cannot be attributed to anything the user did. Below this we
 * say nothing rather than report a number we cannot stand behind.
 *
 * Still a guess — see CLAUDE.md's unmeasured list. It decides whether the
 * "you got back X" line appears at all, which is why it lives in one place
 * instead of being written out again on every screen that measures.
 */
export const NOISE_FLOOR_BYTES = 200_000_000;

/**
 * The gain worth telling the user about, or null when there is none.
 *
 * Null covers three cases that all mean the same thing on screen — nothing:
 * free space fell (the phone got fuller while they were away), it did not
 * move, or it moved by less than the noise floor.
 */
export function reportableGain(
  freeBeforeBytes: number,
  freeAfterBytes: number,
): number | null {
  const delta = freeAfterBytes - freeBeforeBytes;
  return delta >= NOISE_FLOOR_BYTES ? delta : null;
}
