import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';

import { findGuide } from '@/lib/guides/content';
import { cardShadow, radius, space, stencil, usePalette } from '@/lib/ui/theme';

export default function GuideScreen() {
  const palette = usePalette();
  const { id } = useLocalSearchParams<{ id: string }>();
  const guide = findGuide(id);

  if (!guide) {
    return (
      <View style={[styles.screen, styles.missing, { backgroundColor: palette.panel }]}>
        <Text style={[styles.body, { color: palette.ink }]}>
          That guide is no longer here.
        </Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: guide.title }} />
      <ScrollView
        style={{ backgroundColor: palette.panel }}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic">
        <Text style={[styles.heading, { color: palette.ink }]}>{guide.title}</Text>

        <Text style={[styles.body, { color: palette.inkSecondary }]}>{guide.why}</Text>

        <View style={[styles.card, { backgroundColor: palette.card }, cardShadow]}>
          <Text style={[styles.cardTitle, { color: palette.inkSecondary }]}>
            Step by step
          </Text>

          {guide.steps.map((step, index) => (
            <View key={step} style={styles.step}>
              <View style={[styles.number, { borderColor: palette.amber }]}>
                <Text style={[styles.numberText, { color: palette.amber }]}>
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

        {guide.note ? (
          <View style={[styles.note, { borderColor: palette.rule }]}>
            <Text style={[styles.noteText, { color: palette.inkSecondary }]}>
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
