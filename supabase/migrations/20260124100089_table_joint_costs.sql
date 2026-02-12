-- Sprint 2: joint_costs table
-- Joint cost = ONLY live bird purchase per batch
-- This is the starting point for SVASO allocation

CREATE TABLE IF NOT EXISTS joint_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Batch reference
  batch_id UUID NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,

  -- Cost type (restricted to live_bird_purchase per Sprint 2 contract)
  cost_type TEXT NOT NULL DEFAULT 'live_bird_purchase'
    CHECK (cost_type = 'live_bird_purchase'),

  -- Amount
  amount_eur DECIMAL(12,2) NOT NULL,

  -- Per-unit breakdown (optional)
  cost_per_kg DECIMAL(8,4),
  cost_per_bird DECIMAL(8,4),

  -- Source tracking
  invoice_ref TEXT,
  invoice_date DATE,
  supplier TEXT,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT,

  -- One joint cost record per batch (can be updated via correction pattern)
  UNIQUE (batch_id, cost_type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_joint_costs_batch
  ON joint_costs(batch_id);
