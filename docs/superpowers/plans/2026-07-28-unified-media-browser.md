# Unified Media Browser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the user one screen showing every photo and video on the device, largest first, with thumbnails, video playback, and one-action delete — plus an honest accounting of the storage the app cannot reach.

**Architecture:** All new logic that can be pure is pure and lives in `src/lib/`, tested by jest with no device. The grid is a `FlatList` over pre-chunked rows so `getItemLayout` is exact. One new Swift function presents the system video player. No new dependencies.

**Tech Stack:** Expo SDK 57, React Native 0.86, TypeScript 6 (strict), expo-router, expo-image, jest + ts-jest, Swift with ExpoModulesCore / Photos / AVKit.

**Spec:** `docs/superpowers/specs/2026-07-28-unified-media-browser.md`

## Global Constraints

Every task's requirements implicitly include this section.

- **No new dependencies.** `FlatList` (React Native built-in) instead of FlashList; native `AVPlayerViewController` instead of `expo-video`. If a task seems to need a package, stop and ask.
- **iOS only, deployment target 17.0.** No Android or web code paths.
- **No network calls of any kind** from app code. (One documented exception in Task 6 — the system fetching the user's own iCloud video for playback.)
- **Colours come from `usePalette()` in `src/lib/ui/theme.ts`.** Never a hex literal in a component.
- **`palette.amber` means armed for deletion and nothing else.** It never decorates.
- **Sizes shown to the user go through `formatBytes()`** from `src/lib/scan/estimate.ts`. Never raw bytes.
- **Type sizing convention:** numeric `fontSize` plus `maxFontSizeMultiplier` on every `Text`, matching every existing component. Do not introduce a new scaling approach.
- **Spacing uses the `space` scale** from `theme.ts`. No arbitrary numbers.
- **Minimum 44×44pt touch targets.**
- **Tests:** `pnpm test`. Jest is configured with `roots: ['<rootDir>/src']` and `testMatch: ['**/__tests__/**/*.test.ts']` — **`.ts` only, not `.tsx`**, so components are not unit-testable under the current config. Do not add a component test runner.
- **Types:** `pnpm typecheck` must be clean. `strict: true`. No `any`, no `@ts-ignore`, no `eslint-disable`.
- **Imports:** `@/*` → `src/*`, `@modules/*` → `modules/*`.
- **Commit messages:** imperative mood, single lead line, no body, no bullets, **no AI attribution or Co-Authored-By lines**.
- **Never run** `eas submit`, `eas update`, or any publish command.

---

## File Structure

**Create:**

| File | Responsibility |
|---|---|
| `src/lib/scan/browse.ts` | Pure browser logic: size sort, row chunking, favourite counting, duration formatting |
| `src/lib/scan/__tests__/browse.test.ts` | Tests for the above |
| `src/lib/storage/breakdown.ts` | Pure: the "apps and everything else" figure and its suppression rule |
| `src/lib/storage/__tests__/breakdown.test.ts` | Tests for the above |
| `src/components/media-browser-grid.tsx` | Virtualized grid of all media |
| `src/components/selection-footer.tsx` | Floating selection bar with the main breaker |
| `src/lib/scan/scan-context.tsx` | One scan shared by every screen |
| `src/app/browse.tsx` | The unified browser screen |

**Modify:**

| File | Change |
|---|---|
| `modules/photo-scan/ios/PhotoScanModule.swift` | Add `playVideo`; fix the incorrect WhatsApp filename comment |
| `modules/photo-scan/src/PhotoScan.ts` | Add the `playVideo` binding |
| `modules/photo-scan/index.ts` | Re-export `playVideo` |
| `src/app/_layout.tsx` | Wrap in `ScanProvider`; register the `browse` screen |
| `src/app/review.tsx`, `src/app/deck.tsx`, `src/app/(tabs)/week.tsx` | Switch to the shared scan state |
| `src/lib/scan/delete.ts` | `confirmDelete` gains an optional note |
| `src/app/(tabs)/index.tsx` | Relabel the review link; add the browse link |
| `src/components/nameplate.tsx` | Second reading: "Apps and everything else" |
| `src/lib/guides/content.ts` | Guide gains `appScheme`; WhatsApp copy gains the stored-twice paragraph |
| `src/app/guide/[id].tsx` | One-tap open + before/after free space measurement |
| `app.json` | `LSApplicationQueriesSchemes: ["whatsapp"]` |

**Not modified:** `src/app/review.tsx` keeps its current job — the trust escape hatch for the breaker's own selection. See spec §7.

---

### Task 1: Pure browser logic

**Files:**
- Create: `src/lib/scan/browse.ts`
- Test: `src/lib/scan/__tests__/browse.test.ts`

**Interfaces:**
- Consumes: `AssetFact` from `@/lib/scan/types`; `asset()` fixture from `@/lib/scan/__tests__/fixtures`
- Produces:
  - `sortBySizeDesc(assets: AssetFact[]): AssetFact[]`
  - `chunkIntoRows<T>(items: T[], columns: number): T[][]`
  - `countFavourites(assets: AssetFact[], ids: Set<string>): number`
  - `formatDuration(seconds: number): string`

- [ ] **Step 1: Write the failing test**

Create `src/lib/scan/__tests__/browse.test.ts`:

```ts
import {
  chunkIntoRows,
  countFavourites,
  formatDuration,
  sortBySizeDesc,
} from '@/lib/scan/browse';
import { asset } from '@/lib/scan/__tests__/fixtures';

describe('sortBySizeDesc', () => {
  it('puts the largest asset first', () => {
    const input = [
      asset({ id: 'small', sizeBytes: 1_000 }),
      asset({ id: 'huge', sizeBytes: 400_000_000 }),
      asset({ id: 'medium', sizeBytes: 5_000_000 }),
    ];
    expect(sortBySizeDesc(input).map((a) => a.id)).toEqual([
      'huge',
      'medium',
      'small',
    ]);
  });

  it('keeps equal sizes in their original order', () => {
    const input = [
      asset({ id: 'first', sizeBytes: 1_000 }),
      asset({ id: 'second', sizeBytes: 1_000 }),
      asset({ id: 'third', sizeBytes: 1_000 }),
    ];
    expect(sortBySizeDesc(input).map((a) => a.id)).toEqual([
      'first',
      'second',
      'third',
    ]);
  });

  it('does not mutate the input array', () => {
    const input = [
      asset({ id: 'small', sizeBytes: 1_000 }),
      asset({ id: 'big', sizeBytes: 9_000 }),
    ];
    sortBySizeDesc(input);
    expect(input.map((a) => a.id)).toEqual(['small', 'big']);
  });

  it('sorts zero-byte assets last rather than dropping them', () => {
    const input = [
      asset({ id: 'zero', sizeBytes: 0 }),
      asset({ id: 'one', sizeBytes: 1 }),
    ];
    expect(sortBySizeDesc(input).map((a) => a.id)).toEqual(['one', 'zero']);
  });
});

describe('chunkIntoRows', () => {
  it('splits into rows of the given width', () => {
    expect(chunkIntoRows([1, 2, 3, 4, 5, 6], 3)).toEqual([
      [1, 2, 3],
      [4, 5, 6],
    ]);
  });

  it('leaves the final row short rather than padding it', () => {
    expect(chunkIntoRows([1, 2, 3, 4], 3)).toEqual([[1, 2, 3], [4]]);
  });

  it('returns no rows for an empty list', () => {
    expect(chunkIntoRows([], 3)).toEqual([]);
  });
});

describe('countFavourites', () => {
  it('counts only selected favourites', () => {
    const assets = [
      asset({ id: 'a', isFavorite: true }),
      asset({ id: 'b', isFavorite: true }),
      asset({ id: 'c', isFavorite: false }),
    ];
    expect(countFavourites(assets, new Set(['a', 'c']))).toBe(1);
  });

  it('returns zero when nothing is selected', () => {
    const assets = [asset({ id: 'a', isFavorite: true })];
    expect(countFavourites(assets, new Set())).toBe(0);
  });

  it('counts every favourite when all are selected', () => {
    const assets = [
      asset({ id: 'a', isFavorite: true }),
      asset({ id: 'b', isFavorite: true }),
    ];
    expect(countFavourites(assets, new Set(['a', 'b']))).toBe(2);
  });
});

describe('formatDuration', () => {
  it('formats under a minute with a leading zero minute', () => {
    expect(formatDuration(9)).toBe('0:09');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(125)).toBe('2:05');
  });

  it('formats past an hour without an hours field', () => {
    expect(formatDuration(3661)).toBe('61:01');
  });

  it('rounds fractional seconds down', () => {
    expect(formatDuration(9.8)).toBe('0:09');
  });

  it('treats zero and negatives as 0:00', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(-5)).toBe('0:00');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test browse`
Expected: FAIL — `Cannot find module '@/lib/scan/browse'`

- [ ] **Step 3: Write the implementation**

Create `src/lib/scan/browse.ts`:

```ts
import type { AssetFact } from '@/lib/scan/types';

/**
 * Largest first — the whole point of the browser screen. Sorted on a copy so
 * callers can keep holding the scan result's own array.
 *
 * Array.prototype.sort is stable in every engine we target, so equal sizes keep
 * library order rather than shuffling between renders.
 */
export function sortBySizeDesc(assets: AssetFact[]): AssetFact[] {
  return [...assets].sort((a, b) => b.sizeBytes - a.sizeBytes);
}

/**
 * Pre-chunking into rows lets the grid be a FlatList of rows rather than of
 * cells. That is what makes getItemLayout exact: a row is always one fixed
 * height, whereas FlatList's own numColumns handling does not give reliable
 * offsets for a library this size.
 */
export function chunkIntoRows<T>(items: T[], columns: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns));
  }
  return rows;
}

/**
 * Favourites are selectable here — this screen recommends nothing, the user
 * chooses. The protection is naming them in the confirmation instead.
 */
export function countFavourites(assets: AssetFact[], ids: Set<string>): number {
  let count = 0;
  for (const asset of assets) {
    if (asset.isFavorite && ids.has(asset.id)) count += 1;
  }
  return count;
}

/** "2:05". Minutes are never rolled up into hours — "61:01" reads fine. */
export function formatDuration(seconds: number): string {
  const total = Math.max(Math.floor(seconds), 0);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${rest.toString().padStart(2, '0')}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test browse && pnpm typecheck`
Expected: PASS, all suites green, typecheck silent

- [ ] **Step 5: Commit**

```bash
git add src/lib/scan/browse.ts src/lib/scan/__tests__/browse.test.ts
git commit -m "Add pure browser logic for the media grid"
```

---

### Task 2: Storage breakdown

**Files:**
- Create: `src/lib/storage/breakdown.ts`
- Test: `src/lib/storage/__tests__/breakdown.test.ts`

**Interfaces:**
- Produces: `otherStorageBytes(usedBytes: number, photoLibraryBytes: number): number | null` — returns `null` when the figure cannot be trusted and must not be shown.

- [ ] **Step 1: Write the failing test**

Create `src/lib/storage/__tests__/breakdown.test.ts`:

```ts
import { otherStorageBytes } from '@/lib/storage/breakdown';

describe('otherStorageBytes', () => {
  it('returns used minus the photo library', () => {
    expect(otherStorageBytes(100_000_000_000, 12_000_000_000)).toBe(
      88_000_000_000,
    );
  });

  it('suppresses the figure when photos exceed used space', () => {
    // iCloud "Optimize iPhone Storage": summed asset bytes are the full-size
    // originals, which are larger than what the phone actually holds.
    expect(otherStorageBytes(20_000_000_000, 60_000_000_000)).toBeNull();
  });

  it('suppresses the figure when the two are equal', () => {
    expect(otherStorageBytes(50_000_000_000, 50_000_000_000)).toBeNull();
  });

  it('suppresses the figure when used space is zero or unknown', () => {
    expect(otherStorageBytes(0, 0)).toBeNull();
  });

  it('suppresses the figure for negative inputs', () => {
    expect(otherStorageBytes(-1, 10)).toBeNull();
    expect(otherStorageBytes(100, -1)).toBeNull();
  });

  it('returns a positive figure when the library is empty', () => {
    expect(otherStorageBytes(80_000_000_000, 0)).toBe(80_000_000_000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test breakdown`
Expected: FAIL — `Cannot find module '@/lib/storage/breakdown'`

- [ ] **Step 3: Write the implementation**

Create `src/lib/storage/breakdown.ts`:

```ts
/**
 * The storage the app cannot reach: apps, their private containers, and the
 * system. Named honestly rather than attributed to any app — we cannot see a
 * per-app breakdown and must never imply we can.
 *
 * Returns null when the arithmetic cannot be trusted. With iCloud "Optimize
 * iPhone Storage" the summed asset sizes are full-size originals, which exceed
 * what the phone actually holds, so the subtraction goes negative. A wrong
 * number on the capacity plate costs more than the reading gains, so in that
 * case the caller shows nothing at all.
 */
export function otherStorageBytes(
  usedBytes: number,
  photoLibraryBytes: number,
): number | null {
  if (usedBytes <= 0 || photoLibraryBytes < 0) return null;
  if (photoLibraryBytes >= usedBytes) return null;
  return usedBytes - photoLibraryBytes;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test breakdown && pnpm typecheck`
Expected: PASS, typecheck silent

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage/breakdown.ts src/lib/storage/__tests__/breakdown.test.ts
git commit -m "Add unreachable storage breakdown calculation"
```

---

### Task 3: Native video playback

**Files:**
- Modify: `modules/photo-scan/ios/PhotoScanModule.swift`
- Modify: `modules/photo-scan/src/PhotoScan.ts`
- Modify: `modules/photo-scan/index.ts`

**Interfaces:**
- Produces: `playVideo(assetId: string): Promise<boolean>` exported from `@modules/photo-scan`. Resolves `true` when the player was presented, `false` when the asset is missing, is not a video, or no view controller was available.

This task has no unit test — it is native and cannot run without a device. Verify by typecheck and a build.

- [ ] **Step 1: Add the AVKit import**

In `modules/photo-scan/ios/PhotoScanModule.swift`, change the import block at the top of the file:

```swift
import ExpoModulesCore
import Photos
import Vision
import UIKit
import AVKit
```

- [ ] **Step 2: Add the playVideo function**

In the same file, insert this immediately **after** the closing brace of the `AsyncFunction("deleteAssets")` block and **before** the closing brace of `definition()`:

```swift
    // MARK: - Playback

    /// Presents the system player — the same one the user already knows from
    /// the Photos app. Recognition is the whole accessibility strategy here, so
    /// a bespoke player would be a downgrade even if it were less work.
    AsyncFunction("playVideo") { (assetId: String, promise: Promise) in
      DispatchQueue.main.async {
        let fetched = PHAsset.fetchAssets(withLocalIdentifiers: [assetId], options: nil)
        guard let asset = fetched.firstObject, asset.mediaType == .video else {
          promise.resolve(false)
          return
        }

        let options = PHVideoRequestOptions()
        options.deliveryMode = .automatic
        // The one place network access is allowed. This fetches the user's own
        // video from their own iCloud library because they tapped it. Without
        // it, every video fails to play on an optimized-storage phone.
        options.isNetworkAccessAllowed = true

        PHImageManager.default().requestPlayerItem(
          forVideo: asset,
          options: options
        ) { item, _ in
          DispatchQueue.main.async {
            guard let item, let top = Self.topViewController() else {
              promise.resolve(false)
              return
            }

            let player = AVPlayer(playerItem: item)
            let controller = AVPlayerViewController()
            controller.player = player

            top.present(controller, animated: true) { player.play() }
            promise.resolve(true)
          }
        }
      }
    }
```

- [ ] **Step 3: Add the topViewController helper**

In the same file, add this to the `// MARK: - Helpers` section, immediately after the `describe(_:)` function:

```swift
  /// The frontmost presented controller. Presenting on the root while a sheet
  /// is already up silently does nothing, so walk the chain first.
  private static func topViewController() -> UIViewController? {
    let scene = UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .first { $0.activationState == .foregroundActive }

    guard var top = scene?.keyWindow?.rootViewController else { return nil }
    while let presented = top.presentedViewController { top = presented }
    return top
  }
```

- [ ] **Step 4: Fix the incorrect WhatsApp comment**

In the same file, replace the doc comment above `isCameraOriginal` (currently at lines 192–199) with:

```swift
  /// Photos captured by this device's camera are named `IMG_1234.HEIC`.
  /// Anything saved from another app keeps whatever name that app gave it —
  /// WhatsApp on iOS assigns random alphanumeric or UUID-style names
  /// (`AJXQ8273.JPG`, `7d3cd6be-….jpeg`), AirDrops and downloads keep their own.
  ///
  /// Note: `IMG-20240115-WA0001.jpg` is the *Android* WhatsApp pattern and does
  /// not appear on iOS. There is no "WhatsApp" album on iOS either.
  ///
  /// This is a filename heuristic, not proof. It is deliberately chosen over
  /// reading EXIF headers: that needs a second undocumented KVC key for the
  /// file URL and decodes every image, which is far slower for a signal that
  /// only ever drives a "worth a look" bucket.
```

- [ ] **Step 5: Add the TypeScript binding**

In `modules/photo-scan/src/PhotoScan.ts`, add `playVideo` to the `NativeModule` type:

```ts
type NativeModule = {
  getPhotoPermission(): PhotoPermission;
  requestPhotoPermission(): Promise<PhotoPermission>;
  inventory(): Promise<InventoryResult>;
  findSimilarPairs(assetIds: string[]): Promise<SimilarPairsResult>;
  deleteAssets(assetIds: string[]): Promise<DeleteResult>;
  playVideo(assetId: string): Promise<boolean>;
};
```

Then add the exported wrapper at the end of the file:

```ts
/**
 * Presents the system video player full screen. Resolves false when the asset
 * is gone, is not a video, or no controller was available to present from —
 * all normal outcomes, never thrown.
 */
export function playVideo(assetId: string): Promise<boolean> {
  return native.playVideo(assetId);
}
```

- [ ] **Step 6: Re-export it**

Replace the contents of `modules/photo-scan/index.ts`:

```ts
export {
  getPhotoPermission,
  requestPhotoPermission,
  inventory,
  findSimilarPairs,
  deleteAssets,
  playVideo,
  type PhotoPermission,
  type InventoryResult,
  type SimilarPairsResult,
  type DeleteResult,
} from './src/PhotoScan';
```

- [ ] **Step 7: Verify types and Swift syntax**

Run: `pnpm typecheck`
Expected: silent

Run: `swiftc -parse modules/photo-scan/ios/PhotoScanModule.swift 2>&1 | head -20`
Expected: errors only about missing modules (`ExpoModulesCore`, `Photos`, `Vision`, `AVKit`) — those are unavailable outside an Xcode build and are fine. Any *syntax* error is a real failure and must be fixed.

- [ ] **Step 8: Commit**

```bash
git add modules/photo-scan
git commit -m "Add native video playback to photo-scan module"
```

---

### Task 4: Virtualized media grid

**Files:**
- Create: `src/components/media-browser-grid.tsx`

**Interfaces:**
- Consumes: `sortBySizeDesc`, `chunkIntoRows`, `formatDuration` from `@/lib/scan/browse`; `assetUri` from `@/components/photo-grid`; `formatBytes` from `@/lib/scan/estimate`
- Produces: `<MediaBrowserGrid assets selected onToggle onPlay />` where `assets: AssetFact[]` is **already sorted** by the caller, `selected: Set<string>`, `onToggle: (id: string) => void`, `onPlay: (id: string) => void`

No unit test — jest is configured for `.ts` only (see Global Constraints). Correctness is verified by typecheck and on-device.

- [ ] **Step 1: Write the component**

Create `src/components/media-browser-grid.tsx`:

```tsx
import { useMemo } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';

import { assetUri } from '@/components/photo-grid';
import { chunkIntoRows, formatDuration } from '@/lib/scan/browse';
import { formatBytes } from '@/lib/scan/estimate';
import type { AssetFact } from '@/lib/scan/types';
import { radius, space, usePalette } from '@/lib/ui/theme';

type Props = {
  /** Already sorted by the caller. This component never reorders. */
  assets: AssetFact[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onPlay: (id: string) => void;
};

/**
 * The whole library in one list.
 *
 * Rows are pre-chunked so the FlatList is a list of rows, not of cells. That
 * makes getItemLayout exact, which is what keeps scrolling smooth at thirty
 * thousand assets — the eager ScrollView in PhotoGrid cannot survive that.
 */
export function MediaBrowserGrid({ assets, selected, onToggle, onPlay }: Props) {
  const { width } = useWindowDimensions();

  const columns = width >= 700 ? 4 : 3;
  const gap = space.sm;
  const cell = (width - space.lg * 2 - gap * (columns - 1)) / columns;
  const rowHeight = cell + gap;

  const rows = useMemo(
    () => chunkIntoRows(assets, columns),
    [assets, columns],
  );

  return (
    <FlatList
      data={rows}
      keyExtractor={(row) => row[0]?.id ?? 'empty'}
      removeClippedSubviews
      initialNumToRender={12}
      windowSize={11}
      maxToRenderPerBatch={12}
      getItemLayout={(_, index) => ({
        length: rowHeight,
        offset: rowHeight * index,
        index,
      })}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      renderItem={({ item: row }) => (
        <View style={[styles.row, { gap, height: rowHeight }]}>
          {row.map((asset) => (
            <MediaCell
              key={asset.id}
              asset={asset}
              size={cell}
              isSelected={selected.has(asset.id)}
              onToggle={onToggle}
              onPlay={onPlay}
            />
          ))}
        </View>
      )}
    />
  );
}

function MediaCell({
  asset,
  size,
  isSelected,
  onToggle,
  onPlay,
}: {
  asset: AssetFact;
  size: number;
  isSelected: boolean;
  onToggle: (id: string) => void;
  onPlay: (id: string) => void;
}) {
  const palette = usePalette();
  const isVideo = asset.subtype === 'video' || asset.subtype === 'screenRecording';

  const label = [
    isVideo ? 'Video' : 'Photo',
    formatBytes(asset.sizeBytes),
    isVideo ? formatDuration(asset.durationSeconds) : null,
    asset.isFavorite ? 'Favourite' : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      onPress={() => (isVideo ? onPlay(asset.id) : onToggle(asset.id))}
      onLongPress={() => onToggle(asset.id)}
      accessibilityRole={isVideo ? 'button' : 'checkbox'}
      accessibilityState={{ checked: isSelected }}
      accessibilityLabel={label}
      accessibilityHint={
        isVideo
          ? 'Double tap to watch. Touch and hold to select it for deletion.'
          : isSelected
            ? 'Turn off to keep'
            : 'Turn on to delete'
      }
      style={[styles.cell, { width: size, height: size }]}>
      <Image
        source={{ uri: assetUri(asset.id) }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={120}
      />

      {isSelected ? (
        <>
          <View style={[styles.selectedEdge, { borderColor: palette.amber }]} />
          <View style={[styles.mark, { backgroundColor: palette.amber }]}>
            <Text style={styles.markGlyph} maxFontSizeMultiplier={1.4}>
              ✓
            </Text>
          </View>
        </>
      ) : null}

      {asset.isFavorite ? (
        <Text style={styles.heart} maxFontSizeMultiplier={1.4}>
          ♥
        </Text>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.size} numberOfLines={1} maxFontSizeMultiplier={1.4}>
          {formatBytes(asset.sizeBytes)}
        </Text>
        {isVideo ? (
          <Text style={styles.size} numberOfLines={1} maxFontSizeMultiplier={1.4}>
            ▶ {formatDuration(asset.durationSeconds)}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.lg, paddingBottom: space.xxxl },
  row: { flexDirection: 'row' },
  cell: {
    borderRadius: radius.flag,
    overflow: 'hidden',
    backgroundColor: '#0002',
  },
  selectedEdge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.flag,
    borderWidth: 3,
  },
  mark: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markGlyph: { fontSize: 14, fontWeight: '700', color: '#fff' },
  heart: {
    position: 'absolute',
    top: 4,
    left: 4,
    fontSize: 13,
    color: '#fff',
    textShadowColor: '#000',
    textShadowRadius: 3,
  },
  footer: {
    position: 'absolute',
    left: 4,
    right: 4,
    bottom: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.xs,
  },
  size: {
    color: '#fff',
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    textShadowColor: '#000',
    textShadowRadius: 3,
  },
});
```

Note the `#fff` / `#0002` literals: these sit **on top of photographic content**, not on the panel, and match the existing `photo-grid.tsx` treatment exactly. They are not palette colours and must not be replaced with palette values.

- [ ] **Step 2: Verify types**

Run: `pnpm typecheck`
Expected: silent

- [ ] **Step 3: Commit**

```bash
git add src/components/media-browser-grid.tsx
git commit -m "Add virtualized media browser grid"
```

---

### Task 5: Selection footer

**Files:**
- Create: `src/components/selection-footer.tsx`

**Interfaces:**
- Consumes: `MainBreaker` from `@/components/main-breaker`; `formatBytes` from `@/lib/scan/estimate`
- Produces: `<SelectionFooter count bytes favouriteCount onDelete />` — renders `null` when `count === 0`

- [ ] **Step 1: Write the component**

Create `src/components/selection-footer.tsx`:

```tsx
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MainBreaker } from '@/components/main-breaker';
import { formatBytes } from '@/lib/scan/estimate';
import { cardShadow, space, usePalette } from '@/lib/ui/theme';

type Props = {
  count: number;
  bytes: number;
  favouriteCount: number;
  onDelete: () => void;
};

/**
 * Floats over the list rather than sitting at its end — with thirty thousand
 * items the end of the list is somewhere the user will never scroll to.
 *
 * Absent entirely when nothing is selected, so the resting state of the browser
 * is a calm screen with no controls competing for attention.
 */
export function SelectionFooter({ count, bytes, favouriteCount, onDelete }: Props) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();

  if (count === 0) return null;

  return (
    <View
      style={[
        styles.bar,
        cardShadow,
        {
          backgroundColor: palette.card,
          paddingBottom: insets.bottom + space.md,
          borderTopColor: palette.rule,
        },
      ]}>
      {favouriteCount > 0 ? (
        <Text
          style={[styles.warning, { color: palette.inkSecondary }]}
          maxFontSizeMultiplier={1.8}>
          {favouriteCount === 1
            ? '1 of these is a photo you marked as a favourite.'
            : `${favouriteCount} of these are photos you marked as favourites.`}
        </Text>
      ) : null}

      <MainBreaker
        label={`Delete ${count} · ${formatBytes(bytes)}`}
        onPress={onDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    gap: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  warning: { fontSize: 14, lineHeight: 20 },
});
```

- [ ] **Step 2: Verify types**

Run: `pnpm typecheck`
Expected: silent

- [ ] **Step 3: Commit**

```bash
git add src/components/selection-footer.tsx
git commit -m "Add floating selection footer"
```

---

### Task 6: Shared scan state and the browse screen

**Files:**
- Create: `src/lib/scan/scan-context.tsx`
- Create: `src/app/browse.tsx`
- Modify: `src/lib/scan/delete.ts`
- Modify: `src/app/_layout.tsx`
- Modify: `src/app/review.tsx:9,20`, `src/app/deck.tsx:9,19`, `src/app/(tabs)/week.tsx:11,23`
- Modify: `src/app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `useScan`, `ScanState` from `@/lib/scan/use-scan`; `sortBySizeDesc`, `countFavourites` from `@/lib/scan/browse`; `estimateFreed` from `@/lib/scan/estimate`; `deleteAndMeasure` from `@/lib/scan/delete`; `playVideo` from `@modules/photo-scan`; `MediaBrowserGrid`, `SelectionFooter`
- Produces:
  - `<ScanProvider>{children}</ScanProvider>` and `useScanState(): ScanState` from `@/lib/scan/scan-context`
  - `confirmDelete(count: number, sizeLabel: string, onConfirm: () => void, note?: string): void`

**Why the context comes first.** `useScan` owns state *per caller*, and its mount
effect kicks off a scan. Four screens already call it independently
(`review.tsx:20`, `deck.tsx:19`, `week.tsx:23`, `index.tsx:22`), so every screen
change re-scans the whole library from scratch. That is a **pre-existing bug**,
not something this feature introduces — but a browser that opens on an empty
grid and re-scans thirty thousand assets is where it becomes unignorable, so it
is fixed here rather than worked around.

`estimateFreed` needs no new tests: `estimate.test.ts:31-53` already covers the
sum, the empty selection, duplicate ids, and unknown ids.

- [ ] **Step 1: Create the scan context**

Create `src/lib/scan/scan-context.tsx`:

```tsx
import { createContext, useContext, type ReactNode } from 'react';

import { useScan, type ScanState } from '@/lib/scan/use-scan';

const ScanContext = createContext<ScanState | null>(null);

/**
 * One scan for the whole app.
 *
 * useScan holds state per caller and starts a scan when it mounts, so calling
 * it from each screen means a full re-scan on every navigation. Mounted once
 * here, every screen reads the same result and navigation is instant.
 */
export function ScanProvider({ children }: { children: ReactNode }) {
  const state = useScan();
  return <ScanContext.Provider value={state}>{children}</ScanContext.Provider>;
}

export function useScanState(): ScanState {
  const state = useContext(ScanContext);
  if (state === null) {
    throw new Error('useScanState must be used inside a ScanProvider');
  }
  return state;
}
```

- [ ] **Step 2: Mount the provider and register the screen**

In `src/app/_layout.tsx`, add the import:

```tsx
import { ScanProvider } from '@/lib/scan/scan-context';
```

Wrap the `<Stack>` in `<ScanProvider>` (inside `GestureHandlerRootView`, so the
`StatusBar` stays where it is), and add the `browse` screen alongside the other
pushed screens:

```tsx
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <ScanProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          {/* Pushed screens keep the left-edge back gesture alive. */}
          <Stack.Screen
            name="review"
            options={{ headerShown: true, title: 'What we found', headerBackTitle: 'Back' }}
          />
          <Stack.Screen
            name="browse"
            options={{
              headerShown: true,
              title: 'Everything on your phone',
              headerBackTitle: 'Back',
            }}
          />
          <Stack.Screen
            name="deck"
            options={{ headerShown: true, title: 'Your call', headerBackTitle: 'Back' }}
          />
          <Stack.Screen
            name="guide/[id]"
            options={{ headerShown: true, title: '', headerBackTitle: 'Guides' }}
          />
        </Stack>
      </ScanProvider>
    </GestureHandlerRootView>
```

- [ ] **Step 3: Point the existing screens at the shared state**

In each of `src/app/review.tsx`, `src/app/deck.tsx`, `src/app/(tabs)/week.tsx`,
and `src/app/(tabs)/index.tsx`, replace the import:

```tsx
import { useScanState } from '@/lib/scan/scan-context';
```

(removing the `import { useScan } from '@/lib/scan/use-scan';` line) and change
the call site from `useScan()` to `useScanState()`. The destructured fields stay
exactly as they are — `ScanState` is unchanged.

- [ ] **Step 4: Verify nothing regressed**

Run: `pnpm test && pnpm typecheck`
Expected: all suites pass, typecheck silent

- [ ] **Step 5: Commit the shared state**

```bash
git add src/lib/scan/scan-context.tsx src/app/_layout.tsx src/app/review.tsx src/app/deck.tsx "src/app/(tabs)/week.tsx" "src/app/(tabs)/index.tsx"
git commit -m "Share one scan across every screen"
```

- [ ] **Step 6: Let confirmDelete carry a note**

The favourite warning must not be smuggled into `sizeLabel` — that string is
interpolated as `This frees about ${sizeLabel}.` and appending a sentence to it
produces a stray double full stop. Give it its own parameter.

In `src/lib/scan/delete.ts`, replace the `confirmDelete` function with:

```ts
export function confirmDelete(
  count: number,
  sizeLabel: string,
  onConfirm: () => void,
  /** Extra paragraph shown before the safety net line, e.g. a favourite count. */
  note?: string,
): void {
  Alert.alert(
    `Delete ${count} ${count === 1 ? 'item' : 'items'}?`,
    `This frees about ${sizeLabel}.${note ? `\n\n${note}` : ''}\n\nThey move to Recently Deleted in Photos. You have 30 days to get them back.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { text: `Delete ${count}`, style: 'destructive', onPress: onConfirm },
    ],
  );
}
```

Existing callers pass three arguments and are unaffected.

- [ ] **Step 7: Write the screen**

Create `src/app/browse.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { playVideo } from '@modules/photo-scan';

import { MediaBrowserGrid } from '@/components/media-browser-grid';
import { SelectionFooter } from '@/components/selection-footer';
import { countFavourites, sortBySizeDesc } from '@/lib/scan/browse';
import { confirmDelete, deleteAndMeasure } from '@/lib/scan/delete';
import { estimateFreed, formatBytes } from '@/lib/scan/estimate';
import { useScanState } from '@/lib/scan/scan-context';
import { space, usePalette } from '@/lib/ui/theme';

/**
 * Everything on the phone, largest first.
 *
 * Deliberately opposite to /review: that screen shows what the app decided and
 * lets the user veto it, this one shows the whole library and decides nothing.
 */
export default function BrowseScreen() {
  const palette = usePalette();
  const { result, rescan } = useScanState();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const assets = useMemo(
    () => (result ? sortBySizeDesc(result.assets) : []),
    [result],
  );

  const bytes = useMemo(
    () => (result ? estimateFreed(result.assets, selected) : 0),
    [result, selected],
  );

  const favouriteCount = useMemo(
    () => (result ? countFavourites(result.assets, selected) : 0),
    [result, selected],
  );

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runDelete() {
    const outcome = await deleteAndMeasure([...selected], bytes);
    if (outcome.status === 'cancelled') return;
    setSelected(new Set());
    await rescan();
    router.back();
  }

  function askToDelete() {
    // Naming favourites in the confirmation is the only guard on deleting
    // something the user hearted — this screen deliberately lets them select it.
    const note =
      favouriteCount === 0
        ? undefined
        : favouriteCount === 1
          ? '1 of these is a photo you marked as a favourite.'
          : `${favouriteCount} of these are photos you marked as favourites.`;

    confirmDelete(selected.size, formatBytes(bytes), runDelete, note);
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Everything on your phone' }} />
      <View style={[styles.screen, { backgroundColor: palette.panel }]}>
        {assets.length > 0 ? (
          <MediaBrowserGrid
            assets={assets}
            selected={selected}
            onToggle={toggle}
            onPlay={(id) => void playVideo(id)}
          />
        ) : (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: palette.inkSecondary }]}>
              Nothing here yet. Make Room is still looking through your photos.
            </Text>
          </View>
        )}

        <SelectionFooter
          count={selected.size}
          bytes={bytes}
          favouriteCount={favouriteCount}
          onDelete={askToDelete}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  empty: { flex: 1, justifyContent: 'center', padding: space.xl },
  emptyText: { fontSize: 16, lineHeight: 23, textAlign: 'center' },
});
```

- [ ] **Step 8: Add the entry point**

In `src/app/(tabs)/index.tsx`, replace the single review `QuietLink` (currently line 153) with both links:

```tsx
            <QuietLink
              label="Check what will be deleted"
              onPress={() => router.push('/review')}
            />

            <QuietLink
              label={`Everything on your phone · ${result.assets.length.toLocaleString()} items · ${formatBytes(
                result.assets.reduce((sum, a) => sum + a.sizeBytes, 0),
              )}`}
              onPress={() => router.push('/browse')}
            />
```

- [ ] **Step 9: Verify types and tests**

Run: `pnpm typecheck && pnpm test`
Expected: typecheck silent, all suites pass

If typecheck reports that `'/browse'` is not a valid route, run `pnpm start` once to regenerate `.expo/types` (typed routes are enabled in `app.json`), then re-run.

- [ ] **Step 10: Commit**

```bash
git add src/app/browse.tsx src/lib/scan/delete.ts "src/app/(tabs)/index.tsx"
git commit -m "Add unified media browser screen"
```

---

### Task 7: Nameplate second reading

**Files:**
- Modify: `src/components/nameplate.tsx`
- Modify: `src/app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `otherStorageBytes` from `@/lib/storage/breakdown`
- Produces: `<Nameplate usedBytes totalBytes photoLibraryBytes />` — the third prop is optional; when omitted or when the figure is suppressed, the plate renders exactly as it does today.

- [ ] **Step 1: Add the prop and the reading**

In `src/components/nameplate.tsx`, add the import:

```tsx
import { otherStorageBytes } from '@/lib/storage/breakdown';
```

Change the `Props` type:

```tsx
type Props = {
  usedBytes: number;
  totalBytes: number;
  /** Summed asset sizes. Omit to hide the second reading entirely. */
  photoLibraryBytes?: number;
};
```

Change the function signature and add the calculation after `freeBytes`:

```tsx
export function Nameplate({ usedBytes, totalBytes, photoLibraryBytes }: Props) {
```

```tsx
  const freeBytes = Math.max(totalBytes - usedBytes, 0);

  // Null whenever the figure cannot be trusted — an iCloud-optimized library
  // reports more asset bytes than the phone actually holds.
  const otherBytes =
    photoLibraryBytes === undefined
      ? null
      : otherStorageBytes(usedBytes, photoLibraryBytes);
```

Replace the final `free` Text element with:

```tsx
      <Text style={[styles.free, { color: palette.onGraphite }]} maxFontSizeMultiplier={2}>
        {formatBytes(freeBytes)} free
        {otherBytes === null
          ? ''
          : `  ·  ${formatBytes(otherBytes)} in apps and everything else`}
      </Text>
```

- [ ] **Step 2: Extend the accessibility label**

In the same file, replace the `accessibilityLabel` expression on the plate `View` with:

```tsx
      accessibilityLabel={`${formatBytes(usedBytes)} of ${formatBytes(
        totalBytes,
      )} used. ${formatBytes(freeBytes)} free.${
        otherBytes === null
          ? ''
          : ` ${formatBytes(otherBytes)} is used by apps and everything else, which Make Room cannot open.`
      }`}
```

- [ ] **Step 3: Pass the figure from the Clean screen**

In `src/app/(tabs)/index.tsx`, replace the `<Nameplate …>` element (currently line 96) with:

```tsx
        <Nameplate
          usedBytes={disk.usedBytes}
          totalBytes={disk.totalBytes}
          photoLibraryBytes={result?.assets.reduce(
            (sum, a) => sum + a.sizeBytes,
            0,
          )}
        />
```

- [ ] **Step 4: Verify types and tests**

Run: `pnpm typecheck && pnpm test`
Expected: typecheck silent, all suites pass

- [ ] **Step 5: Commit**

```bash
git add src/components/nameplate.tsx "src/app/(tabs)/index.tsx"
git commit -m "Show unreachable storage on the capacity plate"
```

---

### Task 8: Measured guide handoff

**Files:**
- Modify: `src/lib/guides/content.ts`
- Modify: `src/app/guide/[id].tsx`
- Modify: `app.json`

**Interfaces:**
- Consumes: `Paths` from `expo-file-system`; `Linking`, `AppState` from `react-native`; `MainBreaker`
- Produces: `Guide.appScheme?: string` and `Guide.openLabel?: string` on the existing `Guide` type

- [ ] **Step 1: Extend the guide type and the WhatsApp entry**

In `src/lib/guides/content.ts`, add two optional fields to the `Guide` type:

```ts
export type Guide = {
  id: string;
  title: string;
  blurb: string;
  why: string;
  steps: string[];
  note?: string;
  /** URL scheme to open the app this guide is about, e.g. `whatsapp://`. */
  appScheme?: string;
  /** Button copy for that jump. Required whenever `appScheme` is set. */
  openLabel?: string;
};
```

Then replace the `whatsapp` entry's `note` and add the two new fields:

```ts
    note: 'Deleting here removes the photo from that chat. If you want to keep one, tap it and save it to your photos first.\n\nWhatsApp usually also saves a second copy of every photo into your Photos app, which means each one is taking up room twice. Turning off "Save to Camera Roll" in WhatsApp under Settings then Chats stops that happening again.',
    appScheme: 'whatsapp://',
    openLabel: 'Open WhatsApp',
```

- [ ] **Step 2: Add the measured jump to the guide screen**

In `src/app/guide/[id].tsx`, add these imports:

```tsx
import { useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { Paths } from 'expo-file-system';

import { MainBreaker } from '@/components/main-breaker';
import { formatBytes } from '@/lib/scan/estimate';
```

Add this constant above the component:

```tsx
/**
 * iOS purges caches and downloads iCloud assets on its own, so a small change
 * in free space cannot be attributed to anything the user did. Below this we
 * say nothing rather than report a number we cannot stand behind.
 */
const NOISE_FLOOR_BYTES = 200_000_000;
```

Inside `GuideScreen`, above the `if (!guide)` early return, add:

```tsx
  const freeBefore = useRef<number | null>(null);
  const [recovered, setRecovered] = useState<number | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || freeBefore.current === null) return;

      const delta = (Paths.availableDiskSpace ?? 0) - freeBefore.current;
      freeBefore.current = null;
      if (delta >= NOISE_FLOOR_BYTES) setRecovered(delta);
    });

    return () => subscription.remove();
  }, []);

  async function openApp(scheme: string) {
    freeBefore.current = Paths.availableDiskSpace ?? 0;
    try {
      await Linking.openURL(scheme);
    } catch {
      // WhatsApp is not installed. Nothing to measure, and the written steps
      // below still stand on their own.
      freeBefore.current = null;
    }
  }
