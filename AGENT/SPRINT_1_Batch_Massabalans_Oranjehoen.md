
# Sprint 1 — Batch Massabalans & Carcass Balance
## Commercieel Dashboard Oranjehoen (Document-gedreven)

STATUS: Goedgekeurd  
Datum: 24-01-2026  

---

## Doel van Sprint 1
Een sluitende, uitlegbare massabalans per batch bouwen op basis van:
- Slachtrendement-uploads (Map1)
- Pakbonnen uit Flow Automation

Zonder:
- kostprijslogica
- voorraadsturing
- klantlogica
- optimalisatie of advies

Sprint 1 draait uitsluitend om **waarheid en zichtbaarheid**.

---

## Niet-onderhandelbare regels
- Geen machine-, sensor- of real-time data
- Geen aannames invullen
- Geen optimalisatie of advies
- Geen kostprijs, voorraad of klantniveau
- Alles batch- en document-gedreven
- Delta’s altijd zichtbaar laten bestaan

---

## Bronnen
1. Slachtrendement-uploads (Map1) — batchwaarheid
2. Pakbonnen (Flow Automation) — commerciële waarheid
3. Handmatige SKU → onderdeel mapping (tijdelijk toegestaan)

---

## Datamodel (minimaal)
### batches
- batch_id
- lotnummer
- slachtdatum
- ras (JA757)
- source_document_id

### slaughter_reports
- batch_id
- input_live_kg
- input_count
- cat2_kg
- cat3_kg
- parts_raw (JSON toegestaan)

### batch_parts
- batch_id
- part_code (breast, leg, wing, back, tip, organs, rest)
- weight_kg
- source = slaughter_report

### delivery_notes
- delivery_id
- batch_id (indien koppelbaar)
- sku
- net_weight_kg
- delivery_date

### sku_part_mapping
- sku
- part_code
- confidence (manual / inferred)

---

## Verplichte Views
### v_batch_mass_balance
- input_live_kg
- som(batch_parts.weight_kg)
- cat2_kg
- cat3_kg
- delta_kg (expliciet)

### v_batch_output_vs_pakbon
- technisch output (slachtrapport)
- commercieel output (pakbon)
- verschillen per onderdeel

### v_batch_yield_vs_expectation
- gerealiseerd % per onderdeel
- JA757-verwachtingsband (normerend)
- Ross308 alleen indicatief en gelabeld

---

## UI (minimaal)
### Batch detailpagina
- Massabalans-tabel (leidend)
- Delta-indicator
- Optioneel: Sankey (uitleg, niet leidend)

---

## Definition of Done
- Elke batch sluit of toont expliciete delta
- Alle cijfers herleidbaar tot uploads
- Geen metric zonder bron of label
- Ross308 nergens normerend
- Documentatie bijgewerkt:
  - DATA_CONTRACTS.md
  - KPI_DEFINITIONS.md
- Oplevering met:
  - changelog
  - max. 5 open vragen
  - expliciet niet-gebouwde onderdelen

---

## Claude Loop-instructie
1. Lees DASHBOARD_SCOPE.md en dit document
2. Maak uitvoerplan
3. Bouw
4. Check tegen DoD
5. Update documentatie
6. Rapporteer
7. Stop — niet door naar Sprint 2
