import { useMemo, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Stack } from 'expo-router';
import { playVideo } from '@modules/photo-scan';

import { MediaBrowserGrid } from '@/components/media-browser-grid';
import { SelectionFooter } from '@/components/selection-footer';
import { countFavourites, favouriteNote, sortBySizeDesc } from '@/lib/scan/browse';
import { confirmDelete, deleteAndMeasure } from '@/lib/scan/delete';
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
  const { result, rescan, phase } = useScanState();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [footerHeight, setFooterHeight] = useState(0);
  const [freed, setFreed] = useState<string | null>(null);
  const [freedHeight, setFreedHeight] = useState(0);

  const assets = useMemo(
    () => (result ? sortBySizeDesc(result.assets) : []),
    [result],
  );

  const bytes = useMemo(
    () => (result ? estimateFreed(result.assets, selected) : 0),
    [result, selected],
  );

  const favouriteCount = useMemo(
    () => (result ? countFavourites(result.assets, selected) : 0),
    [result, selected],
  );

  function toggle(id: string) {
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
  }

  async function runDelete() {
    const outcome = await deleteAndMeasure([...selected], bytes);
    if (outcome.status === 'cancelled') return;
    setSelected(new Set());
    // Predict with the estimate, report the truth. /browse is sorted
    // largest-first, so it is exactly where an iCloud "Optimize iPhone
    // Storage" shortfall is biggest — the same wording as the Clean tab so
    // the two screens cannot drift.
    const message = freedMessage(outcome.estimatedBytes, outcome.actualBytes);
    setFreed(message);
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

  async function play(id: string) {
    const opened = await playVideo(id);
    if (!opened) {
      Alert.alert(
        'This video will not open',
        'Nothing is wrong with your phone. Try again in a moment.',
      );
    }
  }

  function handleFreedLayout(event: LayoutChangeEvent) {
    setFreedHeight(event.nativeEvent.layout.height);
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Everything on your phone' }} />
      <View style={[styles.screen, { backgroundColor: palette.panel }]}>
        {assets.length > 0 ? (
          <MediaBrowserGrid
            assets={assets}
            selected={selected}
            onToggle={toggle}
            onPlay={(id) => void play(id)}
            bottomInset={selected.size > 0 ? footerHeight : 0}
            topInset={freed ? freedHeight : 0}
          />
        ) : (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: palette.inkSecondary }]}>
              {phase === 'denied'
                ? 'Make Room cannot see your photos yet. Check Settings to allow access.'
                : phase === 'ready'
                  ? 'Nothing here. Your photo library is empty.'
                  : 'Nothing here yet. Make Room is still looking through your photos.'}
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
              {freed}
            </Text>
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
  freed: {
    position: 'absolute',
    top: space.md,
    left: space.lg,
    right: space.lg,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.md,
  },
  freedText: { fontSize: 15, lineHeight: 21 },
});
