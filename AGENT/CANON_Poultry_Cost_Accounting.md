# CANON: Poultry Cost Accounting Formalization

---

## Canon Checksum Section

| Field | Value |
|-------|-------|
| **Document Title** | Comprehensive Cost Accounting Framework for Poultry Processing: SKU Valuation and Sprint 2 Logic Standardization |
| **Source File** | `Poultry Cost Accounting Formalization.docx` |
| **Extraction Method** | PowerShell ZipFile extraction of document.xml, XML tag removal, whitespace normalization |
| **Extraction Date** | 2026-01-24 |
| **Status** | READ-ONLY CANON |
| **Version** | 1.0.0 |

### Section List

1. Executive Summary and Strategic Alignment
2. The Disassembly Paradox: Theoretical Foundations of Poultry Costing
   - 2.1 The Inversion of Manufacturing Logic
   - 2.2 The Hierarchy of Cost Objects
   - 2.3 The Role of By-Products and NRV
3. Phase I: Landed Cost & The Slaughter Logic (Live to Griller)
   - 3.1 The Landed Cost of Live Poultry
   - 3.2 Slaughter and Evisceration (The "Fifth Quarter")
4. Phase II: Primary Disassembly & The "Vierkantsverwaarding" Algorithm
   - 4.1 Establishing the Valuation Vector
   - 4.2 Handling "Dummy" Articles and Simulation
5. Phase III: Secondary Processing, Yield Management, and SKU Assembly
   - 5.1 The Yield Gap (Bone-in to Boneless)
   - 5.2 Activity-Based Costing (ABC) Integration
   - 5.3 SKU Assembly (Packaging & Overhead)
6. Data Architecture & Technical Implementation
   - 6.1 New Data Tables Required
   - 6.2 The "Truth" Hierarchy
   - 6.3 Handling Deltas from Sprint 1
7. Governance, Variance Analysis, and Simulation Capabilities
   - 7.1 Scenario Analysis: The "Dummy" Request
   - 7.2 Sensitivity to Griller Cost
   - 7.3 Governance of By-products
8. Conclusion
- Appendix A: The "Griller" Cost Calculation Model
- Appendix B: The Primal Part Allocation Model (Vierkantsverwaarding)
- Appendix C: SKU Costing Build-Up

---

## 1. Executive Summary and Strategic Alignment

This report establishes the formalized cost accounting logic required for Sprint 2 of the Oranjehoen financial dashboard project. Following the successful definition of mass balance protocols in Sprint 1, which established the "physical truth" of production tracking, this phase transitions from quantitative metrics (kilograms and counts) to financial valuation (Euros).

**Primary Objective:** Engineer a robust, audit-ready mechanism for calculating the Cost of Goods Sold (COGS) at the Stock Keeping Unit (SKU) level, ensuring that the financial reality of the "commercial truth" aligns seamlessly with the physical reality of the "batch truth."

### The Disassembly Production Challenge

Poultry processing represents a unique and complex accounting challenge characterized by **disassembly production**. Unlike traditional manufacturing, where discrete components are assembled into a whole (e.g., automotive or electronics), poultry processing begins with a single, high-value asset—the live bird—which is systematically deconstructed into hundreds of divergent products.

These outputs range from:
- High-value proteins like breast fillets
- Low-value or negative-value by-products such as feathers and blood

**Consequence:** Standard manufacturing accounting methods, such as Bill of Materials (BOM) accumulation, fail to accurately capture profitability in this sector. A strictly linear approach would incorrectly assign costs based on mass, ignoring the disparate economic value of the outputs.

### Mandated Allocation Methods

| Product Type | Allocation Method |
|--------------|-------------------|
| Primary Products (Joint Products) | **Sales Value at Split-off Method (SVASO)** |
| Secondary Outputs and By-products | **Net Realizable Value (NRV) Method** |

This hybrid approach ensures that the valuation of inventory reflects market realities, preventing the distortion of margins that often leads to erroneous strategic decisions, such as the devaluation of dark meat products.

### Framework Purpose

This framework is designed to support the "Vierkantsverwaarding" (Carcass Balance) strategy, balancing the utilization of the entire bird against market demand to optimize total batch profitability.

**Core Requirement:** Every Euro entering the system as live inventory is traceable to a final SKU or explicitly recognized as a variance.

---

