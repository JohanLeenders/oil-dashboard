# DATA_CONTRACTS.md — Oranjehoen Commercial Dashboard

**Version:** 7.0.0 (Sprint 7)
**Status:** AUTHORITATIVE
**Last Updated:** 2026-01-24

---

## 1. DATA SOURCES

### 1.1 Slachtrendement-uploads (Map1)
**Type:** Batch Truth
**Format:** Excel/CSV uploads from Storteboom
**Frequency:** Per production batch
**Stored in:** `slaughter_reports` table

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| input_live_kg | DECIMAL | Live weight input | Storteboom report |
| input_count | INTEGER | Number of birds | Storteboom report |
| cat2_kg | DECIMAL | Category 2 losses | Storteboom report |
| cat3_kg | DECIMAL | Category 3 losses | Storteboom report |
| parts_raw | JSONB | Raw parts breakdown | Storteboom report |

### 1.2 Pakbonnen (Flow Automation)
**Type:** Commercial Truth
**Format:** Automated sync from Flow Automation
**Frequency:** Per delivery
**Stored in:** `delivery_notes` table

| Field | Type | Description | Source |
|-------|------|-------------|--------|
| delivery_number | TEXT | Pakbon number | Flow Automation |
| sku | TEXT | Product SKU | Flow Automation |
| net_weight_kg | DECIMAL | Net weight shipped | Flow Automation |
| delivery_date | DATE | Delivery date | Flow Automation |

### 1.3 SKU → Part Mapping
**Type:** Manual Mapping (temporary)
**Format:** User-entered or inferred
**Stored in:** `sku_part_mapping` table

| Field | Type | Description |
|-------|------|-------------|
| sku | TEXT | Commercial SKU code |
| part_code | TEXT | Anatomical part code |
| confidence | TEXT | manual / inferred / verified |

---

## 2. CORE TABLES

### 2.1 production_batches
**Purpose:** Master batch record
**Source:** Created from slaughter reports

```sql
production_batches
├── batch_ref (UNIQUE) -- Lot number
├── slaughter_date
├── live_weight_kg
├── bird_count
├── griller_weight_kg
├── griller_yield_pct (GENERATED)
├── rejection_kg
├── slaughter_waste_kg
├── production_date
├── expiry_date
└── status (planned|slaughtered|cut_up|in_sales|closed)
```

### 2.2 batch_yields
**Purpose:** Cut-up yield records per anatomical part
**Source:** Derived from slaughter reports
**Pattern:** APPEND-ONLY with correction references

```sql
batch_yields
├── batch_id (FK)
├── anatomical_part (breast_cap|leg_quarter|wings|back_carcass|offal)
├── actual_weight_kg
├── yield_pct
├── target_yield_min/max
├── delta_from_target
├── is_correction (BOOLEAN)
└── corrects_yield_id (FK to original record)
```

### 2.3 slaughter_reports (Sprint 1)
**Purpose:** Raw slaughter report data
**Source:** Map1 uploads
**New in Sprint 1**

```sql
slaughter_reports
├── batch_id (FK)
├── source_document_id
├── input_live_kg
├── input_count
├── cat2_kg
├── cat3_kg
└── parts_raw (JSONB)
```

### 2.4 delivery_notes (Sprint 1)
**Purpose:** Pakbon (delivery note) data
**Source:** Flow Automation
**New in Sprint 1**

```sql
delivery_notes
├── batch_id (FK, nullable)
├── delivery_number
├── sku
├── net_weight_kg
├── delivery_date
└── customer_code
```

---

## 3. VIEWS

### 3.1 v_batch_mass_balance
**Purpose:** Consolidated mass balance per batch
**Source:** production_batches + v_effective_batch_yields
**Data Status:** COMPLETE | NEEDS_REVIEW | HAS_CORRECTIONS

```sql
v_batch_mass_balance
├── source_live_weight
├── loss_rejection
├── loss_slaughter
├── node_griller
├── node_breast_cap
├── node_leg_quarter
├── node_wings
├── node_back_carcass
├── node_offal
├── loss_unaccounted (DELTA)
└── data_status
```

