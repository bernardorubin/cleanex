/**
 * The storage the app cannot reach: apps, their private containers, and the
 * system. Named honestly rather than attributed to any app — we cannot see a
 * per-app breakdown and must never imply we can.
 *
 * Returns null when the arithmetic cannot be trusted. With iCloud "Optimize
 * iPhone Storage" the summed asset sizes are full-size originals, which exceed
 * what the phone actually holds, so the subtraction goes negative. A wrong
 * number on the capacity plate costs more than the reading gains, so in that
 * case the caller shows nothing at all.
 */
export function otherStorageBytes(
  usedBytes: number,
  photoLibraryBytes: number,
): number | null {
  if (usedBytes <= 0 || photoLibraryBytes < 0) return null;
  if (photoLibraryBytes >= usedBytes) return null;
  return usedBytes - photoLibraryBytes;
}
