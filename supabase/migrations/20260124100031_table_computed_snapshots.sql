CREATE TABLE computed_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
  snapshot_type VARCHAR(50) NOT NULL,
  computed_data JSONB NOT NULL,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  is_stale BOOLEAN DEFAULT false,
  input_data_hash VARCHAR(64),
  UNIQUE(batch_id, snapshot_type)
);
