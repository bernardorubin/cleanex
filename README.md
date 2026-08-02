# CleanEx

An iPhone app that helps older and non-technical people recover storage and
understand where it went.

It was built for one person in particular: a father whose phone was permanently
full, who could not take a photo or update iOS, and who had no way to find out
why. Every design decision answers to one question — *would a frightened
70-year-old understand this alone, with no one in the room?*

**Free forever.** No accounts, no subscription, no paywall, no upsell, no ads,
no analytics, no tracking. This is a deliberate stance against a category built
on weekly subscriptions sold to people who did not realise they subscribed.

## What it does

- **One button** clears the unambiguous stuff — exact duplicates, screenshots,
  screen recordings.
- **Everything on your phone**, in one list, largest first, with thumbnails and
  video playback, so you can see what is actually filling the phone and delete
  it yourself.
- **Honest guides** for the things iOS will not let any app do — with the
  freed space measured afterwards rather than left to guesswork.

Nothing is ever deleted without you saying so, and everything deleted waits 30
days in Recently Deleted.

## What it deliberately does not do

Every "storage cleaner" on the App Store is really a photo-library cleaner. iOS
forbids any app from reading or deleting another app's storage — WhatsApp's
private media is unreachable, a per-app storage breakdown is impossible, and
"System Data" cannot be cleared by anyone. CleanEx says so plainly and hands
you the manual steps instead of implying coverage it does not have.

It also skips blurry-photo and burst detection. False positives on an
intentionally shallow-focus shot erode trust, and trust is the product.

## Privacy

Your photos never leave your phone. There is no backend, no account, and
nothing is uploaded. All scanning happens on-device through Apple's PhotoKit
and Vision frameworks.

Full policy: [Privacy](https://bernardorubin.github.io/cleanex/privacy)

## Architecture

**One Swift file, everything else TypeScript.**
`modules/photo-scan/ios/PhotoScanModule.swift` is the only native code — it
does PhotoKit and per-pixel work and nothing else. All product logic lives in
pure TypeScript under `src/lib/`, which is why it is testable without a device.

A couple of decisions worth knowing about:

- **Native returns similarity *pairs*, TypeScript makes the clusters.**
  Transitive grouping can silently merge unrelated photos, so it lives in TS
  under test rather than in Swift.
- **Feature prints never cross the bridge.** They are several KB each; a large
  library would be hundreds of megabytes.
- **Two-phase scan.** A fast metadata pass puts a real number on screen in
  seconds, then a Vision pass refines it — because this audience abandons
  anything that looks like work.

See [`CLAUDE.md`](CLAUDE.md) for the full architectural notes, the load-bearing
safety rules, and an honest list of what has not yet been measured.

## Running it

```bash
pnpm install
pnpm test        # 89 tests, no device needed
pnpm typecheck
pnpm ios         # requires a Mac with an iOS simulator runtime
```

Note that `pnpm lint` is not a working gate in this project — there is no
ESLint config, and running it installs packages.

## Documents

| | |
|---|---|
| [`PRODUCT.md`](PRODUCT.md) | Product truth: audience, constraints, principles |
| [`DESIGN.md`](DESIGN.md) | Visual direction contract |
| [`CLAUDE.md`](CLAUDE.md) | Architecture, conventions, gotchas, open unknowns |

## License

[MIT](LICENSE)
