# OIL Dashboard — Architectuur Context voor AI Assistenten

> Dit document beschrijft het ordersysteem, de cascadelogica, slachtrendementen en vierkantsverwaarding
> van het Oranjehoen Intelligence Layer (OIL) Dashboard.
> Gebruik dit als context-prompt voor Gemini Code, Claude of andere AI-assistenten.

---

## 1. Bedrijfscontext

Oranjehoen is een kippenslachterij met **twee locaties**:
- **Putten** — slachtlocatie: hier worden kippen geslacht en in **primaire delen** gesneden
- **Nijkerk** — uitsnijderij: hier worden onverkochte primaire delen verder verwerkt tot **secundaire producten**

### Vierkantsverwaarding
Elke kip levert een vaste set anatomische delen op. Als je borstkappen verkoopt, heb je automatisch ook zadels, drumsticks, vleugels, etc. Het doel is om **alle delen optimaal te verkopen** — niet alleen de populaire filet. Dit heet *vierkantsverwaarding* (whole-animal utilization).

---

## 2. Cascade Flow: Putten → Nijkerk

```
Levende kip (avg 2.65 kg)
  │
  ├─ × 0.704 = GRILLER (70.4% rendement)
  │
  ├─ Hele kip orders → worden VÓÓR de verdeling afgetrokken van griller pool
  │
  └─ Griller wordt gesplitst in PRIMAIRE DELEN (Putten):
      │
      ├── Borstkappen met vel    36.75%
      ├── Dij anatomisch         14.68%
      ├── Drumsticks             16.56%
      ├── Vleugels                9.57%
      ├── Nekken                  1.97%
      ├── Levertjes               1.74%
      ├── Maagjes                 1.07%
      └── Hartjes                 0.19%
          ─────────────────────────────
          Totaal:               82.43% (rest = verwerkingsverlies)

Niet-verkochte primaire delen → doorgestuurd naar Nijkerk
  │
  ├── Borstkappen → worden verder gesneden:
  │     ├── Kipfilet (z vel z haas)   66.45% van kap
  │     ├── Haasjes                    12.00% van kap
  │     └── Vel                         8.63% van kap
  │                                   ────────
  │                                    87.08% (rest = snijverlies)
  │
  └── Dij anatomisch (zadels) → worden verder gesneden:
        ├── Dijfilet                   63.00% van zadel
        └── Drumvlees                  49.00% van zadel
                                      ────────
                                      112.00% → genormaliseerd!
```

### Yield normalisatie
Als de som van child-yields > 100% is (zoals bij zadels: 63% + 49% = 112%), normaliseert de engine:
```
effectiveYield = yield / sum(all_child_yields)
dijfilet_effective  = 0.63 / 1.12 = 56.25%
drumvlees_effective = 0.49 / 1.12 = 43.75%
```
Dit betekent: van 100 kg zadel → 56.25 kg dijfilet + 43.75 kg drumvlees (geen verlies).

---

## 3. Kernformules

### A. Griller berekening
```
griller_kg = birds × avg_weight_kg × GRILLER_YIELD(0.704)
```

### B. Primair product beschikbaarheid
```
available_kg = griller_kg × yield_percentage
```

### C. Doorstroom naar Nijkerk
```
forwarded_kg = available_kg - sold_primary_kg
```

### D. Secundair product beschikbaarheid
```
# Als sum(child_yields) > 1.0: normaliseer
normalizationFactor = sum(all_child_yields_for_parent)
effectiveYield = child_yield / normalizationFactor

child_available_kg = forwarded_kg × effectiveYield
```

### E. Kippen → kg conversie (order entry)
```
# Putten primair product:
kg = birds × avg_weight × 0.704 × productYield

# Nijkerk secundair product:
kg = birds × avg_weight × 0.704 × parentYield × childYield
```

### F. Hele kip orders
```
# Hele kip orders worden VÓÓR de cascade split afgetrokken:
effective_griller_kg = griller_kg - whole_chicken_order_kg
# Daarna pas de cascade berekening op effective_griller_kg
```

---

## 4. Mass Balance Invarianten

De engine handhaaft 4 invarianten:
```
1) sold_primary + forwarded = primary_available     (per product)
2) sum(child_yields) <= 1.0 OF genormaliseerd       (per parent)
3) sold_child <= child_available                    (per child)
4) sum(sold_primary) + sum(cascaded) + sum(loss) <= griller_kg
```

---

## 5. Data Model (relevante tabellen)

### Yield data
- `locations` — Putten + Nijkerk (2 rijen)
- `location_yield_profiles` — primair product yields per locatie (0.0–1.0 schaal)
- `product_yield_chains` — parent→child yield chains (parent=Putten, child=Nijkerk)
- `products` — alle producten met `category`, `anatomical_part`, `sku_code`

### Orders
- `slaughter_calendar` — geplande slachtdagen met expected_birds, expected_live_weight_kg
- `customer_orders` — orders per klant per slachtdag (status: draft/submitted/confirmed)
- `order_lines` — orderregels: product_id + quantity_kg
- `order_schema_snapshots` — append-only snapshots van orderstand

### Producten
- `category`: hele_kip, filet, haas, dij, dij_anatomisch, drumstick, drumvlees, vleugels, karkas, zadel, verlies, organen, vel
- `anatomical_part`: breast_cap, leg_quarter, wings, back_carcass, offal
- Variant resolution: producten met dezelfde `category` delen effectieve yield

