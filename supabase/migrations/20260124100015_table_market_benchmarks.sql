CREATE TABLE market_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  price_per_kg DECIMAL(10,2) NOT NULL,
  price_source VARCHAR(100),
  valid_from DATE NOT NULL,
  valid_until DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(100),
  CONSTRAINT chk_price_positive CHECK (price_per_kg > 0)
);