## 2. The Disassembly Paradox: Theoretical Foundations of Poultry Costing

### 2.1 The Inversion of Manufacturing Logic

In standard cost accounting, the accumulation of cost is a **convergent process**. Materials, labor, and overheads are distinct inputs that merge to form a finished good. The cost of the final product is simply the sum of its constituent parts.

However, in the poultry industry, the production process is **divergent**:
- The inputs are singular and accumulated at the "Joint Cost" level—the feed, the farmer's labor, the transport, and the slaughter fees apply to the bird as a whole
- The output, however, is plural. A single batch of live birds generates breasts, legs, wings, carcasses, and various by-products simultaneously

### The Central Friction: Physical Mass vs. Financial Value

| Dimension | Reality |
|-----------|---------|
| **Physical Reality** | A chicken leg (quarter leg) accounts for approximately 30-33% of the carcass weight |
| **Financial Reality** | The leg typically commands significantly less revenue than breast meat, often 20-25% of the total carcass value |

### The Physical Measure Method Problem

If costs were allocated purely on a physical basis (the Physical Measure Method):
- Low-value items like backs, necks, and wings would be assigned costs that frequently exceed their market price
- Example: If a griller costs €4.00/kg to produce, a physical allocation would assign €4.00/kg to the back bone. If the market price for backs is only €0.15/kg, the accounting system would report a massive, artificial loss on every kilogram of backs produced
- Conversely, high-value items like breast fillets would appear artificially profitable

**Strategic Hazard:** This distortion can lead management to make biologically impossible decisions, such as attempting to reduce leg production (which is impossible without reducing breast production) or refusing to sell low-value parts because they appear "unprofitable," leading to inventory bloat and freezer burn.

**RULE:** This framework explicitly **REJECTS** weight-based allocation for primary cuts in favor of **Market-Based Allocation**.

### 2.2 The Hierarchy of Cost Objects

| Hierarchy Level | Cost Object | Description | Valuation Method |
|-----------------|-------------|-------------|------------------|
| Level 0 | Live Batch | The flock arriving at the slaughterhouse | Actual Cost (Landed Cost) |
| Level 1 | The Griller | The eviscerated, chilled carcass | Joint Cost (Accumulated Level 0 + Processing - By-product Credits) |
| Level 2 | Primal Cuts | Breast, Leg, Wing, Back | Relative Sales Value allocation of Level 1 Cost |
| Level 3 | Secondary Cuts | Thigh meat, Drumsticks, Inner fillets | Yield-Adjusted allocation of Level 2 Cost |
| Level 4 | Finished SKUs | Retail packs (e.g., 200g spiced strips) | Assembly Costing (Level 3 Meat + Packaging + Direct Labor) |

This hierarchy respects the **Split-off Points**—the critical junctures in the production process where products become separately identifiable:
- **First split-off point:** After evisceration and chilling (Level 1)
- **Second split-off point:** After the cut-up line (Level 2)

### 2.3 The Role of By-Products and NRV

According to the provided slaughter yield datasets, the process generates significant by-products:
- Blood: 2.7%
- Feathers: 4.7%
- Category III material: 20.1%

#### Classification Rules

| Classification | Definition | Allocation |
|----------------|------------|------------|
| **Joint Products** | The primary outputs intended for sale (Breast, Leg, Wing). These drive the production decision. | SVASO |
| **By-Products** | Incidental outputs (Feathers, Blood, Offal). The production process is not undertaken to produce these; they are a consequence of producing the main products. | NRV (as cost reduction) |

**Accounting Treatment:** By-products should NOT be allocated a portion of the joint cost because they do not drive the cost structure. Instead, the revenue generated from these items (e.g., selling blood meal or rendering material) is treated as a **cost reduction** of the primary process. This is the Net Realizable Value (NRV) method.

**Logic:** The NRV of by-products is subtracted from the total batch cost before the remaining cost is allocated to the Griller.

**FORMULA: Net Griller Cost**
```
Net_Griller_Cost = Landed_Cost + Slaughter_Fee - Σ(By-Product NRV)
```

**Dynamic Relationship:** If the market for blood meal collapses, the cost of the chicken breast technically rises, as the credit from the by-product decreases. The system must reflect this dynamic relationship.

---

## 3. Phase I: Landed Cost & The Slaughter Logic (Live to Griller)

