# CleanEx — Unified media browser

**Date:** 2026-07-28
**Status:** Approved, ready for implementation planning
**Platform:** iOS only (17+)
**Supersedes:** the WhatsApp-category design drafted earlier the same day
(commit `5765750`). Source detection was cut wholesale — see §12.

---

## 1. Problem

Media on an iPhone lives in more than one place and the user is expected to know
which. Some photos are in the Photos app; some are inside WhatsApp; some are in
both. To a non-technical person that split is arbitrary and invisible, and it
means there is no single answer to "what is filling my phone" and nowhere to go
to clear it.

CleanEx should be that single place: **everything on the device, in one list,
largest first, deletable in one action.** Where a photo came from is not a
question the user should have to hold in their head.

## 2. What is reachable

**Everything in the Photos library.** All photos and videos, real byte sizes,
thumbnails, playback, batch delete. PhotoKit gives us all of it.

Note that this already includes most WhatsApp media in practice: WhatsApp on iOS
auto-saves received photos and videos to the camera roll by default ("Save to
Camera Roll" under WhatsApp → Settings → Chats, on unless somebody turned it
off). Those are ordinary `PHAsset`s. **The unified list therefore does contain
the WhatsApp pile for most users** — not because we reach into WhatsApp, but
because WhatsApp already put them where we can see them.

**Not reachable, permanently:** media that only ever existed inside WhatsApp's
container. No API, no entitlement, no workaround; a fully native Swift app cannot
do it either. This is the one gap in "everything in one place", and §8 handles it
by naming it rather than pretending it away.

## 3. The screen

One scrolling grid. Every photo and video in the library. **Sorted largest
first, with no ordering control.**

Largest-first is not a preference, it is the answer to the question the screen
exists to answer — the 400 MB video is the first thing on screen. No sort toggle,
no month grouping, no segmented control. Nothing to learn.

Each cell shows a thumbnail, the file size (already implemented,
`photo-grid.tsx:61`), and for video a duration badge. Tapping a video plays it;
tapping a photo selects it.

Nothing is pre-selected. This screen never decides on the user's behalf — the
breaker panel is where the app makes recommendations, and this is where the user
overrules it.

## 4. Virtualization is a correctness requirement, not an optimization

`PhotoGrid` currently renders every asset eagerly into a plain `View` inside a
`ScrollView` (`photo-grid.tsx:32`). That is fine for a 40-item category and will
hang or crash on a 30,000-asset library.

**This is a pre-existing bug in `/review`**, which already renders every
deletable asset the same way. It has not been hit because no real library has
been tested against it yet.

Required: `FlatList` with `numColumns`, `getItemLayout` (cells are a fixed
computed square, so this is exact and cheap), and `removeClippedSubviews`. **No
new dependency** — `FlatList` is part of React Native. FlashList was considered
and rejected on the no-new-dependencies grounds; it can be revisited only if
`FlatList` measurably fails on a real library.

`PhotoGrid` gains a virtualized variant rather than being rewritten in place, so
the existing small-category call sites in `/review` keep working unchanged.

## 5. Video

**Playback: native, no dependency.** A new async function on the existing Swift
module presents `AVPlayerViewController` full-screen for an asset id, resolving
the asset via `PHImageManager.requestPlayerItem`.

This is deliberately not `expo-video`. It adds no package to a project that has
no video code today, and it produces the *identical* player the user already sees
in the Photos app — which matters more for this audience than for most, since
recognition is the whole accessibility strategy.

**Thumbnails.** `PHImageManager` returns poster frames for video, so `ph://`
URIs are expected to work in `expo-image` with no change. **Unverified from this
machine** — see §11. If it does not hold, the fallback is a native thumbnail
function, which is the one item in this spec that could force unplanned work.

## 6. Selection and deletion

- Nothing selected on open.
- Tap to select; the amber armed treatment already in `PhotoGrid` applies.
- A **floating footer bar** shows the running count and byte total with the
  `MainBreaker`. It must float rather than sit at the end of the list — with
  virtualization the end of a 30,000-item list is unreachable in practice.
- The footer is absent entirely when nothing is selected, so the default state of
  the screen is calm.
- Deletion reuses `confirmDelete` / `deleteAndMeasure` unchanged: one batch, one
  system sheet, real freed bytes reported afterwards.

### Favourites

Safety rule 1 says favourites are never offered for deletion. That rule governs
what the **app recommends** — `categorize()` returning `[]` for a favourite — and
it is not weakened here. This screen recommends nothing; it shows the library and
the user chooses.

So favourites **are** shown (they are part of "everything") and **are**
selectable, marked with a heart. The protection moves into the confirmation,
which names them explicitly:

> Delete 42 items · 3.1 GB — 3 of these are photos you marked as favourites.

Blocking selection outright would be more confusing than the risk it avoids: an
unexplained "why can't I delete this" is exactly the dead end this product
exists to remove.

## 7. Where it lives

**A new pushed screen `/browse`, reached by a prominent link from the Clean
tab.** `/review` is *not* repurposed.

