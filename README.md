# Oneliner

A trading journal for quick note capture, completing trades, reviewing opening weeks, and comparing private weekly summaries with friends. This is a Next.js web app backed by Supabase Auth and Postgres. OpenAI parsing is optional; manual capture remains available.

## Run locally

1. Install dependencies with `npm ci`.
2. Start a Docker-compatible runtime, then run `npx supabase start`.
3. Copy `.env.example` to `.env.local`. Set the local Supabase URL and public key reported by the CLI. Add `OPENAI_API_KEY` only if you want AI parsing. Keep credentials out of Git.
4. Run `npx supabase migration up --local` to apply pending migrations without resetting data.
5. Run `npm run dev` and open [localhost:3000](http://localhost:3000).

The local email inbox is at [localhost:54324](http://localhost:54324). Sign-in uses the numeric code in the email; the local template is in `supabase/templates/sign-in-code.html`.

After moving this checkout, run `npx supabase stop --project-id oneliner`, then `npx supabase start` from the new folder. This preserves local data and recreates containers with the new email-template mount path. Do not use `--no-backup`, which deletes the local data volumes.

Capture is `/`, unfinished trades are `/inbox`, weekly review is `/review`, and private groups are `/friends`. The separate `/preview.html` is a static visual concept with sample data.

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
npm run test:e2e
```

Browser tests use local Supabase and its email inbox, create disposable test accounts/trades, and run the app on port 3012. Before running them, make sure `.env.local` points to local Supabase and any server already on port 3012 is this checkout with that configuration. Do not point these tests at hosted data.

## Release status

Implementation and local testing are separate from deployment. Hosted Supabase needs the committed migrations applied before deploying this branch. The complete deployed two-account flow still needs verification before inviting testers.

The updated direction is in [the PRD draft](specs/prd.md), with detailed specifications under [specs/features](specs/features/README.md). The [original product definition](docs/product/oneliner-mvp.md) and [MVP plan](docs/superpowers/plans/2026-10-17-oneliner-mvp.md) describe the earlier implementation baseline. The runtime instructions above still describe the existing app, not the proposed password signup and chat.

## Check product direction

In Codex, run `$direction` from this worktree to compare the implementation with `specs/prd.md` and relevant feature specs. You can narrow it, for example `$direction weekly review`. The project skill lives at [.agents/skills/direction/SKILL.md](.agents/skills/direction/SKILL.md).

The check is read-only. It distinguishes demonstrated drift from planned work and unverified behavior, cites requirements and source evidence, and recommends the next correction without changing the product or its requirements.
