
# Sprint 9 — Data Import Pipeline
## Commercieel Dashboard Oranjehoen (Data-gedreven)

STATUS: Goedgekeurd
Datum: 11-02-2026

---

## Doel van Sprint 9
Het dashboard aansluiten op echte data, zodat Oranjehoen met werkelijke cijfers kan werken
in plaats van demo/seed data.

Sprint 9 bouwt de import-infrastructuur voor de drie primaire databronnen:
1. **PDF's van Storteboom** (slachtrendementen, grillergewichten)
2. **Excel/CSV van Storteboom** (pakbonnen, aanvullende data)
3. **Exact Online** (verkoop- en inkoopfacturen)

Daarnaast blijft de handmatige invoer (Batch Input v1) bestaan als fallback.

---

## Niet-onderhandelbare regels
- Geïmporteerde data wordt NOOIT automatisch doorgerekend zonder gebruikersbevestiging
- Append-only principe: imports maken nieuwe records, overschrijven nooit bestaande
- Elke import heeft een audit trail (bron, datum, bestandsnaam, gebruiker)
- Data-validatie bij import: fouten worden getoond, niet stilgezogen
- Mapping van Storteboom PLU-codes naar interne SKU's moet expliciet en controleerbaar zijn
- Geen automatische beslissingen op basis van geïmporteerde data

---

## Bronnen & Formaat

### 1. PDF Storteboom — Slachtrapporten
**Wat:** Rendementsrapporten per batch met gewichten per onderdeel.
**Formaat:** PDF (structuur te bepalen bij eerste echte PDF)
**Frequentie:** Per slachtdag / per batch
**Bevat:** Lotnummer, levend gewicht, grillergewicht, cat2/cat3, deelgewichten
**Import methode:** Upload → PDF parsing → preview → bevestiging → opslag

### 2. Excel/CSV Storteboom — Pakbonnen
**Wat:** Aflevergegevens per levering met SKU's, gewichten, klantcodes.
**Formaat:** Excel (.xlsx) of CSV
**Frequentie:** Per levering
**Bevat:** Leveringsnummer, SKU (Storteboom PLU), netto gewicht, datum, klantcode
**Import methode:** Upload → parsing → mapping preview → bevestiging → opslag

### 3. Exact Online — Facturen
**Wat:** Verkoop- en inkoopfacturen.
**Formaat:** API (via APIcenter of custom connector) OF Excel-export
**Frequentie:** Dagelijks of wekelijks
**Bevat:** Factuurnummer, klant, artikelcode, kg, prijs, datum
**Import methode:** API-sync of upload → mapping → preview → bevestiging → opslag

---

## Datamodel (aanvullend)

### import_logs
- import_id (PK)
- import_type (pdf_slaughter / excel_pakbon / exact_online / manual)
- source_filename
- import_date
- imported_by
- record_count
- status (pending / validated / imported / error)
- error_details (JSONB, nullable)
- audit_trail (JSONB)

### import_mapping_rules
- rule_id (PK)
- source_type (storteboom_plu / exact_itemcode)
- source_code
- target_sku
- target_part_code
- confidence (manual / verified / inferred)
- created_date
- notes

---

## Functionele Eisen

### PDF Parser
- Upload PDF via UI
- Extraheer relevante velden (lot, gewichten, rendementen)
- Toon preview met geëxtraheerde waarden
- Gebruiker bevestigt of corrigeert waarden
- Bij bevestiging: schrijf naar slaughter_reports tabel
- Log import in import_logs

### Excel/CSV Parser
- Upload Excel of CSV via UI
- Detecteer kolommen automatisch (of laat gebruiker mappen)
- Toon preview van eerste N rijen met mapping
- Storteboom PLU → interne SKU mapping tonen
- Onbekende PLU's markeren (niet stilzwijgend overslaan)
- Bij bevestiging: schrijf naar delivery_notes tabel
- Log import in import_logs

### Exact Online Koppeling
- Initiële scope: Excel-export import (laagste complexiteit)
- Toekomstig: directe API-koppeling (buiten Sprint 9 scope tenzij eenvoudig)
- Factuurnummers matchen met bestaande sales_transactions
- Nieuwe records aanmaken, bestaande NIET overschrijven

### Mapping Beheer
- UI-scherm voor PLU → SKU mapping regels
- Overzicht van huidige mappings
- Mogelijkheid om onbekende codes te mappen
- Confidence-levels zichtbaar

---

## UI (minimaal)

### Import Dashboard (/oil/import)
- Overzicht recente imports (datum, type, status, aantal records)
- Upload knop per brontype
- Link naar mapping beheer

### Upload Flow
- Stap 1: Bestand selecteren
- Stap 2: Preview van geëxtraheerde data
- Stap 3: Mapping review (bij PLU/artikelcode conversie)
- Stap 4: Bevestiging
- Stap 5: Resultaat (succes + aantal records / fouten)

### Mapping Beheer (/oil/import/mappings)
- Tabel met alle PLU → SKU regels
- Filter op brontype
- Actie: nieuwe mapping toevoegen, bestaande wijzigen

---

## Definition of Done
- PDF upload en parsing werkt voor Storteboom slachtrapporten
- Excel/CSV upload werkt voor pakbonnen
- Exact Online data importeerbaar (minimaal via Excel-export)
- Alle imports hebben audit trail in import_logs
- PLU → SKU mapping beheerbaar via UI
- Onbekende codes worden getoond, niet overgeslagen
- Preview + bevestigingsstap bij elke import
- Append-only: geen bestaande records overschreven
- npm test PASS
- npm run build PASS
- npm run lint PASS
- Documentatie bijgewerkt:
  - DATA_CONTRACTS.md
  - Oplevering bevat changelog + max. 5 open vragen

---

## Afhankelijkheden
- Sprint 8 (Canon Alignment) moet eerst afgerond zijn
- Storteboom PDF voorbeeld nodig voor parser-ontwikkeling
- Storteboom Excel voorbeeld nodig voor kolomdetectie
- Exact Online toegang of voorbeeld-export nodig

---

## Claude Loop-instructie
1. Lees Sprint 1–8 documenten
2. Bekijk bestaande sku_part_mapping en technical_definitions
3. Vraag om voorbeeld-bestanden indien niet aanwezig
4. Maak uitvoerplan
5. Bouw import-infrastructuur
6. Test met beschikbare data
7. Check tegen DoD
8. Update documentatie
9. Rapporteer
10. STOP — niet door naar Sprint 10
