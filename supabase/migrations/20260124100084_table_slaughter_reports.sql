-- Sprint 1: slaughter_reports table
-- Source: Slachtrendement-uploads (Map1) - batch truth
-- This table stores raw slaughter report data as uploaded from Storteboom

CREATE TABLE IF NOT EXISTS slaughter_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Batch reference
  batch_id UUID NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,

  -- Source document tracking
  source_document_id TEXT,
  source_filename TEXT,
  upload_timestamp TIMESTAMPTZ DEFAULT now(),

  -- Input weights (from slaughter report)
  input_live_kg DECIMAL(12,3) NOT NULL,
  input_count INTEGER NOT NULL,

  -- Category 2/3 losses (regulatory categories)
  cat2_kg DECIMAL(12,3) DEFAULT 0,
  cat3_kg DECIMAL(12,3) DEFAULT 0,

  -- Raw parts data as reported (JSON for flexibility)
  -- Structure: { "breast": 123.4, "leg": 234.5, ... }
  parts_raw JSONB,

  -- Metadata
  report_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Ensure one slaughter report per batch (can be corrected via new upload)
  UNIQUE (batch_id, source_document_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_slaughter_reports_batch
  ON slaughter_reports(batch_id);

CREATE INDEX IF NOT EXISTS idx_slaughter_reports_date
  ON slaughter_reports(report_date);

-- Comments
COMMENT ON TABLE slaughter_reports IS
  'Sprint 1: Raw slaughter report data from Storteboom uploads (Map1). Source of batch truth.';

COMMENT ON COLUMN slaughter_reports.parts_raw IS
  'Raw parts breakdown as JSON. Structure flexible to accommodate various report formats.';

COMMENT ON COLUMN slaughter_reports.cat2_kg IS
  'Category 2 material (regulatory classification) - animal byproducts for rendering.';

COMMENT ON COLUMN slaughter_reports.cat3_kg IS
  'Category 3 material (regulatory classification) - animal byproducts for petfood/technical use.';