The first stage is to determine the cost of the "Griller" (the whole carcass). This serves as the denominator for all subsequent cut-up calculations. This phase transforms the live bird into a standard inventory unit.

### 3.1 The Landed Cost of Live Poultry

Before slaughter, the batch must be valued at its "Landed Cost"—the total cost to bring the birds to the factory gate.

**FORMULA 1: Landed Cost Calculation**
```
Landed_Cost = (Live_Weight_kg × Live_Price_per_kg) + Transport_Cost + Catching_Fee
```

| Component | Source | Notes |
|-----------|--------|-------|
| `Live_Weight_kg` | Sprint 1 Mass Balance view (`input_live_kg`) | This is the "Physical Truth" |
| `Live_Price_per_kg` | Finance System | Reference value: €2.60/kg for "BLK1STER" chickens. This price fluctuates and must be a time-bound variable. |
| `Transport_Cost` | Per-bird cost: €0.0764 | Alternatively calculated as function of distance and load efficiency |
| `Catching_Fee` | Typically per-head charge | From external service providers (vangploeg) |

#### Constraint: Handling Dead on Arrival (DOA)

The system must rigorously handle DOAs, differentiating between "Normal" and "Abnormal" spoilage:

| Spoilage Type | Treatment | Mechanism |
|---------------|-----------|-----------|
| **Normal Mortality** | Absorbed by surviving birds | The total invoice amount remains the same, but the denominator (usable live weight) decreases. This effectively raises the per-kg cost of the usable inventory. |
| **Abnormal Mortality** | Separated into variance account | If DOA exceeds threshold (e.g., 5% heat stress event), this cost should NOT be embedded in inventory cost. It should flow to a "Loss Variance" or "Abnormal Spoilage Expense" account on the P&L. |

**Reason for separation:** Embedding abnormal DOAs in inventory cost would inflate the product cost and potentially price the goods out of the market. This ensures that production efficiency metrics remain unclouded by one-off events.

### 3.2 Slaughter and Evisceration (The "Fifth Quarter")

The transformation from live bird to carcass involves the removal of feathers, blood, and offal—often referred to as the "Fifth Quarter." This process creates the **first Split-off Point**.

#### Data Source Alignment (Slaughter Yields)

| Component | Yield % |
|-----------|---------|
| Input | 100% Live Weight |
| Blood | 2.7% |
| Feathers | 4.7% |
| Offal (Hearts, Livers, Gizzards, Necks) | ~3.5% |
| Category III (Waste/Condemned) | 20.1% |
| **Target Output: Griller** | **70.5% - 70.8%** |

**FORMULA 2: Net Slaughter Cost**
```
Net_Slaughter_Cost = Landed_Cost + Slaughter_Fee - Σ(By-Product_NRV)
```

Where `Σ(By-Product_NRV)` is the NRV of the recovered offal, feathers, and blood.

**NRV Calculation:** For each by-product (e.g., Livers):
```
By-Product_Revenue = Weight_kg × Market_Price_per_kg
```

**CRITICAL: Negative NRV**
Some by-products, particularly feathers or Category III waste, may have a **negative value** (disposal cost) depending on the market for rendered meal. If the cost of rendering exceeds the sales price of feather meal, this "Revenue" becomes a **cost addition**.

**FORMULA 3: Cost per Kg of Griller**
```
Griller_Cost_per_kg = Net_Slaughter_Cost / Griller_Weight_kg
```

#### Critical Insight: The Yield Cost Multiplier

The yield percentage (70.5%) acts as a **massive cost multiplier**. Even before a single knife cuts the meat, the value of the material has fundamentally changed.

**Example:**
- Live bird costs €2.60/kg
- Transformation: We discard ~30% of the weight
- Result: The material cost of the carcass alone (excluding labor) becomes:
  ```
  €2.60 / 0.705 = €3.69/kg
  ```

**Validation:** This calculated figure aligns almost perfectly with the "Prijs" value of 3.68758 found in the "Slachten.csv" snippet, validating the accuracy of this logic.

This step establishes the **Base Inventory Value** for the batch entering the cut-up phase.

---

## 4. Phase II: Primary Disassembly & The "Vierkantsverwaarding" Algorithm

This phase represents the most technically complex component. The system must allocate the single `Griller_Cost` to the multiple primal parts (Breast, Leg, Wing, Back) generated during the cut-up process.

