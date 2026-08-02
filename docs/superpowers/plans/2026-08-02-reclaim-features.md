# Reclaim Features Implementation Plan

**Goal:** Add video compression, Live Photos flattening, prevention guides, and storage progress — plus the shared bin flow that makes recovered space actually arrive.

**Spec:** `docs/superpowers/specs/2026-08-02-reclaim-features.md`

**Architecture:** Native does per-pixel work and reports facts; all decisions and copy live in pure TypeScript with tests. Four of the six tasks touch disjoint new files and can run in parallel.

## Global Constraints

- **No new dependencies.** `AVAssetExportSession` is in AVFoundation, already linked.
- iOS only, deployment target 17.0.
- TypeScript strict. No `any`, `@ts-ignore`, `eslint-disable`, or type-dodging `as`.
- Path aliases `@/*` → `src/*`, `@modules/*` → `modules/*`.
- Colours from `usePalette()`. Every `Text` gets numeric `fontSize` + `maxFontSizeMultiplier`. 44×44pt minimum targets.
- Jest is `.ts` only (`testMatch: ['**/__tests__/**/*.test.ts']`) — no `.tsx` tests, do not change the config.
- Gates: `pnpm test` and `pnpm typecheck`. **Do NOT run `pnpm lint`** — no working ESLint config; running it installs packages.
- Commit messages: imperative, single lead line, no body, NO AI attribution.
- Sizes shown to users go through `formatBytes()`. Copy is plain, calm, concrete.

## Safety rules that bind transforms

6. A transform never runs without a confirmation naming what is irreversible.
7. Metadata loss is a bug: creation date, location, favourite and album membership survive every transform.
8. Never report an estimate as a result — before is an estimate, after is measured.

---

## Task 1 — Native transforms (Swift)

**Files:** `modules/photo-scan/ios/PhotoScanModule.swift`, `modules/photo-scan/src/PhotoScan.ts`, `modules/photo-scan/index.ts`

**Produces:**
- `isLivePhoto: boolean` on the inventory payload, from `PHAssetMediaSubtype.photoLive`
- `compressVideo(assetId: string, preset: string): Promise<TransformResult>`
- `flattenLivePhoto(assetId: string): Promise<TransformResult>`
- `TransformResult = { ok: boolean; newAssetId: string | null; oldBytes: number; newBytes: number }`

Both transforms: export → create replacement carrying creation date, location and favourite → delete original → report real byte counts. Cancellable. Never throw on a normal failure; resolve `ok: false`.

Cannot be compiled locally (zero simulator runtimes for build, though `swiftc -parse` works). Verify syntax only.

## Task 2 — Transform candidates (pure TS)

**Files:** create `src/lib/transform/candidates.ts` + `src/lib/transform/__tests__/candidates.test.ts`

**Produces:**
- `type Quality = 'sharp' | 'phone' | 'smallest'`
- `compressibleVideos(assets: AssetFact[]): AssetFact[]` — videos at or above `LARGE_VIDEO_BYTES`, excluding favourites, Live Photos, slo-mo and time-lapse
- `livePhotoCandidates(assets: AssetFact[]): AssetFact[]`
- `estimateSaving(assets: AssetFact[], quality: Quality): number`
- `QUALITY_RATIOS: Record<Quality, number>` — 0.40 / 0.20 / 0.10 retained

## Task 3 — Transform + bin copy (pure TS)

**Files:** create `src/lib/transform/messages.ts` + `src/lib/transform/__tests__/messages.test.ts`

All user-facing strings for transforms and the bin flow, as tested pure functions. Must cover: the estimate line, the irreversibility sentence, the measured result, the bin explanation, and singular/plural throughout. Reuse `formatBytes`.

## Task 4 — Storage history (pure TS + cache)

**Files:** create `src/lib/storage/history.ts` + `src/lib/storage/__tests__/history.test.ts`; extend `src/lib/scan/cache.ts` with an additive `disk_history` table

**Produces:**
- `freedTotal(samples): number | null`
- `fillRatePerWeek(samples): number | null`
- Both return `null` when there is under two weeks of history or the spread is too noisy to support a claim.

## Task 5 — Prevention guides (content)

**Files:** `src/lib/guides/content.ts`

Four new guides per spec §4, matching the existing `Guide` shape. The WhatsApp auto-download one is the highest value and goes first. Must state plainly that turning off "Save to Camera Roll" stops the second copy but not WhatsApp's own.

## Task 6 — UI surfaces

**Files:** new transform screen, bin-flow component, progress line on the Clean tab; empty-state fix so a clean scan points at Prevention instead of declaring victory.

Depends on Tasks 1–5.

---

## Parallelism

Tasks 2, 3, 4 and 5 touch disjoint new files and run in parallel. Task 1 is independent native work and runs alongside them. Task 6 waits for all.

Subagents do **not** commit — the controller commits, to avoid concurrent git operations in one working tree.
