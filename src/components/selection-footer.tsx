import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MainBreaker } from '@/components/main-breaker';
import { formatBytes } from '@/lib/scan/estimate';
import { cardShadow, space, usePalette } from '@/lib/ui/theme';

type Props = {
  count: number;
  bytes: number;
  favouriteCount: number;
  onDelete: () => void;
};

/**
 * Floats over the list rather than sitting at its end — with thirty thousand
 * items the end of the list is somewhere the user will never scroll to.
 *
 * Absent entirely when nothing is selected, so the resting state of the browser
 * is a calm screen with no controls competing for attention.
 */
export function SelectionFooter({ count, bytes, favouriteCount, onDelete }: Props) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();

  if (count === 0) return null;

  return (
    <View
      style={[
        styles.bar,
        cardShadow,
        {
          backgroundColor: palette.card,
          paddingBottom: insets.bottom + space.md,
          borderTopColor: palette.rule,
        },
      ]}>
      {favouriteCount > 0 ? (
        <Text
          style={[styles.warning, { color: palette.inkSecondary }]}
          maxFontSizeMultiplier={1.8}>
          {favouriteCount === 1
            ? '1 of these is a photo you marked as a favourite.'
            : `${favouriteCount} of these are photos you marked as favourites.`}
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