### 4.1 Establishing the Valuation Vector

**MANDATE:** Use of the **Relative Sales Value at Split-off Method**.

This method is the only approach that respects the economic reality of the "Vierkantsverwaarding" (Square Valuation) concept. It aligns the cost allocation with the revenue-generating potential of each part.

This method requires a **Standardized Price List** (a Valuation Vector) to act as weighting coefficients. These are NOT necessarily the actual invoice prices of the specific batch (which may vary by customer or contract), but rather **standard market values** used for allocation to ensure cost stability across batches.

#### Reference Price Data

| Part | Value Classification | Justification |
|------|---------------------|---------------|
| Breast (Borst) | High Value | Driver of profitability |
| Leg (Bout) | Medium Value | Secondary driver |
| Wing (Vleugel) | Medium/Low Value | Volatile, often linked to export or snack markets |
| Back/Carcass (Karkas) | Low/Scrap Value | MDM source |

### The Allocation Algorithm

**Step 1: Calculate Total Theoretical Market Value (TMV) of the Batch**

The system calculates what the batch would be worth if every part were sold at the standard market price.

```
TMV = Σ(Weight_part × StandardPrice_part)
```

Where `Weight_part` is the actual weight derived from the Sprint 1 mass balance.

**Step 2: Calculate the Cost Allocation Coefficient (k-factor)**

This coefficient represents the relationship between the production cost and the theoretical market value. It answers the question: "For every Euro of market value we produce, how much did it cost us?"

```
k = Griller_Cost_Total / TMV
```

**Interpretation:**
| k value | Interpretation |
|---------|---------------|
| k < 1 | The operation is theoretically profitable (Market Value > Cost) |
| k > 1 | The operation is running at a theoretical loss (Cost > Market Value) |

**System Requirement:** This k-factor is a critical KPI for the "Commercieel Dashboard." It provides an immediate health check on the batch's economics before SKU-specific variances are applied.

**Step 3: Allocate Cost to Each Part**

The cost assigned to each part is its Standard Price adjusted by the batch's efficiency coefficient (k).

```
Allocated_Cost_per_kg = k × StandardPrice_part
```

#### Numerical Example

**Scenario:** 100 kg of Griller with a total accumulated cost of €369 (at €3.69/kg).

| Part | Yield % | Weight (kg) | Std Price (€/kg) | Market Value (€) |
|------|---------|-------------|------------------|------------------|
| Breast | 34.9% | 34.9 | 5.50 | 191.95 |
| Leg | 43.0% | 43.0 | 2.00 | 86.00 |
| Wing | 10.4% | 10.4 | 2.50 | 26.00 |
| Back | 11.7% | 11.7 | 0.15 | 1.75 |
| **Total** | 100% | 100.0 | — | **305.70** |

**Step 2 - Coefficient Calculation:**
```
k = 369 / 305.70 = 1.207
```

**Insight:** In this scenario, the cost of production is higher than the standard market value sum. The allocated costs must reflect this "inefficiency" or market misalignment.

**Step 3 - Allocated Costs (Inventory Valuation):**
| Part | Std Price (€/kg) | k | Allocated Cost (€/kg) |
|------|------------------|---|----------------------|
| Breast | 5.50 | 1.207 | 6.64 |
| Leg | 2.00 | 1.207 | 2.41 |
| Wing | 2.50 | 1.207 | 3.02 |
| Back | 0.15 | 1.207 | 0.18 |

**Logic Validation:**
- Sum of allocated costs equals total batch cost (Σ Weight × Allocated_Cost_per_kg = €369)
- This method prevents the "Back" from carrying a weight-based cost of €3.69/kg, which would be absurd given its €0.15 market value
- The "loss" is distributed proportionally to the value-generating potential of each part

### 4.2 Handling "Dummy" Articles and Simulation

The user documents explicitly mention "Dummy articles" on rows 79-84 of the Prognoseblad to simulate valuation effects.

**REQUIREMENT:** The system must allow for a **Simulation Mode** where the user can adjust the StandardPrice vector in the allocation algorithm **without changing the actual accounting records**.

**Use Case:** "What if the market price of wings drops by 20% due to an export ban?"
- The system recalculates with the lower wing price
- The total batch cost (€369) remains unchanged
- Therefore, the coefficient (k) increases
- Result: The allocated cost of Breasts and Legs increases

