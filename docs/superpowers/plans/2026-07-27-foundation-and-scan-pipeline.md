# Make Room — Plan 1: Foundation & Scan Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working, benchmarked photo-library scanner that outputs categorized, deduplicated results — with no UI beyond a developer scratch screen.

**Architecture:** An Expo app with one local Swift module (`photo-scan`). The Swift side does per-pixel work (byte sizes, Vision feature prints, clustering) and returns small fact objects. All product logic — categorization, grouping, keeper selection, estimation — lives in pure TypeScript functions that are unit-tested without a device. Results cache to SQLite so later scans only process new assets.

**Tech Stack:** Expo SDK 57, expo-router, TypeScript (strict), Swift + ExpoModulesCore, PhotoKit, Vision, expo-sqlite, Jest + ts-jest.

**Reference blueprint:** `/Users/bern/Desktop/apps/personal/100workout` — same SDK, same `src/` layout, and its `modules/expo-body-pose` is an existing local Vision-backed Swift module. Match its conventions.

**Spec:** `docs/superpowers/specs/2026-07-27-make-room-design.md`

## Global Constraints

- **iOS only.** No Android implementation. `expo-module.config.json` declares `"platforms": ["apple"]`.
- **iOS deployment target 17.0**, set via `expo-build-properties`.
- **TypeScript strict mode.** No `any`, no `@ts-ignore`, no `eslint-disable`.
- **No backend, no accounts, no analytics, no network calls.** Everything stays on device.
- **Feature print vectors must never cross the JS bridge.** Clustering happens natively; only cluster IDs are returned.
- **Favourites are never deletable.** `isFavorite` assets are excluded from every category.
- **A duplicate group can never be fully deleted.** `pickKeeper` always returns exactly one survivor.
- **Path alias:** `@/*` → `./src/*`, `@modules/*` → `./modules/*`.
- **Commit style:** imperative mood, single lead line, no body, no AI attribution.

---

## File Structure

```
make-room/
  app.json                              Expo config, iOS 17 target, NSPhotoLibraryUsageDescription
  package.json
  tsconfig.json                         strict, @/ and @modules/ aliases
  jest.config.js                        ts-jest, roots: src/

  modules/photo-scan/
    expo-module.config.json             platforms: ["apple"]
    index.ts                            public surface re-export
    src/PhotoScan.ts                    TS types + requireNativeModule
    ios/PhotoScan.podspec
    ios/PhotoScanModule.swift           the only Swift file

  src/
    app/
      _layout.tsx                       Stack (NativeTabs arrives in Plan 2)
      index.tsx                         developer scratch screen
    lib/scan/
      types.ts                          AssetFact, CategoryId, AssetGroup, ScanResult
      categorize.ts                     per-asset category assignment
      duplicates.ts                     exact-duplicate grouping
      similar.ts                        transitive clustering of similarity pairs
      keeper.ts                         which asset survives a group
      estimate.ts                       freed-space totals without double counting
      cache.ts                          SQLite persistence + incremental diff
      scanner.ts                        orchestrates phases, emits progress
      __tests__/
        categorize.test.ts
        duplicates.test.ts
        similar.test.ts
        keeper.test.ts
        estimate.test.ts
```

**Responsibility boundaries.** `lib/scan/*` files are pure functions over `AssetFact[]` with no imports from `modules/` or React — that is what makes them testable without a device or mocks. `scanner.ts` is the only file that touches both the native module and the cache. `PhotoScanModule.swift` holds all native work in one file; it is small enough and splitting it would fight the Expo module layout.

---

### Task 1: Scaffold Make Room and lock tooling

**Files:**
- Create: `package.json`, `app.json`, `tsconfig.json`, `jest.config.js`, `src/app/_layout.tsx`, `src/app/index.tsx`, `.gitignore`
- Test: `src/lib/scan/__tests__/smoke.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: a buildable Expo app with `pnpm test` green and path alias `@/*` resolving

- [ ] **Step 1: Scaffold into the existing repo**

The repo already contains `docs/` and `.git`, and `create-expo-app` refuses a non-empty directory. Scaffold to a sibling and move the contents in:

```bash
cd /Users/bern/Desktop/apps/personal
pnpm dlx create-expo-app@latest make-room-scaffold --template default
cd make-room-scaffold
rm -rf .git
# move everything including dotfiles, without clobbering docs/ or .git
shopt -s dotglob
mv * ../make-room/
cd ../make-room
rmdir ../make-room-scaffold
```

- [ ] **Step 2: Move routes under `src/` to match the blueprint**

```bash
cd /Users/bern/Desktop/apps/personal/make-room
mkdir -p src
mv app src/app
rm -rf src/app/\(tabs\)          # tabs arrive in Plan 2
```

Replace `src/app/_layout.tsx` with a bare stack:

```tsx
import { Stack } from 'expo-router';

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

Replace `src/app/index.tsx` with a scratch screen we render scan output into during this plan:

```tsx
import { ScrollView, Text } from 'react-native';

export default function DevScreen() {
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic">
      <Text style={{ fontSize: 24, padding: 16 }}>Make Room</Text>
    </ScrollView>
  );
}
```

- [ ] **Step 3: Install dependencies**

```bash
pnpm add expo-sqlite expo-build-properties
pnpm add -D jest ts-jest @types/jest @types/node
```

- [ ] **Step 4: Write `tsconfig.json`**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "types": ["jest", "node"],
    "paths": {
      "@/*": ["./src/*"],
      "@modules/*": ["./modules/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 5: Write `jest.config.js`**

```js
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  testMatch: ['**/__tests__/**/*.test.ts'],
};
```

- [ ] **Step 6: Configure `app.json`**

Set the identity, the iOS 17 target, and the photo permission string. The usage description is user-facing copy shown in the system dialog — write it in plain language, per the spec's positioning.

```json
{
  "expo": {
    "name": "Make Room",
    "slug": "make-room",
    "owner": "bernardorubin",
    "version": "0.1.0",
    "orientation": "portrait",
    "scheme": "make-room",
    "userInterfaceStyle": "automatic",
    "ios": {
      "bundleIdentifier": "com.bernardorubin.make-room",
      "supportsTablet": false,
      "infoPlist": {
        "ITSAppUsesNonExemptEncryption": false,
        "NSPhotoLibraryUsageDescription": "Make Room looks through your photos to find copies and big files you can safely delete. Your photos never leave your phone."
      }
    },
    "plugins": [
      "expo-router",
      ["expo-build-properties", { "ios": { "deploymentTarget": "17.0" } }]
    ],
    "experiments": { "typedRoutes": true }
  }
}
```

- [ ] **Step 7: Add test scripts to `package.json`**

```json
"scripts": {
  "start": "expo start",
  "ios": "expo run:ios",
  "test": "jest",
  "test:watch": "jest --watch",
  "typecheck": "tsc --noEmit"
}
```

- [ ] **Step 8: Write a smoke test that proves the alias resolves**

Create `src/lib/scan/types.ts`:

```ts
export const SCAN_SCHEMA_VERSION = 1;
```

Create `src/lib/scan/__tests__/smoke.test.ts`:

```ts
import { SCAN_SCHEMA_VERSION } from '@/lib/scan/types';

test('path alias resolves and module loads', () => {
  expect(SCAN_SCHEMA_VERSION).toBe(1);
});
```

- [ ] **Step 9: Run the test and typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: 1 test passes, no type errors.

- [ ] **Step 10: Verify the app builds on device**

Run: `pnpm ios`
Expected: app launches on simulator showing "Make Room".

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "Scaffold Make Room Expo app with strict TS and jest"
```

---

### Task 2: Create the PhotoScan native module with permissions