### 3.2 v_effective_batch_yields
**Purpose:** Resolved yields (corrections applied)
**Pattern:** Shows latest non-superseded record per part

### 3.3 v_batch_output_vs_pakbon (Sprint 1)
**Purpose:** Technical output vs commercial output
**Comparison:** Slaughter report parts vs pakbon deliveries

```sql
v_batch_output_vs_pakbon
├── technical_weight_kg (from yields)
├── commercial_weight_kg (from pakbon)
├── delta_kg
└── delta_pct
```

### 3.4 v_batch_yield_vs_expectation (Sprint 1)
**Purpose:** Realized yield vs expectation bands
**Normative:** JA757 (Hubbard spec)
**Indicative:** Ross308 (labeled as such)

```sql
v_batch_yield_vs_expectation
├── realized_yield_pct
├── ja757_min_pct (NORMATIVE)
├── ja757_max_pct (NORMATIVE)
├── delta_from_ja757_pct
├── ross308_indicative_min_pct (INDICATIVE ONLY)
└── ross308_usage_label = 'INDICATIVE_ONLY'
```

---

## 4. DATA QUALITY RULES

### 4.1 Mass Balance Validation
- Level 1: Live = Griller + Rejection + Slaughter Waste (±2% tolerance)
- Level 2: Griller = Sum(Parts) + Unaccounted (flag if >5%)
- All 5 anatomical parts expected

### 4.2 Append-Only Pattern
- NO updates to batch_yields records
- Corrections create NEW record with `is_correction=true`
- Original record remains for audit trail

### 4.3 Source Traceability
- Every metric must have a source label
- No metric displayed without traceable origin
- Delta values always visible (never hidden)

---

## 5. SPRINT 2 — Split-Off & NRV Kostprijsmodel

### 5.1 joint_costs (Sprint 2)
**Purpose:** Joint costs per batch
**Constraint:** ONLY `live_bird_purchase` per Sprint 2 contract

```sql
joint_costs
├── batch_id (FK)
├── cost_type = 'live_bird_purchase' (ONLY VALUE ALLOWED)
├── amount_eur
├── cost_per_kg
├── cost_per_bird
├── invoice_ref
├── invoice_date
└── supplier
```

### 5.2 processing_costs (Sprint 2)
**Purpose:** Processing costs applied AFTER split-off
**Usage:** Added to NRV calculation, NOT part of joint cost

```sql
processing_costs
├── process_step (cutting|vacuum|portioning|packaging|other)
├── cost_per_kg
├── applies_to_part_code (NULL = all parts)
├── applies_to_sku (NULL = all SKUs)
├── source (manual|abc|contract)
├── valid_from
└── valid_until
```

### 5.3 batch_splitoff_values (Sprint 2)
**Purpose:** Sales Value at Split-Off per batch/part
**Usage:** SVASO allocation (NOT weight-based)

```sql
batch_splitoff_values
├── batch_id (FK)
├── part_code
├── sales_value_eur (= weight_kg × price_per_kg)
├── weight_kg
├── price_per_kg
├── price_source (market_benchmark|contract|manual)
└── price_reference_date
```

---

## 6. SPRINT 2 VIEWS

### 6.1 v_batch_splitoff_allocation
**Purpose:** Joint cost allocation via Sales Value at Split-Off
**Method:** SVASO (NO weight-based allocation)

```sql
v_batch_splitoff_allocation
├── part_code
├── weight_kg
├── price_per_kg
├── sales_value_eur
├── total_sales_value_eur
├── allocation_pct (= sales_value / total × 100)
├── batch_joint_cost_eur
├── allocated_joint_cost_eur
└── allocation_factor (must sum to 1.0 per batch)
```

### 6.2 v_batch_part_cost
**Purpose:** Cost per kg at split-off point
**Formula:** `cost_per_kg_splitoff = allocated_joint_cost / weight_kg`

```sql
v_batch_part_cost
├── part_code
├── weight_kg
├── allocated_joint_cost_eur
├── cost_per_kg_splitoff
├── market_price_per_kg (for transparency)
└── validation_status (OK|INVALID_WEIGHT|NO_COST_ALLOCATED)
```

