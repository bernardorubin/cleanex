import { StyleSheet, Text, View } from 'react-native';

import { formatBytes } from '@/lib/scan/estimate';
import { radius, space, usePalette } from '@/lib/ui/theme';

const TICKS = 24;

type Props = {
  usedBytes: number;
  totalBytes: number;
};

/**
 * The capacity plate above the directory — a bevelled graphite plate with a
 * tick-marked gauge strip. A panel gauge reads in ticks, not as a ring.
 */
export function Nameplate({ usedBytes, totalBytes }: Props) {
  const palette = usePalette();

  const ratio = totalBytes > 0 ? Math.min(usedBytes / totalBytes, 1) : 0;
  const litTicks = Math.round(ratio * TICKS);
  const nearlyFull = ratio >= 0.9;
  const freeBytes = Math.max(totalBytes - usedBytes, 0);

  return (
    <View
      style={[styles.plate, { backgroundColor: palette.graphite }]}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`${formatBytes(usedBytes)} of ${formatBytes(
        totalBytes,
      )} used. ${formatBytes(freeBytes)} free.`}>
      {/* Lighter top edge reads as bevelled metal under room light. */}
      <View style={[styles.bevel, { backgroundColor: palette.onGraphite }]} />

      <Text
        style={[styles.reading, { color: palette.onGraphite }]}
        maxFontSizeMultiplier={2.2}>
        {formatBytes(usedBytes)}
        <Text style={[styles.of, { color: palette.onGraphite }]}>
          {'  of '}
          {formatBytes(totalBytes)}
        </Text>
      </Text>

      <View style={styles.gauge} accessibilityElementsHidden importantForAccessibility="no">
        {Array.from({ length: TICKS }, (_, i) => (
          <View
            key={i}
            style={[
              styles.tick,
              {
                backgroundColor:
                  i < litTicks
                    ? nearlyFull && i >= TICKS - 3
                      ? palette.caution
                      : palette.onGraphite
                    : 'transparent',
                borderColor: palette.onGraphite,
              },
            ]}
          />
        ))}
      </View>

      <Text style={[styles.free, { color: palette.onGraphite }]} maxFontSizeMultiplier={2}>
        {formatBytes(freeBytes)} free
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  plate: {
    borderRadius: radius.plate,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.md,
    overflow: 'hidden',
  },
  bevel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    opacity: 0.35,
  },
  reading: {
    fontSize: 28,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  of: {
    fontSize: 17,
    fontWeight: '400',
    opacity: 0.7,
  },
  gauge: {
    flexDirection: 'row',
    gap: 3,
    marginTop: space.md,
    marginBottom: space.sm,
  },
  tick: {
    flex: 1,
    height: 14,
    borderRadius: 1,
    borderWidth: StyleSheet.hairlineWidth,
    opacity: 0.85,
  },
  free: {
    fontSize: 13,
    opacity: 0.7,
  },
});
