-- =============================================================================
-- Sprint 6: Batch History Table
-- =============================================================================
-- Purpose: Store batch-level historical metrics for trend analysis.
-- This table enables time-based pattern analysis.
--
-- IMPORTANT: This is OBSERVATIONAL data for learning, not forecasting.
-- Trends are DESCRIPTIVE, not predictive.
--
-- NOT FOR: Forecasting, predictions, automatic optimization
-- =============================================================================

CREATE TABLE IF NOT EXISTS batch_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Batch reference
  batch_id UUID NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
  batch_ref TEXT NOT NULL,

  -- Time dimensions
  slaughter_date DATE NOT NULL,
  slaughter_week INTEGER NOT NULL,
  slaughter_month INTEGER NOT NULL,
  slaughter_quarter INTEGER NOT NULL,
  slaughter_year INTEGER NOT NULL,

  -- Season (for seasonal pattern analysis)
  season VARCHAR(20) NOT NULL CHECK (season IN ('Q1', 'Q2', 'Q3', 'Q4')),

  -- Key metrics snapshot (JSON for flexibility)
  key_metrics JSONB NOT NULL DEFAULT '{}',

  -- Individual metrics for efficient querying
  griller_yield_pct NUMERIC(5,2),
  total_cost_eur NUMERIC(12,2),
  total_revenue_eur NUMERIC(12,2),
  total_margin_eur NUMERIC(12,2),
  total_margin_pct NUMERIC(5,2),
  bird_count INTEGER,
  live_weight_kg NUMERIC(10,2),

  -- Part-level yields (for yield trend analysis)
  breast_cap_yield_pct NUMERIC(5,2),
  leg_quarter_yield_pct NUMERIC(5,2),
  wings_yield_pct NUMERIC(5,2),
  back_carcass_yield_pct NUMERIC(5,2),

  -- Data quality
  data_completeness VARCHAR(20) NOT NULL DEFAULT 'COMPLETE'
    CHECK (data_completeness IN ('COMPLETE', 'PARTIAL', 'ESTIMATED')),

  -- Snapshot metadata
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  snapshot_version VARCHAR(20) NOT NULL DEFAULT '1.0',

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT batch_history_unique_batch UNIQUE (batch_id)
);

-- Indexes for efficient trend queries
CREATE INDEX idx_batch_history_date ON batch_history(slaughter_date);
CREATE INDEX idx_batch_history_year_week ON batch_history(slaughter_year, slaughter_week);
CREATE INDEX idx_batch_history_year_month ON batch_history(slaughter_year, slaughter_month);
CREATE INDEX idx_batch_history_season ON batch_history(season, slaughter_year);
CREATE INDEX idx_batch_history_snapshot ON batch_history(snapshot_at);
