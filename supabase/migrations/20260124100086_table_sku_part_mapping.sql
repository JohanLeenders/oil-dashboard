-- Sprint 1: sku_part_mapping table
-- Maps commercial SKUs to anatomical parts for mass balance reconciliation
-- Temporary manual mapping allowed per Sprint 1 contract

CREATE TABLE IF NOT EXISTS sku_part_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- SKU identification
  sku TEXT NOT NULL UNIQUE,
  sku_description TEXT,

  -- Anatomical part mapping
  part_code TEXT NOT NULL,

  -- Confidence level for this mapping
  confidence TEXT NOT NULL DEFAULT 'manual'
    CHECK (confidence IN ('manual', 'inferred', 'verified')),

  -- Mapping metadata
  mapped_by TEXT,
  mapped_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT,

  -- Active flag for soft delete
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sku_part_mapping_sku
  ON sku_part_mapping(sku);

CREATE INDEX IF NOT EXISTS idx_sku_part_mapping_part_code
  ON sku_part_mapping(part_code);

CREATE INDEX IF NOT EXISTS idx_sku_part_mapping_active
  ON sku_part_mapping(is_active) WHERE is_active = true;

-- Trigger for updated_at
CREATE TRIGGER set_sku_part_mapping_updated_at
  BEFORE UPDATE ON sku_part_mapping
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
