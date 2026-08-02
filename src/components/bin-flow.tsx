import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, StyleSheet, Text, View } from 'react-native';
import { Paths } from 'expo-file-system';

import {
  BIN_STEPS,
  BIN_STEPS_TITLE,
  NOTHING_IN_BIN_MESSAGE,
  binEmptiedMessage,
  binWaitingMessage,
} from '@/lib/transform/messages';
import { reportableGain } from '@/lib/storage/free-space';
import { space, stencil, usePalette } from '@/lib/ui/theme';

/**
 * What happens after anything goes to Recently Deleted — every delete and
 * every transform.
 *
 * PhotoKit cannot read Recently Deleted, cannot measure it and cannot empty
 * it, for this app or any other. So there is nothing here to automate: the
 * whole feature is written steps plus a measurement across the round trip,
 * the pattern already proven on the guide screen.
 *
 * There is deliberately no button that opens Photos. `photos-redirect://` is
 * undocumented and the build already carries one unreviewed private-ish API,
 * so a second raises the odds of a 2.5.1 rejection to save exactly one tap.
 * Decided, not pending.
 *
 * Renders no background of its own. Every host already has a surface — the
 * Clean tab's receipt, /browse's floating card, the transform screen's
 * result card — and a card inside a card is not how this panel is built.
 */
export function BinFlow({ bytes }: { bytes: number }) {
  const palette = usePalette();

  // Free space the moment the app went to the background. Null whenever
  // there is no trip in flight, so a return from an unrelated excursion —
  // answering a call, checking the weather — reports nothing.
  const freeBefore = useRef<number | null>(null);
  const [recovered, setRecovered] = useState<number | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        freeBefore.current = Paths.availableDiskSpace ?? 0;
        return;
      }
      if (state !== 'active' || freeBefore.current === null) return;

      const gain = reportableGain(freeBefore.current, Paths.availableDiskSpace ?? 0);
      freeBefore.current = null;
      if (gain === null) return;

      setRecovered(gain);
      // This line appears mid-scroll on returning from Photos, so VoiceOver
      // neither focuses it nor speaks it. Queued because it lands the same
      // frame as the app coming back to the foreground.
      AccessibilityInfo.announceForAccessibilityWithOptions(binEmptiedMessage(gain), {
        queue: true,
      });
    });

    return () => subscription.remove();
  }, []);

  const lead =
    recovered !== null
      ? binEmptiedMessage(recovered)
      : bytes > 0
        ? binWaitingMessage(bytes)
        : NOTHING_IN_BIN_MESSAGE;

  return (
    <View style={styles.block}>
      <Text style={[styles.lead, { color: palette.ink }]} maxFontSizeMultiplier={1.8}>
        {lead}
      </Text>

      {/* Once the space has actually come back, the steps are a chore the
          user has already done. */}
      {recovered === null && bytes > 0 ? (
        <>
          <Text
            style={[styles.title, { color: palette.inkSecondary }]}
            maxFontSizeMultiplier={1.6}>
            {BIN_STEPS_TITLE}
          </Text>

          {BIN_STEPS.map((step, index) => (
            <View key={step} style={styles.step}>
              <View style={[styles.number, { borderColor: palette.rule }]}>
                <Text
                  style={[styles.numberText, { color: palette.inkSecondary }]}
                  maxFontSizeMultiplier={1.4}>
                  {index + 1}
                </Text>
              </View>
              <Text
                style={[styles.stepText, { color: palette.ink }]}
                maxFontSizeMultiplier={1.8}>
                {step}
              </Text>
            </View>
          ))}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.md },
  lead: { fontSize: 15, lineHeight: 21 },
  title: { ...stencil, fontSize: 12, marginTop: space.xs },
  step: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  number: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  stepText: { flex: 1, fontSize: 15, lineHeight: 22, paddingTop: 2 },
});
