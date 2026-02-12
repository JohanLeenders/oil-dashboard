
# Sprint 8 — Canon Alignment Audit & Engine Fix
## Commercieel Dashboard Oranjehoen (Verificatie-gedreven)

STATUS: Goedgekeurd
Datum: 11-02-2026

---

## Doel van Sprint 8
Verifiëren dat de huidige rekenlaag (`canonical-cost.ts` en gerelateerde engine modules)
**100% aligned** is met het canonieke kostprijsmodel zoals vastgelegd in:
- `AGENT/oil_costing_model_canon_two_pager.md` (definitief)
- `AGENT/CANON_Poultry_Cost_Accounting.md` (formalisatie)

Discrepanties worden gedocumenteerd en gefixed. Na Sprint 8 is de engine
**de digitale vertaling van de canon** — niet meer, niet minder.

---

## Niet-onderhandelbare regels
- De canon twee-pager is leidend, niet de code
- Elke afwijking tussen code en canon moet expliciet gedocumenteerd worden
- Fixes mogen geen bestaande correcte logica breken (regressievrij)
- Geen nieuwe features toevoegen — alleen alignen en fixen
- Validatiebatch moet opnieuw exact doorrekenen na fixes

---

## Scope: Wat moet gecontroleerd en (indien nodig) gefixed worden

### 1. Joint Products (harde scope)
**Canon zegt:** Uitsluitend 3 joint products: Borstkap, Bouten, Vleugels.
**Check:** Draagt de engine kosten toe aan PRECIES deze 3? Geen ander product mag joint cost dragen.

### 2. By-products (Route A)
**Canon zegt:** Alle overige stromen zijn by-products. Vaste opbrengst €0,20/kg.
Credit wordt verrekend VÓÓR SVASO-toerekening.
**Check:**
- C_netto_joint = C_joint − opbrengst_by_products
- By-product credit op €0,20/kg (niet variabel)
- Credit vóór allocatie, niet erna

### 3. SVASO-allocatie
**Canon zegt:** Verdeling op basis van shadow prices (afgeleid uit downstream opbrengsten en yields).
Geen marktprijzen. Geen fysieke (gewicht) allocatie.
**Check:** Gebruikt de engine shadow prices of marktprijzen? Dit is een cruciaal verschil.

### 4. Mini-SVASO (sub-joint verdeling)
**Canon zegt:**
- Borstkap → 100% naar filet (rest is kostloos, al gecrediteerd)
- Bouten → dijfilet & drumvlees op basis van relatieve waarde
**Check:** Implementeert de engine deze exacte logica?

### 5. ABC-kosten (Activity Based Costing)
**Canon zegt:** Altijd additief, per SKU, herverdelen NOOIT joint costs.
**Check:** Worden ABC-kosten correct opgeteld zonder joint cost te herbeginen?

### 6. NRV als beslissingslaag
**Canon zegt:** NRV = verkoopprijs − downstream kosten. NRV mag NOOIT alloceren of kostprijzen aanpassen.
**Check:** Wordt NRV ergens gebruikt om kosten te alloceren? Zo ja: fixen.

### 7. Rekenlagen (waterval)
**Canon zegt:** 8 expliciete levels (0-7):
0. Input & biologie
1. Joint cost pool
2. By-product credit
3. SVASO allocatie
4. Mini-SVASO
5. ABC-kosten
6. Full cost per SKU (= de echte kostprijs)
7. NRV (read-only)

**Check:** Matcht de engine deze exacte volgorde en nummering?

### 8. k-factor
**Canon zegt:** k = batch_cost / total_market_value. k < 1 = winstgevend.
**Check:** Is de k-factor berekening correct en consistent door alle levels heen?

---

## Deliverables

### 1. Audit Rapport
Een document (`AGENT/SPRINT_8_AUDIT_REPORT.md`) met:
- Per canonpunt: CODE MATCHES / DISCREPANCY FOUND
- Bij discrepancy: wat de code doet vs. wat de canon zegt
- Aanbevolen fix

### 2. Engine Fixes
Aanpassingen in `src/lib/engine/` om discrepanties op te lossen.

### 3. Validatiebatch Doorrekening
De validatiebatch (VALIDATIE-2025-09-22) opnieuw doorrekenen met de gefixte engine.
Resultaten documenteren en vergelijken met verwachte waarden uit `docs/batch-input-v1.md`.

### 4. Test Updates
Alle bestaande tests moeten slagen. Nieuwe tests voor elke fix.

---

## Input
- `AGENT/oil_costing_model_canon_two_pager.md`
- `AGENT/CANON_Poultry_Cost_Accounting.md`
- `src/lib/engine/canonical-cost.ts`
- `src/lib/engine/canonical-cost.test.ts`
- Alle overige engine modules in `src/lib/engine/`
- `docs/batch-input-v1.md` (validatiewaarden)

---

## Definition of Done
- Audit rapport compleet met bevinding per canonpunt
- Alle discrepanties gedocumenteerd EN gefixed
- 3 joint products hard afgedwongen (geen ander product draagt joint cost)
- By-product credit @ €0,20/kg correct geïmplementeerd
- Mini-SVASO correct (borst → 100% filet, bout → dij + drum op waarde)
- NRV nergens allocerend
- Rekenlagen matchen canon volgorde (0-7)
- Validatiebatch doorgerekend en gedocumenteerd
- npm test PASS
- npm run build PASS
- npm run lint PASS
- Geen regressie in bestaande functionaliteit

---

## Claude Loop-instructie
1. Lees canon twee-pager en CANON_Poultry_Cost_Accounting.md
2. Lees alle engine code
3. Maak audit rapport (punt voor punt)
4. Fix discrepanties
5. Herbereken validatiebatch
6. Update tests
7. Check tegen DoD
8. Rapporteer
9. STOP — niet door naar Sprint 9
