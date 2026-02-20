# PHASE 2 — Availability Intelligence & UX Professionalisation

**Datum:** 2026-02-20
**Auteur:** Leenders + Claude Code Agent
**Basis:** Wave 5 QA PASS (615 tests, 31 routes, v0.5-wave5 tag)
**Storteboom Excel:** Geanalyseerd als referentie-format

---

## Strategisch Doel

Phase 2 maakt OIL:
* **multi-locatie aware** (Putten → Nijkerk)
* **order-entry intelligent** (beschikbaarheid + auto-distributie)
* **Excel-export compliant** (Storteboom-exact)
* **UX volwassen** (sidebar, KPI, professionele styling)
* maar nog steeds gebaseerd op **theoretische yields**

**GEEN echte batch_yields integratie in Phase 2. Dat blijft Phase 3.**

---

## 🧱 Architectuurprincipes (bindend)

1. **Infra vóór UI** — database + migration eerst, dan pas components
2. **Engine vóór panel** — pure functions eerst, dan pas UI die ze aanroept
3. **Availability = één source of truth** — geen duplicatie tussen planning en orders
4. **Cascade = pure function** — deterministic, testbaar, geen side effects
5. **AGENT TEAMS verplicht** — elke wave met duidelijke rolverdeling
6. **Geen wijzigingen aan protected files** — engine/svaso.ts, engine/cherry-picker.ts, engine/tht.ts, engine/mass-balance.ts, engine/sankey.ts, engine/true-up.ts, actions/batches.ts, actions/scenarios.ts
7. **Alle waves krijgen tag** — v0.6, v0.7, v0.8, v0.9, v0.10

---

## Huidige Stand van Zaken

### Pagina-audit (20 feb 2026)

Alle 14 pagina's laden correct na Wave 5.

| Pagina | Status | Opmerking |
|--------|--------|-----------|
| `/oil` Dashboard | ✅ | Tiles + links, goede structuur |
| `/oil/planning` | ✅ | 9 slachtdagen, tabel-view |
| `/oil/planning/[id]` | ✅ | Detail + mester-verdeling + beschikbaarheid (JA757) |
| `/oil/orders` | ✅ | 9 slachtdatums, order counts |
| `/oil/orders/[id]` | ✅ | Order invoer MVP — **geen beschikbaarheid** |
| `/oil/batches` | ✅ | 2 batches, THT status |
| `/oil/kostprijs` | ✅ | 4 profielen, berekeningen |
| `/oil/cost-waterfall-v2` | ✅ | 7-level waterval |
| `/oil/customers` | ✅ | 9 klanten, cherry-picker |
| `/oil/processing` | ✅ | 0 recepten (leeg maar functioneel) |
| `/oil/exports` | ✅ | 0 exports (leeg maar functioneel) |
| `/oil/margins` | ✅ | Leeg (geen verkoopdata) |
| `/oil/trends` | ✅ | Sparse data, structuur goed |
| `/oil/pressure` | ✅ | Leeg (geen inventory) |

### Huidige Beperkingen

- **Geen beschikbaarheid** in order entry — `availability` is hardcoded `[]`
- **Geen inline editing** — alleen toevoegen/verwijderen
- **Geen bulk operaties** — regel voor regel
- **Geen klant-auto-distributie** — geen "geef alles aan klant X"
- **Geen yield-based verdeling** — geen "geef klant X 2000 kippen"
- **Import slachtdagen verwijderd** — code bestaat maar losgehaald door Wave 5

---

## 📦 PHASE 2 STRUCTUUR

```
PRE-WAVE 6    Yield Dataset & Mass Balance Validation (data prep)
WAVE 6        Location & Cascade Engine Foundation + Import
WAVE 7        Intelligent Order Entry
WAVE 8        Product Master & Export Precision
WAVE 9        UX Polish & Operational Flow
WAVE 10       Yield Preparation (Phase 3 Bridge)
```

