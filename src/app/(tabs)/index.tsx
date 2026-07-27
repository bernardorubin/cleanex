import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Directory, type DirectoryEntry } from '@/components/directory';
import { MainBreaker } from '@/components/main-breaker';
import { Nameplate } from '@/components/nameplate';
import { QuietLink } from '@/components/quiet-link';
import { confirmDelete, deleteAndMeasure } from '@/lib/scan/delete';
import { formatBytes } from '@/lib/scan/estimate';
import { useScan } from '@/lib/scan/use-scan';
import {
  AUTO_SAFE_CATEGORIES,
  CATEGORY_LABELS,
  type CategoryId,
} from '@/lib/scan/types';
import { space, usePalette } from '@/lib/ui/theme';

export default function CleanScreen() {
  const palette = usePalette();
  const { permission, phase, result, assetCount, disk, request, rescan } = useScan();

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

  function toggle(key: string) {
    setArmed((current) => {
      const next = new Set(current);
      if (next.has(key as CategoryId)) next.delete(key as CategoryId);
      else next.add(key as CategoryId);
      return next;
    });
  }

  async function runDelete() {
    const outcome = await deleteAndMeasure(selection.ids, selection.bytes);
    if (outcome.status === 'cancelled') return;

    // Predict with the estimate, report the truth. A large gap is the moment
    // to explain iCloud rather than quietly show a smaller number.
    const shortfall = outcome.estimatedBytes - outcome.actualBytes;
    const misleading = shortfall > outcome.estimatedBytes * 0.25;
    setFreed(
      misleading
        ? `Freed ${formatBytes(outcome.actualBytes)}. Less than expected because iCloud was already storing most of these for you.`
        : `Freed ${formatBytes(outcome.actualBytes)}.`,
    );
    await rescan();
  }

  if (permission === 'undetermined') {
    return <PermissionPrimer onContinue={request} />;
  }

  if (permission === 'denied' || phase === 'denied') {
    return <PermissionDenied />;
  }

  const scanning = phase === 'scanning';
  const refining = phase === 'refining';

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.panel }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic">
        <Text style={[styles.title, { color: palette.ink }]}>Limpio</Text>

        <Nameplate usedBytes={disk.usedBytes} totalBytes={disk.totalBytes} />

        {freed ? (
          <View style={[styles.receipt, { borderColor: palette.rule }]}>
            <Text style={[styles.receiptText, { color: palette.ink }]}>{freed}</Text>
          </View>
        ) : null}

        {scanning ? (
          <View style={styles.status}>
            <ActivityIndicator color={palette.amber} />
            <Text style={[styles.statusText, { color: palette.inkSecondary }]}>
              {assetCount > 0
                ? `Looking through ${assetCount.toLocaleString()} photos and videos…`
                : 'Opening your photos…'}
            </Text>
          </View>
        ) : null}

        {result && entries.length > 0 ? (
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

            {result.perCategory.similarPhotos.assetIds.length > 0 ? (
              <QuietLink
                label={`Go further · ${result.perCategory.similarPhotos.assetIds.length} photos need your call`}
                onPress={() => router.push('/deck')}
              />
            ) : null}

            <QuietLink label="See every photo first" onPress={() => router.push('/review')} />
          </>
        ) : null}

        {result && entries.length === 0 && !scanning ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: palette.ink }]}>
              Nothing to clean up.
            </Text>
            <Text style={[styles.emptyBody, { color: palette.inkSecondary }]}>
              We looked through {assetCount.toLocaleString()} photos and videos and
              did not find copies or clutter worth deleting.
            </Text>
          </View>
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
        <Text style={[styles.title, { color: palette.ink }]}>Limpio</Text>
        <Text style={[styles.primerLead, { color: palette.ink }]}>
          Your phone is probably storing the same photo several times over.
        </Text>
        <Text style={[styles.primerBody, { color: palette.inkSecondary }]}>
          To find those copies, Limpio needs to look at your photos. It all
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
        <Text style={[styles.primerLead, { color: palette.ink }]}>
          Limpio cannot see your photos yet.
        </Text>
        <Text style={[styles.primerBody, { color: palette.inkSecondary }]}>
          Open the Settings app, find Limpio in the list, tap Photos, and choose
          All Photos. Then come back here.
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
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.lg,
  },
  statusText: { fontSize: 15, flex: 1 },
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
