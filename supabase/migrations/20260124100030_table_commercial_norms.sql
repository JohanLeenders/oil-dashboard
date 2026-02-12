CREATE TABLE commercial_norms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anatomical_part anatomical_part NOT NULL,
  product_category product_category NOT NULL,
  anatomical_ratio_pct DECIMAL(5,2) NOT NULL,
  cherry_picker_threshold_pct DECIMAL(5,2),
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
