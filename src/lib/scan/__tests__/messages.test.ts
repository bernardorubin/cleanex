import {
  SCAN_FAILED_MESSAGE,
  browseLinkLabel,
  guideFreedMessage,
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
