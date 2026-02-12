CREATE TABLE production_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_ref VARCHAR(50) NOT NULL UNIQUE,
  slaughter_date DATE NOT NULL,
  live_weight_kg DECIMAL(12,3) NOT NULL,
  bird_count INTEGER NOT NULL,
  avg_bird_weight_kg DECIMAL(6,3) GENERATED ALWAYS AS (live_weight_kg / NULLIF(bird_count, 0)) STORED,
  griller_weight_kg DECIMAL(12,3),
  griller_yield_pct DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN live_weight_kg > 0
         THEN (griller_weight_kg / live_weight_kg) * 100
         ELSE NULL
    END
  ) STORED,
  rejection_kg DECIMAL(10,3) DEFAULT 0,
  slaughter_waste_kg DECIMAL(10,3) DEFAULT 0,
  production_date DATE,
  expiry_date DATE,
  status batch_status DEFAULT 'planned',
  total_batch_cost DECIMAL(12,2),
  forecast_griller_yield_pct DECIMAL(5,2) DEFAULT 70.70,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_griller_yield CHECK (griller_yield_pct IS NULL OR griller_yield_pct BETWEEN 0 AND 100),
  CONSTRAINT chk_live_weight CHECK (live_weight_kg > 0),
  CONSTRAINT chk_bird_count CHECK (bird_count > 0)
);