```

Bind the scheme to a local so TypeScript keeps it narrowed inside the callback —
`guide.appScheme` widens back to `string | undefined` there, and a cast is not
allowed. Add this immediately after the `if (!guide)` early return:

```tsx
  const scheme = guide.appScheme;
```

Then insert this immediately **after** the closing `</View>` of the step card and **before** the `{guide.note ? …}` block:

```tsx
        {recovered !== null ? (
          <View style={[styles.note, { borderColor: palette.rule }]}>
            <Text style={[styles.body, { color: palette.ink }]}>
              You freed {formatBytes(recovered)}.
            </Text>
          </View>
        ) : null}

        {scheme && guide.openLabel ? (
          <MainBreaker label={guide.openLabel} onPress={() => void openApp(scheme)} />
        ) : null}
```

- [ ] **Step 3: Whitelist the scheme**

In `app.json`, add `LSApplicationQueriesSchemes` inside `expo.ios.infoPlist`, alongside the existing keys:

```json
      "infoPlist": {
        "ITSAppUsesNonExemptEncryption": false,
        "NSPhotoLibraryUsageDescription": "Make Room looks through your photos to find copies and big files you can safely delete. Your photos never leave your phone.",
        "LSApplicationQueriesSchemes": ["whatsapp"]
      },
