# Capture and unfinished trades

Status: Approved by project owner · 27 October 2026

Product baseline: [PRD](../prd.md) CAP-01–05, OUT-01–03, ACC-03, UI-01–04, and IMP-01–03. Visual target: [approved desktop preview](../../docs/previews/oneliner-desktop.html), Capture and Unfinished screens.

## Intent and completion

An individual trader can record a trade quickly from a natural-language note, correct the suggested details, and save it without losing the note. A trade without an exit appears in a clear unfinished list; adding an exit calculates R and removes it from that list. The two screens should feel like the approved desktop preview while showing only real, authorized data.

Completion means capture and exit work through the actual app and survive refresh, failures keep recoverable input, and another account cannot see a note, draft, recent trade, or unfinished trade. Populated and empty screens are reviewed at 1280 × 800 and 1440 × 900.

## Approaches

1. **Reshape the existing capture and trade workspace components (selected).** Keep their account guards, API calls, corrections, chart import, and save behavior; add only the small API support needed for recent trades and an optional exit. This minimizes duplicate privacy-sensitive logic.
2. Replace both screens with new components. This gives a clean layout file but duplicates save, retry, and account-switch handling that already works.
3. Embed the standalone preview. Its sample trades and simulated actions would enter production, so it cannot be the working screen.

The selected approach is an implementation choice based on the approved preview and existing app. It does not add synthetic production data.

## Capture screen

- The main column begins with the original note and an Add action. Add parses the note, then shows the filled trade details for review before saving. Edit details opens the fields for corrections; missing or uncertain suggestions open editable fields directly. A trader can enter details manually without invoking AI. Parser uncertainty is explained beside the review step.
- Review shows symbol, direction, setup, entry, initial stop, opening date and time, and optional exit in a compact grid. Required fields and the stop relationship use the existing validation rules. A present exit must be a positive decimal price; server-calculated R is authoritative.
- The original note is preserved exactly. A failed parse leaves the note and manual fields available. A failed save keeps the draft and idempotency key so retry cannot create a second trade. Success resets capture and updates the recent list.
- A secondary column shows the three most recently saved trades for this account, ordered by creation time even when a trade is backdated, with result or Needs exit and a short note excerpt. It has honest loading, empty, and retryable error states; it never shows preview samples or another user's data. Avoid decorative filler.
- Drafts and recent items remain hidden until the browser confirms the signed-in owner. Account changes clear or hide previous-account content and ignore stale responses.

## Unfinished screen

- Show the actual number of trades awaiting exits, newest opening first. Each compact card shows symbol, direction, setup, original note, opening time, entry, initial stop, and per-unit risk. Values must come from the saved trade, not a guess.
- An exit field and save action are visible on each card. Success uses the returned trade and removes the card when the refreshed authorized list confirms it. Failure keeps the entered exit with a clear retry path. Saved corrections and private chart imports remain reachable.
- Empty and load-error states are distinct. Empty says all trades have exits; a load error offers Retry and does not pretend there are zero unfinished trades.
- An exit entered here updates R and the trade's opening-week review through the existing server and database behavior. Sign-out or account replacement hides old notes and ignores pending responses.

## Acceptance and review

1. A trader can save both an unfinished trade and a trade with an exit from capture; a repeated save with the same key returns the same record, and conflicting details are rejected.
2. Parser failure, invalid fields, server failure, refresh, and retry preserve the original note and corrections. Manual capture never requires an AI request.
3. The recent list contains only the signed-in owner's three latest trades; empty and error states are truthful.
4. An unfinished trade can be closed from its card. Failed exit submission keeps the value; success removes the card and the opening-week summary uses the calculated R.
5. Different accounts, sign-out, and late responses never reveal a previous account's notes or drafts. Direct API access remains private.
6. Browser review covers populated, empty, loading, and error states at 1280 × 800 and 1440 × 900, keyboard focus, labels, visible feedback, and both themes.

No broker sync, mobile layout, AI advice, generated trade examples, or new database tables are included.

## TradingView paper-trading history · approved 30 October 2026

The [approved import design](../../docs/superpowers/specs/2026-10-30-tradingview-trade-history-design.md) extends capture with **Import TradingView history**. This reads paired Entry/Exit rows; **Chart data** continues to attach OHLC candles independently.

- Select a history CSV, supply its timezone, and preview symbol, side, prices, UTC opening time, and source-reported net USD P&L. The timezone default is a suggestion; saving requires explicit confirmation. Reject malformed, ambiguous, oversized, or conflicting source data with a visible error.
- Warn that missing initial stops and setups leave R-based totals/charts and setup analysis incomplete. **Cancel** saves zero; **Continue** saves every valid trade in one transaction. Show saved/already-present counts and **Edit details** on every imported trade. Identical reimports are safe; conflicting source details are rejected.
- Keep absent notes, stops, and setups absent and labeled. A saved exit makes an imported trade closed even when R is unavailable. Source P&L determines win/loss/breakeven; it is reported data, not broker verification. Manual capture validation stays strict.
- Personal review shows closed count and win rate immediately, explicit missing-R coverage, and **Unclassified** setups. Group comparison returns unavailable R when any closed trade lacks it; source P&L, prices, notes, and individual trades remain private.
- Adding a valid stop reveals calculated R; adding a setup updates classification. Corrections never replace the original source P&L or source identity. An imported closed trade needing details does not enter the unfinished inbox.
- Browser acceptance uses a portable synthetic CSV: preview, timezone gate, warning, cancel with zero writes, save six, repeat with zero new rows, week-filtered count/win rate with unavailable R, correct one stop/setup, and deny a second account access. Exercise supplied private exports separately against local Supabase only; never commit them.
