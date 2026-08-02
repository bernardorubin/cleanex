import {
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { cancelTransform, compressVideo, flattenLivePhotos } from '@modules/photo-scan';

import { BinFlow } from '@/components/bin-flow';
import { MainBreaker } from '@/components/main-breaker';
import { ScanInterlude } from '@/components/scan-interlude';
import { useScanState } from '@/lib/scan/scan-context';
import type { AssetFact } from '@/lib/scan/types';
import {
  DEFAULT_QUALITY,
  compressibleVideos,
  estimateLivePhotoSaving,
  estimateSaving,
  livePhotoCandidates,
  type Quality,
} from '@/lib/transform/candidates';
import {
  COMPRESSION_FAILED_MESSAGE,
  COMPRESSION_SECTION_TITLE,
  LIVE_PHOTO_CONVERSION_FAILED_MESSAGE,
  LIVE_PHOTO_SECTION_TITLE,
  NO_LIVE_PHOTOS_TO_CONVERT_MESSAGE,
  NO_VIDEOS_TO_COMPRESS_MESSAGE,
  QUALITY_DESCRIPTIONS,
  QUALITY_LABELS,
  STOP_TRANSFORM_LABEL,
  TRANSFORMS_LEAD,
  TRANSFORM_STOPPED_MESSAGE,
  compressionButtonLabel,
  compressionConfirmBody,
  compressionConfirmTitle,
  compressionEstimateMessage,
  compressionProgressMessage,
  compressionResultMessage,
  livePhotoButtonLabel,
  livePhotoConfirmBody,
  livePhotoConfirmTitle,
  livePhotoEstimateMessage,
  livePhotoProgressMessage,
  livePhotoResultMessage,
} from '@/lib/transform/messages';
import { cardShadow, radius, space, stencil, usePalette } from '@/lib/ui/theme';

/**
 * Two independent ways to make something smaller instead of deleting it.
 *
 * Both replace the original: PhotoKit has no way to rewrite an asset's data,
 * so every transform creates a new asset and deletes the old one. That makes
 * this the only irreversible surface in the app — safety rule 6 — and the
 * only one whose payoff arrives thirty days late, because the original it
 * replaced is sitting in Recently Deleted the whole time.
 */
type RunState =
  | { status: 'idle' }
  /** `message` is which item of how many; there is no percentage to give. */
  | { status: 'running'; message: string; stopping: boolean }
  /** `binBytes` is what the run put into Recently Deleted, measured. */
  | { status: 'done'; message: string; binBytes: number };

const IDLE: RunState = { status: 'idle' };

/**
 * Two consecutive refusals end a run.
 *
 * Native cannot tell "this asset could not be fetched" apart from "the user
 * dismissed the system delete sheet" — both come back as `ok: false`. Pushing
 * on through the first is right, because one unreachable video should not
 * abandon the other nineteen. Pushing on through the second is how someone
 * who just said no gets asked eighteen more times.
 */
const MAX_CONSECUTIVE_FAILURES = 2;

export default function TransformsScreen() {
  const palette = usePalette();
  const { result, phase, assetCount, rescan } = useScanState();

  const [quality, setQuality] = useState<Quality>(DEFAULT_QUALITY);
  const [compression, setCompression] = useState<RunState>(IDLE);
  const [livePhotos, setLivePhotos] = useState<RunState>(IDLE);

  // Read inside the loops, so it must not wait for a render to take effect.
  const stopped = useRef(false);

  // Same gate as every other screen that renders scan data: only these two
  // phases carry a result produced by the run currently reflected on disk.
  // Every transform ends in a rescan, and during it the old result still
  // lists assets that are now in Recently Deleted.
  const dataIsFresh = phase === 'refining' || phase === 'ready';
  const fresh = dataIsFresh && result !== null ? result : null;

  const videos = useMemo(() => (fresh ? compressibleVideos(fresh.assets) : []), [fresh]);
  const lives = useMemo(() => (fresh ? livePhotoCandidates(fresh.assets) : []), [fresh]);

  const videoSaving = useMemo(() => estimateSaving(videos, quality), [videos, quality]);
  const liveSaving = useMemo(() => estimateLivePhotoSaving(lives), [lives]);

  // One transform at a time: each raises its own system delete sheet, and
  // overlapping calls resolve `ok: false` natively.
  const busy = compression.status === 'running' || livePhotos.status === 'running';

  function stop(setRun: Dispatch<SetStateAction<RunState>>) {
    // The loops read the ref, not state — a stop that waits for a render is
    // a stop that lets one more encode start.
    stopped.current = true;
    setRun((current) =>
      current.status === 'running' ? { ...current, stopping: true } : current,
    );
    void cancelTransform();
  }

  async function runCompression(list: AssetFact[]) {
    stopped.current = false;
    setCompression({
      status: 'running',
      message: compressionProgressMessage(1, list.length),
      stopping: false,
    });

    let oldBytes = 0;
    let newBytes = 0;
    let done = 0;
    let failures = 0;

    for (const [index, video] of list.entries()) {
      if (stopped.current) break;
      setCompression({
        status: 'running',
        message: compressionProgressMessage(index + 1, list.length),
        stopping: false,
      });

      const outcome = await compressVideo(video.id, quality);
      if (outcome.ok) {
        oldBytes += outcome.oldBytes;
        newBytes += outcome.newBytes;
        done += 1;
        failures = 0;
      } else {
        failures += 1;
        if (failures >= MAX_CONSECUTIVE_FAILURES) break;
      }
    }

    // Safety rule 8: the figure shown now comes from real file sizes, never
    // from the estimate the confirmation quoted.
    setCompression({
      status: 'done',
      message:
        done > 0
          ? compressionResultMessage(done, oldBytes, newBytes)
          : stopped.current
            ? TRANSFORM_STOPPED_MESSAGE
            : COMPRESSION_FAILED_MESSAGE,
      binBytes: oldBytes,
    });
    stopped.current = false;
    await rescan();
  }

  async function runLivePhotos(list: AssetFact[]) {
    stopped.current = false;
    const total = list.length;
    setLivePhotos({
      status: 'running',
      message: livePhotoProgressMessage(0, total),
      stopping: false,
    });

    let remaining = list.map((asset) => asset.id);
    let oldBytes = 0;
    let newBytes = 0;
    let done = 0;

    // One call is one system confirmation sheet, but not necessarily every
    // id: each still is staged to disk first and that staging is capped, so
    // a large library comes back as `skippedIds` and finishes over several
    // passes. A pass that converted nothing means the user dismissed the
    // sheet — going round again would just show it to them a second time.
    while (remaining.length > 0 && !stopped.current) {
      const outcome = await flattenLivePhotos(remaining);
      oldBytes += outcome.oldBytes;
      newBytes += outcome.newBytes;
      done += outcome.convertedCount;
      setLivePhotos({
        status: 'running',
        message: livePhotoProgressMessage(done, total),
        // A pass can land after Stop was pressed; the button must not flicker
        // back to enabled while the loop is on its way out.
        stopping: stopped.current,
      });
      if (outcome.convertedCount === 0) break;
      remaining = outcome.skippedIds;
    }

    setLivePhotos({
      status: 'done',
      message:
        done > 0
          ? livePhotoResultMessage(done, oldBytes, newBytes)
          : stopped.current
            ? TRANSFORM_STOPPED_MESSAGE
            : LIVE_PHOTO_CONVERSION_FAILED_MESSAGE,
      binBytes: oldBytes,
    });
    stopped.current = false;
    await rescan();
  }

  function askToCompress() {
    Alert.alert(
      compressionConfirmTitle(videos.length),
      compressionConfirmBody(videos.length, videoSaving),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: compressionButtonLabel(videos.length),
          style: 'destructive',
          onPress: () => void runCompression(videos),
        },
      ],
    );
  }

  function askToConvert() {
    Alert.alert(
      livePhotoConfirmTitle(lives.length),
      livePhotoConfirmBody(lives.length, liveSaving),
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: livePhotoButtonLabel(lives.length),
          style: 'destructive',
          onPress: () => void runLivePhotos(lives),
        },
      ],
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: palette.panel }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic">
      <Text style={[styles.lead, { color: palette.inkSecondary }]} maxFontSizeMultiplier={1.8}>
        {TRANSFORMS_LEAD}
      </Text>

      {/* Outside the freshness gate on purpose: every run ends in a rescan,
          and the result of what the user just did must not vanish while it
          runs. */}
      <Outcome run={compression} />
      <Outcome run={livePhotos} />

      {fresh === null ? (
        <ScanInterlude phase={phase} assetCount={assetCount} onRetry={() => void rescan()} />
      ) : (
        <>
          <Section title={COMPRESSION_SECTION_TITLE}>
            {videos.length === 0 ? (
              <Text
                style={[styles.body, { color: palette.inkSecondary }]}
                maxFontSizeMultiplier={1.8}>
                {NO_VIDEOS_TO_COMPRESS_MESSAGE}
              </Text>
            ) : (
              <>
                <Text
                  style={[styles.body, { color: palette.ink }]}
                  maxFontSizeMultiplier={1.8}>
                  {compressionEstimateMessage(videos.length, videoSaving)}
                </Text>

                <QualityChoice value={quality} onChange={setQuality} disabled={busy} />

                {compression.status === 'running' ? (
                  <Progress
                    message={compression.message}
                    stopping={compression.stopping}
                    onStop={() => stop(setCompression)}
                  />
                ) : (
                  <MainBreaker
                    label={compressionButtonLabel(videos.length)}
                    disabled={busy}
                    onPress={askToCompress}
                  />
                )}
              </>
            )}
          </Section>

          <Section title={LIVE_PHOTO_SECTION_TITLE}>
            {lives.length === 0 ? (
              <Text
                style={[styles.body, { color: palette.inkSecondary }]}
                maxFontSizeMultiplier={1.8}>
                {NO_LIVE_PHOTOS_TO_CONVERT_MESSAGE}
              </Text>
            ) : (
              <>
                <Text
                  style={[styles.body, { color: palette.ink }]}
                  maxFontSizeMultiplier={1.8}>
                  {livePhotoEstimateMessage(lives.length, liveSaving)}
                </Text>

                {livePhotos.status === 'running' ? (
                  <Progress
                    message={livePhotos.message}
                    stopping={livePhotos.stopping}
                    onStop={() => stop(setLivePhotos)}
                  />
                ) : (
                  <MainBreaker
                    label={livePhotoButtonLabel(lives.length)}
                    disabled={busy}
                    onPress={askToConvert}
                  />
                )}
              </>
            )}
          </Section>
        </>
      )}
    </ScrollView>
  );
}

