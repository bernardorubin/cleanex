import { useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';

import { assetUri } from '@/components/photo-grid';
import { formatBytes } from '@/lib/scan/estimate';
import type { AssetFact } from '@/lib/scan/types';
import { cardShadow, radius, space, stencil, usePalette } from '@/lib/ui/theme';
import { useReduceMotion } from '@/lib/ui/use-reduce-motion';

const FLING = { duration: 200, easing: Easing.out(Easing.exp) };
const THRESHOLD = 90;

type Props = {
  assets: AssetFact[];
  armed: Set<string>;
  onToggle: (id: string) => void;
  onDone: () => void;
};

/**
 * One decision at a time, for judgement calls only. Left arms the photo for
 * deletion, right keeps it. Never used for anything we are already confident
 * about — those are handled by the main breaker without asking.
 */
export function SwipeDeck({ assets, armed, onToggle, onDone }: Props) {
  const palette = usePalette();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const reduceMotion = useReduceMotion();

  const x = useSharedValue(0);
  const current = assets[index];

  function advance(deleteIt: boolean) {
    if (current && deleteIt && !armed.has(current.id)) onToggle(current.id);
    Haptics.impactAsync(
      deleteIt ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
    );
    x.value = 0;
    const next = index + 1;
    if (next >= assets.length) onDone();
    else setIndex(next);
  }

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      x.value = event.translationX;
    })
    .onEnd((event) => {
      if (Math.abs(event.translationX) > THRESHOLD) {
        const goingLeft = event.translationX < 0;
        x.value = reduceMotion
          ? 0
          : withTiming(goingLeft ? -width : width, FLING, () => {
              runOnJS(advance)(goingLeft);
            });
        if (reduceMotion) runOnJS(advance)(goingLeft);
      } else {
        x.value = withTiming(0, FLING);
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { rotateZ: `${x.value / 40}deg` }],
  }));

  const deleteHint = useAnimatedStyle(() => ({
    opacity: Math.min(Math.max(-x.value / THRESHOLD, 0), 1),
  }));

  const keepHint = useAnimatedStyle(() => ({
    opacity: Math.min(Math.max(x.value / THRESHOLD, 0), 1),
  }));

  if (!current) {
    return (
      <View style={styles.finished}>
        <Text style={[styles.finishedText, { color: palette.ink }]}>
          That is all of them.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={[styles.counter, { color: palette.inkSecondary }]}>
        {index + 1} of {assets.length}
      </Text>

      <GestureDetector gesture={pan}>
        <Animated.View
          style={[styles.card, { backgroundColor: palette.card }, cardShadow, cardStyle]}
          accessible
          accessibilityLabel={`Photo ${index + 1} of ${assets.length}, ${formatBytes(
            current.sizeBytes,
          )}`}
          accessibilityHint="Swipe left to delete, right to keep">
          <Image
            source={{ uri: assetUri(current.id) }}
            style={styles.photo}
            contentFit="cover"
            transition={140}
          />

          <Animated.View
            style={[styles.stamp, styles.stampLeft, { borderColor: palette.caution }, deleteHint]}>
            <Text style={[styles.stampText, { color: palette.caution }]}>Delete</Text>
          </Animated.View>

          <Animated.View
            style={[styles.stamp, styles.stampRight, { borderColor: palette.ink }, keepHint]}>
            <Text style={[styles.stampText, { color: palette.ink }]}>Keep</Text>
          </Animated.View>

          <Text style={[styles.size, { color: palette.inkSecondary }]}>
            {formatBytes(current.sizeBytes)}
          </Text>
        </Animated.View>
      </GestureDetector>

      <View style={styles.legend}>
        <Text style={[styles.legendText, { color: palette.inkSecondary }]}>
          ← Delete
        </Text>
        <Text style={[styles.legendText, { color: palette.inkSecondary }]}>
          Keep →
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  counter: { fontSize: 14, fontVariant: ['tabular-nums'], textAlign: 'center' },
  card: {
    borderRadius: radius.card,
    padding: space.sm,
    aspectRatio: 0.78,
    justifyContent: 'flex-end',
  },
  photo: { flex: 1, borderRadius: radius.flag },
  size: {
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    paddingTop: space.sm,
    paddingHorizontal: space.xs,
  },
  stamp: {
    position: 'absolute',
    top: space.xl,
    borderWidth: 3,
    borderRadius: radius.flag,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  stampLeft: { right: space.xl, transform: [{ rotate: '12deg' }] },
  stampRight: { left: space.xl, transform: [{ rotate: '-12deg' }] },
  stampText: { ...stencil, fontSize: 20 },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: space.sm,
  },
  legendText: { fontSize: 15 },
  finished: { paddingVertical: space.xxl, alignItems: 'center' },
  finishedText: { fontSize: 18, fontWeight: '600' },
});
