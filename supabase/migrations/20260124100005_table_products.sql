CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_code VARCHAR(20) NOT NULL UNIQUE,
  storteboom_plu VARCHAR(20),
  description VARCHAR(255) NOT NULL,
  internal_name VARCHAR(100) NOT NULL,
  category product_category NOT NULL,
  anatomical_part anatomical_part,
  target_yield_min DECIMAL(5,2),
  target_yield_max DECIMAL(5,2),
  is_saleable BOOLEAN DEFAULT true,
  default_market_price_per_kg DECIMAL(10,2),
  packaging_type VARCHAR(50),
  standard_weight_kg DECIMAL(8,3),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
