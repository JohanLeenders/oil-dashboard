# SPRINT_QUEUE.md — Oranjehoen Commercial Dashboard Sprint Backlog

**Version:** 3.1.0
**Status:** ACTIVE — AUTHORITATIVE
**Last Updated:** 2026-02-12
**Source of Truth:** AGENT/SPRINT_*.md contracts

---

## SPRINT STATUS LEGEND
- `DONE` - Completed and verified against contract DoD
- `ACTIVE` - Currently in progress
- `READY` - Next up, no blockers
- `BLOCKED` - Has unresolved dependencies

---

## COMPLETED SPRINTS (1–7)

### Sprint 1 — Batch Massabalans & Carcass Balance
**Status:** DONE
**Completed:** 2026-01-24
**Contract:** AGENT/SPRINT_1_Batch_Massabalans_Oranjehoen.md
**Goal:** Sluitende, uitlegbare massabalans per batch.
**Verification:** npm test PASS (73) | npm build PASS | npm lint PASS

### Sprint 2 — Split-Off & NRV Kostprijsmodel
**Status:** DONE
**Completed:** 2026-01-24
**Contract:** AGENT/SPRINT_2.md
**Goal:** Uitlegbaar, batch-gedreven kostprijsmodel (SVASO + NRV).
**Verification:** npm test PASS (89) | npm build PASS | npm lint PASS

### Sprint 3 — Voorraaddruk & Sales Pressure
**Status:** DONE
**Completed:** 2026-01-24
**Contract:** AGENT/SPRINT_3_Voorraaddruk_Sales_Pressure_Oranjehoen.md
**Goal:** Observationeel dashboard voor voorraaddruk en verkoopdruk.
**Verification:** npm test PASS (117) | npm build PASS | npm lint PASS

### Sprint 4 — Klant-specifieke Vierkantsverwaarding
**Status:** DONE
**Completed:** 2026-01-24
**Contract:** AGENT/SPRINT_4_Klant_Specifieke_Vierkantsverwaarding_Oranjehoen.md
**Goal:** Klantafnameprofielen vs karkasbalans met scenario's.
**Verification:** npm test PASS (207) | npm build PASS | npm lint PASS

### Sprint 5 — Klantafspraken, Marges & Karkascontext
**Status:** DONE
**Completed:** 2026-01-24
**Contract:** AGENT/SPRINT_5_Klantafspraken_Marges_Karkascontext_Oranjehoen.md
**Goal:** Marges per klant in relatie tot karkasafname en afspraken.
**Verification:** npm test PASS (252) | npm build PASS | npm lint PASS

### Sprint 6 — Historische Trends & Verwaarding over Tijd
**Status:** DONE
**Completed:** 2026-01-24
**Contract:** AGENT/SPRINT_6_Historische_Trends_Verwaarding_Oranjehoen.md
**Goal:** Structurele patronen over tijd (beschrijvend, niet voorspellend).
**Verification:** npm test PASS (282) | npm build PASS | npm lint PASS

### Sprint 7 — Canonical Cost Engine & Scenario Layer
**Status:** DONE
**Completed:** 2026-01-24
**Contract:** AGENT/SPRINT_7_Canonical_Cost_Engine_Oranjehoen.md
**Goal:** Geformaliseerd, canoniek kostprijsmodel (SVASO, k-factor, waterval).
**Verification:** npm test PASS (316) | npm build PASS | npm lint PASS

---

## POST-SPRINT WERK (ongenummerd)

### Batch Input v1 — Handmatige Invoer
**Status:** DONE
**Completed:** 2026-01-27 (approx)
**Docs:** docs/batch-input-v1.md
**Goal:** Handmatige invoer van batchgewichten met automatische doorrekening via canonical engine.

---

## ACTIEVE SPRINT QUEUE (8–10)

### Sprint 8 — Canon Alignment Audit & Engine Fix
**Status:** READY (Next)
**Contract:** AGENT/SPRINT_8_Canon_Alignment_Audit_Engine_Fix.md
**Goal:** Verifiëren en fixen dat de rekenlaag 100% aligned is met de canon twee-pager.

**Scope:**
- Regel-voor-regel audit: canon twee-pager vs canonical-cost.ts
- Check 3 joint products (hard), by-product credit €0,20/kg, mini-SVASO, NRV niet-allocerend
- Discrepanties fixen
- Validatiebatch opnieuw doorrekenen
- Audit rapport als deliverable

