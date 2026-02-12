-- =============================================================================
-- Sprint 7: Standard Prices Table (Canonical Cost Engine)
-- =============================================================================
-- Purpose: The "Vierkantsverwaarding" price vectors for SVASO allocation.
-- This is the Allocation Key used to distribute joint costs.
--
-- Per canonical document Section 6.1:
-- "std_prices: The Vierkantsverwaarding price vectors. This is the Allocation Key."
--
-- CRITICAL: These are STANDARD prices for allocation, NOT invoice prices.
-- They ensure cost stability across batches.
-- =============================================================================

CREATE TABLE IF NOT EXISTS std_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Period identification
  period_id VARCHAR(20) NOT NULL, -- e.g., '2026-01', '2026-W04'
  period_type VARCHAR(10) NOT NULL DEFAULT 'month'
    CHECK (period_type IN ('week', 'month', 'quarter', 'year')),

  -- Part identification
  part_code VARCHAR(50) NOT NULL,
  part_name VARCHAR(100),

  -- Standard market price for allocation (EUR per kg)
  std_market_price_eur NUMERIC(10,4) NOT NULL, -- Negative values allowed for disposal costs (by-products)

  -- Price index relative to base (optional, for trending)
  price_index NUMERIC(6,2) DEFAULT 100.00,

  -- Source and validity
  source VARCHAR(100) NOT NULL DEFAULT 'market_benchmark',
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,

  -- Notes
  notes TEXT,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT std_prices_effective_dates CHECK (effective_to IS NULL OR effective_to > effective_from),
  CONSTRAINT std_prices_unique_period_part UNIQUE (period_id, part_code)
);

-- Indexes
CREATE INDEX idx_std_prices_period ON std_prices(period_id);
CREATE INDEX idx_std_prices_part ON std_prices(part_code);
CREATE INDEX idx_std_prices_effective ON std_prices(effective_from, effective_to);

-- Insert canonical price data (baseline)
INSERT INTO std_prices (period_id, period_type, part_code, part_name, std_market_price_eur, source, notes)
VALUES
  -- Main products (SVASO allocation)
  ('2026-01', 'month', 'breast_cap', 'Filet', 9.50, 'market_benchmark', 'High value - primary revenue driver'),
  ('2026-01', 'month', 'leg_quarter', 'Poot', 5.50, 'market_benchmark', 'Medium value - secondary driver'),
  ('2026-01', 'month', 'wings', 'Vleugels', 4.50, 'market_benchmark', 'Medium/Low value - export market dependent'),
  ('2026-01', 'month', 'back_carcass', 'Rug/karkas', 0.50, 'market_benchmark', 'Low value - MDM source'),

  -- By-products (NRV treatment)
  ('2026-01', 'month', 'blood', 'Bloed', 0.05, 'market_benchmark', 'By-product for blood meal'),
  ('2026-01', 'month', 'feathers', 'Veren', -0.02, 'market_benchmark', 'By-product - disposal cost'),
  ('2026-01', 'month', 'offal', 'Slachtafval', 0.15, 'market_benchmark', 'Hearts, livers, gizzards'),
  ('2026-01', 'month', 'bone', 'Botten', 0.09, 'market_benchmark', 'Bones for rendering'),
  ('2026-01', 'month', 'skin', 'Huid', 0.02, 'market_benchmark', 'Skin for rendering'),
  ('2026-01', 'month', 'cat3_waste', 'Cat III Afval', -0.10, 'market_benchmark', 'Category III - disposal cost')
ON CONFLICT DO NOTHING;
