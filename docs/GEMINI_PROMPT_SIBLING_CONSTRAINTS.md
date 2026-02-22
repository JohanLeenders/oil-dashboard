# Prompt: Zadel-model & Putten Snijding — Cascade Engine Uitbreiding

> Geef dit document samen met `docs/GEMINI_CONTEXT.md` aan een AI-assistent.

---

## Context

Lees eerst `docs/GEMINI_CONTEXT.md` voor de volledige architectuur van het OIL Dashboard. Dit document beschrijft een uitbreiding van de cascade engine.

---

## 1. Het Probleem: Het Zadel ontbreekt als parent-product

### Wat de Excel (bron van waarheid) laat zien

Het Storteboom bestelschema kent op Putten-niveau **drie anatomische groepen** als beschikbaarheidspools:

```
Beschikbaarheid Putten (15.820 kippen × 1.88 kg griller = 29.765 kg):
  Beschikbare Kappen    10.714 kg  = 36.00% van griller
  Beschikbare Zadels    12.947 kg  = 43.50% van griller
  Beschikbare Vleugels   2.827 kg  =  9.50% van griller
```

**"Zadels" is een echt parent-product** — de hele bout/achterkwart als ongesplitst stuk. Ons datamodel mist dit.

### Wat ons model nu fout doet

Het huidige model kent GEEN "Zadel" als parent. In plaats daarvan staan Dij anatomisch (14.68%) en Drumstick (16.56%) als **onafhankelijke primaire producten** in `location_yield_profiles`. Maar dit zijn children van de zadel.

```
Excel "Beschikbare Zadels":     43.50% van griller (12.947 kg)
Ons model Dij + Drumstick:      31.24% van griller (9.299 kg)
Verschil:                        12.26% → bot, kraakbeen, verlies bij opensnijden
```

---

## 2. Het Juiste Model: Twee snij-routes per parent

### Kappen (werkt al correct)

```
KAPPEN (36.00% van griller) ← yield_profiles parent
  │
  ├─ Verkocht bij Putten → klant krijgt hele kap (sold_parent_kg)
  └─ Niet verkocht → gaat heel naar Nijkerk → yield_chains (Putten→Nijkerk):
       ├── Filet m haas  (68.00% van kap)
       ├── Haasjes       (12.00% van kap)
       └── Vel           (8.63% van kap)
```

### Zadels (NIEUW — moet hetzelfde patroon volgen, maar met Putten-snijding)

```
ZADELS (43.50% van griller) ← yield_profiles parent (NIEUW!)
  │
  ├─ sold_parent_kg (als zadel direct verkoopbaar is, anders = 0)
  │
  ├─ Route A: Putten-snijding (als klant dij en/of drumstick bestelt)
  │    Via yield_chains (Putten→Putten):
  │    ├── Dij anatomisch  33.74% van zadel (= 14.68% van griller)
  │    ├── Drumstick 10kg  38.07% van zadel (= 16.56% van griller)
  │    └── Verlies         28.19% van zadel (expliciet als loss child OF impliciet)
  │    ⚠️ GEKOPPELD: alle Putten→Putten children worden SAMEN geproduceerd
  │    ⚠️ Niet-bestelde children = co-product vrije voorraad
  │
  └─ Route B: Heel naar Nijkerk (standaard — wat niet gesneden is)
       Via yield_chains (Putten→Nijkerk):
       ├── Dijvlees        28.00% van zadel
       ├── Drumsticks 15kg 31.00% van zadel
       ├── Drumvlees       15.19% van zadel
       └── Verlies         25.81% van zadel
```

### Key insight: `product_yield_chains` krijgt twee child-sets per parent

Het bestaande datamodel heeft al `source_location_id` en `target_location_id` in `product_yield_chains`. Dit onderscheidt de twee routes:

- **Putten→Putten chains** = snij-operatie bij Putten (gekoppelde outputs)
- **Putten→Nijkerk chains** = heel doorsturen naar Nijkerk (bestaande cascade)

Geen nieuwe tabellen nodig. De coupling is impliciet: alle Putten→Putten children van dezelfde parent horen bij één snij-operatie.

---

## 3. De Engine Flow (per parent-pool)

