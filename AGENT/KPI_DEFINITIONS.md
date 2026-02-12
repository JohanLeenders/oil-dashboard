# KPI_DEFINITIONS.md — Oranjehoen Commercial Dashboard

**Version:** 5.0.0 (Sprint 5)
**Status:** AUTHORITATIVE
**Last Updated:** 2026-01-24

---

## 1. YIELD KPIs

### 1.1 Griller Yield (Level 1)
**Definition:** Percentage of live weight recovered as griller (dressed carcass)
**Formula:** `griller_yield_pct = (griller_weight_kg / live_weight_kg) × 100`
**Target Range:** 68-73% (Hubbard JA757)
**Source:** production_batches (calculated)

### 1.2 Cut-Up Yield (Level 2)
**Definition:** Percentage of griller weight recovered as anatomical part
**Formula:** `yield_pct = (part_weight_kg / griller_weight_kg) × 100`
**Source:** batch_yields → v_effective_batch_yields

| Part | JA757 Target (NORMATIVE) | Ross308 (INDICATIVE) |
|------|--------------------------|----------------------|
| Breast Cap | 34.8% - 36.9% | 32.0% - 34.0% |
| Leg Quarter | 42.0% - 44.8% | 40.0% - 42.0% |
| Wings | 10.6% - 10.8% | 11.0% - 11.5% |
| Back/Carcass | 7.0% - 8.2% | 8.0% - 9.0% |
| Offal | 3.0% - 5.0% (est.) | 4.0% - 5.5% (est.) |

**IMPORTANT:** JA757 is NORMATIVE (used for calculations). Ross308 is INDICATIVE ONLY.

### 1.3 Delta from Target
**Definition:** Deviation from target midpoint
**Formula:** `delta = actual_yield_pct - ((target_min + target_max) / 2)`
**Interpretation:**
- Positive = Over-performing
- Negative = Under-performing
- Delta always visible (never hidden)

---

## 2. MASS BALANCE KPIs

### 2.1 Level 1 Balance (Live → Griller)
**Definition:** Input-output balance for slaughter process
**Formula:** `balance = live_weight - (griller + rejection + slaughter_waste)`
**Tolerance:** ±2% of live weight
**Alert:** >2% triggers NEEDS_REVIEW

### 2.2 Level 2 Balance (Griller → Parts)
**Definition:** Input-output balance for cut-up process
**Formula:** `unaccounted = griller - sum(parts)`
**Tolerance:** ≤5% of griller weight
**Alert:** >5% triggers warning

### 2.3 Data Status
**Definition:** Quality status of mass balance data
**Values:**
- `COMPLETE` — All parts recorded, balance within tolerance
- `NEEDS_REVIEW` — Missing parts or high unaccounted
- `HAS_CORRECTIONS` — Contains corrected yield records

---

## 3. DELTA INDICATORS

### 3.1 Technical vs Commercial Delta
**Definition:** Difference between slaughter output and pakbon deliveries
**Formula:** `delta_kg = technical_weight_kg - commercial_weight_kg`
**Source:** v_batch_output_vs_pakbon
**Interpretation:**
- Positive = More produced than shipped (inventory)
- Negative = More shipped than produced (data issue or multi-batch)

### 3.2 Yield Variance Delta
**Definition:** Deviation from expected yield per part
**Formula:** `delta_pct = realized_yield_pct - ja757_midpoint_pct`
**Source:** v_batch_yield_vs_expectation

---

## 4. THT (SHELF LIFE) KPIs

### 4.1 THT Status
**Definition:** Shelf life status based on elapsed percentage
**Formula:** `elapsed_pct = (current_date - production_date) / (expiry_date - production_date) × 100`
**Thresholds (LOCKED - Blueprint Spec):**
- GREEN: < 70% elapsed
- ORANGE: 70% - 90% elapsed
- RED: > 90% elapsed

### 4.2 Days Remaining
**Definition:** Days until expiry
**Formula:** `days_remaining = expiry_date - current_date`

---

## 5. VALIDATION METRICS

### 5.1 Parts Present
**Definition:** Number of anatomical parts with recorded yields
**Expected:** 5 (breast_cap, leg_quarter, wings, back_carcass, offal)
**Alert:** <5 triggers INCOMPLETE_PARTS warning

### 5.2 Unaccounted Percentage
**Definition:** Percentage of griller weight not accounted for in parts
**Formula:** `unaccounted_pct = (griller - sum(parts)) / griller × 100`
**Threshold:** >5% triggers HIGH_UNACCOUNTED warning

