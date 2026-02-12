# Sprint 2 — Split-Off & NRV Kostprijsmodel
## Commercieel Dashboard Oranjehoen (Batch-gedreven)

STATUS: Goedgekeurd
Datum: 24-01-2026

---

## Doel van Sprint 2
Het bouwen van een uitlegbaar, batch-gedreven kostprijsmodel op basis van:
- Joint cost (inkoop levende kip per batch)
- Sales Value at Split-Off
- Net Realizable Value (NRV) voor verdere verwerking

Zonder:
- prijsstrategie
- automatische prijsadviezen
- voorraadsturing
- klantsturing

Sprint 2 verklaart kostprijzen — het neemt GEEN beslissingen.

---

## Niet-onderhandelbare regels
- Joint cost = uitsluitend inkoop levende kip (per batch)
- Split-off point ligt vóór verdere verwerking
- Allocatie uitsluitend via Sales Value at Split-Off
- NRV alleen toepassen ná split-off
- Geen gewicht- of normallocaties
- Geen prijssturing
- Geen optimalisatie
- Alles herleidbaar tot batch

---

## Bronnen
- Batches & massabalans (Sprint 1)
- Inkoop levende kip (batch)
- Verwerkingstarieven (handmatig / Activity Based Costing)
- Verkoopprijzen (referentie, uitlegbaar)

---

## Datamodel (aanvullend op Sprint 1)

### joint_costs
- batch_id
- cost_type = 'live_bird_purchase'
- amount_eur

### processing_costs
- process_step (cutting, vacuum, portioning, packaging)
- cost_per_kg
- source (ABC / contract)

### batch_splitoff_values
- batch_id
- part_code
- sales_value_eur

---

## Verplichte Views

### v_batch_splitoff_allocation
- batch_id
- part_code
- sales_value_eur
- allocation_percentage
- allocated_joint_cost_eur

### v_batch_part_cost
- batch_id
- part_code
- allocated_joint_cost_eur
- cost_per_kg

### v_batch_nrv_by_sku
- batch_id
- sku
- part_code
- allocated_joint_cost_eur
- extra_processing_cost_eur
- nrv_cost_eur

---

## UI (minimaal)

### Kostprijs detail (batch / onderdeel / SKU)
Moet tonen:
- joint cost (batch)
- allocatie via split-off
- extra verwerkingskosten
- resulterende kostprijs
- tekstuele uitleg per stap:
  batch → joint cost → split-off → NRV

---

## Definition of Done
- Kostprijs per onderdeel is volledig herleidbaar tot batch
- Allocatie uitsluitend via Sales Value at Split-Off
- NRV transparant en uitlegbaar opgebouwd
- Geen prijsadvies of optimalisatie
- Documentatie bijgewerkt:
  - DATA_CONTRACTS.md
  - KPI_DEFINITIONS.md
- Oplevering bevat:
  - changelog
  - maximaal 5 open vragen
  - expliciet wat NIET is gebouwd

---

## Claude Loop-instructie
1. Lees DASHBOARD_SCOPE.md
2. Lees Sprint 1 & Sprint 2 documenten
3. Maak uitvoerplan
4. Bouw
5. Controleer tegen Definition of Done
6. Update documentatie
7. Rapporteer
8. STOP — ga niet door naar Sprint 3
