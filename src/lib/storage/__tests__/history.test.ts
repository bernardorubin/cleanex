import { fillRatePerWeek, freedTotal, type DiskSample } from '@/lib/storage/history';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const TWO_WEEKS_MS = 2 * WEEK_MS;

const sample = (sampledAt: number, freeBytes: number): DiskSample => ({
  sampledAt,
  freeBytes,
  totalBytes: 128_000_000_000,
});

// Five samples, one per week for four weeks, free space rising 2 GB/week —
// the user is steadily recovering space.
const risingTrend: DiskSample[] = [
  sample(0, 10_000_000_000),
  sample(1 * WEEK_MS, 12_000_000_000),
  sample(2 * WEEK_MS, 14_000_000_000),
  sample(3 * WEEK_MS, 16_000_000_000),
  sample(4 * WEEK_MS, 18_000_000_000),
];

// Same shape, free space falling 2 GB/week — the phone is filling up.
const fallingTrend: DiskSample[] = [
  sample(0, 20_000_000_000),
  sample(1 * WEEK_MS, 18_000_000_000),
  sample(2 * WEEK_MS, 16_000_000_000),
  sample(3 * WEEK_MS, 14_000_000_000),
  sample(4 * WEEK_MS, 12_000_000_000),
];

describe('freedTotal', () => {
  it('sums only the increases across a clean rising trend', () => {
    // Every step rises by 2 GB, so the sum of increases equals last minus first.
    expect(freedTotal(risingTrend)).toBe(8_000_000_000);
  });

  it('is zero across a clean falling trend, not negative', () => {
    // No step ever rises, so nothing was recovered — a real zero, not null.
    expect(freedTotal(fallingTrend)).toBe(0);
  });

  it('is trustworthy exactly at the two-week boundary', () => {
    const atBoundary: DiskSample[] = [
      sample(0, 10_000_000_000),
      sample(0.25 * TWO_WEEKS_MS, 11_000_000_000),
      sample(0.5 * TWO_WEEKS_MS, 12_000_000_000),
      sample(0.75 * TWO_WEEKS_MS, 13_000_000_000),
      sample(TWO_WEEKS_MS, 14_000_000_000),
    ];
    expect(freedTotal(atBoundary)).toBe(4_000_000_000);
  });

  it('suppresses the figure one millisecond short of two weeks', () => {
    const justUnder: DiskSample[] = [
      sample(0, 10_000_000_000),
      sample(0.25 * TWO_WEEKS_MS, 11_000_000_000),
      sample(0.5 * TWO_WEEKS_MS, 12_000_000_000),
      sample(0.75 * TWO_WEEKS_MS, 13_000_000_000),
      sample(TWO_WEEKS_MS - 1, 14_000_000_000),
    ];
    expect(freedTotal(justUnder)).toBeNull();
  });

  it('suppresses the figure with too few samples, however wide the span', () => {
    const tooFew: DiskSample[] = [
      sample(0, 10_000_000_000),
      sample(2 * WEEK_MS, 14_000_000_000),
      sample(4 * WEEK_MS, 18_000_000_000),
    ];
    expect(freedTotal(tooFew)).toBeNull();
  });

  it('suppresses the figure when the series is too noisy to trust', () => {
    // Big swings each week that mostly cancel out: net change of 0.5 GB
    // against 23.5 GB of total back-and-forth movement.
    const noisy: DiskSample[] = [
      sample(0, 10_000_000_000),
      sample(1 * WEEK_MS, 15_000_000_000),
      sample(2 * WEEK_MS, 9_000_000_000),
      sample(3 * WEEK_MS, 16_000_000_000),
      sample(4 * WEEK_MS, 10_500_000_000),
    ];
    expect(freedTotal(noisy)).toBeNull();
  });

  it('suppresses the figure for an empty history', () => {
    expect(freedTotal([])).toBeNull();
  });

  it('suppresses the figure for a single sample', () => {
    expect(freedTotal([sample(0, 10_000_000_000)])).toBeNull();
  });

  it('sorts out-of-order samples before computing', () => {
    const shuffled = [risingTrend[3], risingTrend[0], risingTrend[4], risingTrend[1], risingTrend[2]];
    expect(freedTotal(shuffled)).toBe(freedTotal(risingTrend));
  });
});

describe('fillRatePerWeek', () => {
  it('is positive for a clean falling trend (the phone is filling)', () => {
    expect(fillRatePerWeek(fallingTrend)).toBe(2_000_000_000);
  });

  it('is negative for a clean rising trend — the user is net ahead', () => {
    expect(fillRatePerWeek(risingTrend)).toBe(-2_000_000_000);
  });

  it('is trustworthy exactly at the two-week boundary', () => {
    const atBoundary: DiskSample[] = [
      sample(0, 10_000_000_000),
      sample(0.25 * TWO_WEEKS_MS, 11_000_000_000),
      sample(0.5 * TWO_WEEKS_MS, 12_000_000_000),
      sample(0.75 * TWO_WEEKS_MS, 13_000_000_000),
      sample(TWO_WEEKS_MS, 14_000_000_000),
    ];
    expect(fillRatePerWeek(atBoundary)).toBe(-2_000_000_000);
  });

  it('suppresses the rate one millisecond short of two weeks', () => {
    const justUnder: DiskSample[] = [
      sample(0, 10_000_000_000),
      sample(0.25 * TWO_WEEKS_MS, 11_000_000_000),
      sample(0.5 * TWO_WEEKS_MS, 12_000_000_000),
      sample(0.75 * TWO_WEEKS_MS, 13_000_000_000),
      sample(TWO_WEEKS_MS - 1, 14_000_000_000),
    ];
    expect(fillRatePerWeek(justUnder)).toBeNull();
  });

  it('suppresses the rate with too few samples, however wide the span', () => {
    const tooFew: DiskSample[] = [
      sample(0, 10_000_000_000),
      sample(2 * WEEK_MS, 14_000_000_000),
      sample(4 * WEEK_MS, 18_000_000_000),
    ];
    expect(fillRatePerWeek(tooFew)).toBeNull();
  });

  it('suppresses the rate when the series is too noisy to trust', () => {
    const noisy: DiskSample[] = [
      sample(0, 10_000_000_000),
      sample(1 * WEEK_MS, 15_000_000_000),
      sample(2 * WEEK_MS, 9_000_000_000),
      sample(3 * WEEK_MS, 16_000_000_000),
      sample(4 * WEEK_MS, 10_500_000_000),
    ];
    expect(fillRatePerWeek(noisy)).toBeNull();
  });

  it('suppresses the rate for an empty history', () => {
    expect(fillRatePerWeek([])).toBeNull();
  });

  it('suppresses the rate for a single sample', () => {
    expect(fillRatePerWeek([sample(0, 10_000_000_000)])).toBeNull();
  });

  it('sorts out-of-order samples before computing', () => {
    const shuffled = [risingTrend[3], risingTrend[0], risingTrend[4], risingTrend[1], risingTrend[2]];
    expect(fillRatePerWeek(shuffled)).toBe(fillRatePerWeek(risingTrend));
  });
});
