CREATE TABLE batch_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
  cost_type VARCHAR(50) NOT NULL,
  description VARCHAR(255),
  amount DECIMAL(12,2) NOT NULL,
  per_unit VARCHAR(20),
  quantity DECIMAL(10,3),
  invoice_ref VARCHAR(100),
  invoice_date DATE,
  is_adjustment BOOLEAN DEFAULT false,
  adjusts_cost_id UUID REFERENCES batch_costs(id),
  adjustment_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(100)
);
