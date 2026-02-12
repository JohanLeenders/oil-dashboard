-- Sprint 3: inventory_positions table
-- Tracks inventory snapshots per batch and part
-- This is OBSERVATIONAL - no actions, just visibility

CREATE TABLE IF NOT EXISTS inventory_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Batch reference (all inventory traceable to batch)
  batch_id UUID NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,

  -- Part identification
  part_code TEXT NOT NULL,

  -- Quantity in inventory
  quantity_kg DECIMAL(12,3) NOT NULL,

  -- Location (for future multi-location support)
  location TEXT NOT NULL DEFAULT 'main_warehouse',

  -- Snapshot timestamp
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  snapshot_timestamp TIMESTAMPTZ DEFAULT now(),

  -- Source of inventory data
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'system_sync', 'calculated')),

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_inventory_positions_batch
  ON inventory_positions(batch_id);

CREATE INDEX IF NOT EXISTS idx_inventory_positions_part
  ON inventory_positions(part_code);

CREATE INDEX IF NOT EXISTS idx_inventory_positions_date
  ON inventory_positions(snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_positions_location
  ON inventory_positions(location);

-- Unique constraint: one snapshot per batch/part/location/date
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_positions_unique
  ON inventory_positions(batch_id, part_code, location, snapshot_date);
