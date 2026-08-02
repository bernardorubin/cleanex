import {
  GAINING_SPACE_MESSAGE,
  fillRateMessage,
  freedTotalMessage,
  storageProgressLine,
} from '@/lib/storage/messages';

describe('freedTotalMessage', () => {
  it('time-scopes the claim rather than crediting the app for the space', () => {
    expect(freedTotalMessage(6_200_000_000)).toBe(
      'You have got 6.2 GB back since you started using CleanEx.',
    );
  });

  it('never claims the app itself freed the space', () => {
    expect(freedTotalMessage(6_200_000_000)).not.toMatch(/with CleanEx|CleanEx freed/);
  });
});

describe('fillRateMessage', () => {
  it('labels the rate as an estimate', () => {
    expect(fillRateMessage(300_000_000)).toBe(
      'Your phone is filling up by about 300 MB a week.',
    );
    expect(fillRateMessage(300_000_000)).toContain('about');
  });
});

describe('GAINING_SPACE_MESSAGE', () => {
  it('says the exact sentence for a phone that is emptying', () => {
    expect(GAINING_SPACE_MESSAGE).toBe(
      'Your phone has been getting emptier, not fuller.',
    );
  });
});

describe('storageProgressLine', () => {
  it('renders nothing at all when neither figure is trustworthy', () => {
    expect(storageProgressLine(null, null)).toBeNull();
  });

  it('joins both halves into one line', () => {
    expect(storageProgressLine(6_200_000_000, 300_000_000)).toBe(
      'You have got 6.2 GB back since you started using CleanEx. ' +
        'Your phone is filling up by about 300 MB a week.',
    );
  });

  it('says only the total when the rate is not trustworthy', () => {
    expect(storageProgressLine(6_200_000_000, null)).toBe(
      'You have got 6.2 GB back since you started using CleanEx.',
    );
  });

  it('says only the rate when the total is not trustworthy', () => {
    expect(storageProgressLine(null, 300_000_000)).toBe(
      'Your phone is filling up by about 300 MB a week.',
    );
  });

  it('drops a total too small to be worth a sentence', () => {
    expect(storageProgressLine(50_000_000, null)).toBeNull();
  });

  it('drops a rate too small in either direction — the phone is holding steady', () => {
    expect(storageProgressLine(null, 50_000_000)).toBeNull();
    expect(storageProgressLine(null, -50_000_000)).toBeNull();
  });

  it('reads a real zero as nothing to say, not as a claim of zero', () => {
    expect(storageProgressLine(0, null)).toBeNull();
  });

  it('says the phone is emptying instead of printing a negative rate', () => {
    const line = storageProgressLine(null, -2_000_000_000);
    expect(line).toBe(GAINING_SPACE_MESSAGE);
    expect(line).not.toMatch(/-/);
  });

  it('never draws a chart or quotes a percentage', () => {
    const line = storageProgressLine(6_200_000_000, 300_000_000) ?? '';
    expect(line).not.toMatch(/%/);
  });
});