**Files:**
- Create: `modules/photo-scan/expo-module.config.json`, `modules/photo-scan/index.ts`, `modules/photo-scan/src/PhotoScan.ts`, `modules/photo-scan/ios/PhotoScan.podspec`, `modules/photo-scan/ios/PhotoScanModule.swift`
- Modify: `src/app/index.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: `getPhotoPermission(): PhotoPermission` and `requestPhotoPermission(): Promise<PhotoPermission>` where `PhotoPermission = 'granted' | 'limited' | 'denied' | 'undetermined'`

- [ ] **Step 1: Create the module scaffold**

```bash
cd /Users/bern/Desktop/apps/personal/make-room
mkdir -p modules/photo-scan/ios modules/photo-scan/src
```

`modules/photo-scan/expo-module.config.json`:

```json
{
  "platforms": ["apple"],
  "apple": {
    "modules": ["PhotoScanModule"]
  }
}
```

`modules/photo-scan/ios/PhotoScan.podspec`:

```ruby
Pod::Spec.new do |s|
  s.name           = 'PhotoScan'
  s.version        = '1.0.0'
  s.summary        = 'On-device photo library inventory and similarity via PhotoKit + Vision.'
  s.description    = 'Byte sizes, subtypes and Vision feature-print clustering for the photo library.'
  s.author         = ''
  s.homepage       = 'https://github.com/bernardorubin/make-room'
  s.platforms      = { :ios => '17.0' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
```

- [ ] **Step 2: Write the Swift module with permission handling**

`modules/photo-scan/ios/PhotoScanModule.swift`:

```swift
import ExpoModulesCore
import Photos

public class PhotoScanModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PhotoScan")

    Function("getPhotoPermission") { () -> String in
      return Self.describe(PHPhotoLibrary.authorizationStatus(for: .readWrite))
    }

    AsyncFunction("requestPhotoPermission") { (promise: Promise) in
      PHPhotoLibrary.requestAuthorization(for: .readWrite) { status in
        promise.resolve(Self.describe(status))
      }
    }
  }

  private static func describe(_ status: PHAuthorizationStatus) -> String {
    switch status {
    case .authorized: return "granted"
    case .limited: return "limited"
    case .denied, .restricted: return "denied"
    case .notDetermined: return "undetermined"
    @unknown default: return "undetermined"
    }
  }
}
```

- [ ] **Step 3: Write the TypeScript face**

`modules/photo-scan/src/PhotoScan.ts`:

```ts
import { requireNativeModule } from 'expo';

export type PhotoPermission = 'granted' | 'limited' | 'denied' | 'undetermined';

type NativeModule = {
  getPhotoPermission(): PhotoPermission;
  requestPhotoPermission(): Promise<PhotoPermission>;
};

const native = requireNativeModule<NativeModule>('PhotoScan');

export function getPhotoPermission(): PhotoPermission {
  return native.getPhotoPermission();
}

export function requestPhotoPermission(): Promise<PhotoPermission> {
  return native.requestPhotoPermission();
}
```

`modules/photo-scan/index.ts`:

```ts
export {
  getPhotoPermission,
  requestPhotoPermission,
  type PhotoPermission,
} from './src/PhotoScan';
```

- [ ] **Step 4: Wire the scratch screen to exercise it**

`src/app/index.tsx`:

```tsx
import { useState } from 'react';
import { Button, ScrollView, Text } from 'react-native';
import { getPhotoPermission, requestPhotoPermission } from '@modules/photo-scan';

export default function DevScreen() {
  const [status, setStatus] = useState(() => getPhotoPermission());

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ padding: 16 }}>
      <Text style={{ fontSize: 24 }}>Make Room</Text>
      <Text style={{ marginVertical: 12 }}>Permission: {status}</Text>
      <Button
        title="Request photo access"
        onPress={async () => setStatus(await requestPhotoPermission())}
      />
    </ScrollView>
  );
}
```

- [ ] **Step 5: Rebuild native and verify on device**

The module is new native code, so a rebuild is required — Fast Refresh will not pick it up.

Run: `pnpm ios`
Expected: screen shows `Permission: undetermined`. Tapping the button shows the iOS dialog; granting updates the label to `granted`. Choosing "Limit Access" shows `limited`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add PhotoScan native module with photo library permissions"
```

---

### Task 3: Native asset inventory and benchmark

This is the **risk-retirement task** for Phase 1 of the pipeline (spec §11 risk 1). It must produce real timings before any further work.

**Files:**
- Modify: `modules/photo-scan/ios/PhotoScanModule.swift`, `modules/photo-scan/src/PhotoScan.ts`, `modules/photo-scan/index.ts`, `src/app/index.tsx`
- Create: `src/lib/scan/types.ts` (extend)

**Interfaces:**
- Consumes: `PhotoPermission` from Task 2
- Produces: `inventory(): Promise<InventoryResult>` where

```ts
type AssetFact = {
  id: string;
  sizeBytes: number;
  width: number;
  height: number;
  durationSeconds: number;
  createdAt: number;
  subtype: 'photo' | 'video' | 'screenshot' | 'screenRecording';
  hasCameraExif: boolean;
  isFavorite: boolean;
};
type InventoryResult = { assets: AssetFact[]; elapsedMs: number };
```

- [ ] **Step 1: Define the shared types**

`src/lib/scan/types.ts`:

```ts
export const SCAN_SCHEMA_VERSION = 1;

export type AssetSubtype = 'photo' | 'video' | 'screenshot' | 'screenRecording';

export type AssetFact = {
  id: string;
  sizeBytes: number;
  width: number;
  height: number;
  durationSeconds: number;
  /** Epoch milliseconds. */
  createdAt: number;
  subtype: AssetSubtype;
  hasCameraExif: boolean;
  isFavorite: boolean;
};

export type CategoryId =
  | 'exactDuplicates'
  | 'similarPhotos'
  | 'screenshots'
  | 'screenRecordings'
  | 'largeVideos'
  | 'notTakenByYou';

/** A set of assets where all but one may be deleted. */
export type AssetGroup = {
  id: string;
  assetIds: string[];
  keeperId: string;
};

/** Videos at or above this size are surfaced as "large". */
export const LARGE_VIDEO_BYTES = 100 * 1024 * 1024;
```

- [ ] **Step 2: Add inventory to the Swift module**

Two things here are deliberately measured rather than assumed. `fileSize` is an undocumented KVC key on `PHAssetResource` (spec §11 risk 2), and camera-EXIF detection reads image headers, which may be slow. Both are timed separately so the benchmark tells us which to optimize.

Add to `PhotoScanModule.swift`, inside `definition()`:

```swift
    AsyncFunction("inventory") { () -> [String: Any] in
      let started = Date()

      let options = PHFetchOptions()
      options.includeHiddenAssets = false
      let fetched = PHAsset.fetchAssets(with: options)

      var assets: [[String: Any]] = []
      assets.reserveCapacity(fetched.count)

      fetched.enumerateObjects { asset, _, _ in
        let resources = PHAssetResource.assetResources(for: asset)

        // Undocumented KVC key. Falls back to a dimension/duration estimate.
        var bytes: Int64 = 0
        for resource in resources {
          if let value = resource.value(forKey: "fileSize") as? Int64 {
            bytes += value
          }
        }
        if bytes == 0 {
          bytes = Self.estimateBytes(asset)
        }

        let subtype: String
        if asset.mediaType == .video {
          subtype = asset.mediaSubtypes.contains(.videoScreenRecording)
            ? "screenRecording" : "video"
        } else {
          subtype = asset.mediaSubtypes.contains(.photoScreenshot)
            ? "screenshot" : "photo"
        }

        assets.append([
          "id": asset.localIdentifier,
          "sizeBytes": bytes,
          "width": asset.pixelWidth,
          "height": asset.pixelHeight,
          "durationSeconds": asset.duration,
          "createdAt": (asset.creationDate?.timeIntervalSince1970 ?? 0) * 1000,
          "subtype": subtype,
          "hasCameraExif": Self.hasCameraExif(resources),
          "isFavorite": asset.isFavorite,
        ])
      }

      return [
        "assets": assets,
        "elapsedMs": Date().timeIntervalSince(started) * 1000,
      ]
    }
```

And these helpers on the class, outside `definition()`:

