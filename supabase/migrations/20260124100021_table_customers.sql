CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  segment VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  total_revenue_ytd DECIMAL(14,2) DEFAULT 0,
  last_balance_score DECIMAL(5,2),
  last_score_calculated_at TIMESTAMPTZ,
  is_cherry_picker BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
