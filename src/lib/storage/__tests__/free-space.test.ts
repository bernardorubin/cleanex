import { NOISE_FLOOR_BYTES, reportableGain } from '@/lib/storage/free-space';

describe('reportableGain', () => {
  it('reports a gain comfortably above the noise floor', () => {
    expect(reportableGain(10_000_000_000, 14_000_000_000)).toBe(4_000_000_000);
  });

  it('reports a gain exactly at the noise floor', () => {
    expect(reportableGain(0, NOISE_FLOOR_BYTES)).toBe(NOISE_FLOOR_BYTES);
  });

  it('says nothing one byte below the noise floor', () => {
    expect(reportableGain(0, NOISE_FLOOR_BYTES - 1)).toBeNull();
  });

  it('says nothing when free space did not move', () => {
    expect(reportableGain(10_000_000_000, 10_000_000_000)).toBeNull();
  });

  it('says nothing when the phone got fuller while the user was away', () => {
    expect(reportableGain(10_000_000_000, 9_000_000_000)).toBeNull();
  });
});
