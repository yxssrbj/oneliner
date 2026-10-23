# Oneliner — project lessons

## Encrypted startup · 23 October 2026

- Startup commands use SOPS `exec-env` with the checkout's `secrets/app.enc.env`. Keep the age identity outside Git and export `SOPS_AGE_KEY_FILE` explicitly; the chosen `~/.config` location was not automatically discovered on this Mac.
- Preserve environment differences during worktree migration: Task 2 retains hosted Supabase, while the other current checkouts use local Supabase. Never run disposable-data browser tests against a hosted target.
- The launcher requires Node 24+ on macOS/Linux and replaces its process so arguments, exit codes, and signals reach the runtime. Public Next.js variables remain public and require rebuilding when changed.
- Exclude nested `.worktrees/**` from root Vitest and ESLint discovery. Git ignore rules alone do not keep other branches and generated output out of those checks.
