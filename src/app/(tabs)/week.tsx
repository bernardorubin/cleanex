import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MainBreaker } from '@/components/main-breaker';
import { PhotoGrid } from '@/components/photo-grid';
import { QuietLink } from '@/components/quiet-link';
import { SwipeDeck } from '@/components/swipe-deck';
import { confirmDelete, deleteAndMeasure } from '@/lib/scan/delete';
import { formatBytes } from '@/lib/scan/estimate';
import { useScan } from '@/lib/scan/use-scan';
import {
  isReminderScheduled,
  scheduleWeeklyReminder,
  cancelWeeklyReminder,
} from '@/lib/notify/weekly';
import { space, usePalette } from '@/lib/ui/theme';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default function WeekScreen() {
  const palette = usePalette();
  const { result, rescan } = useScan();
  const [mode, setMode] = useState<'grid' | 'swipe'>('grid');
  const [armed, setArmed] = useState<Set<string>>(new Set());
  const [reminderOn, setReminderOn] = useState(false);

  useEffect(() => {
    void isReminderScheduled().then(setReminderOn);
  }, []);

  const recent = useMemo(() => {
    if (!result) return [];
    const cutoff = Date.now() - WEEK_MS;
    return result.assets
      .filter((a) => a.createdAt >= cutoff && !a.isFavorite)
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [result]);

  const totalBytes = useMemo(
    () => recent.reduce((sum, a) => sum + a.sizeBytes, 0),
    [recent],
  );

  const armedBytes = useMemo(() => {
    const byId = new Map(recent.map((a) => [a.id, a.sizeBytes]));
    return [...armed].reduce((sum, id) => sum + (byId.get(id) ?? 0), 0);
  }, [recent, armed]);

  function toggle(id: string) {
    setArmed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runDelete() {
    const outcome = await deleteAndMeasure([...armed], armedBytes);
    if (outcome.status === 'done') {
      setArmed(new Set());
      await rescan();
    }
  }

  async function toggleReminder(next: boolean) {
    setReminderOn(next);
    if (next) await scheduleWeeklyReminder();
    else await cancelWeeklyReminder();
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.panel }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic">
        <Text style={[styles.title, { color: palette.ink }]}>This week</Text>

        {recent.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: palette.ink }]}>
              Nothing to clean up.
            </Text>
            <Text style={[styles.emptyBody, { color: palette.inkSecondary }]}>
              You did not add much this week, and it all looks worth keeping.
            </Text>
          </View>
        ) : (
          <>
            <Text style={[styles.lead, { color: palette.inkSecondary }]}>
              {recent.length} new {recent.length === 1 ? 'item' : 'items'} ·{' '}
              {formatBytes(totalBytes)}. Tap anything you do not want.
            </Text>

            {mode === 'grid' ? (
              <>
                <PhotoGrid assets={recent} armed={armed} onToggle={toggle} />
                <QuietLink label="Swipe through them instead" onPress={() => setMode('swipe')} />
              </>
            ) : (
              <>
                <SwipeDeck
                  assets={recent}
                  armed={armed}
                  onToggle={toggle}
                  onDone={() => setMode('grid')}
                />
                <QuietLink label="See them all at once instead" onPress={() => setMode('grid')} />
              </>
            )}

            {armed.size > 0 ? (
              <MainBreaker
                label={`Delete ${armed.size} · ${formatBytes(armedBytes)}`}
                onPress={() =>
                  confirmDelete(armed.size, formatBytes(armedBytes), runDelete)
                }
              />
            ) : null}
          </>
        )}

        <View style={[styles.reminder, { borderColor: palette.rule }]}>
          <View style={styles.reminderText}>
            <Text style={[styles.reminderTitle, { color: palette.ink }]}>
              Sunday reminder
            </Text>
            <Text style={[styles.reminderBody, { color: palette.inkSecondary }]}>
              A nudge each Sunday morning to look at the week&apos;s photos.
            </Text>
          </View>
          <Switch
            value={reminderOn}
            onValueChange={toggleReminder}
            trackColor={{ true: palette.amber }}
            accessibilityLabel="Sunday reminder"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: space.lg, paddingBottom: space.xxxl, gap: space.lg },
  title: { fontSize: 34, fontWeight: '700', letterSpacing: -0.5 },
  lead: { fontSize: 16, lineHeight: 22 },
  empty: { gap: space.sm, paddingVertical: space.xl },
  emptyTitle: { fontSize: 20, fontWeight: '600' },
  emptyBody: { fontSize: 15, lineHeight: 21 },
  reminder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: space.lg,
    marginTop: space.lg,
  },
  reminderText: { flex: 1, gap: 2 },
  reminderTitle: { fontSize: 16, fontWeight: '600' },
  reminderBody: { fontSize: 14, lineHeight: 19 },
});