```swift
  /// Reads only the image header to find a TIFF Make tag. Photos that were
  /// downloaded, saved from a messaging app, or generated have no camera tag.
  private static func hasCameraExif(_ resources: [PHAssetResource]) -> Bool {
    guard let resource = resources.first else { return false }
    guard let url = resource.value(forKey: "privateFileURL") as? URL else { return false }
    let opts = [kCGImageSourceShouldCache: false] as CFDictionary
    guard let source = CGImageSourceCreateWithURL(url as CFURL, opts),
          let props = CGImageSourceCopyPropertiesAtIndex(source, 0, opts)
            as? [CFString: Any],
          let tiff = props[kCGImagePropertyTIFFDictionary] as? [CFString: Any]
    else { return false }
    return tiff[kCGImagePropertyTIFFMake] != nil
  }

  private static func estimateBytes(_ asset: PHAsset) -> Int64 {
    let pixels = Int64(asset.pixelWidth * asset.pixelHeight)
    if asset.mediaType == .video {
      // ~8 Mbit/s is a reasonable middle for iPhone capture.
      return Int64(asset.duration * 1_000_000)
    }
    // HEIC lands near 0.3 bytes/pixel in practice.
    return max(pixels * 3 / 10, 50_000)
  }
```

Add `import CoreGraphics` and `import ImageIO` at the top of the file.

- [ ] **Step 3: Expose it in TypeScript**

Add to `modules/photo-scan/src/PhotoScan.ts`:

```ts
import type { AssetFact } from '@/lib/scan/types';

export type InventoryResult = { assets: AssetFact[]; elapsedMs: number };
```

Extend the `NativeModule` type and add the wrapper:

```ts
type NativeModule = {
  getPhotoPermission(): PhotoPermission;
  requestPhotoPermission(): Promise<PhotoPermission>;
  inventory(): Promise<InventoryResult>;
};

export function inventory(): Promise<InventoryResult> {
  return native.inventory();
}
```

Add to `modules/photo-scan/index.ts`:

```ts
export { inventory, type InventoryResult } from './src/PhotoScan';
```

- [ ] **Step 4: Turn the scratch screen into the benchmark harness**

`src/app/index.tsx`:

```tsx
import { useState } from 'react';
import { Button, ScrollView, Text } from 'react-native';
import { getPhotoPermission, requestPhotoPermission, inventory } from '@modules/photo-scan';

export default function DevScreen() {
  const [status, setStatus] = useState(() => getPhotoPermission());
  const [report, setReport] = useState('');

  async function runBenchmark() {
    setReport('scanning…');
    const { assets, elapsedMs } = await inventory();
    const totalBytes = assets.reduce((sum, a) => sum + a.sizeBytes, 0);
    const noExif = assets.filter((a) => !a.hasCameraExif).length;
    const shots = assets.filter((a) => a.subtype === 'screenshot').length;
    const zeroSize = assets.filter((a) => a.sizeBytes === 0).length;
    setReport(
      [
        `assets:       ${assets.length}`,
        `elapsed:      ${Math.round(elapsedMs)} ms`,
        `per asset:    ${(elapsedMs / Math.max(assets.length, 1)).toFixed(2)} ms`,
        `total size:   ${(totalBytes / 1e9).toFixed(2)} GB`,
        `screenshots:  ${shots}`,
        `no camera:    ${noExif}`,
        `zero-size:    ${zeroSize}`,
      ].join('\n'),
    );
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ padding: 16 }}>
      <Text style={{ fontSize: 24 }}>Make Room</Text>
      <Text style={{ marginVertical: 12 }}>Permission: {status}</Text>
      <Button title="Request access" onPress={async () => setStatus(await requestPhotoPermission())} />
      <Button title="Run inventory benchmark" onPress={runBenchmark} />
      <Text style={{ fontFamily: 'Menlo', marginTop: 16 }}>{report}</Text>
    </ScrollView>
  );
}
```

- [ ] **Step 5: Run the benchmark on a real device with a real library**

Run: `pnpm ios --device`
Expected: a report printing counts and timings.

**Record the numbers in the plan file under "Benchmark results" below before continuing.** This is the whole point of the task.

Decision gates:
- `zero-size` greater than ~1% means the KVC `fileSize` key is unreliable → the estimate fallback needs tuning.
- `no camera` wildly high (over ~60% of a normal library) means the EXIF header read is misfiring → try `kCGImagePropertyExifDictionary` instead, or fall back to `originalFilename` prefix matching.
- `elapsed` over ~10s for a 20k library means header reads dominate → move `hasCameraExif` into Phase 2 as lazy work.

- [ ] **Step 6: Commit with the results**

```bash
git add -A
git commit -m "Add native photo inventory with byte sizes and benchmark harness"
```

---

### Task 4: Categorize assets (pure TypeScript, TDD)

**Files:**
- Create: `src/lib/scan/categorize.ts`, `src/lib/scan/__tests__/categorize.test.ts`

**Interfaces:**
- Consumes: `AssetFact`, `CategoryId`, `LARGE_VIDEO_BYTES` from `@/lib/scan/types`
- Produces: `categorize(asset: AssetFact): CategoryId[]` — the per-asset categories only. Group-based categories (`exactDuplicates`, `similarPhotos`) are assigned in Tasks 5 and 7.

- [ ] **Step 1: Write the failing test**

`src/lib/scan/__tests__/categorize.test.ts`:

```ts
import { categorize } from '@/lib/scan/categorize';
import type { AssetFact } from '@/lib/scan/types';

function asset(over: Partial<AssetFact> = {}): AssetFact {
  return {
    id: 'a1',
    sizeBytes: 2_000_000,
    width: 4032,
    height: 3024,
    durationSeconds: 0,
    createdAt: 1_700_000_000_000,
    subtype: 'photo',
    hasCameraExif: true,
    isFavorite: false,
    ...over,
  };
}

test('an ordinary camera photo has no categories', () => {
  expect(categorize(asset())).toEqual([]);
});

test('a screenshot is categorized as a screenshot', () => {
  expect(categorize(asset({ subtype: 'screenshot' }))).toContain('screenshots');
});

test('a screen recording is categorized as a screen recording', () => {
  expect(categorize(asset({ subtype: 'screenRecording' }))).toContain('screenRecordings');
});

test('a video at or above the threshold is a large video', () => {
  const big = asset({ subtype: 'video', sizeBytes: 100 * 1024 * 1024 });
  expect(categorize(big)).toContain('largeVideos');
});

test('a video below the threshold is not a large video', () => {
  const small = asset({ subtype: 'video', sizeBytes: 100 * 1024 * 1024 - 1 });
  expect(categorize(small)).not.toContain('largeVideos');
});

test('a photo with no camera EXIF was not taken by you', () => {
  expect(categorize(asset({ hasCameraExif: false }))).toContain('notTakenByYou');
});

test('screenshots are not also reported as notTakenByYou', () => {
  // A screenshot obviously has no camera EXIF, but reporting it twice
  // double-counts it in the headline number and confuses the user.
  const result = categorize(asset({ subtype: 'screenshot', hasCameraExif: false }));
  expect(result).toEqual(['screenshots']);
});

test('favourites are never categorized', () => {
  const fav = asset({ subtype: 'screenshot', isFavorite: true, hasCameraExif: false });
  expect(categorize(fav)).toEqual([]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test categorize`
Expected: FAIL — `Cannot find module '@/lib/scan/categorize'`

- [ ] **Step 3: Write the implementation**

`src/lib/scan/categorize.ts`:

```ts
import { LARGE_VIDEO_BYTES, type AssetFact, type CategoryId } from '@/lib/scan/types';

/**
 * Per-asset categories. Group-based categories (exact duplicates, similar
 * photos) are assigned separately because they depend on other assets.
 *
 * Favourites are excluded entirely — if the user hearted it, we don't get a vote.
 */
export function categorize(asset: AssetFact): CategoryId[] {
  if (asset.isFavorite) return [];

  const categories: CategoryId[] = [];

  if (asset.subtype === 'screenshot') categories.push('screenshots');
  if (asset.subtype === 'screenRecording') categories.push('screenRecordings');

  if (
    (asset.subtype === 'video' || asset.subtype === 'screenRecording') &&
    asset.sizeBytes >= LARGE_VIDEO_BYTES
  ) {
    categories.push('largeVideos');
  }

  // Screenshots and recordings never have camera EXIF by definition, so
  // reporting them again here would double-count them for the user.
  if (asset.subtype === 'photo' && !asset.hasCameraExif) {
    categories.push('notTakenByYou');
  }

  return categories;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test categorize`
