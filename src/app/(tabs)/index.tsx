import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Directory, type DirectoryEntry } from '@/components/directory';
import { MainBreaker } from '@/components/main-breaker';
import { Nameplate } from '@/components/nameplate';
import { QuietLink } from '@/components/quiet-link';
import { ScanInterlude } from '@/components/scan-interlude';
import { confirmDelete, deleteSelected } from '@/lib/scan/delete';
import { formatBytes, freedMessage } from '@/lib/scan/estimate';
import {
  PERMISSION_DENIED_LEAD,
  PERMISSION_DENIED_STEPS,
  browseLinkLabel,
} from '@/lib/scan/messages';
import { useScanState } from '@/lib/scan/scan-context';
import {
  AUTO_SAFE_CATEGORIES,
  CATEGORY_LABELS,
  type CategoryId,
} from '@/lib/scan/types';
import { space, usePalette } from '@/lib/ui/theme';

export default function CleanScreen() {
  const palette = usePalette();
  const { permission, phase, result, assetCount, disk, request, rescan } = useScanState();

  // Which categories are armed. Safe ones start on; judgement calls start off.
  const [armed, setArmed] = useState<Set<CategoryId>>(new Set(AUTO_SAFE_CATEGORIES));
  const [freed, setFreed] = useState<string | null>(null);

  const entries = useMemo<DirectoryEntry[]>(() => {
    if (!result) return [];
    return (Object.keys(CATEGORY_LABELS) as CategoryId[])
      .filter((id) => result.perCategory[id].assetIds.length > 0)
      .map((id) => ({
        key: id,
        label: CATEGORY_LABELS[id],
        count: result.perCategory[id].assetIds.length,
        bytes: result.perCategory[id].bytes,
        armed: armed.has(id),
      }));
  }, [result, armed]);

  const selection = useMemo(() => {
    if (!result) return { ids: [] as string[], bytes: 0 };
    const ids = new Set<string>();
    for (const id of armed) {
      for (const assetId of result.perCategory[id].assetIds) ids.add(assetId);
    }
    const list = [...ids];
    const byId = new Map(result.assets.map((a) => [a.id, a.sizeBytes]));
    const bytes = list.reduce((sum, id) => sum + (byId.get(id) ?? 0), 0);
    return { ids: list, bytes };
  }, [result, armed]);

  // Summed once. It feeds both the nameplate's derived reading and the browse
  // link's size, and when the two were written out separately they drifted —
  // one guarded by the suppression rule, the other not.
  const libraryBytes = useMemo(
    () => result?.assets.reduce((sum, a) => sum + a.sizeBytes, 0) ?? null,
    [result],
  );

  function toggle(key: string) {
    setArmed((current) => {
      const next = new Set(current);
      if (next.has(key as CategoryId)) next.delete(key as CategoryId);
      else next.add(key as CategoryId);
      return next;
    });
  }

  async function runDelete() {
    const removedBytes = selection.bytes;
    const outcome = await deleteSelected(selection.ids);
    if (outcome.status === 'cancelled') return;

    // Free space does not move at this moment — the assets are in Recently
    // Deleted, still on the disk for 30 days. Report what left the library and
    // when the space comes back. Shared with /browse so the wording cannot
    // drift between the two screens.
    setFreed(freedMessage(removedBytes));
    await rescan();
  }

  if (permission === 'undetermined') {
    return <PermissionPrimer onContinue={request} />;
  }

  if (permission === 'denied' || phase === 'denied') {
    return <PermissionDenied />;
  }

  const refining = phase === 'refining';
  // Only these two phases carry a `result` that was actually produced by the
  // run currently reflected in `disk` — 'scanning' has not finished yet and
  // 'failed' may still be holding a result from before whatever just changed
  // disk usage (a delete, most often). Trusting it in either case is how a
  // stale figure reaches the capacity plate, and how the directory keeps
  // listing categories the user already deleted with a live "Free up X GB"
  // that does nothing when pressed.
  const dataIsFresh = phase === 'refining' || phase === 'ready';
  const fresh = dataIsFresh && result !== null ? result : null;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.panel }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic">
        <Text style={[styles.title, { color: palette.ink }]}>CleanEx</Text>

        <Nameplate
          usedBytes={disk.usedBytes}
          totalBytes={disk.totalBytes}
          photoLibraryBytes={
            dataIsFresh && libraryBytes !== null ? libraryBytes : undefined
          }
        />

        {freed ? (
          <View style={[styles.receipt, { borderColor: palette.rule }]}>
            <Text
              style={[styles.receiptText, { color: palette.ink }]}
              maxFontSizeMultiplier={1.8}>
              {freed}
            </Text>
          </View>
        ) : null}

        {dataIsFresh ? null : (
          <ScanInterlude
            phase={phase}
            assetCount={assetCount}
            onRetry={() => void rescan()}
          />
        )}

        {fresh && entries.length > 0 ? (
          <>
            <Text style={[styles.headline, { color: palette.ink }]}>
              {formatBytes(selection.bytes)} ready to delete
            </Text>

            <Directory title="What we found" entries={entries} onToggle={toggle} />

            {refining ? (
              <Text style={[styles.refining, { color: palette.inkSecondary }]}>
                Still checking for photos that look alike…
              </Text>
            ) : null}

            <MainBreaker
              label={`Free up ${formatBytes(selection.bytes)}`}
              disabled={selection.ids.length === 0}
              onPress={() =>
                confirmDelete(
                  selection.ids.length,
                  formatBytes(selection.bytes),
                  runDelete,
                )
              }
            />

            <Text style={[styles.reassurance, { color: palette.inkSecondary }]}>
              Nothing is gone for good. Deleted photos wait 30 days in Recently
              Deleted, so you can always get them back.
            </Text>

            {fresh.perCategory.similarPhotos.assetIds.length > 0 ? (
              <QuietLink
                label={`Go further · ${fresh.perCategory.similarPhotos.assetIds.length} photos need your call`}
                onPress={() => router.push('/deck')}
              />
            ) : null}

            <QuietLink
              label="Check what will be deleted"
              onPress={() => router.push('/review')}
            />
          </>
        ) : null}

        {fresh && entries.length === 0 ? (
          <View style={styles.empty}>
            <Text
              style={[styles.emptyTitle, { color: palette.ink }]}
              maxFontSizeMultiplier={1.8}>
              Nothing to clean up.
            </Text>
            <Text
              style={[styles.emptyBody, { color: palette.inkSecondary }]}
              maxFontSizeMultiplier={1.8}>
              We looked through {fresh.assets.length.toLocaleString()} photos and
              videos and did not find copies or clutter worth deleting. You can
              still look through everything on your phone yourself and delete
              anything you do not want.
            </Text>
          </View>
        ) : null}

        {/* Outside both branches on purpose. When the breaker finds nothing,
            this is the only route left to the screen that shows the user their
            400 MB video — and "Nothing to clean up" with no way forward is the
            origin case with the answer removed. */}
        {fresh && libraryBytes !== null ? (
          <QuietLink
            label={browseLinkLabel(fresh.assets.length, libraryBytes, disk.usedBytes)}
            onPress={() => router.push('/browse')}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function PermissionPrimer({ onContinue }: { onContinue: () => void }) {
  const palette = usePalette();
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.panel }]}>
      <View style={styles.primer}>
        <Text style={[styles.title, { color: palette.ink }]}>CleanEx</Text>
        <Text style={[styles.primerLead, { color: palette.ink }]}>
          Your phone is probably storing the same photo several times over.
        </Text>
        <Text style={[styles.primerBody, { color: palette.inkSecondary }]}>
          To find those copies, CleanEx needs to look at your photos. It all
          happens on your phone. Nothing is uploaded, nothing is sent anywhere,
          and nothing is deleted until you say so.
        </Text>
        <View style={styles.primerAction}>
          <MainBreaker label="Look at my photos" onPress={onContinue} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function PermissionDenied() {
  const palette = usePalette();
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.panel }]}>
      <View style={styles.primer}>
        <Text
          style={[styles.primerLead, { color: palette.ink }]}
          maxFontSizeMultiplier={1.8}>
          {PERMISSION_DENIED_LEAD}
        </Text>
        <Text
          style={[styles.primerBody, { color: palette.inkSecondary }]}
          maxFontSizeMultiplier={1.8}>
          {PERMISSION_DENIED_STEPS}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    padding: space.lg,
    paddingBottom: space.xxxl,
    gap: space.lg,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  headline: {
    fontSize: 22,
    fontWeight: '600',
    marginTop: space.sm,
  },
  refining: {
    fontSize: 13,
    marginTop: -space.sm,
  },
  reassurance: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: -space.sm,
  },
  receipt: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: space.md,
  },
  receiptText: { fontSize: 15, lineHeight: 21 },
  empty: { gap: space.sm, paddingVertical: space.xl },
  emptyTitle: { fontSize: 20, fontWeight: '600' },
  emptyBody: { fontSize: 15, lineHeight: 21 },
  primer: {
    flex: 1,
    padding: space.xl,
    justifyContent: 'center',
    gap: space.lg,
  },
  primerLead: { fontSize: 24, fontWeight: '600', lineHeight: 31 },
  primerBody: { fontSize: 16, lineHeight: 23 },
  primerAction: { marginTop: space.lg },
});