```
Per parent-pool (kappen, zadels, vleugels, organen):

  1. parent_available_kg = griller_kg × parent_yield

  2. sold_parent_kg = directe orders op parent (als is_sellable)
     remaining = parent_available - sold_parent

  3. Check: heeft deze parent Putten→Putten chains?

     NEE → forwarded_to_nijkerk = remaining  (bestaande flow, zoals kappen nu)

     JA →
       a. Verzamel orders op alle Putten-children van deze parent
       b. Per child: required_parent_for_child = order_child / child_yield_of_parent
       c. required_cut_kg = max(required_parent_for_child_1, ..._2, ...)
          ⚠️ Als er GEEN orders zijn: required_cut_kg = 0
          ⚠️ Cap: required_cut_kg = min(required_cut_kg, remaining)
       d. Per child: produced_kg = required_cut_kg × child_yield_of_parent
       e. Per child: sold_child_kg = min(order_child, produced_kg)
       f. Per child: co_product_free_kg = produced_kg - sold_child_kg
       g. Per child: unfulfilled_kg = order_child - sold_child_kg  (voor UI/alerts)
       h. cut_loss_kg = required_cut_kg × (1 - sum(putten_child_yields))
       i. forwarded_to_nijkerk = remaining - required_cut_kg

  4. Nijkerk-cascade (bestaande Putten→Nijkerk chains)
     ⚠️ UITSLUITEND op forwarded_to_nijkerk (NIET op parent_available!)
     Bestaande normalisatie-regels gelden hier ongewijzigd.
```

### Waarom `max()` en niet `sum()`?

Eén snij-operatie levert ALLE Putten-children tegelijk. Je snijdt zadels totdat je aan de **grootste** individuele vraag voldoet. De andere children komen automatisch mee als co-product.

```
Voorbeeld: 4.350 kg zadel beschikbaar

Klant bestelt 500 kg dij anatomisch EN 800 kg drumstick 10kg:
  Required voor dij:  500 / 0.3374 = 1.482 kg zadel
  Required voor drum: 800 / 0.3807 = 2.101 kg zadel
  required_cut_kg = max(1.482, 2.101) = 2.101 kg zadel

Dit levert:
  Dij anatomisch: 2.101 × 0.3374 = 709 kg → sold 500, vrij 209 kg
  Drumstick 10kg: 2.101 × 0.3807 = 800 kg → sold 800, vrij 0 kg
  Verlies:        2.101 × 0.2819 = 592 kg
  Forwarded:      4.350 - 2.101  = 2.249 kg → Nijkerk cascade
```

### Overbestelling (cap scenario)

```
Klant bestelt 3.000 kg dij anatomisch (meer dan beschikbaar):
  Required: 3.000 / 0.3374 = 8.893 kg zadel → maar remaining = 4.350 kg!
  required_cut_kg = min(8.893, 4.350) = 4.350 kg (cap!)

  Dij produced: 4.350 × 0.3374 = 1.468 kg → sold 1.468, unfulfilled 1.532 kg ⚠️
  Drum produced: 4.350 × 0.3807 = 1.656 kg → sold 0, vrij 1.656 kg
  Forwarded: 0 kg → Nijkerk krijgt NIETS van deze parent
```

---

## 4. Massabalans Invarianten

### Per parent-pool:
```
parent_available = sold_parent + required_cut + forwarded_to_nijkerk

required_cut = sum(putten_children_produced) + cut_loss
             = sum(child_i × yield_i) + required_cut × (1 - sum(yields))
             = required_cut ✓  (tautologie — klopt altijd)
```

### Globaal:
```
sum(sold_parent) + sum(all_putten_children_produced) + sum(cut_loss)
  + sum(nijkerk_cascaded) + sum(nijkerk_loss)
  ≤ griller_kg + EPSILON
```

### De 4 wetten blijven intact:
```
1) sold_parent + required_cut + forwarded = parent_available    (per parent)
2) sum(child_yields) ≤ 1.0 OF genormaliseerd                   (per chain-set)
3) sold_child ≤ produced_child ≤ child_available                (per child)
4) sum(all_allocations) + sum(all_losses) ≤ griller_kg          (globaal)
```

---

## 5. Data Model Wijzigingen

### A. Nieuw product: Zadel

