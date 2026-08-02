import {
  NOTHING_FOUND_ACTION,
  NOTHING_FOUND_BODY,
  SCAN_FAILED_MESSAGE,
  SPACE_ELSEWHERE_LINK_LABEL,
  browseLinkLabel,
  guideFreedMessage,
  nothingFoundLead,
  scanProgressMessage,
} from '@/lib/scan/messages';

test('the failed-scan message cannot contradict a delete receipt beside it', () => {
  // The receipt and this notice render as siblings on the Clean tab and
  // /browse, so "nothing was changed" would deny a delete that did happen.
  expect(SCAN_FAILED_MESSAGE).not.toContain('Nothing was changed');
  expect(SCAN_FAILED_MESSAGE).toContain('anything you deleted is still deleted');
});

test('the failed-scan message says what failed without blaming the user', () => {
  expect(SCAN_FAILED_MESSAGE).toContain('could not finish looking through your photos');
  expect(SCAN_FAILED_MESSAGE).not.toMatch(/error|failed|invalid/i);
});

test('scan progress names a real count once phase 1 has one', () => {
  expect(scanProgressMessage(12_481)).toBe(
    'Looking through 12,481 photos and videos…',
  );
});

test('scan progress invents no number before the count arrives', () => {
  expect(scanProgressMessage(0)).toBe('Opening your photos…');
});

test('the browse link shows the library size when it fits inside used space', () => {
  expect(browseLinkLabel(12_481, 22_000_000_000, 34_000_000_000)).toBe(
    'Everything on your phone · 12,481 items · 22.0 GB',
  );
});

test('the browse link drops the size the nameplate would suppress', () => {
  // iCloud-optimized: summed originals exceed what the phone holds, so this
  // figure would print an 84 GB reading beside "34 GB of 64 GB used".
  expect(browseLinkLabel(12_481, 84_000_000_000, 34_000_000_000)).toBe(
    'Everything on your phone · 12,481 items',
  );
});

test('the browse link keeps the count when the size is suppressed', () => {
  expect(browseLinkLabel(12_481, 84_000_000_000, 34_000_000_000)).toContain(
    '12,481 items',
  );
});

test('the browse link counts a single item in the singular', () => {
  expect(browseLinkLabel(1, 1_000_000, 34_000_000_000)).toBe(
    'Everything on your phone · 1 item · 1 MB',
  );
});

test('the guide reports its measured recovery in human units', () => {
  expect(guideFreedMessage(4_200_000_000)).toBe('You freed 4.2 GB.');
});

test('a thin scan never declares victory', () => {
  // "Nothing to clean up." was the app's answer to a phone so full of
  // WhatsApp media that it could not take a photo. It is the one sentence
  // this copy exists to replace.
  const all = [nothingFoundLead(12_481), nothingFoundLead(0), NOTHING_FOUND_BODY];
  for (const message of all) {
    expect(message).not.toMatch(/nothing to clean|all clear|well done|congratulations/i);
  }
});

test('the thin-scan lead says what was looked through, without alarm', () => {
  expect(nothingFoundLead(12_481)).toBe(
    'We looked through 12,481 photos and videos and did not find much ' +
      'worth deleting.',
  );
  expect(nothingFoundLead(12_481)).not.toMatch(/error|failed|sorry|!/i);
});

test('the thin-scan lead invents no count for an empty library', () => {
  expect(nothingFoundLead(0)).toBe(
    'There are no photos or videos on your phone for CleanEx to look through.',
  );
  expect(nothingFoundLead(0)).not.toContain('0 photos');
});

test('the thin-scan body points at the other apps without implying we can reach them', () => {
  expect(NOTHING_FOUND_BODY).toContain('WhatsApp');
  expect(NOTHING_FOUND_BODY).toContain('CleanEx cannot clear it for you');
  // Never a promise to look inside another app: the sandbox forbids it, and
  // implying otherwise is the failure the Guides tab exists to prevent.
  expect(NOTHING_FOUND_BODY).not.toMatch(/we can (clear|delete|reach|open)/i);
  expect(NOTHING_FOUND_BODY).not.toMatch(/let us|we will (clear|delete|free)/i);
});

test('the thin-scan body leaves one plain thing to press', () => {
  expect(NOTHING_FOUND_BODY).toContain('the guides show you exactly what to tap');
  expect(NOTHING_FOUND_ACTION).toBe('Show me the guides');
});

test('the quieter pointer assumes nothing about how full the phone is', () => {
  expect(SPACE_ELSEWHERE_LINK_LABEL).toBe('Where else your space might be');
  expect(SPACE_ELSEWHERE_LINK_LABEL).not.toMatch(/full|still|\?/i);
});
