# Make Room — WhatsApp media surface

**Date:** 2026-07-28
**Status:** Approved, ready for implementation planning
**Platform:** iOS only (17+)
**Supersedes:** the `notTakenByYou` framing in
`2026-07-27-make-room-design.md` §2 ("the useful reframe"), which identified the
opportunity but never turned it into a named surface.

---

## 1. Problem

The origin case for the whole product is a father whose phone is full of WhatsApp
media. Today the app's answer to that is a `Guides` page that tells him to go do
it himself, seven manual steps deep inside another app. The app that exists to
clear his phone hands the central problem back to him.

Two separate piles are involved, and the app currently addresses neither by name:

1. **Media WhatsApp copied into the Photos library.** Make Room already scans
   this, already counts it, already deletes it — and never says the word
   WhatsApp, so he cannot connect the row to the thing filling his phone.
2. **Media that only ever existed inside WhatsApp's container.** Permanently
   unreachable, but currently also completely *invisible* — he has no way to see
   how large it is or whether clearing it did anything.

## 2. What is actually reachable

Verified before design. The distinction below is the one the existing docs get
wrong, and it is the whole basis of this spec.

**Confirmed reachable.** WhatsApp on iOS auto-saves received photos and videos to
the camera roll by default — "Save to Camera Roll" under WhatsApp → Settings →
Chats, on unless somebody turned it off. Those files are ordinary `PHAsset`s.
PhotoKit reads and deletes them like any other asset.

**Confirmed unreachable, permanently.** WhatsApp's private container. No API, no
entitlement, no workaround. A fully native Swift app cannot do it either.

**Confirmed, and corrected from the current code.** There is **no "WhatsApp"
album** in Photos on iOS, and WhatsApp does **not** use the Android
`IMG-20240115-WA0001.jpg` naming — the comment at `PhotoScanModule.swift:195`
claiming it does is wrong. On iOS, WhatsApp assigns random alphanumeric or
UUID-style names (`AJXQ8273.JPG`, `7d3cd6be-….jpeg`). The existing
`isCameraOriginal` heuristic therefore does classify these correctly, but for a
different reason than its comment states. Fix the comment as part of this work.

**Confirmed safe for review.** `whatsapp://` is a documented inter-app URL
scheme, not private API. `openURL` works outright; `canOpenURL` requires
`whatsapp` in `LSApplicationQueriesSchemes`. This carries none of the rejection
risk that rules out `App-Prefs:root=…`.

### What cannot be proven

The detectable signature proves **"a messaging app put this here"**, not
"WhatsApp put this here". It cannot separate WhatsApp from Telegram, Signal, or a
saved Instagram image. The copy is written to stay literally true under that
limit — see §5.

## 3. Architecture

Both arms respect the existing split: **native returns facts, TypeScript makes
decisions.** Classification is pure logic, so it is testable without a device —
the same reasoning that keeps similarity clustering out of Swift.

### Arm A — media in the Photos library

Detection uses metadata already available during the phase-1 inventory. **No
image or video data is decoded.**

