-- Sprint 2: batch_splitoff_values table
-- Sales Value at Split-Off per batch and part
-- Used for joint cost allocation (NOT weight-based)

CREATE TABLE IF NOT EXISTS batch_splitoff_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Batch reference
  batch_id UUID NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,

  -- Part identification
  part_code TEXT NOT NULL,

  -- Sales value at split-off point
  -- This is the market value used for allocation, NOT actual sales
  sales_value_eur DECIMAL(12,2) NOT NULL,

  -- Derivation of sales value
  weight_kg DECIMAL(12,3) NOT NULL,
  price_per_kg DECIMAL(8,4) NOT NULL,

  -- Price source
  price_source TEXT NOT NULL DEFAULT 'market_benchmark'
    CHECK (price_source IN ('market_benchmark', 'contract', 'manual')),

  -- Validity date for price reference
  price_reference_date DATE,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT,

  -- One split-off value per batch per part
  UNIQUE (batch_id, part_code)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_batch_splitoff_values_batch
  ON batch_splitoff_values(batch_id);

CREATE INDEX IF NOT EXISTS idx_batch_splitoff_values_part
  ON batch_splitoff_values(part_code);