Expected: 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scan/categorize.ts src/lib/scan/__tests__/categorize.test.ts
git commit -m "Add per-asset categorization"
```

---

### Task 5: Exact duplicates and keeper selection (pure TypeScript, TDD)

This is the **safety-critical** task. `pickKeeper` is the one rule whose failure loses a user's only copy of a photo.

**Files:**
- Create: `src/lib/scan/keeper.ts`, `src/lib/scan/duplicates.ts`, `src/lib/scan/__tests__/keeper.test.ts`, `src/lib/scan/__tests__/duplicates.test.ts`

**Interfaces:**
- Consumes: `AssetFact`, `AssetGroup` from `@/lib/scan/types`
- Produces:
  - `pickKeeper(members: AssetFact[]): AssetFact`
  - `groupExactDuplicates(assets: AssetFact[]): AssetGroup[]`

- [ ] **Step 1: Write the failing keeper test**

`src/lib/scan/__tests__/keeper.test.ts`:

```ts
import { pickKeeper } from '@/lib/scan/keeper';
import type { AssetFact } from '@/lib/scan/types';

function asset(over: Partial<AssetFact> = {}): AssetFact {
  return {
    id: 'a1',
    sizeBytes: 1_000_000,
    width: 1000,
    height: 1000,
    durationSeconds: 0,
    createdAt: 1_700_000_000_000,
    subtype: 'photo',
    hasCameraExif: true,
    isFavorite: false,
    ...over,
  };
}

test('prefers the highest resolution', () => {
  const low = asset({ id: 'low', width: 1000, height: 1000 });
  const high = asset({ id: 'high', width: 2000, height: 2000 });
  expect(pickKeeper([low, high]).id).toBe('high');
});

test('falls back to the largest file when resolution ties', () => {
  const small = asset({ id: 'small', sizeBytes: 1_000_000 });
  const large = asset({ id: 'large', sizeBytes: 3_000_000 });
  expect(pickKeeper([small, large]).id).toBe('large');
});

test('falls back to the oldest when resolution and size tie', () => {
  const newer = asset({ id: 'newer', createdAt: 2_000_000_000_000 });
  const older = asset({ id: 'older', createdAt: 1_000_000_000_000 });
  expect(pickKeeper([newer, older]).id).toBe('older');
});

test('always prefers a favourite, whatever its resolution', () => {
  const big = asset({ id: 'big', width: 4000, height: 4000 });
  const fav = asset({ id: 'fav', width: 100, height: 100, isFavorite: true });
  expect(pickKeeper([big, fav]).id).toBe('fav');
});

test('a single-member group keeps that member', () => {
  expect(pickKeeper([asset({ id: 'only' })]).id).toBe('only');
});

test('throws on an empty group rather than returning undefined', () => {
  // Returning undefined here would let a caller delete every member.
  expect(() => pickKeeper([])).toThrow('pickKeeper requires at least one asset');
});

