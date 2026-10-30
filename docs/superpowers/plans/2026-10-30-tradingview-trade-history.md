# TradingView Trade-History Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import a TradingView paper-trading history CSV as private journal trades, including closed-trade statistics when stop and setup are missing.

**Architecture:** A server parser pairs entry and exit rows and converts a user-confirmed timezone to UTC. An authenticated preview endpoint makes no writes; its commit operation reparses the same file and calls one database function for an atomic, idempotent import. Nullable imported details are source-marked; ordinary note capture retains strict validation. Review and group metrics distinguish closed trades from R-eligible trades.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Playwright, Supabase Postgres/pgTAP.

**Spec:** `docs/superpowers/specs/2026-10-30-tradingview-trade-history-design.md`

## Global Constraints

- Desktop first; follow `docs/previews/oneliner-desktop.html` and existing UI patterns.
- Keep personal trade rows and source P&L private; group comparison exposes aggregates only.
- Do not invent initial stops, setups, notes, or timezone; R remains database-calculated.
- Preserve existing chart-candle attachment and manual capture behavior.
- Use red → green → refactor for every code change, commit each tested task, and run focused checks plus typecheck. Do not run the full suite without the owner's request.
- Read relevant `node_modules/next/dist/docs/` guides before writing Next.js route or page code.
- This is a high-risk schema, privacy, and statistics change: inspect changed SQL, callers, failure paths, and recovery before reporting completion. Do not push without a fresh request.

## Review Focus

- A CSV with repeated or mismatched entry/exit rows must fail before any write (Task 1 parser tests; Task 2 database tests).
- A timezone with a skipped or repeated daylight-saving local time must require correction, never silently shift a week (Task 1 tests).
- Reimporting identical trades must report already present; changed data under the same source identity must fail without overwriting (Task 2 tests).
- Switching accounts during preview or save must hide the prior account's preview and never attribute its trades to the new account (Task 4 browser test).
- A closed imported trade with no stop must count as closed but must never add fake 0R to personal or group totals (Task 3 tests).

---

### Task 1: Parse paper-trading history

**Files:** Create `lib/trades/tradingview-history.ts`, `lib/trades/tradingview-history.test.ts`; add a small synthetic CSV fixture in `lib/trades/fixtures/` with the supplied file's column shape. Do not commit the user's downloaded file.

**Interfaces:** Export `parseTradingViewTradeHistoryCsv(csv: string, timeZone: string): ImportedTrade[]`. `ImportedTrade` has `sourceKey`, `symbol`, `side`, `entryPrice`, `exitPrice`, `openedAt` (UTC ISO), `sourcePnlUsd`, and `quantity`, all serializable strings except `side`.

- [ ] Write focused tests for entry/exit pairing, six-trade shape, long/short and P&L signs, duplicate/missing/mismatched rows, invalid prices and quantities, 2 MB/5,000-row bounds, unknown timezone, and daylight-saving gaps/overlaps. Assert row-numbered errors and no invented fields.
- [ ] Run `npx vitest run lib/trades/tradingview-history.test.ts` and confirm the intended failures.
- [ ] Implement the CSV parser and deterministic `sourceKey` from symbol, trade number, and entry/exit order IDs. Use `Intl` for timezone conversion and reject ambiguous local times. Avoid a new dependency.
- [ ] Re-run the focused tests and `npm run typecheck`; inspect the parser diff and commit with `Import: parse TradingView trade history`.

### Task 2: Persist imported trades atomically

**Files:** Create `supabase/migrations/202610300001_trade_history_import.sql` and `supabase/tests/database/trade_history_import.test.sql`; update `supabase/tests/database/core.test.sql` column-shape assertion and `supabase/tests/schema.test.ts` as needed.

**Interfaces:** Add nullable imported `original_note`, `stop_price`, `setup`, plus `source_key`, `source_net_pnl_usd`, and `source_quantity`; manual rows retain non-null checks. Add `public.import_trade_history(rows jsonb)` as a security-invoker function returning inserted and already-present counts. Import rows carry Task 1's strings; the function assigns `auth.uid()` and performs one transaction.

- [ ] Write pgTAP assertions for nullable imported details, preserved manual constraints and calculated R, owner-only access, identical reimport, changed-row conflict, malformed payload rollback, and no cross-account reads. Run `npx supabase test db supabase/tests/database/trade_history_import.test.sql` and confirm failures before migration.
- [ ] Add the migration: source-aware constraints, owner/source-key uniqueness, exact source P&L/quantity storage, and atomic import. Keep existing R generation and row-level security. Reject a changed existing source row explicitly.
- [ ] Re-run the focused database test, `npx vitest run supabase/tests/schema.test.ts`, and `npm run typecheck`; review all changed SQL and commit with `Import: store incomplete history trades`.

