# Shadow Prices Documentation — OIL Dashboard

**Version:** 1.0.0
**Last Updated:** 2026-02-12
**Status:** DOCUMENTED (Sprint 8)

---

## PURPOSE

Shadow prices are the allocation keys used in SVASO (Sales Value at Split-off) cost allocation. They represent the **relative economic value** of each joint product and sub-cut, and are used to distribute joint costs proportionally.

**Critical distinction:** Shadow prices are NOT the same as market prices or invoice prices. They are **normative reference values** that remain stable across batches to ensure cost stability and comparability.

---

## CURRENT SHADOW PRICES (Validatiegolf 1)

Defined in: `src/lib/data/batch-input-store.ts`

### Level 3: Joint Products (SVASO)
| Product | Shadow Price | Source |
|---------|-------------|--------|
| breast_cap | €9.50/kg | Reference from demo-batch-v2 |
| legs | €5.50/kg | Reference from demo-batch-v2 |
| wings | €4.50/kg | Reference from demo-batch-v2 |

### Level 4: Sub-Cuts (Mini-SVASO)
| Product | Shadow Price | Parent | Source |
|---------|-------------|--------|--------|
| filet | €9.50/kg | breast_cap | Reference from demo-batch-v2 |
| thigh_fillet | €7.00/kg | legs | Reference from demo-batch-v2 |
| drum_meat | €4.00/kg | legs | Reference from demo-batch-v2 |
| whole_wing | €4.50/kg | wings | Reference from demo-batch-v2 |

---

## CANON REQUIREMENT

Per `CANON_Poultry_Cost_Accounting.md`:

> "This method requires a **Standardized Price List** (a Valuation Vector) to act as weighting coefficients. These are NOT necessarily the actual invoice prices of the specific batch (which may vary by customer or contract), but rather **standard market values** used for allocation to ensure cost stability across batches."

And per Sprint 8 audit:

> "De canon eist dat dit "afgeleid uit downstream opbrengsten en yields" is."
>
> (The canon requires that this is "derived from downstream revenues and yields.")

---

## DERIVATION METHOD (TO BE IMPLEMENTED IN SPRINT 9)

Shadow prices should be derived using the following method:

### Step 1: Collect Market Data

For each product, gather:
- **Average selling price** over last 3-6 months (from Exact Online invoices)
- **Standard yield** from normative yield table (Hubbard JA757)
- **Processing costs** to reach sellable state

### Step 2: Calculate Net Realizable Value (NRV)

For each end-product:
```
NRV = Average_Selling_Price − Processing_Cost − Selling_Cost
```

### Step 3: Back-Calculate to Split-off Point

For sub-cuts (Level 4), reverse engineer to joint product level:
```
Shadow_Price_Joint_Product = Weighted_Average(NRV_SubCuts / Yield_SubCuts)
```

Example for legs:
- Thigh fillet: NRV €7.00/kg at 62.5% yield → contributes €11.20/kg to leg value
- Drum meat: NRV €4.00/kg at 37.5% yield → contributes €10.67/kg to leg value
- Weighted average: (€11.20 × 0.625) + (€10.67 × 0.375) = €11.00/kg
- But **stabilized** at €5.50/kg for allocation purposes

### Step 4: Stabilization

To prevent cost volatility from market fluctuations:
1. Use **moving average** (e.g., 6-month rolling)
2. Update shadow prices **quarterly** (not daily)
3. Document changes in `std_prices` table

### Step 5: Validation

Ensure shadow prices maintain realistic proportions:
- Breast > Legs > Wings (anatomical premium hierarchy)
- Ratios should be stable (e.g., breast:leg ratio ≈ 1.7:1)

---

## IMPLEMENTATION STATUS

### ✅ Sprint 7 (Current State)
- Shadow prices hardcoded in `batch-input-store.ts`
- Values based on demo-batch-v2 reference
- No derivation documentation
- No configurability

