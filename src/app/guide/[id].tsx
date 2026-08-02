import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  AppState,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Paths } from 'expo-file-system';

import { MainBreaker } from '@/components/main-breaker';
import { findGuide } from '@/lib/guides/content';
import { guideFreedMessage } from '@/lib/scan/messages';
import { reportableGain } from '@/lib/storage/free-space';
import { cardShadow, radius, space, stencil, usePalette } from '@/lib/ui/theme';

export default function GuideScreen() {
  const palette = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const guide = findGuide(id);

  const freeBefore = useRef<number | null>(null);
  const [recovered, setRecovered] = useState<number | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || freeBefore.current === null) return;

      // The same noise floor the bin flow measures against, in one place so
      // the two cannot disagree about what counts as a real gain.
      const delta = reportableGain(freeBefore.current, Paths.availableDiskSpace ?? 0);
      freeBefore.current = null;
      if (delta === null) return;

      setRecovered(delta);
      // This line appears mid-scroll on returning from another app, so
      // VoiceOver neither focuses it nor speaks it. Queued because it lands
      // the same frame as the app coming back to the foreground.
      AccessibilityInfo.announceForAccessibilityWithOptions(
        guideFreedMessage(delta),
        { queue: true },
      );
    });

    return () => subscription.remove();
  }, []);

  async function openApp(scheme: string, appName: string) {
    // A second trip that frees nothing must not leave the first trip's figure
    // on screen as though it were this one's result.
    setRecovered(null);
    freeBefore.current = Paths.availableDiskSpace ?? 0;
    try {
      await Linking.openURL(scheme);
    } catch {
      // The app is not on this phone. Tapping the largest control on the
      // screen and getting no response at all is the failure this avoids.
      freeBefore.current = null;
      Alert.alert(
        `${appName} is not on this phone`,
        `Nothing is wrong. This guide only helps if you use ${appName}, so there is nothing here you need to do.`,
      );
    }
  }

  if (!guide) {
    return (
      <View style={[styles.screen, styles.missing, { backgroundColor: palette.panel }]}>
        <Text style={[styles.body, { color: palette.ink }]} maxFontSizeMultiplier={2}>
          That guide is no longer here.
        </Text>
      </View>
    );
  }

  const scheme = guide.appScheme;
  const appName = guide.appName;

  return (
    <>
      <Stack.Screen options={{ title: guide.title }} />
      <ScrollView
        style={{ backgroundColor: palette.panel }}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic">
        <Text
          style={[styles.heading, { color: palette.ink }]}
          maxFontSizeMultiplier={1.8}>
          {guide.title}
        </Text>

        <Text
          style={[styles.body, { color: palette.inkSecondary }]}
          maxFontSizeMultiplier={2}>
          {guide.why}
        </Text>

        <View style={[styles.card, { backgroundColor: palette.card }, cardShadow]}>
          <Text
            style={[styles.cardTitle, { color: palette.inkSecondary }]}
            maxFontSizeMultiplier={1.8}>
            Step by step
          </Text>

          {guide.steps.map((step, index) => (
            <View key={step} style={styles.step}>
              <View style={[styles.number, { borderColor: palette.amber }]}>
                <Text
                  style={[styles.numberText, { color: palette.amber }]}
                  maxFontSizeMultiplier={1.4}>
                  {index + 1}
                </Text>
              </View>
              <Text
                style={[styles.stepText, { color: palette.ink }]}
                maxFontSizeMultiplier={2}>
                {step}
              </Text>
            </View>
          ))}
        </View>

        {recovered !== null ? (
          <View style={[styles.note, { borderColor: palette.rule }]}>
            <Text
              style={[styles.body, { color: palette.ink }]}
              maxFontSizeMultiplier={2}>
              {guideFreedMessage(recovered)}
            </Text>
          </View>
        ) : null}

        {scheme && appName && guide.openLabel ? (
          <MainBreaker
            label={guide.openLabel}
            onPress={() => void openApp(scheme, appName)}
          />
        ) : null}

        {guide.note ? (
          <View style={[styles.note, { borderColor: palette.rule }]}>
            <Text
              style={[styles.noteText, { color: palette.inkSecondary }]}
              maxFontSizeMultiplier={2}>
              {guide.note}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  missing: { padding: space.xl, justifyContent: 'center' },
  content: { padding: space.lg, paddingBottom: space.xxxl, gap: space.lg },
  heading: { fontSize: 28, fontWeight: '700', letterSpacing: -0.4, lineHeight: 34 },
  body: { fontSize: 16, lineHeight: 24 },
  card: { borderRadius: radius.card, padding: space.lg, gap: space.lg },
  cardTitle: { ...stencil, fontSize: 12 },
  step: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  number: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberText: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  stepText: { flex: 1, fontSize: 16, lineHeight: 24, paddingTop: 2 },
  note: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: space.lg,
  },
  noteText: { fontSize: 15, lineHeight: 22 },
});