---

## 6. SPRINT 2 — COST PRICE KPIs

### 6.1 Allocated Joint Cost
**Definition:** Joint cost allocated to each part via SVASO
**Formula:** `allocated_joint_cost = batch_joint_cost × allocation_factor`
**Allocation Factor:** `sales_value / total_batch_sales_value`
**Source:** v_batch_splitoff_allocation

**IMPORTANT:** Allocation is ONLY via Sales Value at Split-Off (SVASO). NO weight-based allocation.

### 6.2 Cost Per Kg at Split-Off
**Definition:** Cost per kg after SVASO allocation, before processing
**Formula:** `cost_per_kg_splitoff = allocated_joint_cost / weight_kg`
**Source:** v_batch_part_cost
**Unit:** EUR/kg (4 decimal places)

### 6.3 Processing Cost Per Kg
**Definition:** Sum of processing costs applied after split-off
**Formula:** `processing_cost_per_kg = SUM(cost_per_kg WHERE applicable)`
**Applicability:** Matched by part_code and/or sku
**Source:** processing_costs table

| Process Step | Description |
|--------------|-------------|
| cutting | Cutting/deboning operations |
| vacuum | Vacuum sealing |
| portioning | Portioning to weight specs |
| packaging | Final packaging |
| other | Other processing steps |

### 6.4 NRV Cost Per Kg
**Definition:** Net Realizable Value cost = full product cost
**Formula:** `nrv_cost_per_kg = cost_per_kg_splitoff + processing_cost_per_kg`
**Source:** v_batch_nrv_by_sku
**Unit:** EUR/kg (4 decimal places)

### 6.5 NRV Total
**Definition:** Total NRV cost for batch/part/SKU
**Formula:** `nrv_total = nrv_cost_per_kg × weight_kg`
**Source:** v_batch_nrv_by_sku
**Unit:** EUR (2 decimal places)

---

## 7. SPRINT 2 — VALIDATION KPIs

### 7.1 Allocation Factor Sum
**Definition:** Sum of all allocation factors per batch
**Expected:** 1.0 (100%)
**Tolerance:** ±0.0001
**Alert:** Deviation triggers INVALID_ALLOCATION warning

### 7.2 Validation Status
**Definition:** Data quality status for cost calculations
**Values:**
- `OK` — Valid weight and cost allocated
- `INVALID_WEIGHT` — Weight is zero or negative
- `NO_COST_ALLOCATED` — No joint cost found for batch

---

## 8. SPRINT 3 — PRESSURE KPIs

### 8.1 Days Sales Inventory (DSI)
**Definition:** How many days of inventory at current sales velocity
**Formula:** `DSI = inventory_kg / avg_daily_sales_kg`
**Source:** v_sales_pressure_score
**Unit:** Days (1 decimal place)

**Interpretation:**
- DSI < 14 days: Fast moving, normal pressure
- DSI 14-28 days: Moderate, elevated pressure
- DSI > 28 days: Slow moving, high pressure

### 8.2 Sales Velocity
**Definition:** Average daily sales per part over reference period
**Formula:** `velocity = total_sales_kg / reference_days`
**Source:** v_sales_velocity_by_part
**Reference Period:** 30 days (primary)

### 8.3 Velocity Trend
**Definition:** Comparison of recent (7d) vs medium-term (30d) velocity
**Values:**
- `ACCELERATING`: 7d velocity > 30d velocity × 1.2
- `DECELERATING`: 7d velocity < 30d velocity × 0.8
- `STABLE`: Within 20% of medium-term
- `NO_DATA`: Insufficient sales data

### 8.4 Pressure Flag
**Definition:** Categorical indicator of inventory pressure
**Formula:** Based on DSI thresholds
**Values:**
| Flag | Condition | Label (Dutch) |
|------|-----------|---------------|
| green | DSI < 14 | Normaal |
| orange | 14 ≤ DSI < 28 | Verhoogd |
| red | DSI ≥ 28 | Hoog |
| no_stock | inventory = 0 | Geen voorraad |
| no_velocity | velocity = 0 | Geen data |

### 8.5 THT Batch Distribution
**Definition:** Count of batches by THT status per part
**Values:**
- `batches_green`: < 70% elapsed
- `batches_orange`: 70-90% elapsed
- `batches_red`: > 90% elapsed

**Alert:** `batches_red > 0` indicates urgent THT risk

---

