import {
  BIN_STEPS,
  LIVE_PHOTO_EXPLANATION,
  NOTHING_IN_BIN_MESSAGE,
  NO_LIVE_PHOTOS_TO_CONVERT_MESSAGE,
  NO_VIDEOS_TO_COMPRESS_MESSAGE,
  TRANSFORM_DELAY_SENTENCE,
  TRANSFORM_IRREVERSIBLE_SENTENCE,
  binEmptiedMessage,
  binWaitingMessage,
  compressionEstimateMessage,
  compressionResultMessage,
  livePhotoEstimateMessage,
  livePhotoResultMessage,
} from '@/lib/transform/messages';

describe('TRANSFORM_IRREVERSIBLE_SENTENCE', () => {
  it('says the exact sentence reviewed for the confirmation screen', () => {
    expect(TRANSFORM_IRREVERSIBLE_SENTENCE).toBe(
      'This replaces the original, and once Recently Deleted empties in 30 days, there is no getting it back.',
    );
  });

  it('states the fact plainly, without a warning word or urgency', () => {
    expect(TRANSFORM_IRREVERSIBLE_SENTENCE).not.toMatch(
      /warning|danger|caution|irreversible|error|alert/i,
    );
    expect(TRANSFORM_IRREVERSIBLE_SENTENCE).not.toMatch(/!/);
  });
});

describe('TRANSFORM_DELAY_SENTENCE', () => {
  it('says the exact sentence reviewed for the confirmation screen', () => {
    expect(TRANSFORM_DELAY_SENTENCE).toBe(
      'Your phone gets a little fuller before it gets emptier — the original moves to Recently Deleted and sits there for 30 days, using space the whole time.',
    );
  });

  it('never claims the space is already free', () => {
    expect(TRANSFORM_DELAY_SENTENCE).not.toMatch(/\bfree(d)?\b/i);
  });
});

describe('compressionEstimateMessage', () => {
  it('labels a single video as an estimate, singular', () => {
    expect(compressionEstimateMessage(1, 340_000_000)).toBe(
      '1 video, about 340 MB smaller.',
    );
  });

  it('labels several videos as an estimate, plural, and totals the figure', () => {
    expect(compressionEstimateMessage(12, 3_100_000_000)).toBe(
      '12 videos, about 3.1 GB smaller, in total.',
    );
  });

  it('always includes the word "about" — this is a guess, not a measurement', () => {
    expect(compressionEstimateMessage(1, 340_000_000)).toContain('about');
    expect(compressionEstimateMessage(12, 3_100_000_000)).toContain('about');
  });
});

describe('NO_VIDEOS_TO_COMPRESS_MESSAGE', () => {
  it('has a plain nothing-to-do line for zero candidates', () => {
    expect(NO_VIDEOS_TO_COMPRESS_MESSAGE).toBe(
      'You have no big videos to shrink right now.',
    );
  });
});

describe('compressionResultMessage', () => {
  it('reports a measured result for a single video, singular grammar', () => {
    expect(compressionResultMessage(1, 1_100_000_000, 780_000_000)).toBe(
      'Done. 1 video is now 320 MB smaller. The original stays in Recently ' +
        'Deleted for 30 days before your phone gets that space back.',
    );
  });

  it('reports a measured result for several videos, plural grammar', () => {
    expect(compressionResultMessage(12, 5_000_000_000, 3_200_000_000)).toBe(
      'Done. 12 videos are now 1.8 GB smaller, in total. The originals ' +
        'stay in Recently Deleted for 30 days before your phone gets that ' +
        'space back.',
    );
  });

  it('never restates an estimate — no "about" in a measured result', () => {
    expect(compressionResultMessage(1, 1_100_000_000, 780_000_000)).not.toContain(
      'about',
    );
  });

  it('never claims the phone already has the space back', () => {
    const message = compressionResultMessage(1, 1_100_000_000, 780_000_000);
    expect(message).toMatch(/stays in Recently Deleted/);
    expect(message).not.toMatch(/your phone (now )?has/i);
  });

  it('reflects the real saving even when it is less than what was estimated', () => {
    const estimate = compressionEstimateMessage(1, 500_000_000);
    expect(estimate).toBe('1 video, about 500 MB smaller.');

    // The real transform saved less than the estimate promised.
    const result = compressionResultMessage(1, 1_000_000_000, 800_000_000);
    expect(result).toBe(
      'Done. 1 video is now 200 MB smaller. The original stays in ' +
        'Recently Deleted for 30 days before your phone gets that space back.',
    );
    expect(result).not.toContain('500 MB');
    expect(result).not.toContain('about');
  });
});