---

## 🔬 PRE-WAVE 6 — Yield Dataset & Mass Balance Validation

### Doel

Vóór de cascade engine gebouwd wordt: produceer een mass-balance correct yield dataset, validatierapport en seed-ready data. Dit is de **data foundation** voor Wave 6.

### Mass Balance Invarianten

Vier invarianten die altijd moeten gelden:

```
1) Per parent i:  SoldP_i + Forward_i = P_i        (Forward_i >= 0)
2) Per parent i:  sum_j(yield_ij) <= 1.0
                  Loss_i = Forward_i × (1 - sum_j(yield_ij))
3) Per child j:   ChildFromCascade_j = sum_i(Forward_i × yield_ij)
                  SoldChild_j <= ChildAvail_j
4) Globaal:       sum(SoldP) + sum(SoldChild) + sum(Loss) <= G
```

Waar:
- `P_i` = beschikbaar kg van parent product i (uit griller yield)
- `SoldP_i` = verkocht op primary location (Putten)
- `Forward_i` = doorgestuurd naar secondary location (Nijkerk)
- `yield_ij` = cascade yield van parent i naar child j
- `Loss_i` = processingverlies bij cascade
- `G` = totaal griller kg

### Taken

**A) Yield Tabellen construeren**

Uit JA757 standaard yields + Storteboom Excel analyse:

1. `location_yield_profiles`: griller → parent parts voor Putten
   - Borstkappen: 23,5%
   - Zadels: 28,0%
   - Vleugels: 10,7%
   - Organen: 3,8%
   - Rug/karkas: 7,5%
   - Drumsticks: ?% ← invullen uit beschikbare data
   - Dij anatomisch: ?% ← invullen uit beschikbare data

2. `product_yield_chains`: parent → child voor Nijkerk processing
   - Borstkap → filet_met_haas (42%), filet_zonder_haas (35%), haasjes (8%), vel/trim (15%)
   - Zadel → dijfilet (35%), drumsticks (30%), drumvlees (20%), rest/trim (15%)

   **Markeer per yield: KNOWN (gemeten/bevestigd) vs ESTIMATED (aanname)**

**B) Worked Example: 1000 vogels**

Doorrekenen met concrete getallen:

```
Input: 1000 vogels × 2,65 kg = 2.650 kg levend
Griller: 2.650 × 70,4% = 1.866 kg

Per parent:
  P_borstkap = 1.866 × 23,5% = 438 kg
  SoldP_borstkap = 150 kg (voorbeeld scenario)
  Forward_borstkap = 288 kg

Per child (uit 288 kg borstkap):
  filet_met_haas = 288 × 42% = 121 kg
  filet_zonder_haas = 288 × 35% = 101 kg
  haasjes = 288 × 8% = 23 kg
  loss = 288 × 15% = 43 kg

Verificatie invariant 4:
  sum(SoldP) + sum(SoldChild) + sum(Loss) <= 1.866 kg ✓
```

**C) Deliverables**

