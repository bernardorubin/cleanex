import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GUIDES } from '@/lib/guides/content';
import { cardShadow, radius, space, stencil, usePalette } from '@/lib/ui/theme';

export default function GuidesScreen() {
  const palette = usePalette();

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.panel }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic">
        <Text style={[styles.title, { color: palette.ink }]}>Guides</Text>

        <Text style={[styles.lead, { color: palette.inkSecondary }]}>
          Some space is locked away where no app is allowed to reach — not
          Make Room, not any other. Here is exactly how to get it back yourself.
        </Text>

        <View style={[styles.card, { backgroundColor: palette.card }, cardShadow]}>
          {GUIDES.map((guide, index) => (
            <View key={guide.id}>
              {index > 0 ? (
                <View style={[styles.rule, { backgroundColor: palette.rule }]} />
              ) : null}
              <Pressable
                onPress={() => router.push(`/guide/${guide.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`${guide.title}. ${guide.blurb}`}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
                <View style={styles.rowText}>
                  <Text
                    style={[styles.rowTitle, { color: palette.ink }]}
                    maxFontSizeMultiplier={1.8}>
                    {guide.title}
                  </Text>
                  <Text
                    style={[styles.rowBlurb, { color: palette.inkSecondary }]}
                    maxFontSizeMultiplier={1.8}>
                    {guide.blurb}
                  </Text>
                </View>
                <Text style={[styles.chevron, { color: palette.inkSecondary }]}>›</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: space.lg, paddingBottom: space.xxxl, gap: space.lg },
  title: { fontSize: 34, fontWeight: '700', letterSpacing: -0.5 },
  lead: { fontSize: 16, lineHeight: 23 },
  card: { borderRadius: radius.card, paddingVertical: space.xs },
  rule: { height: StyleSheet.hairlineWidth, marginLeft: space.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: 60,
    gap: space.md,
  },
  rowText: { flex: 1, gap: 3 },
  rowTitle: { ...stencil, fontSize: 15 },
  rowBlurb: { fontSize: 15, lineHeight: 20 },
  chevron: { fontSize: 24, opacity: 0.5 },
});
