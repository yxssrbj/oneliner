# Weekly Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved personal weekly review using authorized trade data.

**Architecture:** Extend the existing authenticated review workspace. A pure review model derives every figure from one week's trades; the page renders that model and reuses existing exit, correction, and chart-import flows. The API remains the authority for saved R and owner filtering.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase, Vitest, Playwright, existing CSS.

**Spec:** `specs/features/weekly-review.md`

## Global Constraints

- Monday 00:00 UTC inclusive to following Monday exclusive; opening time assigns the week.
- Only completed trades contribute to performance; raw saved R is summed before display rounding.
- No synthetic production data or cross-account journal exposure.
- Desktop first; follow the approved preview and preserve existing editing flows.

## Review Focus

- Equal opening timestamps use ID order so chart points remain stable.
- All-unfinished and empty weeks show unavailable performance.
- Breakeven belongs in the win-rate denominator but not the wins.
- A late exit or corrected opening time refreshes the selected week.
- A failed request never displays zero results as though they were loaded.

---

### Task 1: Derived review model

**Files:** `lib/trades/review.ts`, `lib/trades/review.test.ts`

**Interfaces:** `buildWeeklyReview<T extends ReviewTrade>(trades: T[], week: string)` returns selected trades, metrics, ascending cumulative points, seven day rows, and setup rows. `ReviewTrade` contains the saved ID, opening time, setup, exit, and R.

- [x] Write tests for wins/losses/breakeven/unfinished, equal-time ordering, week boundaries, empty weeks, and reconciliation.
- [x] Run `npm test -- lib/trades/review.test.ts`; confirm the new tests fail for missing behavior.
- [x] Implement the smallest pure function using saved R without intermediate rounding.
- [x] Rerun the focused test and typecheck; commit the model.

### Task 2: Real review screen

**Files:** `app/components/trade-workspace.tsx`, `app/components/weekly-review.tsx`, `app/components/app-shell.css`, `app/components/trade-review.test.tsx`

**Interfaces:** `WeeklyReview` receives the selected week, authorized trades, and trade-selection callback; it renders all review sections. The parent renders the existing trade card for the selected trade, reusing `ExitForm` and `TradeEditForm`.

- [x] Add failing component tests for metric/chart/table agreement, empty states, week switching, correction refresh, and visible actions.
- [x] Run focused component tests and confirm the intended failures.
- [x] Render the metric strip, cumulative chart, setups, daily cards, trade table, and unfinished banner; style to the preview.
- [x] Rerun focused tests, typecheck, and lint; commit the screen.

### Task 3: Browser and privacy verification

**Files:** `e2e/outcomes.spec.ts`, `STATUS.md`, `todo.md`

- [x] Extend the browser journey for a real week with an unfinished trade, exit, correction, empty week, and account isolation; component test covers load error and retry.
- [x] Run the focused browser journey at 1280 × 800 and 1440 × 900; inspect screenshots in both themes.
- [x] Run relevant unit tests, typecheck, lint, production build, and focused API privacy checks; record limits in status and commit.
