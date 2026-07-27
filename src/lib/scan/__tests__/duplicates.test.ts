import { groupExactDuplicates } from '@/lib/scan/duplicates';
import { asset } from './fixtures';

test('identical size and dimensions group together', () => {
  const groups = groupExactDuplicates([asset({ id: 'a' }), asset({ id: 'b' })]);
  expect(groups).toHaveLength(1);
  expect(groups[0].assetIds.sort()).toEqual(['a', 'b']);
});

test('a different byte size means a different group', () => {
  const groups = groupExactDuplicates([
    asset({ id: 'a', sizeBytes: 1_000_000 }),
    asset({ id: 'b', sizeBytes: 1_000_001 }),
  ]);
  expect(groups).toHaveLength(0);
});

test('same size but different dimensions do not group', () => {
  const groups = groupExactDuplicates([
    asset({ id: 'a', width: 1000, height: 1000 }),
    asset({ id: 'b', width: 500, height: 2000 }),
  ]);
  expect(groups).toHaveLength(0);
});

test('groups of one are dropped', () => {
  expect(groupExactDuplicates([asset({ id: 'lonely' })])).toHaveLength(0);
});

test('every group names a keeper that belongs to it', () => {
  const groups = groupExactDuplicates([
    asset({ id: 'a', createdAt: 2000 }),
    asset({ id: 'b', createdAt: 1000 }),
  ]);
  expect(groups[0].assetIds).toContain(groups[0].keeperId);
  expect(groups[0].keeperId).toBe('b'); // oldest wins the tie
});

test('favourites are excluded from duplicate groups entirely', () => {
  const groups = groupExactDuplicates([
    asset({ id: 'a' }),
    asset({ id: 'fav', isFavorite: true }),
  ]);
  // Only one non-favourite remains, so there is no group at all.
  expect(groups).toHaveLength(0);
});

test('a three-way duplicate produces one group of three', () => {
  const groups = groupExactDuplicates([
    asset({ id: 'a' }),
    asset({ id: 'b' }),
    asset({ id: 'c' }),
  ]);
  expect(groups).toHaveLength(1);
  expect(groups[0].assetIds).toHaveLength(3);
});

test('assets with an unknown size never group', () => {
  // Size 0 means the native fallback failed. Grouping on it would match
  // unrelated photos together.
  const groups = groupExactDuplicates([
    asset({ id: 'a', sizeBytes: 0 }),
    asset({ id: 'b', sizeBytes: 0 }),
  ]);
  expect(groups).toHaveLength(0);
});
