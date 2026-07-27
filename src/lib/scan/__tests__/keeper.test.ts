import { pickKeeper } from '@/lib/scan/keeper';
import { asset } from './fixtures';

const square = { width: 1000, height: 1000 };

test('prefers the highest resolution', () => {
  const low = asset({ id: 'low', ...square });
  const high = asset({ id: 'high', width: 2000, height: 2000 });
  expect(pickKeeper([low, high]).id).toBe('high');
});

test('falls back to the largest file when resolution ties', () => {
  const small = asset({ id: 'small', ...square, sizeBytes: 1_000_000 });
  const large = asset({ id: 'large', ...square, sizeBytes: 3_000_000 });
  expect(pickKeeper([small, large]).id).toBe('large');
});

test('falls back to the oldest when resolution and size tie', () => {
  const newer = asset({ id: 'newer', ...square, createdAt: 2_000_000_000_000 });
  const older = asset({ id: 'older', ...square, createdAt: 1_000_000_000_000 });
  expect(pickKeeper([newer, older]).id).toBe('older');
});

test('always prefers a favourite, whatever its resolution', () => {
  const big = asset({ id: 'big', width: 4000, height: 4000 });
  const fav = asset({ id: 'fav', width: 100, height: 100, isFavorite: true });
  expect(pickKeeper([big, fav]).id).toBe('fav');
});

test('a single-member group keeps that member', () => {
  expect(pickKeeper([asset({ id: 'only' })]).id).toBe('only');
});

test('throws on an empty group rather than returning undefined', () => {
  // Returning undefined here would let a caller delete every member.
  expect(() => pickKeeper([])).toThrow('pickKeeper requires at least one asset');
});

test('is deterministic regardless of input order', () => {
  const a = asset({ id: 'a', width: 2000, height: 2000 });
  const b = asset({ id: 'b', ...square });
  const c = asset({ id: 'c', width: 3000, height: 3000 });
  expect(pickKeeper([a, b, c]).id).toBe('c');
  expect(pickKeeper([c, b, a]).id).toBe('c');
  expect(pickKeeper([b, c, a]).id).toBe('c');
});