/** A printed heading over a card, the way the directory is titled. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  const palette = usePalette();
  return (
    <View style={[styles.card, { backgroundColor: palette.card }, cardShadow]}>
      <Text
        style={[styles.cardTitle, { color: palette.inkSecondary }]}
        maxFontSizeMultiplier={1.6}>
        {title}
      </Text>
      {children}
    </View>
  );
}

/**
 * The measured result, plus the way to actually get the space.
 *
 * `binBytes` is what this run put into Recently Deleted. Zero means nothing
 * was replaced — a stopped or refused run — and there is nothing honest to
 * say about a bin this app is not allowed to read.
 */
function Outcome({ run }: { run: RunState }) {
  const palette = usePalette();
  if (run.status !== 'done') return null;

  return (
    <View style={[styles.card, { backgroundColor: palette.card }, cardShadow]}>
      <Text style={[styles.body, { color: palette.ink }]} maxFontSizeMultiplier={1.8}>
        {run.message}
      </Text>
      {run.binBytes > 0 ? <BinFlow bytes={run.binBytes} /> : null}
    </View>
  );
}

/**
 * Honest progress. Nothing native reports how far through an encode it is —
 * there are no progress events at all — so this is an indeterminate spinner
 * and a count of items. A percentage would have to be invented, and an
 * invented bar that sits still for four minutes reads as a broken app.
 */
