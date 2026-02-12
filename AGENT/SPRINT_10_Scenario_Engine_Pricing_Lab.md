
# Sprint 10 — Scenario Engine & Pricing Lab
## Commercieel Dashboard Oranjehoen (Scenario-gedreven)

STATUS: Goedgekeurd
Datum: 11-02-2026

---

## Doel van Sprint 10
Een interactieve scenario-omgeving bouwen waarmee Oranjehoen kan verkennen hoe
veranderingen in **prijzen, kosten en klantmix** doorwerken op kostprijzen, marges
en karkasbalans.

Sprint 10:
- maakt "wat als"-analyses mogelijk
- toont impact door de hele waterval heen
- vergelijkt scenario's naast elkaar
- **neemt geen beslissingen en geeft geen advies**

---

## Niet-onderhandelbare regels
- Scenario's zijn ALTIJD gelabeld als aanname, nooit als voorspelling
- Scenario-uitkomsten mogen niet worden gepresenteerd als werkelijke kostprijzen
- De basis (actuals) blijft altijd zichtbaar naast scenario-uitkomsten
- Geen automatische prijsadviezen of optimalisatie
- Geen automatische acties op basis van scenario-uitkomsten
- De canonical engine (Sprint 7/8) wordt NIET gewijzigd — scenario's zijn een laag eromheen

---

## Drie Scenario-typen

### Type 1: Prijsvector-scenario's
**Vraag:** "Wat als de filetprijs stijgt met 10%?"
**Impact op:**
- SVASO allocatiefactoren (verschuiving tussen joint products)
- k-factor (winstgevendheid batch)
- Kostprijs per SKU (via gewijzigde allocatie)
- Theoretische marges per onderdeel

**Paramaters:**
- Prijswijziging per onderdeel (€/kg of %)
- Één of meerdere onderdelen tegelijk
- Basisscenario: huidige std_prices

### Type 2: Kostenscenario's
**Vraag:** "Wat als slachtkosten stijgen met €0,05/kip?"
**Impact op:**
- Joint cost pool (Level 1)
- Doorwerking naar alle primal parts via SVASO
- k-factor
- Full cost per SKU (Level 6)

**Parameters:**
- Wijziging per kostencomponent:
  - Live cost (€/kg levend)
  - Transport (€/kip)
  - Vangkosten (€/kip)
  - Slachtkosten (€/kip)
  - ABC-kosten per bewerking (€/kg)
- Basisscenario: huidige cost_drivers / batch actuals

### Type 3: Mix-scenario's
**Vraag:** "Wat als klant X 20% meer bouten afneemt?"
**Impact op:**
- Klant-karkasalignment (Sprint 4)
- Voorraaddruk per onderdeel (Sprint 3)
- Impliciete margeverschuiving
- Karkasbalans op bedrijfsniveau

**Parameters:**
- Klant selectie
- Wijziging in afnamemix per onderdeel (kg of %)
- Basisscenario: huidige klantafname (90 dagen)

---

## Datamodel (aanvullend)

### saved_scenarios
- scenario_id (PK)
- scenario_name
- scenario_type (price_vector / cost_change / mix_change)
- parameters (JSONB — de inputwaarden)
- created_date
- created_by
- description
- is_baseline (boolean, max 1 per type)

### scenario_results (optioneel — cache)
- result_id (PK)
- scenario_id (FK)
- batch_id (nullable — voor batch-specifieke scenario's)
- result_data (JSONB — volledige uitkomst)
- calculated_date

---

## Functionele Eisen

### Scenario Builder
- Gebruiker kiest scenario-type (prijs / kosten / mix)
- Sliders of inputvelden voor parameters
- Real-time preview van impact (of "Bereken" knop)
- Resultaat toont volledige waterval met gewijzigde waarden
- Verschil met basis altijd zichtbaar (delta's)

### Vergelijking
- Twee scenario's naast elkaar zetten
- Basis (actuals) altijd als referentie
- Delta-kolom tussen scenario en basis
- Kleurcodering: groen = verbetering, rood = verslechtering

### Opslaan & Hergebruik
- Scenario opslaan met naam en beschrijving
- Opgeslagen scenario's terugvinden en opnieuw laden
- Scenario's delen (toekomstig, buiten scope Sprint 10)

### Disclaimer
Elke pagina met scenario-data toont prominent:
> "Dit is een simulatie gebaseerd op aannames. Dit is GEEN voorspelling of aanbeveling.
> Werkelijke uitkomsten kunnen afwijken."

---

## UI (minimaal)

### Pricing Lab (/oil/scenarios)
- Overzicht opgeslagen scenario's
- Knoppen per scenario-type: "Nieuw prijsscenario", "Nieuw kostenscenario", "Nieuw mixscenario"

### Scenario Detail
- Inputpaneel (links of boven): parameters invullen
- Resultaatpaneel (rechts of onder): waterval / impact tabel
- Vergelijkingsknop: "Vergelijk met..."
- Opslaan-knop

### Prijsvector Scenario
- Per onderdeel: huidige prijs + slider/input voor wijziging
- Tabel: allocatiefactor oud vs nieuw, kostprijs oud vs nieuw
- k-factor indicator: oud vs nieuw

### Kosten Scenario
- Per kostencomponent: huidig tarief + slider/input
- Waterval: Level 0 → 1 → 2 met oude en nieuwe waarden
- Doorwerking naar SKU-kostprijzen

### Mix Scenario
- Klant selectie dropdown
- Per onderdeel: huidige afname + slider/input voor wijziging
- Alignment score oud vs nieuw
- Impact op karkasbalans

---

## Definition of Done
- Prijsvector-scenario's werken en tonen impact op allocatie, k-factor en kostprijzen
- Kostenscenario's werken en tonen doorwerking door waterval
- Mix-scenario's werken en tonen impact op alignment en druk
- Scenario's vergelijkbaar naast basis (actuals)
- Scenario's opslaanbaar en herlaadbaar
- Disclaimer aanwezig op alle scenario-pagina's
- Canonical engine NIET gewijzigd (scenario's zijn een laag eromheen)
- npm test PASS
- npm run build PASS
- npm run lint PASS
- Documentatie bijgewerkt:
  - DATA_CONTRACTS.md
  - KPI_DEFINITIONS.md
  - Oplevering bevat changelog + max. 5 open vragen

---

## Afhankelijkheden
- Sprint 8 (Canon Alignment) — engine moet correct zijn
- Sprint 9 (Data Import) — scenario's zijn zinvoller met echte data, maar werken ook met demo data
- Canonical cost engine (Sprint 7) als rekenlaag

---

## Claude Loop-instructie
1. Lees Sprint 7–9 documenten en canon
2. Lees bestaande scenario-code (scenario-impact.ts, price_scenarios tabel)
3. Maak uitvoerplan
4. Bouw scenario-types één voor één
5. Bouw vergelijkingsfunctie
6. Bouw opslaan/laden
7. Check tegen DoD
8. Update documentatie
9. Rapporteer
10. STOP — sprintreeks afgerond
