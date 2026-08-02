import {
  compressibleVideos,
  DEFAULT_QUALITY,
  estimateLivePhotoSaving,
  estimateSaving,
  livePhotoCandidates,
  LIVE_PHOTO_STILL_RATIO,
  QUALITY_RATIOS,
} from '@/lib/transform/candidates';
import { asset } from '@/lib/scan/__tests__/fixtures';
import { LARGE_VIDEO_BYTES } from '@/lib/scan/types';

describe('compressibleVideos', () => {
  it('includes a video at or above the large-video threshold', () => {
    const big = asset({
      id: 'big',
      subtype: 'video',
      sizeBytes: LARGE_VIDEO_BYTES,
      durationSeconds: 120,
    });
    expect(compressibleVideos([big]).map((a) => a.id)).toEqual(['big']);
  });

  it('excludes a video below the threshold', () => {
    const small = asset({
      id: 'small',
      subtype: 'video',
      sizeBytes: LARGE_VIDEO_BYTES - 1,
      durationSeconds: 30,
    });
    expect(compressibleVideos([small])).toEqual([]);
  });

  it('excludes a favourite video even when it is large', () => {
    const favourite = asset({
      id: 'fave',
      subtype: 'video',
      sizeBytes: LARGE_VIDEO_BYTES * 2,
      durationSeconds: 60,
      isFavorite: true,
    });
    expect(compressibleVideos([favourite])).toEqual([]);
  });

  it('excludes a Live Photo even when it is large', () => {
    const livePhoto = asset({
      id: 'live',
      subtype: 'video',
      sizeBytes: LARGE_VIDEO_BYTES * 2,
      durationSeconds: 3,
      isLivePhoto: true,
    });
    expect(compressibleVideos([livePhoto])).toEqual([]);
  });

  it('includes a screen recording at or above the threshold', () => {
    const recording = asset({
      id: 'recording',
      subtype: 'screenRecording',
      sizeBytes: LARGE_VIDEO_BYTES,
      durationSeconds: 200,
    });
    expect(compressibleVideos([recording]).map((a) => a.id)).toEqual([
      'recording',
    ]);
  });

  it('excludes non-video subtypes even when large', () => {
    const bigPhoto = asset({
      id: 'photo',
      subtype: 'photo',
      sizeBytes: LARGE_VIDEO_BYTES * 2,
    });
    const bigScreenshot = asset({
      id: 'screenshot',
      subtype: 'screenshot',
      sizeBytes: LARGE_VIDEO_BYTES * 2,
    });
    expect(compressibleVideos([bigPhoto, bigScreenshot])).toEqual([]);
  });

  it('mixes eligible and ineligible assets correctly in one pass', () => {
    const eligible = asset({
      id: 'eligible',
      subtype: 'video',
      sizeBytes: LARGE_VIDEO_BYTES,
      durationSeconds: 90,
    });
    const tooSmall = asset({
      id: 'too-small',
      subtype: 'video',
      sizeBytes: 1_000,
      durationSeconds: 5,
    });
    const favourite = asset({
      id: 'favourite',
      subtype: 'video',
      sizeBytes: LARGE_VIDEO_BYTES,
      durationSeconds: 90,
      isFavorite: true,
    });
    const live = asset({
      id: 'live',
      subtype: 'video',
      sizeBytes: LARGE_VIDEO_BYTES,
      durationSeconds: 3,
      isLivePhoto: true,
    });
    expect(
      compressibleVideos([eligible, tooSmall, favourite, live]).map(
        (a) => a.id,
      ),
    ).toEqual(['eligible']);
  });
});

describe('livePhotoCandidates', () => {
  it('includes a non-favourite Live Photo', () => {
    const live = asset({ id: 'live', isLivePhoto: true });
    expect(livePhotoCandidates([live]).map((a) => a.id)).toEqual(['live']);
  });

  it('excludes a favourite Live Photo', () => {
    const live = asset({ id: 'live', isLivePhoto: true, isFavorite: true });
    expect(livePhotoCandidates([live])).toEqual([]);
  });

  it('excludes assets that are not Live Photos', () => {
    const plain = asset({ id: 'plain', isLivePhoto: false });
    expect(livePhotoCandidates([plain])).toEqual([]);
  });
});

describe('estimateSaving', () => {
  it('returns 0 for an empty list', () => {
    expect(estimateSaving([], 'sharp')).toBe(0);
  });

  it('computes bytes saved at sharp quality (60% of size)', () => {
    const a = asset({ sizeBytes: 100_000_000 });
    expect(QUALITY_RATIOS.sharp).toBe(0.4);
    expect(estimateSaving([a], 'sharp')).toBe(60_000_000);
  });

  it('computes bytes saved at phone quality (80% of size)', () => {
    const a = asset({ sizeBytes: 100_000_000 });
    expect(QUALITY_RATIOS.phone).toBe(0.2);
    expect(estimateSaving([a], 'phone')).toBe(80_000_000);
  });

  it('computes bytes saved at smallest quality (90% of size)', () => {
    const a = asset({ sizeBytes: 100_000_000 });
    expect(QUALITY_RATIOS.smallest).toBe(0.1);
    expect(estimateSaving([a], 'smallest')).toBe(90_000_000);
  });

  it('sums saved bytes across multiple assets', () => {
    const a = asset({ id: 'a', sizeBytes: 100_000_000 });
    const b = asset({ id: 'b', sizeBytes: 50_000_000 });
    expect(estimateSaving([a, b], 'phone')).toBe(120_000_000);
  });

  it('never returns a negative number', () => {
    const zero = asset({ sizeBytes: 0 });
    expect(estimateSaving([zero], 'sharp')).toBe(0);
    expect(estimateSaving([zero], 'sharp')).toBeGreaterThanOrEqual(0);

    const tiny = asset({ sizeBytes: 1 });
    expect(estimateSaving([tiny], 'smallest')).toBeGreaterThanOrEqual(0);
  });
});

describe('DEFAULT_QUALITY', () => {
  it('pre-selects the middle choice, not the most aggressive one', () => {
    expect(DEFAULT_QUALITY).toBe('phone');
  });
});

describe('estimateLivePhotoSaving', () => {
  it('returns 0 for an empty list', () => {
    expect(estimateLivePhotoSaving([])).toBe(0);
  });

  it('saves the video half — about half the size', () => {
    expect(LIVE_PHOTO_STILL_RATIO).toBe(0.5);
    const live = asset({ sizeBytes: 6_000_000, isLivePhoto: true });
    expect(estimateLivePhotoSaving([live])).toBe(3_000_000);
  });

  it('sums saved bytes across many Live Photos', () => {
    const a = asset({ id: 'a', sizeBytes: 6_000_000, isLivePhoto: true });
    const b = asset({ id: 'b', sizeBytes: 4_000_000, isLivePhoto: true });
    expect(estimateLivePhotoSaving([a, b])).toBe(5_000_000);
  });

  it('never returns a negative number', () => {
    expect(estimateLivePhotoSaving([asset({ sizeBytes: 0 })])).toBe(0);
    expect(
      estimateLivePhotoSaving([asset({ sizeBytes: 1 })]),
    ).toBeGreaterThanOrEqual(0);
  });
});
