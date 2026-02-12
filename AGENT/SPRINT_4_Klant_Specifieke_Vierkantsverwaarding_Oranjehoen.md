
# Sprint 4 — Klant-specifieke Vierkantsverwaarding
## Commercieel Dashboard Oranjehoen (Scenario-gedreven)

STATUS: Goedgekeurd  
Datum: 24-01-2026  

---

## Doel van Sprint 4
Inzicht geven in hoe **klantafnameprofielen bijdragen aan of afwijken van de karkasbalans**, inclusief scenario’s voor prijselasticiteit.

Sprint 4:
- maakt spanningen zichtbaar
- laat scenario’s zien
- **neemt geen beslissingen**

---

## Niet-onderhandelbare regels
- Geen automatische prijsacties
- Scenario’s zijn aannames, geen waarheid
- Alles herleidbaar tot batch en onderdeel
- Geen klant-ranking of scoring als oordeel

---

## Input
- Batches & massabalans (Sprint 1)
- Kostprijzen (Sprint 2)
- Voorraaddruk (Sprint 3)
- Verkoopdata per klant

---

## Datamodel (aanvullend)

### customer_sales
- customer_id
- sale_date
- sku
- part_code
- quantity_kg
- batch_id (indien bekend)

### elasticity_assumptions
- scenario_id
- part_code
- price_change_pct
- expected_volume_change_pct
- source/assumption_note

---

## Verplichte Views

### v_customer_intake_profile
- customer_id
- part_code
- quantity_kg
- share_of_total

### v_customer_carcass_alignment
- customer_id
- alignment_score
- deviation_by_part

### v_scenario_impact
- scenario_id
- part_code
- projected_volume_change
- impact_on_balance

---

## UI (minimaal)
### Klantdetail
- Afnameprofiel vs batchprofiel
- Alignment visualisatie
- Scenario toggle (“wat als…”)

---

## Definition of Done
- Afnameprofielen per klant zichtbaar
- Alignment uitlegbaar
- Scenario’s duidelijk gelabeld als aanname
- Geen automatische acties
- Documentatie bijgewerkt
- Oplevering bevat changelog + max. 5 open vragen

---

## Claude Loop-instructie
1. Lees scope + Sprint 1–4 documenten
2. Maak uitvoerplan
3. Bouw
4. Check tegen DoD
5. Update documentatie
6. Rapporteer
7. STOP — sprintreeks afgerond
