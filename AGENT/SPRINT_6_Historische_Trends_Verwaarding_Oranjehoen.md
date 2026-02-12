
# Sprint 6 — Historische Trends & Verwaarding over Tijd
## Commercieel Dashboard Oranjehoen (Lerend systeem)

STATUS: Goedgekeurd  
Datum: 24-01-2026  

---

## Doel van Sprint 6
Inzicht geven in structurele patronen over tijd in:
- verwaarding
- afname
- voorraaddruk
- marges

Sprint 6 maakt Oranjehoen leerbaar, niet voorspellend.

---

## Niet-onderhandelbare regels
- Geen forecasting of voorspellingen
- Geen automatische optimalisatie
- Trends zijn beschrijvend, niet normerend

---

## Input
- Historische batches
- Kostprijzen (Sprint 2)
- Voorraaddruk (Sprint 3)
- Klantafname & margecontext (Sprint 4 & 5)

---

## Datamodel (aanvullend)

### batch_history
- batch_id
- slaughter_date
- season
- key_metrics (JSON)

---

## Verplichte Views

### v_part_trend_over_time
- part_code
- period
- avg_yield
- avg_margin
- avg_dsi

### v_customer_trend_over_time
- customer_id
- period
- avg_alignment
- avg_margin

---

## UI (minimaal)
### Trend dashboards
- Tijdlijn per onderdeel
- Tijdlijn per klant
- Annotaties (bijzondere batches / seizoenen)

---

## Definition of Done
- Trends per onderdeel zichtbaar
- Trends per klant zichtbaar
- Geen voorspellingen
- Documentatie bijgewerkt
- Oplevering bevat changelog + max. 5 open vragen

---

## Claude Loop-instructie
1. Lees Sprint 1–6 documenten
2. Maak uitvoerplan
3. Bouw
4. Check tegen DoD
5. Update documentatie
6. Rapporteer
7. STOP — sprintreeks afgerond
