import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { MainBreaker } from '@/components/main-breaker';
import { PhotoGrid } from '@/components/photo-grid';
import { confirmDelete, deleteAndMeasure } from '@/lib/scan/delete';
import { formatBytes } from '@/lib/scan/estimate';
import { useScanState } from '@/lib/scan/scan-context';
import { CATEGORY_LABELS, type CategoryId } from '@/lib/scan/types';
import { space, stencil, usePalette } from '@/lib/ui/theme';

/**
 * The trust escape hatch: everything pre-ticked, individually untickable.
 * Most people open it once, see it is sensible, and never come back — its
 * existence is why they press the main button at all.
 */
export default function ReviewScreen() {
  const palette = usePalette();
  const { result, rescan } = useScanState();

  const allDeletable = useMemo(
    () => (result ? [...result.deletableIds] : []),
    [result],
  );
  const [armed, setArmed] = useState<Set<string> | null>(null);
  const selection = armed ?? new Set(allDeletable);

  const byCategory = useMemo(() => {
    if (!result) return [];
    return (Object.keys(CATEGORY_LABELS) as CategoryId[])
      .map((id) => ({
        id,
        label: CATEGORY_LABELS[id],
        assets: result.perCategory[id].assetIds
          .map((assetId) => result.assets.find((a) => a.id === assetId))
          .filter((a): a is NonNullable<typeof a> => a !== undefined),
      }))
      .filter((group) => group.assets.length > 0);
  }, [result]);

  const bytes = useMemo(() => {
    if (!result) return 0;
    const byId = new Map(result.assets.map((a) => [a.id, a.sizeBytes]));
    return [...selection].reduce((sum, id) => sum + (byId.get(id) ?? 0), 0);
  }, [result, selection]);

  function toggle(id: string) {
    setArmed(() => {
      const next = new Set(selection);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runDelete() {
    const outcome = await deleteAndMeasure([...selection], bytes);
    if (outcome.status === 'done') {
      await rescan();
      router.back();
    }
  }

  if (!result) return null;

  return (
    <ScrollView
      style={{ backgroundColor: palette.panel }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic">
      <Text style={[styles.lead, { color: palette.inkSecondary }]}>
        Everything here is ticked and ready to go. Tap anything you want to keep.
      </Text>

      {byCategory.map((group) => (
        <View key={group.id} style={styles.group}>
          <Text style={[styles.groupTitle, { color: palette.inkSecondary }]}>
            {group.label} · {group.assets.length}
          </Text>
          <PhotoGrid assets={group.assets} armed={selection} onToggle={toggle} />
        </View>
      ))}

      <MainBreaker
        label={`Delete ${selection.size} · ${formatBytes(bytes)}`}
        disabled={selection.size === 0}
        onPress={() => confirmDelete(selection.size, formatBytes(bytes), runDelete)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxxl, gap: space.xl },
  lead: { fontSize: 16, lineHeight: 23 },
  group: { gap: space.md },
  groupTitle: { ...stencil, fontSize: 12 },
});