```sql
INSERT INTO products (sku_code, description, internal_name, category, anatomical_part, is_active, is_saleable)
VALUES ('OH-ZADEL-001', 'Zadel (heel)', 'zadel', 'zadel', 'leg_quarter', true, false);
-- is_saleable = false: zadel wordt niet direct verkocht, alleen via children
```

### B. Nieuwe yield_profile: Zadel als Putten parent

```sql
-- Verwijder dij anatomisch en drumstick als losse yield_profiles
DELETE FROM location_yield_profiles
WHERE location_id = 'LOC_PUTTEN'
  AND product_id IN (SELECT id FROM products WHERE sku_code IN ('OH-DIJANA-001', 'OH-DRUM-BULK-001'));

-- Voeg Zadel toe als parent met 43.50% yield
INSERT INTO location_yield_profiles (location_id, product_id, yield_percentage, is_active)
SELECT 'LOC_PUTTEN', id, 0.435000, true
FROM products WHERE sku_code = 'OH-ZADEL-001';
```

### C. Putten→Putten yield_chains (NIEUW)

```sql
-- Zadel → Dij anatomisch (Putten snijding): 33.74% van zadel
INSERT INTO product_yield_chains
  (parent_product_id, child_product_id, source_location_id, target_location_id, yield_pct, sort_order)
SELECT
  (SELECT id FROM products WHERE sku_code = 'OH-ZADEL-001'),
  (SELECT id FROM products WHERE sku_code = 'OH-DIJANA-001'),
  'LOC_PUTTEN', 'LOC_PUTTEN', 0.337400, 20;

-- Zadel → Drumstick 10kg (Putten snijding): 38.07% van zadel
INSERT INTO product_yield_chains
  (parent_product_id, child_product_id, source_location_id, target_location_id, yield_pct, sort_order)
SELECT
  (SELECT id FROM products WHERE sku_code = 'OH-ZADEL-001'),
  (SELECT id FROM products WHERE sku_code = 'OH-DRUM-BULK-001'),
  'LOC_PUTTEN', 'LOC_PUTTEN', 0.380700, 21;
```

### D. Bestaande Nijkerk chains updaten: parent wordt Zadel

```sql
-- Update bestaande Nijkerk chains: parent van "Dij anatomisch" → "Zadel"
UPDATE product_yield_chains
SET parent_product_id = (SELECT id FROM products WHERE sku_code = 'OH-ZADEL-001'),
    yield_pct = 0.280000  -- 28.00% van zadel (was 63% van dij anatomisch)
WHERE child_product_id = (SELECT id FROM products WHERE sku_code = 'OH-DIJ-BULK-001');

-- Drumvlees: parent → Zadel
UPDATE product_yield_chains
SET parent_product_id = (SELECT id FROM products WHERE sku_code = 'OH-ZADEL-001'),
    yield_pct = 0.151900  -- 15.19% van zadel (was 49% van dij anatomisch)
WHERE child_product_id = (SELECT id FROM products WHERE sku_code = 'OH-DRUMVL-001');

-- Drumsticks 15kg Nijkerk: parent → Zadel (NIEUW — stond er nog niet)
INSERT INTO product_yield_chains
  (parent_product_id, child_product_id, source_location_id, target_location_id, yield_pct, sort_order)
SELECT
  (SELECT id FROM products WHERE sku_code = 'OH-ZADEL-001'),
  (SELECT id FROM products WHERE sku_code = 'OH-DRUM-001'),  -- Drumsticks 15kg Nijkerk
  'LOC_PUTTEN', 'LOC_NIJKERK', 0.310000, 12;
```

### E. Optioneel: expliciet verlies-product

```sql
-- Putten snij-verlies (bot, kraakbeen): 28.19% van zadel
INSERT INTO products (sku_code, description, category, is_active, is_saleable)
VALUES ('OH-ZADEL-LOSS-P', 'Zadel snijverlies Putten', 'verlies', true, false);

INSERT INTO product_yield_chains
  (parent_product_id, child_product_id, source_location_id, target_location_id, yield_pct, sort_order)
SELECT
  (SELECT id FROM products WHERE sku_code = 'OH-ZADEL-001'),
  (SELECT id FROM products WHERE sku_code = 'OH-ZADEL-LOSS-P'),
  'LOC_PUTTEN', 'LOC_PUTTEN', 0.281900, 22;
-- Met loss product: sum(putten chains) = 0.3374 + 0.3807 + 0.2819 = 1.0000 ✓
```