### Task 3: Correct personal and group statistics

**Files:** Modify `lib/trades/review.ts`, `lib/trades/review.test.ts`, `app/components/weekly-review.tsx`, `app/components/group-metrics.tsx`, `app/components/group-metrics.test.tsx`, and `app/api/groups/[groupId]/metrics/route.ts`; create `app/components/weekly-review.test.tsx`, `app/api/groups/[groupId]/metrics/route.test.ts`, and a subsequent migration for `group_weekly_metrics`; update `supabase/tests/database/groups.test.sql`.

**Interfaces:** A closed trade has an exit. Its outcome sign comes from source net P&L for imported trades, otherwise from calculated R. Add `missingRCount` to personal metrics. Return nullable `totalR` for a group when any closed trade lacks R; keep closed count and win rate available. Group response adds no individual trade fields.

- [ ] Add failing unit, component, and pgTAP cases for six closed imports with missing stops/setups; mixed manual/imported weeks; breakeven; partial R; `Unclassified` setup; and group privacy/partial R. Run those focused tests and confirm failures.
- [ ] Implement shared outcome logic, update weekly displays and group RPC/API/UI so R is unavailable or explicitly partial, and keep the exit-only inbox semantics.
- [ ] Re-run focused unit/component/database checks and `npm run typecheck`; inspect all aggregation callers and commit with `Review: distinguish closed trades from R results`.

### Task 4: Preview, warn, save, and edit

**Files:** Create `app/api/trades/import/tradingview/route.ts` and `route.test.ts`, `app/components/tradingview-history-import.tsx` and `.test.tsx`, and `e2e/tradingview-history.spec.ts`; modify `app/api/trades/route.ts` and `.test.ts`, `app/api/trades/[tradeId]/route.ts` and `.test.ts`, `lib/trades/summary.ts` and `.test.ts`, `app/components/capture-form.tsx` and `.test.tsx`, `app/components/trade-edit-form.tsx`, `app/components/trade-workspace.tsx`, `app/components/exit-form.tsx`, and existing component CSS. Extend the new import component test for edit and display behavior.

**Interfaces:** `POST /api/trades/import/tradingview` accepts `{csv,timeZone,commit}`. `commit:false` returns parsed preview without writing. `commit:true` reparses and calls Task 2's RPC; returns inserted/already-present counts. The UI retains the CSV in memory until Cancel or confirmed save, defaults the timezone field to the browser zone but requires explicit confirmation, and has accessible Continue/Cancel actions.

- [ ] Write failing route/component tests for the supplied six-trade shape, timezone confirmation, missing stop/setup warning with effects, Cancel making no write, Continue saving, retry after failure, owner/session change, and imported-trade edit actions. Include row-specific parse errors. Add the focused Playwright journey from Task 5 and observe its missing-UI failure before implementation.
- [ ] Implement the route and preview UI. Require server authentication on both preview and commit; keep CSV size bounded and pass only validated rows to the RPC. Add source P&L to trade reads and correction responses, and make the legacy weekly API summary count closed imports consistently. Label missing note/stop/setup on saved trades; edit form adds details and leaves original source P&L labeled.
- [ ] Re-run focused route/component tests and `npm run typecheck`; run focused ESLint on touched TS/TSX; inspect private-data paths and commit with `Import: add trade-history review flow`.

### Task 5: Browser proof and product documentation

**Files:** Create or extend one focused `e2e/` import journey; update `specs/prd.md`, `specs/features/trade-journal.md`, `todo.md`, `STATUS.md`, `RUNBOOK.md`, and `lessons.md` only for durable decisions.

- [ ] Complete the Playwright journey started in Task 4 with a portable synthetic CSV fixture: preview, inspect the warning, cancel and verify zero saved, then confirm timezone and continue. Verify repeat import creates none, weekly closed count/win rate are available, R is unavailable, edit one stop/setup to reveal its R, and a second account cannot read the trades. Separately exercise the supplied six-trade file locally without committing it.
- [ ] Run focused parser/API/component/DB checks, `npm run typecheck`, focused ESLint, and the browser journey. Check for partial writes, wrong week placement, and misleading group totals.
- [ ] Update the PRD and feature spec to distinguish chart data from trade-history import; record run commands and actual verification in `STATUS.md`; inspect the full diff and commit with `Import: verify journaled history flow`.

## Handoff

The owner approved the design on 30 October 2026. Review this plan before implementation. Use the previously selected subagent-driven workflow if the owner confirms this plan, with fresh task review after each task. Apply migrations to the local Supabase project only during implementation; hosted deployment is separate.
