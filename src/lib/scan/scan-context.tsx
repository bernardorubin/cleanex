import { createContext, useContext, type ReactNode } from 'react';

import { useScan, type ScanState } from '@/lib/scan/use-scan';

const ScanContext = createContext<ScanState | null>(null);

/**
 * One scan for the whole app.
 *
 * useScan holds state per caller and starts a scan when it mounts, so calling
 * it from each screen means a full re-scan on every navigation. Mounted once
 * here, every screen reads the same result and navigation is instant.
 */
export function ScanProvider({ children }: { children: ReactNode }) {
  const state = useScan();
  return <ScanContext.Provider value={state}>{children}</ScanContext.Provider>;
}

export function useScanState(): ScanState {
  const state = useContext(ScanContext);
  if (state === null) {
    throw new Error('useScanState must be used inside a ScanProvider');
  }
  return state;
}