function Progress({
  message,
  stopping,
  onStop,
}: {
  message: string;
  stopping: boolean;
  onStop: () => void;
}) {
  const palette = usePalette();

  return (
    <View style={styles.progress}>
      <View style={styles.progressRow}>
        <ActivityIndicator color={palette.ink} />
        <Text
          style={[styles.body, styles.progressText, { color: palette.ink }]}
          maxFontSizeMultiplier={1.8}>
          {message}
        </Text>
      </View>

      {/* Required, not optional: an encode may be minutes of a hot phone, or
          an iCloud download PhotoKit puts no timeout on. */}
      <Pressable
        onPress={onStop}
        disabled={stopping}
        accessibilityRole="button"
        accessibilityLabel={STOP_TRANSFORM_LABEL}
        accessibilityState={{ disabled: stopping }}
        style={({ pressed }) => [
          styles.stop,
          { borderColor: palette.rule },
          pressed && { opacity: 0.5 },
        ]}>
        <Text
          style={[
            styles.stopText,
            { color: stopping ? palette.inkSecondary : palette.ink },
          ]}
          maxFontSizeMultiplier={1.6}>
          {STOP_TRANSFORM_LABEL}
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * Three named outcomes, one of them already chosen.
 *
 * Not the directory's amber flag: amber means armed for deletion and nothing
 * else, and picking a quality arms nothing. A filled ring is the plainest
 * "this one" there is.
 */
function QualityChoice({
  value,
  onChange,
  disabled,
}: {
  value: Quality;
  onChange: (quality: Quality) => void;
  disabled: boolean;
}) {
  const palette = usePalette();
  const qualities: Quality[] = ['sharp', 'phone', 'smallest'];

  return (
    <View>
      {qualities.map((quality, index) => {
        const selected = quality === value;
        return (
          <View key={quality}>
            {index > 0 ? (
              <View style={[styles.rule, { backgroundColor: palette.rule }]} />
            ) : null}
            <Pressable
              onPress={() => onChange(quality)}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled }}
              accessibilityLabel={`${QUALITY_LABELS[quality]}. ${QUALITY_DESCRIPTIONS[quality]}`}
              style={({ pressed }) => [styles.quality, pressed && { opacity: 0.6 }]}>
              <View
                style={[
                  styles.ring,
                  { borderColor: selected ? palette.ink : palette.rule },
                ]}>
                {selected ? (
                  <View style={[styles.dot, { backgroundColor: palette.ink }]} />
                ) : null}
              </View>

              <View style={styles.qualityText}>
                <Text
                  style={[
                    styles.qualityLabel,
                    { color: disabled ? palette.inkSecondary : palette.ink },
                    selected && styles.qualityLabelSelected,
                  ]}
                  maxFontSizeMultiplier={1.8}>
                  {QUALITY_LABELS[quality]}
                </Text>
                <Text
                  style={[styles.qualityDetail, { color: palette.inkSecondary }]}
                  maxFontSizeMultiplier={1.8}>
                  {QUALITY_DESCRIPTIONS[quality]}
                </Text>
              </View>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxxl, gap: space.lg },
  lead: { fontSize: 16, lineHeight: 23 },
  card: {
    borderRadius: radius.card,
    padding: space.lg,
    gap: space.md,
  },
  cardTitle: { ...stencil, fontSize: 12 },
  body: { fontSize: 16, lineHeight: 23 },
  rule: { height: StyleSheet.hairlineWidth },
  quality: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    minHeight: 56,
  },
  ring: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  qualityText: { flex: 1, gap: 2 },
  qualityLabel: { fontSize: 16 },
  qualityLabelSelected: { fontWeight: '600' },
  qualityDetail: { fontSize: 14, lineHeight: 19 },
  progress: { gap: space.md },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  progressText: { flexShrink: 1 },
  stop: {
    minHeight: 44,
    borderRadius: radius.plate,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  // Sentence case, not the breaker's stencil: uppercase is confined to
  // directory labels and the main breaker, and this is neither.
  stopText: { fontSize: 16, fontWeight: '600' },
});