**Strategic Insight:** This simulation powerfully demonstrates the interconnected nature of poultry economics. A drop in wing prices doesn't just hurt wing margins; it effectively raises the cost base of the breast meat, as the breast must now "subsidize" a larger portion of the joint cost to break even.

---

## 5. Phase III: Secondary Processing, Yield Management, and SKU Assembly

Once the cost of the primal part (e.g., the Whole Leg) is established, the process moves to the deboning, skinning, and packaging lines. This is where the product is transformed into the final SKUs for customers.

### 5.1 The Yield Gap (Bone-in to Boneless)

The most critical cost driver in Phase 3 is **Yield**. The transition from a bone-in part to boneless meat involves significant weight loss, which acts as a **second cost multiplier**.

**Example Case:** Processing "Dij+V" (Thigh with Skin/Bone) into "Dijvlees" (Boneless Thigh Meat).

| Output | Yield % |
|--------|---------|
| Dijvlees (Boneless Thigh Meat) | 62.5% |
| Bone | 12.9% (By-product) |
| Skin | 12.2% (By-product) |
| Trim/Loss | 12.4% (Waste/Fat) |

**FORMULA 4: Boneless Meat Costing**
```
Boneless_Cost_per_kg = (Input_Cost - By-Product_Credit) / Yield_pct + Labor_Cost
```

**Detailed Application:**

Using the allocated cost of the Leg calculated in Phase II (€2.41/kg) and processing labor costs (€0.68/kg for dijvlees production):

| Step | Calculation | Result |
|------|-------------|--------|
| Input Cost Base | €2.41 + €0.68 labor | €3.09 |
| By-Product Credit | Bone (12.9% × €0.09) + Skin (12.2% × €0.02) | €0.014 |
| Net Input Cost | €3.09 - €0.014 | €3.076 |
| Yield Adjustment | €3.076 / 0.625 | **€4.92/kg** |

**Key Takeaway:** The cost nearly **doubles** during the deboning process (from €2.41 to €4.92). This increase is driven primarily by the physical loss of weight (bones/skin) rather than the labor cost.

This highlights why **Yield Variance** is the most sensitive KPI in the factory.

**System Requirement:** The system must rigorously track Actual Yield vs. Standard Yield.

**Sensitivity Example:**
- If actual yield drops from 62.5% to 60.0%, the cost spikes to €5.13/kg
- This variance (€0.21/kg) must be flagged in the dashboard as a "Yield Efficiency Loss" and traced back to the specific batch

### 5.2 Activity-Based Costing (ABC) Integration

While the current spreadsheets use a simplified "Standard Cost per kg" for labor (e.g., €0.68/kg), the system architecture should be prepared for Activity-Based Costing (ABC).

ABC provides superior accuracy in meat processing by allocating overheads based on actual activities (e.g., machine hours, number of cuts) rather than simple volume.

**Sprint 2 Implementation:** Adhere to the provided spreadsheets' logic (Standard Costing) to ensure immediate compatibility. However, the `cost_drivers` table will be structured to allow for future ABC drivers (e.g., `cost_per_machine_hour`) without breaking the data model.

### 5.3 SKU Assembly (Packaging & Overhead)

The final step converts the bulk meat cost into a shelf-ready SKU cost. This is an assembly process similar to traditional manufacturing.

**FORMULA 5: Final SKU Cost**
```
SKU_Cost = Meat_Content_Cost + Meerkosten_Productie + Arbeid_Verpakken + Verpakkingen + Toeslag_Transport + Toeslag_Energie
```

| Component | Source |
|-----------|--------|
| Grondstof kg prijs (BLK1STER) | Links to `Griller_Cost` calculated in Phase II |
| Meerkosten productie | Variable manufacturing overheads |
| Arbeid verpakken | Direct labor specifically for the packaging line (distinct from deboning labor) |
| Verpakkingen | Sum of films, trays, labels, and boxes |
| Toeslag Transport | Logistics surcharge |
| Toeslag Energie | Energy surcharge |

#### Critical Nuance: Fixed Weight vs. Catch Weight

