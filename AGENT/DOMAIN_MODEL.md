# DOMAIN_MODEL.md — Oranjehoen Commercial Domain

**Version:** 1.0.0
**Status:** AUTHORITATIVE
**Last Updated:** 2026-01-24

---

## 1. BUSINESS CONTEXT

### 1.1 What is Oranjehoen?
Oranjehoen is a poultry producer (slow-growing chicken breed) that:
- Outsources slaughter and processing to Storteboom.
- Sells whole birds and cut-up parts to B2B customers.
- Needs commercial visibility into margin, yield, and customer behavior.

### 1.2 Commercial Challenge
The "vierkantsverwaarding" (square valorization) problem:
- Every chicken produces fixed anatomical parts.
- Premium parts (filet) are high-margin but limited (~24% of bird).
- Rest parts (karkas, organen) must also be sold to achieve overall profitability.
- Some customers "cherry-pick" premium cuts only, disrupting the balance.

### 1.3 Dashboard Purpose
Enable commercial decisions about:
- Which customers are profitable vs. problematic?
- How does pricing affect overall margin?
- Where is inventory risk accumulating (THT)?
- Are yields on target or losing money?

---

## 2. CORE ENTITIES

### 2.1 SKU (Stock Keeping Unit)
```typescript
interface SKU {
  sku_code: string;           // Internal identifier (OH-FILET-VAC-001)
  storteboom_plu: string;     // External PLU code
  category: ProductCategory;   // hele_kip, filet, haas, dij, etc.
  anatomical_part?: AnatomicalPart;
  target_yield_min?: number;   // % of griller weight
  target_yield_max?: number;
  default_market_price_per_kg: number;
  is_saleable: boolean;
}
```

**Categories:**
- `hele_kip` - Whole griller
- `filet` - Breast fillet (premium)
- `haas` - Inner fillet (super premium)
- `dij` - Thigh meat
- `drumstick` - Whole drumstick
- `drumvlees` - Boneless drum meat
- `vleugels` - Wings
- `karkas` - Carcass/back
- `organen` - Offal (liver, gizzard, heart, neck)
- `vel` - Skin
- `kosten` - Cost pass-through (not saleable)
- `emballage` - Packaging (not saleable)

### 2.2 Customer
```typescript
interface Customer {
  customer_code: string;       // Exact Online debtor code
  name: string;
  segment: 'retail' | 'foodservice' | 'wholesale';
  total_revenue_ytd: number;
  last_balance_score: number;  // 0-100
  is_cherry_picker: boolean;
}
```

### 2.3 Batch (Production Batch)
```typescript
interface Batch {
  batch_ref: string;           // Lot number (P2520210)
  slaughter_date: Date;
  live_weight_kg: number;      // 100% basis
  bird_count: number;
  griller_weight_kg: number;   // After slaughter
  griller_yield_pct: number;   // Calculated
  rejection_kg: number;        // DOA + condemned
  slaughter_waste_kg: number;  // Blood, feathers
  production_date: Date;
  expiry_date: Date;           // THT
  status: BatchStatus;
  total_batch_cost: number;
}
```

### 2.4 Yield (Cut-Up Result)
```typescript
interface BatchYield {
  batch_id: UUID;
  anatomical_part: AnatomicalPart;
  actual_weight_kg: number;
  yield_pct: number;           // % of griller
  target_yield_min: number;
  target_yield_max: number;
  delta_from_target: number;
  is_correction: boolean;
  corrects_yield_id?: UUID;
}
```

**Anatomical Parts:**
- `breast_cap` - Breast cap (34.8-36.9% of griller)
- `leg_quarter` - Leg quarter (42.0-44.8% of griller)
- `wings` - Wings (10.6-10.8% of griller)
- `back_carcass` - Back/carcass (7.0-8.2% of griller)
- `offal` - Offal/organs

### 2.5 Sales Transaction
```typescript
interface SalesTransaction {
  customer_id: UUID;
  product_id: UUID;
  batch_id?: UUID;
  invoice_number: string;
  invoice_date: Date;
  quantity_kg: number;
  unit_price: number;
  line_total: number;          // Calculated
  allocated_cost?: number;     // SVASO
  gross_margin?: number;
  is_credit: boolean;
}
```

### 2.6 Time Dimension
```typescript
interface TimePeriod {
  date: Date;
  week: number;
  month: number;
  quarter: number;
  year: number;
  is_holiday: boolean;
}
```

### 2.7 Pricing Components
```typescript
interface PricingContext {
  base_market_price: number;   // Per kg
  customer_discount_pct: number;
  volume_tier: 'small' | 'medium' | 'large';
  effective_price: number;     // After discounts
}
```

---

## 3. CANONICAL CALCULATIONS

### 3.1 Margin

**Gross Margin (Line Level)**
```
gross_margin = revenue - allocated_cost
margin_pct = (gross_margin / revenue) × 100
```

**SVASO Cost Allocation**
```
market_value_i = weight_i × market_price_i
total_market_value = Σ(market_value_i)
allocation_factor_i = market_value_i / total_market_value
allocated_cost_i = total_batch_cost × allocation_factor_i
```

**Validation:** Σ(allocation_factor) MUST equal 1.0 (tolerance: 0.0001)

