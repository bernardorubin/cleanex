/**
 * The two honest claims CleanEx can make from a history of disk-space
 * samples: how much has been recovered, and how fast the phone is filling.
 * Both return null rather than a figure they cannot stand behind — a wrong
 * number in the weekly review costs more than the review saying nothing.
 */

export type DiskSample = { sampledAt: number; freeBytes: number; totalBytes: number };

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Below this many readings, a "trend" is indistinguishable from a
 * coincidence — two points always draw a straight line, so we require
 * enough of them that a single odd reading can't decide the story.
 */
const MIN_SAMPLES = 5;

/**
 * Below this span, day-to-day churn (a deleted photo here, a new one there)
 * dominates whatever the samples show. Two weeks is the shortest window
 * where a real trend has room to separate itself from noise.
 */
const MIN_SPAN_MS = 2 * WEEK_MS;

/**
 * A trend is only claimable if the net movement is a real fraction of the
 * total back-and-forth between samples. When free space bounces up and down
 * by gigabytes but nets out near zero, that's churn cancelling itself out,
 * not a direction — and neither "space recovered" nor "fill rate" should
 * put a confident sign on churn.
 */
const MIN_SIGNAL_RATIO = 0.2;

function byTime(samples: DiskSample[]): DiskSample[] {
  return [...samples].sort((a, b) => a.sampledAt - b.sampledAt);
}

/** True when the series has enough history, enough span, and enough signal to support a directional claim. */
function isTrustworthy(sorted: DiskSample[]): boolean {
  if (sorted.length < MIN_SAMPLES) return false;

  const span = sorted[sorted.length - 1].sampledAt - sorted[0].sampledAt;
  if (span < MIN_SPAN_MS) return false;

  let netChange = 0;
  let totalMovement = 0;
  for (let i = 1; i < sorted.length; i++) {
    const delta = sorted[i].freeBytes - sorted[i - 1].freeBytes;
    netChange += delta;
    totalMovement += Math.abs(delta);
  }
  if (totalMovement === 0) return true; // perfectly flat: nothing to disagree on
  return Math.abs(netChange) / totalMovement >= MIN_SIGNAL_RATIO;
}

/**
 * Cumulative space recovered across the history.
 *
 * Free space rises when the user deletes and falls when they take photos or
 * install apps, so the naive "last minus first" is wrong: it nets deletions
 * against unrelated consumption and can even go negative after a great
 * cleanup week that's followed by a video-heavy vacation. What the user
 * actually did — the thing worth telling them — is the sum of every rise:
 * each time free space went up, that increase is space they got back,
 * regardless of what happened to it afterward.
 */
export function freedTotal(samples: DiskSample[]): number | null {
  const sorted = byTime(samples);
  if (!isTrustworthy(sorted)) return null;

  let total = 0;
  for (let i = 1; i < sorted.length; i++) {
    const delta = sorted[i].freeBytes - sorted[i - 1].freeBytes;
    if (delta > 0) total += delta;
  }
  return total;
}

/**
 * How fast the phone is filling, in bytes per week.
 *
 * Computed from net change in free space (first sample to last), not the
 * sum of drops, because "how fast is it filling" is a question about the
 * overall trajectory, not every individual dip. Positive means free space
 * is trending down — the phone is filling. A negative result means free
 * space is trending up over the period: the user is net ahead, and the
 * caller should read that as "you're winning," not treat it as an invalid
 * or missing figure — null already covers "we don't trust this."
 */
export function fillRatePerWeek(samples: DiskSample[]): number | null {
  const sorted = byTime(samples);
  if (!isTrustworthy(sorted)) return null;

  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const spanWeeks = (last.sampledAt - first.sampledAt) / WEEK_MS;
  const netFreeChange = last.freeBytes - first.freeBytes;
  return -netFreeChange / spanWeeks;
}
