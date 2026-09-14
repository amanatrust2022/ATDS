# Making Amana Diagnostics a $1B EHR

> **Created:** 2026-09-12  
> **Purpose:** Strategic roadmap for evolving Amana Diagnostics from a diagnostics LIMS into a full-featured EHR that looks, feels, and functions at billion-dollar valuation.

## What We Already Have (The Foundation)

| ✅ Strength | Why It Matters |
|---|---|
| **Proper design system** (`styles/tokens.css`) | 476-line token file with WCAG-verified contrast ratios, 3-layer architecture (primitives → semantic → component). Epic's UI took a decade to systematize. |
| **Collapsible rail + command palette** (`components/shell/AppShell.tsx`) | `Ctrl+K` universal search. This is what Linear, Notion, and modern SaaS apps do. Legacy EHRs still use toolbar menus. |
| **Patient context bar** (`AppShell.tsx` PatientBar) | Pinned identity strip. Wrong-patient errors are the #1 safety concern in EHRs. Epic, Cerner, and athena all converged on this exact pattern. |
| **Domain-driven architecture** (registration, queue, wallet stores) | Separated Zustand stores per domain. Most competitors at your stage are a single 5,000-line Redux blob. |
| **Offline-first + real-time sync** | LAN hub with SQLite + Supabase cloud sync. This is the kind of infrastructure that athenahealth and DrChrono spent $50M+ building. |
| **Role-based navigation** (`components/shell/navigation.ts`) | Single source of truth for RBAC routing. Clean. |
| **Critical value alerting** (`CriticalValueDialog`) | Panic value blocking before result release. This is a regulatory requirement that many EHRs skip. |
| **Structured lab entry** (Widal, MCS, MPS specialized forms) | Domain-specific entry forms instead of free-text boxes. This is clinical accuracy infrastructure. |
| **Custom letterhead designer** (`components/LetterheadDesigner.tsx`) | WYSIWYG letterhead with A4 preview. Most diagnostics software gives you a text field. |
| **Tauri desktop bundle** | Native Windows installer with auto-updates. Clinics get a real app, not a browser bookmark. |

---

## The Gaps: What $1B EHRs Have That We Don't (Yet)

### Tier 1 — "Table Stakes" (Blocks Sales)

| Gap | What $1B EHRs Do | Our Current State |
|---|---|---|
| **Scheduling / Appointments** | Full calendar with recurring slots, provider availability, SMS/WhatsApp reminders, no-show tracking | ❌ Not present. Patients walk in and are registered. No pre-booking. |
| **Patient chart / longitudinal record** | A single page per patient showing every visit, every result, every payment — chronologically | ❌ Patients exist as daily registration records. No visit history view. |
| **Clinical notes / SOAP** | Structured note-taking (Subjective, Objective, Assessment, Plan) during consultations | ❌ Not present. This is the heart of an EHR vs a LIMS. |
| **Doctor/clinician portal** | The physician who ordered tests can log in, see results, write notes, and order follow-ups | ❌ No `doctor` role. Only admin, reception, lab, lab_tech, radiology. |
| **Audit trail** | Immutable log: who changed what, when, from what value to what value | Partial — `lib/staffAudit.ts` exists for staff, but no per-record change log. |
| **Reporting & analytics dashboard** | Revenue trends, TAT (turnaround time), test volume by day/week/month, referral conversion | Minimal — `AdminOverviewScreen.tsx` exists but basic. |
| **Silent print routing** | Receipts → thermal printer, reports → laser printer. No dialogs, no toggling. | ❌ Uses browser `window.print()` — user must manually select printer each time the document type changes. |

### Tier 2 — "Premium Feel" (Wins Deals)

| Gap | What It Looks Like | Impact |
|---|---|---|
| **Notifications center** | Bell icon → dropdown with "Lab completed FBC for Patient X", "Dr. Bello approved report Y" | Makes the app feel alive. Every modern SaaS has this. |
| **Activity feed / timeline** | Per-patient timeline: registered → specimen collected → results entered → report printed → delivered | Visual proof of workflow. Buyers love this in demos. |
| **Smart search with filters** | Search patients by name, ID, phone, date range, test type, status — with instant results | Command palette searches nav. Patient search should be first-class. |
| **Keyboard shortcuts everywhere** | `N` for new patient, `Enter` to save, arrow keys to navigate queue | Power users (busy receptionists) will feel the speed difference. |
| **Data export / reports** | Download CSV/PDF of daily revenue, monthly test volumes, referral commissions | Admin self-service. |
| **Multi-branch support** | One org → multiple locations, each with their own queue but shared patient records | Scale story. Single-location limits market cap. |
| **Inventory / reagent tracking** | Track reagent stock, expiry dates, reorder levels, link to test capacity | Lab managers care deeply about this. |

