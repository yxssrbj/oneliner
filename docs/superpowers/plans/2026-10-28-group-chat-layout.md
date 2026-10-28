# Group chat layout and controls

Risk: high, because rename and delete touch group authorization and data.

1. Add failing component, route, and database checks for separate tabs, compact composer, owner menu, and owner-only rename.
2. Implement the desktop layout using the existing workspace, group dialog pattern, and action route. Add one owner-only RPC migration for rename.
3. Update affected browser journeys and run focused component, route, database, type, and desktop browser checks. Inspect screenshots.
4. Review the full diff and update STATUS.md and todo.md. Keep changes local; pushing requires a new request.