Correction to the earlier draft of this section: `/review` is the trust escape
hatch for the breaker's own selection — everything pre-ticked, individually
untickable, which is what makes the user willing to press the main button at all
(`review.tsx:13`). The browser is the opposite: everything shown, nothing
pre-ticked. Folding one into the other would delete a load-bearing safety
surface that nobody asked to remove. Both exist; both are pushed screens.

The Clean tab's quiet links become:

- `Check what will be deleted` → `/review` (was "See every photo first")
- `Everything on your phone · 12,481 items · 84 GB` → `/browse`

`DESIGN.md`'s first-viewport contract is the breaker panel, and a fourth tab
would dilute the thing the design direction was chosen to deliver. The existing
"See every photo first" link becomes the entry point, with copy that says what it
now is:

> Everything on your phone · 12,481 items · 84 GB

**Resolved 2026-07-28: pushed screen, not a tab.** The counter-argument was
weighed — the stated goal is a *single place*, and a pushed screen is less
findable — and rejected. Landing the user on 12,000 thumbnails instead of one
button that frees 4 GB inverts the product. `DESIGN.md` needs no amendment; the
three-section structure stands.

Three quiet links under the breaker is one more than today. "Go further" is
already conditional on similar photos existing, so the common case remains two.

## 8. The unreachable pile

Unchanged from the previously approved design, and it is the honest completion of
"everything in one place".

**Make it visible.** The nameplate gains a second reading, "Apps and everything
else", computed as `usedBytes − photoLibraryBytes`.

**Suppression rule (required).** On an iCloud-optimized library the summed asset
bytes exceed real on-device usage, so this subtraction can produce a nonsense or
negative figure. The reading is **hidden entirely** unless it is positive and
below `usedBytes`. A wrong number on the capacity gauge costs more than the
feature gains.

**Make the manual path measurable.** On the WhatsApp guide screen:

1. Snapshot `Paths.availableDiskSpace` before leaving — the synchronous property
   already used by `delete.ts` and `use-scan.ts`, not the legacy
   `getFreeDiskStorageAsync`.
2. One-tap "Open WhatsApp" via `Linking.openURL('whatsapp://')`. This is a
   documented inter-app scheme, not private API, and carries none of the
   rejection risk that rules out `App-Prefs:root=…`. `canOpenURL` requires
   `whatsapp` in `LSApplicationQueriesSchemes`.
3. On `AppState` returning to `active`, re-measure and report the delta.
4. Report only above a **200 MB noise floor** — iOS purges caches and downloads
   iCloud assets on its own, so smaller deltas are not attributable. The figure
   is a guess; see §11. Below it, say nothing about space rather than report a
   number we cannot stand behind.

**Copy addition.** Auto-save stores every chat photo **twice**, once in WhatsApp
and once in Photos. Turning it off saves real space. The guide says so plainly
even though it puts future media beyond CleanEx's reach — trading the user's
storage for our own reach is the thing this product exists not to do.

## 9. Relationship to existing surfaces

Nothing is removed.

- **Clean tab / breaker panel** — unchanged. Still the one-tap path for
  unambiguous clutter, still where the app makes recommendations.
- **Categories** — all six unchanged, including `notTakenByYou`. No new category
  is added.
- **Deck** — unchanged.
- **This Week** — unchanged.

The unified browser is the second half of the product: the breaker decides for
you, the browser lets you decide for yourself.

## 10. Testing

The new logic that is pure and therefore testable without a device:

- **Ordering** — largest-first sort over a mixed photo/video fixture set,
  including equal sizes (stable order) and zero-byte assets.
- **Selection totals** — byte sum over a selection, including the empty case.
- **Favourite counting** — the "3 of these are favourites" figure, including zero
  and all-favourites.
- **Nameplate suppression** (§8) — a pure function over
  `(usedBytes, photoLibraryBytes)` covering the negative and overshoot cases.

Not unit-testable and must be verified on a device: virtualized scroll
performance, video thumbnails, playback.

Existing 46 tests stay green. `pnpm typecheck` clean.

## 11. Unmeasured — must not be presented as fact

- **Whether `expo-image` renders poster frames for video `ph://` URIs.** Blocks
  §5's no-new-native-work assumption.
- **`FlatList` performance** at 30,000 assets with thumbnail loading. If it
  fails, FlashList becomes a dependency conversation.
- **The 200 MB noise floor** (§8). A guess, never measured.
- **Scan performance generally.** Still no recorded timings from any real
  library, unchanged from the project's existing state.

## 12. Explicitly out of scope

- **Detecting which app a photo came from.** Cut deliberately and completely. The
  user does not care whether an image arrived via WhatsApp, Telegram, or
  anywhere else — they care that it is visible and deletable in one place. The
  four-signal classifier, the `chatMedia` category, and the Vision face pass from
  the previous draft are all dropped. Nothing is lost: `notTakenByYou` already
  covers the "not from your camera" case and remains untouched.
- Reading WhatsApp's container by any means.
- Per-app storage breakdown, or any byte figure attributed to a named app.
- Sort or filter controls on the unified list.
- Editing, favouriting, or sharing from the browser. It shows and deletes.
- Turning WhatsApp's auto-save off on the user's behalf — the app cannot change
  another app's settings.

## 13. Acceptance

Unchanged and not a benchmark: can the user's father find the thing filling his
phone and delete it, alone, with nobody in the room?
