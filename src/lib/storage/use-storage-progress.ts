import { useEffect, useState } from 'react';
import { Paths } from 'expo-file-system';

import { loadDiskSamplesSince, openCache, recordDiskSample } from '@/lib/scan/cache';
import { fillRatePerWeek, freedTotal } from '@/lib/storage/history';
import { storageProgressLine } from '@/lib/storage/messages';

/**
 * How far back the history is read. Long enough that a fortnight's absence
 * does not throw the series away, short enough that last spring has no vote
 * in what the phone is doing this month.
 */
const HISTORY_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * Records one disk sample per launch and turns the accumulated history into
 * the single line the Clean tab prints — or null, which is what a new phone
 * gets for its first two weeks.
 *
 * Null is the normal state, not an error state: `freedTotal` and
 * `fillRatePerWeek` both refuse to answer until the samples can support a
 * claim, and a caller that renders nothing at all in that case is the
 * behaviour the nameplate already models with its unreachable-storage figure.
 * Nothing on screen must hint that a figure is missing.
 *
 * The sample is written before the history is read, so today's reading counts
 * towards today's line rather than arriving a launch late.
 */
export function useStorageProgress(): string | null {
  const [line, setLine] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const db = await openCache();
        // This runs while the scan is writing its inventory over the same
        // file. SQLite's default is to fail a blocked write instantly, which
        // would silently drop the sample on exactly the launches that matter
        // — the ones where there is a lot to scan. Waiting is free here:
        // nothing is on screen until the line resolves anyway.
        await db.execAsync('PRAGMA busy_timeout = 5000');

        const sampledAt = Date.now();
        await recordDiskSample(db, {
          sampledAt,
          freeBytes: Paths.availableDiskSpace ?? 0,
          totalBytes: Paths.totalDiskSpace ?? 0,
        });

        const samples = await loadDiskSamplesSince(db, sampledAt - HISTORY_WINDOW_MS);
        if (!active) return;
        setLine(storageProgressLine(freedTotal(samples), fillRatePerWeek(samples)));
      } catch {
        // A history that cannot be read is a history with nothing to say. The
        // line stays null and the Clean tab renders nothing, which is exactly
        // what it renders for a phone that is simply too new to have one.
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return line;
}
