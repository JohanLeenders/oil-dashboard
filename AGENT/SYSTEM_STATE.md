# SYSTEM_STATE.md — Oranjehoen Commercial Dashboard

**Version:** 1.3.1
**Last Updated:** 2026-02-19
**Updated By:** OIL Order Module — Wave 1 Migration Gate (Phase 1)

---

## How to Start an Orchestration Session

Before any sprint work, follow the **Session Start Checklist** in:

> **[docs/ORCHESTRATOR_START_PROTOCOL.md](../docs/ORCHESTRATOR_START_PROTOCOL.md)**

This protocol applies to both Claude Desktop and Claude CLI. It defines canon priority order, non-negotiable rails, agent roles, and the mandatory validation gates.

---

## Governance Contracts

The governance triangle that governs all sprint work:

| Contract | File | Purpose |
|----------|------|---------|
| **Canon** | [AGENT_RULES.md](./AGENT_RULES.md) | Non-negotiable business logic rails |
| **Orchestration** | [docs/ORCHESTRATOR_START_PROTOCOL.md](../docs/ORCHESTRATOR_START_PROTOCOL.md) | How sessions start and operate |
| **Completion** | [docs/UNIFIED_DEFINITION_OF_DONE.md](../docs/UNIFIED_DEFINITION_OF_DONE.md) | When a sprint is DONE |

---

## 1. ENVIRONMENT

| Key | Value |
|-----|-------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict mode) |
| Database | Supabase (PostgreSQL) |
| Project Ref | `ysjdotnnzhwjzhjkugol` |
| Charting | Visx |
| Precision Math | Decimal.js |
| Dev Port | 3002 |
| Node Version | ≥18 |

---

## 2. SCHEMA STATUS

**Total migrations:** 120 (all applied ✅)
**Migration Gate:** ✅ Verified 2026-02-19 14:34 — `supabase db push` succeeded, 4 tables + 3 enums confirmed on remote DB via REST API
**Migration range:** `20260124100000` → `20260219100000`

### Core Tables

| Table | Migration | Status | Notes |
|-------|-----------|--------|-------|
| production_batches | 001-010 | ✅ Applied | Master batch record |
| batch_yields | 011-020 | ✅ Applied | Append-only cut-up yields |
| slaughter_reports | 021-030 | ✅ Applied | Raw Map1 data |
| delivery_notes | 031-040 | ✅ Applied | Pakbon data |
| joint_costs | 041-050 | ✅ Applied | Live bird purchase costs |
| processing_costs | 090 | ✅ Applied | Post-split-off costs |
| sku_part_mapping | 086 | ✅ Applied | SKU → anatomical part |
| inventory_positions | 051-060 | ✅ Applied | Snapshot-based inventory |
| elasticity_assumptions | 071-080 | ✅ Applied | Scenario assumptions |
| customer_contracts | 104 | ✅ Applied | Agreed part share ranges |
| customer_margin_context | 081-085 | ✅ Applied | Precomputed margin context |
| std_prices | 112 | ✅ Applied | SVASO allocation price vectors |
| cost_drivers | 113 | ✅ Applied | Operational cost definitions |
| price_scenarios | 117 | ✅ Applied | What-if price simulations |
| sandbox_scenarios | 20260212210000 | ✅ Applied | Scenario sandbox storage |
| slaughter_calendar | 20260219100000 | ✅ Applied | Order module: planned slaughter dates |
| customer_orders | 20260219100000 | ✅ Applied | Order module: orders per customer per slaughter |
| order_lines | 20260219100000 | ✅ Applied | Order module: order line items |
| order_schema_snapshots | 20260219100000 | ✅ Applied | Order module: append-only formalized schemas |

### Key Views

| View | Status | Sprint |
|------|--------|--------|
| v_batch_mass_balance | ✅ | 1 |
| v_effective_batch_yields | ✅ | 1 |
| v_batch_output_vs_pakbon | ✅ | 1 |
| v_batch_yield_vs_expectation | ✅ | 1 |
| v_batch_splitoff_allocation | ✅ | 2 |
| v_batch_part_cost | ✅ | 2 |
| v_batch_nrv_by_sku | ✅ | 2 |
| v_sales_pressure_score | ✅ | 3 |
| v_customer_intake_profile | ✅ | 4 |
| v_customer_carcass_alignment | ✅ | 4 |
| v_scenario_impact | ✅ | 4 |
| v_customer_margin_by_part | ✅ | 5 |
| v_customer_contract_deviation | ✅ | 5 |
| v_part_trend_over_time | ✅ | 6 |
| v_cost_waterfall | ✅ | 7 |

---

## 3. SPRINT STATUS

| Sprint | Name | Status | Tests | Build |
|--------|------|--------|-------|-------|
| 1 | Batch Massabalans | ✅ DONE | 73 pass | ✅ |
| 2 | Split-Off & NRV Kostprijsmodel | ✅ DONE | 89 pass | ✅ |
| 3 | Voorraaddruk & Sales Pressure | ✅ DONE | 117 pass | ✅ |
| 4 | Klant-specifieke Vierkantsverwaarding | ✅ DONE | 207 pass | ✅ |
| 5 | Klantafspraken, Marges & Karkascontext | ✅ DONE | 252 pass | ✅ |
| 6 | Historische Trends & Verwaarding | ✅ DONE | 282 pass | ✅ |
| 7 | Canonical Cost Engine & Scenario Layer | ✅ DONE | 316 pass | ✅ |
| — | Batch Input v1 (post-sprint) | ✅ DONE | — | ✅ |
| 8 | Canon Alignment Audit & Engine Fix | ✅ DONE | — | ✅ |
| 9 | Data Import Pipeline | 🔜 READY | — | — |
| 10 | Scenario Engine & Pricing Lab | ⏸ BLOCKED (→9) | — | — |
| 11A | Scenario Sandbox v1 (Baseline vs Scenario) | ✅ DONE | 382 pass | ✅ |
| 11B | Process Chain Editor v1 | 📐 DESIGNED | — | — |
| **OM-W1** | **Order Module Wave 1 (Schema + Nav + QA)** | **✅ DONE** | **521 pass** | **✅** |