```

- [ ] **Step 4: Verify types and tests**

Run: `pnpm typecheck && pnpm test`
Expected: typecheck silent, all suites pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/guides/content.ts "src/app/guide/[id].tsx" app.json
git commit -m "Measure space recovered by the WhatsApp guide"
```

---

### Task 9: Full gate and documentation

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Run the full gate**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: all suites pass, typecheck silent, lint clean

Fix anything that fails before continuing. Do not proceed with a red gate.

- [ ] **Step 2: Record what changed**

In `CLAUDE.md`, add this to the "Where things are" code block, after the `src/lib/guides/content.ts` line:

```
src/lib/scan/scan-context.tsx                   one scan shared by every screen
src/lib/storage/breakdown.ts                    unreachable-storage figure + suppression
src/app/browse.tsx                              everything on the phone, largest first
```

Then add this to the "Architecture" section, after the two-phase scan paragraph:

```markdown
**One scan, shared.** `useScan` holds state per caller and starts a scan on
mount, so calling it from each screen re-scans the whole library on every
navigation. It is mounted once in `ScanProvider` (`src/app/_layout.tsx`) and
every screen reads it via `useScanState()`. **Never call `useScan` directly from
a screen.**
```

Then in the "Unmeasured — treat as suspected, not fact" section, replace the `isCameraOriginal` bullet's final sentence and add three bullets:

