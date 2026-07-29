import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';

import { MainBreaker } from '@/components/main-breaker';
import { ScanInterlude } from '@/components/scan-interlude';
import { SwipeDeck } from '@/components/swipe-deck';
import { confirmDelete, deleteSelected } from '@/lib/scan/delete';
import { formatBytes } from '@/lib/scan/estimate';
import { useScanState } from '@/lib/scan/scan-context';
import { space, usePalette } from '@/lib/ui/theme';

/**
 * Judgement calls only — photos that look alike, where the app has an opinion
 * but not enough confidence to act on it. Anything we are sure about never
 * reaches this screen.
 */
export default function DeckScreen() {
  const palette = usePalette();
  const { result, rescan, phase, assetCount } = useScanState();
  const [armed, setArmed] = useState<Set<string>>(new Set());
  const [finished, setFinished] = useState(false);

  // Only these two phases carry a `result` produced by the run currently
  // reflected on disk. Any other one deals the user a swipe stack of photos
  // they have already deleted.
  const dataIsFresh = phase === 'refining' || phase === 'ready';
  const fresh = dataIsFresh && result !== null ? result : null;

  const candidates = useMemo(() => {
    if (!fresh) return [];
    const ids = new Set(fresh.perCategory.similarPhotos.assetIds);
    return fresh.assets.filter((a) => ids.has(a.id));
  }, [fresh]);

  const bytes = useMemo(() => {
    const byId = new Map(candidates.map((a) => [a.id, a.sizeBytes]));
    return [...armed].reduce((sum, id) => sum + (byId.get(id) ?? 0), 0);
  }, [candidates, armed]);

  function toggle(id: string) {
    setArmed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runDelete() {
    const outcome = await deleteSelected([...armed]);
    if (outcome.status === 'done') {
      await rescan();
      router.back();
    }
  }

  if (!fresh) {
    // Never `null`. A blank pushed screen is a dead end, and the user arrived
    // here from a button they pressed deliberately.
    return (
      <ScrollView
        style={{ backgroundColor: palette.panel }}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic">
        <ScanInterlude
          phase={phase}
          assetCount={assetCount}
          onRetry={() => void rescan()}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: palette.panel }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic">
      <Text
        style={[styles.lead, { color: palette.inkSecondary }]}
        maxFontSizeMultiplier={1.8}>
        These look like near-copies of each other. We kept the best one of each
        set — the rest are up to you.
      </Text>

      <SwipeDeck
        assets={candidates}
        armed={armed}
        onToggle={toggle}
        onDone={() => setFinished(true)}
      />

      {armed.size > 0 ? (
        <MainBreaker
          label={`Delete ${armed.size} · ${formatBytes(bytes)}`}
          onPress={() => confirmDelete(armed.size, formatBytes(bytes), runDelete)}
        />
      ) : finished ? (
        <Text
          style={[styles.lead, { color: palette.inkSecondary }]}
          maxFontSizeMultiplier={1.8}>
          You kept all of them. Nothing to delete.
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxxl, gap: space.lg },
  lead: { fontSize: 16, lineHeight: 23 },
});