| Signal | Camera original | From a chat |
|---|---|---|
| Resource UTI | HEIC / **MOV** (QuickTime) | JPEG / **MP4** |
| `originalFilename` | `IMG_1234`, `DSC01234` | random or UUID |
| `asset.location` | usually present | always nil |
| `max(pixelWidth, pixelHeight)` | 4032 | ≤ 2048 (WhatsApp's send cap) |

The MOV-vs-MP4 split is the decisive one for video: the iPhone camera writes
QuickTime, and everything WhatsApp re-encodes is MP4.

**New native inventory fields** (both read straight off objects already in hand,
zero added cost):

- `uti: String` — from `PHAssetResource.uniformTypeIdentifier`
- `hasLocation: Bool` — from `PHAsset.location != nil`

**New pure module** `src/lib/scan/chats.ts` exporting a single predicate
`isFromChat(asset: AssetFact): boolean`. All four signals must agree.

**New category** `chatMedia`, label
`"Photos and videos from WhatsApp and other chats"`. Directory rows already wrap
to two lines (`directory.tsx:102`), so the longer label needs no layout change.

`chatMedia` is **not** in `AUTO_SAFE_CATEGORIES` — it starts disarmed. Photos and
videos someone sent him are not ours to arm on his behalf.

**Deliberately excluded: the `{MakerApple}` EXIF check.** It is the strongest
available signal, but reading it means a streaming `PHAssetResourceManager` read
per candidate. The four free signals get close enough that the extra cost is not
justified.

**Video gets no analysis at all.** No frame sampling, no Vision, no classifier
beyond the metadata above. A video's thumbnail with its size printed on it is a
sufficient basis for a person to decide, and this is where most of the
recoverable space is: WhatsApp compresses video to 5–20 MB, which slips under the
existing 100 MB `largeVideos` threshold, so a thousand forwarded videos is ~10 GB
the app cannot currently see.

### Arm B — media inside WhatsApp's container

Nothing here reads WhatsApp. It is built entirely from numbers the app already
has, plus one public URL scheme.

**Make the hidden pile visible.** The nameplate gains a second reading, "Apps and
everything else", computed as `usedBytes − photoLibraryBytes`.

**Suppression rule (required).** On an iCloud-optimized library the summed asset
bytes exceed real on-device usage, so this subtraction can produce a nonsense or
negative figure. The reading is **hidden entirely** unless it is positive and
below `usedBytes`. A wrong number on the capacity gauge would cost more than the
feature gains.

**Make the manual path measurable.** On the WhatsApp guide screen:

1. Snapshot `FileSystem.getFreeDiskStorageAsync()` before leaving.
2. One-tap "Open WhatsApp" via `Linking.openURL('whatsapp://')`.
3. On `AppState` returning to `active`, re-measure and report the delta.
4. Report only when the delta clears a noise floor — iOS purges caches and
   downloads iCloud assets on its own, so small deltas are not attributable.
   **Start at 200 MB.** The figure is a guess and is listed in §11 as unmeasured;
   it needs a real before/after reading on a device to settle. Below the floor,
   say nothing about space rather than reporting an unattributable number.

**Copy addition.** Auto-save means every chat photo is stored **twice**, once in
WhatsApp and once in Photos. Turning it off saves real space. The guide says so
plainly even though it puts future media beyond Make Room's reach — trading his
storage for our reach is the thing this product exists not to do.

## 4. The grid is the feature

**The row itself stays a switch.** Every directory row is a breaker per
`DESIGN.md`'s thesis, and pressing one arms it (`directory.tsx:89`). That
behaviour does not change for `chatMedia` — overloading one row with two
different press outcomes would break the one metaphor the whole screen rests on.

The grid is reached by a **`QuietLink` beneath the directory**, matching the
existing "Go further · N photos need your call" pattern at `index.tsx:146`:

> See what WhatsApp saved · 1,204 items · 9.8 GB

It opens a **size-sorted grid, largest first**, reusing `PhotoGrid`, which
already prints bytes on every cell (`photo-grid.tsx:61`). Routed through the
existing `/review` screen with an optional category filter rather than a new
screen.

Sorting largest-first is the actual answer to "what is eating my storage" and
should apply to the filtered view regardless of category.

**Open question to verify on device:** whether `expo-image` renders a poster
frame for a video's `ph://` URI. If it does not, video cells need a thumbnail
request added to the native module. This is the one item in the spec that could
require unplanned native work.

## 5. Copy

Row label: **"Photos and videos from WhatsApp and other chats"**

Names WhatsApp so he recognises it, and the trailing clause keeps it literally
true given §2's limit on what can be proven. Sentence case in running text per
`DESIGN.md`; tracked uppercase in the directory row like every other row.

Nameplate second reading: **"Apps and everything else"** — not "Other", not
"System Data", and never implying it is WhatsApp alone.

## 6. Face exclusion — built last, droppable

For this audience, **the WhatsApp photos from family are the precious photos** —
the grandchildren his daughter sent. Anything that deletes those is the worst
outcome the product can produce.

`VNDetectFaceRectanglesRequest`, run **only** on photo candidates the TS
classifier already flagged — a small fraction of the library, never the whole
thing. Thumbnails at 320px rather than the 224px used for feature prints, since
faces need the extra pixels. New native function `findFaces(assetIds) → [String]`
returning ids containing at least one face.

Its **only** job is deciding what comes pre-ticked in the grid. Scope boundaries:

- **Photos only.** Videos are never analysed.
- **Built last.** The feature is complete and shippable without it. If the pass
  is slow on a real device, drop it and nothing structural is lost.
- **Never arms anything.** The row still starts disarmed either way.

If the pass is dropped, the `chatMedia` row simply appears at the end of phase 1
with the other metadata categories, nothing comes pre-ticked in the grid, and the
phasing concern below does not arise at all.

### Phasing, so no number ever shrinks

Face detection removes items from a count, and a number that shrinks reads as a
mistake — `PRODUCT.md` principle 2. Therefore the `chatMedia` row **does not
appear until its pass completes**, exactly how the similar-photos row behaves
today, reusing the existing "still checking…" line at `index.tsx:123`. The pass
runs after the headline number is already on screen.

## 7. Relationship to `notTakenByYou`

`isFromChat` is a strict subset of today's `!isCameraOriginal`. Chat media claims
its row first; the residual — AirDrops, Safari saves, real camera photos from
other people — stays in `notTakenByYou`, which becomes smaller and more accurate.

**No existing category is removed and no existing row loses items to nowhere.**
Both start disarmed. The no-double-counting rule in `categorize.ts` extends to
the new pair.

## 8. Failure direction

Every ambiguous case is resolved toward **under-reporting**:

- WhatsApp's HD-quality setting exceeds the 2048 cap, so HD sends are missed.
- A camera photo with location services off looks partly chat-like, but must
  still fail the UTI and filename tests to be miscounted.
- Face detection false-negatives leave a family photo pre-ticked in a grid he is
  looking at, not deleted silently.

Missing recoverable space is recoverable next scan. Deleting a grandchild's photo
is not.

## 9. Testing

Pure TS, no device, no mocks — consistent with the existing 46 tests.

**`chats.test.ts`** — each signal in isolation, and the combinations that must
*not* match: HEIC camera shot with GPS stripped; MP4 that is a screen recording;
a favourited chat photo; a 4032px JPEG; an `IMG_1234.jpg`.

**`categorize.test.ts`** — extend for `chatMedia`: favourites still excluded
first, no double-count with `notTakenByYou`, screenshots unaffected.

**`assemble.test.ts`** — face exclusion via an injected face-id set, verifying
excluded ids leave both the count and the byte total.

**Arm B** — the nameplate suppression rule as a pure function over
`(usedBytes, photoLibraryBytes)`, including the negative and overshoot cases.

Existing 46 tests stay green. `pnpm typecheck` clean.

## 10. Explicitly out of scope

- Reading WhatsApp's container by any means.
- Separating WhatsApp from Telegram / Signal / Instagram saves.
- Per-app storage breakdown, or any figure attributed to WhatsApp specifically.
- Video content analysis of any kind.
- The `{MakerApple}` EXIF read (§3) — a candidate for a later accuracy pass.
- Turning WhatsApp's auto-save off on the user's behalf. It is a guide, not an
  action; the app cannot change another app's settings.

## 11. Unmeasured — must not be presented as fact

- **Phase 3 cost** on a real library. Unknown. The existing scan has no recorded
  timings either.
- **The 2048 threshold.** Taken from WhatsApp's documented send behaviour, never
  calibrated against a real library.
- **The 200 MB noise floor** for Arm B's free-space delta (§3). A guess. Needs a
  real before/after reading to settle.
- **How much of the origin case Arm A actually covers** — that depends entirely
  on whether auto-save was ever on, on his phone specifically.

The real acceptance test is unchanged and is not a benchmark: can his father
recover space alone, with nobody in the room?