**STOP after completion** — niet door naar Sprint 9.

---

### Sprint 9 — Data Import Pipeline
**Status:** BLOCKED (wacht op Sprint 8)
**Contract:** AGENT/SPRINT_9_Data_Import_Pipeline.md
**Goal:** Dashboard aansluiten op echte data (PDF, Excel, Exact Online).

**Scope:**
- PDF-parser voor Storteboom slachtrapporten
- Excel/CSV upload voor pakbonnen
- Exact Online koppeling (initieel via export)
- PLU → SKU mapping beheer
- Import audit trail
- Handmatige invoer blijft als fallback

**STOP after completion** — niet door naar Sprint 10.

---

### Sprint 10 — Scenario Engine & Pricing Lab
**Status:** BLOCKED (wacht op Sprint 8 + 9)
**Contract:** AGENT/SPRINT_10_Scenario_Engine_Pricing_Lab.md
**Goal:** Interactieve scenario-omgeving voor prijzen, kosten en klantmix.

**Scope:**
- Prijsvector-scenario's (impact op SVASO, k-factor, kostprijzen)
- Kostenscenario's (impact van gewijzigde tarieven door waterval)
- Mix-scenario's (klantafname impact op karkasbalans)
- Scenario-vergelijking naast basis (actuals)
- Opslaan en hergebruiken van scenario's

**STOP after completion** — sprintreeks afgerond.

---

### Sprint 11A — Scenario Sandbox v1 (Baseline vs Scenario)
**Status:** DESIGNED (wacht op Sprint 7 — DONE; Sprint 8 aanbevolen)
**Contract:** AGENT/SPRINT_11A_Scenario_Sandbox_v1.md
**Goal:** Batch-level what-if sandbox: baseline vs scenario side-by-side.

**Scope:**
- Batch selecteren als baseline → actuele kostenwaterval (L0-L7)
- Override: yields (kg), live cost (€/kg), shadow prices (€/kg)
- Volledige SVASO-herallocatie bij prijswijziging
- Joint cost pool herberekening bij live-kostwijziging
- Massabalans-guardrail (hard block)
- Herberekening op "Run Scenario" knop (niet real-time)
- Opslaan in DB + CSV export
- Scenario-disclaimer op alle sandbox-pagina's

**Depends On:** Sprint 7 (DONE). Sprint 8 aanbevolen maar niet blokkerend.

**STOP after completion** — review nodig.

---

## DEPENDENCIES

| Sprint | Depends On |
|--------|------------|
| Sprint 1 | Database schema, slaughter uploads |
| Sprint 2 | Sprint 1 (batches, mass balance) |
| Sprint 3 | Sprint 1 + Sprint 2 (batches, cost prices) |
| Sprint 4 | Sprint 1 + Sprint 2 + Sprint 3 |
| Sprint 5 | Sprint 1–4 |
| Sprint 6 | Sprint 1–5 |
| Sprint 7 | Sprint 1–6 + Canon document |
| **Sprint 8** | Sprint 7 + Canon twee-pager |
| **Sprint 9** | Sprint 8 (correcte engine) + Voorbeeld-bestanden |
| **Sprint 10** | Sprint 8 + Sprint 9 (echte data) |
| **Sprint 11A** | Sprint 7 (DONE); Sprint 8 aanbevolen |

---

## EXECUTION RULES

1. Execute sprints in order (8 → 9 → 10)
2. STOP after each sprint completion
3. Wait for explicit user instruction before proceeding
4. Check against Definition of Done in contract
5. Update SPRINT_LOG.md after each sprint
6. Canon twee-pager is leidend voor alle rekenlogica

---

## ARCHIVED (OUT-OF-CONTRACT)

> The following sprints were auto-generated and are NOT part of the authoritative contract.
> Code may still exist but is not authorised for further development.

- ~~Customer Profitability View~~ (executed out-of-contract)
- ~~Pricing Impact Simulator~~
- ~~THT Inventory Risk Dashboard~~
- ~~Yield Variance Analysis~~
- ~~Product Mix Analysis~~

---

*This queue is authoritative. Only sprints listed here are authorised for execution.*
