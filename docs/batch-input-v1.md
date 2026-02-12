# Batch Input v1 — Handmatige Invoer

## Overzicht

Batch Input v1 biedt handmatige invoer van batchgewichten (FEITEN) met automatische
rendements- en massabalansberekening. De bestaande kostprijswaterval (cost-waterfall-v2)
wordt exact hergebruikt met de ingevoerde data.

## Routes

| Route | Doel |
|-------|------|
| `/oil/batch-input` | Overzicht alle batches |
| `/oil/batch-input/new` | Nieuwe batch aanmaken |
| `/oil/batch-input/[batchId]` | Batch detail (Input + Waterfall tabs) |

## Zo voer je een batch in

1. Ga naar `/oil/batch-input` of klik "Batch Input" in de navigatie
2. Klik "+ Nieuwe batch" (of open een bestaande batch)
3. Vul de secties in (alleen kg en stuks — geen percentages):

   | Sectie | Wat invullen |
   |--------|-------------|
   | 1. Basis | Aantal kippen, DOA, levend gewicht (kg) |
   | 2. Slacht & Griller | Grillergewicht (kg), slachtkosten (€/kip of € totaal) |
   | 3. Joint Products | Borstkap, bouten, vleugels (kg) |
   | 4. Sub-cuts | Filet, dijfilet, drumvlees (kg) |
   | 5. Bijproducten | Bloed, veren, organen, rug/karkas, cat3 (kg) |
   | 6. Kosten | Live cost €/kg, transport, vangkosten |

4. Rendementen verschijnen automatisch (read-only)
5. Massabalans rechts toont status (groen/geel/rood)
6. Klik "Opslaan & herbereken" → waterval wordt doorgerekend
7. Schakel naar tab "Kostprijswaterval" voor de volledige 7-level breakdown

## Massabalans

| Status | Afwijking | Effect |
|--------|-----------|--------|
| 🟢 OK | ≤ 3% | Alles beschikbaar |
| 🟡 Waarschuwing | 3% – 7,5% | Opslaan OK, waarschuwing |
| ⛔ Geblokkeerd | > 7,5% | Scenario + NRV geblokkeerd |

Berekening: `|joint_kg + byproduct_kg − griller_kg| / griller_kg`

## Validatiegolf 1 checken

De batch "VALIDATIE-2025-09-22" is automatisch voorgeladen:

1. Open `/oil/batch-input/VALIDATIE-2025-09-22`
2. Controleer tab "Input" — alle velden zijn ingevuld
3. Klik "Opslaan & herbereken"
4. Ga naar tab "Kostprijswaterval"
5. Verifieer:

### Verwachte waarden

| Check | Verwachting |
|-------|------------|
| Kippen | 15.855 stuks |
| Levend gewicht | 38.980 kg |
| Grillergewicht | 28.056 kg |
| Griller yield | ~71,95% |
| Borstkap | 10.268,50 kg (36,6%) |
| Bouten | 12.221,19 kg (43,56%) |
| Vleugels | 2.581,15 kg (9,2%) |
| Massabalans | 🟢 OK (0,00% afwijking) |
| Live cost | €2,40/kg |
| Slachtkosten | €0,83/kip = €13.159,65 totaal |

### Validatie acceptatiecriteria

1. **Level 1 C_joint**: landed_cost + slaughter_fee = gezamenlijke kostenpool
2. **Level 2 by-product credit**: bijproducten × €0,20/kg wordt afgetrokken vóór SVASO
3. **Level 3 SVASO**: allocatie reconcilieert exact op C_netto_joint (rounding residual < €0,01)
4. **Level 4 Mini-SVASO**: borst → 100% filet; bout → dij + drum
5. **Level 6 kostprijs €/kg**: consistent met engine output
6. **Geen regressie**: `/oil/cost-waterfall-v2` werkt nog steeds met demo-data

## By-product aannames (Validatiegolf 1)

Joint total = 25.070,84 kg. Griller = 28.056 kg.
Benodigd voor 0% afwijking: 2.985,16 kg bijproducten.

| Bijproduct | kg | Rationale |
|------------|-----|-----------|
| Bloed | 0 | Verwijderd vóór griller-stadium |
| Veren | 0 | Verwijderd vóór griller-stadium |
| Organen | 700 | ~2,5% van griller (typisch) |
| Rug/karkas | 1.800 | ~6,4% van griller (typisch) |
| Cat3/overig | 485,16 | Rest om balans op 0% te brengen |
| **Totaal** | **2.985,16** | **= griller − joint** |

## Architectuur

```
BatchInputData (FEITEN: kg + stuks)
      │
      ▼
batch-engine-bridge.ts → Canon Engine (LOCKED)
      │
      ▼
CanonWaterfallData → CostWaterfallShell (bestaand)
```

- In-memory store (geen DB vereist)
- Engine code niet gewijzigd
- Bestaande pages niet gewijzigd (geen regressie)
