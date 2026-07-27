import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { radius, space, stencil, usePalette } from '@/lib/ui/theme';
import { useReduceMotion } from '@/lib/ui/use-reduce-motion';

const THROW = { duration: 160, easing: Easing.out(Easing.exp) };

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Destructive framing — graphite plate gains a caution face. */
  caution?: boolean;
};

/**
 * The main breaker. Deliberately heavier than anything else on screen: this is
 * the one control the primary user is meant to find without looking.
 */
export function MainBreaker({ label, onPress, disabled = false, caution = false }: Props) {
  const palette = usePalette();
  const pressed = useSharedValue(0);
  const reduceMotion = useReduceMotion();

  const plateStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: pressed.value * 2 }],
    opacity: 1 - pressed.value * 0.12,
  }));

  const face = caution ? palette.caution : palette.graphite;

  return (
    <Animated.View style={plateStyle}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onPress();
        }}
        onPressIn={() => {
          pressed.value = reduceMotion ? 1 : withTiming(1, THROW);
        }}
        onPressOut={() => {
          pressed.value = reduceMotion ? 0 : withTiming(0, THROW);
        }}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        style={[
          styles.plate,
          { backgroundColor: disabled ? palette.rule : face },
        ]}>
        <View style={[styles.bevel, { backgroundColor: palette.onGraphite }]} />
        <Text
          style={[
            styles.label,
            { color: disabled ? palette.inkSecondary : palette.onGraphite },
          ]}
          maxFontSizeMultiplier={1.8}
          numberOfLines={2}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  plate: {
    minHeight: 64,
    borderRadius: radius.plate,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
    paddingVertical: space.lg,
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
  label: {
    ...stencil,
    fontSize: 17,
    letterSpacing: 1,
    textAlign: 'center',
  },
});