### Tier 3 — "Moat" Features (Defensibility)

| Feature | Why It's a Moat |
|---|---|
| **API / integrations** | HL7 FHIR endpoints so hospitals can pull results into their own systems. Makes you a platform, not a product. |
| **AI-assisted reporting** | Auto-suggest radiology impressions, flag abnormal patterns across a patient's history. |
| **Patient mobile app** | Patients check their own results, get SMS/push when ready. Reduces reception calls by 60%+. |
| **Billing integrations** | Connect to payment processors (Paystack, Flutterwave). Auto-reconcile. |
| **WhatsApp result delivery** | Send formatted result PDFs via WhatsApp Business API. Huge in West/East Africa. |
| **Accreditation support** | Generate reports that satisfy CAP, ISO 15189, or local MLSCN requirements. |

---

## Silent Printing Architecture

### The Problem
Clinics use two printers: 80mm thermal for receipts/slips, A4 laser for reports. Currently, receptionists must manually toggle the selected printer in the browser print dialog every time the document type changes.

### The Solution (By Platform)

#### Desktop App (Tauri) — Silent Printing
- Admin configures printers once in Settings: "Receipt printer = POS-80", "Report printer = HP LaserJet"
- Tauri Rust backend routes print jobs directly to the OS print spooler by printer name
- `printHtml()` accepts a `target: 'receipt' | 'report'` parameter
- **Zero dialogs. Zero toggling.**

#### Browser (Cloud SaaS) — Smart Defaults
- Browsers block silent printing for security reasons — this cannot be bypassed
- Two viable options:
  1. **Lightweight print agent** — A small installable background service (like QZ Tray) that receives print jobs via WebSocket from the browser and routes them silently. Requires a one-time install per workstation.
  2. **Accept the browser dialog** — But improve UX by: remembering last printer per document type via localStorage, pre-selecting page size (80mm vs A4) via CSS `@page`, and showing a one-line instruction banner ("Select your thermal printer for receipts").
- **Recommended**: For clinics that need silent printing, push them to the Tauri desktop app. For cloud-only users, the browser dialog with smart defaults is acceptable — this is exactly what athenahealth (a $5.7B cloud EHR) does.

---

## Valuation Math

| Model | What It Requires | Example |
|---|---|---|
| **Revenue multiple** | ~$100M ARR at 10x | 10,000 clinics × $10K/year |
| **User multiple** | ~500K active clinical users at $2K/user | |
| **Strategic acquisition** | Platform + data moat + regulatory lock-in | Cerner → Oracle ($28B) |

Target is **Model 1** — SaaS revenue from diagnostic centres in Africa. TAM: ~50,000+ diagnostic facilities across West and East Africa. To command $1B, the platform must be one that clinics **cannot leave**: their patient data, their money flow, and their compliance all depend on it.

---

## Phased Roadmap

### Phase 1: "Looks Like a $1B Product" (UI/UX Polish — 2-4 weeks)
- [ ] Dashboard with real charts (Revenue trend, test volume, TAT distribution, top referrers)
- [ ] Patient timeline view
- [ ] Notification center (bell icon in AppShell header, Supabase Realtime)
- [ ] Polished empty states with illustrations + CTAs
- [ ] Loading skeletons instead of spinners
- [ ] Micro-animations (tab transitions, card hover lifts, slide-in panels)

### Phase 2: "Functions Like a $1B Product" (Core Features — 2-3 months)
- [ ] Patient chart page (`/[slug]/admin/patients/[id]` — longitudinal record)
- [ ] Appointments module (calendar, time slots, SMS reminders)
- [ ] Clinical notes / SOAP (wire RichTextEditor to `consultation_notes` table)
- [ ] Doctor role + portal (new role in `staffRoles.ts` + nav entry + dedicated view)
- [ ] Full audit trail (Postgres triggers → `audit_log` table)
- [ ] Advanced reporting with CSV/PDF export
- [ ] Silent printing via Tauri (desktop) + smart defaults (browser)

### Phase 3: "Impossible to Replace" (Platform — 6+ months)
- [ ] Multi-branch architecture (Organization → Branches → Shared patient master)
- [ ] API layer (FHIR-lite REST endpoints)
- [ ] WhatsApp result delivery (Cloud API)
- [ ] Inventory / reagent management
- [ ] AI features (auto-suggest, trend detection, smart scheduling)
- [ ] Payment gateway integration (Paystack/Flutterwave)