## 9. SPRINT 4 — CARCASS ALIGNMENT KPIs

### 9.1 Customer Intake Share
**Definition:** Percentage of each part in customer's total purchases
**Formula:** `share_pct = (part_quantity_kg / customer_total_kg) × 100`
**Source:** v_customer_intake_profile
**Period:** Last 90 days

### 9.2 Carcass Share Reference
**Definition:** Natural proportion of each part in a carcass
**Source:** JA757 (Hubbard spec) - NORMATIVE
**Values (Midpoints):**

| Part | Carcass Share % | Target Range |
|------|-----------------|--------------|
| Breast Cap | 35.85% | 34.8% - 36.9% |
| Leg Quarter | 43.40% | 42.0% - 44.8% |
| Wings | 10.70% | 10.6% - 10.8% |
| Back/Carcass | 7.60% | 7.0% - 8.2% |
| Offal | 4.00% | 3.0% - 5.0% |

### 9.3 Deviation from Carcass Balance
**Definition:** Difference between customer intake and carcass proportion
**Formula:** `deviation_pct = customer_share_pct - carcass_share_pct`
**Interpretation:**
- Positive = Over-uptake (buying more than carcass proportion)
- Negative = Under-uptake (buying less than carcass proportion)
- DESCRIPTIVE ONLY - no judgment implied

### 9.4 Deviation Category
**Definition:** Categorical label for deviation magnitude
**Thresholds:**
- `OVER_UPTAKE_HIGH`: deviation > +10%
- `OVER_UPTAKE_MODERATE`: deviation +5% to +10%
- `BALANCED`: deviation -5% to +5%
- `UNDER_UPTAKE_MODERATE`: deviation -10% to -5%
- `UNDER_UPTAKE_HIGH`: deviation < -10%

**IMPORTANT:** Categories are DESCRIPTIVE, not judgmental.

### 9.5 Alignment Score
**Definition:** Summary metric for customer-carcass alignment
**Formula:** `alignment_score = 100 - (avg_abs_deviation × 4)`
**Range:** 0-100
**Interpretation:**
- 100 = Perfect alignment with carcass balance
- 0 = Maximum deviation (25%+ average deviation)
- FOR VISIBILITY ONLY - not customer ranking

**IMPORTANT:** This score is ANALYTICAL, not a customer judgment or ranking.

---

## 10. SPRINT 4 — SCENARIO KPIs

### 10.1 Price Change Assumption
**Definition:** Assumed price change for scenario modeling
**Formula:** User-defined or historical data
**Unit:** Percentage (e.g., -10% = 10% price decrease)
**Source:** elasticity_assumptions table

**CRITICAL:** This is an ASSUMPTION, not a prediction or recommendation.

### 10.2 Volume Change Projection
**Definition:** Projected volume change based on price elasticity assumption
**Formula:** `projected_volume = current_volume × (1 + volume_change_pct / 100)`
**Unit:** kg/day or kg/30days

**CRITICAL:** This is a PROJECTION based on ASSUMPTIONS, not a prediction.

### 10.3 Balance Effect
**Definition:** Whether a scenario affects carcass balance
**Values:**
- `NO_BASELINE`: No current data for comparison
- `NEUTRAL`: Change too small to affect balance
- `CHANGES_BALANCE`: Meaningful impact on part proportions

### 10.4 Assumption Source
**Definition:** Origin of elasticity assumption
**Values:**
- `manual`: User-entered estimate
- `historical`: Based on historical price-volume data
- `market_research`: From market research studies
- `expert_estimate`: Expert judgment

**REQUIRED:** All scenarios must document their assumption source for transparency.

---

## 11. SPRINT 4 — VALIDATION

### 11.1 Scenario Disclaimer
**Definition:** Required disclaimer for all scenario outputs
**Value (Dutch):** "Dit is een projectie gebaseerd op aannames. Dit is GEEN voorspelling of aanbeveling."
**Display:** MUST be shown in any UI displaying scenario data

### 11.2 Alignment Score Validity
**Definition:** Minimum data requirements for alignment calculation
**Requirements:**
- At least 1 part with sales data
- Reference period: 90 days
- Customer must have transactions in period

---

## 12. SPRINT 5 — MARGIN CONTEXT KPIs

### 12.1 Customer Margin by Part
**Definition:** Gross margin per customer per anatomical part
**Formula:** `margin_eur = revenue_eur - cost_eur`
**Formula:** `margin_pct = (margin_eur / revenue_eur) × 100`
**Source:** v_customer_margin_by_part
**Period:** Last 90 days
**Cost Source:** Sprint 2 NRV allocation (allocated_cost)

