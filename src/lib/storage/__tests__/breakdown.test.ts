import { otherStorageBytes } from '@/lib/storage/breakdown';

describe('otherStorageBytes', () => {
  it('returns used minus the photo library', () => {
    expect(otherStorageBytes(100_000_000_000, 12_000_000_000)).toBe(
      88_000_000_000,
    );
  });

  it('suppresses the figure when photos exceed used space', () => {
    // iCloud "Optimize iPhone Storage": summed asset bytes are the full-size
    // originals, which are larger than what the phone actually holds.
    expect(otherStorageBytes(20_000_000_000, 60_000_000_000)).toBeNull();
  });

  it('suppresses the figure when the two are equal', () => {
    expect(otherStorageBytes(50_000_000_000, 50_000_000_000)).toBeNull();
  });

  it('suppresses the figure when used space is zero or unknown', () => {
    expect(otherStorageBytes(0, 0)).toBeNull();
  });

  it('suppresses the figure for negative inputs', () => {
    expect(otherStorageBytes(-1, 10)).toBeNull();
    expect(otherStorageBytes(100, -1)).toBeNull();
  });

  it('returns a positive figure when the library is empty', () => {
    expect(otherStorageBytes(80_000_000_000, 0)).toBe(80_000_000_000);
  });
});
