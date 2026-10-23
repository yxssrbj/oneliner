# Oneliner

A desktop trading journal in progress. The approved frontend concept is the standalone [desktop preview](docs/previews/oneliner-desktop.html).

Run `npm run dev` and open [http://localhost:3000](http://localhost:3000) for the existing app. Open the approved HTML preview directly to inspect the redesigned screens; it uses temporary sample data and does not save real trades.

## Shared product specifications

The project-wide [PRD](specs/prd.md) and [feature specifications](specs/features/README.md) live in this primary checkout. Edit them here; feature worktrees use these shared requirements rather than their own branch snapshots. The [approved desktop preview](docs/previews/oneliner-desktop.html) is a standalone design artifact.

Run `$direction` from any Oneliner worktree to compare that worktree’s implementation with the shared specifications. It identifies the primary checkout through Git, reports evidence and coverage, and changes nothing automatically. The canonical skill is versioned at [skills/direction/SKILL.md](skills/direction/SKILL.md) in this primary checkout and registered once in the local Codex skills directory so every worktree can invoke it.

## Encrypted configuration

Use Node.js 24+ on macOS/Linux and install SOPS 3.13.3+ and age (`brew install sops age` on macOS). Keep the age private identity outside Git, set its permissions to `600`, and export `SOPS_AGE_KEY_FILE="$HOME/.config/sops/age/keys.txt"` (or your actual identity path) in the shell that launches npm. Run `npm ci` to install locked dependencies.

This checkout uses the existing local Supabase configuration. Reuse the shared local stack; do not reset its database.

`npm run dev`, `npm run build`, `npm run start`, and `npm run test:e2e` decrypt configuration into the launched process environment using SOPS. Missing ciphertext, identity, or decryption failure stops startup. After successful decryption, Next.js can still load additional variables from existing `.env*` files; encrypted values take precedence. Extra arguments work normally: `npm run dev -- --port 3100`. Unit tests, lint, and type generation do not need your identity (wrapper tests generate disposable synthetic credentials and require the installed SOPS/age tools).

The wrapper replaces itself with SOPS and then the requested command, preserving exit codes and signals without a background launcher. Each separately launched command must use its own npm wrapper; a server launched in another terminal does not inherit a previous command's decrypted environment. Keep existing plaintext files and backups until startup verification and an explicit later cleanup decision.

To change one value without printing it, putting it in shell history, or writing decrypted configuration to disk, read it silently and pass a JSON string to SOPS on stdin:

```sh
python3 -c 'import getpass,json; print(json.dumps(getpass.getpass("New value: ")))' | sops set --value-stdin secrets/app.enc.env '["OPENAI_API_KEY"]'
```

Use the required variable name from `.env.example`. Do not redirect decrypted output to a file or use ordinary `sops edit` when plaintext temporary files are prohibited. Encryption protects the file at rest: `NEXT_PUBLIC_*` values remain public and Next.js embeds them at build time. Rebuild after changing public configuration before `npm run start`.

Browser tests require local Supabase and a free port 3012. After confirming a local target, use `CI=1 npm run test:e2e` so Playwright refuses to reuse another server.
