CREATE TABLE commercial_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  customer_id UUID REFERENCES customers(id),
  batch_id UUID REFERENCES production_batches(id),
  product_id UUID REFERENCES products(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  metric_value DECIMAL(10,2),
  threshold_value DECIMAL(10,2),
  status VARCHAR(20) DEFAULT 'open',
  assigned_to VARCHAR(100),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