### 6.3 v_batch_nrv_by_sku
**Purpose:** Net Realizable Value cost per SKU
**Formula:** `nrv_cost_per_kg = cost_per_kg_splitoff + extra_processing_cost_per_kg`

```sql
v_batch_nrv_by_sku
├── sku
├── part_code
├── allocated_joint_cost_eur
├── cost_per_kg_splitoff
├── extra_processing_cost_per_kg
├── nrv_cost_per_kg
├── nrv_total_eur
├── allocation_method = 'SVASO'
└── costing_method = 'NRV'
```

---

## 7. SPRINT 2 CONSTRAINTS

### 7.1 Cost Allocation Rules
- Joint cost = ONLY live bird purchase (no other cost types)
- Allocation = ONLY via Sales Value at Split-Off (SVASO)
- NO weight-based allocation
- Allocation factors MUST sum to 1.0 per batch

### 7.2 NRV Calculation
- NRV = Allocated Joint Cost + Processing Costs
- Processing costs applied AFTER split-off
- Processing costs matched by part_code and/or sku

### 7.3 Not in Scope (Sprint 2)
- Price advice or optimization
- Inventory valuation
- Customer margin analysis
- Target costing

---

## 8. SPRINT 3 — Voorraaddruk & Sales Pressure

### 8.1 inventory_positions (Sprint 3)
**Purpose:** Inventory snapshots per batch/part
**Constraint:** OBSERVATIONAL ONLY - no actions

```sql
inventory_positions
├── batch_id (FK)
├── part_code
├── quantity_kg
├── location
├── snapshot_date
├── snapshot_timestamp
├── source (manual|system_sync|calculated)
├── notes
└── created_at
```

---

## 9. SPRINT 3 VIEWS

### 9.1 v_sales_by_part
**Purpose:** Sales transactions with part_code for velocity calculations
**Source:** sales_transactions + products

```sql
v_sales_by_part
├── sale_date
├── sku
├── part_code (from product.anatomical_part)
├── quantity_kg
├── customer_id
└── batch_id
```

### 9.2 v_inventory_by_part
**Purpose:** Current inventory per anatomical part
**Source:** inventory_positions (latest snapshot per batch/part)

```sql
v_inventory_by_part
├── part_code
├── total_quantity_kg
├── batch_count
├── latest_snapshot_date
├── batch_distribution (JSONB, sorted by expiry)
└── data_status (OK|NO_DATA|ZERO_STOCK)
```

### 9.3 v_sales_velocity_by_part
**Purpose:** Average daily sales per part
**Reference Period:** 30 days (primary), 90 days (smoothed), 7 days (trend)

```sql
v_sales_velocity_by_part
├── part_code
├── avg_daily_sales_kg (30-day average)
├── reference_period = '30_days'
├── avg_daily_sales_90d_kg
├── avg_daily_sales_7d_kg
├── velocity_trend (ACCELERATING|DECELERATING|STABLE|NO_DATA)
└── data_status (OK|NO_SALES_DATA|LIMITED_DATA)
```

### 9.4 v_sales_pressure_score
**Purpose:** Main pressure indicator per part
**Key Metric:** DSI (Days Sales Inventory)

```sql
v_sales_pressure_score
├── part_code
├── inventory_kg
├── batch_count
├── avg_daily_sales_kg
├── days_sales_inventory (DSI = inventory / velocity)
├── pressure_flag (green|orange|red|no_stock|no_velocity)
├── velocity_trend
├── tht_batches_red/orange/green
├── explanation (Dutch text)
├── batch_distribution (JSONB)
└── data_status
```

---

## 10. SPRINT 3 CONSTRAINTS

### 10.1 Observational Only
- Signaleert spanningen
- Maakt zichtbaar waar actie nodig is
- **Stuurt NIET**
- **Geen prijsadvies**
- **Geen automatische optimalisatie**

### 10.2 DSI Thresholds (LOCKED)
- Green: DSI < 14 days (fast moving)
- Orange: DSI 14-28 days (moderate)
- Red: DSI > 28 days (slow moving / overstocked)

### 10.3 Data Sources
- Inventory: inventory_positions (snapshots)
- Velocity: sales_transactions (30-day average)
- THT: production_batches (expiry dates)