| Weight Type | Description | Cost Implication |
|-------------|-------------|------------------|
| **Fixed Weight (E-mark)** | If the SKU is "200g Fixed," the factory typically overfills to ~204g to ensure legal compliance with the E-mark standard | The cost calculation must use the **actual fill weight (204g)**, not the label weight. The cost of the extra 4g ("Giveaway") is a Cost of Quality. |
| **Catch Weight (Variable)** | If the product is sold by the kilogram (e.g., bulk bags), the cost is calculated on the exact weight | There is no "Giveaway" cost component. |

**Fixed Weight Logic:**
```
SKU_Cost_Fixed = (Actual_Fill_Weight / Label_Weight) × Base_Cost
```

---

## 6. Data Architecture & Technical Implementation

To support the calculations defined above, the data model established in Sprint 1 must be augmented. Sprint 1 provided the "Physical Truth" (Batches, Parts, Weights). Sprint 2 layers on the "Financial Truth."

### 6.1 New Data Tables Required

| Table Name | Type | Description | Key Columns |
|------------|------|-------------|-------------|
| `std_yields` | Master | Normative yields for every process step. Used to calculate standard costs and variances. | `process_id`, `input_part`, `output_part`, `std_yield_pct`, `value_category` (Main/By-product) |
| `std_prices` | Master | The "Vierkantsverwaarding" price vectors. This is the "Allocation Key." | `period_id`, `part_code`, `std_market_price_eur` |
| `cost_drivers` | Master | Operational costs for labor, energy, and overhead. | `period_id`, `cost_type` (e.g., 'SLAUGHTER_LABOR'), `unit_cost`, `allocation_base` (Per Head/Kg/Hour) |
| `sku_bom` | Master | Bill of Materials for packaging and additives. | `sku_id`, `component_id`, `quantity`, `unit` |
| `batch_valuation` | Transaction | Stores the calculated Griller cost and k-factor per batch. | `batch_id`, `griller_cost_eur`, `k_factor`, `tmv_batch` |
| `part_valuation` | Transaction | Stores the allocated cost for each primal part per batch. | `batch_id`, `part_code`, `allocated_cost_eur` |

### 6.2 The "Truth" Hierarchy

The system must maintain two parallel cost layers to support variance analysis:

| Layer | Purpose | Calculation Method |
|-------|---------|-------------------|
| **Standard Cost (The Budget View)** | Used for pricing decisions and forecasting. It answers "What should this batch cost?" | Calculated using `std_yields` and `std_prices` |
| **Actual Cost (The Batch View)** | Answers "What did this batch cost?" | Calculated using the `v_batch_mass_balance` actual weights from Sprint 1 and actual invoices |

**Variance Calculation:** The difference between these two layers provides the actionable insights for the dashboard. This variance explains why a specific batch was more or less expensive than the norm (e.g., "Batch 102 had poor deboning yield, costing us €500").

### 6.3 Handling Deltas from Sprint 1

Sprint 1 was explicitly designed to allow "Deltas" (unexplained mass differences) to remain visible. In Sprint 2, these deltas must be valued.

| Delta Type | Treatment |
|------------|-----------|
| **Positive Delta (Unexplained Gain)** | Reduces the calculated cost of the batch (essentially "free" inventory appearing) |
| **Negative Delta (Unexplained Loss)** | This must be **expensed**. It should NOT be allocated to the products, as this would hide inefficiency inside the SKU cost. It should flow to a specific "Factory Loss" or "Inventory Shrinkage" line item on the batch P&L. |

**Valuation Logic:**
```
Delta_Value = Delta_kg × Griller_Cost_per_kg
```

---

## 7. Governance, Variance Analysis, and Simulation Capabilities

### 7.1 Scenario Analysis: The "Dummy" Request

The user request explicitly mentioned the need to simulate "what if we sell wings?" using dummy articles.

**Implementation:** The dashboard can allow users to select a different "Price Scenario" (e.g., "Scenario B: Export Ban").

**Mechanism:** The view `v_batch_disassembly_cost` recalculates the TMV and the k-factor using the scenario prices.

**Visual Output:** The dashboard shows the impact: "If wing prices drop to €0.50, the cost of Breast Fillet rises by €0.30/kg to maintain the same batch margin."

This directly links sales mix decisions to production costs.

### 7.2 Sensitivity to Griller Cost

The Griller cost is the **single point of failure** for the entire cost model. A small fluctuation here amplifies through the yield chain.

**Sensitivity Example:**
- A €0.10 increase in live bird price does NOT mean meat costs €0.10 more
- Impact at Griller: €0.10 / 0.705 = €0.14
- Impact at Boneless: €0.14 / 0.625 = €0.22

