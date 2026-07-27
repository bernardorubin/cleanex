import { deletableIds, estimateFreed, formatBytes } from '@/lib/scan/estimate';
import type { AssetGroup } from '@/lib/scan/types';
import { asset } from './fixtures';

const group = (id: string, assetIds: string[], keeperId: string): AssetGroup => ({
  id,
  assetIds,
  keeperId,
});

test('the keeper is never deletable', () => {
  const ids = deletableIds([group('g1', ['a', 'b', 'c'], 'a')]);
  expect(ids.has('a')).toBe(false);
  expect(ids.has('b')).toBe(true);
  expect(ids.has('c')).toBe(true);
});

test('an asset appearing in two groups is only counted once', () => {
  const ids = deletableIds([group('g1', ['a', 'b'], 'a'), group('g2', ['b', 'c'], 'c')]);
  expect([...ids].sort()).toEqual(['b']);
});

test('a keeper in one group stays protected when another group drops it', () => {
  // 'b' keeps g1 alive but is surplus in g2. Deleting it would empty g1, so a
  // keeper anywhere must be protected everywhere.
  const ids = deletableIds([group('g1', ['b', 'x'], 'b'), group('g2', ['b', 'y'], 'y')]);
  expect(ids.has('b')).toBe(false);
  expect([...ids].sort()).toEqual(['x']);
});

test('estimateFreed sums the bytes of the selected assets', () => {
  const assets = [
    asset({ id: 'a', sizeBytes: 100 }),
    asset({ id: 'b', sizeBytes: 250 }),
    asset({ id: 'c', sizeBytes: 400 }),
  ];
  expect(estimateFreed(assets, new Set(['b', 'c']))).toBe(650);
});

test('estimateFreed never counts the same asset twice', () => {
  const assets = [asset({ id: 'a', sizeBytes: 100 }), asset({ id: 'a', sizeBytes: 100 })];
  expect(estimateFreed(assets, new Set(['a']))).toBe(100);
});

test('estimateFreed ignores ids that are not in the asset list', () => {
  expect(estimateFreed([asset({ id: 'a', sizeBytes: 100 })], new Set(['a', 'ghost']))).toBe(
    100,
  );
});

test('an empty selection frees nothing', () => {
  expect(estimateFreed([asset({ id: 'a', sizeBytes: 100 })], new Set())).toBe(0);
});

test('formatBytes uses plain units a non-technical reader expects', () => {
  expect(formatBytes(4_200_000_000)).toBe('4.2 GB');
  expect(formatBytes(780_000_000)).toBe('780 MB');
  expect(formatBytes(0)).toBe('0 bytes');
});
