# Oneliner MVP design

## Purpose and release boundary

Oneliner is a mobile-friendly trading journal for futures traders. A trader can capture a trade in a short natural-language note, finish it later, review the week, and optionally compare summary performance with friends. The first release is small enough to deploy for a handful of testers and useful without a broker connection.

The MVP includes account sign-in, trade capture and completion, a weekly review, and private groups. It does not include broker imports, live execution tracking, order placement, partial fills, scaled positions, fees, automated trade verification, or AI-written performance advice.

## Experience

1. A signed-in trader writes a note such as “CL short 87.64, stop 87.90, opening range breakout.” Oneliner sends the note to an AI parser and shows an editable preview. The parser may suggest symbol, long or short, entry, initial stop, and setup name. It is instructed to return an empty field and a plain-language clarification when a value is absent or ambiguous. Suggestions are never treated as verified values; the user confirms them before saving.
2. The opening time defaults to the current time and can be edited. The user must confirm symbol, direction, entry, initial stop, setup name, and opening time before saving. The initial stop must be on the loss side of entry and cannot equal entry. The original note is saved exactly as entered alongside the confirmed fields.
3. A trade can remain unfinished. The inbox lists the user's trades without an exit. Adding one exit price completes a trade. Oneliner calculates its R result and labels it win, loss, or breakeven. The user can correct a trade's own details or exit later; the calculated result and summaries update accordingly.
4. The review page shows the trades opened in a selected week, their original notes, completed results, total R, win rate, completed count, and unfinished count. An unfinished trade can be completed from this page. It is available throughout the week; “Sunday review” is a use case, not a scheduled job.
5. A user can create a private group and share an invite link. Before joining, a friend sees that joining shares weekly total R, win rate, and completed trade count with group members. Joining is the opt-in. Members can leave; the owner can remove members, regenerate the invite link, or close the group. Removing a member also rotates the invite link so the removed member cannot reuse it. A former member can no longer see the group's data, and the group can no longer see that member's summaries. No member can see another member's notes, individual trades, prices, or setups.

The interface uses four destinations: Capture, Inbox, Review, and Friends. The mobile layout uses bottom navigation; larger screens use a sidebar. The visual direction is dark graphite surfaces, clear off-white type, and restrained amber accents. Green and red communicate results only. The standalone [`public/preview.html`](../../../public/preview.html) is a visual concept with sample data; it is not the functional application.

## Result and week rules

The MVP models one entry, one initial stop, and one exit per trade. Prices are stored as decimal values. For a long position, `R = (exit - entry) / (entry - stop)`; for a short position, `R = (entry - exit) / (stop - entry)`. Invalid stops block saving. Positive R is a win, negative R is a loss, and exactly zero is breakeven. The formula uses actual entered exit price but does not account for commissions, contract size changes, or multiple fills.

A week is Monday 00:00 UTC through the next Monday 00:00 UTC, with the end excluded. A trade belongs to the week its position opened, even if its exit is recorded later. Performance totals use completed trades only. Total R sums their unrounded R values and rounds for display. Win rate is wins divided by all completed trades, including breakevens in the denominator. When there are no completed trades, win rate displays as unavailable rather than 0%. Trade count in group comparisons means completed count. Late completions and corrections update the original week's figures. Group figures are labeled self-reported.

## System design

- **Web app:** Next.js App Router with TypeScript and plain CSS. Responsive forms and lists provide the core experience; no native app or component library is needed.
- **Sign-in and storage:** Supabase Auth with one-time email codes and Postgres. `profiles` holds a user-chosen display name. `trades` holds owner, original note, confirmed fields, opening time, optional exit, and timestamps. `groups` holds owner, name, and an unguessable invite token. `group_members` holds membership. Database constraints protect required fields and valid stop placement; row-level security protects ownership even if a client bypasses the form.
- **AI parsing:** One authenticated Next.js server endpoint calls OpenAI with Structured Outputs. The API key stays on the server. The endpoint accepts a bounded-length note, asks for nullable fields plus clarification messages, and returns suggestions without saving a trade. The browser displays the response for correction. If parsing fails or is unavailable, the user keeps the note and can fill the form manually.
- **Privacy:** Postgres row-level security allows users to read and edit their own trades only. A narrowly scoped database function checks `auth.uid()` for current group membership, uses a fixed search path, and returns weekly aggregates and display names, never trade rows or notes. Invite joining and member removal run through authenticated server operations. No service key or AI key is sent to the browser.
- **Hosting:** Deploy the web app to Vercel and use a Supabase project for Auth and Postgres. OpenAI is used only for note extraction. Provider accounts and keys are supplied at deployment time.

The browser keeps an unsaved form draft in session storage across refreshes in the same tab and clears it after confirmed saving or sign-out. The interface does not call a draft “saved.” The Save action reports success only after the database confirms the write. A failed save leaves the note and corrections in place with a clear error and a retry action. Duplicate submissions are prevented while a save is in progress. AI parsing is advisory; the confirmed form and server validation are authoritative.

## Delivery and review checks

The initial delivery is successful when a friend can sign in on a phone, capture and correct a note, finish it later, view a weekly review, join a private group, and see only shared summary figures. The implementation should check the R formula for long, short, loss, win, and breakeven cases; UTC week boundaries; empty weeks; parsing failures; failed writes; and attempts by one account to read another account's trades or a group it has not joined.

Known first-release limits are self-reported data, one entry and exit per trade, no fee adjustment, and AI suggestions that require user review. The app must show these limits where they affect a user's interpretation of a result.
