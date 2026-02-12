-- =============================================================================
-- Sprint 7: Part Valuation Table (Canonical Cost Engine)
-- =============================================================================
-- Purpose: Store allocated cost for each primal part per batch.
-- This is the result of SVASO allocation (Level 2).
--
-- Per canonical document Section 6.1:
-- "part_valuation: Stores the allocated cost for each primal part per batch."
-- =============================================================================

CREATE TABLE IF NOT EXISTS part_valuation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Batch reference
  batch_id UUID NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
  batch_valuation_id UUID REFERENCES batch_valuation(id) ON DELETE CASCADE,

  -- Part identification
  part_code VARCHAR(50) NOT NULL,
  part_name VARCHAR(100),

  -- Physical data
  weight_kg NUMERIC(12,2) NOT NULL,

  -- Standard price for allocation
  std_market_price_per_kg NUMERIC(10,4) NOT NULL,

  -- Market value calculation
  market_value_eur NUMERIC(12,2) NOT NULL,

  -- SVASO Allocation
  allocation_factor NUMERIC(10,6) NOT NULL,
  allocated_cost_per_kg NUMERIC(10,4) NOT NULL,
  allocated_cost_total_eur NUMERIC(12,2) NOT NULL,

  -- Theoretical margin (at standard price)
  theoretical_margin_eur NUMERIC(12,2),
  theoretical_margin_pct NUMERIC(6,2),

  -- Cost level (for tracking through hierarchy)
  cost_level INTEGER NOT NULL DEFAULT 2
    CHECK (cost_level IN (2, 3, 4)), -- Primal=2, Secondary=3, SKU=4

  -- Validation
  is_main_product BOOLEAN NOT NULL DEFAULT TRUE,

  -- Calculation metadata
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT part_valuation_unique_batch_part UNIQUE (batch_id, part_code, cost_level),
  CONSTRAINT part_valuation_weight_positive CHECK (weight_kg > 0),
  CONSTRAINT part_valuation_factor_range CHECK (allocation_factor >= 0 AND allocation_factor <= 1)
);

-- Indexes
CREATE INDEX idx_part_valuation_batch ON part_valuation(batch_id);
CREATE INDEX idx_part_valuation_part ON part_valuation(part_code);
CREATE INDEX idx_part_valuation_level ON part_valuation(cost_level);
CREATE INDEX idx_part_valuation_calculated ON part_valuation(calculated_at);
