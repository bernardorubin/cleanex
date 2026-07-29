import { useCallback, useEffect, useState } from 'react';
import { Paths } from 'expo-file-system';
import { getPhotoPermission, requestPhotoPermission } from '@modules/photo-scan';
import type { PhotoPermission } from '@modules/photo-scan';

import { runScan } from '@/lib/scan/scanner';
import type { ScanResult } from '@/lib/scan/types';

export type ScanPhase = 'idle' | 'scanning' | 'refining' | 'ready' | 'denied';

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

  const scan = useCallback(async () => {
    setPhase('scanning');
    // Tracks whether this run has actually landed a fresh `result` yet. Only
    // 'categorized' and 'similarity' progress carry one — 'inventory' does
    // not. If runScan throws before either fires (e.g. inventory() itself
    // fails mid-rescan), `result` is untouched and still describes whatever
    // was on screen before this call, which may predate a delete that just
    // changed `disk`. Forcing 'ready' in that case would tell the call site
    // it is safe to read `result` against the just-refreshed `disk`, and it
    // is not — so phase must stay 'scanning' instead, which is exactly the
    // gate the call site already uses to hide the figure.
    let landedFreshResult = false;
    try {
      await runScan((progress) => {
        if (progress.phase === 'inventory') {
          setAssetCount(progress.assetCount);
          return;
        }
        landedFreshResult = true;
        setResult(progress.result);
        setPhase(progress.phase === 'categorized' ? 'refining' : 'ready');
      });
    } finally {
      setDisk(readDisk());
      if (landedFreshResult) setPhase('ready');
    }
  }, []);

  const request = useCallback(async () => {
    const granted = await requestPhotoPermission();
    setPermission(granted);
    if (granted === 'granted' || granted === 'limited') await scan();
    else setPhase('denied');
  }, [scan]);

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
