# Make Room

iOS-only Expo app that helps older / non-technical iPhone owners recover storage.
Free forever, no backend, no accounts, no analytics, **no network calls of any kind**.

Read `PRODUCT.md` (product truth) and `DESIGN.md` (visual contract) before any
substantive change. Both are binding, not background.

## The one test that settles arguments

> Would a frightened 70-year-old understand this alone, with no one in the room?

The wedge is *radical simplicity*, not better detection. A feature that improves
accuracy but adds a concept loses.

## Commands

| | |
|---|---|
| Tests | `pnpm test` (jest, 46 tests, no device needed) |
| Types | `pnpm typecheck` |
| Lint | `pnpm lint` |
| Build | `pnpm build:ios` (EAS, production profile) |
| Publish | **never run these** — `pnpm submit:ios`, `pnpm ota:update` are Bernardo's |

`pnpm test` and `pnpm typecheck` must both pass before any commit.

## Architecture

**One Swift file, everything else TypeScript.**
`modules/photo-scan/ios/PhotoScanModule.swift` is the only native code. It does
per-pixel and PhotoKit work and nothing else: inventory, Vision feature-print
pairs, batch delete, permissions.

**All product logic is pure TS in `src/lib/scan/`** — `assemble`, `categorize`,
`duplicates`, `similar`, `keeper`, `estimate`, plus `cache.ts` (expo-sqlite) and
`scanner.ts` (the two-phase orchestrator). This is why it is testable without a
device, and it is the reason for the split. Keep it that way: **if a change can
live in TS, it lives in TS.**

**Native returns pairs, TS makes clusters.** `findSimilarPairs` deliberately
returns unordered id pairs, never groups. Transitive grouping can silently merge
unrelated photos, so it lives in `similar.ts` under test. Do not move it native.

**Feature prints never cross the bridge.** They are several KB each; a large
library would be hundreds of MB. Distances are computed in Swift.

**Two-phase scan.** Phase 1 (metadata) renders a real number in seconds; phase 2
(Vision) refines it upward. The caller renders twice rather than showing a blank
progress bar. Preserve this — the audience abandons anything that looks like work.

## Conventions

- Imports: `@/*` → `src/*`, `@modules/*` → `modules/*`. Absolute, always.
- Screens are expo-router files under `src/app/`; three tabs via `NativeTabs`
  (Clean / This Week / Guides). No custom global nav — real `UITabBar` is what
  makes Liquid Glass appear for free on iOS 26.
- Colors and type come from `src/lib/ui/theme.ts` and the tables in `DESIGN.md`.
  Never hard-code a hex or a point size.
- `amber` means exactly one thing: **armed for deletion**. It never decorates.
- Every size the user reads is human units ("4.2 GB"), never bytes.
- Component names carry domain context (`MainBreaker`, `Directory`, `Nameplate`).
- Tests live in `src/lib/scan/__tests__/` and use `fixtures.ts`. New scan logic
  ships with tests; UI does not need them.

## Safety rules (load-bearing — a violation is a product failure)

Trust is the product. These are enforced in `categorize.ts` / `keeper.ts` and
must stay enforced:

1. **Favourites are never offered for deletion.** `categorize()` returns `[]` for
   any favourited asset, before anything else.
2. **Every group keeps exactly one asset.** A duplicate group that offers all its
   members is a bug that loses a photo.
3. **Never double-count.** Screenshots are excluded from "Photos you didn't take"
   for this reason.
4. **Report the truth after the fact.** Show the estimate, then the real freed
   bytes, and explain the gap rather than hiding it.
5. **Recently Deleted (30 days) is stated at the moment of decision**, not in a
   help page.

## Hard limits — confirmed, permanent, do not reopen

**iOS sandbox.** No app can read or delete another app's storage. WhatsApp's
private container is unreachable, a per-app storage breakdown is impossible, and
`App-Prefs:root=…` deep links to Settings are private API and a standard
rejection. Every "storage cleaner" on the App Store is really a photo-library
cleaner. The `Guides` tab exists to say this honestly.

