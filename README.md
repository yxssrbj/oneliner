# Oneliner

A trading journal for quick note capture, completing trades, reviewing opening weeks, and comparing private weekly summaries with friends. This is a Next.js web app backed by Supabase Auth and Postgres. OpenAI parsing is optional; manual capture remains available.

## Run locally

1. Use Node.js 24+ on macOS/Linux. Install SOPS 3.13.3+ and age (`brew install sops age` on macOS), then install dependencies with `npm ci`.
2. Start a Docker-compatible runtime, then run `npx supabase start`.
3. Obtain the authorized age identity through your secure channel. Keep it outside the repository at `~/.config/sops/age/keys.txt` with permissions `chmod 600 ~/.config/sops/age/keys.txt`. Export `SOPS_AGE_KEY_FILE="$HOME/.config/sops/age/keys.txt"` (or your actual identity path) in your shell. This checkout loads encrypted configuration from `secrets/app.enc.env`; its public recipient rules are in `.sops.yaml`. Verify it targets your local Supabase before using browser tests.
4. Run `npx supabase migration up --local` to apply pending migrations without resetting data.
5. Run `npm run dev` and open [localhost:3000](http://localhost:3000).

The local email inbox is at [localhost:54324](http://localhost:54324). Sign-in uses the numeric code in the email; the local template is in `supabase/templates/sign-in-code.html`.

After moving this checkout, run `npx supabase stop --project-id oneliner`, then `npx supabase start` from the new folder. This preserves local data and recreates containers with the new email-template mount path. Do not use `--no-backup`, which deletes the local data volumes.

Capture is `/`, unfinished trades are `/inbox`, weekly review is `/review`, and private groups are `/friends`. The separate `/preview.html` is a static visual concept with sample data.

## Encrypted configuration

`npm run dev`, `npm run build`, `npm run start`, and `npm run test:e2e` decrypt configuration into the launched process environment using SOPS. Missing ciphertext, identity, or decryption failure stops startup. After successful decryption, Next.js can still load additional variables from existing `.env*` files; encrypted values take precedence. Extra arguments work normally: `npm run dev -- --port 3100`. Unit tests, lint, and type generation do not need your identity (wrapper tests generate disposable synthetic credentials and require the installed SOPS/age tools).

The wrapper replaces itself with SOPS and then the requested command, preserving exit codes and signals without a background launcher. Each separately launched command must use its own npm wrapper; a server launched in another terminal does not inherit a previous command's decrypted environment. Keep existing plaintext files and backups until startup verification and an explicit later cleanup decision.

To change one value without printing it, putting it in shell history, or writing decrypted configuration to disk, read it silently and pass a JSON string to SOPS on stdin:

```sh
python3 -c 'import getpass,json; print(json.dumps(getpass.getpass("New value: ")))' | sops set --value-stdin secrets/app.enc.env '["OPENAI_API_KEY"]'
```

Use the required variable name from `.env.example`. Do not redirect decrypted output to a file or use ordinary `sops edit` when plaintext temporary files are prohibited. Encryption protects the file at rest: `NEXT_PUBLIC_*` values remain public and Next.js embeds them at build time. Rebuild after changing public configuration before `npm run start`.

## Private groups

Save a display name on Friends, create a group, and copy its invite link. A friend signs in and explicitly joins after seeing which figures will be shared. Group members see display names, total R, win rate, and completed trade counts for the selected UTC opening week. Notes, individual trades, prices, setups, and chart imports remain private. Results are self-reported.

Members can leave. The owner can remove members, replace the invite link, or close the group. Removal invalidates the previous invite link. Closing a group removes its membership and invitation records while preserving everyone's journal trades.

## Checks

```sh
npm test
npm run typecheck
npm run lint
npm run build
npx supabase test db
CI=1 npm run test:e2e
```

Browser tests use local Supabase and its email inbox, create disposable test accounts/trades, and run the app on port 3012. Before running them, verify `secrets/app.enc.env` targets local Supabase and port 3012 is free. Use `CI=1 npm run test:e2e` to require a fresh server and refuse reuse of an unrelated running server. The wrapper gives decrypted values to Playwright and its Next.js child. Do not point these tests at hosted data.

## Release status

Implementation and local testing are separate from deployment. Hosted Supabase needs the committed migrations applied before deploying this branch. The complete deployed two-account flow still needs verification before inviting testers.

The updated direction is in [the PRD draft](specs/prd.md), with detailed specifications under [specs/features](specs/features/README.md). The [original product definition](docs/product/oneliner-mvp.md) and [MVP plan](docs/superpowers/plans/2026-10-17-oneliner-mvp.md) describe the earlier implementation baseline. The runtime instructions above still describe the existing app, not the proposed password signup and chat.

## Check product direction

The canonical `specs/` folder lives in the primary Oneliner checkout, shared by all feature worktrees. In Codex, run `$direction` to compare the current worktree’s implementation with that shared PRD and its feature specs; branch-local specification snapshots are historical copies, not separate requirements. You can narrow it, for example `$direction weekly review`. The canonical command lives at `skills/direction/SKILL.md` in the primary checkout and is registered once in the local Codex skills directory for all worktrees.

The check is read-only. It distinguishes demonstrated drift from planned work and unverified behavior, cites requirements and source evidence, and recommends the next correction without changing the product or its requirements.
