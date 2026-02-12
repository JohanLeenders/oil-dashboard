-- Sprint 2: processing_costs table
-- Processing costs applied AFTER split-off for NRV calculation
-- These are NOT joint costs - they are added to allocated joint cost

CREATE TABLE IF NOT EXISTS processing_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Process step identifier
  process_step TEXT NOT NULL
    CHECK (process_step IN ('cutting', 'vacuum', 'portioning', 'packaging', 'other')),

  -- Cost rate
  cost_per_kg DECIMAL(8,4) NOT NULL,

  -- Applicability
  applies_to_part_code TEXT,  -- NULL = applies to all parts
  applies_to_sku TEXT,        -- NULL = applies to all SKUs for that part

  -- Source of cost rate
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'abc', 'contract')),

  -- Validity period
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_processing_costs_step
  ON processing_costs(process_step);

CREATE INDEX IF NOT EXISTS idx_processing_costs_part
  ON processing_costs(applies_to_part_code);

CREATE INDEX IF NOT EXISTS idx_processing_costs_valid
  ON processing_costs(valid_from, valid_until);

-- Trigger for updated_at
CREATE TRIGGER set_processing_costs_updated_at
  BEFORE UPDATE ON processing_costs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
