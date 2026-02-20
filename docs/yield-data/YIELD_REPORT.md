# Yield Report — Pre-Wave 6

**Datum:** 2026-02-20
**Auteur:** DATA_AGENT (Pre-Wave 6)
**Basis:** JA757 breed standard + Phase 2 plan estimates

---

## 1. Yield Overzicht

### Primary Yields (Griller → Parts at Putten)

All yields as fraction of **griller weight** (not live weight).

| Product | SKU | Yield % | Yield (0-1) | Source | Status |
|---------|-----|---------|-------------|--------|--------|
| Borstkap (primair) | OH-BORSTKAP-001 (NEW) | 23.5% | 0.235 | Phase 2 plan | ESTIMATED |
| Zadel (primair) | OH-ZADEL-001 (NEW) | 28.0% | 0.280 | Phase 2 plan | ESTIMATED |
| Vleugels | OH-VLEUGEL-001 | 10.7% | 0.107 | JA757 (7.6% live / 70.7% griller) | KNOWN |
| Rug/karkas | OH-NAAKT-001 | 7.5% | 0.075 | Phase 2 plan | ESTIMATED |
| Lever | OH-LEVER-001 | 1.8% | 0.018 | Estimate (organen split) | ESTIMATED |
| Maag | OH-MAAG-001 | 1.0% | 0.010 | Estimate (organen split) | ESTIMATED |
| Hart | OH-HART-001 | 0.5% | 0.005 | Estimate (organen split) | ESTIMATED |
| Hals/Nek | OH-HALS-001 | 0.5% | 0.005 | Estimate (organen split) | ESTIMATED |
| **Totaal saleable** | | **73.5%** | **0.735** | | |
| Cutting loss | | 26.5% | 0.265 | Implied | ESTIMATED |

### Cascade Yields (Forwarded Parts → Nijkerk Products)

All yields as fraction of **forwarded parent kg**.

#### Borstkap → Fileren (Nijkerk)

| Child Product | SKU | Yield % | Yield (0-1) | Status |
|---------------|-----|---------|-------------|--------|
| Filet half met haas | OH-FILET-HAAS-001 (NEW) | 42.0% | 0.420 | ESTIMATED |
| Filet half zonder haas | OH-FILET-HALF-001 | 35.0% | 0.350 | ESTIMATED |
| Haasjes (inner fillet) | OH-HAAS-VAC-001 | 8.0% | 0.080 | ESTIMATED |
| **Subtotaal saleable** | | **85.0%** | **0.850** | |
| Vel/trim/loss | | 15.0% | 0.150 | ESTIMATED |

#### Zadel → Ontbenen (Nijkerk)

| Child Product | SKU | Yield % | Yield (0-1) | Status |
|---------------|-----|---------|-------------|--------|
| Dijfilet | OH-DIJ-VAC-001 | 35.0% | 0.350 | ESTIMATED |
| Drumstick | OH-DRUM-001 | 30.0% | 0.300 | ESTIMATED |
| Drumvlees | OH-DRUMVL-001 | 20.0% | 0.200 | ESTIMATED |
| **Subtotaal saleable** | | **85.0%** | **0.850** | |
| Bone/cartilage/trim | | 15.0% | 0.150 | ESTIMATED |

---

## 2. Data Bronnen

| Bron | Yields | Betrouwbaarheid |
|------|--------|----------------|
| **JA757 breed standard** | Griller yield (70.7% live), vleugels (10.7% griller) | KNOWN — breed standard referentie |
| **Phase 2 plan** | Borstkap (23.5%), zadel (28.0%), rug/karkas (7.5%), organen (3.8%) | ESTIMATED — management schattingen |
| **Industry assumptions** | Cascade yields (borstkap fileren, zadel ontbenen) | ESTIMATED — typische waarden voor pluimveeverwerking |
| **Storteboom Excel** | Product SKU codes, artikel omschrijvingen | KNOWN — contractuele referentie |

### Discrepantie met Phase 1 (availability.ts)

