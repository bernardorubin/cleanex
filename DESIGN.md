# Design

<!-- impeccable:design-schema 1 -->

## Direction contract

**THESIS.** A domestic breaker panel: everything drawing on a shared resource,
listed in plain words, each with an unmistakable switch. It refuses the
category's arrangement — dark chrome, a neon progress ring, a "SMART CLEAN"
button — and its predictable opposite, thin-type Swiss minimalism. The
directory card is the interface; the storage reading is a nameplate above it,
not a hero metric.

**OWN-WORLD.** Bone panel ground with a cooler printed-directory cast, never a
literary cream. Rows are engraved into the card by hairline rules, not floated
on shadowed tiles. Safety amber is the only tint and it means one thing: this
switch is ON, this will be deleted. Graphite is reserved for two objects — the
capacity nameplate and the main breaker. Type is SF Pro throughout; directory
labels are tracked uppercase because that is how a circuit card is printed, and
counts are tabular so columns align down the card.

**STORY.** He sees how full the phone is, reads a short list of plain words he
recognises, sees which switches are on, and throws the main breaker. He never
learns a concept to do it.

**FIRST VIEWPORT.** Capacity nameplate at top: engraved graphite plate, a
tick-marked capacity strip, and the reading in words. Beneath it the directory
card fills the screen — one row per category, label left in tracked caps, count
and size right, amber flag at the far right when armed. The main breaker sits
last, heavier than anything else on screen, stating the exact amount it will
free. "See what first" sits quietly beneath it.

**FORM.** Domestic breaker panel; candidate 4 of 7 on the grounded list; seed
key `723dcdb1`, direction scope, operate mode. No staging challenger taken —
the assigned world was built as rolled.

## Platform rules

Native iOS. HIG governs structure, navigation and interaction; the world
expresses through tint, type, motion, material and content. Specifically:

- `NativeTabs` for the three sections. Real `UITabBar`, so Liquid Glass appears
  automatically on iOS 26 and a standard bar on 17–18. No custom global nav.
- System text styles only. Every size scales with Dynamic Type; no hard-coded
  point sizes anywhere in the tree.
- Minimum 44×44pt targets. The main breaker is 64pt tall.
- Deletion confirmation is a system action sheet, not a bespoke modal.
- Edge-swipe back stays alive on every pushed screen.
- Reduce Motion replaces the breaker throw with an instant state change.

## Color

**Strategy: restrained.** Neutrals carry the surface; one saturated accent does
one job. The visitor came to operate, and a single-meaning tint is what makes
the armed state unmistakable at a glance.

Light is the primary appearance, chosen from the use scene: an older person in
a kitchen or living room in daylight, wearing reading glasses. Dark mode is the
same panel in shadow, not an inverted theme.

| Role | Light | Dark | Use |
|---|---|---|---|
| `panel` | `#E6E4DD` | `#1A1A19` | Screen ground |
| `card` | `#F6F4EF` | `#242423` | Directory card, sheets |
| `ink` | `#191917` | `#F1EFE9` | Primary text |
| `inkSecondary` | `#5A5850` | `#A5A29A` | Counts, captions |
| `rule` | `#C7C4BB` | `#3A3936` | Engraved separators |
| `graphite` | `#2C2C29` | `#E8E6E0` | Nameplate, main breaker |
| `onGraphite` | `#F6F4EF` | `#1A1A19` | Text on graphite |
| `amber` | `#D2660A` | `#F0871F` | ON flag, tint, armed state |
| `caution` | `#B32D19` | `#E2543C` | Destructive confirmation only |

`amber` never decorates. If it is on screen, something is armed for deletion.
`caution` appears only inside a confirmation.

## Type

SF Pro (system). No brand face — at these reading sizes a display face would
cost legibility for an audience that needs it most.

| Role | Style | Treatment |
|---|---|---|
| Capacity reading | `title1` | Semibold, tabular figures |
| Directory label | `subheadline` | Semibold, uppercase, tracking `0.08em` |
| Count / size | `subheadline` | Regular, tabular figures |
| Main breaker | `headline` | Semibold, uppercase, tracking `0.06em` |
| Body / explanation | `body` | Regular, measure capped near 60ch |
| Caption | `footnote` | Regular |

Uppercase is confined to directory labels and the breaker. Everywhere the user
reads a sentence, it is sentence case — uppercase running text is slower to
read, and this audience cannot afford that.

## Material

- **Engraved, not floated.** Rows separate with a hairline `rule` inset to the
  label's left edge, the way a printed directory is ruled. No card shadows
  between rows, no nested cards.
- **The card has one shadow**, offset and softly blurred, sitting it on the
  panel. Never a zero-offset halo.
- **The nameplate and breaker are graphite plates** with a 1px lighter top edge,
  reading as bevelled metal under room light.
- **Capacity strip** is a tick-marked bar, not a ring — a panel gauge reads in
  ticks. Ticks are `rule`; the fill is `ink`; overfill turns `caution`.

## Motion

One authored moment: **the breaker throw.** Arming a row snaps its amber flag
across with a fast exponential ease-out and a light haptic. Throwing the main
breaker drops it with the same curve and a heavier haptic. Everything else uses
system transitions.

Under Reduce Motion the flag changes state instantly and haptics remain.

## Copy

Plain, calm, concrete. Never jargon, never alarm, never urgency.

- Sizes read as a person says them: "4.2 GB", never raw bytes.
- Controls name their action: "Free up 4.2 GB", not "Clean".
- Categories are described, not named technically: "Photos that look alike",
  not "Perceptual duplicates".
- The Recently Deleted safety net appears at the moment of decision.
- Where the sandbox blocks us, say so and show the manual path.