---

## 6. Geverifieerde Yield Data

```
Product                    | % van griller | % van zadel | Route         | Bron
───────────────────────────────────────────────────────────────────────────────────
PUTTEN PARENTS (yield_profiles):
  Kappen                   | 36.00%        | -           | -             | Excel
  Zadels (NIEUW)           | 43.50%        | 100%        | -             | Excel
  Vleugels                 |  9.50%        | -           | -             | Excel

PUTTEN→PUTTEN CHAINS (zadel opensnijden):
  Dij anatomisch           | 14.68%        | 33.74%      | Putten→Putten | Excel
  Drumstick 10kg           | 16.56%        | 38.07%      | Putten→Putten | Excel
  Snij-verlies             | 12.26%        | 28.19%      | Putten→Putten | Berekend
                           |               | ────────    |               |
                           |               | 100.00%     |               |

PUTTEN→NIJKERK CHAINS (zadel heel doorsturen):
  Dijvlees                 |  -            | 28.00%      | Putten→Nijkerk| Excel
  Drumsticks 15kg          |  -            | 31.00%      | Putten→Nijkerk| Excel
  Drumvlees                |  -            | 15.19%      | Putten→Nijkerk| Excel
  Verwerk-verlies          |  -            | 25.81%      | Putten→Nijkerk| Berekend
                           |               | ────────    |               |
                           |               | 100.00%     |               |

PUTTEN→NIJKERK CHAINS (kappen — bestaand, ongewijzigd):
  Filet m haas             |  -            | 68.00%*     | Putten→Nijkerk| Excel
  Haasjes                  |  -            | 12.00%*     | Putten→Nijkerk| Excel
  Vel                      |  -            | 8.63%*      | Putten→Nijkerk| Excel
  (* % van kappen)
```

---

## 7. Harde Architectuur Eisen

1. **Yield schaal**: Alle yields op 0.0–1.0 schaal (NUMERIC 7,6). Geen 0–100!
2. **Massabalans**: De 4 invarianten (zie Sectie 4) mogen NIET gebroken worden.
3. **Pure function**: De cascade engine mag geen database calls, async, of side effects hebben.
4. **Immutable data**: Geen mutaties van input-objecten.
5. **Backward compatible**: Parents zonder Putten→Putten chains werken exact als voorheen.
6. **Overbestelling**: Bij cap op remaining moet `unfulfilled_kg` per child berekend worden. Nooit negatieve co_product_free.
7. **Lege orders**: Als geen enkele Putten-child besteld is, `required_cut_kg = 0`.
8. **Verlies**: Bij voorkeur expliciet modelleren als loss-child (sum chains = 1.0).

---

## 8. Relevante Bestanden

| Bestand | Waarom |
|---------|--------|
| `src/lib/engine/availability/cascading.ts` | De cascade engine — hier komt de Putten-snijding stap bij |
| `src/lib/engine/availability/simulator.ts` | Simulator — moet compatible blijven |
| `src/lib/actions/availability.ts` | Server action — moet Putten→Putten chains ophalen |
| `supabase/migrations/20260220140000_wave6_fix_products_and_yields.sql` | Huidige yields |
| `src/types/database.ts` | Product types met category, anatomical_part |
| `docs/GEMINI_CONTEXT.md` | Volledige architectuur context |

---

## 9. Deliverables

1. **Type uitbreidingen**: Aangepaste CascadedProduct met Putten-snijding velden (produced_kg, co_product_free_kg, unfulfilled_kg, cut_loss_kg)
2. **Engine uitbreiding**: Putten-snijding stap in `computeCascadedAvailability` (of als pre-processing function)
3. **Migratie SQL**: Zadel als product, yield_profiles update, Putten→Putten chains, Nijkerk chains update
4. **Tests**: (a) geen Putten-snijding, (b) één child besteld, (c) beide children besteld, (d) overbestelling met cap, (e) massabalans check in alle scenarios
5. **Backward compatibility bewijs**: Bestaande tests moeten ONGEWIJZIGD slagen