Phase 1 `JA757_YIELDS` zijn percentages van **levend gewicht**:
- breast_fillet: 23.2% → 32.8% van griller
- leg_quarter: 28.2% → 39.9% van griller
- wing: 7.6% → 10.7% van griller
- back: 11.7% → 16.6% van griller

Phase 2 `location_yield_profiles` zijn percentages van **griller gewicht** en representeren saleable output (incl. snijverlies):
- Borstkap: 23.5% (vs 32.8% anatomisch — verschil door bone-in vs deboned, plus trim)
- Zadel: 28.0% (vs 39.9% anatomisch — verschil door trim en bot-afval bij snijden)

**Reden verschil**: Phase 1 yields zijn anatomische breed-standard waarden. Phase 2 yields zijn verkoopbare opbrengst na primair snijden (inclusief processingverlies).

---

## 3. Worked Example: 1000 Vogels

```
Input:        1,000 vogels × 2.65 kg = 2,650.00 kg levend gewicht
Griller:      2,650.00 × 0.704     = 1,865.60 kg griller

Scenario: 30% verkocht Putten, 70% doorgestuurd Nijkerk
```

### Primary Products (Putten)

| Product | Beschikbaar | Verkocht (30%) | Doorgestuurd (70%) |
|---------|------------|----------------|-------------------|
| Borstkap | 438.42 kg | 131.53 kg | 306.89 kg |
| Zadel | 522.37 kg | 156.71 kg | 365.66 kg |
| Vleugels | 199.62 kg | 59.89 kg | 139.73 kg |
| Rug/karkas | 139.92 kg | 41.98 kg | 97.94 kg |
| Organen | 70.89 kg | 21.27 kg | 49.63 kg |
| **Totaal** | **1,371.22 kg** | **411.38 kg** | **959.85 kg** |
| Snijverlies | 494.38 kg | | |

### Cascade Products (Nijkerk, uit doorgestuurde borstkap 306.89 kg)

| Child Product | Yield | Beschikbaar |
|---------------|-------|------------|
| Filet met haas | 42% | 128.89 kg |
| Filet zonder haas | 35% | 107.41 kg |
| Haasjes | 8% | 24.55 kg |
| Processingverlies | 15% | 46.03 kg |
| **Totaal** | **100%** | **306.89 kg** |

### Cascade Products (Nijkerk, uit doorgestuurde zadel 365.66 kg)

| Child Product | Yield | Beschikbaar |
|---------------|-------|------------|
| Dijfilet | 35% | 127.98 kg |
| Drumstick | 30% | 109.70 kg |
| Drumvlees | 20% | 73.13 kg |
| Processingverlies | 15% | 54.85 kg |
| **Totaal** | **100%** | **365.66 kg** |

### Invariant Verificatie

```
Invariant 1 (per parent):
  Borstkap:  131.53 + 306.89 = 438.42 ✓
  Zadel:     156.71 + 365.66 = 522.37 ✓
  Vleugels:   59.89 + 139.73 = 199.62 ✓

Invariant 2 (child yields ≤ 1.0):
  Borstkap children: 0.42 + 0.35 + 0.08 = 0.85 ≤ 1.0 ✓
  Zadel children:    0.35 + 0.30 + 0.20 = 0.85 ≤ 1.0 ✓
  Loss borstkap: 306.89 × 0.15 = 46.03 ✓
  Loss zadel:    365.66 × 0.15 = 54.85 ✓

Invariant 3 (child sold ≤ available):
  (Geen Nijkerk-verkopen in dit scenario, triviaal ✓)

Invariant 4 (global):
  sum(SoldP) = 411.38
  sum(Cascaded) = 128.89+107.41+24.55+127.98+109.70+73.13 = 571.66
  sum(Loss) = 46.03+54.85+139.73+97.94+49.63+494.38 = 882.56
  Total = 411.38 + 571.66 + 882.56 = 1,865.60 = G ✓
```

---

## 4. Nieuwe Producten Nodig

3 nieuwe producten moeten worden toegevoegd aan de `products` tabel:

