import { formatBytes } from '@/lib/scan/estimate';
import { otherStorageBytes } from '@/lib/storage/breakdown';

/**
 * Copy that more than one screen shows, kept in one place so it cannot drift
 * between them. Wording that appears on only one screen stays on that screen.
 */

/**
 * Shown wherever a screen would otherwise render scan data it cannot trust.
 *
 * It must never contradict a delete receipt sitting beside it: on the Clean tab
 * and /browse the receipt and this notice are siblings, so a rescan that dies
 * straight after a successful delete renders both at once. "Nothing was
 * changed" was true of the scan and false of the session, which is the one
 * thing this sentence is written to avoid.
 */
export const SCAN_FAILED_MESSAGE =
  'CleanEx could not finish looking through your photos, so it cannot show ' +
  'you what is on your phone right now. Nothing was undone — anything you ' +
  'deleted is still deleted.';

/**
 * The live progress line. Phase 1 reports a real asset count within seconds;
 * until it does there is no number to give, and a made-up one would be worse
 * than none.
 */
export function scanProgressMessage(assetCount: number): string {
  return assetCount > 0
    ? `Looking through ${assetCount.toLocaleString()} photos and videos…`
    : 'Opening your photos…';
}

/**
 * Shown wherever the app has no photo access. Split in two because the Clean
 * tab sets the first line larger — the wording itself must not differ between
 * that screen and any other that hits the same wall.
 */
export const PERMISSION_DENIED_LEAD = 'CleanEx cannot see your photos yet.';
export const PERMISSION_DENIED_STEPS =
  'Open the Settings app, find CleanEx in the list, tap Photos, and choose ' +
  'All Photos. Then come back here.';

/**
 * The Clean tab's link into /browse.
 *
 * The size is governed by the same suppression rule as the nameplate's second
 * reading, and for the same reason: on an iCloud-optimized library the summed
 * asset bytes are full-size originals and exceed what the phone holds, so the
 * figure reads as a device-usage number larger than the device. Printing it
 * under a nameplate that suppressed it put "34 GB of 64 GB used" and "84 GB" on
 * one screen. One rule in one place, so the two readings cannot drift again.
 *
 * The count always shows: it is what makes the link worth pressing, and it is
 * true whatever iCloud is doing.
 */
export function browseLinkLabel(
  itemCount: number,
  libraryBytes: number,
  usedBytes: number,
): string {
  const trustworthy = otherStorageBytes(usedBytes, libraryBytes) !== null;
  const items = `${itemCount.toLocaleString()} ${itemCount === 1 ? 'item' : 'items'}`;
  return `Everything on your phone · ${items}${
    trustworthy ? ` · ${formatBytes(libraryBytes)}` : ''
  }`;
}

/**
 * What the Clean tab says instead of "Nothing to clean up."
 *
 * That sentence was the app's worst answer, and it was reserved for the
 * person it was written for: a phone permanently full of WhatsApp media,
 * which lives inside WhatsApp's own container where iOS forbids every app —
 * this one included — from looking. The scan finds nothing, and the app
 * congratulates itself while the phone is still too full to take a photo.
 *
 * So it stops declaring victory and says where the room actually went. Three
 * things have to be true of this copy at once: it must not imply CleanEx can
 * reach that storage (it cannot, ever), it must not read as a failure or an
 * apology, and it must leave one plain thing to press.
 */
export function nothingFoundLead(assetCount: number): string {
  if (assetCount <= 0) {
    return 'There are no photos or videos on your phone for CleanEx to look through.';
  }
  return `We looked through ${assetCount.toLocaleString()} photos and videos and did not find much worth deleting.`;
}

export const NOTHING_FOUND_BODY =
  'That does not mean your phone is empty. Photos and videos people send ' +
  'you in WhatsApp and other messaging apps are kept inside those apps, and ' +
  'no app on your phone — including this one — is allowed to look in there. ' +
  'On a phone that stays full, that is usually where the room has gone. ' +
  'CleanEx cannot clear it for you, but the guides show you exactly what to ' +
  'tap, step by step.';

/** The one thing to press when the breaker has nothing to throw. */
export const NOTHING_FOUND_ACTION = 'Show me the guides';

/**
 * The quieter version, for a scan that found something but not much. The
 * directory and the breaker still stand — this only adds the other half of
 * the answer underneath them.
 */
export const SPACE_ELSEWHERE_LINK_LABEL = 'Where else your space might be';

/**
 * The guide screen's result after a trip to another app. Unlike a photo-library
 * delete, this one *is* a real measurement: the other app clears its own
 * container, so free space genuinely moves while CleanEx is in the
 * background. Spoken to VoiceOver as well as shown, hence one function.
 */
export function guideFreedMessage(bytes: number): string {
  return `You freed ${formatBytes(bytes)}.`;
}