### 10.4 Not in Scope (Sprint 3)
- Actions or recommendations
- Price advice
- Automatic ordering
- Customer steering
- Inventory optimization

---

## 11. SPRINT 4 — Klant-specifieke Vierkantsverwaarding

### 11.1 elasticity_assumptions (Sprint 4)
**Purpose:** Scenario assumptions for price elasticity modeling
**Constraint:** ANALYTICAL ONLY - scenarios are labeled as ASSUMPTIONS

```sql
elasticity_assumptions
├── scenario_id (TEXT, groups related assumptions)
├── scenario_name
├── scenario_description
├── part_code
├── price_change_pct (assumed price change)
├── expected_volume_change_pct (projected volume impact)
├── assumption_source (manual|historical|market_research|expert_estimate)
├── assumption_note (required for transparency)
├── valid_from
├── valid_until
└── created_at
```

---

## 12. SPRINT 4 VIEWS

### 12.1 v_customer_intake_profile
**Purpose:** Customer intake profile by anatomical part
**Source:** sales_transactions + products
**Period:** Last 90 days

```sql
v_customer_intake_profile
├── customer_id
├── customer_name
├── customer_code
├── part_code
├── quantity_kg
├── revenue_eur
├── share_of_total_pct (customer's distribution)
├── customer_total_kg
└── reference_period = '90_days'
```

### 12.2 v_customer_carcass_alignment
**Purpose:** Comparison of customer intake vs natural carcass proportions
**Reference:** JA757 (NORMATIVE)
**Constraint:** ANALYTICAL ONLY - no scoring or ranking

```sql
v_customer_carcass_alignment
├── customer_id
├── customer_name
├── part_code
├── customer_share_pct (customer's proportion)
├── carcass_share_pct (JA757 reference)
├── deviation_pct (positive = over-uptake, negative = under-uptake)
├── deviation_category (OVER_UPTAKE_HIGH|OVER_UPTAKE_MODERATE|BALANCED|UNDER_UPTAKE_MODERATE|UNDER_UPTAKE_HIGH)
├── alignment_score (0-100, descriptive only)
├── carcass_reference_source = 'JA757'
└── reference_period = '90_days'
```

### 12.3 v_scenario_impact
**Purpose:** Projected impact of elasticity scenarios
**Constraint:** CRITICAL - All outputs are ASSUMPTIONS, not predictions

```sql
v_scenario_impact
├── scenario_id
├── scenario_name
├── part_code
├── price_change_pct
├── expected_volume_change_pct
├── current_daily_kg (baseline)
├── projected_daily_kg (projection based on assumption)
├── volume_change_daily_kg
├── balance_effect (NO_BASELINE|NEUTRAL|CHANGES_BALANCE)
├── assumption_source
├── assumption_note
├── data_type = 'SCENARIO_ASSUMPTION'
├── disclaimer (MUST be displayed in UI)
└── carcass_reference = 'JA757'
```

---

## 13. SPRINT 4 CONSTRAINTS

### 13.1 Analytical Only
- Maakt afwijkingen zichtbaar
- Vergelijkt met karkasbalans (vierkantsverwaarding)
- **Geen klant-ranking of scoring als oordeel**
- **Geen prijsadvies**
- **Geen automatische acties**

### 13.2 Scenario Requirements
- Scenarios are ASSUMPTIONS, not predictions
- All scenarios must have assumption_source
- assumption_note required for transparency
- Disclaimer MUST be displayed in UI
- NO optimization or recommendations

### 13.3 Carcass Reference (LOCKED)
- JA757 is NORMATIVE for carcass proportions
- Midpoints used for deviation calculation:
  - breast_cap: 35.85% (34.8-36.9)
  - leg_quarter: 43.40% (42.0-44.8)
  - wings: 10.70% (10.6-10.8)
  - back_carcass: 7.60% (7.0-8.2)
  - offal: 4.00% (3.0-5.0)

### 13.4 Not in Scope (Sprint 4)
- Price advice or optimization
- Customer scoring or ranking
- Automatic actions
- Discounts or promotions
- Margin optimization

---

## 14. SPRINT 5 — Klantafspraken, Marges & Karkascontext