test('is deterministic regardless of input order', () => {
  const a = asset({ id: 'a', width: 2000, height: 2000 });
  const b = asset({ id: 'b', width: 1000, height: 1000 });
  const c = asset({ id: 'c', width: 3000, height: 3000 });
  expect(pickKeeper([a, b, c]).id).toBe('c');
  expect(pickKeeper([c, b, a]).id).toBe('c');
  expect(pickKeeper([b, c, a]).id).toBe('c');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test keeper`
Expected: FAIL — `Cannot find module '@/lib/scan/keeper'`

- [ ] **Step 3: Write the keeper implementation**

`src/lib/scan/keeper.ts`:

```ts
import type { AssetFact } from '@/lib/scan/types';

/**
 * Chooses the one asset in a group that survives deletion.
 *
 * Order: favourite > highest resolution > largest file > oldest.
 *
 * Throwing on an empty group is deliberate. Returning undefined would let a
 * caller delete every member of a group, which is the one failure mode that
 * loses a user's only copy of a photo.
 */
export function pickKeeper(members: AssetFact[]): AssetFact {
  if (members.length === 0) {
    throw new Error('pickKeeper requires at least one asset');
  }

  return members.reduce((best, candidate) =>
    scoreIsBetter(candidate, best) ? candidate : best,
  );
}

function scoreIsBetter(candidate: AssetFact, best: AssetFact): boolean {
  if (candidate.isFavorite !== best.isFavorite) return candidate.isFavorite;

  const candidatePixels = candidate.width * candidate.height;
  const bestPixels = best.width * best.height;
  if (candidatePixels !== bestPixels) return candidatePixels > bestPixels;

  if (candidate.sizeBytes !== best.sizeBytes) return candidate.sizeBytes > best.sizeBytes;

  if (candidate.createdAt !== best.createdAt) return candidate.createdAt < best.createdAt;

  // Total order on id so the result never depends on input ordering.
  return candidate.id < best.id;
}
```

- [ ] **Step 4: Run the keeper test**

Run: `pnpm test keeper`
Expected: 7 tests pass.

- [ ] **Step 5: Write the failing duplicates test**

`src/lib/scan/__tests__/duplicates.test.ts`:

```ts
import { groupExactDuplicates } from '@/lib/scan/duplicates';
import type { AssetFact } from '@/lib/scan/types';

function asset(over: Partial<AssetFact> = {}): AssetFact {
  return {
    id: 'a1',
    sizeBytes: 1_000_000,
    width: 1000,
    height: 1000,
    durationSeconds: 0,
    createdAt: 1_700_000_000_000,
    subtype: 'photo',
    hasCameraExif: true,
    isFavorite: false,
    ...over,
  };
}

test('identical size and dimensions group together', () => {
  const groups = groupExactDuplicates([asset({ id: 'a' }), asset({ id: 'b' })]);
  expect(groups).toHaveLength(1);
  expect(groups[0].assetIds.sort()).toEqual(['a', 'b']);
});

test('a different byte size means a different group', () => {
  const groups = groupExactDuplicates([
    asset({ id: 'a', sizeBytes: 1_000_000 }),
    asset({ id: 'b', sizeBytes: 1_000_001 }),
  ]);
  expect(groups).toHaveLength(0);
});

test('same size but different dimensions do not group', () => {
  const groups = groupExactDuplicates([
    asset({ id: 'a', width: 1000, height: 1000 }),
    asset({ id: 'b', width: 500, height: 2000 }),
  ]);
  expect(groups).toHaveLength(0);
});

test('groups of one are dropped', () => {
  expect(groupExactDuplicates([asset({ id: 'lonely' })])).toHaveLength(0);
});

test('every group names a keeper that belongs to it', () => {
  const groups = groupExactDuplicates([
    asset({ id: 'a', createdAt: 2000 }),
    asset({ id: 'b', createdAt: 1000 }),
  ]);
  expect(groups[0].assetIds).toContain(groups[0].keeperId);
  expect(groups[0].keeperId).toBe('b'); // oldest wins the tie
});

test('favourites are excluded from duplicate groups entirely', () => {
  const groups = groupExactDuplicates([
    asset({ id: 'a' }),
    asset({ id: 'fav', isFavorite: true }),
  ]);
  // Only one non-favourite remains, so there is no group at all.
  expect(groups).toHaveLength(0);
});

test('a three-way duplicate produces one group of three', () => {
  const groups = groupExactDuplicates([
    asset({ id: 'a' }),
    asset({ id: 'b' }),
    asset({ id: 'c' }),
  ]);
  expect(groups).toHaveLength(1);
  expect(groups[0].assetIds).toHaveLength(3);
});

test('assets with an unknown size never group', () => {
  // Size 0 means the native fallback failed. Grouping on it would match
  // unrelated photos together.
  const groups = groupExactDuplicates([
    asset({ id: 'a', sizeBytes: 0 }),
    asset({ id: 'b', sizeBytes: 0 }),
  ]);
  expect(groups).toHaveLength(0);
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `pnpm test duplicates`
Expected: FAIL — `Cannot find module '@/lib/scan/duplicates'`

- [ ] **Step 7: Write the duplicates implementation**

`src/lib/scan/duplicates.ts`:

```ts
import { pickKeeper } from '@/lib/scan/keeper';
import type { AssetFact, AssetGroup } from '@/lib/scan/types';

/**
 * Exact duplicates need no Vision pass: byte-identical files have identical
 * size and dimensions. Free, exact, and with no false positives.
 */
export function groupExactDuplicates(assets: AssetFact[]): AssetGroup[] {
  const buckets = new Map<string, AssetFact[]>();

  for (const asset of assets) {
    if (asset.isFavorite) continue;
    // A zero size means the native size lookup failed; bucketing on it would
    // match unrelated photos together.
    if (asset.sizeBytes === 0) continue;

    const key = `${asset.sizeBytes}:${asset.width}x${asset.height}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(asset);
    else buckets.set(key, [asset]);
  }

  const groups: AssetGroup[] = [];
  for (const [key, members] of buckets) {
    if (members.length < 2) continue;
    groups.push({
      id: `exact:${key}`,
      assetIds: members.map((m) => m.id),
      keeperId: pickKeeper(members).id,
    });
  }
  return groups;
}
```

- [ ] **Step 8: Run all tests**

Run: `pnpm test && pnpm typecheck`
Expected: all tests pass, no type errors.

- [ ] **Step 9: Commit**

```bash
git add src/lib/scan/keeper.ts src/lib/scan/duplicates.ts src/lib/scan/__tests__/
git commit -m "Add exact duplicate grouping and keeper selection"
```

---

### Task 6: Freed-space estimation without double counting (pure TypeScript, TDD)

The headline number is what the app's credibility rests on. An asset can be both a screenshot and a duplicate; counting it twice inflates the promise and the user notices when the real freed space comes back lower.

**Files:**
- Create: `src/lib/scan/estimate.ts`, `src/lib/scan/__tests__/estimate.test.ts`

**Interfaces:**
- Consumes: `AssetFact`, `AssetGroup` from `@/lib/scan/types`
- Produces:
  - `deletableIds(groups: AssetGroup[]): Set<string>` — every group member except its keeper
  - `estimateFreed(assets: AssetFact[], ids: Set<string>): number` — total bytes

- [ ] **Step 1: Write the failing test**

`src/lib/scan/__tests__/estimate.test.ts`:

```ts
import { deletableIds, estimateFreed } from '@/lib/scan/estimate';
import type { AssetFact, AssetGroup } from '@/lib/scan/types';

function asset(id: string, sizeBytes: number): AssetFact {
  return {
    id,
    sizeBytes,
    width: 1000,
    height: 1000,
    durationSeconds: 0,
    createdAt: 1_700_000_000_000,
    subtype: 'photo',
    hasCameraExif: true,
    isFavorite: false,
  };
}

const group = (id: string, assetIds: string[], keeperId: string): AssetGroup => ({
  id,
  assetIds,
  keeperId,
});

test('the keeper is never deletable', () => {
  const ids = deletableIds([group('g1', ['a', 'b', 'c'], 'a')]);
  expect(ids.has('a')).toBe(false);
  expect(ids.has('b')).toBe(true);
  expect(ids.has('c')).toBe(true);
});

test('an asset appearing in two groups is only counted once', () => {
  const ids = deletableIds([
    group('g1', ['a', 'b'], 'a'),
    group('g2', ['b', 'c'], 'c'),
  ]);
  expect([...ids].sort()).toEqual(['b']);
});

test('estimateFreed sums the bytes of the selected assets', () => {
  const assets = [asset('a', 100), asset('b', 250), asset('c', 400)];
  expect(estimateFreed(assets, new Set(['b', 'c']))).toBe(650);
});

test('estimateFreed never counts the same asset twice', () => {
  const assets = [asset('a', 100), asset('a', 100)];
  expect(estimateFreed(assets, new Set(['a']))).toBe(100);
});

test('estimateFreed ignores ids that are not in the asset list', () => {
  expect(estimateFreed([asset('a', 100)], new Set(['a', 'ghost']))).toBe(100);
});

test('an empty selection frees nothing', () => {
  expect(estimateFreed([asset('a', 100)], new Set())).toBe(0);
});

test('a keeper in one group stays deletable if another group drops it', () => {
  // 'b' is the keeper of g1 but a non-keeper in g2. Deleting it would empty
  // g1, so a keeper anywhere must be protected everywhere.
  const ids = deletableIds([
    group('g1', ['b', 'x'], 'b'),
    group('g2', ['b', 'y'], 'y'),
  ]);
  expect(ids.has('b')).toBe(false);
  expect([...ids].sort()).toEqual(['x']);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test estimate`
Expected: FAIL — `Cannot find module '@/lib/scan/estimate'`

- [ ] **Step 3: Write the implementation**

`src/lib/scan/estimate.ts`:

```ts
import type { AssetFact, AssetGroup } from '@/lib/scan/types';

/**
 * Every group member except its keeper.
 *
 * Keepers are collected across all groups first: an asset that keeps one group
 * alive must not be deleted because a different group happens to list it as a
 * non-keeper. Without that pass, overlapping groups can empty each other.
 */
export function deletableIds(groups: AssetGroup[]): Set<string> {
  const keepers = new Set(groups.map((g) => g.keeperId));

  const deletable = new Set<string>();
  for (const group of groups) {
    for (const id of group.assetIds) {
      if (!keepers.has(id)) deletable.add(id);
    }
  }
  return deletable;
}

/** Total bytes for the selected assets, counting each asset at most once. */
export function estimateFreed(assets: AssetFact[], ids: Set<string>): number {
  const counted = new Set<string>();
  let total = 0;

  for (const asset of assets) {
    if (!ids.has(asset.id) || counted.has(asset.id)) continue;
    counted.add(asset.id);
    total += asset.sizeBytes;
  }
  return total;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test estimate`
Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scan/estimate.ts src/lib/scan/__tests__/estimate.test.ts
git commit -m "Add freed-space estimation with duplicate-safe counting"
```

---

### Task 7: Vision similarity pair detection and benchmark

The **risk-retirement task** for Phase 2 (spec §11 risk 1). Feature print vectors stay native; only cluster IDs cross the bridge.

**Files:**
- Modify: `modules/photo-scan/ios/PhotoScanModule.swift`, `modules/photo-scan/src/PhotoScan.ts`, `modules/photo-scan/index.ts`, `src/app/index.tsx`

**Interfaces:**
- Consumes: `AssetFact[]` from Task 3
- Produces: `findSimilarPairs(assetIds: string[]): Promise<SimilarPairsResult>` where

```ts
type SimilarPairsResult = {
  /** Asset id pairs whose feature-print distance is below the threshold. */
  pairs: [string, string][];
  elapsedMs: number;
  comparedCount: number;
};
```

Native code returns **edges, not clusters**. Feature print vectors still never cross the bridge — only the pairs that survive the threshold do, which is a tiny payload. Grouping those edges into clusters is transitive logic that can silently merge unrelated photos when it goes wrong, so it belongs in TypeScript where Task 8 tests it.

- [ ] **Step 1: Add clustering to the Swift module**

Time bucketing is the optimization that makes this viable: near-duplicates are overwhelmingly shots taken seconds apart, so only assets clustered in time are feature-printed at all.

Add `import Vision` at the top of `PhotoScanModule.swift`, then inside `definition()`:

```swift
    AsyncFunction("findSimilarPairs") { (assetIds: [String]) -> [String: Any] in
      let started = Date()

      let fetched = PHAsset.fetchAssets(withLocalIdentifiers: assetIds, options: nil)
      var assets: [PHAsset] = []
      fetched.enumerateObjects { asset, _, _ in assets.append(asset) }
      assets.sort {
        ($0.creationDate ?? .distantPast) < ($1.creationDate ?? .distantPast)
      }

      // Bucket by time proximity: consecutive shots within the window belong
      // to the same candidate bucket. Only buckets of 2+ are worth comparing.
      // Buckets are capped so one long burst cannot blow up memory or run an
      // enormous O(n^2) comparison.
      var buckets: [[PHAsset]] = []
      var current: [PHAsset] = []
      for asset in assets {
        let tooFarApart: Bool
        if let last = current.last,
           let a = last.creationDate, let b = asset.creationDate {
          tooFarApart = b.timeIntervalSince(a) > Self.bucketWindowSeconds
        } else {
          tooFarApart = false
        }
        if tooFarApart || current.count >= Self.maxBucketSize {
          if current.count > 1 { buckets.append(current) }
          current = []
        }
        current.append(asset)
      }
      if current.count > 1 { buckets.append(current) }

      var pairs: [[String]] = []
      var compared = 0

      for bucket in buckets {
        // Feature prints for this bucket only; they never leave native code.
        var prints: [(id: String, observation: VNFeaturePrintObservation)] = []
        for asset in bucket {
          if let p = Self.featurePrint(for: asset) {
            prints.append((asset.localIdentifier, p))
          }
        }

        for i in 0..<prints.count {
          for j in (i + 1)..<prints.count {
            var distance = Float(0)
            try? prints[j].observation.computeDistance(&distance, to: prints[i].observation)
            compared += 1
            if distance < Self.similarityThreshold {
              pairs.append([prints[i].id, prints[j].id])
            }
          }
        }
      }

      return [
        "pairs": pairs,
        "elapsedMs": Date().timeIntervalSince(started) * 1000,
        "comparedCount": compared,
      ]
    }
```

Add these constants and the feature print helper to the class:

```swift
  /// Photos taken more than this far apart are never compared.
  private static let bucketWindowSeconds: TimeInterval = 300

  /// Hard cap on bucket size. Comparison is O(n^2) within a bucket, so one
  /// very long burst would otherwise dominate the entire scan.
  private static let maxBucketSize = 50

  /// Vision feature print distance below which two images are "similar".
  /// 0.35 is the commonly used starting point; tune against real results.
  private static let similarityThreshold: Float = 0.35

  /// Small thumbnails are enough for a feature print and far faster than
  /// decoding full-resolution originals.
  private static func featurePrint(for asset: PHAsset) -> VNFeaturePrintObservation? {
    let options = PHImageRequestOptions()
    options.isSynchronous = true
    options.deliveryMode = .fastFormat
    options.resizeMode = .fast
    options.isNetworkAccessAllowed = false

    var image: UIImage?
    PHImageManager.default().requestImage(
      for: asset,
      targetSize: CGSize(width: 224, height: 224),
      contentMode: .aspectFit,
      options: options
    ) { result, _ in image = result }

    guard let cgImage = image?.cgImage else { return nil }

    let request = VNGenerateImageFeaturePrintRequest()
    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    try? handler.perform([request])
    return request.results?.first as? VNFeaturePrintObservation
  }
```

- [ ] **Step 2: Expose it in TypeScript**

Add to `modules/photo-scan/src/PhotoScan.ts`:

```ts
export type SimilarPairsResult = {
  pairs: [string, string][];
  elapsedMs: number;
  comparedCount: number;
};
```

Extend `NativeModule` and add the wrapper:

```ts
type NativeModule = {
  getPhotoPermission(): PhotoPermission;
  requestPhotoPermission(): Promise<PhotoPermission>;
  inventory(): Promise<InventoryResult>;
  findSimilarPairs(assetIds: string[]): Promise<SimilarPairsResult>;
};

export function findSimilarPairs(assetIds: string[]): Promise<SimilarPairsResult> {
  return native.findSimilarPairs(assetIds);
}
```

Add to `modules/photo-scan/index.ts`:

```ts
export { findSimilarPairs, type SimilarPairsResult } from './src/PhotoScan';
```

- [ ] **Step 3: Extend the benchmark harness**

Add to `runBenchmark` in `src/app/index.tsx`, after the inventory report:

```tsx
    const photoIds = assets
      .filter((a) => a.subtype === 'photo' && !a.isFavorite)
      .map((a) => a.id);
    const sim = await findSimilarPairs(photoIds);
    const touched = new Set(sim.pairs.flat()).size;
    setReport((prev) =>
      [
        prev,
        '',
        `-- similarity --`,
        `candidates:   ${photoIds.length}`,
        `compared:     ${sim.comparedCount} pairs`,
        `similar:      ${sim.pairs.length} pairs`,
        `assets hit:   ${touched}`,
        `elapsed:      ${Math.round(sim.elapsedMs)} ms`,
      ].join('\n'),
    );
```

Import `findSimilarPairs` from `@modules/photo-scan` at the top of the file.

- [ ] **Step 4: Run the benchmark on a real device**

Run: `pnpm ios --device`
Expected: a similarity report with real timings.

**Record the numbers under "Benchmark results" below.**

Decision gates:
- `elapsed` over ~60s → shrink `bucketWindowSeconds` to 60, or drop `targetSize` to 128×128.
- `similar` near zero on a library you know has burst shots → the threshold is too tight; raise toward 0.5 and re-check.
- `assets hit` implausibly high (most of the library) → the threshold is too loose; lower toward 0.25.
- Memory spikes on a long burst → lower `maxBucketSize` below 50.

- [ ] **Step 5: Commit with the results**

```bash
git add -A
git commit -m "Add Vision similarity pair detection with time bucketing"
```

---

### Task 8: Cluster similar pairs into groups (pure TypeScript, TDD)

Native code found which *pairs* look alike. Turning those edges into groups is transitive: if A matches B and B matches C, all three belong together even though A and C were never compared. Getting this wrong silently merges unrelated photos, so it is tested.

**Files:**
- Create: `src/lib/scan/similar.ts`, `src/lib/scan/__tests__/similar.test.ts`

**Interfaces:**
- Consumes: `AssetFact`, `AssetGroup` from `@/lib/scan/types`; `pickKeeper` from `@/lib/scan/keeper`
- Produces: `clusterBySimilarity(assets: AssetFact[], pairs: [string, string][]): AssetGroup[]`

- [ ] **Step 1: Write the failing test**

`src/lib/scan/__tests__/similar.test.ts`:

```ts
import { clusterBySimilarity } from '@/lib/scan/similar';
import type { AssetFact } from '@/lib/scan/types';

function asset(id: string, over: Partial<AssetFact> = {}): AssetFact {
  return {
    id,
    sizeBytes: 1_000_000,
    width: 1000,
    height: 1000,
    durationSeconds: 0,
    createdAt: 1_700_000_000_000,
    subtype: 'photo',
    hasCameraExif: true,
    isFavorite: false,
    ...over,
  };
}

test('a single pair becomes one group of two', () => {
  const groups = clusterBySimilarity([asset('a'), asset('b')], [['a', 'b']]);
  expect(groups).toHaveLength(1);
  expect(groups[0].assetIds.sort()).toEqual(['a', 'b']);
});

test('clustering is transitive across an unmeasured pair', () => {
  // a~b and b~c were measured; a~c never was, but all three are one group.
  const assets = [asset('a'), asset('b'), asset('c')];
  const groups = clusterBySimilarity(assets, [
    ['a', 'b'],
    ['b', 'c'],
  ]);
  expect(groups).toHaveLength(1);
  expect(groups[0].assetIds.sort()).toEqual(['a', 'b', 'c']);
});

test('disjoint pairs stay in separate groups', () => {
  const assets = [asset('a'), asset('b'), asset('c'), asset('d')];
  const groups = clusterBySimilarity(assets, [
    ['a', 'b'],
    ['c', 'd'],
  ]);
  expect(groups).toHaveLength(2);
});

test('no pairs means no groups', () => {
  expect(clusterBySimilarity([asset('a'), asset('b')], [])).toHaveLength(0);
});

test('every group names a keeper that belongs to it', () => {
  const assets = [asset('a', { width: 500, height: 500 }), asset('b')];
  const groups = clusterBySimilarity(assets, [['a', 'b']]);
  expect(groups[0].assetIds).toContain(groups[0].keeperId);
  expect(groups[0].keeperId).toBe('b'); // higher resolution wins
});

test('a favourite is dropped from the group rather than deleted', () => {
  const assets = [asset('a'), asset('fav', { isFavorite: true }), asset('c')];
  const groups = clusterBySimilarity(assets, [
    ['a', 'fav'],
    ['fav', 'c'],
  ]);
  // 'fav' is excluded entirely; a and c were never directly paired, so they
  // must not be silently merged through a favourite.
  expect(groups).toHaveLength(0);
});

test('pairs referencing unknown ids are ignored', () => {
  const groups = clusterBySimilarity([asset('a')], [['a', 'ghost']]);
  expect(groups).toHaveLength(0);
});

test('group ids are stable regardless of pair ordering', () => {
  const assets = [asset('a'), asset('b'), asset('c')];
  const forward = clusterBySimilarity(assets, [['a', 'b'], ['b', 'c']]);
  const reverse = clusterBySimilarity(assets, [['c', 'b'], ['b', 'a']]);
  expect(forward[0].id).toBe(reverse[0].id);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test similar`
Expected: FAIL — `Cannot find module '@/lib/scan/similar'`

- [ ] **Step 3: Write the implementation**

`src/lib/scan/similar.ts`:

```ts
import { pickKeeper } from '@/lib/scan/keeper';
import type { AssetFact, AssetGroup } from '@/lib/scan/types';

/**
 * Groups assets from pairwise similarity edges using union-find.
 *
 * Transitivity matters: native code only compares assets inside the same time
 * bucket, so A~B and B~C can both be measured while A~C never is. All three
 * still belong to one group.
 *
 * Favourites are removed before clustering, not after. Removing them after
 * would let a favourite act as a bridge joining two otherwise unrelated
 * photos into a single group.
 */
export function clusterBySimilarity(
  assets: AssetFact[],
  pairs: [string, string][],
): AssetGroup[] {
  const byId = new Map(
    assets.filter((a) => !a.isFavorite).map((a) => [a.id, a]),
  );

  const parent = new Map<string, string>();

  function find(id: string): string {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root) as string;
    let walk = id;
    while (parent.get(walk) !== root) {
      const next = parent.get(walk) as string;
      parent.set(walk, root);
      walk = next;
    }
    return root;
  }

  function union(a: string, b: string): void {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA === rootB) return;
    // Union by smaller id so group ids do not depend on pair ordering.
    if (rootA < rootB) parent.set(rootB, rootA);
    else parent.set(rootA, rootB);
  }

  for (const [a, b] of pairs) {
    if (!byId.has(a) || !byId.has(b)) continue;
    if (!parent.has(a)) parent.set(a, a);
    if (!parent.has(b)) parent.set(b, b);
    union(a, b);
  }

  const members = new Map<string, AssetFact[]>();
  for (const id of parent.keys()) {
    const root = find(id);
    const asset = byId.get(id);
    if (!asset) continue;
    const bucket = members.get(root);
    if (bucket) bucket.push(asset);
    else members.set(root, [asset]);
  }

  const groups: AssetGroup[] = [];
  for (const [root, group] of members) {
    if (group.length < 2) continue;
    groups.push({
      id: `sim:${root}`,
      assetIds: group.map((a) => a.id),
      keeperId: pickKeeper(group).id,
    });
  }
  return groups;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test similar`
Expected: 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scan/similar.ts src/lib/scan/__tests__/similar.test.ts
git commit -m "Add transitive clustering of similar photo pairs"
```

---

### Task 9: SQLite cache and incremental diff

Caching is what makes the weekly review instant in Plan 3 — it processes only ~7 days of new media instead of rescanning the library.

**Files:**
- Create: `src/lib/scan/cache.ts`

**Interfaces:**
- Consumes: `AssetFact`, `SCAN_SCHEMA_VERSION` from `@/lib/scan/types`
- Produces:
  - `openCache(): Promise<SQLiteDatabase>`
  - `loadCached(db): Promise<AssetFact[]>`
  - `saveAssets(db, assets: AssetFact[]): Promise<void>`
  - `saveClusters(db, clusters: Record<string, string>): Promise<void>`
  - `pruneMissing(db, liveIds: string[]): Promise<number>`

- [ ] **Step 1: Write the cache module**

`src/lib/scan/cache.ts`:

```ts
import * as SQLite from 'expo-sqlite';
import { SCAN_SCHEMA_VERSION, type AssetFact, type AssetSubtype } from '@/lib/scan/types';

type Row = {
  id: string;
  sizeBytes: number;
  width: number;
  height: number;
  durationSeconds: number;
  createdAt: number;
  subtype: string;
  hasCameraExif: number;
  isFavorite: number;
};

export async function openCache(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(`make-room-v${SCAN_SCHEMA_VERSION}.db`);
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS assets (
      id               TEXT PRIMARY KEY NOT NULL,
      sizeBytes        INTEGER NOT NULL,
      width            INTEGER NOT NULL,
      height           INTEGER NOT NULL,
      durationSeconds  REAL    NOT NULL,
      createdAt        INTEGER NOT NULL,
      subtype          TEXT    NOT NULL,
      hasCameraExif    INTEGER NOT NULL,
      isFavorite       INTEGER NOT NULL,
      clusterId        TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_assets_created ON assets(createdAt);
  `);
  return db;
}

export async function loadCached(db: SQLite.SQLiteDatabase): Promise<AssetFact[]> {
  const rows = await db.getAllAsync<Row>('SELECT * FROM assets');
  return rows.map((r) => ({
    id: r.id,
    sizeBytes: r.sizeBytes,
    width: r.width,
    height: r.height,
    durationSeconds: r.durationSeconds,
    createdAt: r.createdAt,
    subtype: r.subtype as AssetSubtype,
    hasCameraExif: r.hasCameraExif === 1,
    isFavorite: r.isFavorite === 1,
  }));
}

export async function saveAssets(
  db: SQLite.SQLiteDatabase,
  assets: AssetFact[],
): Promise<void> {
  if (assets.length === 0) return;
  const statement = await db.prepareAsync(`
    INSERT INTO assets
      (id, sizeBytes, width, height, durationSeconds, createdAt, subtype, hasCameraExif, isFavorite)
    VALUES ($id, $size, $w, $h, $dur, $created, $subtype, $exif, $fav)
    ON CONFLICT(id) DO UPDATE SET
      sizeBytes = excluded.sizeBytes,
      isFavorite = excluded.isFavorite
  `);
  try {
    await db.withTransactionAsync(async () => {
      for (const a of assets) {
        await statement.executeAsync({
          $id: a.id,
          $size: a.sizeBytes,
          $w: a.width,
          $h: a.height,
          $dur: a.durationSeconds,
          $created: a.createdAt,
          $subtype: a.subtype,
          $exif: a.hasCameraExif ? 1 : 0,
          $fav: a.isFavorite ? 1 : 0,
        });
      }
    });
  } finally {
    await statement.finalizeAsync();
  }
}

export async function saveClusters(
  db: SQLite.SQLiteDatabase,
  clusters: Record<string, string>,
): Promise<void> {
  const entries = Object.entries(clusters);
  if (entries.length === 0) return;
  const statement = await db.prepareAsync(
    'UPDATE assets SET clusterId = $cluster WHERE id = $id',
  );
  try {
    await db.withTransactionAsync(async () => {
      for (const [id, cluster] of entries) {
        await statement.executeAsync({ $id: id, $cluster: cluster });
      }
    });
  } finally {
    await statement.finalizeAsync();
  }
}

/** Drops cached rows for assets the user deleted outside Make Room. */
export async function pruneMissing(
  db: SQLite.SQLiteDatabase,
  liveIds: string[],
): Promise<number> {
  const live = new Set(liveIds);
  const cached = await db.getAllAsync<{ id: string }>('SELECT id FROM assets');
  const stale = cached.filter((r) => !live.has(r.id)).map((r) => r.id);
  if (stale.length === 0) return 0;

  await db.withTransactionAsync(async () => {
    for (const id of stale) {
      await db.runAsync('DELETE FROM assets WHERE id = ?', id);
    }
  });
  return stale.length;
}
```

- [ ] **Step 2: Verify against the device**

The cache needs a real SQLite runtime, so it is exercised on device rather than in Jest. Add a temporary button to `src/app/index.tsx`:

```tsx
      <Button
        title="Test cache round-trip"
        onPress={async () => {
          const db = await openCache();
          const { assets } = await inventory();
          await saveAssets(db, assets);
          const back = await loadCached(db);
          const pruned = await pruneMissing(db, assets.map((a) => a.id));
          setReport(
            `saved ${assets.length}, loaded ${back.length}, pruned ${pruned}`,
          );
        }}
      />
```

Import `openCache, saveAssets, loadCached, pruneMissing` from `@/lib/scan/cache`.

Run: `pnpm ios --device`, tap the button.
Expected: `saved N, loaded N, pruned 0` with the same N in both positions. Tapping again gives the same result (upsert is idempotent).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "Add SQLite scan cache with incremental upsert and pruning"
```

---

### Task 10: Scanner orchestration with streaming phases

Ties everything together. This is the only file that touches both the native module and the cache; everything else stays pure.

**Files:**
- Create: `src/lib/scan/scanner.ts`
- Modify: `src/app/index.tsx`

**Interfaces:**
- Consumes: everything from Tasks 3–9
- Produces:

```ts
type ScanProgress =
  | { phase: 'inventory'; assetCount: number }
  | { phase: 'categorized'; result: ScanResult }
  | { phase: 'similarity'; result: ScanResult };

type ScanResult = {
  assets: AssetFact[];
  groups: AssetGroup[];
  perCategory: Record<CategoryId, { assetIds: string[]; bytes: number }>;
  deletableIds: Set<string>;
  totalFreeableBytes: number;
};

function runScan(onProgress: (p: ScanProgress) => void): Promise<ScanResult>;
```

- [ ] **Step 1: Extend the shared types**

Append to `src/lib/scan/types.ts`:

```ts
export type CategoryBucket = { assetIds: string[]; bytes: number };

export type ScanResult = {
  assets: AssetFact[];
  groups: AssetGroup[];
  perCategory: Record<CategoryId, CategoryBucket>;
  deletableIds: Set<string>;
  totalFreeableBytes: number;
};

export type ScanProgress =
  | { phase: 'inventory'; assetCount: number }
  | { phase: 'categorized'; result: ScanResult }
  | { phase: 'similarity'; result: ScanResult };

export const ALL_CATEGORIES: CategoryId[] = [
  'exactDuplicates',
  'similarPhotos',
  'screenshots',
  'screenRecordings',
  'largeVideos',
  'notTakenByYou',
];
```

- [ ] **Step 2: Write the scanner**

`src/lib/scan/scanner.ts`:

```ts
import { inventory, findSimilarPairs } from '@modules/photo-scan';
import { categorize } from '@/lib/scan/categorize';
import { groupExactDuplicates } from '@/lib/scan/duplicates';
import { clusterBySimilarity } from '@/lib/scan/similar';
import { deletableIds, estimateFreed } from '@/lib/scan/estimate';
import { openCache, saveAssets, saveClusters, pruneMissing } from '@/lib/scan/cache';
import {
  ALL_CATEGORIES,
  type AssetFact,
  type AssetGroup,
  type CategoryBucket,
  type CategoryId,
  type ScanProgress,
  type ScanResult,
} from '@/lib/scan/types';

/**
 * Two-phase scan. Phase 1 is metadata only and produces the headline number
 * within seconds. Phase 2 runs Vision and refines the number upward, so the
 * caller renders twice rather than waiting for everything.
 */
export async function runScan(
  onProgress: (progress: ScanProgress) => void,
): Promise<ScanResult> {
  const db = await openCache();

  // --- Phase 1: fast inventory ------------------------------------------
  const { assets } = await inventory();
  onProgress({ phase: 'inventory', assetCount: assets.length });

  await saveAssets(db, assets);
  await pruneMissing(db, assets.map((a) => a.id));

  const exactGroups = groupExactDuplicates(assets);
  const phase1 = assemble(assets, exactGroups);
  onProgress({ phase: 'categorized', result: phase1 });

  // --- Phase 2: similarity ----------------------------------------------
  const candidates = assets
    .filter((a) => a.subtype === 'photo' && !a.isFavorite)
    .map((a) => a.id);

  const { pairs } = await findSimilarPairs(candidates);
  const similarGroups = clusterBySimilarity(assets, pairs);
  await saveClusters(db, clusterMap(similarGroups));

  const final = assemble(assets, [...exactGroups, ...similarGroups]);
  onProgress({ phase: 'similarity', result: final });

  return final;
}

/** Flattens groups into the asset id → cluster id shape the cache stores. */
function clusterMap(groups: AssetGroup[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const group of groups) {
    for (const id of group.assetIds) map[id] = group.id;
  }
  return map;
}

function assemble(assets: AssetFact[], groups: AssetGroup[]): ScanResult {
  // Keepers are computed across all groups at once, so an asset that keeps
  // one group alive is protected even if another group lists it as surplus.
  const deletable = deletableIds(groups);
  const keepers = new Set(groups.map((g) => g.keeperId));

  const buckets = new Map<CategoryId, Set<string>>(
    ALL_CATEGORIES.map((id) => [id, new Set<string>()]),
  );

  // Group-based categories: only the surplus members, never the keeper.
  for (const group of groups) {
    const category: CategoryId = group.id.startsWith('exact:')
      ? 'exactDuplicates'
      : 'similarPhotos';
    for (const id of group.assetIds) {
      if (deletable.has(id)) buckets.get(category)?.add(id);
    }
  }

  // Per-asset categories. A keeper stays out of every bucket: it is the copy
  // we promised to leave behind, even if it is also a screenshot.
  for (const asset of assets) {
    if (keepers.has(asset.id)) continue;
    for (const category of categorize(asset)) {
      buckets.get(category)?.add(asset.id);
      deletable.add(asset.id);
    }
  }

  const perCategory = Object.fromEntries(
    ALL_CATEGORIES.map((id): [CategoryId, CategoryBucket] => {
      const ids = buckets.get(id) ?? new Set<string>();
      return [id, { assetIds: [...ids], bytes: estimateFreed(assets, ids) }];
    }),
  ) as Record<CategoryId, CategoryBucket>;

  return {
    assets,
    groups,
    perCategory,
    deletableIds: deletable,
    // Summed over the whole set, so an asset in two categories counts once.
    totalFreeableBytes: estimateFreed(assets, deletable),
  };
}
```

- [ ] **Step 3: Render the full scan on the scratch screen**

Replace `runBenchmark` in `src/app/index.tsx` with:

```tsx
  async function runFullScan() {
    setReport('scanning…');
    await runScan((progress) => {
      if (progress.phase === 'inventory') {
        setReport(`found ${progress.assetCount} assets, categorizing…`);
        return;
      }
      const { perCategory, totalFreeableBytes } = progress.result;
      const lines = [
        `phase:        ${progress.phase}`,
        `freeable:     ${(totalFreeableBytes / 1e9).toFixed(2)} GB`,
        '',
        ...ALL_CATEGORIES.map(
          (c) =>
            `${c.padEnd(18)} ${String(perCategory[c].assetIds.length).padStart(5)}  ` +
            `${(perCategory[c].bytes / 1e9).toFixed(2)} GB`,
        ),
      ];
      setReport(lines.join('\n'));
    });
  }
```

Import `runScan` from `@/lib/scan/scanner` and `ALL_CATEGORIES` from `@/lib/scan/types`.

- [ ] **Step 4: Run the full scan on a real device**

Run: `pnpm ios --device`
Expected: the report updates twice — first with exact duplicates and per-asset categories, then again with similar photos folded in and a higher freeable total.

Sanity checks against the spec's safety rules:
- No favourited photo appears in any category.
- `freeable` after Phase 2 is greater than or equal to Phase 1, never lower.
- Every duplicate group has at least one asset absent from `deletableIds`.

- [ ] **Step 5: Run the full test suite and typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: all tests pass, no type errors.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add two-phase scan orchestration with streaming progress"
```

---

## Benchmark results

**Fill this in during Tasks 3 and 7.** Plan 2 (Cleaning UI) is written against these numbers, so they must be real measurements, not estimates.

| Metric | Value | Device / library size |
|---|---|---|
| Inventory elapsed | | |
| Inventory per asset | | |
| Zero-size assets | | |
| No-camera-EXIF share | | |
| Similarity candidates | | |
| Similarity pairs compared | | |
| Similarity elapsed | | |
| Similar groups found | | |

**If Phase 2 exceeds ~60s**, apply the spec's §11 fallbacks in this order: reduce `targetSize` to 128×128 → reduce `bucketWindowSeconds` to 60 → make similarity lazy, running only when the user taps "Go further".

---

## Definition of done

- [ ] `pnpm test` green — 38 unit tests across categorize, keeper, duplicates, similar, estimate
- [ ] `pnpm typecheck` clean
- [ ] A full scan runs on a real device against a real photo library
- [ ] Benchmark results table filled in with measured numbers
- [ ] No favourited asset appears in any category
- [ ] Every group retains exactly one keeper
- [ ] All work committed and pushed
