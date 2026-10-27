# Weekly review

Status: Implementation directed by project owner · 28 October 2026

Baseline: approved [PRD](../prd.md) REV-01–04, OUT-01–03, ACC-03, UI-01–05. Visual reference: [desktop preview](../../docs/previews/oneliner-desktop.html). This feature keeps the existing authenticated trade API and correction flows.

## Experience

The selected week is Monday 00:00 UTC through the next Monday 00:00 UTC, exclusive. A trade belongs to the week it opened, even if its exit or correction is entered later. Previous and next controls allow unlimited history. The period and UTC boundary are visible.

The review uses one authorized week of trades for every section. A compact strip shows total R, win rate, average R, best trade, completed count, and unfinished count. Only trades with an exit and calculated R contribute to performance figures. Wins have R above zero; breakeven trades count as completed but are not wins. When no trade is completed, total R, average R, best R, and win rate display as unavailable; counts remain zero or actual counts.

A cumulative R chart starts at zero and adds each completed trade in ascending opening timestamp, then ID order for ties. It shows exact trade and cumulative values on keyboard focus and hover, with a text summary for screen readers. Its final value equals total R. Display rounds to two decimals; aggregation uses unrounded saved R.

Setup rows show each setup's completed total R, completed count, wins, and unfinished count. The daily cards cover all seven UTC days and show completed and unfinished counts plus completed total R. The trade table lists all trades in descending opening order, including original notes, setup, prices, result, and an action to review/correct that trade. An unfinished banner links to the dedicated unfinished list; each unfinished trade can also receive an exit from the review. Existing chart import and correction controls remain reachable.

Loading, error, empty-week, all-unfinished, and save feedback are explicit. An API failure must not masquerade as an empty week. Account changes hide the prior account's records and ignore late responses. Demo data is allowed only behind the existing development-only demo flag.

## Acceptance

1. Week boundary, late exit, backdated opening, and corrected opening time place a trade in exactly one correct week.
2. Headlines, chart endpoint, setup totals, daily totals, and table agree for wins, losses, breakeven, and unfinished trades.
3. Empty and all-unfinished weeks show unavailable performance without fabricated chart points.
4. Corrections and exits refresh the selected week's data; private notes are never fetched for or shown to another account.
5. The desktop layout is usable at 1280 × 800 and 1440 × 900 in dark and light themes, with keyboard accessible chart details and actions.
