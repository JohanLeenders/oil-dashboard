# SPRINT 7 — Canonical Cost Engine & Scenario Layer
Oranjehoen Commercieel Dashboard
STATUS: Ready for execution
TYPE: Financial Canon Implementation
VOLGT OP: Sprint 1 t/m 6
DATUM: 2026-01-24

## 1. Doel van Sprint 7
Het doel van Sprint 7 is het implementeren van één canonieke, audit-proof kostprijs-engine voor Oranjehoen, gebaseerd op:
- Sales Value at Split-Off (SVASO)
- Net Realizable Value (NRV)
- Yield-gedreven kostprijsvermenigvuldiging
- Strikte scheiding tussen joint en separable costs
- Scenario- en simulatiecapaciteit (dummy pricing)

## 2. Canoniek Referentiedocument (READ-ONLY)
Poultry Cost Accounting Formalization.docx geldt als FINANCIAL CANON.

## 3. Niet-onderhandelbare Principes
Cost object hiërarchie:
Live Batch → Griller → Primal Parts → Secondary Cuts → SKU

Joint vs separable costs strikt afdwingen.
By-products uitsluitend via NRV.

## 4. Functionele Scope
- Canonical cost engine
- SVASO allocatie + k-factor
- Yield cascade
- SKU cost build-up
- Scenario pricing

## 5. Buiten Scope
Geen nieuwe UI flows, klanten, AI, optimalisatie of ESG.

## 6. Technische Implementatie
TypeScript engine in src/lib/engine/canonical-cost
Supabase tabellen & views voor batch, part en SKU valuation.

## 7. Dashboard Deliverables
- Cost waterfall
- Vierkantsverwaarding view
- Sensitivity / scenario view

## 8. Validatie
Minstens één historische batch volledig doorrekenen.

## 9. Definition of Done
- Canonical engine geïmplementeerd
- SVASO & NRV correct
- k-factor zichtbaar
- Yield-verliezen verklaard
- Scenario pricing werkt
- Waterfall zichtbaar

## 10. Stopregel
Na oplevering rapporteren en stoppen.
