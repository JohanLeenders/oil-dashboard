-- Sprint 1: delivery_notes table
-- Source: Pakbonnen uit Flow Automation - commercial truth
-- This table stores delivery note (pakbon) data representing what was commercially shipped

CREATE TABLE IF NOT EXISTS delivery_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Batch linkage (optional - not always known at time of delivery)
  batch_id UUID REFERENCES production_batches(id) ON DELETE SET NULL,

  -- Delivery identification
  delivery_number TEXT NOT NULL,
  delivery_date DATE NOT NULL,

  -- Product identification
  sku TEXT NOT NULL,
  product_description TEXT,

  -- Quantities
  net_weight_kg DECIMAL(12,3) NOT NULL,
  gross_weight_kg DECIMAL(12,3),
  piece_count INTEGER,

  -- Customer (reference only, not FK - customer may not exist yet)
  customer_code TEXT,
  customer_name TEXT,

  -- Source tracking
  source_document_id TEXT,
  source_filename TEXT,
  synced_from TEXT DEFAULT 'flow_automation',
  upload_timestamp TIMESTAMPTZ DEFAULT now(),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Prevent duplicate entries for same delivery line
  UNIQUE (delivery_number, sku, delivery_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_delivery_notes_batch
  ON delivery_notes(batch_id);

CREATE INDEX IF NOT EXISTS idx_delivery_notes_date
  ON delivery_notes(delivery_date);

CREATE INDEX IF NOT EXISTS idx_delivery_notes_sku
  ON delivery_notes(sku);

CREATE INDEX IF NOT EXISTS idx_delivery_notes_delivery_number
  ON delivery_notes(delivery_number);

-- Comments
COMMENT ON TABLE delivery_notes IS
  'Sprint 1: Delivery note (pakbon) data from Flow Automation. Commercial truth for what was shipped.';

COMMENT ON COLUMN delivery_notes.batch_id IS
  'Link to production batch. May be NULL if batch cannot be determined from pakbon.';

COMMENT ON COLUMN delivery_notes.sku IS
  'Product SKU code. Use sku_part_mapping table to map to anatomical parts.';

COMMENT ON COLUMN delivery_notes.synced_from IS
  'Data source identifier. Default: flow_automation.';
