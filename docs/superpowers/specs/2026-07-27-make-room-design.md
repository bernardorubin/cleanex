# CleanEx — Design

**Date:** 2026-07-27
**Status:** Approved, ready for implementation planning
**Platform:** iOS only (17+)

---

## 1. Problem

iPhone storage is confusing for non-technical people. The origin case: a father whose phone
is full of WhatsApp photos that never appear in his gallery. To clear them he has to find a
settings menu buried three levels inside another app. He cannot keep his phone clean because
the system never explains where the space went.

The goal is to help people manage iPhone storage more clearly than iOS does.

## 2. Hard constraints

These were verified before design and are permanent. They are not Expo limitations — a fully
native Swift app cannot do them either.

| Not possible | Why |
|---|---|
| Read another app's storage (e.g. WhatsApp's media) | iOS sandbox — each app's container is private to it |
| Delete another app's files | Same |
| Detect a photo duplicated between Photos and WhatsApp | We can only see the Photos copy |
| Show a per-app storage breakdown | That screen is Apple-private |
| Deep-link to Settings → General → iPhone Storage | `App-Prefs:root=…` is private API and a standard App Store rejection |

Only `Linking.openSettings()` (the app's own settings page) is permitted.

**Consequence:** every storage cleaner on the App Store is a *photo library* cleaner. CleanEx
is too, and says so honestly rather than implying otherwise.

**The useful reframe:** photos saved from WhatsApp into the camera roll carry no camera EXIF
data. We can isolate "photos you didn't take" as a category. That is the closest reachable
approximation of the origin problem, and it is where WhatsApp's `Save to Camera Roll` output
actually lands.

## 3. Positioning

**Audience:** older and non-technical iPhone users.
**Wedge:** radical simplicity. Competitors present grids of numbers for power users. CleanEx
explains, in plain language, one decision at a time.
**Price:** free forever, no monetization. No accounts, no backend, no paywall, no analytics
service. Everything stays on the device.

Every design decision is judged against: *would a confused 70-year-old understand this
without help?*

## 4. Scope

**In v1**
- Exact duplicates
- Similar photos (Apple Vision)
- Screenshots and screen recordings
- Largest videos
- Photos you didn't take (no camera EXIF)
- Guided deep-clean walkthroughs (static content)
- Weekly review with Sunday reminder

**Explicitly out of v1**
- Blurry photo and burst detection — false positives on intentional shallow-focus shots
  erode trust, and trust is the entire product. Revisit once the core is proven.
- Android — PhotoKit and Vision are Apple-only; Android needs a separate native
  implementation for the hardest part of the app.
- Contacts and calendar cleanup — off-brand.
- Any settings screen beyond the weekly reminder toggle.

## 5. Architecture

Expo app (SDK 57, matching the `100workout` blueprint) with one local native module.

```
make-room/
  app/                                  expo-router
  components/
  lib/                                  pure TS product logic (the tested surface)
  modules/
    photo-scan/
      ios/PhotoScanModule.swift         ~150 lines
      index.ts                          typed wrapper
```

Built with `npx create-expo-module --local`. Everything else is standard Expo: EAS Build,
expo-router, expo-notifications, expo-glass-effect, OTA updates for JS. Requires a dev build
rather than Expo Go — already the case for `100workout`, which uses `expo-glass-effect`.

### Why native code is required

Two capabilities do not exist in JavaScript:

1. **File size in bytes.** `expo-media-library` does not expose it. Verified against the SDK 57
   docs: the `Asset` class has no size field. Without byte sizes there is no storage app.
2. **Similarity detection.** Nothing wraps Vision's `VNGenerateImageFeaturePrintRequest`.

### The module boundary

The native module does expensive per-pixel work and returns only small facts. All product
logic lives in TypeScript.

```
Swift  →  enumerate PHAssets, byte size, feature print, pairwise clustering
   ↓      returns: { id, sizeBytes, clusterId, subtype, date, hasCameraExif }
   ↓      ~50 bytes/asset — 30k photos ≈ 1.5 MB across the bridge
TypeScript → categories, sorting, selection, copy, all UI
```

Feature print vectors are several KB each and must never cross the bridge — 30k photos would
be hundreds of MB. Native code therefore computes distances and returns only the *pairs* that
fall below the similarity threshold, which is a tiny payload. Grouping those pairs into
clusters is transitive logic that can silently merge unrelated photos, so it lives in
TypeScript where it is unit-tested.

**File size caveat:** PhotoKit has no public file-size property. The standard approach is a
KVC read on `PHAssetResource`, which every cleaner app ships and which passes review, but is
undocumented. Fallback if it ever breaks: estimate from pixel dimensions and video duration,
which is accurate enough for ranking largest-first.

## 6. Screens

Three tabs via Expo Router `NativeTabs`, which renders a real `UITabBar` — Liquid Glass
automatically on iOS 26, standard tab bar on 17–18. `expo-glass-effect` for glass surfaces
elsewhere. Nothing nested more than two levels deep.

```
  Clean              This Week            Guides
   │                    │                    │
   │                    │                    └─ WhatsApp: free up space
   │                    │                       Telegram cache
   │                    │                       Offload apps you don't use
   │                    │                       What is "System Data"?
   │                    │
   │                    └─ last 7 days · grid ⇄ swipe toggle
   │                       reminder settings at bottom
   │
   ├─ storage ring — "52.4 of 64 GB used"
   ├─ "4.2 GB is safe to delete"  → [ Free up 4.2 GB ]
   ├─ "See what first"            → review list, everything pre-ticked
   └─ "Go further · 61 photos need your call" → swipe deck
```

**Clean (home)** carries the whole promise on one screen. The category counts beneath the
button (*312 exact copies, 89 screenshots, 6 screen recordings*) are read-only reassurance,
not controls.

**See what first** is the trust escape hatch — the same list with everything pre-ticked and
individually untickable. Most users open it once, confirm it is sensible, and never return.
Its existence is why they press the main button at all.

**Go further** holds the swipe deck, used only for genuine judgment calls: similar-but-not-
identical shots, and photos you didn't take. Never for items we are already confident about.

**This Week** is the habit loop. Grid by default, swipe available by toggle, choice remembered.

**Guides** is static content covering what no app can touch, with real screenshots and
numbered steps.

**First run** shows a priming screen explaining what access is needed and why, *before* the
system permission dialog. Photo permission is one-shot; recovering from a Deny means walking
the user into Settings, which is the exact maze the app exists to avoid.

## 7. Scan pipeline

The headline number does not require Vision, so it appears in seconds and grows as the
expensive pass completes in the background.

```
Phase 0 · Permission
   priming screen → PHPhotoLibrary.requestAuthorization

Phase 1 · Fast inventory                      ← headline number lands here
   enumerate PHAssets (metadata only, no pixels)
   byte size per asset       PHAssetResource
   subtype flags             screenshot / screen recording / video
   camera EXIF present?      → "photos you didn't take"
   exact duplicates          group by (sizeBytes, width, height)
   ↓
   Home renders. Categories stream in with running totals.

Phase 2 · Similarity (background, refines the number upward)
   candidate bucketing       only photos within ~5 min of each other
   Vision feature print      small thumbnails, parallel queue
   cluster by distance       threshold ~0.35
   ↓
   "Go further" appears when ready

Persist → SQLite. Later launches diff against stored asset IDs; only new photos processed.
```

**Two-tier detection.** Exact duplicates need no Vision — identical files have identical
`(sizeBytes, width, height)`. Free, exact, zero false positives. Vision runs only for
*similar* photos.

**Time bucketing.** Near-duplicates are overwhelmingly shots taken seconds apart, so only
photos clustered in time are feature-printed. This cuts the candidate set sharply. The case
it misses — the same meme saved twice months apart — is already caught by exact-duplicate
matching.

**Incremental caching** is what makes the weekly review instant: it only processes ~7 days of
new media instead of rescanning the library.

**Results stream in.** Categories appear one by one with running totals, never a blank
progress bar. A bar that looks stuck is the moment the target user closes the app.

## 8. Delete and safety

Four non-negotiable rules.

1. **Nothing is permanently deleted.** iOS holds deleted photos in Recently Deleted for 30
   days. This is stated at the moment of decision, not buried.
2. **Always keep one from every group.** In a group of five near-identical shots, four are
   deleted and the best is kept — highest resolution, then largest file, then oldest. It must
   be structurally impossible to empty a group.
3. **Favourites are never touched.** Not shown, not ticked, not deletable.
4. **iCloud gets an honest warning,** once, before the first delete: deleting also removes the
   photo from the user's other Apple devices.

### The iCloud gotcha

With "Optimize iPhone Storage" on, originals live in iCloud and the phone holds smaller
copies, so deleting a "4 MB" photo may free far less locally. There is no clean public API to
detect this per asset.

Resolution: **predict with the estimate, report the truth.** Measure
`Paths.availableDiskSpace` before and after and report actual freed space. A large gap becomes
the trigger to explain iCloud in plain language — a feature, not an apology.

### Failure handling

iOS shows its own confirmation sheet on batch delete and it cannot be suppressed, so the user
confirms twice. Acceptable: ours explains *why*, the system's confirms *what*. Deletion goes
through as a single batch so one sheet appears, not one per photo.

| Situation | Behaviour |
|---|---|
| User cancels the system sheet | Nothing deleted, selection preserved exactly, no error shown |
| Some assets fail | Report the real deleted count, keep the rest selected |
| Asset already gone | Skip silently, drop from cache |
| Permission set to "Limited" | Explain we only see picked photos, offer the fix |

## 9. Weekly review

Turns a one-time utility into a habit, and applies the simplicity wedge to time: forty photos
from last week is a two-minute job; twenty thousand is never.

- **Local notification**, Sunday 10:00, repeating. No APNs certificates, no server, no device
  tokens: `scheduleNotificationAsync({ trigger: { weekday: 1, hour: 10, repeats: true } })`.
- **Static copy** — "Time to review last week's photos". A repeating local notification cannot
  carry a live count; rescheduling on each launch goes stale the moment a week is skipped, and
  a notification claiming 47 photos when there are 3 is worse than a generic one.
  *Skipped: dynamic counts. Add when there is evidence generic copy is not pulling users back.*
- **Grid default, swipe by toggle.** Forty thumbnails can be scanned at a glance; forty swipes
  is forty decisions. Choice is remembered.
- **Permission is requested after the first successful clean,** not at launch — after the user
  has watched the app free several GB. If declined, the tab still works manually.
- **Empty state is a reward:** "Nothing to clean up. You added 12 photos this week and they all
  look worth keeping."
- **Reminder settings** (on/off, which day) sit at the bottom of this tab. This is the app's
  entire configuration surface.

## 10. Testing

Everything damaging is a pure function over the fact objects the native module returns, so no
device, mocks or fixtures are needed. Jest, already used in all three blueprint projects.

| Function | Why it is tested |
|---|---|
| `pickKeeper(group)` | The one rule that can lose photos. Never empty, never the whole group, prefers highest resolution → largest file → oldest. |
| `groupExactDuplicates(assets)` | Identical size+dimensions group together; near-misses do not. |
| `clusterBySimilarity(assets, pairs)` | Clustering is transitive-safe (A~B and B~C group all three), and a favourite never bridges two unrelated groups. Native code returns similarity *pairs*; grouping them happens in TypeScript so this logic is testable. |
| `categorize(asset)` | Screenshot / screen recording / video / no-camera-EXIF land in the right bucket. |
| `estimateFreed(selection)` | Sums correctly and never double-counts an asset across overlapping categories. |

`estimateFreed` matters most: a photo can be both a screenshot and a duplicate, and
double-counting inflates the headline number the app's credibility rests on.

**The Swift module is not unit tested.** The benchmark harness (below) is its smoke test.

**On-device manual passes before shipping:** full scan of a real large library, delete-then-
cancel, permission denied, permission set to Limited, airplane mode with iCloud Photos on.

## 11. Open risks

1. **Scan performance is an estimate, not a measurement.** Expectation is Phase 1 in seconds
   and Phase 2 in tens of seconds for a large library, but Vision has not been benchmarked on
   real hardware. **First task in implementation is a throwaway benchmark harness** that scans
   a real library and prints timings, before any UI work. If Phase 2 is too slow the fallbacks
   are smaller thumbnails, tighter time buckets, or running it lazily only when the user taps
   "Go further".
2. **`PHAssetResource` file size is undocumented API.** Widely shipped and review-safe today.
   Fallback is dimension- and duration-based estimation.
3. **"Photos you didn't take" also catches edited and AirDropped photos.** Copy must be
   careful — frame it as "worth a look", never as certainty.
4. **Two visual styles to test** — Liquid Glass on iOS 26, standard on 17–18.

## 12. Decisions

| Decision | Choice |
|---|---|
| Audience | App Store product for older / non-technical users |
| Wedge | Radical simplicity |
| Core loop | Hybrid — one-button auto-clean, swipe deck only for judgment calls |
| Monetization | Free forever; no accounts, no backend, no paywall |
| Platform | iOS only, 17+ |
| Stack | Expo SDK 57 + one local Swift module |
| Navigation | Expo Router `NativeTabs` (Liquid Glass free on iOS 26) |
| Name | CleanEx — replaced "Limpio", whose name was already reserved in App Store Connect |
| Repo | Private |

UI implementation will use the `impeccable` skill.
