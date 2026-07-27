import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { formatBytes } from '@/lib/scan/estimate';
import type { AssetFact } from '@/lib/scan/types';
import { radius, space, usePalette } from '@/lib/ui/theme';

/** PhotoKit local identifiers address directly as ph:// on iOS. */
export function assetUri(id: string): string {
  return `ph://${id}`;
}

type Props = {
  assets: AssetFact[];
  armed: Set<string>;
  onToggle: (id: string) => void;
};

/**
 * Grid review. Scanning forty thumbnails is faster than forty swipes, so this
 * is the default for the weekly review; the deck is offered as an alternative.
 */
export function PhotoGrid({ assets, armed, onToggle }: Props) {
  const palette = usePalette();
  const { width } = useWindowDimensions();

  const columns = width >= 700 ? 4 : 3;
  const gap = space.sm;
  const size = (width - space.lg * 2 - gap * (columns - 1)) / columns;

  return (
    <View style={[styles.grid, { gap }]}>
      {assets.map((asset) => {
        const isArmed = armed.has(asset.id);
        return (
          <Pressable
            key={asset.id}
            onPress={() => onToggle(asset.id)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isArmed }}
            accessibilityLabel={`Photo, ${formatBytes(asset.sizeBytes)}`}
            accessibilityHint={isArmed ? 'Turn off to keep' : 'Turn on to delete'}
            style={[styles.cell, { width: size, height: size }]}>
            <Image
              source={{ uri: assetUri(asset.id) }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={120}
            />
            <View
              style={[
                styles.overlay,
                isArmed && { borderColor: palette.amber, borderWidth: 3 },
              ]}
            />
            {isArmed ? (
              <View style={[styles.mark, { backgroundColor: palette.amber }]}>
                <Text style={[styles.markGlyph, { color: palette.card }]}>✓</Text>
              </View>
            ) : null}
            <Text style={styles.size} numberOfLines={1}>
              {formatBytes(asset.sizeBytes)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    borderRadius: radius.flag,
    overflow: 'hidden',
    backgroundColor: '#0002',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.flag,
    borderWidth: 0,
  },
  mark: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markGlyph: { fontSize: 14, fontWeight: '700' },
  size: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    color: '#fff',
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    textShadowColor: '#000',
    textShadowRadius: 3,
  },
});