**Implication:** The dashboard must display the "Live-to-Meat Multiplier" (approx. **2.2x**). This helps procurement teams understand that a small hike in farm prices has a double impact on the final shelf price.

### 7.3 Governance of By-products

Strict governance is required on the classification of by-products. The system must prevent "Category Creep," where low-value joint products are reclassified as by-products to dump costs.

**RULE:** An item is a by-product ONLY if:
1. Its NRV is significantly lower than the main products
2. Its production is incidental

The classification should be **hard-coded** in the `std_yields` table and require Controller approval to change.

---

## 8. Conclusion

The formalization of cost accounting for Oranjehoen requires a strict adherence to the **Sales Value at Split-off method**. This aligns with the "Vierkantsverwaarding" methodology and provides the only mathematically sound way to prevent dark meat from appearing loss-making.

### Key Action Items for Implementation

1. **Hardcode the Split-off Points:** Explicitly define the Griller (Level 1) and the Primal Cuts (Level 2) as the two non-negotiable gates for cost allocation in the SQL views.

2. **Implement the k-factor Logic:** Build the k-factor calculation directly into the core data views. It allows the system to remain flexible to market price changes without rewriting formulas.

3. **Segregate By-Products:** Ensure Blood, Feathers, and Offal are treated as NRV deductions, effectively reducing the input cost of the Griller.

4. **Visualize the Multiplier:** The dashboard must clearly show the "Waterfall" of costs:
   ```
   Live Cost → Yield Loss → Processing Cost → Variance → Final SKU Cost
   ```

This framework provides the "Financial Truth" to complement Sprint 1's "Physical Truth," creating a closed-loop system where every mass delta has a financial equivalent, and every strategic decision can be modeled with financial precision.

---

## Appendix A: The "Griller" Cost Calculation Model

| Component | Source | Formula / Logic |
|-----------|--------|-----------------|
| Live Weight | Sprint 1 `input_live_kg` | Base Quantity from Mass Balance |
| Live Price | Finance System | Base Price (€/kg) (e.g., €2.60) |
| Transport | Per-bird cost | €0.0764 per bird or calculated |
| Slaughter Fee | Fixed allocation | Labor (€0.12) + Overhead (€0.156) per head |
| Offal Credit | By-product NRV | Yield % × Market Price. Deducted from cost. |
| Moisture Loss | Physical loss | 0% value. Increases cost/kg. |
| Griller Yield | Output/Input | The Divisor (Output Weight / Input Weight) |

---

## Appendix B: The Primal Part Allocation Model (Vierkantsverwaarding)

| Part | Allocation Key (Price Vector) | Justification |
|------|------------------------------|---------------|
| Breast | High (e.g., Index 100) | Primary revenue driver. Absorbs bulk of cost. |
| Leg | Medium (e.g., Index 40) | Secondary driver. Price reflects "dark meat" discount. |
| Wing | Medium/Low (e.g., Index 30) | Volatile. Often linked to export or snack markets. |
| Back | Scrap (e.g., Index 5) | Mechanically De-boned Meat (MDM) source. Minimal absorption. |

---

## Appendix C: SKU Costing Build-Up

| Layer | Element | Source |
|-------|---------|--------|
| L1 | Meat Content | Allocated Part Cost / Deboning Yield |
| L2 | Additives | Spices, Marinades (BOM from `sku_bom`) |
| L3 | Packaging | Trays, Film, Labels, Boxes (BOM from `sku_bom`) |
| L4 | Direct Labor | Line speed / Crew size (Allocated per pack) |
| L5 | Factory Overhead | Fixed allocation per kg (e.g., "Dekking Zeewolde") |

---

## References

1. Slachtrendementen berekenen Max.xlsx
2. Bilderberg OKC okt 2025.xlsx
3. Cost Accounting and Control - Joint and By-Product Costing (Scribd)
4. Split-off Point Definition (SuperfastCPA)
5. Normal vs Abnormal Spoilage (CPA Review)
6. Activity-Based Costing in Meat Processing Industry (IDEAS/RePEc)
7. Poultry Byproduct Processing (AgEcon Search)

---

**END OF CANON**

*This document is READ-ONLY. Any modifications require explicit user authorization and a new version number.*