| SKU | Beschrijving | Reden |
|-----|-------------|-------|
| OH-BORSTKAP-001 | Borstkap (primair snijdeel) | Primair snijdeel griller, geen exact bestaand product |
| OH-ZADEL-001 | Zadel (primair snijdeel) | Primair snijdeel griller, bestaat niet in products tabel |
| OH-FILET-HAAS-001 | OH Filet half met haas | Cascade-output Nijkerk, verschilt van bestaande filet SKUs |

Volledige definities: zie `new_products.seed.json`.

---

## 5. Phase 3 — Wat Moet Gemeten Worden

Phase 3 vervangt ESTIMATED yields door **werkelijke gemeten yields** op basis van productiedata.

### Te Meten Yields

| Yield | Huidige Basis | Meetmethode Phase 3 |
|-------|---------------|---------------------|
| Borstkap % van griller | Schatting 23.5% | Wegen per batch: kg borstkap / kg griller |
| Zadel % van griller | Schatting 28.0% | Wegen per batch: kg zadel / kg griller |
| Filet met haas % van borstkap | Schatting 42% | Wegen per shift: kg filet / kg input borstkap |
| Filet zonder haas % van borstkap | Schatting 35% | Wegen per shift: kg filet / kg input borstkap |
| Haasjes % van borstkap | Schatting 8% | Wegen per shift: kg haasjes / kg input borstkap |
| Dijfilet % van zadel | Schatting 35% | Wegen per shift: kg dijfilet / kg input zadel |
| Drumstick % van zadel | Schatting 30% | Wegen per shift: kg drumstick / kg input zadel |
| Drumvlees % van zadel | Schatting 20% | Wegen per shift: kg drumvlees / kg input zadel |
| Snijverlies Putten | Implied 26.5% | Wegen: kg griller - sum(kg alle primaire delen) |
| Processing loss Nijkerk | Implied 15% per parent | Wegen: kg input - sum(kg alle output) |

### Aanbevolen Tabelstructuur Phase 3

```
-- Phase 3 tabel (NIET bouwen in Phase 2, alleen documenteren)
CREATE TABLE actual_yield_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID REFERENCES production_batches(id),    -- per productie-batch
  slaughter_calendar_id UUID REFERENCES slaughter_calendar(id),
  location_id UUID REFERENCES locations(id),           -- Putten of Nijkerk
  parent_product_id UUID REFERENCES products(id),      -- input product
  child_product_id UUID REFERENCES products(id),       -- output product (NULL voor primary)
  input_kg NUMERIC(10,2) NOT NULL,                     -- gewogen input
  output_kg NUMERIC(10,2) NOT NULL,                    -- gewogen output
  yield_pct NUMERIC(7,6) GENERATED ALWAYS AS (output_kg / NULLIF(input_kg, 0)) STORED,
  measurement_date DATE NOT NULL,
  measured_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- EWMA berekening (Phase 3)
-- ewma_yield = alpha × latest_yield + (1-alpha) × prev_ewma
-- Aanbevolen alpha: 0.2 (langzame convergentie, stabiel)
-- Window: 20 batches minimum voor betrouwbare EWMA
```

---

## 6. Deliverable Samenvatting

| # | Bestand | Status |
|---|---------|--------|
| 1 | `docs/yield-data/locations.seed.json` | 2 locaties (Putten, Nijkerk) |
| 2 | `docs/yield-data/location_yield_profiles.seed.json` | 8 yield profiles (73.5% totaal) |
| 3 | `docs/yield-data/product_yield_chains.seed.json` | 6 cascade chains (2 parents × 3 children) |
| 4 | `docs/yield-data/mass_balance_test_cases.json` | 13 test cases |
| 5 | `docs/yield-data/new_products.seed.json` | 3 nieuwe producten |
| 6 | `docs/yield-data/YIELD_REPORT.md` | Dit document |

### KNOWN vs ESTIMATED Samenvatting

- **KNOWN (1):** Vleugels yield (JA757 breed standard)
- **ESTIMATED (15):** Alle overige yields — borstkap, zadel, rug, organen, alle cascade yields
- **Phase 3 replaces:** Alle ESTIMATED yields worden vervangen door EWMA van werkelijke metingen
