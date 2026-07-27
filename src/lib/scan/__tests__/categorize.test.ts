import { categorize } from '@/lib/scan/categorize';
import { asset } from './fixtures';

test('an ordinary camera photo has no categories', () => {
  expect(categorize(asset())).toEqual([]);
});

test('a screenshot is categorized as a screenshot', () => {
  expect(categorize(asset({ subtype: 'screenshot' }))).toContain('screenshots');
});

test('a screen recording is categorized as a screen recording', () => {
  expect(categorize(asset({ subtype: 'screenRecording' }))).toContain('screenRecordings');
});

test('a video at or above the threshold is a large video', () => {
  const big = asset({ subtype: 'video', sizeBytes: 100 * 1024 * 1024 });
  expect(categorize(big)).toContain('largeVideos');
});

test('a video below the threshold is not a large video', () => {
  const small = asset({ subtype: 'video', sizeBytes: 100 * 1024 * 1024 - 1 });
  expect(categorize(small)).not.toContain('largeVideos');
});

test('a photo that is not a camera original was not taken by you', () => {
  expect(categorize(asset({ isCameraOriginal: false }))).toContain('notTakenByYou');
});

test('screenshots are not also reported as notTakenByYou', () => {
  // A screenshot obviously is not a camera original, but reporting it twice
  // double-counts it in the headline number and confuses the user.
  const result = categorize(asset({ subtype: 'screenshot', isCameraOriginal: false }));
  expect(result).toEqual(['screenshots']);
});

test('favourites are never categorized', () => {
  const fav = asset({ subtype: 'screenshot', isFavorite: true, isCameraOriginal: false });
  expect(categorize(fav)).toEqual([]);
});