---

## 4. APPLICATION ROUTES

| Route | Purpose | Data Source | Status |
|-------|---------|-------------|--------|
| `/oil` | Dashboard overview | Multiple views | ✅ Active |
| `/oil/batches` | Batch list + THT status | v_batch_mass_balance | ✅ Active |
| `/oil/batches/[id]` | Batch detail + yield breakdown | v_effective_batch_yields | ✅ Active |
| `/oil/batches/[id]/cost-price` | Cost price per batch | v_batch_part_cost | ✅ Active |
| `/oil/batch-input` | Manual batch entry | Form → production_batches | ✅ Active |
| `/oil/batch-input/new` | New batch form | — | ✅ Active |
| `/oil/customers` | Customer list | v_customer_intake_profile | ✅ Active |
| `/oil/customers/[id]` | Customer detail + alignment | v_customer_carcass_alignment | ✅ Active |
| `/oil/cost-waterfall` | Cost waterfall chart | v_cost_waterfall | ✅ Active |
| `/oil/cost-waterfall-v2` | Cost waterfall v2 | v_cost_waterfall | ✅ Active |
| `/oil/margins` | Margin analysis | v_customer_margin_by_part | ✅ Active |
| `/oil/pressure` | Voorraaddruk (inventory pressure) | v_sales_pressure_score | ✅ Active |
| `/oil/trends` | Historical trends | v_part_trend_over_time | ✅ Active |
| `/oil/alignment` | Carcass alignment | v_customer_carcass_alignment | ✅ Active |
| `/oil/batches/[id]/sandbox` | Scenario sandbox (baseline vs scenario) | Canonical engine wrapper | ✅ Active |
| `/oil/planning` | Slaughter calendar & availability planning | slaughter_calendar (future) | 🔧 Placeholder |
| `/oil/orders` | Order management & bestelschema | customer_orders (future) | 🔧 Placeholder |

---

## 5. MIGRATION FIXES APPLIED

During schema bootstrap (2026-02-12), the following migrations required fixes:

| Migration | Issue | Fix |
|-----------|-------|-----|
| 086 | `set_updated_at()` → function doesn't exist | Changed to `update_updated_at()` |
| 090 | Same trigger function name issue | Changed to `update_updated_at()` |
| 087 | UNION type mismatch (enum vs text) | Added `::text` cast |
| 088-117 | COMMENT ON in prepared statements | Removed all COMMENT ON statements (32 files) |
| 102 | text = anatomical_part enum JOIN | Added `::text` cast |
| 104 | CURRENT_DATE in partial index (not IMMUTABLE) | Simplified WHERE clause |
| 107 | varchar = enum JOIN mismatch | Added `::text` cast |
| 109 | Multiple enum-text COALESCE/JOIN mismatches | Added 3× `::text` casts |
| 112 | CHECK constraint blocks negative by-product prices | Removed CHECK constraint |
| 20260219100000 | `WHERE status != 'cancelled'::slaughter_status` — invalid enum value in partial index | Changed to plain unique index on `slaughter_date` (commit `8fcd8d9`) |

---

## 6. KNOWN ISSUES

### 6.1 Code Quality
- **17× `as any` TypeScript assertions** — Need proper Supabase types (Fase 2)
- ~~No git repository~~ → Git initialized, baseline commit `5408817` ✅

### 6.2 Data
- **Empty database** — Schema applied but no seed data loaded
- **No real data imports** — Waiting for Sprint 9 (data import pipeline)

### 6.3 UX (Fixed 2026-02-12)
- ~~No loading.tsx files~~ → Added for all 10 route directories ✅
- ~~No error.tsx files~~ → Added error boundary at /oil level ✅

---

## 7. LOCKED VALUES

These values are IMMUTABLE without explicit user override:

| Parameter | Value | Source |
|-----------|-------|--------|
| THT Green | < 70% elapsed | Blueprint Spec |
| THT Orange | 70-90% elapsed | Blueprint Spec |
| THT Red | > 90% elapsed | Blueprint Spec |
| DSI Green | < 14 days | Sprint 3 Contract |
| DSI Orange | 14-28 days | Sprint 3 Contract |
| DSI Red | > 28 days | Sprint 3 Contract |
| Cherry-picker threshold | Filet > 30% | AGENT_RULES.md |
| Cherry-picker revenue floor | €10,000 YTD | AGENT_RULES.md |
| Carcass reference | JA757 (Hubbard) | NORMATIVE |
| By-product credit | €0.20/kg | Canon twee-pager |
| Allocation method | SVASO (NOT weight) | Canon twee-pager |
| **Engine Canon Lock** | **2026-02-12** | **Sprint 8 Complete (3543059)** |

**Note:** The canonical cost engine (Levels 0-7) was verified 100% canon-compliant on 2026-02-12 and is now canon-locked. All 8 canon rules validated PASS. See `AGENT/SPRINT_8_CANON_VALIDATION_RESULTS.md` for details.

---

*This document is updated after each sprint and significant system change.*
