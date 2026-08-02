import {
  BIN_STEPS,
  BIN_STEPS_TITLE,
  COMPRESSION_FAILED_MESSAGE,
  COMPRESSION_SECTION_TITLE,
  LIVE_PHOTO_CONVERSION_FAILED_MESSAGE,
  LIVE_PHOTO_EXPLANATION,
  LIVE_PHOTO_SECTION_TITLE,
  NOTHING_IN_BIN_MESSAGE,
  NO_LIVE_PHOTOS_TO_CONVERT_MESSAGE,
  NO_VIDEOS_TO_COMPRESS_MESSAGE,
  QUALITY_DESCRIPTIONS,
  QUALITY_LABELS,
  STOP_TRANSFORM_LABEL,
  TRANSFORMS_LEAD,
  TRANSFORM_DELAY_SENTENCE,
  TRANSFORM_IRREVERSIBLE_SENTENCE,
  TRANSFORM_STOPPED_MESSAGE,
  binEmptiedMessage,
  binWaitingMessage,
  compressionButtonLabel,
  compressionConfirmBody,
  compressionConfirmTitle,
  compressionEstimateMessage,
  compressionProgressMessage,
  compressionResultMessage,
  livePhotoButtonLabel,
  livePhotoConfirmBody,
  livePhotoConfirmTitle,
  livePhotoEstimateMessage,
  livePhotoProgressMessage,
  livePhotoResultMessage,
  transformsLinkLabel,
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

describe('BIN_STEPS_TITLE', () => {
  it('names the outcome rather than the chore', () => {
    expect(BIN_STEPS_TITLE).toBe('Get the space now');
  });
});

describe('transformsLinkLabel', () => {
  it('names both piles, plural', () => {
    expect(transformsLinkLabel(12, 4210)).toBe(
      'Make things smaller · 12 big videos, 4,210 Live Photos',
    );
  });

  it('names both piles, singular', () => {
    expect(transformsLinkLabel(1, 1)).toBe(
      'Make things smaller · 1 big video, 1 Live Photo',
    );
  });

  it('drops a pile that is empty rather than printing a zero', () => {
    expect(transformsLinkLabel(0, 4210)).toBe(
      'Make things smaller · 4,210 Live Photos',
    );
    expect(transformsLinkLabel(12, 0)).toBe('Make things smaller · 12 big videos');
  });

  it('falls back to the bare label when there is nothing to count', () => {
    expect(transformsLinkLabel(0, 0)).toBe('Make things smaller');
  });
});

describe('TRANSFORMS_LEAD', () => {
  it('frames shrinking as the alternative to deleting', () => {
    expect(TRANSFORMS_LEAD).toBe(
      'Not everything big is worth deleting. These two make things smaller ' +
        'instead, and you keep the photo or video itself.',
    );
  });
});

describe('section titles', () => {
  it('names each pile in plain words', () => {
    expect(COMPRESSION_SECTION_TITLE).toBe('Big videos');
    expect(LIVE_PHOTO_SECTION_TITLE).toBe('Live Photos');
  });
});

describe('QUALITY_LABELS', () => {
  it('labels every quality by outcome, never by resolution', () => {
    expect(QUALITY_LABELS).toEqual({
      sharp: 'Keep it sharp',
      phone: 'Good for the phone',
      smallest: 'Smallest',
    });
  });

  it('mentions no resolution, pixel count or codec anywhere', () => {
    const words = [
      ...Object.values(QUALITY_LABELS),
      ...Object.values(QUALITY_DESCRIPTIONS),
    ].join(' ');
    expect(words).not.toMatch(/1080|720|540|\bp\b|pixel|resolution|codec|bitrate|HEVC|H\.?264/i);
  });
});

describe('QUALITY_DESCRIPTIONS', () => {
  it('describes each choice by what the result looks like', () => {
    expect(QUALITY_DESCRIPTIONS.sharp).toBe(
      'Still looks its best on a big television. Saves the least room.',
    );
    expect(QUALITY_DESCRIPTIONS.phone).toBe(
      'Looks the same on your phone. Saves a lot of room.',
    );
    expect(QUALITY_DESCRIPTIONS.smallest).toBe(
      'Fine to watch on your phone. Saves the most room.',
    );
  });
});

describe('compressionButtonLabel', () => {
  it('names the action and the count, singular and plural', () => {
    expect(compressionButtonLabel(1)).toBe('Shrink 1 video');
    expect(compressionButtonLabel(12)).toBe('Shrink 12 videos');
    expect(compressionButtonLabel(1200)).toBe('Shrink 1,200 videos');
  });
});

describe('livePhotoButtonLabel', () => {
  it('names the action and the count, singular and plural', () => {
    expect(livePhotoButtonLabel(1)).toBe('Convert 1 Live Photo');
    expect(livePhotoButtonLabel(4210)).toBe('Convert 4,210 Live Photos');
  });
});

describe('compressionConfirmTitle', () => {
  it('asks back exactly what the button offered', () => {
    expect(compressionConfirmTitle(12)).toBe('Shrink 12 videos?');
  });
});

describe('compressionConfirmBody', () => {
  it('names what is irreversible, as safety rule 6 requires', () => {
    expect(compressionConfirmBody(12, 3_100_000_000)).toContain(
      TRANSFORM_IRREVERSIBLE_SENTENCE,
    );
  });

  it('warns that the phone gets fuller before it gets emptier', () => {
    expect(compressionConfirmBody(12, 3_100_000_000)).toContain(
      TRANSFORM_DELAY_SENTENCE,
    );
  });

  it('opens with the estimate, labelled as one', () => {
    expect(compressionConfirmBody(12, 3_100_000_000)).toBe(
      [
        '12 videos, about 3.1 GB smaller, in total.',
        TRANSFORM_IRREVERSIBLE_SENTENCE,
        TRANSFORM_DELAY_SENTENCE,
      ].join('\n\n'),
    );
  });
});

describe('livePhotoConfirmTitle', () => {
  it('asks back exactly what the button offered', () => {
    expect(livePhotoConfirmTitle(4210)).toBe('Convert 4,210 Live Photos?');
  });
});

describe('livePhotoConfirmBody', () => {
  it('names what is irreversible and when the space arrives', () => {
    const body = livePhotoConfirmBody(4210, 9_000_000_000);
    expect(body).toContain(TRANSFORM_IRREVERSIBLE_SENTENCE);
    expect(body).toContain(TRANSFORM_DELAY_SENTENCE);
    expect(body).toContain(LIVE_PHOTO_EXPLANATION);
  });
});

describe('compressionProgressMessage', () => {
  it('says which video is being worked on, of how many', () => {
    expect(compressionProgressMessage(3, 12)).toBe('Shrinking video 3 of 12…');
  });

  it('drops the counting when there is only one', () => {
    expect(compressionProgressMessage(1, 1)).toBe('Shrinking your video…');
  });

  it('never quotes a percentage — nothing native reports one', () => {
    expect(compressionProgressMessage(3, 12)).not.toMatch(/%|percent/i);
  });
});

describe('livePhotoProgressMessage', () => {
  it('says how many are done, of how many', () => {
    expect(livePhotoProgressMessage(300, 4210)).toBe(
      'Converting your Live Photos. 300 of 4,210 done…',
    );
  });

  it('drops the counting when there is only one', () => {
    expect(livePhotoProgressMessage(0, 1)).toBe('Converting your Live Photo…');
  });

  it('never quotes a percentage — nothing native reports one', () => {
    expect(livePhotoProgressMessage(300, 4210)).not.toMatch(/%|percent/i);
  });
});

describe('STOP_TRANSFORM_LABEL', () => {
  it('names the action in one plain word', () => {
    expect(STOP_TRANSFORM_LABEL).toBe('Stop');
  });
});

describe('TRANSFORM_STOPPED_MESSAGE', () => {
  it('says plainly that nothing changed', () => {
    expect(TRANSFORM_STOPPED_MESSAGE).toBe(
      'Stopped. Nothing on your phone was changed.',
    );
  });
});

describe('the failure lines', () => {
  it('reassure that nothing was lost, without alarm', () => {
    expect(COMPRESSION_FAILED_MESSAGE).toBe(
      'Those videos could not be shrunk, so nothing on your phone was ' +
        'changed. They are exactly as they were.',
    );
    expect(LIVE_PHOTO_CONVERSION_FAILED_MESSAGE).toBe(
      'Those Live Photos could not be converted, so nothing on your phone ' +
        'was changed. They are exactly as they were.',
    );
    for (const message of [
      COMPRESSION_FAILED_MESSAGE,
      LIVE_PHOTO_CONVERSION_FAILED_MESSAGE,
    ]) {
      expect(message).not.toMatch(/error|failed|warning|sorry|!/i);
    }
  });
});
