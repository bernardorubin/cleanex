import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MainBreaker } from '@/components/main-breaker';
import { favouriteNote } from '@/lib/scan/browse';
import { formatBytes } from '@/lib/scan/estimate';
import { cardShadow, space, usePalette } from '@/lib/ui/theme';

type Props = {
  count: number;
  bytes: number;
  favouriteCount: number;
  onDelete: () => void;
  /**
   * Reports the bar's real rendered height. Dynamic Type makes that height
   * unpredictable, so callers who need to reserve clearance for it (e.g. the
   * grid underneath) measure rather than guess a constant.
   */
  onHeightChange?: (height: number) => void;
};

/**
 * Floats over the list rather than sitting at its end — with thirty thousand
 * items the end of the list is somewhere the user will never scroll to.
 *
 * Absent entirely when nothing is selected, so the resting state of the browser
 * is a calm screen with no controls competing for attention.
 */
export function SelectionFooter({
  count,
  bytes,
  favouriteCount,
  onDelete,
  onHeightChange,
}: Props) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();

  if (count === 0) return null;

  function handleLayout(event: LayoutChangeEvent) {
    onHeightChange?.(event.nativeEvent.layout.height);
  }

  const note = favouriteNote(favouriteCount, count);

  return (
    <View
      onLayout={handleLayout}
      style={[
        styles.bar,
        cardShadow,
        {
          backgroundColor: palette.card,
          paddingBottom: insets.bottom + space.md,
          borderTopColor: palette.rule,
        },
      ]}>
      {note ? (
        <Text
          style={[styles.warning, { color: palette.inkSecondary }]}
          maxFontSizeMultiplier={1.8}>
          {note}
        </Text>
      ) : null}

      <MainBreaker
        label={`Delete ${count} · ${formatBytes(bytes)}`}
        onPress={onDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    gap: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  warning: { fontSize: 14, lineHeight: 20 },
});
