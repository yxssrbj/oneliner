# TradingView trade-history import

Status: Proposed for owner review · 30 October 2026

## Intent

Turn a TradingView paper-trading history CSV into private journal trades and useful weekly statistics. The supplied export has one entry row and one exit row per trade, with prices, quantity, opening time, and net USD P&L. It has no initial stop, setup name, original note, or timezone. Do not invent any of those values.

## Approaches

1. Save parsed trades with missing details, then let the owner edit them. The owner chose this approach because the trade history becomes useful immediately.
2. Hold the import until every stop and setup is entered. This preserves the current schema but prevents quick import and delays all statistics. Rejected by the owner.

Keep chart-candle attachment as a separate feature. Trade-history import reads entry and exit rows, not OHLC bars.

## Import flow

1. On the journal, choose a TradingView paper-trading history CSV. The preview pairs Entry and Exit rows by symbol and trade number and shows each trade's symbol, side, entry, exit, opening time, and source-reported net P&L. Reject malformed or ambiguous pairs with row-specific errors and no writes.
2. The export has no timezone. Before saving, ask for the timezone used by its timestamps, show how the opening dates resolve in UTC, and let the user confirm it. Weekly grouping continues to use the confirmed UTC opening instant.
3. Show an alert before saving: all six sample trades lack an initial stop and setup; R, R-based charts/totals, and setup analysis will be incomplete. State that the user should edit those details. Offer **Continue** and **Cancel**. Cancel makes no writes. Continue saves all valid preview rows atomically or reports failure without claiming success.
4. Show a saved summary and clear **Edit details** actions for imported trades. Reimporting the same exported trades must not duplicate them. No broker connection or automatic synchronization is part of this feature.

## Journal and statistics

- Ordinary note capture keeps its existing required note, stop, and setup validation. Imported trades may have absent note, stop, or setup; the UI labels these as missing and keeps source fields identifiable. The source CSV's net USD P&L is preserved as reported, not recalculated or represented as broker verification.
- An imported trade with an exit is **closed**, even before its stop is entered. Closed trade count and win rate use the source-reported net P&L sign: positive win, negative loss, zero breakeven. Missing setup does not prevent those metrics.
- R is calculated only when entry, exit, direction, and a valid initial stop are present. Missing R never becomes zero. Total R, average R, best R, and cumulative R chart show that their coverage is partial when closed trades are missing R. Setup analysis puts missing names in an **Unclassified** group and makes absent R explicit.
- Trades missing an exit remain in the unfinished inbox. Trades that have an exit but need a stop or setup appear as **Needs details**, not as unfinished outcomes.
- Private group comparison must not present a partial R total as a complete one. It may show closed trade count and win rate from known outcomes, with R unavailable or clearly marked partial until the missing stops are entered. Individual rows, source P&L, and notes remain private.
- Editing a stop or setup updates derived R and summaries. The original source-reported P&L remains labeled as source data if edited prices later differ from the export.

## Boundaries and acceptance

The import is owner-scoped and idempotent. It must validate file size, columns, row types, pairs, numeric values, dates, and duplicate identifiers before writing. The six trades in the supplied CSV preview as six closed trades; cancel saves zero; continue saves six; a repeat saves zero new trades. Their win rate and count are available immediately, while R and setup analysis identify missing data. After adding a valid stop and setup to one trade, its R appears without changing the other five or exposing any data to another account. Relevant parser, API, database, metrics, and browser checks pass before claiming the feature works.
