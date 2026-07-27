import { Pressable, StyleSheet, Text } from 'react-native';

import { space, usePalette } from '@/lib/ui/theme';

/**
 * Secondary navigation. Deliberately quiet — the main breaker is the only
 * thing on screen that should compete for attention.
 */
export function QuietLink({ label, onPress }: { label: string; onPress: () => void }) {
  const palette = usePalette();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.link, pressed && { opacity: 0.5 }]}>
      <Text style={[styles.label, { color: palette.ink }]} maxFontSizeMultiplier={1.8}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: {
    minHeight: 44,
    justifyContent: 'center',
  },
  label: {
    fontSize: 16,
    textDecorationLine: 'underline',
  },
});
