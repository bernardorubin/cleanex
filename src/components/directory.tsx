import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { formatBytes } from '@/lib/scan/estimate';
import { cardShadow, radius, space, stencil, usePalette } from '@/lib/ui/theme';
import { useReduceMotion } from '@/lib/ui/use-reduce-motion';

/** The breaker throw: fast, decisive, exponential ease-out. */
const THROW = { duration: 180, easing: Easing.out(Easing.exp) };

export type DirectoryEntry = {
  key: string;
  label: string;
  count: number;
  bytes: number;
  armed: boolean;
};

type Props = {
  entries: DirectoryEntry[];
  onToggle: (key: string) => void;
  /** Rendered above the rows, printed on the card like a directory heading. */
  title: string;
};

export function Directory({ entries, onToggle, title }: Props) {
  const palette = usePalette();

  return (
    <View style={[styles.card, { backgroundColor: palette.card }, cardShadow]}>
      <Text style={[styles.title, { color: palette.inkSecondary }]} maxFontSizeMultiplier={1.6}>
        {title}
      </Text>

      {entries.map((entry, index) => (
        <DirectoryRow
          key={entry.key}
          entry={entry}
          onToggle={onToggle}
          showRule={index > 0}
        />
      ))}
    </View>
  );
}

function DirectoryRow({
  entry,
  onToggle,
  showRule,
}: {
  entry: DirectoryEntry;
  onToggle: (key: string) => void;
  showRule: boolean;
}) {
  const palette = usePalette();
  const progress = useSharedValue(entry.armed ? 1 : 0);
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    const target = entry.armed ? 1 : 0;
    progress.value = reduceMotion ? target : withTiming(target, THROW);
  }, [entry.armed, progress, reduceMotion]);

  // The flag slides across its window like a breaker's ON indicator.
  const flagStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * 18 }],
  }));

  const windowStyle = useAnimatedStyle(() => ({
    backgroundColor: progress.value > 0.5 ? palette.amber : 'transparent',
    borderColor: progress.value > 0.5 ? palette.amber : palette.rule,
  }));

  return (
    <>
      {showRule ? (
        <View style={[styles.rule, { backgroundColor: palette.rule }]} />
      ) : null}

      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onToggle(entry.key);
        }}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
        accessibilityRole="switch"
        accessibilityState={{ checked: entry.armed }}
        accessibilityLabel={`${entry.label}, ${entry.count} items, ${formatBytes(entry.bytes)}`}
        accessibilityHint={entry.armed ? 'Turn off to keep these' : 'Turn on to delete these'}>
        <View style={styles.labelColumn}>
          <Text
            style={[styles.label, { color: palette.ink }]}
            maxFontSizeMultiplier={1.8}
            numberOfLines={2}>
            {entry.label}
          </Text>
          <Text
            style={[styles.detail, { color: palette.inkSecondary }]}
            maxFontSizeMultiplier={1.8}>
            {entry.count} · {formatBytes(entry.bytes)}
          </Text>
        </View>

        <Animated.View style={[styles.flagWindow, windowStyle]}>
          <Animated.View
            style={[styles.flag, { backgroundColor: palette.card }, flagStyle]}
          />
        </Animated.View>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    paddingVertical: space.xs,
  },
  title: {
    ...stencil,
    fontSize: 12,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    // Inset to the label's left edge, the way a printed directory is ruled.
    marginLeft: space.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: 56,
    gap: space.md,
  },
  labelColumn: {
    flex: 1,
    gap: 2,
  },
  label: {
    ...stencil,
    fontSize: 15,
  },
  detail: {
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  flagWindow: {
    width: 44,
    height: 26,
    borderRadius: radius.flag,
    borderWidth: 1.5,
    padding: 2,
    justifyContent: 'center',
  },
  flag: {
    width: 18,
    height: 18,
    borderRadius: 2,
  },
});