```markdown
- **`FlatList` at scale.** `src/components/media-browser-grid.tsx` pre-chunks
  rows so `getItemLayout` is exact, but it has never run against a real library.
  If it stutters, FlashList becomes a dependency conversation — ask first.
- **Video poster frames.** The browser assumes `expo-image` renders a poster
  frame for a video's `ph://` URI. If it shows blanks, the fallback is a native
  thumbnail function on the photo-scan module.
- **The 200 MB noise floor** in `src/app/guide/[id].tsx`. A guess. It decides
  whether the "You freed X" line appears at all.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "Document media browser structure and open unknowns"
```

---

## Verification on device

None of the following can be checked from this machine — the iOS SDK is installed but there are zero simulator runtimes, so real compilation happens on EAS.

After `pnpm build:ios` and a TestFlight install, confirm:

1. **Scroll** the browser to the bottom of a full library. Any stutter or blank cells means `FlatList` tuning or FlashList.
2. **Video thumbnails** render rather than showing empty cells. Blanks mean the native thumbnail fallback is needed.
3. **Tapping a video** opens the system player and it plays, including for a video that lives in iCloud.
4. **Long-pressing a video** selects it instead of playing.
5. **Selecting a favourite** produces the "N of these are photos you marked as a favourite" line in the confirmation.
6. **Deleting** reports freed bytes and the list refreshes without the deleted items.
7. **The nameplate** either shows a sensible "in apps and everything else" figure, or shows nothing. It must never show a negative or absurd number.
8. **The WhatsApp guide** opens WhatsApp on tap, and reports freed space on return only if a real amount was cleared.

`app.json`'s `buildNumber` autoincrements on build — including on failed builds — so commit the resulting change.

**Do not run `eas submit` or `eas update`.** Hand the command over instead.
