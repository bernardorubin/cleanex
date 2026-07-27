import { clusterBySimilarity } from '@/lib/scan/similar';
import { asset } from './fixtures';

test('a single pair becomes one group of two', () => {
  const groups = clusterBySimilarity([asset({ id: 'a' }), asset({ id: 'b' })], [['a', 'b']]);
  expect(groups).toHaveLength(1);
  expect(groups[0].assetIds.sort()).toEqual(['a', 'b']);
});

test('clustering is transitive across an unmeasured pair', () => {
  // a~b and b~c were measured; a~c never was, but all three are one group.
  const assets = [asset({ id: 'a' }), asset({ id: 'b' }), asset({ id: 'c' })];
  const groups = clusterBySimilarity(assets, [
    ['a', 'b'],
    ['b', 'c'],
  ]);
  expect(groups).toHaveLength(1);
  expect(groups[0].assetIds.sort()).toEqual(['a', 'b', 'c']);
});

test('disjoint pairs stay in separate groups', () => {
  const assets = ['a', 'b', 'c', 'd'].map((id) => asset({ id }));
  const groups = clusterBySimilarity(assets, [
    ['a', 'b'],
    ['c', 'd'],
  ]);
  expect(groups).toHaveLength(2);
});

test('no pairs means no groups', () => {
  expect(clusterBySimilarity([asset({ id: 'a' }), asset({ id: 'b' })], [])).toHaveLength(0);
});

test('every group names a keeper that belongs to it', () => {
  const assets = [asset({ id: 'a', width: 500, height: 500 }), asset({ id: 'b' })];
  const groups = clusterBySimilarity(assets, [['a', 'b']]);
  expect(groups[0].assetIds).toContain(groups[0].keeperId);
  expect(groups[0].keeperId).toBe('b'); // higher resolution wins
});

test('a favourite is dropped rather than used as a bridge', () => {
  const assets = [
    asset({ id: 'a' }),
    asset({ id: 'fav', isFavorite: true }),
    asset({ id: 'c' }),
  ];
  const groups = clusterBySimilarity(assets, [
    ['a', 'fav'],
    ['fav', 'c'],
  ]);
  // 'a' and 'c' were never directly paired, so they must not be silently
  // merged through a favourite that we are not allowed to touch anyway.
  expect(groups).toHaveLength(0);
});

test('pairs referencing unknown ids are ignored', () => {
  const groups = clusterBySimilarity([asset({ id: 'a' })], [['a', 'ghost']]);
  expect(groups).toHaveLength(0);
});

test('group ids are stable regardless of pair ordering', () => {
  const assets = [asset({ id: 'a' }), asset({ id: 'b' }), asset({ id: 'c' })];
  const forward = clusterBySimilarity(assets, [
    ['a', 'b'],
    ['b', 'c'],
  ]);
  const reverse = clusterBySimilarity(assets, [
    ['c', 'b'],
    ['b', 'a'],
  ]);
  expect(forward[0].id).toBe(reverse[0].id);
});