**But note the important nuance:** WhatsApp on iOS auto-saves received media to
the camera roll by default ("Save to Camera Roll" in WhatsApp → Settings →
Chats). That media *is* in the Photos library and Make Room can already see and
delete it — the app just does not label it as WhatsApp today. Reaching *into*
WhatsApp is impossible; reaching the copies it left in Photos is not.

**Ruled out of v1, deliberately:**
- Blurry-photo and burst detection — false positives on intentional
  shallow-focus shots erode trust, and trust is the product.
- Android — PhotoKit and Vision are Apple-only.

## Build & release gotchas

- **`app.json` owns the build number.** `eas.json` uses
  `"appVersionSource": "local"`. This diverges from quiztadores/splitea, which
  use `remote` — the remote counter silently reset to 1 on a bundle-ID change and
  nearly produced an unsubmittable build.
- **App Store Connect burns version+build pairs forever.** `0.1.0 (3)` is
  permanently consumed; deleting the build does not free it. Build numbers must
  strictly increase within a version.
- **`autoIncrement` fires even on failed builds.** A build that dies at the
  credentials step still bumps `buildNumber` and leaves it uncommitted. Expect
  drift after retries and commit it.
- **iOS cannot be compiled on this Mac.** The iOS 26.5 SDK is installed but there
  are zero simulator runtimes, so `xcodebuild` reports no destinations.
  `swiftc -parse` checks syntax only; real compilation happens on EAS.
- **`sed` on macOS needs `LC_ALL=C`** — without it `sed -i ''` aborts with
  "illegal byte sequence" on files containing em dashes and leaves a rename
  half-applied. Always grep afterwards.
- **The iTunes Search API cannot detect App Store name reservations** — it only
  lists published apps. "Limpio" was clear there but already reserved, which
  killed the original name. Verify any rename in App Store Connect itself.
- Cosmetic: `app.json` still has `"slug": "limpio"` and the Expo dashboard still
  shows `@bernardorubin/limpio`. There is no CLI rename; it does not affect builds.

## Unmeasured — treat as suspected, not fact

None of these have been validated against a real photo library. Ask Bernardo what
he actually saw before changing any of them.

- **Scan performance.** No timings recorded. Tuning constants sit at the bottom of
  `PhotoScanModule.swift`: `bucketWindowSeconds` 300, `maxBucketSize` 50,
  `similarityThreshold` 0.35. If phase 2 exceeds ~60s the documented fallbacks in
  order are: Vision `targetSize` → 128×128, `bucketWindowSeconds` → 60, then make
  similarity lazy behind "Go further".
- **`similarityThreshold` 0.35** is published guidance, never calibrated here.
  Too tight yields no groups; too loose groups unrelated photos and damages trust.
- **`isCameraOriginal`** is a filename heuristic (`IMG_1234` / `DSC01234` =
  camera). Note the comment above it in Swift claims WhatsApp writes
  `IMG-20240115-WA0001.jpg` — **that is the Android pattern.** On iOS, WhatsApp
  assigns random alphanumeric or UUID-style names (`AJXQ8273.JPG`,
  `7d3cd6be-….jpeg`), so the heuristic still classifies them as not-camera, but
  for a different reason than the comment states. A stronger signal for a future
  pass is the absence of the `{MakerApple}` EXIF dictionary.

## Accessibility is a requirement, not a checkbox

The audience makes it the core of the product: Dynamic Type to the largest
accessibility sizes with no fixed point sizes, 44×44pt minimum targets (the main
breaker is 64pt), never meaning in color alone, full VoiceOver labelling
including live progress and the freed-space result, Reduce Motion respected
(instant flag change, haptics kept), WCAG AA contrast minimum.

## Where things are

```
modules/photo-scan/ios/PhotoScanModule.swift   the only Swift
src/lib/scan/                                   all product logic + tests
src/lib/guides/content.ts                       honest walkthroughs for sandbox limits
src/lib/ui/theme.ts                             palette and type tokens
src/app/(tabs)/                                 Clean, This Week, Guides
src/components/                                 breaker panel components
scripts/make-icon.py                            regenerates the icon, stdlib only
docs/superpowers/specs/                         design specs
docs/superpowers/plans/                         implementation plans
```

Blueprint projects on the same SDK 57, useful for conventions: `../100workout`
(has its own local Vision Swift module), `../quiztadores`, `../splitea`.
