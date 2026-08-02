# CleanEx — Reclaim features

**Date:** 2026-08-02
**Status:** Approved, ready for implementation planning
**Platform:** iOS only (17+)

Four features that widen what the app can actually recover, plus the one that
stops the phone refilling.

---

## 0. Why these four

The app currently only deletes. That caps it at "things you do not want", and
leaves three large piles untouched:

- **Video you want to keep** — deleting is the wrong trade; shrinking is not.
- **Live Photos** — every one carries ~3s of video nobody asked for.
- **Media that has not arrived yet** — nothing in the app stops the phone
  refilling, which is why a cleared phone is full again in three months.

And one credibility problem: deleting does not free space until Recently
Deleted empties, so the user's honest experience is "I deleted and nothing
happened."

## 1. Hard limits confirmed before designing

**PhotoKit cannot read Recently Deleted.** Those assets are not exposed to any
third-party app. So the app can never show what is in the bin, how much it
holds, or empty it. Everything about the bin is instruction plus measurement.

**There is no public deep link to a Photos album.** `photos-redirect://` opens
the Photos app but is undocumented; `photos-navigation://` is reverse
engineered. Both carry the same class of App Store risk as `App-Prefs:`.

**Consequence:** the bin flow is written steps, an optional open-Photos button,
and a free-space measurement across the round trip — the pattern already proven
in the WhatsApp guide.

**Replacing an asset is create-then-delete.** PhotoKit has no "replace this
asset's data". Every transform below must create a new asset and delete the
old one, which means carrying over creation date, location, favourite status
and album membership by hand.

**The space arrives late.** The replaced original goes to Recently Deleted, so
a transform makes the phone *fuller* until the bin is emptied. Every transform
surface must say so, in the app's voice, and offer the bin flow immediately.

---

## 2. Feature: Video compression

Re-encode large videos smaller and replace the original. The only lever in the
app that frees gigabytes without the user giving up something they would miss.

**Detection.** Videos are already inventoried. Surface those above a threshold
(reuse `LARGE_VIDEO_BYTES`, 100 MB) plus anything the user picks manually.

**Settings.** Three named qualities, described by outcome rather than by
resolution — this audience does not know what 1080p means:

| Choice | Preset | Rough saving |
|---|---|---|
| Keep it sharp | `AVAssetExportPreset1920x1080` | ~60% |
| Good for the phone | `AVAssetExportPreset1280x720` | ~80% |
| Smallest | `AVAssetExportPreset960x540` | ~90% |

Default is **Good for the phone**. The estimate shown must be labelled as an
estimate; the real figure is reported afterwards from actual file sizes.

**Metadata to carry over, without exception:** creation date, location,
favourite status, album membership. Losing any of these is the failure mode
this audience notices — a holiday video jumping to today's date reads as the
app breaking their library.

**Excluded from v1:** Live Photos, slo-mo and time-lapse. Their structure does
not survive naive re-encoding. Filter them out rather than corrupting them.

**iCloud originals.** If the full-size original is not on device, PhotoKit must
fetch it before export. That is a potentially large download; show it as
progress rather than an unexplained wait, and allow cancelling.

**Irreversibility.** Once the bin empties, the quality loss is permanent. This
is the only irreversible action in the app and its confirmation must say so
plainly — not with a warning triangle, with a sentence.

**Cancellation is required**, not optional. Encoding twenty videos is minutes
of a hot phone, and this audience abandons anything that looks like work.

## 3. Feature: Live Photos to stills

Every Live Photo stores roughly three seconds of video beside the still,
close to doubling its size. Most people never chose to shoot them and never
play them.

**Detection is exact, not heuristic:** `PHAssetMediaSubtype.photoLive`. No
false positives, so the count and byte total can be stated as fact.

**Requires** a new `isLivePhoto` field on `AssetFact` and its inventory row.

**The transform** keeps the still image and drops the video component — the
photo the user thought they were taking. Same create-then-delete path, same
metadata carry-over, same late-arriving space as compression.

**This is a bulk action**, not a per-item decision. Nobody wants to review
5,000 Live Photos. One number, one button, one confirmation.

## 4. Feature: Prevention

Everything else in the app is cure. This is the only part that stops the phone
filling again, and for a user whose pile is inside another app it is the only
part that helps at all.

New guides, same shape as the existing ones (written steps, honest about what
the app cannot do for them, free-space measured across the round trip):

- **Stop WhatsApp downloading everything** — Settings → Storage and Data →
  Media auto-download → Never, on both Wi-Fi and cellular. The single highest
  value action available to a user whose phone is full of forwarded media.
- **Stop other messengers doing the same** — Telegram and Signal have the
  equivalent setting.
