
# Sprint 5 — Klantafspraken, Marges & Karkascontext
## Commercieel Dashboard Oranjehoen (Context-gedreven)

STATUS: Goedgekeurd  
Datum: 24-01-2026  

---

## Doel van Sprint 5
Het zichtbaar maken van marges per klant in relatie tot karkasafname en afspraken,
zonder klanten te beoordelen of te rangschikken.

Sprint 5:
- verbindt afnameprofiel aan marge
- maakt afwijkingen uitlegbaar
- ondersteunt commerciële gesprekken

---

## Niet-onderhandelbare regels
- Geen klant-ranking of scoring als oordeel
- Geen automatische prijsaanpassingen
- Geen optimalisatie of afdwinging
- Alles herleidbaar tot batch en onderdeel

---

## Input
- Batches & massabalans (Sprint 1)
- Kostprijzen (Sprint 2)
- Voorraaddruk (Sprint 3)
- Afnameprofielen per klant (Sprint 4)
- Contractuele afspraken (bandbreedtes, volumes)

---

## Datamodel (aanvullend)

### customer_contracts
- customer_id
- part_code
- agreed_share_min
- agreed_share_max
- notes

### customer_margin_context
- customer_id
- part_code
- revenue_eur
- cost_eur
- margin_eur
- margin_explanation

---

## Verplichte Views

### v_customer_margin_by_part
- customer_id
- part_code
- revenue_eur
- cost_eur
- margin_eur

### v_customer_contract_deviation
- customer_id
- part_code
- actual_share
- agreed_range
- deviation_flag
- explanation

---

## UI (minimaal)
### Klantoverzicht
- Afname vs afspraak
- Marge per onderdeel
- Tekstuele uitleg (“waarom deze marge?”)

---

## Definition of Done
- Marges altijd in karkascontext
- Afwijkingen uitlegbaar
- Geen automatische acties
- Documentatie bijgewerkt
- Oplevering bevat changelog + max. 5 open vragen

---

## Claude Loop-instructie
1. Lees Sprint 1–5 documenten
2. Maak uitvoerplan
3. Bouw
4. Check tegen DoD
5. Update documentatie
6. Rapporteer
7. STOP — niet door naar Sprint 6
