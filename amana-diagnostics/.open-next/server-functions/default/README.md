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
- **State**: localStorage (prototype) — replace with Supabase/PostgreSQL for production
- **Real-time**: `window.dispatchEvent` + polling (replace with WebSocket/Supabase Realtime)
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

## Production Upgrade Path

| Feature | Current (Prototype) | Production |
|---------|---------------------|------------|
| Data storage | localStorage | PostgreSQL / Supabase |
| Real-time notifications | Event polling | WebSocket / Supabase Realtime |
| Authentication | None | NextAuth / Supabase Auth (role-based) |
| Print | browser window.print() | Same (works well) |
| Logo | Emoji placeholder | Replace with actual SVG/PNG in layout |

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
