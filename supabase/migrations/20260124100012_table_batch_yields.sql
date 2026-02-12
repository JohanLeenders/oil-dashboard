CREATE TABLE batch_yields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
  anatomical_part anatomical_part NOT NULL,
  actual_weight_kg DECIMAL(10,3) NOT NULL,
  yield_pct DECIMAL(5,2),
  target_yield_min DECIMAL(5,2),
  target_yield_max DECIMAL(5,2),
  delta_from_target DECIMAL(5,2),
  measurement_source VARCHAR(50),
  measured_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  is_correction BOOLEAN DEFAULT false,
  corrects_yield_id UUID REFERENCES batch_yields(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(batch_id, anatomical_part, measured_at)
);