### 12.2 Contract Deviation
**Definition:** Difference between actual intake and contractual agreements
**Formula:** Based on agreed_share_min and agreed_share_max
**Source:** v_customer_contract_deviation
**Flags:**
- `WITHIN_RANGE`: actual_share between agreed_min and agreed_max
- `BELOW_RANGE`: actual_share < agreed_min
- `ABOVE_RANGE`: actual_share > agreed_max
- `NO_CONTRACT`: no contract exists for this combination

**IMPORTANT:** Flags are DESCRIPTIVE, not judgmental.

### 12.3 Margin Context Thresholds
**Definition:** Thresholds for margin categorization
**Values:**
- Low margin: < 5%
- Average margin: 5% - 15%
- High margin: > 15%

**IMPORTANT:** These are DESCRIPTIVE categories for context, not targets or judgments.

### 12.4 Cost Data Status
**Definition:** Availability of cost data for margin calculation
**Values:**
- `COST_AVAILABLE`: Allocated costs from Sprint 2 NRV
- `NO_COST_DATA`: No cost allocation available

**Display:** When NO_COST_DATA, margin calculations are incomplete and should be labeled as such.

---

## 13. SPRINT 5 — VALIDATION

### 13.1 Margin in Carcass Context
**Requirement:** All margin displays must include carcass context
**Elements:**
- Customer share percentage
- Carcass reference share (JA757)
- Alignment deviation

### 13.2 Contract Deviation Explanation
**Requirement:** All deviations must be explainable
**Format:** Dutch text explanation
**Example:** "Afname (40.0%) is hoger dan afgesproken maximum (38%)."

### 13.3 No Price Advice
**Requirement:** No explanations may contain price advice
**Prohibited words:** verhoog, verlaag, advies, aanbeveling, actie, moet

---

## 14. NOT DEFINED IN SPRINT 5

The following KPIs are NOT part of Sprint 1-5:

- Price advice or optimization
- Customer scoring as judgment
- Discount recommendations
- Optimal inventory levels
- Margin optimization
- Automatic pricing

These are explicitly out of scope per Sprint 5 contract.

---

## 15. DISPLAY RULES

### 13.1 Formatting
- Weights: `nl-NL` locale, max 2 decimal places
- Percentages: 2 decimal places with `%` suffix
- Deltas: Show `+` for positive, `-` for negative

### 13.2 Color Coding
- Green: Within target range / positive delta
- Yellow/Orange: Warning threshold
- Red: Critical / below target

### 13.3 Source Labels
Every KPI must display its source:
- View name (e.g., `v_batch_mass_balance`)
- Data status (e.g., `COMPLETE`, `NEEDS_REVIEW`)

### 13.4 Cost-Specific Display Rules (Sprint 2)
- Cost per kg: 4 decimal places (e.g., €3.4567/kg)
- Total costs: 2 decimal places (e.g., €1,234.56)
- Allocation percentages: 2 decimal places with `%` suffix
- Allocation factors: 6 decimal places (for precision validation)
- Method labels: Always show `SVASO` and `NRV` for transparency

### 13.5 Alignment-Specific Display Rules (Sprint 4)
- Alignment score: 1 decimal place (e.g., 85.3)
- Deviation percentages: 1 decimal place with sign (e.g., +5.2%, -3.1%)
- Scenario projections: Always show `AANNAME` badge
- Disclaimer: MUST be displayed for all scenario data

### 13.6 Deviation Color Coding (Sprint 4)
- Over-uptake: Blue (descriptive, not negative)
- Under-uptake: Orange (descriptive, not negative)
- Balanced: Green

### 15.7 Margin-Specific Display Rules (Sprint 5)
- Margin amounts: nl-NL currency format (e.g., €1.234,56)
- Margin percentages: 1 decimal place with sign for negative (e.g., 12.5%, -3.2%)
- Contract deviation: Dutch explanation text always displayed
- Cost data status: Clearly indicate when costs are unavailable

### 15.8 Contract Deviation Color Coding (Sprint 5)
- WITHIN_RANGE: Green (within agreement)
- BELOW_RANGE: Orange (below minimum)
- ABOVE_RANGE: Blue (above maximum)
- NO_CONTRACT: Gray (no contract)

---

*This document defines all KPIs for Sprints 1-5. All metrics must conform to these definitions.*
