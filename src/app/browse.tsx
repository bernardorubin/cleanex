import { useCallback, useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Stack } from 'expo-router';
import { playVideo } from '@modules/photo-scan';

import { BinFlow } from '@/components/bin-flow';
import { MediaBrowserGrid } from '@/components/media-browser-grid';
import { ScanInterlude } from '@/components/scan-interlude';
import { SelectionFooter } from '@/components/selection-footer';
import { countFavourites, favouriteNote, sortBySizeDesc } from '@/lib/scan/browse';
import { confirmDelete, deleteSelected } from '@/lib/scan/delete';
import { estimateFreed, formatBytes, freedMessage } from '@/lib/scan/estimate';
import { useScanState } from '@/lib/scan/scan-context';
import { cardShadow, radius, space, usePalette } from '@/lib/ui/theme';

/**
 * Everything on the phone, largest first.
 *
 * Deliberately opposite to /review: that screen shows what the app decided and
 * lets the user veto it, this one shows the whole library and decides nothing.
 */
export default function BrowseScreen() {
  const palette = usePalette();
  const { result, rescan, phase, assetCount } = useScanState();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [footerHeight, setFooterHeight] = useState(0);
  const [freed, setFreed] = useState<{ message: string; bytes: number } | null>(null);
  const [freedHeight, setFreedHeight] = useState(0);
  const [openingVideo, setOpeningVideo] = useState(false);

  // Only these two phases carry a `result` produced by the run currently
  // reflected on disk. During a rescan — which every delete on this screen
  // starts — the old result still lists the photos that were just deleted,
  // selectable, with a delete button that resolves to nothing when pressed.
  const dataIsFresh = phase === 'refining' || phase === 'ready';
  const fresh = dataIsFresh && result !== null ? result : null;

  const assets = useMemo(
    () => (fresh ? sortBySizeDesc(fresh.assets) : []),
    [fresh],
  );

  const bytes = useMemo(
    () => (fresh ? estimateFreed(fresh.assets, selected) : 0),
    [fresh, selected],
  );

  const favouriteCount = useMemo(
    () => (fresh ? countFavourites(fresh.assets, selected) : 0),
    [fresh, selected],
  );

  // Stable across renders so the memoized cells below actually bail out: a
  // fresh function identity on every keystroke of selection would re-render
  // every one of the ~200 windowed cells on the audience's old hardware.
  const toggle = useCallback((id: string) => {
    // A fresh selection is a new action — the last delete's receipt should
    // not keep eating the top of the screen (and the grid's top clearance)
    // for the rest of the session.
    setFreed(null);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  async function runDelete() {
    const removedBytes = bytes;
    const outcome = await deleteSelected([...selected]);
    if (outcome.status === 'cancelled') return;
    setSelected(new Set());
    // Free space does not move at this moment: the assets are in Recently
    // Deleted, still occupying the disk for 30 days. The same wording as the
    // Clean tab so the two screens cannot drift.
    const message = freedMessage(removedBytes);
    setFreed({ message, bytes: removedBytes });
    // The receipt is a silent, absolutely-positioned card after a 30,000-cell
    // list in accessibility order — VoiceOver would neither speak it nor
    // reliably reach it by swipe without this. Queued: it lands the same
    // frame as the confirmation sheet dismissing and the grid re-rendering,
    // both of which compete for the speech channel.
    AccessibilityInfo.announceForAccessibilityWithOptions(message, { queue: true });
    await rescan();
  }

  function askToDelete() {
    // Naming favourites in the confirmation is the only guard on deleting
    // something the user hearted — this screen deliberately lets them select it.
    const note = favouriteNote(favouriteCount, selected.size);

    confirmDelete(selected.size, formatBytes(bytes), runDelete, note);
  }

  const play = useCallback(async (id: string) => {
    // An iCloud video is downloaded before it can play, which can take several
    // seconds with nothing on screen to show for it. Without this the biggest
    // control on the biggest cell looks broken.
    setOpeningVideo(true);
    let opened = false;
    try {
      opened = await playVideo(id);
    } catch {
      opened = false;
    } finally {
      setOpeningVideo(false);
    }
    if (!opened) {
      Alert.alert(
        'This video will not open',
        'Nothing is wrong with your phone. Try again in a moment.',
      );
    }
  }, []);

  const handlePlay = useCallback((id: string) => void play(id), [play]);

  function handleFreedLayout(event: LayoutChangeEvent) {
    setFreedHeight(event.nativeEvent.layout.height);
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Everything on your phone' }} />
      <View style={[styles.screen, { backgroundColor: palette.panel }]}>
        {!dataIsFresh ? (
          // Never the stale grid. After a delete on this screen that would be
          // thumbnails of photos the user has already deleted, selectable,
          // behind a button that silently does nothing.
          <View style={styles.interlude}>
            <ScanInterlude
              phase={phase}
              assetCount={assetCount}
              onRetry={() => void rescan()}
            />
          </View>
        ) : assets.length > 0 ? (
          <MediaBrowserGrid
            assets={assets}
            selected={selected}
            onToggle={toggle}
            onPlay={handlePlay}
            bottomInset={selected.size > 0 ? footerHeight : 0}
            // The banner is not flush with the top of the screen — it sits at
            // space.md — so reserving only its height leaves the first row
            // under-cleared by exactly that much. The second space.md is the
            // gap between banner and grid.
            topInset={freed ? freedHeight + space.md * 2 : 0}
          />
        ) : (
          <View style={styles.empty}>
            <Text
              style={[styles.emptyText, { color: palette.inkSecondary }]}
              maxFontSizeMultiplier={1.8}>
              Nothing here. Your photo library is empty.
            </Text>
          </View>
        )}

        {freed ? (
          <View
            onLayout={handleFreedLayout}
            style={[
              styles.freed,
              cardShadow,
              { backgroundColor: palette.card, borderColor: palette.rule },
            ]}>
            <Text
              style={[styles.freedText, { color: palette.ink }]}
              maxFontSizeMultiplier={1.8}>
              {freed.message}
            </Text>
            {/* The same bin flow the Clean tab shows. Deleting moves assets
                to Recently Deleted, where they keep occupying storage for 30
                days — these steps are the only way to have the space today,
                and no app is allowed to take them for the user. */}
            <BinFlow bytes={freed.bytes} />
          </View>
        ) : null}

        {openingVideo ? (
          <View style={styles.opening} pointerEvents="none">
            <View
              style={[
                styles.openingCard,
                cardShadow,
                { backgroundColor: palette.card, borderColor: palette.rule },
              ]}>
              <ActivityIndicator color={palette.amber} />
              <Text
                style={[styles.openingText, { color: palette.ink }]}
                maxFontSizeMultiplier={1.8}>
                Opening your video…
              </Text>
            </View>
          </View>
        ) : null}

        <SelectionFooter
          count={selected.size}
          bytes={bytes}
          favouriteCount={favouriteCount}
          onDelete={askToDelete}
          onHeightChange={setFooterHeight}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  empty: { flex: 1, justifyContent: 'center', padding: space.xl },
  emptyText: { fontSize: 16, lineHeight: 23, textAlign: 'center' },
  interlude: { flex: 1, justifyContent: 'center', paddingHorizontal: space.xl },
  freed: {
    position: 'absolute',
    top: space.md,
    left: space.lg,
    right: space.lg,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.md,
    gap: space.md,
  },
  freedText: { fontSize: 15, lineHeight: 21 },
  opening: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  openingText: { fontSize: 16, lineHeight: 23 },
});
