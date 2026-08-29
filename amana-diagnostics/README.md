# Amana Trust Diagnostics & Clinical Services — Internal Management System

## Overview
A full-stack diagnostic center workflow system connecting:
- **Reception** — Patient registration, slip generation, result printing
- **Laboratory** — Test queue management, result entry
- **Radiology** — Imaging request queue, report entry

## Tech Stack
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: CSS Variables (no external CSS library needed)
- **State & Sync**: Hybrid database layer (SQLite local DB for zero-downtime offline operations, synced to Supabase/PostgreSQL)
- **Authentication**: Native Supabase Auth (role-based) with custom database profiles
- **Print**: Native browser `window.print()` with formatted HTML templates

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:3000 and select your workstation.

## Workflow

1. **Reception → Register Patient**
   - Fill patient biodata (name, age, sex, phone, address, referral)
   - Select tests from the full catalogue (Lab + Radiology)
   - Click **Register & Generate Slip**
   - Print or close the slip — departments are automatically notified

2. **Lab / Radiology → Enter Results**
   - See real-time queue of pending patients
   - Click **Enter Results** for any test
   - Fill in parameters, values, flags (H/L), add comments
   - Click **Submit & Send to Reception**

3. **Reception → Print Report**
   - Switch to **Results Ready** tab
   - View the completed result with full parameter table
   - Click **Print Official Report** — generates a formatted A4 report with:
     - Amana Trust letterhead
     - Patient details
     - Test parameters, results, units, reference ranges
     - Flag indicators (H/L)
     - Professional signature section

## Test Catalogue (Built-in)

### Laboratory
| Category | Tests |
|----------|-------|
| Haematology | FBC, ESR, Malaria RDT, Malaria MP |
| Chemistry | Lipid Profile, RFT, LFT, FBS, RBS, HbA1c, Electrolytes |
| Urinalysis | Full Urinalysis |
| Serology | HIV Screen, HBsAg, Anti-HCV, Widal Test, CRP, RF, TSH |

### Radiology
| Category | Tests |
|----------|-------|
| X-Ray | Chest PA, Abdomen, LS Spine |
| Ultrasound | Abdomen, Pelvis, Obstetric, KUB |

## Database Architecture & Security State

The application operates in a hybrid environment with a robust database and synchronization layer, protected by Row-Level Security (RLS) and secure authentication management.

### 1. Hybrid Storage & Offline Sync
- **Cloud Mode**: Connected to Supabase (PostgreSQL) for all remote storage, multi-tenancy, and real-time operations.
- **Local Mode / Hub Mode**: Utilizes a local SQLite database (`amana_clinic.db` via `node:sqlite`) on-premise to ensure zero-downtime offline operations.
- **Synchronization**: Local changes are recorded in a `sync_outbox` table and periodically synced via `/api/sync` to the Supabase database.

### 2. Authentication & Authorization
- **Supabase Auth**: Implements role-based access control (RBAC) with specific roles: `admin`, `receptionist`, `lab_tech`, `radiologist`.
- **Organization Isolation**: All database queries are filtered by `organization_id` to ensure tenants cannot read or write each other's records.

### 3. Row-Level Security (RLS) & Security Policies
- **Strict Enforcement**: All Supabase tables (such as `profiles`, `organizations`, `invitations`, `patient_tests`, and billing tables) have Row-Level Security enabled.
- **Organization Isolation Policies**: Select, Insert, Update, and Delete policies enforce that rows match the current user's organization using helper functions (`get_my_org_id()`).
- **Client-Side Auth Safeguards**: Direct client-side updates (e.g., via `supabaseClient`) to user roles, metadata, or organization associations are prohibited. All modifications must go through secure server-side API endpoints (`/api/staff/update`) utilizing `SUPABASE_SERVICE_ROLE_KEY`.
- **Infinite Recursion Prevention**: SQL policies do not query the policy's target tables directly. They use `SECURITY DEFINER` functions (e.g., `is_admin()`, `get_my_org_id()`) that bypass standard policies to fetch profile details, preventing RLS recursion loops.

## File Structure

```
amana-diagnostics/
├── app/
│   ├── layout.tsx          # Root layout
│   ├── globals.css         # Design system (CSS variables, fonts)
│   ├── page.tsx            # Home / Role selector
│   ├── reception/page.tsx  # Reception full module
│   ├── lab/page.tsx        # Lab (delegates to DepartmentPage)
│   └── radiology/page.tsx  # Radiology (delegates to DepartmentPage)
├── components/
│   ├── Header.tsx          # Shared header with notifications
│   └── DepartmentPage.tsx  # Shared Lab/Radiology component
├── lib/
│   └── store.ts            # Data types, test catalogue, storage helpers
└── README.md
```

## Customisation Notes

- **Organisation branding**: Update name/address in the print templates inside `reception/page.tsx`
- **Add more tests**: Extend `TEST_CATALOGUE` in `lib/store.ts` — no UI changes needed
- **Add more fields**: Update `Patient` interface in `lib/store.ts` and the form in `reception/page.tsx`
- **Staff management**: Add a `professionals` localStorage key and populate the "Professional" dropdown in `DepartmentPage.tsx`

---
Built for Amana Trust Diagnostics & Clinical Services Limited, Kano, Nigeria
