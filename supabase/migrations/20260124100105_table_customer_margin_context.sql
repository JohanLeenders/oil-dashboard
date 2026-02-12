-- =============================================================================
-- Sprint 5: Customer Margin Context Table
-- =============================================================================
-- Purpose: Store precomputed margin context per customer/part for explanation.
-- This table provides the "why" behind margin numbers.
--
-- IMPORTANT: This table is for CONTEXT, not for calculations.
-- Actual margin calculations come from Sprint 2 NRV + sales data.
--
-- NOT FOR: Automatic pricing, customer scoring, optimization
-- =============================================================================

CREATE TABLE IF NOT EXISTS customer_margin_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Customer and part reference
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  part_code VARCHAR(50) NOT NULL,

  -- Period reference (for which this context was calculated)
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Revenue and cost figures (from Sprint 2 calculations)
  revenue_eur NUMERIC(12,2) NOT NULL,
  cost_eur NUMERIC(12,2) NOT NULL,
  margin_eur NUMERIC(12,2) NOT NULL,
  margin_pct NUMERIC(5,2),

  -- Volume context
  quantity_kg NUMERIC(10,2) NOT NULL,
  transaction_count INTEGER NOT NULL DEFAULT 0,

  -- Margin explanation (Dutch, for UI display)
  -- Explains WHY this margin exists in carcass context
  margin_explanation TEXT NOT NULL,

  -- Carcass context (from Sprint 4 alignment)
  customer_share_pct NUMERIC(5,2), -- Customer's share of this part
  carcass_share_pct NUMERIC(5,2),  -- Natural carcass share
  deviation_pct NUMERIC(5,2),       -- Deviation from carcass

  -- Data quality
  data_completeness VARCHAR(20) NOT NULL DEFAULT 'COMPLETE'
    CHECK (data_completeness IN ('COMPLETE', 'PARTIAL', 'ESTIMATED')),

  -- Calculation metadata
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  calculation_version VARCHAR(20) NOT NULL DEFAULT '1.0',

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT customer_margin_context_period_valid CHECK (period_start <= period_end),
  CONSTRAINT customer_margin_context_unique UNIQUE (customer_id, part_code, period_start, period_end)
);

-- Indexes for efficient lookups
CREATE INDEX idx_customer_margin_context_customer ON customer_margin_context(customer_id);
CREATE INDEX idx_customer_margin_context_part ON customer_margin_context(part_code);
CREATE INDEX idx_customer_margin_context_period ON customer_margin_context(period_start, period_end);
CREATE INDEX idx_customer_margin_context_calculated ON customer_margin_context(calculated_at);
