import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { MainBreaker } from '@/components/main-breaker';
import {
  PERMISSION_DENIED_LEAD,
  PERMISSION_DENIED_STEPS,
  SCAN_FAILED_MESSAGE,
  scanProgressMessage,
} from '@/lib/scan/messages';
import type { ScanPhase } from '@/lib/scan/use-scan';
import { space, usePalette } from '@/lib/ui/theme';

type Props = {
  phase: ScanPhase;
  assetCount: number;
  onRetry: () => void;
};

/**
 * What a screen shows in place of scan data it cannot trust.
 *
 * Only 'refining' and 'ready' carry a `result` produced by the run currently
 * reflected in `disk`. During 'scanning' the result still describes the library
 * as it was before a delete, and during 'failed' it may too — either way,
 * rendering it puts already-deleted photos back on screen with a live delete
 * button that silently does nothing when pressed.
 *
 * Showing progress rather than nothing is the point: the audience abandons
 * anything that looks like work, and a frightened user must never be left with
 * nothing to press, so the failed branch always carries a retry.
 */
export function ScanInterlude({ phase, assetCount, onRetry }: Props) {
  const palette = usePalette();

  if (phase === 'denied') {
    // A spinner here would be a lie: nothing is being looked through, and no
    // amount of waiting changes that.
    return (
      <View style={styles.block}>
        <Text
          style={[styles.text, { color: palette.ink }]}
          maxFontSizeMultiplier={1.8}>
          {PERMISSION_DENIED_LEAD}
        </Text>
        <Text
          style={[styles.text, { color: palette.inkSecondary }]}
          maxFontSizeMultiplier={1.8}>
          {PERMISSION_DENIED_STEPS}
        </Text>
      </View>
    );
  }

  if (phase === 'failed') {
    return (
      <View style={styles.block}>
        <Text
          style={[styles.text, { color: palette.ink }]}
          maxFontSizeMultiplier={1.8}>
          {SCAN_FAILED_MESSAGE}
        </Text>
        <MainBreaker label="Try again" onPress={onRetry} />
      </View>
    );
  }

  return (
    <View style={styles.block}>
      <View style={styles.progress}>
        <ActivityIndicator color={palette.amber} />
        <Text
          style={[styles.text, { color: palette.inkSecondary }]}
          maxFontSizeMultiplier={1.8}>
          {scanProgressMessage(assetCount)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.lg, paddingVertical: space.xl },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  text: { fontSize: 16, lineHeight: 23, flexShrink: 1 },
});
