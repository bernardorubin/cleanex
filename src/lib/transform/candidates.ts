import { LARGE_VIDEO_BYTES, type AssetFact } from '@/lib/scan/types';

export type Quality = 'sharp' | 'phone' | 'smallest';

/**
 * Proportion of the original size retained after re-encoding at each
 * quality. "sharp" still throws away well over half the bytes because most
 * source video is already far denser than any screen this footage will ever
 * play back on.
 */
export const QUALITY_RATIOS: Record<Quality, number> = {
  sharp: 0.4,
  phone: 0.2,
  smallest: 0.1,
};

/**
 * Large videos worth offering a re-encode for.
 *
 * Favourites are excluded per safety rule 1: the app never puts a favourite
 * in front of the user for a destructive action on its own.
 *
 * Live Photos are excluded because a Live Photo is a still-plus-motion pair,
 * not a plain video — re-encoding just the motion half the way a normal
 * video gets compressed breaks that pairing.
 *
 * Slo-mo and time-lapse clips should be excluded too — re-encoding a video
 * whose entire point is its captured frame rate defeats the purpose — but
 * this function CANNOT tell them apart from a normal video. AssetFact only
 * carries width, height and durationSeconds; there is no frame-rate or
 * PHAssetMediaSubtype signal to test, and guessing from resolution/duration
 * alone would misclassify normal clips as often as it catches real ones.
 * That detection has to happen natively, using PHAssetMediaSubtype
 * (.videoHighFrameRate / .videoTimelapse), before a video ever reaches this
 * list — this is a deliberate gap, not an oversight.
 *
 * screenRecording is allowed through on purpose: it compresses well and
 * nobody needs a screen recording to stay sharp.
 */
export function compressibleVideos(assets: AssetFact[]): AssetFact[] {
  return assets.filter(
    (asset) =>
      (asset.subtype === 'video' || asset.subtype === 'screenRecording') &&
      asset.sizeBytes >= LARGE_VIDEO_BYTES &&
      !asset.isFavorite &&
      !asset.isLivePhoto,
  );
}

/**
 * Live Photos worth offering to flatten into a plain still. Favourites are
 * excluded for the same reason as compressibleVideos — never a favourite
 * for a destructive action without the user reaching for it directly.
 */
export function livePhotoCandidates(assets: AssetFact[]): AssetFact[] {
  return assets.filter((asset) => asset.isLivePhoto && !asset.isFavorite);
}

/**
 * Bytes saved — not retained — if every given asset were re-encoded at the
 * given quality. Always >= 0: sizeBytes is never negative and every ratio in
 * QUALITY_RATIOS is below 1, so `1 - ratio` is always a positive fraction.
 */
export function estimateSaving(assets: AssetFact[], quality: Quality): number {
  const ratio = QUALITY_RATIOS[quality];
  let saved = 0;
  for (const asset of assets) {
    saved += asset.sizeBytes * (1 - ratio);
  }
  return saved;
}