### 3.2 Yield

**Griller Yield (Level 1: Slaughter)**
```
griller_yield_pct = (griller_weight_kg / live_weight_kg) × 100
```
Expected range: 68-73%

**Cut-Up Yield (Level 2: Processing)**
```
part_yield_pct = (part_weight_kg / griller_weight_kg) × 100
```

**Yield Delta**
```
target_midpoint = (target_yield_min + target_yield_max) / 2
delta = actual_yield_pct - target_midpoint
```
- Positive delta = over-performing
- Negative delta = under-performing

### 3.3 Velocity

**Inventory Turnover**
```
turnover_rate = sold_kg / average_inventory_kg
days_on_hand = 365 / turnover_rate
```

**Weekly Velocity**
```
weekly_velocity = units_sold_this_week / units_sold_last_week
```
- >1.0 = accelerating
- <1.0 = decelerating

### 3.4 THT Pressure

**Elapsed Percentage**
```
total_days = expiry_date - production_date
elapsed_days = current_date - production_date
elapsed_pct = (elapsed_days / total_days) × 100
```

**THT Status** (LOCKED)
```
if elapsed_pct < 70: GREEN
elif elapsed_pct < 90: ORANGE
else: RED
```

**THT Pressure Score** (Aggregate)
```
pressure_score = Σ(inventory_value × risk_weight)
where:
  risk_weight = 0 for GREEN
  risk_weight = 1 for ORANGE
  risk_weight = 3 for RED
```

### 3.5 Cherry-Picker Score

**Balance Score** (0-100, higher = better)
```
actual_mix = { filet: x%, dij: y%, ... }
ideal_mix = anatomical_ratios from commercial_norms
deviation = Σ|actual_mix - ideal_mix|
balance_score = 100 - (deviation × scaling_factor)
```

**Cherry-Picker Flag**
```
is_cherry_picker =
  revenue_ytd > €10,000 AND
  filet_share > 30%
```

---

## 4. DECISIONS SUPPORTED

### 4.1 Customer Profitability
- Which customers generate positive margin?
- Which customers are cherry-pickers?
- What is the true cost of serving each customer (SVASO)?

### 4.2 Pricing Decisions
- What happens to margin if we raise/lower price by X%?
- Where are we leaving money on the table?
- Which SKUs are underpriced relative to market?

### 4.3 Inventory Risk
- Which batches are approaching THT?
- What is the financial exposure of orange/red inventory?
- Which products have slow velocity?

### 4.4 Yield Performance
- Are we hitting target yields?
- Which anatomical parts underperform?
- What is the cost of yield variance?

### 4.5 Product Mix
- What is our overall product mix vs. anatomical capacity?
- Are we selling enough rest-parts?
- What is the opportunity cost of unsold capacity?

---

## 5. OUT OF SCOPE

The following are explicitly NOT part of this dashboard:

### 5.1 Logistics
- Route planning
- Delivery scheduling
- Warehouse location optimization

### 5.2 Production Planning
- Slaughter scheduling
- Flock management
- Feed optimization

### 5.3 Financial Accounting
- P&L statements
- Balance sheets
- Tax calculations

### 5.4 CRM
- Customer contact management
- Sales pipeline
- Lead tracking

### 5.5 Sustainability (Deferred)
- CO2 footprint calculations
- Certification tracking
- Environmental reporting

*These may be added in future phases but are not in current scope.*

---

## 6. DATA SOURCES

### 6.1 Storteboom (Primary)
- Slaughter reports (weights, yields)
- Processing invoices
- Cost breakdowns

### 6.2 Exact Online (Planned)
- Customer master data
- Sales transactions
- Invoice history

### 6.3 Internal
- Product master (sku mapping)
- Commercial norms (anatomical ratios)
- Market benchmarks

---

## 7. GLOSSARY

| Term | Dutch | Definition |
|------|-------|------------|
| Griller | Griller | Whole dressed chicken (cold carcass) |
| Vierkantsverwaarding | Square valorization | Need to profitably sell all parts of the animal |
| THT | Houdbaarheidsdatum | Best-before date |
| SVASO | - | Sales Value at Split-off (cost allocation method) |
| Cherry-picker | - | Customer who only buys premium cuts |
| Yield | Rendement | Percentage of weight recovered after processing |
| Batch | Lot/Partij | Production run from slaughter |
| Anatomical ratio | Biologische ratio | Natural proportion of each cut in a chicken |

---

## 8. CONSTANTS

### 8.1 Yield Targets (Hubbard JA757)
| Part | Min % | Max % |
|------|-------|-------|
| breast_cap | 34.8 | 36.9 |
| leg_quarter | 42.0 | 44.8 |
| wings | 10.6 | 10.8 |
| back_carcass | 7.0 | 8.2 |

### 8.2 THT Thresholds (LOCKED)
| Status | Elapsed % |
|--------|-----------|
| GREEN | < 70% |
| ORANGE | 70-90% |
| RED | > 90% |

### 8.3 Cherry-Picker Thresholds
| Metric | Threshold |
|--------|-----------|
| Revenue minimum | €10,000 YTD |
| Filet share alert | > 30% |

---

*This document defines the commercial domain. All business logic must reference these definitions.*