---

## 6. Variant Resolution

Klanten bestellen soms een verpakkingsvariant (bv. "Dijfilet Bulk" i.p.v. "Dijfilet Vacuüm") die niet direct in de yield-tabellen staat. De engine resolved dit:

1. **Direct match**: product_id zit in yield_profiles of yield_chains → direct gebruiken
2. **Category match**: product.category matcht een child in yield_chains → map naar canonical product
3. **Anatomical part match**: product.anatomical_part matcht een parent → map naar primary yield product

---

## 7. Hele Kip / Naakt Karkas (Whole Bird Logic)

Producten met `category = 'hele_kip'` of `category = 'karkas'` worden anders behandeld:
- Ze worden van de **griller pool** afgetrokken VÓÓR de cascade split
- Dit verlaagt de beschikbaarheid van ALLE andere producten proportioneel
- Vergelijk met Excel: "Hele kuikens uit verdeling halen"

---

## 8. Key Bestanden

| Bestand | Functie |
|---------|---------|
| `src/lib/engine/availability/cascading.ts` | **Pure cascade engine** — geen DB, geen async. Berekent primary→secondary availability |
| `src/lib/engine/availability/simulator.ts` | **Simulator** — what-if scenarios met aangepaste birds/yields/pulls |
| `src/lib/actions/availability.ts` | **Server actions** — haalt yield data op uit DB, roept cascade engine aan |
| `src/lib/actions/orders.ts` | **Order CRUD** — createOrder, addOrderLine, deleteOrder, etc. |
| `src/components/oil/orders/OrderEntryForm.tsx` | **Order formulier** — kippen→kg conversie met yield berekening |
| `src/components/oil/orders/OrderLineEditor.tsx` | **Orderregels editor** — batch-add met kippen/kg toggle |
| `src/components/oil/orders/AvailabilityPanel.tsx` | **Beschikbaarheidsmatrix** — toont beschikbaar/besteld/resterend per product |
| `src/components/oil/orders/PlanningSimulator.tsx` | **Simulator UI** — birds, yields, whole-bird pulls |
| `src/app/oil/orders/[slaughterId]/SlaughterOrdersClient.tsx` | **Orchestratie** — verbindt alle componenten |
| `src/types/database.ts` | **TypeScript types** — alle DB tabellen + enums |
| `supabase/migrations/20260220140000_wave6_fix_products_and_yields.sql` | **Yield seed data** — alle rendementspercentages |

---

## 9. Yield Schaal Conventie

**KRITISCH**: Alle yields in de codebase gebruiken de **0.0–1.0 schaal** (NIET 0–100).
- Database kolom: `NUMERIC(7,6)` → bv. `0.367500` voor 36.75%
- TypeScript: `yield_percentage: number; // 0.0 - 1.0`
- Enige uitzondering: UI toont percentages als 36.75% voor leesbaarheid

---

## 10. Toekomstig: Zadel-model & Putten Snijding

**Status: CONCEPT — nog niet geïmplementeerd**

### Het probleem

De Excel (bestelschema Storteboom) kent **drie anatomische groepen** op Putten-niveau:
- Kappen (36.00% van griller) — werkt al correct als parent in ons model
- **Zadels (43.50% van griller)** — ontbreekt als parent!
- Vleugels (9.50% van griller)

Ons model heeft Dij anatomisch (14.68%) en Drumstick (16.56%) als losse primaire producten, maar dit zijn eigenlijk **children van de Zadel**. De zadel is 43.50% van de griller — niet 31.24% (dij+drum). Het verschil (12.26%) is bot, kraakbeen en verlies.

### Twee snij-routes per Zadel

```
ZADEL (43.50% van griller)
  │
  ├─ Route A: Gaat HEEL naar Nijkerk (standaard)
  │    → Dijvlees (28.00% van zadel)
  │    → Drumsticks 15kg (31.00% van zadel)
  │    → Drumvlees (15.19% van zadel)
  │    → Verlies (25.81%)
  │
  └─ Route B: Wordt OPENGESNEDEN bij Putten (als klant bestelt)
       → Dij anatomisch (33.74% van zadel = 14.68% van griller)
       → Drumstick 10kg (38.07% van zadel = 16.56% van griller)
       → Verlies (28.19%)
       → Dij + drum zijn GEKOPPELD: als je de ene snijdt, komt de ander mee
```

### Impact

Als een klant X kg dij anatomisch bestelt bij Putten:
1. `X / 0.3374` kg zadel moet opengesneden worden
2. Dat levert automatisch `zadel_gesneden × 0.3807` kg drumstick op (co-product)
3. Die zadels gaan NIET meer naar Nijkerk → verlaagt Nijkerk beschikbaarheid

Zie `docs/GEMINI_PROMPT_SIBLING_CONSTRAINTS.md` voor het volledige implementatievoorstel.

---

## 11. Tech Stack

- **Framework**: Next.js 15 (App Router, Server Components + Client Components)
- **Database**: Supabase (PostgreSQL) met Row Level Security
- **State**: React useState/useCallback (geen externe state library)
- **Styling**: OIL Design Tokens (CSS variables: `--color-oil-orange`, `--color-text-main`, etc.)
- **Tests**: Vitest (709+ tests, 40 test files)
- **Dev server**: Port 3003
