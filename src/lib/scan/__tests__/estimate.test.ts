import { deletableIds, estimateFreed, formatBytes, freedMessage } from '@/lib/scan/estimate';
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

test('freedMessage reports what was removed and where it went', () => {
  expect(freedMessage(4_200_000_000)).toBe(
    'Done. 4.2 GB is now in Recently Deleted. Your phone gets that space back when Recently Deleted empties in 30 days — or sooner, if you empty it yourself in the Photos app.',
  );
});

test('freedMessage uses the same human units everywhere else does', () => {
  expect(freedMessage(780_000_000)).toContain('780 MB is now in Recently Deleted');
});

test('freedMessage never claims a measured free-space figure', () => {
  // Deleting moves assets to Recently Deleted, so free space does not move at
  // this moment. Any wording implying a measurement would be untrue, and the
  // old copy blamed iCloud for a shortfall that was really the 30-day wait.
  const message = freedMessage(3_000_000_000);
  expect(message).not.toContain('Freed');
  expect(message).not.toContain('iCloud');
});

test('freedMessage always states the 30-day wait and the way to skip it', () => {
  const message = freedMessage(1_000_000_000);
  expect(message).toContain('30 days');
  expect(message).toContain('empty it yourself in the Photos app');
});

test('freedMessage handles a zero total without changing shape', () => {
  expect(freedMessage(0)).toContain('0 bytes is now in Recently Deleted');
});
