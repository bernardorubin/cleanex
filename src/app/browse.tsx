import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { playVideo } from '@modules/photo-scan';

import { MediaBrowserGrid } from '@/components/media-browser-grid';
import { SelectionFooter } from '@/components/selection-footer';
import { countFavourites, sortBySizeDesc } from '@/lib/scan/browse';
import { confirmDelete, deleteAndMeasure } from '@/lib/scan/delete';
import { estimateFreed, formatBytes } from '@/lib/scan/estimate';
import { useScanState } from '@/lib/scan/scan-context';
import { space, usePalette } from '@/lib/ui/theme';

/**
 * Everything on the phone, largest first.
 *
 * Deliberately opposite to /review: that screen shows what the app decided and
 * lets the user veto it, this one shows the whole library and decides nothing.
 */
export default function BrowseScreen() {
  const palette = usePalette();
  const { result, rescan } = useScanState();
  const [selected, setSelected] = useState<Set<string>>(new Set());

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
    await rescan();
    router.back();
  }

  function askToDelete() {
    // Naming favourites in the confirmation is the only guard on deleting
    // something the user hearted — this screen deliberately lets them select it.
    const note =
      favouriteCount === 0
        ? undefined
        : favouriteCount === 1
          ? '1 of these is a photo you marked as a favourite.'
          : `${favouriteCount} of these are photos you marked as favourites.`;

    confirmDelete(selected.size, formatBytes(bytes), runDelete, note);
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
            onPlay={(id) => void playVideo(id)}
          />
        ) : (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: palette.inkSecondary }]}>
              Nothing here yet. Make Room is still looking through your photos.
            </Text>
          </View>
        )}

        <SelectionFooter
          count={selected.size}
          bytes={bytes}
          favouriteCount={favouriteCount}
          onDelete={askToDelete}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  empty: { flex: 1, justifyContent: 'center', padding: space.xl },
  emptyText: { fontSize: 16, lineHeight: 23, textAlign: 'center' },
});
