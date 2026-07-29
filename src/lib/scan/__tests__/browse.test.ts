import {
  chunkIntoRows,
  countFavourites,
  favouriteNote,
  formatDuration,
  sortBySizeDesc,
} from '@/lib/scan/browse';
import { asset } from '@/lib/scan/__tests__/fixtures';

describe('sortBySizeDesc', () => {
  it('puts the largest asset first', () => {
    const input = [
      asset({ id: 'small', sizeBytes: 1_000 }),
      asset({ id: 'huge', sizeBytes: 400_000_000 }),
      asset({ id: 'medium', sizeBytes: 5_000_000 }),
    ];
    expect(sortBySizeDesc(input).map((a) => a.id)).toEqual([
      'huge',
      'medium',
      'small',
    ]);
  });

  it('keeps equal sizes in their original order', () => {
    const input = [
      asset({ id: 'first', sizeBytes: 1_000 }),
      asset({ id: 'second', sizeBytes: 1_000 }),
      asset({ id: 'third', sizeBytes: 1_000 }),
    ];
    expect(sortBySizeDesc(input).map((a) => a.id)).toEqual([
      'first',
      'second',
      'third',
    ]);
  });

  it('does not mutate the input array', () => {
    const input = [
      asset({ id: 'small', sizeBytes: 1_000 }),
      asset({ id: 'big', sizeBytes: 9_000 }),
    ];
    sortBySizeDesc(input);
    expect(input.map((a) => a.id)).toEqual(['small', 'big']);
  });

  it('sorts zero-byte assets last rather than dropping them', () => {
    const input = [
      asset({ id: 'zero', sizeBytes: 0 }),
      asset({ id: 'one', sizeBytes: 1 }),
    ];
    expect(sortBySizeDesc(input).map((a) => a.id)).toEqual(['one', 'zero']);
  });
});

describe('chunkIntoRows', () => {
  it('splits into rows of the given width', () => {
    expect(chunkIntoRows([1, 2, 3, 4, 5, 6], 3)).toEqual([
      [1, 2, 3],
      [4, 5, 6],
    ]);
  });

  it('leaves the final row short rather than padding it', () => {
    expect(chunkIntoRows([1, 2, 3, 4], 3)).toEqual([[1, 2, 3], [4]]);
  });

  it('returns no rows for an empty list', () => {
    expect(chunkIntoRows([], 3)).toEqual([]);
  });
});

describe('countFavourites', () => {
  it('counts only selected favourites', () => {
    const assets = [
      asset({ id: 'a', isFavorite: true }),
      asset({ id: 'b', isFavorite: true }),
      asset({ id: 'c', isFavorite: false }),
    ];
    expect(countFavourites(assets, new Set(['a', 'c']))).toBe(1);
  });

  it('returns zero when nothing is selected', () => {
    const assets = [asset({ id: 'a', isFavorite: true })];
    expect(countFavourites(assets, new Set())).toBe(0);
  });

  it('counts every favourite when all are selected', () => {
    const assets = [
      asset({ id: 'a', isFavorite: true }),
      asset({ id: 'b', isFavorite: true }),
    ];
    expect(countFavourites(assets, new Set(['a', 'b']))).toBe(2);
  });
});

describe('favouriteNote', () => {
  it('returns undefined when nothing selected is a favourite', () => {
    expect(favouriteNote(0, 5)).toBeUndefined();
  });

  it('names a single favourite among several selected items', () => {
    expect(favouriteNote(1, 5)).toBe('1 of these items is a favourite.');
  });

  it('uses singular wording when exactly one item is selected', () => {
    expect(favouriteNote(1, 1)).toBe('This item is a favourite.');
  });

  it('names several favourites', () => {
    expect(favouriteNote(3, 5)).toBe('3 of these items are favourites.');
  });
});

describe('formatDuration', () => {
  it('formats under a minute with a leading zero minute', () => {
    expect(formatDuration(9)).toBe('0:09');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(125)).toBe('2:05');
  });

  it('formats past an hour without an hours field', () => {
    expect(formatDuration(3661)).toBe('61:01');
  });

  it('rounds fractional seconds down', () => {
    expect(formatDuration(9.8)).toBe('0:09');
  });

  it('treats zero and negatives as 0:00', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(-5)).toBe('0:00');
  });
});
