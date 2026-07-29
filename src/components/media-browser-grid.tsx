import { memo, useCallback, useMemo } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ListRenderItemInfo,
} from 'react-native';
import { Image } from 'expo-image';

import { assetUri } from '@/components/photo-grid';
import { chunkIntoRows, formatDuration } from '@/lib/scan/browse';
import { formatBytes } from '@/lib/scan/estimate';
import type { AssetFact } from '@/lib/scan/types';
import { radius, space, usePalette } from '@/lib/ui/theme';

/** VoiceOver's rotor entry for playback — see the cell's comment below. */
const PLAY_ACTIONS = [{ name: 'play', label: 'Play video' }];

type Props = {
  /** Already sorted by the caller. This component never reorders. */
  assets: AssetFact[];
  selected: Set<string>;
  /** Must be referentially stable, or every windowed cell re-renders per tap. */
  onToggle: (id: string) => void;
  /** Same. */
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

  // Hoisted out of the JSX so it is not a new function on every render. It
  // still closes over `selected`, which changes on every tap — `extraData`
  // below tells FlatList that, and MediaCell's memo comparison is what stops
  // the other ~200 windowed cells from re-rendering with it. Only the cell
  // whose `isSelected` actually flipped does any work.
  const renderRow = useCallback(
    ({ item: row }: ListRenderItemInfo<AssetFact[]>) => (
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
    ),
    [cell, gap, rowHeight, selected, onToggle, onPlay],
  );

  return (
    <FlatList
      data={rows}
      keyExtractor={(row) => row[0]?.id ?? 'empty'}
      extraData={selected}
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
      renderItem={renderRow}
    />
  );
}

/**
 * Memoized on purpose. `asset` is a stable object from the scan result and the
 * callbacks are stable from the caller, so the default shallow comparison turns
 * on `isSelected` alone: the tapped cell re-renders, its ~200 neighbours in the
 * window do not.
 */
const MediaCell = memo(function MediaCell({
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

  // Tap selects, on every cell in the app. Playback used to own the tap on a
  // video, which left selecting it to a long press that nothing on screen
  // mentioned — on the one screen that exists so the biggest video is the
  // first thing you see. The play badge below carries playback instead.
  const label = [
    isVideo ? 'Video' : 'Photo',
    formatBytes(asset.sizeBytes),
    isVideo ? formatDuration(asset.durationSeconds) : null,
    asset.isFavorite ? 'Favourite' : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      onPress={() => onToggle(asset.id)}
      // Kept as a second route to selection: it costs nothing and anyone who
      // learned it before still has it.
      onLongPress={() => onToggle(asset.id)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected }}
      accessibilityLabel={label}
      accessibilityHint={isSelected ? 'Turn off to keep' : 'Turn on to delete'}
      // VoiceOver collapses a nested button into its accessible parent, so the
      // play badge would otherwise be unreachable by swipe. This exposes it as
      // a rotor action on the cell itself.
      accessibilityActions={isVideo ? PLAY_ACTIONS : undefined}
      onAccessibilityAction={
        isVideo
          ? (event) => {
              if (event.nativeEvent.actionName === 'play') onPlay(asset.id);
            }
          : undefined
      }
      style={[styles.cell, { width: size, height: size }]}>
      <Image
        source={{ uri: assetUri(asset.id) }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={120}
      />

      {/* Decoration only. Without pointerEvents="none" the topmost of these
          swallows taps meant for the cell or the play badge underneath. */}
      {isSelected ? (
        <>
          <View
            pointerEvents="none"
            style={[styles.selectedEdge, { borderColor: palette.amber }]}
          />
          <View
            pointerEvents="none"
            style={[styles.mark, { backgroundColor: palette.amber }]}>
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

      <View pointerEvents="none" style={styles.footer}>
        <Text style={styles.size} numberOfLines={1} maxFontSizeMultiplier={1.4}>
          {formatBytes(asset.sizeBytes)}
        </Text>
        {isVideo ? (
          <Text style={styles.size} numberOfLines={1} maxFontSizeMultiplier={1.4}>
            {formatDuration(asset.durationSeconds)}
          </Text>
        ) : null}
      </View>

      {/* Last, so nothing above can steal its tap. */}
      {isVideo ? (
        <Pressable
          onPress={() => onPlay(asset.id)}
          accessibilityRole="button"
          accessibilityLabel="Play video"
          style={[styles.play, { backgroundColor: palette.graphite }]}>
          <Text
            style={[styles.playGlyph, { color: palette.onGraphite }]}
            maxFontSizeMultiplier={1.4}>
            ▶
          </Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.lg, paddingBottom: space.xxxl },
  row: { flexDirection: 'row' },
  cell: {
    borderRadius: radius.flag,
    overflow: 'hidden',
    backgroundColor: '#0002',
  },
  play: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    // Half of the 44pt target, which is the minimum and not negotiable — this
    // is the control that makes a video watchable.
    marginTop: -22,
    marginLeft: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.9,
  },
  playGlyph: {
    fontSize: 17,
    fontWeight: '700',
    // The glyph's own bearing sits it left of centre in the circle.
    marginLeft: 2,
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
