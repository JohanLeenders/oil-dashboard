# OIL - Oranjehoen Intelligence Layer

Commerciële cockpit voor vierkantsverwaarding en massabalans.

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Database:** Supabase (PostgreSQL)
- **Styling:** Tailwind CSS
- **Charts:** Visx (Sankey diagrams)
- **Testing:** Vitest

## Project Structuur

```
oil-dashboard/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── oil/
│   │   │   ├── overview/       # KPI dashboard
│   │   │   ├── batches/        # Batch lijst + detail
│   │   │   └── customers/      # Cherry-picker analyse
│   │   └── api/                # API routes
│   ├── components/
│   │   ├── ui/                 # Basis UI componenten
│   │   ├── charts/             # Visx chart componenten
│   │   └── oil/                # Domain-specifieke componenten
│   ├── lib/
│   │   ├── engine/             # Rekenlogica (SVASO, Cherry-Picker, THT)
│   │   ├── supabase/           # Database clients
│   │   └── utils/              # Hulpfuncties
│   └── types/                  # TypeScript types
├── supabase/
│   └── migrations/             # SQL migraties
└── scripts/                    # Seed scripts
```

## Setup

### 1. Dependencies installeren

```bash
npm install
```

### 2. Environment configureren

```bash
cp .env.example .env.local
```

Vul de Supabase credentials in:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 3. Database setup

Run de migraties in Supabase:

```sql
-- Run in volgorde:
-- 1. supabase/migrations/001_initial_schema.sql
-- 2. supabase/migrations/002_seed_products.sql
-- 3. supabase/migrations/003_seed_demo_data.sql
```

### 4. Development server starten

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Tests uitvoeren

```bash
npm test
```

### Acceptance Tests (TRD)

1. **SVASO Allocatie:**
   - Allocatiefactoren tellen op tot 1.0
   - Hogere marktprijs filet → hogere allocated cost filet

2. **True-Up:**
   - Delta yield correct berekend
   - Signaal bij negatieve delta

3. **Cherry-Picker:**
   - Klant met >30% filet krijgt score < 50
   - Opportunity cost > 0

4. **THT Thermometer:**
   - Groen: < 60% verstreken
   - Oranje: 60-80% verstreken
   - Rood: > 80% verstreken

## Core Engine Modules

### SVASO (Sales Value at Split-off)

```typescript
import { calculateSvasoAllocation } from '@/lib/engine';

const result = calculateSvasoAllocation(
  [
    { id: 'filet', quantity_kg: 100, market_price_per_kg: 9.50 },
    { id: 'dij', quantity_kg: 120, market_price_per_kg: 7.00 },
  ],
  1500.00 // Total batch cost
);

// result.allocations[0].allocation_factor = 0.576...
// result.sum_allocation_factors = 1.0
```

### Cherry-Picker Detectie

```typescript
import { analyzeCherryPicker } from '@/lib/engine';

const analysis = analyzeCherryPicker(
  'CUST-001',
  'Restaurant X',
  [
    { category: 'filet', quantity_kg: 100, revenue: 950 },
    { category: 'dij', quantity_kg: 50, revenue: 375 },
  ]
);

// analysis.is_cherry_picker = true/false
// analysis.balance_score = 0-100
// analysis.opportunity_cost = €...
```

### THT Status

```typescript
import { calculateThtStatus } from '@/lib/engine';

const tht = calculateThtStatus(
  '2026-01-15', // Production date
  '2026-02-15', // Expiry date
  new Date()    // Check date (optional)
);

// tht.status = 'green' | 'orange' | 'red'
// tht.elapsed_pct = 38.7
// tht.days_remaining = 20
```

## Database Schema

### Append-Only Principe

Data wordt NOOIT overschreven. Correcties via nieuwe records:

- `batch_yields.is_correction = true`
- `batch_costs.is_adjustment = true`
- `sales_transactions.is_credit = true`

### Hoofdtabellen

| Tabel | Beschrijving |
|-------|-------------|
| `production_batches` | Slachtbatches met yields |
| `batch_yields` | Cut-up yields per anatomisch deel |
| `products` | SKU master met Storteboom PLU mapping |
| `sales_transactions` | Verkoopregels |
| `batch_costs` | Kosten per batch |
| `customers` | Klanten met cherry-picker metrics |
| `market_benchmarks` | Marktprijzen voor SVASO |

### Views

- `v_batch_mass_balance` - Sankey-ready massabalans data

## Sankey Diagram (Visx)

Data structuur voor massabalans visualisatie:

```typescript
import { generateMassBalanceSankey } from '@/lib/engine/sankey';

const sankeyData = generateMassBalanceSankey(batchMassBalance);

// sankeyData.nodes = [{ name: 'Levend Gewicht', ... }, ...]
// sankeyData.links = [{ source: 0, target: 1, value: 1000 }, ...]
```

## Phase 2 (na MVP)

- [ ] Sankey massabalans component (Visx)
- [ ] Cherry-picker scatterplot
- [ ] Signaling layer + actions
- [ ] Exact Online integratie

## Licentie

Proprietary - Oranjehoen BV
