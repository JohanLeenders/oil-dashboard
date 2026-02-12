-- =============================================================================
-- Sprint 7: Batch Valuation Table (Canonical Cost Engine)
-- =============================================================================
-- Purpose: Store calculated Griller cost and k-factor per batch.
-- This is the core valuation record linking physical batch to financial value.
--
-- Per canonical document Section 6.1:
-- "batch_valuation: Stores the calculated Griller cost and k-factor per batch."
-- =============================================================================

CREATE TABLE IF NOT EXISTS batch_valuation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Batch reference
  batch_id UUID NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
  batch_ref TEXT NOT NULL,

  -- Level 0: Landed Cost
  input_live_kg NUMERIC(12,2) NOT NULL,
  input_count INTEGER NOT NULL,
  live_price_per_kg NUMERIC(10,4) NOT NULL,
  transport_cost_eur NUMERIC(10,2) NOT NULL DEFAULT 0,
  catching_fee_eur NUMERIC(10,2) NOT NULL DEFAULT 0,
  landed_cost_eur NUMERIC(12,2) NOT NULL,
  landed_cost_per_kg NUMERIC(10,4) NOT NULL,

  -- DOA handling
  doa_count INTEGER NOT NULL DEFAULT 0,
  usable_live_kg NUMERIC(12,2) NOT NULL,
  abnormal_doa_variance_eur NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- Level 1: Griller Cost
  slaughter_fee_eur NUMERIC(10,2) NOT NULL DEFAULT 0,
  by_product_credit_eur NUMERIC(10,2) NOT NULL DEFAULT 0,
  net_slaughter_cost_eur NUMERIC(12,2) NOT NULL,
  griller_weight_kg NUMERIC(12,2) NOT NULL,
  griller_yield_pct NUMERIC(5,2) NOT NULL,
  griller_cost_per_kg NUMERIC(10,4) NOT NULL,
  griller_cost_total_eur NUMERIC(12,2) NOT NULL,

  -- Level 2: SVASO Allocation
  total_market_value_eur NUMERIC(12,2),
  k_factor NUMERIC(10,6),
  k_factor_interpretation VARCHAR(20)
    CHECK (k_factor_interpretation IN ('PROFITABLE', 'BREAK_EVEN', 'LOSS')),

  -- Validation
  sum_allocation_factors NUMERIC(10,6),
  is_valid BOOLEAN NOT NULL DEFAULT TRUE,

  -- Calculation metadata
  price_period_id VARCHAR(20),
  calculation_version VARCHAR(20) NOT NULL DEFAULT '7.0',
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Audit trail (JSON for flexibility)
  audit_trail JSONB,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT batch_valuation_unique_batch UNIQUE (batch_id),
  CONSTRAINT batch_valuation_yield_range CHECK (griller_yield_pct >= 0 AND griller_yield_pct <= 100),
  CONSTRAINT batch_valuation_k_factor_positive CHECK (k_factor IS NULL OR k_factor >= 0)
);

-- Indexes
CREATE INDEX idx_batch_valuation_batch ON batch_valuation(batch_id);
CREATE INDEX idx_batch_valuation_calculated ON batch_valuation(calculated_at);
CREATE INDEX idx_batch_valuation_k_factor ON batch_valuation(k_factor);
CREATE INDEX idx_batch_valuation_valid ON batch_valuation(is_valid);
