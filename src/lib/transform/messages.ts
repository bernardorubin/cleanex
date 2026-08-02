import { formatBytes } from '@/lib/scan/estimate';
import type { Quality } from '@/lib/transform/candidates';

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

/** The Clean tab's way in, and the screen's own opening line. */
export function transformsLinkLabel(
  videoCount: number,
  livePhotoCount: number,
): string {
  const parts: string[] = [];
  if (videoCount > 0) {
    parts.push(`${videoCount.toLocaleString()} ${videoCount === 1 ? 'big video' : 'big videos'}`);
  }
  if (livePhotoCount > 0) {
    parts.push(
      `${livePhotoCount.toLocaleString()} ${livePhotoCount === 1 ? 'Live Photo' : 'Live Photos'}`,
    );
  }
  return parts.length > 0
    ? `Make things smaller · ${parts.join(', ')}`
    : 'Make things smaller';
}

export const TRANSFORMS_LEAD =
  'Not everything big is worth deleting. These two make things smaller ' +
  'instead, and you keep the photo or video itself.';

export const COMPRESSION_SECTION_TITLE = 'Big videos';
export const LIVE_PHOTO_SECTION_TITLE = 'Live Photos';

/**
 * The three qualities, named by what the result looks like rather than by
 * resolution. Nobody in this audience knows what 1080p means, and a number
 * they cannot judge is worse than no number: it makes the choice feel
 * technical, and a technical-feeling choice does not get made at all.
 */
export const QUALITY_LABELS: Record<Quality, string> = {
  sharp: 'Keep it sharp',
  phone: 'Good for the phone',
  smallest: 'Smallest',
};

/** One plain outcome per choice, so the trade-off is legible without jargon. */
export const QUALITY_DESCRIPTIONS: Record<Quality, string> = {
  sharp: 'Still looks its best on a big television. Saves the least room.',
  phone: 'Looks the same on your phone. Saves a lot of room.',
  smallest: 'Fine to watch on your phone. Saves the most room.',
};

/** Names the action, and says how many, the way every control in the app does. */
export function compressionButtonLabel(videoCount: number): string {
  return `Shrink ${videoCount.toLocaleString()} ${videoCount === 1 ? 'video' : 'videos'}`;
}

export function livePhotoButtonLabel(count: number): string {
  return `Convert ${count.toLocaleString()} ${count === 1 ? 'Live Photo' : 'Live Photos'}`;
}

/**
 * Safety rule 6: a transform never runs without an explicit confirmation
 * naming what is irreversible. The estimate opens it, the irreversible
 * sentence and the late-arriving space follow — in that order, because the
 * reader has to know what they are getting before they can weigh the cost.
 */
export function compressionConfirmTitle(videoCount: number): string {
  return `${compressionButtonLabel(videoCount)}?`;
}

export function compressionConfirmBody(
  videoCount: number,
  estimatedSavingsBytes: number,
): string {
  return [
    compressionEstimateMessage(videoCount, estimatedSavingsBytes),
    TRANSFORM_IRREVERSIBLE_SENTENCE,
    TRANSFORM_DELAY_SENTENCE,
  ].join('\n\n');
}

export function livePhotoConfirmTitle(count: number): string {
  return `${livePhotoButtonLabel(count)}?`;
}

export function livePhotoConfirmBody(
  count: number,
  estimatedSavingsBytes: number,
): string {
  return [
    livePhotoEstimateMessage(count, estimatedSavingsBytes),
    TRANSFORM_IRREVERSIBLE_SENTENCE,
    TRANSFORM_DELAY_SENTENCE,
  ].join('\n\n');
}

/**
 * Progress, told honestly.
 *
 * Nothing native reports how far through one encode is, so there is no
 * percentage to show and inventing one would be a lie the user can feel: a
 * bar that sits at 40% for four minutes reads as broken. What is true and
 * knowable is which item is being worked on and how many there are.
 */
export function compressionProgressMessage(index: number, total: number): string {
  if (total <= 1) return 'Shrinking your video…';
  return `Shrinking video ${index.toLocaleString()} of ${total.toLocaleString()}…`;
}

export function livePhotoProgressMessage(done: number, total: number): string {
  if (total <= 1) return 'Converting your Live Photo…';
  return `Converting your Live Photos. ${done.toLocaleString()} of ${total.toLocaleString()} done…`;
}

/** The way out, required rather than optional — encoding is minutes of a hot phone. */
export const STOP_TRANSFORM_LABEL = 'Stop';

/**
 * Shown only when the user stopped before anything finished. When some items
 * did finish, the measured result message is shown instead — those are
 * genuinely done, and saying otherwise would be the lie in the other
 * direction.
 */
export const TRANSFORM_STOPPED_MESSAGE =
  'Stopped. Nothing on your phone was changed.';

export const COMPRESSION_FAILED_MESSAGE =
  'Those videos could not be shrunk, so nothing on your phone was changed. ' +
  'They are exactly as they were.';

export const LIVE_PHOTO_CONVERSION_FAILED_MESSAGE =
  'Those Live Photos could not be converted, so nothing on your phone was ' +
  'changed. They are exactly as they were.';

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

/**
 * The heading over the steps. It names the outcome the user wants rather
 * than the chore they have to do — this is the tap that finally makes the
 * phone feel lighter, and it should read that way.
 */
export const BIN_STEPS_TITLE = 'Get the space now';

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