### 14.1 customer_contracts (Sprint 5)
**Purpose:** Contractual agreements for customer part share ranges
**Constraint:** ANALYTICAL ONLY - for comparing actual vs agreed, not for automatic pricing

```sql
customer_contracts
├── customer_id (FK)
├── part_code
├── agreed_share_min (percentage)
├── agreed_share_max (percentage)
├── contract_start_date
├── contract_end_date (nullable)
├── price_tier (for context, not calculation)
├── notes
└── created_at
```

### 14.2 customer_margin_context (Sprint 5)
**Purpose:** Precomputed margin context per customer/part for explanation
**Constraint:** ANALYTICAL ONLY - provides the "why" behind margins

```sql
customer_margin_context
├── customer_id (FK)
├── part_code
├── period_start/end
├── revenue_eur
├── cost_eur (from Sprint 2 NRV)
├── margin_eur
├── margin_pct
├── quantity_kg
├── margin_explanation (Dutch, for UI)
├── customer_share_pct
├── carcass_share_pct
├── deviation_pct
├── data_completeness (COMPLETE|PARTIAL|ESTIMATED)
└── calculated_at
```

---

## 15. SPRINT 5 VIEWS

### 15.1 v_customer_margin_by_part
**Purpose:** Margin per customer per anatomical part (90-day rolling window)
**Source:** sales_transactions + allocated costs (Sprint 2 NRV)

```sql
v_customer_margin_by_part
├── customer_id
├── customer_name
├── customer_code
├── part_code
├── quantity_kg
├── revenue_eur
├── cost_eur
├── margin_eur (= revenue - cost)
├── margin_pct
├── customer_share_pct
├── customer_total_kg
├── transaction_count
├── cost_data_status (COST_AVAILABLE|NO_COST_DATA)
└── reference_period = '90_days'
```

### 15.2 v_customer_contract_deviation
**Purpose:** Compare actual intake vs contractual agreements
**Constraint:** DESCRIPTIVE ONLY - no judgment, no recommendations

```sql
v_customer_contract_deviation
├── customer_id
├── customer_name
├── part_code
├── actual_share
├── agreed_share_min
├── agreed_share_max
├── agreed_range (formatted text)
├── deviation_pct (NULL if within range or no contract)
├── deviation_flag (WITHIN_RANGE|BELOW_RANGE|ABOVE_RANGE|NO_CONTRACT)
├── explanation (Dutch text)
├── price_tier
├── contract_notes
└── contract_status
```

---

## 16. SPRINT 5 CONSTRAINTS

### 16.1 Analytical Only
- Marges in karkascontext
- Afwijkingen uitlegbaar
- **Geen klant-ranking of scoring als oordeel**
- **Geen prijsadvies**
- **Geen automatische acties**

### 16.2 Contract Deviation Flags (DESCRIPTIVE)
- WITHIN_RANGE: Actual within agreed min/max
- BELOW_RANGE: Actual below agreed minimum
- ABOVE_RANGE: Actual above agreed maximum
- NO_CONTRACT: No contract for this customer/part

### 16.3 Margin Context Requirements
- All margins linked to carcass context
- Deviations explained in Dutch
- Data completeness status included
- Cost source traceable to Sprint 2 NRV

### 16.4 Not in Scope (Sprint 5)
- Price advice or optimization
- Customer scoring or ranking as judgment
- Automatic actions
- Price adjustments

---

## 17. SPRINT 6 — Historische Trends & Verwaarding over Tijd

*(Added v6.0.0 — Sprint 6 tables documented from migration files)*

### 17.1 weekly_yield_summary (Sprint 6)
**Purpose:** Aggregated weekly yield summary per part
**Source:** v_effective_batch_yields, aggregated by ISO week

### 17.2 weekly_sales_summary (Sprint 6)
**Purpose:** Aggregated weekly sales per part
**Source:** sales_transactions + products, aggregated by ISO week

### 17.3 weekly_pricing_summary (Sprint 6)
**Purpose:** Aggregated weekly pricing per part
**Source:** sales_transactions, avg/min/max price per kg per week

