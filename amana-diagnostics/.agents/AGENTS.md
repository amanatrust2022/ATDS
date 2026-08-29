<!-- BEGIN:agent-best-practices -->
# Agent Best Practices

> **CRITICAL**: Before starting or fixing any feature, you MUST read the [Automated Testing Blueprint](file:///c:/Users/SURFACE/ATDS/amana-diagnostics/.agents/TESTING_BLUEPRINT.md) to understand our two-layer defense against regressions (Unit + RTL Feature Tests).


- **Rule Management**:Keep rules concise, explicit, and actionable.Group and Demarcate Sections Remove outdated/conflicting rules. 
- **Problem Resolution & Documentation**: Whenever fixing a bug or addressing a recurring problem, always document the root cause and the established solution pattern as a new, concise rule in `AGENTS.md` (or as a Skill for complex workflows). This creates a persistent feedback loop so the agent never repeats the same mistake.
<!-- END:agent-best-practices -->
<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Amana Diagnostics - Architectural Guidelines

## 1. Avoid God Components
- Do NOT build components that exceed ~300-500 lines.
- Break down complex UIs into single-responsibility components (e.g., separate Forms, Modals, Search blocks).
- Group related components into feature directories (e.g., `components/features/registration/`).

## 2. Modular State Management
- Avoid monolithic state files (`lib/store.ts`).
- For complex, multi-step forms or feature-specific UI state, use small, focused Zustand stores (e.g., `useRegistrationStore.ts`, `useQueueStore.ts`, `useWalletStore.ts`).
- For data fetching, ensure clear boundaries between UI and data access layers.

## 2.1 Domain-Driven Reception Architecture
- The Reception module is strictly divided into three domains: **Registration**, **Queue/Results**, and **Wallet/Ledger**.
- Each domain MUST have its own Zustand store and feature directory (e.g., `components/features/wallet/`).
- Do NOT mix state (e.g., billing logic in the queue component) across domains.

## 3. Automated Testing (Vitest)
- All core business logic and critical UI components must have automated tests using Vitest.
- Write tests alongside new feature development and refactoring.
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
## 4. Definition of Done (DoD) for DiagnosticOS
A feature is ONLY considered done when it meets the following criteria:
- TypeScript compiles with zero errors (\
px tsc --noEmit\).
- All existing tests pass.
- New tests are written for new logic.
- Tested on Vercel staging with a real login.
- \AGENTS.md\ is updated if any architectural decision was made.


## 5. Frontend Conventions (Component-Based Architecture)
- **State vs. UI Separation**: Keep UI components presentational where possible. Business logic, price calculations, and complex form states must live in dedicated Zustand slices under `lib/store/`.
- **Feature Grouping**: Group UI sub-components by feature inside `components/features/<feature-name>/` (e.g., `components/features/registration/`) instead of placing everything in a single page component.
- **Ephemeral vs. Domain State**:
  - Use local React `useState` only for transient UI state (e.g., search bar text, modal visibility, hover states).
  - Use Zustand stores for domain data that drives the feature (e.g., selected items, calculated totals, submitted payload).
- **Testing Requirement**: Every Zustand store or complex business logic function must have a co-located or parallel unit test in Vitest (`*.test.ts`) before being wired into the UI.

## 6. Ongoing Refactoring Roadmap (Divide & Conquer)
We are actively transitioning away from God Components (`ReceptionPage.tsx`, `DepartmentPage.tsx`) and Monolithic State (`lib/store.ts`). All future work must adhere to this phased strategy:
- **Phase 1 (Active): Feature Extraction.** Pick specific tabs/areas of giant pages and extract them into `components/features/*`. Move all domain state into smaller Zustand slices.
- **Phase 2 (Upcoming): Sync Abstraction.** Abstract the complex SQLite (Local Mode) vs Supabase (Cloud Mode) fetching/syncing logic behind clean repository interfaces so components do not dictate how to fetch or sync data.
- **Phase 3 (Ongoing): Gradual Rollout.** Apply these patterns systematically across all modules before adding complex new features.
