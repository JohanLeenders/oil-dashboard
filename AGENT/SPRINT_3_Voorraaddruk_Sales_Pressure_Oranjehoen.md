
# Sprint 3 — Voorraaddruk & Sales Pressure
## Commercieel Dashboard Oranjehoen (Batch-gedreven)

STATUS: Goedgekeurd  
Datum: 24-01-2026  

---

## Doel van Sprint 3
Inzicht geven in **voorraaddruk en verkoopdruk per anatomisch onderdeel**, altijd herleidbaar tot batches.

Sprint 3:
- signaleert spanningen
- maakt zichtbaar waar actie nodig is
- **stuurt niet**

---

## Niet-onderhandelbare regels
- Voorraad is een afgeleide, geen waarheid
- Alles herleidbaar tot batches
- Geen prijsadvies
- Geen automatische optimalisatie
- Geen klantlogica

---

## Input
- Batches & massabalans (Sprint 1)
- Kostprijs per onderdeel (Sprint 2)
- Historische verkopen
- Huidige voorraadposities

---

## Datamodel (aanvullend)

### inventory_positions
- batch_id
- part_code
- quantity_kg
- location
- snapshot_date

### sales_history
- sale_date
- sku
- part_code
- quantity_kg
- customer_id (nog niet gebruikt)

---

## Verplichte Views

### v_inventory_by_part
- part_code
- total_quantity_kg
- batch_distribution

### v_sales_velocity_by_part
- part_code
- avg_daily_sales_kg
- reference_period

### v_sales_pressure_score
- part_code
- days_sales_inventory (DSI)
- pressure_flag (green/orange/red)
- explanation

---

## UI (minimaal)
### Pressure Board
- Overzicht per onderdeel
- Kleurindicatie (groen/oranje/rood)
- Uitleg per signaal (tekstueel)

---

## Definition of Done
- Druk per onderdeel zichtbaar
- DSI volledig uitlegbaar
- Geen automatische acties
- Documentatie bijgewerkt
- Oplevering bevat changelog + max. 5 open vragen

---

## Claude Loop-instructie
1. Lees scope + Sprint 1–3 documenten
2. Maak uitvoerplan
3. Bouw
4. Check tegen DoD
5. Update documentatie
6. Rapporteer
7. STOP — niet door naar Sprint 4
