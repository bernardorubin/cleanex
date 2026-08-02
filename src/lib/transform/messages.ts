import { formatBytes } from '@/lib/scan/estimate';

/**
 * Copy for the two flows that behave unlike every other screen in the app:
 * transforms (shrinking a video, flattening a Live Photo) that replace the
 * original outright, and the Recently Deleted bin that no app — including
 * this one — is allowed to read or empty on the user's behalf.
 *
 * Every sentence here is read by someone who has never done this before and
 * may be frightened of losing something. Plain, calm, concrete; never
 * jargon, never alarm, never urgency. See DESIGN.md's Copy section, and
 * `src/lib/scan/messages.ts` for the same voice applied to delete.
 */

/**
 * The one irreversible fact in the app, said once in plain words rather than
 * with a warning icon. Everything else a user does here — including a plain
 * delete — leaves the original sitting in Recently Deleted, recoverable for
 * 30 days on request. A transform is different: the original still goes to
 * Recently Deleted, but nobody asked to get it back, so once those 30 days
 * run out there is no version of this photo or video left at its original
 * quality.
 */
export const TRANSFORM_IRREVERSIBLE_SENTENCE =
  'This replaces the original, and once Recently Deleted empties in 30 days, there is no getting it back.';

/**
 * The counter-intuitive half of the confirmation: shrinking something does
 * not shrink the phone's usage right away. The original moves to Recently
 * Deleted — it does not disappear — so for the next 30 days the phone is
 * carrying both the original and the new, smaller copy at once.
 */
export const TRANSFORM_DELAY_SENTENCE =
  'Your phone gets a little fuller before it gets emptier — the original moves to Recently Deleted and sits there for 30 days, using space the whole time.';

/**
 * The pre-compression estimate: how many videos, and roughly how much
 * smaller. "about" carries the estimate label — nothing here has been
 * measured yet, so nothing claims to be exact.
 */
export function compressionEstimateMessage(
  videoCount: number,
  estimatedSavingsBytes: number,
): string {
  const videos = videoCount === 1 ? '1 video' : `${videoCount.toLocaleString()} videos`;
  const total = videoCount === 1 ? '' : ', in total';
  return `${videos}, about ${formatBytes(estimatedSavingsBytes)} smaller${total}.`;
}

/** Shown instead of the estimate when there are no videos worth shrinking. */
export const NO_VIDEOS_TO_COMPRESS_MESSAGE =
  'You have no big videos to shrink right now.';

/**
 * The measured result after a real compression, built only from real
 * before/after byte counts — never the earlier estimate, which may have
 * promised more than the encoder actually delivered.
 *
 * It repeats the Recently Deleted fact rather than assume the reader
 * remembers the confirmation screen: this is the moment someone could
 * mistake "smaller" for "your phone already has that space back."
 */
export function compressionResultMessage(
  videoCount: number,
  beforeBytes: number,
  afterBytes: number,
): string {
  const savedBytes = Math.max(beforeBytes - afterBytes, 0);
  const videos = videoCount === 1 ? '1 video' : `${videoCount.toLocaleString()} videos`;
  const verb = videoCount === 1 ? 'is' : 'are';
  const total = videoCount === 1 ? '' : ', in total';
  const original = videoCount === 1 ? 'The original stays' : 'The originals stay';
  return (
    `Done. ${videos} ${verb} now ${formatBytes(savedBytes)} smaller${total}. ` +
    `${original} in Recently Deleted for 30 days before your phone gets that space back.`
  );
}

/**
 * Most people have Live Photos without knowing the term, so every screen
 * that estimates a conversion says what one actually is before it names a
 * count.
 */
export const LIVE_PHOTO_EXPLANATION =
  'A Live Photo is a photo that also captures a couple of seconds of motion and sound around it.';

/** The pre-conversion estimate: count, saving, and what a Live Photo is. */
export function livePhotoEstimateMessage(
  count: number,
  estimatedSavingsBytes: number,
): string {
  const photos = count === 1 ? '1 Live Photo' : `${count.toLocaleString()} Live Photos`;
  const total = count === 1 ? '' : ', in total';
  return `${LIVE_PHOTO_EXPLANATION} ${photos}, about ${formatBytes(estimatedSavingsBytes)} smaller${total}.`;
}

/** Shown instead of the estimate when there are no Live Photos to convert. */
export const NO_LIVE_PHOTOS_TO_CONVERT_MESSAGE =
  'You have no Live Photos to convert right now.';

/**
 * The measured result after a real conversion, from real before/after byte
 * counts. Mirrors compressionResultMessage's shape and its Recently Deleted
 * reminder, for the same reason.
 */
export function livePhotoResultMessage(
  count: number,
  beforeBytes: number,
  afterBytes: number,
): string {
  const savedBytes = Math.max(beforeBytes - afterBytes, 0);
  const photos = count === 1 ? '1 Live Photo' : `${count.toLocaleString()} Live Photos`;
  const nowText = count === 1 ? 'is now a plain photo' : 'are now plain photos';
  const total = count === 1 ? '' : ', in total';
  const original = count === 1 ? 'The original stays' : 'The originals stay';
  return (
    `Done. ${photos} ${nowText}, ${formatBytes(savedBytes)} smaller${total}. ` +
    `${original} in Recently Deleted for 30 days before your phone gets that space back.`
  );
}

/**
 * Explains why the number on screen has not made the phone feel any
 * different yet: no app, including this one, can read or empty Recently
 * Deleted. It never says the space is free — only that it is waiting.
 */
export function binWaitingMessage(bytes: number): string {
  return `${formatBytes(bytes)} is waiting in Recently Deleted. Your phone will not feel any lighter until you clear it from there too.`;
}

/** The manual path, since the sandbox blocks the automatic one. */
export const BIN_STEPS: string[] = [
  'Open Photos.',
  'Tap Albums, then Recently Deleted.',
  'Tap Select at the top right.',
  'Tap Delete All.',
];

/**
 * The measured result after the user empties Recently Deleted themselves —
 * a real free-space reading taken before and after the trip, the same way
 * `guideFreedMessage` measures a trip to another app.
 */
export function binEmptiedMessage(freedBytes: number): string {
  return `You got back ${formatBytes(freedBytes)}.`;
}

/** Shown instead of the explanation when Recently Deleted has nothing in it. */
export const NOTHING_IN_BIN_MESSAGE =
  'Recently Deleted is empty right now. There is nothing waiting to clear.';
