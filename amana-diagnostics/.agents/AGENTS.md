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
- **Pure Calculation Modules**: Domain math that is not itself state (billing totals, discounts, commission) belongs in a plain module under `lib/store/` (e.g. `registrationBilling.ts`), not inlined in a component and not duplicated inside a store action. Stores and components both import from that one module, so a formula has exactly one implementation.
- **Testing Requirement**: Every Zustand store or complex business logic function must have a co-located or parallel unit test in Vitest (`*.test.ts`) before being wired into the UI.
- **Extraction Hazard**: When splitting a God Component, extractions done by script silently break in three ways TypeScript will only catch if props are typed: `useState` updater callbacks passed to a Zustand `Partial` setter (a no-op), calls to setters that no longer exist, and prop names dropped from a rewritten helper component (e.g. a `Field` that stops forwarding `actionNode`). Never type an extracted component's props as `any` — the props interface is what makes these fail loudly. Verify the extracted UI still renders every button and modal the original had.
- **Cascading Handlers**: Before turning a `setState(prev => …)` child into a `value` + `onChange(next)` one, check whether any single event calls the updater more than once. Functional updates compose; `onChange({ ...value, field })` twice keeps only the last. `MpsEntryForm` sets five fields when parasites are marked seen — it builds one patch, and `components/DepartmentPage.test.tsx` has the test that would catch a regression. Either build the whole next state in one call, or keep the functional signature.

## 6. Ongoing Refactoring Roadmap (Divide & Conquer)
We are transitioning away from God Components (`ReceptionPage.tsx`, `DepartmentPage.tsx`) and Monolithic State (`lib/store.ts`). All future work must adhere to this phased strategy:
- **Phase 1 (Done for Reception): Feature Extraction.** Tabs and areas of giant pages become components under `components/features/*`, with domain state in small Zustand slices.
- **Phase 2 (Done): Sync Abstraction.** SQLite (local hub) vs Supabase (cloud) lives behind repository interfaces in `lib/repositories/`. `lib/store.ts` no longer branches on runtime mode at all.
- **Phase 3 (Done): `DepartmentPage.tsx`.** 2466 → 447 lines. Result serialisation is in `lib/store/labResults.ts`, obstetric maths in `lib/store/obstetrics.ts`, and the entry forms, queue and alerts hook are under `components/features/department/`. Apply the same patterns to any remaining module before adding complex new features.

## 7. Data Access (Repositories)
- **One place decides the back end.** `lib/runtimeMode.ts` resolves local vs cloud. Never re-derive it — several page components still carry a copy of that detection and are NOT interchangeable with it (they omit the `NODE_ENV` clause); move them here rather than copying again.
- **Adding a data function**: add it to the interface in `lib/repositories/<domain>.ts` and implement it for both back ends. Do NOT add an `if (isLocalMode())` branch to a component or to `lib/store.ts`.
- **Each implementation owns its own encoding.** SQLite and Postgres genuinely differ (JSON strings vs jsonb, 0/1 vs booleans). Do not build one shared payload and patch it apart per back end.
- **Business rules stay above the repository.** A rule that is the same on both back ends (e.g. a built-in catalogue entry is deactivated rather than deleted) belongs in `lib/store.ts` or a pure module, not duplicated into both implementations.
- **Reads and writes fail differently, on purpose.** Reads log and return `[]`/`null` so a screen degrades rather than crashes; writes throw so the user is told. Preserve that asymmetry.
- **Money-moving changes are characterisation-tested first.** Write tests against the current behaviour through the `lib/store.ts` API, watch them pass, then change the code and re-run them unchanged. See `lib/repositories/billing.characterization.test.ts`.

## 8. Money-Moving Writes Are Atomic — Keep Them That Way
A wallet debit and the rows that explain it must commit together, or a patient is charged with no record of why.

- **Cloud**: both paths call a Postgres function from `supabase_wallet_atomicity.sql` — `log_external_department_charge` and `register_patient_with_wallet`. A function body is one transaction, and each takes the account row with `SELECT … FOR UPDATE` so concurrent charges queue instead of racing.
- **Local**: the API route wraps the writes in `inTransaction()` (`lib/localDb.ts`), which uses `BEGIN IMMEDIATE` so the write lock is taken before the balance is read. **Throw inside it, never `return`** — returning out of an open transaction leaves it open. `HttpError` carries the status so a rejected charge still answers 400/404.
- **Never add a fourth wallet write path.** Extend a function; do not write a new sequence of client-side writes.
- **The functions are optional at runtime, on purpose.** A release can reach a database where the SQL has not been applied, so the client detects `PGRST202`/`42883`, warns, and falls back to the old sequential writes. That fallback is not atomic. Keep it working, keep it warning, and do not make it the primary path.
- **Refusals use one protocol**: `INSUFFICIENT_FUNDS:{json}`, parsed in `lib/repositories/rpcErrors.ts`, so the wording the receptionist sees stays identical to what the client produced before the checks moved into the database.
- **Applying the SQL is a manual step.** There is no Supabase CLI, MCP server or migrations directory in this project; SQL files live at the repo root and are run in the Supabase SQL editor. `supabase_wallet_atomicity.sql` is idempotent and ends with verification queries.

## 9. Report Text Is HTML, Not Lines
The radiology findings and impression come from the rich-text editor, and
`convertTextToFormattedHtml` emits them **with no newline characters at all**.

- **Never match "the rest of the line" with `[^\n]*`** against report text. It
  runs to the end of the document and deletes the remainder of the report. This
  shipped: "Apply & Insert into Report" on an obstetric scan silently dropped
  the expected delivery date and foetal weight, and left an unclosed `</p>`.
  A line ends at a newline **or** at the next tag: `[^\n<]*`. See
  `lib/store/obstetrics.ts` and its tests.
- **`convertTextToFormattedHtml` upper-cases the labels it recognises**, so a
  matcher written against a template's plain text (`Expected date of delivery`)
  will not match the same template once it is in the editor. Check both forms,
  or match case-insensitively.
- Anything that edits a stored report belongs in a pure module with tests that
  run the real template through the real converter first — the plain-text
  fixtures are the ones that pass while production is broken.
