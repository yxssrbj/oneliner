# Oneliner — project lessons

## Group chat · 28 October 2026

- Small private-group pictures are capped at 1 MiB and stored with messages in Postgres. Current-member checks protect each history and image read; group closure cascades the rows. This avoids signed URLs surviving member removal. If media volume grows, move bytes to private object storage with per-request membership checks.
- Preserve the message and picture when a sender deletes their account: save the sender's display name at send time and set the sender reference to null.
- Bound the incoming multipart stream before `formData()` parses it. Checking the parsed `File.size` alone does not cap parser memory.

## Encrypted startup · 23 October 2026

- Startup commands use SOPS `exec-env` with the checkout's `secrets/app.enc.env`. Keep the age identity outside Git and export `SOPS_AGE_KEY_FILE` explicitly; the chosen `~/.config` location was not automatically discovered on this Mac.
- Preserve environment differences during worktree migration: Task 2 retains hosted Supabase, while the other current checkouts use local Supabase. Never run disposable-data browser tests against a hosted target.
- The launcher requires Node 24+ on macOS/Linux and replaces its process so arguments, exit codes, and signals reach the runtime. Public Next.js variables remain public and require rebuilding when changed.
- Exclude nested `.worktrees/**` from root Vitest and ESLint discovery. Git ignore rules alone do not keep other branches and generated output out of those checks.

## Account boundary · 23 October 2026

- The installed Supabase Auth client can clear the local session and emit `SIGNED_OUT` even when remote sign-out returns 503. Hide the old identity immediately, keep the failure visible and retryable, and guard late responses when accounts change. Source: desktop-shell Task 2 unit and local browser regressions.

## Password registration · 26 October 2026

- Supabase Auth owns passwords, email codes, and sessions. A signup trigger reserves the normalized username and creates the profile in the same transaction, so a user cannot exist without the required profile. The separate display name remains editable.
- Once signup creates every profile with a required username, profile editing must use an update. An upsert without the username fails its insert path even for an existing row; the browser test exposed this.
- Email codes serve signup confirmation, recovery, and Settings password verification. Password sign-in is the only sign-in method in Oneliner. Local Supabase templates and hosted Auth templates are separate configuration surfaces.
- `supabase config diff` previews declared hosted Auth drift; `supabase config push` uploads the referenced template bodies as well as subjects and preserves undeclared hosted SMTP settings. Recheck the diff after pushing.
- A hosted Supabase URL can still fail with `Invalid API key` when an old worktree carries a stale publishable key. Compare against the current project key before attributing the failure to Auth or email delivery.
- With Cache Components enabled, private Friends pages must enter a request boundary before rendering code that reads auth or the current time. `await io()` at the page entry fixes development prerender errors on both Friends routes; a production build and browser log check confirmed it.

## Capture and unfinished trades · 27 October 2026

- Keep capture retries tied to the original idempotency key. Compare decimal prices numerically after storage normalization, so a valid leading-dot value does not become a false conflict.
- Remove an unfinished card only after an authorized refresh confirms the saved exit. Keep its input and card visible when saving or refreshing fails.
- Bind saved feedback to the current account; a late exit response or previously shown message must not expose another account's trade symbol.
- A capture page can unmount before Settings sign-out. Clear that account's persisted draft in the shared sign-out path, including an SDK `SIGNED_OUT` event followed by a remote error; preserve another account's key.

## Weekly review · 28 October 2026

- Derive personal chart, setup, day, table, and headline data from one authorized, opening-week-filtered trade set. Sum saved unrounded R and round only when displaying values; a late exit or corrected opening time then updates every view together.
- Compare opening timestamps as instants, not strings. PostgreSQL timestamps may contain milliseconds or offsets, and string comparison can exclude the exact Monday boundary or misorder chart points.

## Private groups · 28 October 2026

- Reuse the membership-checked Supabase group functions for the desktop screen. The UI can rearrange group, member, and weekly aggregate views without changing the privacy boundary or returning individual trades.
- Registration owns username creation and Settings owns display-name editing. Group creation asks only for a group name; missing profile identity links to Settings.
- Keep chat and weekly comparison in separate center-panel tabs. Retain the draft in the parent workspace while the chat tab is unmounted, and close group action dialogs when the signed-in account changes.
- Rename private groups through an owner-checked database function, like other group mutations. Hiding the rename menu for members is a usability choice, not the authorization boundary.
- The Groups desktop screen is a full-height workspace beside the main navigation. Do not wrap it in the padded, width-limited layout used for journal pages.
- The project owner wants desktop screens to match `docs/previews/oneliner-desktop.html` exactly in visual design. Use that file as the acceptance target, not just inspiration; distinguish its sample content from the real app's data.
