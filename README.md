# Oneliner

A desktop trading journal in progress. The approved frontend concept is the standalone [desktop preview](docs/previews/oneliner-desktop.html).

Run `npm run dev` and open [http://localhost:3000](http://localhost:3000) for the existing app. Open the approved HTML preview directly to inspect the redesigned screens; it uses temporary sample data and does not save real trades.

## Shared product specifications

The project-wide [PRD](specs/prd.md) and [feature specifications](specs/features/README.md) live in this primary checkout. Edit them here; feature worktrees use these shared requirements rather than their own branch snapshots. The [approved desktop preview](docs/previews/oneliner-desktop.html) is a standalone design artifact.

Run `$direction` from any Oneliner worktree to compare that worktree’s implementation with the shared specifications. It identifies the primary checkout through Git, reports evidence and coverage, and changes nothing automatically. The canonical skill is versioned at [skills/direction/SKILL.md](skills/direction/SKILL.md) in this primary checkout and registered once in the local Codex skills directory so every worktree can invoke it.
