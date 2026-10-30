# Oneliner local runbook

Use the primary checkout for the integrated app and shared product specs.

```sh
cd /Users/yasser/Documents/Projects/oneliner
git status -sb
```

Current branch: `main`. The app is available at
[http://localhost:3000](http://localhost:3000) when Codex has left its dev
server open. Check before starting a second server:

```sh
curl -I http://localhost:3000/sign-in
lsof -nP -iTCP:3000 -sTCP:LISTEN
```

## Start from a fresh terminal

Node.js 24+, SOPS, age, OrbStack, and the encrypted project configuration are
required. The age identity stays outside Git. Run these commands from the
primary checkout:

```sh
cd /Users/yasser/Documents/Projects/oneliner
node --version
export SOPS_AGE_KEY_FILE="$HOME/.config/sops/age/keys.txt"
test -f "$SOPS_AGE_KEY_FILE"
npm ci                         # only needed after a fresh checkout or lockfile change
open -a OrbStack               # only if the Docker runtime is stopped
npx supabase start              # only if the local stack is stopped
npx supabase migration up --local # only when new local migrations are pending
npm run dev
```

Leave the dev command running. Open [http://localhost:3000](http://localhost:3000).
If port 3000 is occupied by another app, choose another free port in the last
command and use that port in the URLs below. `npm run dev` decrypts
`secrets/app.enc.env` in memory through SOPS; do not create a plaintext
`.env.local` for this checkout.

If Safari keeps an older development stylesheet after a CSS edit, choose
**View → Reload Page From Origin**.

Local Supabase is shared by Oneliner worktrees. Its Auth health endpoint is
`http://127.0.0.1:54321/auth/v1/health`; the local email inbox is
[http://localhost:54324](http://localhost:54324). Do not use `db reset` or
`supabase stop --no-backup` to troubleshoot startup, because those can erase
local data.

## Try the app

1. Go to [Create account](http://localhost:3000/register). Enter an email,
   password, and username. Find the verification code in the
   [local inbox](http://localhost:54324), then enter the entire code. Existing
   local accounts can use [Sign in](http://localhost:3000/sign-in).
2. [Capture](http://localhost:3000/) — write a note such as
   `ES long 6100, stop 6095, opening range breakout`. Use **Add** to parse and
   review the fields, then **Edit details** if needed; or use **Enter details
   manually** without AI. Leave exit empty for an unfinished trade, or enter
   `6110` to save a completed +2R example. The original note stays with the trade.
3. [Unfinished](http://localhost:3000/inbox) — enter an exit for an open trade
   and save it. You can also open **Chart data** to import a TradingView
   chart-data CSV, or **Correct trade details**.
4. [Weekly review](http://localhost:3000/review) — use the week controls to
   find the week in which the trade opened. Check total R, win rate, average R,
   best trade, cumulative chart, setup and daily results, and notes in the trade
   table. Select **Review** on a trade to correct it or add its exit.
5. [Groups](http://localhost:3000/friends) — open **Create group**, enter its
   name, and copy the invite link. Use a second account to join explicitly,
   view the member list, and compare weekly summaries. Personal notes stay private.
6. Open **Settings** from the profile row in the sidebar to edit the display
   name, switch dark/light mode, change the password, or sign out. Password
   verification and recovery codes also arrive in the local inbox.

## Checks and useful locations

```sh
git worktree list                # see all Oneliner worktrees
git status -sb                   # see this worktree and branch
npm run typecheck
npm run lint
npm run build                   # production compilation; uses SOPS
npx vitest run app/components/capture-form.test.tsx app/components/trade-review.test.tsx
ONELINER_E2E_PORT=3000 npm run test:e2e -- e2e/groups.spec.ts --workers=1
```

Stop the dev server before `npm run build` so both processes do not write the
same Next.js build directory. Run the full unit/database/browser suites when
reviewing a complete release:

```sh
npm test
npx supabase test db
CI=1 ONELINER_E2E_PORT=3019 npm run test:e2e
```

Browser tests create local accounts and trades. Confirm the encrypted config
targets **local** Supabase. Playwright uses port 3012 by default; choose a
free port such as 3019 when another worktree occupies it. With `CI=1`,
Playwright starts a fresh app and refuses to reuse an existing server.

Press `Ctrl+C` in the dev terminal to stop only the web app. The local
Supabase stack can stay running for the other worktrees. If you need to stop
it, run `npx supabase stop --project-id oneliner` from this worktree; this
preserves its data backup.

Shared project status and next work are in `STATUS.md` and `todo.md` at
`/Users/yasser/Documents/Projects/oneliner`. No Git push is implied by any
command here.

## Try TradingView history on the feature branch

The import is on `feat/tradingview-history`, not yet integrated into `main`.
Use its worktree and an unused port:

```sh
cd /Users/yasser/Documents/Projects/oneliner/.worktrees/tradingview-history
git status -sb
export SOPS_AGE_KEY_FILE="$HOME/.config/sops/age/keys.txt"
npx supabase status             # verify the shared local stack is healthy
npx supabase migration up --local
npm run dev -- --port 3020
```

Open [the feature capture page](http://localhost:3020/), register or sign in
with a local account, and use **Import TradingView history**. Select a
paper-trading history CSV, enter its actual export timezone, and select
**Preview trades**. Inspect UTC opening times and the missing-details warning.
Confirm the timezone before **Continue**, or **Cancel** without saving.
Every saved import offers **Edit details**. Weekly review groups by UTC
opening week; completed count/win rate are available before R. A valid stop
reveals R; setup corrections update classification. **Chart data** on a
trade remains the separate OHLC candle attachment flow.

The supplied private CSV contains no timezone. The local verification used
`Europe/Warsaw` only as an explicit smoke-test assumption; confirm the real
export timezone before using its weekly placement as a journal record.
Do not commit private exports or upload them to a hosted test app.

Focused checks run on 30 October 2026 (204 tests, 145 SQL assertions):

```sh
npx vitest run lib/trades/tradingview-history.test.ts lib/trades/summary.test.ts lib/trades/review.test.ts app/api/trades/import/tradingview/route.test.ts app/api/trades/route.test.ts 'app/api/trades/[tradeId]/route.test.ts' 'app/api/groups/[groupId]/metrics/route.test.ts' app/components/tradingview-history-import.test.tsx app/components/capture-form.test.tsx app/components/trade-review.test.tsx app/components/weekly-review.test.tsx app/components/group-metrics.test.tsx
npx supabase test db supabase/tests/database/trade_history_import.test.sql supabase/tests/database/groups.test.sql supabase/tests/database/core.test.sql
npm run typecheck
CI=1 ONELINER_E2E_PORT=3021 npm run test:e2e -- e2e/tradingview-history.spec.ts --workers=1
```

The SOPS identity export also applies to Playwright's launcher. `CI=1`
starts a fresh app, so choose a port with no existing listener. Browser tests
create local accounts and data; do not reset the shared Supabase stack.
The synthetic fixture is portable and contains no supplied account history.
Local focused ESLint and both synthetic and private-file browser checks
passed; the temporary private-file test was removed after verification.
No hosted writes, push, full suite, or production build was performed.

## Friend preview deployment checklist

The full local check on `feat/tradingview-history` passed on 30 October 2026:
463 unit tests, 182 database assertions, 25 browser journeys, typecheck,
lint (two existing chat image warnings), and a production build. A direct
`next build` also passed using environment variables. `vercel.json` tells
Vercel to use `next build`; local `npm run dev` and `npm run build` still use
SOPS. Do not upload the age identity or encrypted local environment as
Vercel variables.

Before sharing a Vercel URL with friends:

1. Integrate and push this branch; the GitHub `main` branch does not yet
   contain the import. Connect that pushed branch or updated `main` to Vercel.
2. Apply and verify these pending migrations on hosted Supabase project
   `svohohmwwbriepmupswk`, in order: `202610280001_group_chat`,
   `202610280002_chat_sender_retention`, `202610280003_group_rename`,
   `202610300001_trade_history_import`, and
   `202610300002_group_history_metrics`. Check migration history and
   privacy behavior afterward. The local database already has them.
3. In Vercel project settings, choose Node.js 24 and configure
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   from the **hosted** Supabase project. Configure `OPENAI_API_KEY` as a
   server-side variable for note suggestions. Never use the local Supabase
   URL or put the OpenAI key in a `NEXT_PUBLIC_` variable.
4. Once Vercel provides the actual URL, set it as the hosted Supabase Auth
   Site URL and add any needed preview URLs to the Auth redirect allowlist.
   Verify code delivery, signup, password sign-in/recovery, private trade
   reads, capture, review, and group invite with two separate accounts.
   Chat may remain unfinished for this first friend test.
5. Confirm the SMTP sender can reach a friend's address. Delivery to the
   project owner's address alone does not prove this; a Resend test sender
   may require a verified domain before sending to other recipients.

Vercel's [build configuration](https://vercel.com/docs/project-configuration/vercel-json)
and Supabase's [redirect URL guide](https://supabase.com/docs/guides/auth/redirect-urls)
describe the hosted settings. No hosted migration, push, or Vercel deployment
was performed during the local release check.
