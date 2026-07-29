import { useCallback, useEffect, useRef, useState } from 'react';
import { Paths } from 'expo-file-system';
import { getPhotoPermission, requestPhotoPermission } from '@modules/photo-scan';
import type { PhotoPermission } from '@modules/photo-scan';

import { runScan } from '@/lib/scan/scanner';
import type { ScanResult } from '@/lib/scan/types';

export type ScanPhase = 'idle' | 'scanning' | 'refining' | 'ready' | 'denied' | 'failed';

export type Disk = { usedBytes: number; totalBytes: number };

export type ScanState = {
  permission: PhotoPermission;
  phase: ScanPhase;
  result: ScanResult | null;
  assetCount: number;
  disk: Disk;
  request: () => Promise<void>;
  rescan: () => Promise<void>;
};

function readDisk(): Disk {
  const total = Paths.totalDiskSpace ?? 0;
  const free = Paths.availableDiskSpace ?? 0;
  return { usedBytes: Math.max(total - free, 0), totalBytes: total };
}

/**
 * Owns the scan lifecycle for the whole app.
 *
 * Renders twice on purpose: the fast metadata pass lands a real headline number
 * in seconds, then the Vision pass refines it upward. A single await would make
 * the user watch a blank bar for the whole scan.
 */
export function useScan(): ScanState {
  const [permission, setPermission] = useState<PhotoPermission>(() =>
    getPhotoPermission(),
  );
  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [assetCount, setAssetCount] = useState(0);
  const [disk, setDisk] = useState<Disk>(readDisk);

  // Identity for the run currently allowed to write state. Runs cannot be
  // cancelled — runScan is a chain of awaits across the bridge — so a
  // superseded run keeps going to completion in the background. Everything it
  // reports after being superseded is stale by definition, including its
  // failure: two runs sharing one SQLite connection make the second BEGIN
  // throw, and without this the loser's catch stamped 'failed' over the
  // winner's perfectly good 'ready' and blanked every screen that gates on it.
  const runId = useRef(0);

  const scan = useCallback(async () => {
    const id = (runId.current += 1);
    const isCurrent = () => runId.current === id;

    setPhase('scanning');
    // Tracks whether this run has actually landed a fresh `result` yet. Only
    // 'categorized' and 'similarity' progress carry one — 'inventory' does
    // not. If runScan throws before either fires (e.g. inventory() itself
    // fails mid-rescan), `result` is untouched and still describes whatever
    // was on screen before this call, which may predate a delete that just
    // changed `disk`.
    let landedFreshResult = false;
    try {
      await runScan((progress) => {
        if (!isCurrent()) return;
        if (progress.phase === 'inventory') {
          setAssetCount(progress.assetCount);
          return;
        }
        landedFreshResult = true;
        setResult(progress.result);
        setPhase(progress.phase === 'categorized' ? 'refining' : 'ready');
      });
    } catch {
      // A run that never landed a fresh result must not settle on 'ready' —
      // `result` would still describe an earlier moment (e.g. before a
      // delete) while `disk` below is already current. 'failed' is a real,
      // renderable state (see the Clean tab's retry block), not just a gate:
      // 'scanning' forever would leave the user staring at a spinner with
      // nothing to press. A run that DID land a fresh result before dying
      // later (e.g. the similarity pass fails) keeps whatever phase the
      // progress callback already set — that result is current, just less
      // refined, so there is nothing to fail.
      if (!landedFreshResult && isCurrent()) setPhase('failed');
    } finally {
      if (isCurrent()) {
        setDisk(readDisk());
        if (landedFreshResult) setPhase('ready');
      }
    }
  }, []);

  const request = useCallback(async () => {
    // Only sets permission. The effect below keys on it and starts the scan
    // itself; starting one here too ran two full-library scans concurrently on
    // the most latency-sensitive tap in the product.
    const granted = await requestPhotoPermission();
    setPermission(granted);
  }, []);

  const rescan = useCallback(async () => {
    setDisk(readDisk());
    await scan();
  }, [scan]);

  useEffect(() => {
    if (permission === 'granted' || permission === 'limited') void scan();
    else if (permission === 'denied') setPhase('denied');
  }, [permission, scan]);

  return { permission, phase, result, assetCount, disk, request, rescan };
}
