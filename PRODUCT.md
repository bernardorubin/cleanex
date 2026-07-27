# Product

<!-- impeccable:product-schema 1 -->

## Platform

ios

## Users

Older and non-technical iPhone owners whose phones are full and who do not
understand why. The originating case: a father with a phone full of WhatsApp
photos that never appear in his gallery, who must navigate a settings menu
buried three levels inside another app to clear them.

He is not managing storage as a hobby. He hits a wall — cannot take a photo,
cannot install an app, cannot update iOS — and needs the wall gone. He will
abandon anything that looks like work, and he is frightened of deleting
something that matters.

A secondary audience buys and installs it: the adult child who sets it up on a
parent's phone.

## Product Purpose

Help people recover iPhone storage and understand where it went, in plain
language, without needing to learn anything.

Success is a user who taps one button, sees gigabytes come back, and does not
need to ask anyone for help. Long-term success is a phone that stays clean
because reviewing last week's photos became a small weekly habit.

## Positioning

Every competitor is a photo-library cleaner presented as a storage tool, built
for people who already understand storage. Limpio does the same scanning work
and is honest about what it cannot reach, then spends its design budget on
being comprehensible to someone who finds the iPhone's own storage screen
confusing.

The differentiator is not detection. It is that a frightened 70-year-old can
use it alone.

## Operating Context

Used standing up, in a moment of frustration, often on a phone with 0 bytes
free. Frequently used once and then not reopened for weeks — so it must
re-explain itself every time and never assume recall of a previous session.

Often installed by someone else on the user's behalf, meaning first run may
happen with a helper present and every subsequent run without one.

The weekly review arrives as a Sunday notification and is a two-minute job.

## Capabilities and Constraints

**Can do**, via PhotoKit and Vision, entirely on device:

- Full photo and video inventory with real byte sizes
- Exact duplicates, similar photos, screenshots, screen recordings, large videos
- "Photos you didn't take" — filename heuristic for images not from this camera
- Batch delete, with a single iOS confirmation sheet
- Device total and free disk space
- Weekly local notification

**Cannot ever do** — iOS sandbox, permanent, not an implementation gap:

- Read or delete another app's storage, including WhatsApp's
- Detect a photo duplicated between Photos and another app
- Show a per-app storage breakdown
- Deep-link to Settings → General → iPhone Storage (private API, rejection risk)

The product must state these limits honestly rather than implying otherwise.
Guided walkthroughs stand in where automation is impossible.

**Technical:** iOS 17+. Expo SDK 57 with one local Swift module. No backend, no
accounts, no analytics, no network calls of any kind.

**Undecided:** App Store screenshots and marketing copy. Localization — a
Spanish version is plausible given the name and audience but is not committed.

## Brand Commitments

Name: **Limpio** (Spanish for "clean"). Verified unclaimed on the US, Spain and
Mexico storefronts as of 2026-07-27. Chosen to read warmly to a bilingual
older audience rather than as a technical utility.

Free forever. No monetization, no paywall, no subscription, no upsell. This is
a deliberate stance against a category built on weekly subscriptions sold to
people who do not realize they subscribed.

Voice: plain, calm, concrete. Never jargon, never alarm, never urgency. Numbers
in units a person uses out loud ("4.2 GB", not "4,284,506,112 bytes").

## Evidence on Hand

Working scan pipeline with 46 passing unit tests covering categorization,
keeper selection, duplicate grouping, similarity clustering, and freed-space
estimation. Native module implemented against PhotoKit and Vision.

No real-device benchmark numbers yet — scan performance is measured, not
assumed, and no performance claim may be made until it is.

No users, no reviews, no press, no download counts. None may be invented.

## Product Principles

1. **One decision at a time.** Never present a grid of numbers where a
   sentence would do.
2. **Trust is the product.** Anything that could read as a mistake — a false
   positive, a lost photo, a number that shrinks — costs more than any feature
   gains.
3. **Honest about limits.** Where the sandbox blocks us, say so plainly and
   show the manual path, rather than implying coverage we do not have.
4. **The safety net is load-bearing.** Deleted photos sit in Recently Deleted
   for 30 days. This fact belongs at the moment of decision, not in a help page.
5. **Predict, then report the truth.** Show the estimate, measure the real
   freed space, and explain any gap instead of hiding it.

## Accessibility & Inclusion

The primary audience makes accessibility the core requirement rather than a
compliance checkbox:

- Support Dynamic Type up to the largest accessibility sizes without breaking
  layout. Text must never be a fixed pixel size.
- Minimum 44×44pt touch targets; the primary action considerably larger.
- Never encode meaning in color alone.
- Full VoiceOver labelling, including live progress and the freed-space result.
- Respect Reduce Motion.
- Target WCAG AA contrast at minimum.
