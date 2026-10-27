# Oneliner local runbook

Use the capture feature worktree for the current app. The primary checkout holds
the shared product specs and status, but its app code is older.

```sh
cd /Users/yasser/Documents/Projects/oneliner/.worktrees/capture-unfinished
git status -sb
```

Current branch: `feat/capture-unfinished`. The app is already running at
[http://localhost:3015](http://localhost:3015) when Codex has left its dev
server open. Check before starting a second server:

```sh
curl -I http://localhost:3015/sign-in
lsof -nP -iTCP:3015 -sTCP:LISTEN
```

## Start from a fresh terminal

Node.js 24+, SOPS, age, OrbStack, and the encrypted project configuration are
required. The age identity stays outside Git. Run these commands from the
feature worktree:

```sh
cd /Users/yasser/Documents/Projects/oneliner/.worktrees/capture-unfinished
node --version
export SOPS_AGE_KEY_FILE="$HOME/.config/sops/age/keys.txt"
test -f "$SOPS_AGE_KEY_FILE"
npm ci                         # only needed after a fresh checkout or lockfile change
open -a OrbStack               # only if the Docker runtime is stopped
npx supabase start              # only if the local stack is stopped
npx supabase migration up --local # only when new local migrations are pending
npm run dev -- --port 3015
```

Leave the dev command running. Open [http://localhost:3015](http://localhost:3015).
If port 3015 is occupied by another app, choose another free port in the last
command and use that port in the URLs below. `npm run dev` decrypts
`secrets/app.enc.env` in memory through SOPS; do not create a plaintext
`.env.local` for this checkout.

Local Supabase is shared by Oneliner worktrees. Its Auth health endpoint is
`http://127.0.0.1:54321/auth/v1/health`; the local email inbox is
[http://localhost:54324](http://localhost:54324). Do not use `db reset` or
`supabase stop --no-backup` to troubleshoot startup, because those can erase
local data.

## Try the app

1. Go to [Create account](http://localhost:3015/register). Enter an email,
   password, and username. Find the verification code in the
   [local inbox](http://localhost:54324), then enter the entire code. Existing
   local accounts can use [Sign in](http://localhost:3015/sign-in).
2. [Capture](http://localhost:3015/) — write a note such as
   `ES long 6100, stop 6095, opening range breakout`. Use **Suggest fields**
   to try parsing, or **Enter details manually**. Correct the fields before
   saving. Leave exit empty for an unfinished trade, or enter `6110` to save
   a completed +2R example. The original note stays with the trade.
3. [Unfinished](http://localhost:3015/inbox) — enter an exit for an open trade
   and save it. You can also open **Chart data** to import a TradingView
   chart-data CSV, or **Correct trade details**.
4. [Weekly review](http://localhost:3015/review) — use the week controls to
   find the week in which the trade opened. Check total R, win rate, pending
   trades, and the daily breakdown.
5. [Groups](http://localhost:3015/friends) — choose a display name, create a
   private group, and copy its invite link. Use a second account to test the
   invitation and compare shared weekly summaries. Personal notes stay private.
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
```

Stop the dev server before `npm run build` so both processes do not write the
same Next.js build directory. Run the full unit/database/browser suites when
reviewing a complete release:

```sh
npm test
npx supabase test db
CI=1 npm run test:e2e
```

Browser tests create local accounts and trades. Confirm the encrypted config
targets **local** Supabase and port 3012 is free before the last command;
Playwright uses port 3012 and must not reuse another worktree's server.

Press `Ctrl+C` in the dev terminal to stop only the web app. The local
Supabase stack can stay running for the other worktrees. If you need to stop
it, run `npx supabase stop --project-id oneliner` from this worktree; this
preserves its data backup.

Shared project status and next work are in `STATUS.md` and `todo.md` at
`/Users/yasser/Documents/Projects/oneliner`. No Git push is implied by any
command here.