describe('LIVE_PHOTO_EXPLANATION', () => {
  it('explains what a Live Photo is in one plain clause', () => {
    expect(LIVE_PHOTO_EXPLANATION).toBe(
      'A Live Photo is a photo that also captures a couple of seconds of ' +
        'motion and sound around it.',
    );
  });
});

describe('livePhotoEstimateMessage', () => {
  it('labels a single Live Photo as an estimate, singular, with the explanation', () => {
    expect(livePhotoEstimateMessage(1, 210_000_000)).toBe(
      'A Live Photo is a photo that also captures a couple of seconds of ' +
        'motion and sound around it. 1 Live Photo, about 210 MB smaller.',
    );
  });

  it('labels several Live Photos as an estimate, plural, and totals the figure', () => {
    expect(livePhotoEstimateMessage(8, 900_000_000)).toBe(
      'A Live Photo is a photo that also captures a couple of seconds of ' +
        'motion and sound around it. 8 Live Photos, about 900 MB smaller, ' +
        'in total.',
    );
  });
});

describe('NO_LIVE_PHOTOS_TO_CONVERT_MESSAGE', () => {
  it('has a plain nothing-to-do line for zero candidates', () => {
    expect(NO_LIVE_PHOTOS_TO_CONVERT_MESSAGE).toBe(
      'You have no Live Photos to convert right now.',
    );
  });
});

describe('livePhotoResultMessage', () => {
  it('reports a measured result for a single Live Photo, singular grammar', () => {
    expect(livePhotoResultMessage(1, 260_000_000, 50_000_000)).toBe(
      'Done. 1 Live Photo is now a plain photo, 210 MB smaller. The ' +
        'original stays in Recently Deleted for 30 days before your phone ' +
        'gets that space back.',
    );
  });

  it('reports a measured result for several Live Photos, plural grammar', () => {
    expect(livePhotoResultMessage(8, 2_000_000_000, 1_220_000_000)).toBe(
      'Done. 8 Live Photos are now plain photos, 780 MB smaller, in ' +
        'total. The originals stay in Recently Deleted for 30 days before ' +
        'your phone gets that space back.',
    );
  });

  it('never restates an estimate — no "about" in a measured result', () => {
    expect(livePhotoResultMessage(1, 260_000_000, 50_000_000)).not.toContain(
      'about',
    );
  });
});

describe('binWaitingMessage', () => {
  it('says the exact explanation reviewed for the bin screen', () => {
    expect(binWaitingMessage(4_200_000_000)).toBe(
      '4.2 GB is waiting in Recently Deleted. Your phone will not feel ' +
        'any lighter until you clear it from there too.',
    );
  });

  it('never claims the space is already free', () => {
    expect(binWaitingMessage(4_200_000_000)).not.toMatch(/\bfree(d)?\b/i);
  });
});

describe('BIN_STEPS', () => {
  it('walks Photos → Albums → Recently Deleted → Select → Delete All', () => {
    expect(BIN_STEPS).toEqual([
      'Open Photos.',
      'Tap Albums, then Recently Deleted.',
      'Tap Select at the top right.',
      'Tap Delete All.',
    ]);
  });
});

describe('binEmptiedMessage', () => {
  it('reports the measured amount that actually came back', () => {
    expect(binEmptiedMessage(3_100_000_000)).toBe('You got back 3.1 GB.');
  });

  it('never restates an estimate — no "about" in a measured result', () => {
    expect(binEmptiedMessage(3_100_000_000)).not.toContain('about');
  });
});

describe('NOTHING_IN_BIN_MESSAGE', () => {
  it('has a plain nothing-to-do line for an empty Recently Deleted', () => {
    expect(NOTHING_IN_BIN_MESSAGE).toBe(
      'Recently Deleted is empty right now. There is nothing waiting to clear.',
    );
  });
});
