<!-- BEGIN:agent-best-practices -->
# Agent Best Practices

- **Rule Management**:Keep rules concise, explicit, and actionable.Group and Demarcate Sections Remove outdated/conflicting rules. 
- **Problem Resolution & Documentation**: Whenever fixing a bug or addressing a recurring problem, always document the root cause and the established solution pattern as a new, concise rule in `AGENTS.md` (or as a Skill for complex workflows). This creates a persistent feedback loop so the agent never repeats the same mistake.
<!-- END:agent-best-practices -->
<!-- BEGIN:database-sync-rules -->
# Database Sync & Overrides

- **Overriding Defaults**: When writing update logic for items that have built-in defaults (e.g., `custom_tests`, `radiology_templates`), **never** use a standard `.update()` or SQL `UPDATE`. Always use `.upsert()` or `INSERT ... ON CONFLICT DO UPDATE SET`. This is because the row will not exist in the database until it is customized for the very first time.
<!-- END:database-sync-rules -->
<!-- BEGIN:supabase-auth-rls-rules -->
# Supabase Auth, Roles & RLS Architecture

- **Auth Management**: NEVER update user metadata, roles, or organization IDs via client-side code (e.g. `supabase.auth.signUp()`). Always use server-side API routes (e.g. `/api/staff/update`) utilizing the `SUPABASE_SERVICE_ROLE_KEY` to perform `supabaseAdmin.auth.admin.updateUserById` and sync to the `profiles` table.
- **RLS Infinite Recursion Prevention**: When writing PostgreSQL Row-Level Security (RLS) policies, NEVER query the exact same table that the policy protects (e.g., querying `profiles` to check if someone is an admin to allow updating `profiles`). Instead, extract claims directly from `auth.jwt()` or use `SECURITY DEFINER` functions that bypass RLS to perform the check.
- **Routing for New Roles**: When introducing a new role (e.g., `lab_tech`), ensure the role is explicitly handled in frontend routing logic (such as `getDashboardUrl` in `app/page.tsx` and `getRolePath` in `components/RootWrapper.tsx`) to prevent users from falling back to default UI paths like reception.
<!-- END:supabase-auth-rls-rules -->