### 17.4 v_part_trend_over_time (Sprint 6)
**Purpose:** Unified time-series view joining yield, sales, pricing per part per week
**Source:** weekly_yield_summary + weekly_sales_summary + weekly_pricing_summary

---

## 18. SPRINT 7 — Canonical Cost Engine & Scenario Layer

*(Added v7.0.0 — Sprint 7 tables documented from migration files)*

### 18.1 std_prices (Sprint 7)
**Purpose:** Vierkantsverwaarding price vectors for SVASO allocation
**Constraint:** Standard (not invoice) prices used as allocation key

```sql
std_prices
├── period_id VARCHAR(20)           -- e.g., '2026-01', '2026-W04'
├── period_type VARCHAR(10)         -- week|month|quarter|year
├── part_code VARCHAR(50)
├── part_name VARCHAR(100)
├── std_market_price_eur NUMERIC(10,4) -- Negative allowed (by-product disposal)
├── price_index NUMERIC(6,2)        -- Default 100.00
├── source VARCHAR(100)             -- Default 'market_benchmark'
├── effective_from DATE
├── effective_to DATE
├── notes TEXT
├── UNIQUE (period_id, part_code)
└── CHECK (effective_to IS NULL OR effective_to > effective_from)
```

### 18.2 cost_drivers (Sprint 7)
**Purpose:** Operational costs (labor, energy, overhead) for standard and ABC costing
**Constraint:** Supports both JOINT (pre-split-off) and SEPARABLE (post-split-off) costs

```sql
cost_drivers
├── period_id VARCHAR(20)
├── cost_type VARCHAR(50)
├── cost_name VARCHAR(100)
├── unit_cost_eur NUMERIC(10,4)
├── allocation_base VARCHAR(20)     -- per_kg|per_head|per_hour|per_unit|fixed
├── cost_category VARCHAR(30)       -- SLAUGHTER|PROCESSING|PACKAGING|OVERHEAD|TRANSPORT|ENERGY
├── cost_classification VARCHAR(20) -- JOINT|SEPARABLE
├── applies_to_part_code VARCHAR(50) -- NULL = all parts
├── applies_to_sku VARCHAR(50)      -- NULL = all SKUs
├── source VARCHAR(100)
├── effective_from DATE
├── effective_to DATE
├── notes TEXT
└── CHECK (effective_to IS NULL OR effective_to > effective_from)
```

### 18.3 price_scenarios (Sprint 7)
**Purpose:** Scenario price vectors for simulation ("what-if")
**Constraint:** NEVER pollutes actuals. Ephemeral simulations only.

```sql
price_scenarios
├── scenario_name VARCHAR(100) UNIQUE
├── description TEXT
├── base_period_id VARCHAR(20)
├── scenario_data JSONB            -- Array of {part_code, price_eur}
├── is_active BOOLEAN DEFAULT true
└── created_at / updated_at
```

### 18.4 v_cost_waterfall (Sprint 7)
**Purpose:** Visualizes complete cost flow: Live Cost → Yield Loss → Processing → Variance → Final SKU Cost
**Source:** batch_valuation + cost_drivers + std_prices

---

## 19. SPRINT 7 CONSTRAINTS

### 19.1 Canonical Cost Engine
- Uses 8-level cost waterfall (Level 0-7)
- k-factor (killing factor) = 1 / griller_yield
- SVASO allocation via std_prices (NOT invoice prices)
- By-product credit: €0.20/kg (chicken fat, necks)
- NRV for non-allocating parts (cat3_waste, feathers)
- All calculations via Decimal.js for precision

### 19.2 Price Scenario Rules
- Scenarios are EPHEMERAL - never persist to actuals
- scenario_data stores full price vector as JSONB
- Comparing scenario vs base always available
- NO optimization or auto-recommendations

---

## 20. NOT IN SCOPE (Post-Sprint 7)

The following are NOT part of the Sprint 1-7 data contracts:

- Price optimization
- Automated recommendations
- Customer scoring/ranking as judgment
- Real-time integrations
- Production planning
- PDF import pipeline (Sprint 9)
- Scenario engine UI (Sprint 10)

---

*This document is authoritative for Sprints 1-7. All data must conform to these contracts.*