1. Seed-ready JSON voor `location_yield_profiles`
2. Seed-ready JSON voor `product_yield_chains`
3. Mass Balance test cases (10+ scenario's) voor vitest
4. Eén-pagina samenvatting: welke yields gemeten vs theoretisch

**Phase 3 notitie:** Document welke kolommen/tabellen Phase 3 nodig heeft voor rolling weighted-average yields, maar bouw dit NIET.

### Constraints

- Alles blijft theoretisch (JA757-based)
- Structureer zodat Phase 3 kan swappen naar werkelijke yields
- Geen EWMA, geen rolling averages, geen actual batch_yields integratie

---

## 🌊 WAVE 6 — Location & Cascade Engine Foundation

### Doel

Leg de database + availability cascade engine neer. Plaats slachtdag-import terug.
Gebruikt de seed data uit Pre-Wave 6 als input.

### Agents

| Agent | Verantwoordelijkheid |
|-------|---------------------|
| INFRA_AGENT | Migraties, database structuur, seed data inserten |
| ENGINE_AGENT | Pure functions, cascade berekeningen, tests |
| QA_AGENT | Regressie, protected file check, build |
| IMPORT_AGENT | ImportSlaughterDays terugplaatsen + verbeteren |

### A0-S1 — Infra: Multi-location Model

Nieuwe migratie:

```sql
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  location_type TEXT NOT NULL
    CHECK (location_type IN ('primary', 'secondary')),
  processing_day_offset INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE location_yield_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES locations(id),
  product_id UUID REFERENCES products(id),
  yield_percentage NUMERIC(7,6) NOT NULL,  -- 0.0-1.0 (e.g. 0.235 = 23.5%)
  is_active BOOLEAN DEFAULT true,
  UNIQUE (location_id, product_id)
);

CREATE TABLE product_yield_chains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_product_id UUID REFERENCES products(id),
  child_product_id UUID REFERENCES products(id),
  source_location_id UUID REFERENCES locations(id),
  target_location_id UUID REFERENCES locations(id),
  yield_pct NUMERIC(7,6) NOT NULL,  -- 0.0-1.0 (e.g. 0.42 = 42%)
  sort_order INT DEFAULT 0,
  UNIQUE (parent_product_id, child_product_id)
);
```

Seed data uit Pre-Wave 6 deliverables inserten.
Push gated: tests + build vóór db push.

### A0-S2 — Import: Slachtdag Import Terugplaatsen

**Bestaande code:** `parseOpzetplanning.ts` (parser) + `ImportSlaughterDays.tsx` (component)

1. `ImportSlaughterDays` terugplaatsen in `/oil/planning/page.tsx`
2. Import server action terugplaatsen in `planning.ts`
3. Duplicate detection (zelfde datum + locatie = update i.p.v. insert)
4. Validatie-feedback in UI (welke rijen geïmporteerd, welke overgeslagen)

### A1-S1 — Engine: Cascaded Availability

```typescript
computeCascadedAvailability({
  slaughterId: string,
  locationId: string,
  existingOrders: OrderLine[]
}): CascadedAvailability
```

**Kernlogica:**
1. Bereken theoretische availability per product voor primary location
2. Trek bestaande orders af per product (= verkocht op Putten)
3. Restant = doorgestuurde kg naar secondary location
4. Pas product_yield_chains toe op doorgestuurde kg
5. Return per locatie: primary_available, forwarded, cascaded_available, net_available

**Minimaal 15 unit tests:**
- no cascade (alleen primary)
- full cascade (alles doorgestuurd)
- partial cascade (deel verkocht, rest door)
- multi-step cascade
- zero forwarded (alles verkocht op primary)
- oversubscribed primary
- circular protection
- yield edge cases (0%, 100%, sum >100%)
- empty orders array
- unknown product fallback
- mass balance invariant 1 check
- mass balance invariant 2 check
- mass balance invariant 3 check
- mass balance invariant 4 check
- loss calculation correct

### A7-S1 — Regression Gate

- Protected file diff check (8 files)
- 615+ tests PASS (+ ~25 nieuwe)
- Build clean
- ImportSlaughterDays functioneel

**Tag: v0.6-wave6**

---

## 🌊 WAVE 7 — Intelligent Order Entry

### Doel

Order-entry met live beschikbaarheid en smart allocation.

### Agents

| Agent | Verantwoordelijkheid |
|-------|---------------------|
| UI_AGENT | Order components, beschikbaarheidspanel, inline editing |
| ENGINE_AGENT | Auto-distribute, "geef alles" functie |
| QA_AGENT | Regressie, integration tests |

### A2-S1 — Availability in Order Entry

Orders page gebruikt **exact dezelfde engine** als planning page.
GEEN duplicatie. GEEN hardcoded arrays.

Replace `availability: never[] = []` in orders.ts met aanroep naar `computeCascadedAvailability()`.

**UI: Split-view**
```
┌────────────────────────────┬───────────────────────────┐
│ KLANT ORDERS               │ BESCHIKBAARHEID           │
│                            │                           │
│ ┌ Grutto ─────────────┐   │ Product     │ Besch │ Rest│
│ │ Borstkap   [3.000]kg│   │ Borstkap    │ 7.031│2.723│
│ │ Zadels     [2.000]kg│   │ Zadels      │ 8.378│4.555│
│ └──────────────────────┘   │ Vleugels    │ 3.202│1.688│
│                            │                           │
│ [+ Nieuwe Order]           │ 🟢 >50%  🟡 <25%  🔴 over│
└────────────────────────────┴───────────────────────────┘
```

### A2-S2 — Smart Allocation Buttons

**1. "📋 Volledige beschikbaarheid"**
- Pakt alle resterende beschikbaarheid als orderregels
- Preview modal vóór bevestiging
- Oversubscribe waarschuwing

**2. "🐔 Verdeel X kippen"**
- Input: aantal kippen
- Berekening: kippen × gem. gewicht × griller yield × deel-yields
- Preview tabel → gebruiker past aan → bevestig
- Merge vs replace expliciet
- Nooit silent overwrite

Minimaal 12 tests.

### A2-S3 — Inline Editing

- Klik op kg → direct editeerbaar
- Enter = opslaan, Escape = annuleren
- Tab door velden
- Delete met bevestiging

### A7-S2 — Regression Gate

- Alle tests PASS
- Build clean
- Availability panel gekoppeld (niet meer `[]`)

**Tag: v0.7-wave7**

---

## 🌊 WAVE 8 — Product Master & Export Precision

### Doel

Storteboom-exact export. Artikelnummers en bezorginfo.

### Agents

| Agent | Verantwoordelijkheid |
|-------|---------------------|
| INFRA_AGENT | Migraties: article numbers, delivery info |
| EXPORT_AGENT | Storteboom bestelschema generator |
| QA_AGENT | Export validation, format matching |

### A0-S3 — Product Article Numbers

```sql
CREATE TABLE product_article_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id),
  location_id UUID REFERENCES locations(id),
  article_type TEXT NOT NULL
    CHECK (article_type IN ('vacuum', 'niet_vacuum')),
  article_number TEXT NOT NULL,
  UNIQUE (product_id, location_id, article_type)
);
```

### A0-S4 — Customer Delivery Info

```sql
CREATE TABLE customer_delivery_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  delivery_address TEXT,
  transport_provider TEXT,
  default_delivery_day_offset INT,
  notes TEXT,
  UNIQUE (customer_id)
);
```

### A3-S1 — Storteboom Export Exactness

**Per slachtdag één Excel sheet met secties:**

| # | Sectie | Inhoud |
|---|--------|--------|
| 1 | Algemeen | Datum, weeknummer, mester |
| 2 | Aanvoer | Dieren, gem. gewicht, totaal levend |
| 3 | Rendement | Griller yield %, griller kg |
| 4 | Beschikbaarheid Putten | Products + art.nrs (vacuum/niet-vac) + kg |
| 5 | Beschikbaarheid Nijkerk | Dag+1 products + art.nrs + kg |
| 6 | Orders per klant | Klanten als kolommen, producten als rijen, REST-kolom |
| 7 | Transport | Afleveradres, transport, bezorgdag per klant |

**REST = beschikbaar - som(alle klant-orders)**

**Validator checkt:** cell positions, kolom volgorde, NL number format, twee-locatie split, art.nrs aanwezig.

Minimaal 15 tests.

### A7-S3 — Regression Gate

- Alle tests PASS, build clean
- Export valideert tegen Storteboom checklist

**Tag: v0.8-wave8**

---

## 🌊 WAVE 9 — UX Polish & Operational Flow

### Doel

Volwassen look & feel. Sidebar. Order status visualisatie.

### Agents

| Agent | Verantwoordelijkheid |
|-------|---------------------|
| UI_AGENT | Sidebar, design system, KPI cards |
| UX_AGENT | Order status flow, cascade indicators |
| QA_AGENT | Visual regression, responsive check |

### A5-S1 — Sidebar

```
┌──────────────┬────────────────────────────────────┐
│ 🐔 OIL      │                                    │
│              │  [Page content]                    │
│ Dashboard    │                                    │
│ Planning     │                                    │
│ Orders       │                                    │
│ Processing   │                                    │
│ Exports      │                                    │
│ ─────────── │                                    │
│ Batches      │                                    │
│ Kostprijs    │                                    │
│ Klanten      │                                    │
│ ─────────── │                                    │
│ Locaties     │                                    │
│ Master Data  │                                    │
└──────────────┴────────────────────────────────────┘
```

Oranjehoen branding: oranje (#F97316) accent.

### A5-S2 — Order Status Visualization

- Kleurcodes per status (concept/ingediend/bevestigd/geleverd)
- Cascade indicator (doorstuur-pijltjes)
- Oversubscribe badge
- Progress bar per slachtdag (% beschikbaarheid ingevuld)

### A5-S3 — Slaughter Day Intelligence Panel

```
┌── Beschikbaarheid Overzicht ─────────────────────┐
│ Totaal beschikbaar:     29.921 kg                 │
│ Verkocht Putten:         8.500 kg (28%)           │
│ Doorgestuurd Nijkerk:   21.421 kg (72%)           │
│ Verkocht Nijkerk:       15.200 kg                 │
│ REST (onverkocht):       6.221 kg                 │
│ Utilisation: ████████████████░░░░  79%            │
└───────────────────────────────────────────────────┘
```

Geen nieuwe engine. Gebruikt `computeCascadedAvailability()`.

### A5-S4 — Design System Polish

- Heading hierarchy, card layout, Inter font
- KPI cards met trend-indicators
- DataTable (sorteerbaar, filterbaar)

### A7-S4 — Regression Gate

**Tag: v0.9-wave9**

---

## 🌊 WAVE 10 — Yield Preparation (Phase 3 Bridge)

### Doel

Architectuur klaarzetten voor echte yields. GEEN echte koppeling nog.

### A1-S2 — Dual Yield Model

```typescript
function getYieldForProduct(productId, slaughterId) {
  if (actualYieldExists(productId, slaughterId))
    return getActualYield(productId, slaughterId);
  else
    return getTheoreticalYield(productId);
}
```

**`actualYieldExists` blijft `false` in Phase 2.** Alle tests op theoretische default.

Minimaal 10 tests:
- theoretical fallback (default path)
- actual yield override (mock data — Phase 3 prep)
- partial actual (mix)
- mass balance consistency
- cascade never creates mass
- surplus consistent
- snapshot freeze intact
- zero/100% yield edge cases
- missing product fallback

### A7-S5 — Final Regression Gate

- Alle tests PASS (target: 700+)
- Protected file diff = 0
- Build clean
- Full QA report

**Tag: v0.10-wave10**

---

## 🔒 Governance (verplicht elke wave)

```
Pre-flight:
  □ FILES TO TOUCH lijst
  □ Protected file diff = 0
  □ npm test PASS
  □ npm run build PASS

Post-flight:
  □ npm test PASS
  □ npm run build PASS
  □ Protected file diff = 0
  □ Git tag gezet
  □ SYSTEM_STATE.md geüpdate
```

AGENT TEAMS verplicht in CLI.

---

## Database Migraties

| Wave | Tabel | Beschrijving |
|------|-------|-------------|
| 6 | `locations` | Putten/Nijkerk locatie |
| 6 | `location_yield_profiles` | Yield % per product per locatie |
| 6 | `product_yield_chains` | Product→product cascade met yield |
| 8 | `product_article_numbers` | Art.nrs vacuum/niet-vacuum per locatie |
| 8 | `customer_delivery_info` | Afleveradres, transport, bezorgdag |

---

## Engine Modules

```
src/lib/engine/
├── availability/
│   ├── cascading.ts          # computeCascadedAvailability()
│   └── dual-yield.ts         # getYieldForProduct() (Wave 10)
├── orders/
│   ├── auto-distribute.ts    # "Geef X kippen" (Wave 7)
│   └── full-availability.ts  # "Geef alles aan klant" (Wave 7)
├── export/
│   ├── storteboom-format.ts  # Storteboom generator (Wave 8)
│   └── storteboom-styles.ts  # Excel styling (Wave 8)
```

---

## Components

```
src/components/oil/
├── orders/
│   ├── AvailabilityPanel.tsx       # Live beschikbaarheid (W7)
│   ├── AutoDistributeModal.tsx     # "X kippen verdelen" (W7)
│   ├── FullAvailabilityButton.tsx  # "Alles naar klant" (W7)
│   ├── OrderLineInlineEdit.tsx     # Inline editing (W7)
│   └── OrderStatusBadge.tsx        # Status badges (W9)
├── planning/
│   ├── ImportSlaughterDays.tsx     # Import terugplaatsen (W6)
│   ├── TwoLocationView.tsx         # Putten + Nijkerk (W9)
│   └── IntelligencePanel.tsx       # Utilisation % (W9)
├── export/
│   └── StorteboomPreview.tsx       # Preview vóór export (W8)
└── shared/
    ├── SidebarNav.tsx              # Sidebar (W9)
    ├── KPICard.tsx                 # Dashboard KPI (W9)
    └── DataTable.tsx               # Sorteerbare tabel (W9)
```

---

## Putten → Nijkerk Model (Referentie)

```
PUTTEN (Dag 0)                          NIJKERK (Dag 1)
─────────────────                        ─────────────────
Hele kip → Snijden                       Ontvangst doorgestuurde delen
  ├── Borstkappen ─── verkoop Putten     ├── Borstkappen → Fileren
  │                └── doorstuur ────────┤   ├── Filet met haas  (42%)
  │                                      │   ├── Filet zonder haas (35%)
  │                                      │   ├── Haasjes apart (8%)
  │                                      │   └── Vel/trim (15%)
  ├── Zadels ──────── verkoop Putten     ├── Zadels → Ontbenen
  │                └── doorstuur ────────┤   ├── Dijfilet (35%)
  │                                      │   ├── Drumsticks (30%)
  │                                      │   ├── Drumvlees (20%)
  │                                      │   └── Rest/trim (15%)
  ├── Vleugels ───── verkoop Putten
  │                └── doorstuur Nijkerk
  ├── Drumsticks ─── verkoop Putten
  ├── Dij anatomisch  verkoop Putten
  └── Organen ────── verkoop Putten

Rekenregel:
  doorgestuurde_kg = beschikbaar_putten - verkocht_putten
  beschikbaar_nijkerk[child] = doorgestuurde_kg[parent] × yield_pct[child]
```

---

## Storteboom Excel Format (Referentie)

Per slachtdag één sheet:

| Sectie | Inhoud |
|--------|--------|
| Algemeen | Datum, weeknummer, mester |
| Aanvoer | Dieren, gem. gewicht, totaal levend |
| Rendement | Griller yield %, griller kg |
| Beschikbaarheid Putten | Products + art.nrs (vacuum/niet-vac) + beschikbaar kg |
| Beschikbaarheid Nijkerk | Dag+1 products + art.nrs + beschikbaar kg |
| Orders per klant | Klanten als kolommen, producten als rijen, REST-kolom |
| Transport | Afleveradres, transport provider, bezorgdag per klant |
