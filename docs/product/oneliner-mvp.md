# Oneliner MVP: product definition

**Status:** Historical MVP baseline. The [approved shared PRD](../../specs/prd.md) records the desktop-only direction, revised registration, and private group chat. This historical document's conflicting phone-first and earlier scope statements are no longer the target.

## Who it is for and why

Oneliner is for individual futures traders who want to record a trade quickly from a phone, finish its outcome later, and understand their week without maintaining a spreadsheet. A small circle of trader friends can compare self-reported performance without revealing personal journal entries. The first testers are the creator and interested trader friends.

## What the first release does

### Capture a trade

1. A signed-in trader writes a natural-language note, such as “CL short 87.64, stop 87.90, opening range breakout.”
2. Oneliner suggests a symbol, long or short position, entry price, initial stop, and setup name. The trader sees and can correct every suggestion before saving. Missing or ambiguous values stay empty with a clear explanation; the app does not invent them.
3. Saving requires the original note, symbol, direction, entry, initial stop, setup, and opening time. Opening time defaults to now and can be changed. A long stop must be below entry; a short stop must be above entry.
4. The saved trade keeps the original note exactly as entered and may have no exit yet. A confirmed save remains available after refresh or signing in again. If parsing is unavailable, the trader can fill the fields manually. If saving fails, the note and corrections remain for retry and the app does not claim success.

### Finish and correct a trade

1. An unfinished-trade inbox shows trades without an exit.
2. The trader can enter one exit price later, including from the weekly review. Oneliner calculates the result in R from the saved entry, initial stop, and exit: `(exit − entry) / (entry − stop)` for long, `(entry − exit) / (stop − entry)` for short.
3. Positive R is a win, negative R is a loss, and zero is breakeven. The trader can correct confirmed trade fields or the exit; the result and summaries update. The original captured note remains visible.

### Review a week

1. The trader selects a week and sees trades opened in that week, their notes, completed results, and entries still missing an exit.
2. The review shows total R, win rate, completed trade count, and unfinished count. Only completed trades contribute to total R and win rate. Breakevens count in the win-rate denominator. With no completed trades, win rate is unavailable.
3. Weeks start Monday at 00:00 UTC and end the next Monday at 00:00 UTC. A trade belongs to the week it opened, even when it is completed or corrected later.

### Compare with friends

1. A trader can create a private group and invite friends. Before joining, a friend sees that joining shares their weekly total R, win rate, and completed trade count with group members. Joining is the opt-in.
2. Members compare those figures for the same selected week, alongside display names. Comparisons are labeled self-reported.
3. Members can leave. The group owner can remove a member, replace an invite link, or close the group. Removing a member invalidates the old link. A former member cannot see the group; the group cannot see the former member's figures.
4. No group member can see another person's notes, trade rows, prices, or setups.

## What counts as done

The MVP is ready for the first friends to test when all of these checks succeed in the deployed, phone-friendly app:

- Two people can independently sign in. Each can capture a note, correct suggestions, save it, return later, add an exit, and see the calculated result and its opening-week review.
- An unclear note leaves uncertain fields empty. A parser outage still permits manual entry. Invalid or missing required fields block saving with useful errors.
- A failed save retains the draft for retry; a successful save is still present after refresh. Repeated taps do not create duplicate trades.
- Long and short wins and losses, breakeven, empty weeks, the UTC week boundary, and a late exit produce the expected R and weekly figures.
- One person can join a private group and compare weekly summaries with another. Neither account can view the other's individual trades or notes, including by requesting data directly. Leaving or removal revokes access; an old invite cannot restore it.
- The capture, inbox, review, and friends flows work on a phone viewport without horizontal scrolling. Errors and unfinished states are clear enough for a tester to recover without help.

You review each small implementation change, try its normal and edge cases, and decide whether it is acceptable before we build on it. The release is done only after you accept the complete flow above.

## Outside the first release

Broker connections, live execution tracking, order placement, multiple entries or exits, scaled positions, fees, broker-verified results, and AI-written trading advice are outside this release. Visual polish beyond a usable interface can follow feedback from testers; the current palette is provisional.
