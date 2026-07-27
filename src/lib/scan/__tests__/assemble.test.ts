import { assemble } from '@/lib/scan/assemble';
import { LARGE_VIDEO_BYTES, type AssetGroup } from '@/lib/scan/types';
import { asset } from './fixtures';

const group = (id: string, assetIds: string[], keeperId: string): AssetGroup => ({
  id,
  assetIds,
  keeperId,
});

test('an empty library frees nothing', () => {
  const result = assemble([], []);
  expect(result.totalFreeableBytes).toBe(0);
  expect(result.deletableIds.size).toBe(0);
});

test('duplicate surplus lands in exactDuplicates and the keeper does not', () => {
  const assets = [
    asset({ id: 'keep', sizeBytes: 100 }),
    asset({ id: 'drop', sizeBytes: 100 }),
  ];
  const result = assemble(assets, [group('exact:x', ['keep', 'drop'], 'keep')]);

  expect(result.perCategory.exactDuplicates.assetIds).toEqual(['drop']);
  expect(result.deletableIds.has('keep')).toBe(false);
  expect(result.totalFreeableBytes).toBe(100);
});

test('similar groups are categorized separately from exact ones', () => {
  const assets = [asset({ id: 'a' }), asset({ id: 'b' })];
  const result = assemble(assets, [group('sim:a', ['a', 'b'], 'a')]);

  expect(result.perCategory.similarPhotos.assetIds).toEqual(['b']);
  expect(result.perCategory.exactDuplicates.assetIds).toEqual([]);
});

test('a keeper that is also a screenshot is never offered for deletion', () => {
  // This is the double-counting trap: without the keeper guard the screenshot
  // inflates the category total while being excluded from the headline.
  const assets = [
    asset({ id: 'keep', subtype: 'screenshot', sizeBytes: 100 }),
    asset({ id: 'drop', subtype: 'screenshot', sizeBytes: 100 }),
  ];
  const result = assemble(assets, [group('exact:x', ['keep', 'drop'], 'keep')]);

  expect(result.perCategory.screenshots.assetIds).toEqual(['drop']);
  expect(result.deletableIds.has('keep')).toBe(false);
  expect(result.totalFreeableBytes).toBe(100);
});

test('an asset in two categories is counted once in the total', () => {
  // A big video that is also a screen recording appears in both buckets, but
  // the headline number must not double it.
  const assets = [
    asset({ id: 'rec', subtype: 'screenRecording', sizeBytes: LARGE_VIDEO_BYTES }),
  ];
  const result = assemble(assets, []);

  expect(result.perCategory.screenRecordings.assetIds).toEqual(['rec']);
  expect(result.perCategory.largeVideos.assetIds).toEqual(['rec']);
  expect(result.totalFreeableBytes).toBe(LARGE_VIDEO_BYTES);
});

test('favourites never appear in any category', () => {
  const assets = [asset({ id: 'fav', subtype: 'screenshot', isFavorite: true })];
  const result = assemble(assets, []);

  for (const bucket of Object.values(result.perCategory)) {
    expect(bucket.assetIds).toEqual([]);
  }
  expect(result.totalFreeableBytes).toBe(0);
});

test('adding similar groups never lowers the freeable total', () => {
  // Phase 2 refines the number upward. A drop would mean the user watched the
  // promise shrink while the app was still working.
  const assets = [
    asset({ id: 'a', sizeBytes: 100 }),
    asset({ id: 'b', sizeBytes: 100 }),
    asset({ id: 'c', sizeBytes: 300, width: 100, height: 100 }),
    asset({ id: 'd', sizeBytes: 400, width: 100, height: 100 }),
  ];
  const phase1 = assemble(assets, [group('exact:x', ['a', 'b'], 'a')]);
  const phase2 = assemble(assets, [
    group('exact:x', ['a', 'b'], 'a'),
    group('sim:c', ['c', 'd'], 'd'),
  ]);

  expect(phase2.totalFreeableBytes).toBeGreaterThanOrEqual(phase1.totalFreeableBytes);
});
