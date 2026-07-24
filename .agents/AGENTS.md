<!-- BEGIN:agent-best-practices -->
# Agent Best Practices

- **Rule Management**: Scope rules correctly (Global for universal, Workspace for project-specific). Keep rules concise, explicit, and actionable. Remove outdated/conflicting rules.
- **Problem Resolution & Documentation**: Whenever fixing a bug or addressing a recurring problem, always document the root cause and the established solution pattern as a new, concise rule in `AGENTS.md` (or as a Skill for complex workflows). This creates a persistent feedback loop so the agent never repeats the same mistake.
<!-- END:agent-best-practices -->

<!-- BEGIN:database-sync-rules -->
# Database Sync & Overrides

- **Overriding Defaults**: When writing update logic for items that have built-in defaults (e.g., `custom_tests`, `radiology_templates`), **never** use a standard `.update()` or SQL `UPDATE`. Always use `.upsert()` or `INSERT ... ON CONFLICT DO UPDATE SET`. This is because the row will not exist in the database until it is customized for the very first time.
<!-- END:database-sync-rules -->
