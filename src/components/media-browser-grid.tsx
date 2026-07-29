import { useMemo } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';

import { assetUri } from '@/components/photo-grid';
import { chunkIntoRows, formatDuration } from '@/lib/scan/browse';
import { formatBytes } from '@/lib/scan/estimate';
import type { AssetFact } from '@/lib/scan/types';
import { radius, space, usePalette } from '@/lib/ui/theme';

type Props = {
  /** Already sorted by the caller. This component never reorders. */
  assets: AssetFact[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onPlay: (id: string) => void;
  /**
   * Extra bottom clearance, on top of the list's own padding — enough that a
   * floating footer (e.g. SelectionFooter) never hides the last row.
   */
  bottomInset?: number;
  /** Same idea at the top, for a floating banner (e.g. the freed receipt). */
  topInset?: number;
};

/**
 * The whole library in one list.
 *
 * Rows are pre-chunked so the FlatList is a list of rows, not of cells. That
 * makes getItemLayout exact, which is what keeps scrolling smooth at thirty
 * thousand assets — the eager ScrollView in PhotoGrid cannot survive that.
 */
export function MediaBrowserGrid({
  assets,
  selected,
  onToggle,
  onPlay,
  bottomInset = 0,
  topInset = 0,
}: Props) {
  const { width } = useWindowDimensions();

  const columns = width >= 700 ? 4 : 3;
  const gap = space.sm;
  const cell = (width - space.lg * 2 - gap * (columns - 1)) / columns;
  const rowHeight = cell + gap;

  const rows = useMemo(
    () => chunkIntoRows(assets, columns),
    [assets, columns],
  );

  return (
    <FlatList
      data={rows}
      keyExtractor={(row) => row[0]?.id ?? 'empty'}
      removeClippedSubviews
      initialNumToRender={12}
      windowSize={11}
      maxToRenderPerBatch={12}
      getItemLayout={(_, index) => ({
        length: rowHeight,
        // `topInset` becomes real paddingTop on the content container below,
        // which shifts every row's actual on-screen position by that amount.
        // getItemLayout has to report that same shift or its offsets stop
        // matching reality — scroll-to and windowing math would be off by
        // exactly the receipt's height.
        offset: rowHeight * index + topInset,
        index,
      })}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topInset, paddingBottom: space.xxxl + bottomInset },
      ]}
      contentInsetAdjustmentBehavior="automatic"
      renderItem={({ item: row }) => (
        <View style={[styles.row, { gap, height: rowHeight }]}>
          {row.map((asset) => (
            <MediaCell
              key={asset.id}
              asset={asset}
              size={cell}
              isSelected={selected.has(asset.id)}
              onToggle={onToggle}
              onPlay={onPlay}
            />
          ))}
        </View>
      )}
    />
  );
}

function MediaCell({
  asset,
  size,
  isSelected,
  onToggle,
  onPlay,
}: {
  asset: AssetFact;
  size: number;
  isSelected: boolean;
  onToggle: (id: string) => void;
  onPlay: (id: string) => void;
}) {
  const palette = usePalette();
  const isVideo = asset.subtype === 'video' || asset.subtype === 'screenRecording';

  // Video cells keep role="button" — their primary action plays the video,
  // they are not checkboxes — so "checked" state is never spoken by VoiceOver
  // for them. The selection state has to live in the label text instead.
  const label = [
    isVideo && isSelected ? 'Selected' : null,
    isVideo ? 'Video' : 'Photo',
    formatBytes(asset.sizeBytes),
    isVideo ? formatDuration(asset.durationSeconds) : null,
    asset.isFavorite ? 'Favourite' : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      onPress={() => (isVideo ? onPlay(asset.id) : onToggle(asset.id))}
      onLongPress={() => onToggle(asset.id)}
      accessibilityRole={isVideo ? 'button' : 'checkbox'}
      accessibilityState={isVideo ? undefined : { checked: isSelected }}
      accessibilityLabel={label}
      accessibilityHint={
        isVideo
          ? isSelected
            ? 'Double tap to watch. Touch and hold to remove it from your selection.'
            : 'Double tap to watch. Touch and hold to select it for deletion.'
          : isSelected
            ? 'Turn off to keep'
            : 'Turn on to delete'
      }
      style={[styles.cell, { width: size, height: size }]}>
      <Image
        source={{ uri: assetUri(asset.id) }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={120}
      />

      {isSelected ? (
        <>
          <View style={[styles.selectedEdge, { borderColor: palette.amber }]} />
          <View style={[styles.mark, { backgroundColor: palette.amber }]}>
            <Text style={styles.markGlyph} maxFontSizeMultiplier={1.4}>
              ✓
            </Text>
          </View>
        </>
      ) : null}

      {asset.isFavorite ? (
        <Text style={styles.heart} maxFontSizeMultiplier={1.4}>
          ♥
        </Text>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.size} numberOfLines={1} maxFontSizeMultiplier={1.4}>
          {formatBytes(asset.sizeBytes)}
        </Text>
        {isVideo ? (
          <Text style={styles.size} numberOfLines={1} maxFontSizeMultiplier={1.4}>
            ▶ {formatDuration(asset.durationSeconds)}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.lg, paddingBottom: space.xxxl },
  row: { flexDirection: 'row' },
  cell: {
    borderRadius: radius.flag,
    overflow: 'hidden',
    backgroundColor: '#0002',
  },
  selectedEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.flag,
    borderWidth: 3,
  },
  mark: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markGlyph: { fontSize: 14, fontWeight: '700', color: '#fff' },
  heart: {
    position: 'absolute',
    top: 4,
    left: 4,
    fontSize: 13,
    color: '#fff',
    textShadowColor: '#000',
    textShadowRadius: 3,
  },
  footer: {
    position: 'absolute',
    left: 4,
    right: 4,
    bottom: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.xs,
  },
  size: {
    color: '#fff',
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    textShadowColor: '#000',
    textShadowRadius: 3,
  },
});