- **Let iCloud hold the originals** — Optimize iPhone Storage, with the honest
  note that this trades local copies for downloads later.
- **Where "Save to Camera Roll" helps and where it hurts** — turning it off
  stops the second copy, but does **not** stop WhatsApp keeping its own. That
  distinction is the one most people get wrong.

**Placement matters more than the content.** A phone full of unreachable
WhatsApp media currently gets "Nothing to clean up" — the worst possible answer
for exactly the person this app was built for. When the scan finds little, the
Clean tab must point at Prevention rather than declaring victory.

## 5. Feature: Storage progress

The app has no memory. It cannot tell the user whether they are winning, and
the weekly notification has nothing true to say.

**Sample free and total disk space on each launch** into a new `disk_history`
table in the existing SQLite cache. That is the whole data model.

Two honest statements derived from it:

- **"You have freed 6.2 GB with CleanEx"** — cumulative, computed from
  recorded gains, not from a single reading.
- **"Your phone is filling by about 300 MB a week"** — a trend from the
  samples, shown only once there is enough history to mean anything.

**No chart.** A number and a sentence. `PRODUCT.md` principle 1 is one decision
at a time, and a graph is a concept this audience does not need.

**Suppress until trustworthy.** Fewer than two weeks of samples, or a spread
too noisy to support a claim, shows nothing at all. Same discipline as the
nameplate's unreachable-storage reading.

## 6. Cross-cutting: the bin flow

Shared by compression, Live Photos, and every ordinary delete.

After any action that sends assets to Recently Deleted:

1. Say plainly that the space is in the bin and returns in 30 days.
2. Offer **"Get the space now"** — written steps (Photos → Albums → Recently
   Deleted → Select → Delete All), optionally a button that opens Photos.
3. On return to the app, measure free space and report the real gain above the
   200 MB noise floor.

**Open decision for the human:** whether to include the `photos-redirect://`
button at all. It is undocumented. The build already carries one unreviewed
private-ish API (the `fileSize` KVC key), and stacking a second raises the
odds of a 2.5.1 rejection. Written steps alone carry zero risk and lose only
one tap. Default to **no button** unless overruled.

---

## 7. Architecture

Unchanged from the project's rule: **native returns facts and performs
per-pixel work, TypeScript decides.**

**New native functions** in `PhotoScanModule.swift`:

- `compressVideo(assetId, preset) -> { newAssetId, oldBytes, newBytes }`
- `flattenLivePhoto(assetId) -> { newAssetId, oldBytes, newBytes }`
- Both create the replacement, carry metadata across, delete the original, and
  report real before/after byte counts.

**New inventory field:** `isLivePhoto`.

**New pure TypeScript**, each with tests and no device required:

- `src/lib/transform/candidates.ts` — which assets are eligible, and the
  estimated saving per quality
- `src/lib/transform/messages.ts` — all user-facing copy for transforms and
  the bin flow
- `src/lib/storage/history.ts` — the freed-total and fill-rate calculations,
  including the suppression rules

**Extended:** `cache.ts` gains a `disk_history` table. Additive
`CREATE TABLE IF NOT EXISTS`, no schema-version bump, so existing caches
survive.

## 8. Safety rules, extended

The existing five stand. Three more apply to transforms:

6. **A transform never runs without an explicit confirmation naming what is
   irreversible.** Deleting has a 30-day net; compression does not.
7. **Metadata loss is a bug, not a tradeoff.** Date, location, favourite and
   album membership survive every transform.
8. **Never report an estimate as a result.** The saving shown before is an
   estimate; the figure shown after comes from real file sizes.

## 9. Testing

Pure and device-free, consistent with the existing 89:

- Candidate selection: thresholds, and the exclusion of Live Photos, slo-mo and
  time-lapse from compression
- Saving estimates per quality, including a zero-candidate case
- History: freed total, fill rate, and both suppression rules (too few samples,
  too noisy)
- Every copy string, including singular/plural and the irreversibility sentence

Not unit-testable, must be verified on device: encode time, thermal behaviour,
metadata survival, iCloud fetch, and that the space actually returns after the
bin is emptied.

## 10. Explicitly out of scope

- Reading, deleting or measuring Recently Deleted — impossible.
- Reaching any other app's storage — impossible.
- Compressing Live Photos, slo-mo or time-lapse.
- HEIC re-encoding of still photos — smaller win, same risk, revisit later.
- Any chart or graph.

## 11. Unmeasured — treat as suspected

- Real encode time per video on target hardware, and thermal throttling.
- Actual savings per preset against real footage; the percentages above are
  nominal.
- Whether metadata survives the create-then-delete path in practice.
- The 200 MB noise floor, still a guess.