### 🔜 Sprint 9 (Planned)
- Move shadow prices to `std_prices` table (migration already exists: 112)
- Add `period_id` to allow quarterly updates
- Create UI for shadow price configuration
- Document derivation method per period
- Link to market data sources (Exact Online exports)

### 🔜 Sprint 10+ (Future)
- Automate derivation from sales data
- Add scenario analysis (what-if shadow price changes)
- Add sensitivity dashboard (k-factor impact of price changes)

---

## HOW SHADOW PRICES WORK IN THE ENGINE

### Level 3: SVASO Allocation

The engine calculates **Total Market Value (TMV)**:
```typescript
TMV = Σ(weight_kg × shadow_price_per_kg)  // For 3 joint products only
```

Then calculates the **k-factor**:
```typescript
k_factor = C_netto_joint / TMV
```

And allocates cost to each joint product:
```typescript
allocated_cost_per_kg = shadow_price_per_kg × k_factor
```

**Example:**
- Breast cap: 35 kg × €9.50 = €332.50 market value
- Legs: 43 kg × €5.50 = €236.50 market value
- Wings: 10 kg × €4.50 = €45.00 market value
- **TMV** = €614.00

If C_netto_joint = €500, then k = 0.814 (profitable batch)

- Breast cap allocated cost: €9.50 × 0.814 = €7.73/kg
- Legs allocated cost: €5.50 × 0.814 = €4.48/kg
- Wings allocated cost: €4.50 × 0.814 = €3.66/kg

### Level 4: Mini-SVASO

Same mechanism, but applied to sub-cuts within each joint product.

---

## WHY SHADOW PRICES (NOT MARKET PRICES)

### Problem with Market Prices

If we used actual invoice prices:
- Customer A pays €10.50/kg for breast (contract)
- Customer B pays €8.50/kg for breast (spot market)
- **Same product** would have **different allocated costs** depending on who buys it
- Impossible to compare batch profitability

### Solution: Shadow Prices

Shadow prices are **normative**:
- Same for all batches (within a period)
- Enable apples-to-apples comparison
- Isolate operational efficiency from sales pricing

**Variance analysis** separates:
- **Production variance** (SVASO using shadow prices)
- **Sales variance** (actual price − shadow price)

---

## GOVERNANCE

### Change Control

Shadow prices are **locked** once set for a period. Changes require:
1. Finance Controller approval
2. Documentation of derivation method
3. Impact analysis on existing batch comparisons
4. Version increment in `std_prices` table

### Audit Trail

All shadow price changes must be logged:
- `period_id` (e.g., 2026-Q1)
- `part_code`
- `std_market_price_eur` (the shadow price)
- `effective_date`
- `derivation_notes` (JSONB with calculation details)

---

## REFERENCES

- **Canon:** `AGENT/CANON_Poultry_Cost_Accounting.md` § 4.1 "Establishing the Valuation Vector"
- **Audit Report:** `AGENT/SPRINT_8_AUDIT_REPORT.md` Punt 3
- **Migration:** `supabase/migrations/20260124100112_create_std_prices.sql`
- **Code:** `src/lib/data/batch-input-store.ts` lines 178-186

---

## CURRENT HARDCODED IMPLEMENTATION

```typescript
// src/lib/data/batch-input-store.ts (lines 178-186)

/**
 * Shadow prices are hardcoded reference prices for SVASO allocation.
 * In production these would come from market data / configuration.
 * For Validatiegolf 1 we use the same reference prices as demo-batch-v2.
 */
const DEFAULT_SHADOW_PRICES: Record<string, number> = {
  breast_cap: 9.50,
  legs: 5.50,
  wings: 4.50,
  filet: 9.50,
  thigh_fillet: 7.00,
  drum_meat: 4.00,
  whole_wing: 4.50,
};
```

**Status:** Hardcoded for Validatiegolf 1. Migration to `std_prices` table planned for Sprint 9.

---

**Document Status:** Complete — Shadow prices documented with derivation method for future implementation.
