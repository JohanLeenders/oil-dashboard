-- ============================================================
-- COMBINED MIGRATIONS - Generated 2026-02-12 15:28:52
-- Total files: 118
-- ============================================================


-- ============================================================
-- MIGRATION 1: 20260124100000_extensions.sql
-- ============================================================

-- ============================================================================
-- OIL (Oranjehoen Intelligence Layer) - Extensions
-- Migration: Extensions only
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================
-- MIGRATION 2: 20260124100001_enums_product_category.sql
-- ============================================================

-- ============================================================================
-- OIL (Oranjehoen Intelligence Layer) - Enum Types
-- Migration: Product category enum
-- ============================================================================

-- Product categorieën conform Hoofdstuk 6 TRD
CREATE TYPE product_category AS ENUM (
  'hele_kip',        -- Griller / Hele Kip
  'filet',           -- Borstfilet (premium)
  'haas',            -- Kippenhaasje / Inner fillet
  'dij',             -- Dijvlees
  'drumstick',       -- Drumstick (heel)
  'drumvlees',       -- Drumvlees (ontbeend)
  'vleugels',        -- Vleugels
  'karkas',          -- Rest/Karkas (Dijana, Naakt)
  'organen',         -- Lever, Maag, Hart, Nek
  'vel',             -- Huidvel (Cat 3/verwerking)
  'kosten',          -- Doorbelasting snijkosten etc.
  'emballage'        -- Kratten/fust
);


-- ============================================================
-- MIGRATION 3: 20260124100002_enums_anatomical.sql
-- ============================================================

-- ============================================================================
-- OIL - Enum Types (continued)
-- Migration: Anatomical part enum
-- ============================================================================

-- Anatomische delen voor yield tracking (Niveau 2: Cut-Up)
CREATE TYPE anatomical_part AS ENUM (
  'breast_cap',      -- Borstkap (34.8% - 36.9% van griller)
  'leg_quarter',     -- Achterkwartier (42.0% - 44.8% van griller)
  'wings',           -- Vleugels (10.6% - 10.8% van griller)
  'back_carcass',    -- Rug/Karkas (7.0% - 8.2% van griller)
  'offal'            -- Organen (nekken, lever, maag, hart)
);


-- ============================================================
-- MIGRATION 4: 20260124100003_enums_tht_status.sql
-- ============================================================

-- ============================================================================
-- OIL - Enum Types (continued)
-- Migration: THT status enum
-- ============================================================================

-- THT status voor voorraad (Blueprint Spec)
CREATE TYPE tht_status AS ENUM (
  'green',   -- < 70% verstreken
  'orange',  -- 70-90% verstreken
  'red'      -- > 90% verstreken
);


-- ============================================================
-- MIGRATION 5: 20260124100004_enums_batch_status.sql
-- ============================================================

-- ============================================================================
-- OIL - Enum Types (continued)
-- Migration: Batch status enum
-- ============================================================================

-- Batch status
CREATE TYPE batch_status AS ENUM (
  'planned',
  'slaughtered',
  'cut_up',
  'in_sales',
  'closed'
);


-- ============================================================
-- MIGRATION 6: 20260124100005_table_products.sql
-- ============================================================

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


-- ============================================================
-- MIGRATION 7: 20260124100006_idx_products_plu.sql
-- ============================================================

CREATE INDEX idx_products_storteboom_plu ON products(storteboom_plu);


-- ============================================================
-- MIGRATION 8: 20260124100007_idx_products_category.sql
-- ============================================================

CREATE INDEX idx_products_category ON products(category);


-- ============================================================
-- MIGRATION 9: 20260124100008_table_production_batches.sql
-- ============================================================

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


-- ============================================================
-- MIGRATION 10: 20260124100009_idx_batches_date.sql
-- ============================================================

CREATE INDEX idx_batches_slaughter_date ON production_batches(slaughter_date);


-- ============================================================
-- MIGRATION 11: 20260124100010_idx_batches_status.sql
-- ============================================================

CREATE INDEX idx_batches_status ON production_batches(status);


-- ============================================================
-- MIGRATION 12: 20260124100011_idx_batches_expiry.sql
-- ============================================================

CREATE INDEX idx_batches_expiry ON production_batches(expiry_date);


-- ============================================================
-- MIGRATION 13: 20260124100012_table_batch_yields.sql
-- ============================================================

CREATE TABLE batch_yields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
  anatomical_part anatomical_part NOT NULL,
  actual_weight_kg DECIMAL(10,3) NOT NULL,
  yield_pct DECIMAL(5,2),
  target_yield_min DECIMAL(5,2),
  target_yield_max DECIMAL(5,2),
  delta_from_target DECIMAL(5,2),
  measurement_source VARCHAR(50),
  measured_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  is_correction BOOLEAN DEFAULT false,
  corrects_yield_id UUID REFERENCES batch_yields(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(batch_id, anatomical_part, measured_at)
);


-- ============================================================
-- MIGRATION 14: 20260124100013_idx_yields_batch.sql
-- ============================================================

CREATE INDEX idx_batch_yields_batch ON batch_yields(batch_id);


-- ============================================================
-- MIGRATION 15: 20260124100014_idx_yields_part.sql
-- ============================================================

CREATE INDEX idx_batch_yields_part ON batch_yields(anatomical_part);


-- ============================================================
-- MIGRATION 16: 20260124100015_table_market_benchmarks.sql
-- ============================================================

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


-- ============================================================
-- MIGRATION 17: 20260124100016_idx_benchmarks_product.sql
-- ============================================================

CREATE INDEX idx_benchmarks_product ON market_benchmarks(product_id);


-- ============================================================
-- MIGRATION 18: 20260124100017_idx_benchmarks_valid.sql
-- ============================================================

CREATE INDEX idx_benchmarks_valid ON market_benchmarks(valid_from, valid_until);


-- ============================================================
-- MIGRATION 19: 20260124100018_table_batch_costs.sql
-- ============================================================

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


-- ============================================================
-- MIGRATION 20: 20260124100019_idx_costs_batch.sql
-- ============================================================

CREATE INDEX idx_batch_costs_batch ON batch_costs(batch_id);


-- ============================================================
-- MIGRATION 21: 20260124100020_idx_costs_type.sql
-- ============================================================

CREATE INDEX idx_batch_costs_type ON batch_costs(cost_type);


-- ============================================================
-- MIGRATION 22: 20260124100021_table_customers.sql
-- ============================================================

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


-- ============================================================
-- MIGRATION 23: 20260124100022_idx_customers_code.sql
-- ============================================================

CREATE INDEX idx_customers_code ON customers(customer_code);


-- ============================================================
-- MIGRATION 24: 20260124100023_idx_customers_cherry.sql
-- ============================================================

CREATE INDEX idx_customers_cherry ON customers(is_cherry_picker) WHERE is_cherry_picker = true;


-- ============================================================
-- MIGRATION 25: 20260124100024_table_sales_transactions.sql
-- ============================================================

CREATE TABLE sales_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  product_id UUID NOT NULL REFERENCES products(id),
  batch_id UUID REFERENCES production_batches(id),
  invoice_number VARCHAR(50) NOT NULL,
  invoice_date DATE NOT NULL,
  quantity_kg DECIMAL(10,3) NOT NULL,
  quantity_pieces INTEGER,
  unit_price DECIMAL(10,2) NOT NULL,
  line_total DECIMAL(12,2) GENERATED ALWAYS AS (quantity_kg * unit_price) STORED,
  allocated_cost DECIMAL(12,2),
  gross_margin DECIMAL(12,2),
  margin_pct DECIMAL(5,2),
  batch_ref_source VARCHAR(50),
  is_credit BOOLEAN DEFAULT false,
  credits_transaction_id UUID REFERENCES sales_transactions(id),
  credit_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced_from VARCHAR(50),
  CONSTRAINT chk_quantity_positive CHECK (quantity_kg > 0)
);


-- ============================================================
-- MIGRATION 26: 20260124100025_idx_sales_customer.sql
-- ============================================================

CREATE INDEX idx_sales_customer ON sales_transactions(customer_id);


-- ============================================================
-- MIGRATION 27: 20260124100026_idx_sales_product.sql
-- ============================================================

CREATE INDEX idx_sales_product ON sales_transactions(product_id);


-- ============================================================
-- MIGRATION 28: 20260124100027_idx_sales_batch.sql
-- ============================================================

CREATE INDEX idx_sales_batch ON sales_transactions(batch_id);


-- ============================================================
-- MIGRATION 29: 20260124100028_idx_sales_date.sql
-- ============================================================

CREATE INDEX idx_sales_date ON sales_transactions(invoice_date);


-- ============================================================
-- MIGRATION 30: 20260124100029_idx_sales_invoice.sql
-- ============================================================

CREATE INDEX idx_sales_invoice ON sales_transactions(invoice_number);


-- ============================================================
-- MIGRATION 31: 20260124100030_table_commercial_norms.sql
-- ============================================================

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


-- ============================================================
-- MIGRATION 32: 20260124100031_table_computed_snapshots.sql
-- ============================================================

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


-- ============================================================
-- MIGRATION 33: 20260124100032_idx_snapshots_batch.sql
-- ============================================================

CREATE INDEX idx_snapshots_batch ON computed_snapshots(batch_id);


-- ============================================================
-- MIGRATION 34: 20260124100033_idx_snapshots_stale.sql
-- ============================================================

CREATE INDEX idx_snapshots_stale ON computed_snapshots(is_stale) WHERE is_stale = true;


-- ============================================================
-- MIGRATION 35: 20260124100034_table_commercial_signals.sql
-- ============================================================

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


-- ============================================================
-- MIGRATION 36: 20260124100035_idx_signals_type.sql
-- ============================================================

CREATE INDEX idx_signals_type ON commercial_signals(signal_type);


-- ============================================================
-- MIGRATION 37: 20260124100036_idx_signals_status.sql
-- ============================================================

CREATE INDEX idx_signals_status ON commercial_signals(status);


-- ============================================================
-- MIGRATION 38: 20260124100037_idx_signals_customer.sql
-- ============================================================

CREATE INDEX idx_signals_customer ON commercial_signals(customer_id);


-- ============================================================
-- MIGRATION 39: 20260124100038_idx_signals_batch.sql
-- ============================================================

CREATE INDEX idx_signals_batch ON commercial_signals(batch_id);


-- ============================================================
-- MIGRATION 40: 20260124100039_view_mass_balance.sql
-- ============================================================

CREATE VIEW v_batch_mass_balance AS
SELECT
  b.id AS batch_id,
  b.batch_ref,
  b.slaughter_date,
  b.live_weight_kg AS source_live_weight,
  b.rejection_kg AS loss_rejection,
  b.slaughter_waste_kg AS loss_slaughter,
  b.griller_weight_kg AS node_griller,
  COALESCE(y.breast_cap_kg, 0) AS node_breast_cap,
  COALESCE(y.leg_quarter_kg, 0) AS node_leg_quarter,
  COALESCE(y.wings_kg, 0) AS node_wings,
  COALESCE(y.back_carcass_kg, 0) AS node_back_carcass,
  COALESCE(y.offal_kg, 0) AS node_offal,
  b.griller_weight_kg - (
    COALESCE(y.breast_cap_kg, 0) +
    COALESCE(y.leg_quarter_kg, 0) +
    COALESCE(y.wings_kg, 0) +
    COALESCE(y.back_carcass_kg, 0) +
    COALESCE(y.offal_kg, 0)
  ) AS loss_unaccounted
FROM production_batches b
LEFT JOIN LATERAL (
  SELECT
    SUM(CASE WHEN anatomical_part = 'breast_cap' THEN actual_weight_kg END) AS breast_cap_kg,
    SUM(CASE WHEN anatomical_part = 'leg_quarter' THEN actual_weight_kg END) AS leg_quarter_kg,
    SUM(CASE WHEN anatomical_part = 'wings' THEN actual_weight_kg END) AS wings_kg,
    SUM(CASE WHEN anatomical_part = 'back_carcass' THEN actual_weight_kg END) AS back_carcass_kg,
    SUM(CASE WHEN anatomical_part = 'offal' THEN actual_weight_kg END) AS offal_kg
  FROM batch_yields by2
  WHERE by2.batch_id = b.id
    AND by2.is_correction = false
  GROUP BY by2.batch_id
) y ON true;


-- ============================================================
-- MIGRATION 41: 20260124100040_function_updated_at.sql
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- MIGRATION 42: 20260124100041_trigger_products.sql
-- ============================================================

CREATE TRIGGER trg_products_updated
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- MIGRATION 43: 20260124100042_trigger_batches.sql
-- ============================================================

CREATE TRIGGER trg_batches_updated
  BEFORE UPDATE ON production_batches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- MIGRATION 44: 20260124100043_trigger_customers.sql
-- ============================================================

CREATE TRIGGER trg_customers_updated
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- MIGRATION 45: 20260124100044_trigger_signals.sql
-- ============================================================

CREATE TRIGGER trg_signals_updated
  BEFORE UPDATE ON commercial_signals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- MIGRATION 46: 20260124100045_comment_products.sql
-- ============================================================

COMMENT ON TABLE products IS 'SKU master met Storteboom PLU mapping (Hoofdstuk 6 TRD)';


-- ============================================================
-- MIGRATION 47: 20260124100046_comment_batches.sql
-- ============================================================

COMMENT ON TABLE production_batches IS 'Slachtbatches - kern van massabalans (Append-only)';


-- ============================================================
-- MIGRATION 48: 20260124100047_comment_yields.sql
-- ============================================================

COMMENT ON TABLE batch_yields IS 'Cut-up yields per anatomisch deel (Niveau 2, Append-only)';


-- ============================================================
-- MIGRATION 49: 20260124100048_comment_benchmarks.sql
-- ============================================================

COMMENT ON TABLE market_benchmarks IS 'Marktprijzen voor SVASO berekening (Append-only)';


-- ============================================================
-- MIGRATION 50: 20260124100049_comment_costs.sql
-- ============================================================

COMMENT ON TABLE batch_costs IS 'Kosten per batch incl. nabelastingen (Append-only)';


-- ============================================================
-- MIGRATION 51: 20260124100050_comment_sales.sql
-- ============================================================

COMMENT ON TABLE sales_transactions IS 'Verkooptransacties (Append-only met credit mechanisme)';


-- ============================================================
-- MIGRATION 52: 20260124100051_comment_customers.sql
-- ============================================================

COMMENT ON TABLE customers IS 'Klanten met Cherry-Picker metrics';


-- ============================================================
-- MIGRATION 53: 20260124100052_comment_norms.sql
-- ============================================================

COMMENT ON TABLE commercial_norms IS 'Biologische ratio thresholds voor balance score';


-- ============================================================
-- MIGRATION 54: 20260124100053_comment_snapshots.sql
-- ============================================================

COMMENT ON TABLE computed_snapshots IS 'Cache voor berekende waarden (niet source of truth)';


-- ============================================================
-- MIGRATION 55: 20260124100054_comment_signals.sql
-- ============================================================

COMMENT ON TABLE commercial_signals IS 'Alerts en acties voor commercieel team (Phase 2)';


-- ============================================================
-- MIGRATION 56: 20260124100055_comment_view.sql
-- ============================================================

COMMENT ON VIEW v_batch_mass_balance IS 'Sankey-ready view voor massabalans visualisatie';


-- ============================================================
-- MIGRATION 57: 20260124100056_function_tht_status.sql
-- ============================================================

CREATE OR REPLACE FUNCTION calc_tht_status(
  production_date DATE,
  expiry_date DATE,
  check_date DATE DEFAULT CURRENT_DATE
) RETURNS tht_status AS $$
DECLARE
  total_days INTEGER;
  elapsed_days INTEGER;
  pct_elapsed DECIMAL;
BEGIN
  IF expiry_date IS NULL OR production_date IS NULL THEN
    RETURN 'green';
  END IF;

  total_days := expiry_date - production_date;
  elapsed_days := check_date - production_date;

  IF total_days <= 0 THEN
    RETURN 'red';
  END IF;

  pct_elapsed := (elapsed_days::DECIMAL / total_days) * 100;

  -- Blueprint Spec: Green <70%, Orange 70-90%, Red >90%
  IF pct_elapsed >= 90 THEN
    RETURN 'red';
  ELSIF pct_elapsed >= 70 THEN
    RETURN 'orange';
  ELSE
    RETURN 'green';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- ============================================================
-- MIGRATION 58: 20260124100057_comment_function.sql
-- ============================================================

COMMENT ON FUNCTION calc_tht_status IS 'Bereken THT kleur (green/orange/red) op basis van % verstreken';


-- ============================================================
-- MIGRATION 59: 20260124100058_seed_products.sql
-- ============================================================

INSERT INTO products (sku_code, storteboom_plu, description, internal_name, category, anatomical_part, target_yield_min, target_yield_max, is_saleable, default_market_price_per_kg, packaging_type, standard_weight_kg, notes) VALUES
('OH-HELE-001', '11002045', 'Oranjehoen Hele Kip JH 1ST', 'Griller / Hele Kip', 'hele_kip', NULL, NULL, NULL, true, 6.50, 'Per stuk', 2.00, 'Basisartikel, vaak per stuk afgerekend'),
('OH-FILET-VAC-001', '540457', 'BLK1STER Oranje Hoen Kip Filet Vac', 'Borstfilet Vacuüm', 'filet', 'breast_cap', 34.80, 36.90, true, 9.50, 'Vacuüm', NULL, 'Premium vacuüm verpakt'),
('OH-FILET-BULK-001', '528073', 'BLK1STER Oranje Hoen Kip Filet', 'Borstfilet Bulk', 'filet', 'breast_cap', 34.80, 36.90, true, 9.00, 'Bulk/Krat', NULL, 'Bulk verpakking'),
('OH-FILET-VAC-002', '540617', 'BLK1STER Oranje Hoen Kip Filet Vac', 'Borstfilet Vacuüm Variant', 'filet', 'breast_cap', 34.80, 36.90, true, 9.50, 'Vacuüm', NULL, 'Variant code'),
('OH-FILET-HALF-001', '539574', 'Oranje Hoen FltHlf zV+H vrs 15kg', 'Filet Helft zonder Vel+Haas', 'filet', 'breast_cap', NULL, NULL, true, 10.00, 'Bulk 15kg', 15.00, 'Filet helft zonder vel en haas'),
('OH-BORST-KAL-001', '325016', 'BLK1Ster OH KipBorst vrs700-750', 'Gekalibreerde Borstkap', 'filet', 'breast_cap', NULL, NULL, true, 8.50, 'Gekalibreerd', 0.725, 'Gekalibreerd 700-750g'),
('OH-HAAS-VAC-001', '514298', 'BLK1STER Oranje Hoen Kip Haas Vac', 'Kippenhaasje', 'haas', 'breast_cap', NULL, NULL, true, 11.00, 'Vacuüm', NULL, 'Inner fillet - premium bijproduct'),
('OH-DIJ-VAC-001', '392940', 'BLK1STER Oranje Hoen Kip DijVls Vac', 'Dijvlees Vacuüm', 'dij', 'leg_quarter', 42.00, 44.80, true, 7.50, 'Vacuüm', NULL, 'Kritiek dark meat product'),
('OH-DIJ-BULK-001', '392865', 'BLK1STER Oranje Hoen Kip DijVls', 'Dijvlees Bulk', 'dij', 'leg_quarter', 42.00, 44.80, true, 7.00, 'Bulk', NULL, 'Bulk verpakking'),
('OH-DRUM-001', '442140', 'BLK1STER Oranje Hoen Kip Drumst', 'Drumstick', 'drumstick', 'leg_quarter', NULL, NULL, true, 7.00, 'Standaard', NULL, 'Hele drumstick'),
('OH-DRUM-BULK-001', '442133', 'BLK1Ster OH Drumst vrs 10kg kr', 'Drumstick Bulk 10kg', 'drumstick', 'leg_quarter', NULL, NULL, true, 6.80, 'Bulk 10kg krat', 10.00, 'Bulk verpakking'),
('OH-DRUMVL-VAC-001', '430574', 'BLK1STER OH Kip Drumvlees Vac 15kg', 'Drumvlees Vacuüm 15kg', 'drumvlees', 'leg_quarter', NULL, NULL, true, 8.00, 'Vacuüm 15kg', 15.00, 'Ontbeende drum - ca. 62.5% vleesrendement'),
('OH-DRUMVL-001', '430444', 'BLK1STER Oranje Hoen Kip Drumvlees', 'Drumvlees', 'drumvlees', 'leg_quarter', NULL, NULL, true, 7.80, 'Standaard', NULL, 'Ontbeende drumstick'),
('OH-VLEUGEL-001', '382750', 'BLK1Ster OH VleugelzTip vrs 10kg kr', 'Vleugels zonder Tip', 'vleugels', 'wings', 10.60, 10.80, true, 5.50, 'Bulk 10kg krat', 10.00, 'Vleugel zonder tip (2-ledig)'),
('OH-DIJANA-001', '400553', 'BLK1Ster OH Dijana vrs 10kg kr', 'Karkas Dijana', 'karkas', 'back_carcass', 7.00, 8.20, true, 2.50, 'Bulk 10kg krat', 10.00, 'Achterkwartier karkas na uitbenen dij'),
('OH-NAAKT-001', '400577', 'BLK1Ster OH Naakt vrs 8x1700-1800', 'Karkas Naakt', 'karkas', 'back_carcass', 7.00, 8.20, true, 2.00, 'Per 8 stuks', 1.75, 'Heel karkas/rug'),
('OH-VEL-001', '849079', 'BLK1STER Oranje Hoen Kip Vel', 'Kippenvel', 'vel', NULL, NULL, NULL, true, 1.00, 'Bulk', NULL, 'Reststroom (Cat 3 of verwerking)'),
('OH-LEVER-001', '656196', 'BLK1Ster OH Lever Hum vrs 10kg kr', 'Lever', 'organen', 'offal', NULL, NULL, true, 4.00, 'Bulk 10kg krat', 10.00, 'Humaan gebruik'),
('OH-MAAG-001', '646098', 'BLK1Ster OH Maag Hum vrs 10kg kr', 'Maag', 'organen', 'offal', NULL, NULL, true, 3.50, 'Bulk 10kg krat', 10.00, 'Humaan gebruik'),
('OH-HART-001', '636044', 'BLK1Ster OH Hart Humaan vrs 10kg kr', 'Hart', 'organen', 'offal', NULL, NULL, true, 4.50, 'Bulk 10kg krat', 10.00, 'Humaan gebruik'),
('OH-HALS-001', '608225', 'BLK1Ster OH Hals Hum vrs 10kg', 'Hals/Nek', 'organen', 'offal', 1.80, 2.10, true, 2.00, 'Bulk 10kg', 10.00, 'Humaan gebruik'),
('OH-SNIJKOSTEN', '601042', 'Doorbelasting snijkosten / vacumeerkosten', 'Snijkosten', 'kosten', NULL, NULL, NULL, false, NULL, NULL, NULL, 'Let op: Directe kostentoewijzing aan batch'),
('OH-KRAT-BLAUW', '978007', 'Krat 60x40x15 blauw 2SS PLB', 'Krat CBL', 'emballage', NULL, NULL, NULL, false, NULL, NULL, NULL, 'CBL fust'),
('OH-KRAT-GROEN', '978359', 'Krat Storteboom groen PLG', 'Krat Storteboom', 'emballage', NULL, NULL, NULL, false, NULL, NULL, NULL, 'Intern fust');


-- ============================================================
-- MIGRATION 60: 20260124100059_seed_commercial_norms.sql
-- ============================================================

INSERT INTO commercial_norms (anatomical_part, product_category, anatomical_ratio_pct, cherry_picker_threshold_pct, notes) VALUES
('breast_cap', 'filet', 24.00, 30.00, 'Filet: ~24% op levend gewicht beschikbaar. Alert als klant > 30% afneemt.'),
('breast_cap', 'haas', 2.50, 5.00, 'Haas: ~2.5% beschikbaar'),
('leg_quarter', 'dij', 14.00, 20.00, 'Dijvlees: ~14% beschikbaar'),
('leg_quarter', 'drumstick', 12.00, 18.00, 'Drumstick: ~12% beschikbaar'),
('leg_quarter', 'drumvlees', 7.50, 12.00, 'Drumvlees (ontbeend): ~7.5% (62.5% vleesrendement van drum)'),
('wings', 'vleugels', 10.70, 15.00, 'Vleugels: 10.6-10.8% beschikbaar'),
('back_carcass', 'karkas', 7.50, 12.00, 'Karkas/rug: 7-8.2% beschikbaar'),
('offal', 'organen', 5.00, 8.00, 'Totaal organen (lever/maag/hart/nek): ~5% beschikbaar');


-- ============================================================
-- MIGRATION 61: 20260124100060_seed_market_benchmarks.sql
-- ============================================================

INSERT INTO market_benchmarks (product_id, price_per_kg, price_source, valid_from) VALUES
((SELECT id FROM products WHERE sku_code = 'OH-FILET-VAC-001'), 9.50, 'initial_setup', CURRENT_DATE),
((SELECT id FROM products WHERE sku_code = 'OH-FILET-BULK-001'), 9.00, 'initial_setup', CURRENT_DATE),
((SELECT id FROM products WHERE sku_code = 'OH-HAAS-VAC-001'), 11.00, 'initial_setup', CURRENT_DATE),
((SELECT id FROM products WHERE sku_code = 'OH-DIJ-VAC-001'), 7.50, 'initial_setup', CURRENT_DATE),
((SELECT id FROM products WHERE sku_code = 'OH-DIJ-BULK-001'), 7.00, 'initial_setup', CURRENT_DATE),
((SELECT id FROM products WHERE sku_code = 'OH-DRUM-001'), 7.00, 'initial_setup', CURRENT_DATE),
((SELECT id FROM products WHERE sku_code = 'OH-DRUM-BULK-001'), 6.80, 'initial_setup', CURRENT_DATE),
((SELECT id FROM products WHERE sku_code = 'OH-DRUMVL-VAC-001'), 8.00, 'initial_setup', CURRENT_DATE),
((SELECT id FROM products WHERE sku_code = 'OH-VLEUGEL-001'), 5.50, 'initial_setup', CURRENT_DATE),
((SELECT id FROM products WHERE sku_code = 'OH-DIJANA-001'), 2.50, 'initial_setup', CURRENT_DATE),
((SELECT id FROM products WHERE sku_code = 'OH-NAAKT-001'), 2.00, 'initial_setup', CURRENT_DATE),
((SELECT id FROM products WHERE sku_code = 'OH-HELE-001'), 6.50, 'initial_setup', CURRENT_DATE),
((SELECT id FROM products WHERE sku_code = 'OH-LEVER-001'), 4.00, 'initial_setup', CURRENT_DATE),
((SELECT id FROM products WHERE sku_code = 'OH-MAAG-001'), 3.50, 'initial_setup', CURRENT_DATE),
((SELECT id FROM products WHERE sku_code = 'OH-HART-001'), 4.50, 'initial_setup', CURRENT_DATE),
((SELECT id FROM products WHERE sku_code = 'OH-HALS-001'), 2.00, 'initial_setup', CURRENT_DATE);


-- ============================================================
-- MIGRATION 62: 20260124100061_seed_demo_batches.sql
-- ============================================================

INSERT INTO production_batches (batch_ref, slaughter_date, live_weight_kg, bird_count, griller_weight_kg, rejection_kg, slaughter_waste_kg, production_date, expiry_date, status) VALUES
('P2520210', '2026-01-20', 5000.000, 2000, 3535.000, 50.000, 1415.000, '2026-01-20', '2026-02-03', 'in_sales'),
('P2535609', '2026-01-22', 4500.000, 1800, 3181.500, 45.000, 1273.500, '2026-01-22', '2026-02-05', 'cut_up');


-- ============================================================
-- MIGRATION 63: 20260124100062_seed_demo_yields.sql
-- ============================================================

INSERT INTO batch_yields (batch_id, anatomical_part, actual_weight_kg, yield_pct, target_yield_min, target_yield_max, delta_from_target, measurement_source)
SELECT
  b.id,
  'breast_cap'::anatomical_part,
  1237.25,
  35.00,
  34.80,
  36.90,
  -0.85,
  'slaughter_report'
FROM production_batches b WHERE b.batch_ref = 'P2520210';


-- ============================================================
-- MIGRATION 64: 20260124100063_seed_demo_yields_2.sql
-- ============================================================

INSERT INTO batch_yields (batch_id, anatomical_part, actual_weight_kg, yield_pct, target_yield_min, target_yield_max, delta_from_target, measurement_source)
SELECT
  b.id,
  'leg_quarter'::anatomical_part,
  1520.05,
  43.00,
  42.00,
  44.80,
  -0.40,
  'slaughter_report'
FROM production_batches b WHERE b.batch_ref = 'P2520210';


-- ============================================================
-- MIGRATION 65: 20260124100064_seed_demo_yields_3.sql
-- ============================================================

INSERT INTO batch_yields (batch_id, anatomical_part, actual_weight_kg, yield_pct, target_yield_min, target_yield_max, delta_from_target, measurement_source)
SELECT
  b.id,
  'wings'::anatomical_part,
  379.26,
  10.73,
  10.60,
  10.80,
  0.03,
  'slaughter_report'
FROM production_batches b WHERE b.batch_ref = 'P2520210';


-- ============================================================
-- MIGRATION 66: 20260124100065_seed_demo_yields_4.sql
-- ============================================================

INSERT INTO batch_yields (batch_id, anatomical_part, actual_weight_kg, yield_pct, target_yield_min, target_yield_max, delta_from_target, measurement_source)
SELECT
  b.id,
  'back_carcass'::anatomical_part,
  265.13,
  7.50,
  7.00,
  8.20,
  -0.10,
  'slaughter_report'
FROM production_batches b WHERE b.batch_ref = 'P2520210';


-- ============================================================
-- MIGRATION 67: 20260124100066_seed_demo_yields_5.sql
-- ============================================================

INSERT INTO batch_yields (batch_id, anatomical_part, actual_weight_kg, yield_pct, target_yield_min, target_yield_max, delta_from_target, measurement_source)
SELECT
  b.id,
  'offal'::anatomical_part,
  133.31,
  3.77,
  NULL,
  NULL,
  NULL,
  'slaughter_report'
FROM production_batches b WHERE b.batch_ref = 'P2520210';


-- ============================================================
-- MIGRATION 68: 20260124100067_seed_demo_customers.sql
-- ============================================================

INSERT INTO customers (customer_code, name, segment, is_active, total_revenue_ytd, last_balance_score, is_cherry_picker) VALUES
('CUS001', 'Balanced Buyer B.V.', 'retail', true, 15000.00, 85.00, false),
('CUS002', 'Filet Focus N.V.', 'foodservice', true, 25000.00, 35.00, true),
('CUS003', 'Dark Meat Specialist', 'wholesale', true, 8000.00, 70.00, false);


-- ============================================================
-- MIGRATION 69: 20260124100068_table_technical_definitions.sql
-- ============================================================

CREATE TABLE technical_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_type VARCHAR(50) NOT NULL,
  key VARCHAR(100) NOT NULL,
  value JSONB NOT NULL,
  source_document VARCHAR(255),
  source_section VARCHAR(100),
  verified_at TIMESTAMPTZ,
  verified_by VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(definition_type, key)
);


-- ============================================================
-- MIGRATION 70: 20260124100069_idx_technical_definitions.sql
-- ============================================================

CREATE INDEX idx_tech_def_type ON technical_definitions(definition_type);


-- ============================================================
-- MIGRATION 71: 20260124100070_comment_technical_definitions.sql
-- ============================================================

COMMENT ON TABLE technical_definitions IS 'Technical definitions with provenance tracking (SKU mappings, thresholds, etc.)';


-- ============================================================
-- MIGRATION 72: 20260124100071_seed_sku_provenance.sql
-- ============================================================

INSERT INTO technical_definitions (definition_type, key, value, source_document, source_section, notes) VALUES
('sku_mapping', 'storteboom_plu_mapping', '{"status": "VERIFIED", "source": "Storteboom invoices/pakbonnen", "verified_skus": ["540457", "528073", "540617", "514298", "392940", "392865"]}', 'Hoofdstuk 6 TRD', '6.1', 'PLU codes verified against actual invoices'),
('yield_target', 'hubbard_ja757', '{"breast_cap_min": 34.8, "breast_cap_max": 36.9, "leg_quarter_min": 42.0, "leg_quarter_max": 44.8, "wings_min": 10.6, "wings_max": 10.8, "back_carcass_min": 7.0, "back_carcass_max": 8.2}', 'Hubbard JA757 Spec Sheet', 'Cut-Up Yields', 'Target yields for commercial breed'),
('threshold', 'tht_colors', '{"green_max_pct": 70, "orange_max_pct": 90, "source": "Blueprint Spec"}', 'OIL Blueprint', 'THT Status', 'THT color thresholds - LOCKED');


-- ============================================================
-- MIGRATION 73: 20260124100072_view_effective_yields.sql
-- ============================================================

CREATE OR REPLACE VIEW v_effective_batch_yields AS
WITH latest_yields AS (
  SELECT DISTINCT ON (batch_id, anatomical_part)
    by1.id,
    by1.batch_id,
    by1.anatomical_part,
    by1.actual_weight_kg,
    by1.yield_pct,
    by1.target_yield_min,
    by1.target_yield_max,
    by1.delta_from_target,
    by1.measurement_source,
    by1.measured_at,
    by1.is_correction,
    by1.corrects_yield_id,
    by1.notes,
    by1.created_at
  FROM batch_yields by1
  WHERE NOT EXISTS (
    SELECT 1 FROM batch_yields by2
    WHERE by2.corrects_yield_id = by1.id
  )
  ORDER BY batch_id, anatomical_part, measured_at DESC
)
SELECT
  ly.id,
  ly.batch_id,
  pb.batch_ref,
  ly.anatomical_part,
  ly.actual_weight_kg,
  ly.yield_pct,
  ly.target_yield_min,
  ly.target_yield_max,
  ly.delta_from_target,
  ly.measurement_source,
  ly.measured_at,
  ly.is_correction,
  ly.notes,
  CASE WHEN ly.is_correction THEN 'CORRECTED' ELSE 'ORIGINAL' END AS data_status
FROM latest_yields ly
JOIN production_batches pb ON pb.id = ly.batch_id;


-- ============================================================
-- MIGRATION 74: 20260124100073_view_effective_costs.sql
-- ============================================================

CREATE OR REPLACE VIEW v_effective_batch_costs AS
WITH adjusted_costs AS (
  SELECT
    bc.id,
    bc.batch_id,
    bc.cost_type,
    bc.description,
    bc.amount,
    bc.per_unit,
    bc.quantity,
    bc.invoice_ref,
    bc.invoice_date,
    bc.is_adjustment,
    bc.adjusts_cost_id,
    bc.adjustment_reason,
    bc.created_at,
    EXISTS (
      SELECT 1 FROM batch_costs adj
      WHERE adj.adjusts_cost_id = bc.id
    ) AS has_adjustment
  FROM batch_costs bc
),
effective_costs AS (
  SELECT
    ac.*,
    CASE
      WHEN ac.is_adjustment THEN 'ADJUSTMENT'
      WHEN ac.has_adjustment THEN 'SUPERSEDED'
      ELSE 'ORIGINAL'
    END AS cost_status
  FROM adjusted_costs ac
  WHERE NOT ac.has_adjustment
)
SELECT
  ec.id,
  ec.batch_id,
  pb.batch_ref,
  ec.cost_type,
  ec.description,
  ec.amount,
  ec.per_unit,
  ec.quantity,
  ec.invoice_ref,
  ec.invoice_date,
  ec.is_adjustment,
  ec.adjustment_reason,
  ec.cost_status,
  ec.created_at
FROM effective_costs ec
JOIN production_batches pb ON pb.id = ec.batch_id;


-- ============================================================
-- MIGRATION 75: 20260124100074_view_effective_totals.sql
-- ============================================================

CREATE OR REPLACE VIEW v_effective_batch_totals AS
SELECT
  pb.id AS batch_id,
  pb.batch_ref,
  pb.slaughter_date,
  pb.live_weight_kg,
  pb.griller_weight_kg,
  pb.griller_yield_pct,
  COALESCE(y.total_yield_kg, 0) AS total_cut_up_kg,
  COALESCE(y.breast_cap_kg, 0) AS breast_cap_kg,
  COALESCE(y.leg_quarter_kg, 0) AS leg_quarter_kg,
  COALESCE(y.wings_kg, 0) AS wings_kg,
  COALESCE(y.back_carcass_kg, 0) AS back_carcass_kg,
  COALESCE(y.offal_kg, 0) AS offal_kg,
  COALESCE(c.total_cost, 0) AS total_batch_cost,
  COALESCE(c.slaughter_cost, 0) AS slaughter_cost,
  COALESCE(c.cutting_cost, 0) AS cutting_cost,
  COALESCE(c.other_cost, 0) AS other_cost,
  CASE
    WHEN y.has_corrections THEN 'HAS_CORRECTIONS'
    WHEN y.total_yield_kg IS NULL THEN 'MISSING_YIELDS'
    ELSE 'COMPLETE'
  END AS yield_data_status,
  CASE
    WHEN c.has_adjustments THEN 'HAS_ADJUSTMENTS'
    WHEN c.total_cost IS NULL THEN 'MISSING_COSTS'
    ELSE 'COMPLETE'
  END AS cost_data_status
FROM production_batches pb
LEFT JOIN LATERAL (
  SELECT
    SUM(actual_weight_kg) AS total_yield_kg,
    SUM(CASE WHEN anatomical_part = 'breast_cap' THEN actual_weight_kg END) AS breast_cap_kg,
    SUM(CASE WHEN anatomical_part = 'leg_quarter' THEN actual_weight_kg END) AS leg_quarter_kg,
    SUM(CASE WHEN anatomical_part = 'wings' THEN actual_weight_kg END) AS wings_kg,
    SUM(CASE WHEN anatomical_part = 'back_carcass' THEN actual_weight_kg END) AS back_carcass_kg,
    SUM(CASE WHEN anatomical_part = 'offal' THEN actual_weight_kg END) AS offal_kg,
    BOOL_OR(is_correction) AS has_corrections
  FROM v_effective_batch_yields evy
  WHERE evy.batch_id = pb.id
) y ON true
LEFT JOIN LATERAL (
  SELECT
    SUM(amount) AS total_cost,
    SUM(CASE WHEN cost_type = 'slaughter' THEN amount END) AS slaughter_cost,
    SUM(CASE WHEN cost_type = 'cutting' THEN amount END) AS cutting_cost,
    SUM(CASE WHEN cost_type NOT IN ('slaughter', 'cutting') THEN amount END) AS other_cost,
    BOOL_OR(is_adjustment) AS has_adjustments
  FROM v_effective_batch_costs ebc
  WHERE ebc.batch_id = pb.id
) c ON true;


-- ============================================================
-- MIGRATION 76: 20260124100075_view_mass_balance_v2.sql
-- ============================================================

CREATE OR REPLACE VIEW v_batch_mass_balance AS
SELECT
  pb.id AS batch_id,
  pb.batch_ref,
  pb.slaughter_date,
  pb.live_weight_kg AS source_live_weight,
  pb.rejection_kg AS loss_rejection,
  pb.slaughter_waste_kg AS loss_slaughter,
  pb.griller_weight_kg AS node_griller,
  COALESCE(y.breast_cap_kg, 0) AS node_breast_cap,
  COALESCE(y.leg_quarter_kg, 0) AS node_leg_quarter,
  COALESCE(y.wings_kg, 0) AS node_wings,
  COALESCE(y.back_carcass_kg, 0) AS node_back_carcass,
  COALESCE(y.offal_kg, 0) AS node_offal,
  pb.griller_weight_kg - (
    COALESCE(y.breast_cap_kg, 0) +
    COALESCE(y.leg_quarter_kg, 0) +
    COALESCE(y.wings_kg, 0) +
    COALESCE(y.back_carcass_kg, 0) +
    COALESCE(y.offal_kg, 0)
  ) AS loss_unaccounted,
  CASE
    WHEN y.yield_count < 5 THEN 'NEEDS_REVIEW'
    WHEN y.has_corrections THEN 'HAS_CORRECTIONS'
    ELSE 'COMPLETE'
  END AS data_status
FROM production_batches pb
LEFT JOIN LATERAL (
  SELECT
    SUM(CASE WHEN anatomical_part = 'breast_cap' THEN actual_weight_kg END) AS breast_cap_kg,
    SUM(CASE WHEN anatomical_part = 'leg_quarter' THEN actual_weight_kg END) AS leg_quarter_kg,
    SUM(CASE WHEN anatomical_part = 'wings' THEN actual_weight_kg END) AS wings_kg,
    SUM(CASE WHEN anatomical_part = 'back_carcass' THEN actual_weight_kg END) AS back_carcass_kg,
    SUM(CASE WHEN anatomical_part = 'offal' THEN actual_weight_kg END) AS offal_kg,
    COUNT(*) AS yield_count,
    BOOL_OR(is_correction) AS has_corrections
  FROM v_effective_batch_yields evy
  WHERE evy.batch_id = pb.id
) y ON true;


-- ============================================================
-- MIGRATION 77: 20260124100076_function_prevent_yield_update.sql
-- ============================================================

CREATE OR REPLACE FUNCTION prevent_yield_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.actual_weight_kg != NEW.actual_weight_kg OR
     OLD.anatomical_part != NEW.anatomical_part OR
     OLD.batch_id != NEW.batch_id THEN
    RAISE EXCEPTION 'APPEND-ONLY: Cannot modify yield core fields. Create a correction record instead.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- MIGRATION 78: 20260124100077_function_prevent_cost_update.sql
-- ============================================================

CREATE OR REPLACE FUNCTION prevent_cost_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.amount != NEW.amount OR
     OLD.cost_type != NEW.cost_type OR
     OLD.batch_id != NEW.batch_id THEN
    RAISE EXCEPTION 'APPEND-ONLY: Cannot modify cost core fields. Create an adjustment record instead.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- MIGRATION 79: 20260124100078_comment_effective_views.sql
-- ============================================================

COMMENT ON VIEW v_effective_batch_yields IS 'Effectieve batch yields met correcties geresolved. Toont alleen de meest recente/gecorrigeerde waarde per batch/part.';


-- ============================================================
-- MIGRATION 80: 20260124100079_comment_effective_costs.sql
-- ============================================================

COMMENT ON VIEW v_effective_batch_costs IS 'Effectieve batch kosten met adjustments geresolved. Superseded records worden gefilterd.';


-- ============================================================
-- MIGRATION 81: 20260124100080_comment_effective_totals.sql
-- ============================================================

COMMENT ON VIEW v_effective_batch_totals IS 'Geaggregeerde batch totalen met effective yields en costs.';


-- ============================================================
-- MIGRATION 82: 20260124100081_comment_mass_balance_v2.sql
-- ============================================================

COMMENT ON VIEW v_batch_mass_balance IS 'Sankey-ready massabalans view. Uses effective yields (corrections resolved). data_status indicates completeness.';


-- ============================================================
-- MIGRATION 83: 20260124100082_comment_prevent_functions.sql
-- ============================================================

COMMENT ON FUNCTION prevent_yield_update IS 'Prevents modification of core yield fields. Enable trigger in production.';


-- ============================================================
-- MIGRATION 84: 20260124100083_comment_prevent_cost_function.sql
-- ============================================================

COMMENT ON FUNCTION prevent_cost_update IS 'Prevents modification of core cost fields. Enable trigger in production.';


-- ============================================================
-- MIGRATION 85: 20260124100084_table_slaughter_reports.sql
-- ============================================================

-- Sprint 1: slaughter_reports table
-- Source: Slachtrendement-uploads (Map1) - batch truth
-- This table stores raw slaughter report data as uploaded from Storteboom

CREATE TABLE IF NOT EXISTS slaughter_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Batch reference
  batch_id UUID NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,

  -- Source document tracking
  source_document_id TEXT,
  source_filename TEXT,
  upload_timestamp TIMESTAMPTZ DEFAULT now(),

  -- Input weights (from slaughter report)
  input_live_kg DECIMAL(12,3) NOT NULL,
  input_count INTEGER NOT NULL,

  -- Category 2/3 losses (regulatory categories)
  cat2_kg DECIMAL(12,3) DEFAULT 0,
  cat3_kg DECIMAL(12,3) DEFAULT 0,

  -- Raw parts data as reported (JSON for flexibility)
  -- Structure: { "breast": 123.4, "leg": 234.5, ... }
  parts_raw JSONB,

  -- Metadata
  report_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Ensure one slaughter report per batch (can be corrected via new upload)
  UNIQUE (batch_id, source_document_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_slaughter_reports_batch
  ON slaughter_reports(batch_id);

CREATE INDEX IF NOT EXISTS idx_slaughter_reports_date
  ON slaughter_reports(report_date);

-- Comments
COMMENT ON TABLE slaughter_reports IS
  'Sprint 1: Raw slaughter report data from Storteboom uploads (Map1). Source of batch truth.';

COMMENT ON COLUMN slaughter_reports.parts_raw IS
  'Raw parts breakdown as JSON. Structure flexible to accommodate various report formats.';

COMMENT ON COLUMN slaughter_reports.cat2_kg IS
  'Category 2 material (regulatory classification) - animal byproducts for rendering.';

COMMENT ON COLUMN slaughter_reports.cat3_kg IS
  'Category 3 material (regulatory classification) - animal byproducts for petfood/technical use.';


-- ============================================================
-- MIGRATION 86: 20260124100085_table_delivery_notes.sql
-- ============================================================

-- Sprint 1: delivery_notes table
-- Source: Pakbonnen uit Flow Automation - commercial truth
-- This table stores delivery note (pakbon) data representing what was commercially shipped

CREATE TABLE IF NOT EXISTS delivery_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Batch linkage (optional - not always known at time of delivery)
  batch_id UUID REFERENCES production_batches(id) ON DELETE SET NULL,

  -- Delivery identification
  delivery_number TEXT NOT NULL,
  delivery_date DATE NOT NULL,

  -- Product identification
  sku TEXT NOT NULL,
  product_description TEXT,

  -- Quantities
  net_weight_kg DECIMAL(12,3) NOT NULL,
  gross_weight_kg DECIMAL(12,3),
  piece_count INTEGER,

  -- Customer (reference only, not FK - customer may not exist yet)
  customer_code TEXT,
  customer_name TEXT,

  -- Source tracking
  source_document_id TEXT,
  source_filename TEXT,
  synced_from TEXT DEFAULT 'flow_automation',
  upload_timestamp TIMESTAMPTZ DEFAULT now(),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Prevent duplicate entries for same delivery line
  UNIQUE (delivery_number, sku, delivery_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_delivery_notes_batch
  ON delivery_notes(batch_id);

CREATE INDEX IF NOT EXISTS idx_delivery_notes_date
  ON delivery_notes(delivery_date);

CREATE INDEX IF NOT EXISTS idx_delivery_notes_sku
  ON delivery_notes(sku);

CREATE INDEX IF NOT EXISTS idx_delivery_notes_delivery_number
  ON delivery_notes(delivery_number);

-- Comments
COMMENT ON TABLE delivery_notes IS
  'Sprint 1: Delivery note (pakbon) data from Flow Automation. Commercial truth for what was shipped.';

COMMENT ON COLUMN delivery_notes.batch_id IS
  'Link to production batch. May be NULL if batch cannot be determined from pakbon.';

COMMENT ON COLUMN delivery_notes.sku IS
  'Product SKU code. Use sku_part_mapping table to map to anatomical parts.';

COMMENT ON COLUMN delivery_notes.synced_from IS
  'Data source identifier. Default: flow_automation.';


-- ============================================================
-- MIGRATION 87: 20260124100086_table_sku_part_mapping.sql
-- ============================================================

-- Sprint 1: sku_part_mapping table
-- Maps commercial SKUs to anatomical parts for mass balance reconciliation
-- Temporary manual mapping allowed per Sprint 1 contract

CREATE TABLE IF NOT EXISTS sku_part_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- SKU identification
  sku TEXT NOT NULL UNIQUE,
  sku_description TEXT,

  -- Anatomical part mapping
  part_code TEXT NOT NULL,

  -- Confidence level for this mapping
  confidence TEXT NOT NULL DEFAULT 'manual'
    CHECK (confidence IN ('manual', 'inferred', 'verified')),

  -- Mapping metadata
  mapped_by TEXT,
  mapped_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT,

  -- Active flag for soft delete
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sku_part_mapping_sku
  ON sku_part_mapping(sku);

CREATE INDEX IF NOT EXISTS idx_sku_part_mapping_part_code
  ON sku_part_mapping(part_code);

CREATE INDEX IF NOT EXISTS idx_sku_part_mapping_active
  ON sku_part_mapping(is_active) WHERE is_active = true;

-- Trigger for updated_at
CREATE TRIGGER set_sku_part_mapping_updated_at
  BEFORE UPDATE ON sku_part_mapping
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Comments
COMMENT ON TABLE sku_part_mapping IS
  'Sprint 1: Maps commercial SKUs to anatomical parts. Manual mapping allowed (temporary).';

COMMENT ON COLUMN sku_part_mapping.part_code IS
  'Anatomical part code: breast, leg, wing, back, tip, organs, rest.';

COMMENT ON COLUMN sku_part_mapping.confidence IS
  'Mapping confidence: manual (hand-entered), inferred (system-derived), verified (confirmed).';


-- ============================================================
-- MIGRATION 88: 20260124100087_view_batch_output_vs_pakbon.sql
-- ============================================================

-- Sprint 1: v_batch_output_vs_pakbon view
-- Compares technical output (slaughter report) vs commercial output (pakbon)
-- Shows differences per part for mass balance reconciliation

CREATE OR REPLACE VIEW v_batch_output_vs_pakbon AS
WITH
  -- Technical output: aggregate yields from effective batch yields
  technical_output AS (
    SELECT
      batch_id,
      anatomical_part AS part_code,
      SUM(actual_weight_kg) AS technical_weight_kg
    FROM v_effective_batch_yields
    GROUP BY batch_id, anatomical_part
  ),

  -- Commercial output: aggregate delivery notes via SKU mapping
  commercial_output AS (
    SELECT
      dn.batch_id,
      COALESCE(spm.part_code, 'unmapped') AS part_code,
      SUM(dn.net_weight_kg) AS commercial_weight_kg
    FROM delivery_notes dn
    LEFT JOIN sku_part_mapping spm ON spm.sku = dn.sku AND spm.is_active = true
    WHERE dn.batch_id IS NOT NULL
    GROUP BY dn.batch_id, COALESCE(spm.part_code, 'unmapped')
  ),

  -- All part codes across both sources
  all_parts AS (
    SELECT batch_id, part_code FROM technical_output
    UNION
    SELECT batch_id, part_code FROM commercial_output
  )

SELECT
  pb.id AS batch_id,
  pb.batch_ref,
  pb.slaughter_date,
  ap.part_code,

  -- Technical output (slaughter report)
  COALESCE(t.technical_weight_kg, 0) AS technical_weight_kg,

  -- Commercial output (pakbon)
  COALESCE(c.commercial_weight_kg, 0) AS commercial_weight_kg,

  -- Delta: technical - commercial (positive = more produced than shipped)
  COALESCE(t.technical_weight_kg, 0) - COALESCE(c.commercial_weight_kg, 0) AS delta_kg,

  -- Delta as percentage of technical
  CASE
    WHEN COALESCE(t.technical_weight_kg, 0) > 0 THEN
      ROUND(
        ((COALESCE(t.technical_weight_kg, 0) - COALESCE(c.commercial_weight_kg, 0))
        / t.technical_weight_kg * 100)::numeric,
        2
      )
    ELSE NULL
  END AS delta_pct,

  -- Source flags
  CASE WHEN t.technical_weight_kg IS NOT NULL THEN 'slaughter_report' ELSE NULL END AS technical_source,
  CASE WHEN c.commercial_weight_kg IS NOT NULL THEN 'pakbon' ELSE NULL END AS commercial_source

FROM production_batches pb
CROSS JOIN (SELECT DISTINCT part_code FROM all_parts) ap
LEFT JOIN all_parts ap2 ON ap2.batch_id = pb.id AND ap2.part_code = ap.part_code
LEFT JOIN technical_output t ON t.batch_id = pb.id AND t.part_code = ap.part_code
LEFT JOIN commercial_output c ON c.batch_id = pb.id AND c.part_code = ap.part_code
WHERE ap2.batch_id IS NOT NULL -- Only include batches that have data
ORDER BY pb.slaughter_date DESC, pb.batch_ref, ap.part_code;

-- Comment
COMMENT ON VIEW v_batch_output_vs_pakbon IS
  'Sprint 1: Compares technical output (slaughter report) vs commercial output (pakbon) per batch and part.';


-- ============================================================
-- MIGRATION 89: 20260124100088_view_batch_yield_vs_expectation.sql
-- ============================================================

-- Sprint 1: v_batch_yield_vs_expectation view
-- Shows realized yield % per part vs expectation bands
-- JA757 is NORMATIVE (used for delta calculation)
-- Ross308 is INDICATIVE ONLY (labeled, not used for calculations)

CREATE OR REPLACE VIEW v_batch_yield_vs_expectation AS
SELECT
  evy.id AS yield_id,
  evy.batch_id,
  evy.batch_ref,
  pb.slaughter_date,
  evy.anatomical_part,

  -- Realized values
  evy.actual_weight_kg,
  evy.yield_pct AS realized_yield_pct,

  -- JA757 expectation band (NORMATIVE - Hubbard JA757 spec sheet)
  -- These are the authoritative targets
  CASE evy.anatomical_part
    WHEN 'breast_cap' THEN 34.8
    WHEN 'leg_quarter' THEN 42.0
    WHEN 'wings' THEN 10.6
    WHEN 'back_carcass' THEN 7.0
    WHEN 'offal' THEN 3.0  -- Estimated, not in original spec
  END AS ja757_min_pct,

  CASE evy.anatomical_part
    WHEN 'breast_cap' THEN 36.9
    WHEN 'leg_quarter' THEN 44.8
    WHEN 'wings' THEN 10.8
    WHEN 'back_carcass' THEN 8.2
    WHEN 'offal' THEN 5.0  -- Estimated, not in original spec
  END AS ja757_max_pct,

  -- JA757 midpoint (used for delta calculation)
  CASE evy.anatomical_part
    WHEN 'breast_cap' THEN (34.8 + 36.9) / 2
    WHEN 'leg_quarter' THEN (42.0 + 44.8) / 2
    WHEN 'wings' THEN (10.6 + 10.8) / 2
    WHEN 'back_carcass' THEN (7.0 + 8.2) / 2
    WHEN 'offal' THEN (3.0 + 5.0) / 2
  END AS ja757_midpoint_pct,

  -- Delta from JA757 midpoint (NORMATIVE calculation)
  CASE
    WHEN evy.yield_pct IS NOT NULL THEN
      ROUND((evy.yield_pct - CASE evy.anatomical_part
        WHEN 'breast_cap' THEN (34.8 + 36.9) / 2
        WHEN 'leg_quarter' THEN (42.0 + 44.8) / 2
        WHEN 'wings' THEN (10.6 + 10.8) / 2
        WHEN 'back_carcass' THEN (7.0 + 8.2) / 2
        WHEN 'offal' THEN (3.0 + 5.0) / 2
      END)::numeric, 2)
    ELSE NULL
  END AS delta_from_ja757_pct,

  -- Status based on JA757 (NORMATIVE)
  CASE
    WHEN evy.yield_pct IS NULL THEN 'NO_DATA'
    WHEN evy.yield_pct >= CASE evy.anatomical_part
        WHEN 'breast_cap' THEN 34.8
        WHEN 'leg_quarter' THEN 42.0
        WHEN 'wings' THEN 10.6
        WHEN 'back_carcass' THEN 7.0
        WHEN 'offal' THEN 3.0
      END
      AND evy.yield_pct <= CASE evy.anatomical_part
        WHEN 'breast_cap' THEN 36.9
        WHEN 'leg_quarter' THEN 44.8
        WHEN 'wings' THEN 10.8
        WHEN 'back_carcass' THEN 8.2
        WHEN 'offal' THEN 5.0
      END
      THEN 'IN_RANGE'
    WHEN evy.yield_pct < CASE evy.anatomical_part
        WHEN 'breast_cap' THEN 34.8
        WHEN 'leg_quarter' THEN 42.0
        WHEN 'wings' THEN 10.6
        WHEN 'back_carcass' THEN 7.0
        WHEN 'offal' THEN 3.0
      END
      THEN 'BELOW_TARGET'
    ELSE 'ABOVE_TARGET'
  END AS yield_status,

  -- ============================================================
  -- Ross308 reference (INDICATIVE ONLY - labeled as such)
  -- These values are for reference comparison only
  -- ============================================================
  CASE evy.anatomical_part
    WHEN 'breast_cap' THEN 32.0
    WHEN 'leg_quarter' THEN 40.0
    WHEN 'wings' THEN 11.0
    WHEN 'back_carcass' THEN 8.0
    WHEN 'offal' THEN 4.0
  END AS ross308_indicative_min_pct,

  CASE evy.anatomical_part
    WHEN 'breast_cap' THEN 34.0
    WHEN 'leg_quarter' THEN 42.0
    WHEN 'wings' THEN 11.5
    WHEN 'back_carcass' THEN 9.0
    WHEN 'offal' THEN 5.5
  END AS ross308_indicative_max_pct,

  -- Explicit label that Ross308 is indicative only
  'INDICATIVE_ONLY' AS ross308_usage_label,

  -- Data quality from effective yields
  evy.data_status,
  evy.is_correction,
  evy.measurement_source

FROM v_effective_batch_yields evy
JOIN production_batches pb ON pb.id = evy.batch_id
ORDER BY pb.slaughter_date DESC, pb.batch_ref, evy.anatomical_part;

-- Comments
COMMENT ON VIEW v_batch_yield_vs_expectation IS
  'Sprint 1: Realized yield % per part vs expectation bands. JA757 is NORMATIVE; Ross308 is INDICATIVE ONLY.';

COMMENT ON COLUMN v_batch_yield_vs_expectation.ja757_min_pct IS
  'Hubbard JA757 minimum yield % (NORMATIVE - used for calculations).';

COMMENT ON COLUMN v_batch_yield_vs_expectation.ross308_indicative_min_pct IS
  'Ross 308 minimum yield % (INDICATIVE ONLY - not used for calculations).';

COMMENT ON COLUMN v_batch_yield_vs_expectation.ross308_usage_label IS
  'Explicit label: Ross308 values are for reference only, not normative.';


-- ============================================================
-- MIGRATION 90: 20260124100089_table_joint_costs.sql
-- ============================================================

-- Sprint 2: joint_costs table
-- Joint cost = ONLY live bird purchase per batch
-- This is the starting point for SVASO allocation

CREATE TABLE IF NOT EXISTS joint_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Batch reference
  batch_id UUID NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,

  -- Cost type (restricted to live_bird_purchase per Sprint 2 contract)
  cost_type TEXT NOT NULL DEFAULT 'live_bird_purchase'
    CHECK (cost_type = 'live_bird_purchase'),

  -- Amount
  amount_eur DECIMAL(12,2) NOT NULL,

  -- Per-unit breakdown (optional)
  cost_per_kg DECIMAL(8,4),
  cost_per_bird DECIMAL(8,4),

  -- Source tracking
  invoice_ref TEXT,
  invoice_date DATE,
  supplier TEXT,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT,

  -- One joint cost record per batch (can be updated via correction pattern)
  UNIQUE (batch_id, cost_type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_joint_costs_batch
  ON joint_costs(batch_id);

-- Comments
COMMENT ON TABLE joint_costs IS
  'Sprint 2: Joint costs for SVASO allocation. ONLY live bird purchase cost per batch.';

COMMENT ON COLUMN joint_costs.cost_type IS
  'Cost type. Sprint 2 constraint: ONLY live_bird_purchase allowed.';

COMMENT ON COLUMN joint_costs.amount_eur IS
  'Total joint cost in EUR for the batch. This is allocated via Sales Value at Split-Off.';


-- ============================================================
-- MIGRATION 91: 20260124100090_table_processing_costs.sql
-- ============================================================

-- Sprint 2: processing_costs table
-- Processing costs applied AFTER split-off for NRV calculation
-- These are NOT joint costs - they are added to allocated joint cost

CREATE TABLE IF NOT EXISTS processing_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Process step identifier
  process_step TEXT NOT NULL
    CHECK (process_step IN ('cutting', 'vacuum', 'portioning', 'packaging', 'other')),

  -- Cost rate
  cost_per_kg DECIMAL(8,4) NOT NULL,

  -- Applicability
  applies_to_part_code TEXT,  -- NULL = applies to all parts
  applies_to_sku TEXT,        -- NULL = applies to all SKUs for that part

  -- Source of cost rate
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'abc', 'contract')),

  -- Validity period
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_processing_costs_step
  ON processing_costs(process_step);

CREATE INDEX IF NOT EXISTS idx_processing_costs_part
  ON processing_costs(applies_to_part_code);

CREATE INDEX IF NOT EXISTS idx_processing_costs_valid
  ON processing_costs(valid_from, valid_until);

-- Trigger for updated_at
CREATE TRIGGER set_processing_costs_updated_at
  BEFORE UPDATE ON processing_costs
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Comments
COMMENT ON TABLE processing_costs IS
  'Sprint 2: Processing costs for NRV calculation. Applied AFTER split-off.';

COMMENT ON COLUMN processing_costs.process_step IS
  'Processing step: cutting, vacuum, portioning, packaging, other.';

COMMENT ON COLUMN processing_costs.source IS
  'Source of cost rate: manual (hand-entered), abc (Activity Based Costing), contract.';

COMMENT ON COLUMN processing_costs.applies_to_part_code IS
  'Anatomical part this cost applies to. NULL = all parts.';


-- ============================================================
-- MIGRATION 92: 20260124100091_table_batch_splitoff_values.sql
-- ============================================================

-- Sprint 2: batch_splitoff_values table
-- Sales Value at Split-Off per batch and part
-- Used for joint cost allocation (NOT weight-based)

CREATE TABLE IF NOT EXISTS batch_splitoff_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Batch reference
  batch_id UUID NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,

  -- Part identification
  part_code TEXT NOT NULL,

  -- Sales value at split-off point
  -- This is the market value used for allocation, NOT actual sales
  sales_value_eur DECIMAL(12,2) NOT NULL,

  -- Derivation of sales value
  weight_kg DECIMAL(12,3) NOT NULL,
  price_per_kg DECIMAL(8,4) NOT NULL,

  -- Price source
  price_source TEXT NOT NULL DEFAULT 'market_benchmark'
    CHECK (price_source IN ('market_benchmark', 'contract', 'manual')),

  -- Validity date for price reference
  price_reference_date DATE,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT,

  -- One split-off value per batch per part
  UNIQUE (batch_id, part_code)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_batch_splitoff_values_batch
  ON batch_splitoff_values(batch_id);

CREATE INDEX IF NOT EXISTS idx_batch_splitoff_values_part
  ON batch_splitoff_values(part_code);

-- Comments
COMMENT ON TABLE batch_splitoff_values IS
  'Sprint 2: Sales Value at Split-Off per batch/part for SVASO allocation.';

COMMENT ON COLUMN batch_splitoff_values.sales_value_eur IS
  'Market value at split-off point = weight_kg × price_per_kg. Used for allocation proportion.';

COMMENT ON COLUMN batch_splitoff_values.price_source IS
  'Source of price: market_benchmark (from market_benchmarks), contract (agreed price), manual.';


-- ============================================================
-- MIGRATION 93: 20260124100092_view_batch_splitoff_allocation.sql
-- ============================================================

-- Sprint 2: v_batch_splitoff_allocation view
-- Shows joint cost allocation per batch/part using Sales Value at Split-Off
-- Allocation is ONLY via market value proportion, NOT weight

CREATE OR REPLACE VIEW v_batch_splitoff_allocation AS
WITH
  -- Get total sales value per batch
  batch_totals AS (
    SELECT
      batch_id,
      SUM(sales_value_eur) AS total_sales_value_eur
    FROM batch_splitoff_values
    GROUP BY batch_id
  ),

  -- Get joint cost per batch
  batch_joint_costs AS (
    SELECT
      batch_id,
      SUM(amount_eur) AS joint_cost_eur
    FROM joint_costs
    WHERE cost_type = 'live_bird_purchase'
    GROUP BY batch_id
  )

SELECT
  bsv.id AS splitoff_value_id,
  bsv.batch_id,
  pb.batch_ref,
  pb.slaughter_date,
  bsv.part_code,

  -- Weight and price inputs
  bsv.weight_kg,
  bsv.price_per_kg,
  bsv.price_source,

  -- Sales value at split-off
  bsv.sales_value_eur,

  -- Total sales value for batch
  bt.total_sales_value_eur,

  -- Allocation percentage (Sales Value at Split-Off method)
  -- Formula: part_sales_value / total_sales_value
  CASE
    WHEN bt.total_sales_value_eur > 0 THEN
      ROUND((bsv.sales_value_eur / bt.total_sales_value_eur * 100)::numeric, 4)
    ELSE 0
  END AS allocation_pct,

  -- Joint cost for batch
  COALESCE(bjc.joint_cost_eur, 0) AS batch_joint_cost_eur,

  -- Allocated joint cost to this part
  -- Formula: joint_cost × (part_sales_value / total_sales_value)
  CASE
    WHEN bt.total_sales_value_eur > 0 THEN
      ROUND((COALESCE(bjc.joint_cost_eur, 0) * bsv.sales_value_eur / bt.total_sales_value_eur)::numeric, 2)
    ELSE 0
  END AS allocated_joint_cost_eur,

  -- Validation: allocation factor (must sum to 1.0 per batch)
  CASE
    WHEN bt.total_sales_value_eur > 0 THEN
      ROUND((bsv.sales_value_eur / bt.total_sales_value_eur)::numeric, 6)
    ELSE 0
  END AS allocation_factor

FROM batch_splitoff_values bsv
JOIN production_batches pb ON pb.id = bsv.batch_id
LEFT JOIN batch_totals bt ON bt.batch_id = bsv.batch_id
LEFT JOIN batch_joint_costs bjc ON bjc.batch_id = bsv.batch_id
ORDER BY pb.slaughter_date DESC, pb.batch_ref, bsv.part_code;

-- Comments
COMMENT ON VIEW v_batch_splitoff_allocation IS
  'Sprint 2: Joint cost allocation via Sales Value at Split-Off. NO weight-based allocation.';

COMMENT ON COLUMN v_batch_splitoff_allocation.allocation_pct IS
  'Allocation percentage = part_sales_value / total_batch_sales_value × 100.';

COMMENT ON COLUMN v_batch_splitoff_allocation.allocated_joint_cost_eur IS
  'Allocated joint cost = batch_joint_cost × allocation_factor.';

COMMENT ON COLUMN v_batch_splitoff_allocation.allocation_factor IS
  'Allocation factor (0-1). Sum of all parts per batch MUST equal 1.0.';


-- ============================================================
-- MIGRATION 94: 20260124100093_view_batch_part_cost.sql
-- ============================================================

-- Sprint 2: v_batch_part_cost view
-- Shows cost per kg per part at split-off point
-- This is the allocated joint cost divided by weight

CREATE OR REPLACE VIEW v_batch_part_cost AS
SELECT
  bsa.splitoff_value_id,
  bsa.batch_id,
  bsa.batch_ref,
  bsa.slaughter_date,
  bsa.part_code,

  -- Weight at split-off
  bsa.weight_kg,

  -- Allocated joint cost (from SVASO allocation)
  bsa.allocated_joint_cost_eur,

  -- Cost per kg at split-off
  -- Formula: allocated_joint_cost / weight_kg
  CASE
    WHEN bsa.weight_kg > 0 THEN
      ROUND((bsa.allocated_joint_cost_eur / bsa.weight_kg)::numeric, 4)
    ELSE 0
  END AS cost_per_kg_splitoff,

  -- Allocation details for traceability
  bsa.allocation_pct,
  bsa.allocation_factor,
  bsa.batch_joint_cost_eur,

  -- Market price used for allocation (for transparency)
  bsa.price_per_kg AS market_price_per_kg,
  bsa.price_source,

  -- Validation flag
  CASE
    WHEN bsa.weight_kg <= 0 THEN 'INVALID_WEIGHT'
    WHEN bsa.allocated_joint_cost_eur <= 0 THEN 'NO_COST_ALLOCATED'
    ELSE 'OK'
  END AS validation_status

FROM v_batch_splitoff_allocation bsa
ORDER BY bsa.slaughter_date DESC, bsa.batch_ref, bsa.part_code;

-- Comments
COMMENT ON VIEW v_batch_part_cost IS
  'Sprint 2: Cost per kg per part at split-off point.';

COMMENT ON COLUMN v_batch_part_cost.cost_per_kg_splitoff IS
  'Cost per kg at split-off = allocated_joint_cost / weight_kg. Does NOT include processing costs.';

COMMENT ON COLUMN v_batch_part_cost.market_price_per_kg IS
  'Market price used for SVASO allocation. For transparency only.';


-- ============================================================
-- MIGRATION 95: 20260124100094_view_batch_nrv_by_sku.sql
-- ============================================================

-- Sprint 2: v_batch_nrv_by_sku view
-- Net Realizable Value cost per SKU
-- NRV = allocated_joint_cost + processing_costs (applied AFTER split-off)

CREATE OR REPLACE VIEW v_batch_nrv_by_sku AS
WITH
  -- Get applicable processing costs per part
  -- Aggregates all processing steps for each part
  processing_by_part AS (
    SELECT
      COALESCE(applies_to_part_code, 'all') AS part_code_match,
      COALESCE(applies_to_sku, 'all') AS sku_match,
      process_step,
      cost_per_kg,
      source AS cost_source
    FROM processing_costs
    WHERE valid_from <= CURRENT_DATE
      AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
  ),

  -- Get part costs from split-off allocation
  part_costs AS (
    SELECT
      bpc.batch_id,
      bpc.batch_ref,
      bpc.slaughter_date,
      bpc.part_code,
      bpc.weight_kg,
      bpc.allocated_joint_cost_eur,
      bpc.cost_per_kg_splitoff
    FROM v_batch_part_cost bpc
  )

-- Join with products to get SKU-level view
SELECT
  pc.batch_id,
  pc.batch_ref,
  pc.slaughter_date,
  p.sku_code AS sku,
  p.description AS sku_description,
  pc.part_code,

  -- Allocated joint cost at split-off
  pc.allocated_joint_cost_eur,
  pc.cost_per_kg_splitoff,

  -- Processing costs (sum of all applicable steps)
  COALESCE(
    (SELECT SUM(pbp.cost_per_kg)
     FROM processing_by_part pbp
     WHERE (pbp.part_code_match = 'all' OR pbp.part_code_match = pc.part_code)
       AND (pbp.sku_match = 'all' OR pbp.sku_match = p.sku_code)),
    0
  ) AS extra_processing_cost_per_kg,

  -- NRV cost per kg
  -- Formula: cost_per_kg_splitoff + extra_processing_cost_per_kg
  pc.cost_per_kg_splitoff + COALESCE(
    (SELECT SUM(pbp.cost_per_kg)
     FROM processing_by_part pbp
     WHERE (pbp.part_code_match = 'all' OR pbp.part_code_match = pc.part_code)
       AND (pbp.sku_match = 'all' OR pbp.sku_match = p.sku_code)),
    0
  ) AS nrv_cost_per_kg,

  -- Total NRV for this part/SKU in batch
  -- Formula: weight_kg × nrv_cost_per_kg
  ROUND(
    (pc.weight_kg * (
      pc.cost_per_kg_splitoff + COALESCE(
        (SELECT SUM(pbp.cost_per_kg)
         FROM processing_by_part pbp
         WHERE (pbp.part_code_match = 'all' OR pbp.part_code_match = pc.part_code)
           AND (pbp.sku_match = 'all' OR pbp.sku_match = p.sku_code)),
        0
      )
    ))::numeric,
    2
  ) AS nrv_total_eur,

  -- Cost breakdown for transparency
  'SVASO' AS allocation_method,
  'NRV' AS costing_method

FROM part_costs pc
LEFT JOIN products p ON p.anatomical_part::text = pc.part_code AND p.is_active = true
ORDER BY pc.slaughter_date DESC, pc.batch_ref, pc.part_code, p.sku_code;

-- Comments
COMMENT ON VIEW v_batch_nrv_by_sku IS
  'Sprint 2: Net Realizable Value cost per SKU. NRV = allocated_joint_cost + processing_costs.';

COMMENT ON COLUMN v_batch_nrv_by_sku.nrv_cost_per_kg IS
  'NRV cost per kg = split-off cost + processing costs. This is the full product cost.';

COMMENT ON COLUMN v_batch_nrv_by_sku.extra_processing_cost_per_kg IS
  'Sum of all processing costs applied AFTER split-off.';

COMMENT ON COLUMN v_batch_nrv_by_sku.allocation_method IS
  'Cost allocation method. Always SVASO (Sales Value at Split-Off) per Sprint 2 contract.';


-- ============================================================
-- MIGRATION 96: 20260124100095_table_inventory_positions.sql
-- ============================================================

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

-- Comments
COMMENT ON TABLE inventory_positions IS
  'Sprint 3: Inventory snapshots per batch/part. Observational only - no actions.';

COMMENT ON COLUMN inventory_positions.quantity_kg IS
  'Current inventory quantity in kg. Derived, not source of truth.';

COMMENT ON COLUMN inventory_positions.source IS
  'Source of inventory data: manual (hand-entered), system_sync (external), calculated.';

COMMENT ON COLUMN inventory_positions.snapshot_date IS
  'Date of inventory snapshot. Multiple snapshots per day allowed via timestamp.';


-- ============================================================
-- MIGRATION 97: 20260124100096_view_sales_by_part.sql
-- ============================================================

-- Sprint 3: v_sales_by_part view
-- Aggregates sales transactions by part_code for velocity calculations
-- Joins sales_transactions with products to get anatomical_part

CREATE OR REPLACE VIEW v_sales_by_part AS
SELECT
  st.id AS transaction_id,
  st.invoice_date AS sale_date,
  p.sku_code AS sku,
  COALESCE(p.anatomical_part::text, 'unknown') AS part_code,
  st.quantity_kg,
  st.customer_id,
  st.batch_id,
  p.category AS product_category,

  -- For velocity calculations
  st.line_total AS revenue_eur,

  -- Source traceability
  st.invoice_number,
  st.synced_from AS data_source

FROM sales_transactions st
JOIN products p ON p.id = st.product_id
WHERE st.is_credit = false  -- Exclude credits for velocity
ORDER BY st.invoice_date DESC;

-- Comments
COMMENT ON VIEW v_sales_by_part IS
  'Sprint 3: Sales transactions with part_code for velocity calculations.';

COMMENT ON COLUMN v_sales_by_part.part_code IS
  'Anatomical part from product. Unknown if not mapped.';


-- ============================================================
-- MIGRATION 98: 20260124100097_view_inventory_by_part.sql
-- ============================================================

-- Sprint 3: v_inventory_by_part view
-- Aggregates latest inventory positions by part
-- Shows batch distribution for traceability

CREATE OR REPLACE VIEW v_inventory_by_part AS
WITH
  -- Get latest snapshot per batch/part/location
  latest_snapshots AS (
    SELECT DISTINCT ON (batch_id, part_code, location)
      id,
      batch_id,
      part_code,
      quantity_kg,
      location,
      snapshot_date,
      snapshot_timestamp,
      source
    FROM inventory_positions
    ORDER BY batch_id, part_code, location, snapshot_timestamp DESC
  ),

  -- Aggregate by part
  part_totals AS (
    SELECT
      part_code,
      SUM(quantity_kg) AS total_quantity_kg,
      COUNT(DISTINCT batch_id) AS batch_count,
      MAX(snapshot_date) AS latest_snapshot_date
    FROM latest_snapshots
    GROUP BY part_code
  ),

  -- Batch distribution per part (JSONB array)
  batch_distribution AS (
    SELECT
      ls.part_code,
      jsonb_agg(
        jsonb_build_object(
          'batch_id', ls.batch_id,
          'batch_ref', pb.batch_ref,
          'quantity_kg', ls.quantity_kg,
          'location', ls.location,
          'expiry_date', pb.expiry_date
        )
        ORDER BY pb.expiry_date ASC NULLS LAST
      ) AS batches
    FROM latest_snapshots ls
    JOIN production_batches pb ON pb.id = ls.batch_id
    WHERE ls.quantity_kg > 0
    GROUP BY ls.part_code
  )

SELECT
  pt.part_code,
  pt.total_quantity_kg,
  pt.batch_count,
  pt.latest_snapshot_date,
  COALESCE(bd.batches, '[]'::jsonb) AS batch_distribution,

  -- Data quality indicator
  CASE
    WHEN pt.total_quantity_kg IS NULL THEN 'NO_DATA'
    WHEN pt.total_quantity_kg = 0 THEN 'ZERO_STOCK'
    ELSE 'OK'
  END AS data_status

FROM part_totals pt
LEFT JOIN batch_distribution bd ON bd.part_code = pt.part_code
ORDER BY pt.part_code;

-- Comments
COMMENT ON VIEW v_inventory_by_part IS
  'Sprint 3: Current inventory per anatomical part with batch distribution.';

COMMENT ON COLUMN v_inventory_by_part.batch_distribution IS
  'JSONB array of batches with quantities, sorted by expiry date (FIFO).';

COMMENT ON COLUMN v_inventory_by_part.total_quantity_kg IS
  'Sum of all batch quantities for this part. Derived value.';


-- ============================================================
-- MIGRATION 99: 20260124100098_view_sales_velocity_by_part.sql
-- ============================================================

-- Sprint 3: v_sales_velocity_by_part view
-- Calculates average daily sales per anatomical part
-- Uses configurable reference periods

CREATE OR REPLACE VIEW v_sales_velocity_by_part AS
WITH
  -- Reference periods
  reference_config AS (
    SELECT
      30 AS days_short_term,   -- Last 30 days for primary velocity
      90 AS days_medium_term,  -- Last 90 days for smoothed velocity
      7 AS days_recent         -- Last 7 days for trend detection
  ),

  -- Sales by part in last 90 days
  sales_90d AS (
    SELECT
      part_code,
      sale_date,
      SUM(quantity_kg) AS daily_sales_kg
    FROM v_sales_by_part
    WHERE sale_date >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY part_code, sale_date
  ),

  -- Calculate velocities
  velocity_calc AS (
    SELECT
      s.part_code,

      -- 30-day average (primary)
      COALESCE(
        SUM(CASE WHEN s.sale_date >= CURRENT_DATE - INTERVAL '30 days' THEN s.daily_sales_kg END) /
          NULLIF(30, 0),
        0
      ) AS avg_daily_sales_30d,

      -- 90-day average (smoothed)
      COALESCE(
        SUM(s.daily_sales_kg) / NULLIF(90, 0),
        0
      ) AS avg_daily_sales_90d,

      -- 7-day average (recent trend)
      COALESCE(
        SUM(CASE WHEN s.sale_date >= CURRENT_DATE - INTERVAL '7 days' THEN s.daily_sales_kg END) /
          NULLIF(7, 0),
        0
      ) AS avg_daily_sales_7d,

      -- Total sales in period
      SUM(CASE WHEN s.sale_date >= CURRENT_DATE - INTERVAL '30 days' THEN s.daily_sales_kg END) AS total_sales_30d_kg,
      SUM(s.daily_sales_kg) AS total_sales_90d_kg,

      -- Days with sales
      COUNT(CASE WHEN s.sale_date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) AS days_with_sales_30d

    FROM sales_90d s
    GROUP BY s.part_code
  )

SELECT
  vc.part_code,

  -- Primary velocity (30-day average)
  ROUND(vc.avg_daily_sales_30d::numeric, 2) AS avg_daily_sales_kg,

  -- Reference period
  '30_days' AS reference_period,

  -- Additional velocities for context
  ROUND(vc.avg_daily_sales_90d::numeric, 2) AS avg_daily_sales_90d_kg,
  ROUND(vc.avg_daily_sales_7d::numeric, 2) AS avg_daily_sales_7d_kg,

  -- Volume context
  ROUND(vc.total_sales_30d_kg::numeric, 2) AS total_sales_30d_kg,
  vc.days_with_sales_30d,

  -- Trend indicator
  -- Comparing recent (7d) vs medium-term (30d) velocity
  CASE
    WHEN vc.avg_daily_sales_30d = 0 THEN 'NO_DATA'
    WHEN vc.avg_daily_sales_7d > vc.avg_daily_sales_30d * 1.2 THEN 'ACCELERATING'
    WHEN vc.avg_daily_sales_7d < vc.avg_daily_sales_30d * 0.8 THEN 'DECELERATING'
    ELSE 'STABLE'
  END AS velocity_trend,

  -- Data quality
  CASE
    WHEN vc.avg_daily_sales_30d = 0 AND vc.avg_daily_sales_90d = 0 THEN 'NO_SALES_DATA'
    WHEN vc.days_with_sales_30d < 10 THEN 'LIMITED_DATA'
    ELSE 'OK'
  END AS data_status

FROM velocity_calc vc
ORDER BY vc.avg_daily_sales_30d DESC;

-- Comments
COMMENT ON VIEW v_sales_velocity_by_part IS
  'Sprint 3: Sales velocity per anatomical part. Observational only.';

COMMENT ON COLUMN v_sales_velocity_by_part.avg_daily_sales_kg IS
  'Average daily sales over 30-day reference period.';

COMMENT ON COLUMN v_sales_velocity_by_part.velocity_trend IS
  'Trend comparing recent (7d) vs medium-term (30d). ACCELERATING/DECELERATING/STABLE/NO_DATA.';


-- ============================================================
-- MIGRATION 100: 20260124100099_view_sales_pressure_score.sql
-- ============================================================

-- Sprint 3: v_sales_pressure_score view
-- Main pressure indicator per anatomical part
-- DSI (Days Sales Inventory) is the key metric
-- OBSERVATIONAL ONLY - no actions, no advice

CREATE OR REPLACE VIEW v_sales_pressure_score AS
WITH
  -- Inventory data
  inventory AS (
    SELECT
      part_code,
      total_quantity_kg,
      batch_count,
      batch_distribution
    FROM v_inventory_by_part
  ),

  -- Velocity data
  velocity AS (
    SELECT
      part_code,
      avg_daily_sales_kg,
      avg_daily_sales_7d_kg,
      velocity_trend,
      data_status AS velocity_data_status
    FROM v_sales_velocity_by_part
  ),

  -- THT pressure from inventory batches
  -- Count batches by THT status
  tht_pressure AS (
    SELECT
      ip.part_code,
      COUNT(CASE
        WHEN pb.expiry_date IS NULL THEN NULL
        WHEN (CURRENT_DATE - pb.production_date) >=
             (pb.expiry_date - pb.production_date) * 0.9 THEN 1
      END) AS batches_red,
      COUNT(CASE
        WHEN pb.expiry_date IS NULL THEN NULL
        WHEN (CURRENT_DATE - pb.production_date) >=
             (pb.expiry_date - pb.production_date) * 0.7
         AND (CURRENT_DATE - pb.production_date) <
             (pb.expiry_date - pb.production_date) * 0.9 THEN 1
      END) AS batches_orange,
      COUNT(CASE
        WHEN pb.expiry_date IS NULL THEN NULL
        WHEN (CURRENT_DATE - pb.production_date) <
             (pb.expiry_date - pb.production_date) * 0.7 THEN 1
      END) AS batches_green
    FROM inventory_positions ip
    JOIN production_batches pb ON pb.id = ip.batch_id
    WHERE ip.quantity_kg > 0
    GROUP BY ip.part_code
  )

SELECT
  COALESCE(i.part_code, v.part_code) AS part_code,

  -- Inventory position
  COALESCE(i.total_quantity_kg, 0) AS inventory_kg,
  COALESCE(i.batch_count, 0) AS batch_count,

  -- Velocity
  COALESCE(v.avg_daily_sales_kg, 0) AS avg_daily_sales_kg,
  v.velocity_trend,

  -- DSI (Days Sales Inventory)
  -- Formula: inventory / avg_daily_sales
  CASE
    WHEN COALESCE(v.avg_daily_sales_kg, 0) <= 0 THEN NULL
    ELSE ROUND((COALESCE(i.total_quantity_kg, 0) / v.avg_daily_sales_kg)::numeric, 1)
  END AS days_sales_inventory,

  -- Pressure flag based on DSI thresholds
  -- Green: DSI < 14 days (fast moving)
  -- Orange: DSI 14-28 days (moderate)
  -- Red: DSI > 28 days (slow moving / overstocked)
  CASE
    WHEN COALESCE(i.total_quantity_kg, 0) = 0 THEN 'no_stock'
    WHEN COALESCE(v.avg_daily_sales_kg, 0) <= 0 THEN 'no_velocity'
    WHEN (i.total_quantity_kg / v.avg_daily_sales_kg) < 14 THEN 'green'
    WHEN (i.total_quantity_kg / v.avg_daily_sales_kg) < 28 THEN 'orange'
    ELSE 'red'
  END AS pressure_flag,

  -- THT pressure component
  COALESCE(tp.batches_red, 0) AS tht_batches_red,
  COALESCE(tp.batches_orange, 0) AS tht_batches_orange,
  COALESCE(tp.batches_green, 0) AS tht_batches_green,

  -- Combined pressure explanation (Dutch per Sprint 3 contract)
  CASE
    WHEN COALESCE(i.total_quantity_kg, 0) = 0 THEN
      'Geen voorraad beschikbaar.'
    WHEN COALESCE(v.avg_daily_sales_kg, 0) <= 0 THEN
      'Geen verkoopdata beschikbaar voor berekening verkoopdruk.'
    WHEN (i.total_quantity_kg / v.avg_daily_sales_kg) < 14 THEN
      'Normale voorraaddruk. Voorraad reikt ca. ' ||
      ROUND((i.total_quantity_kg / v.avg_daily_sales_kg)::numeric, 0)::text ||
      ' dagen bij huidig tempo.'
    WHEN (i.total_quantity_kg / v.avg_daily_sales_kg) < 28 THEN
      'Verhoogde voorraaddruk. Voorraad reikt ca. ' ||
      ROUND((i.total_quantity_kg / v.avg_daily_sales_kg)::numeric, 0)::text ||
      ' dagen. Let op THT-risico.'
    ELSE
      'Hoge voorraaddruk! Voorraad reikt ca. ' ||
      ROUND((i.total_quantity_kg / v.avg_daily_sales_kg)::numeric, 0)::text ||
      ' dagen. Actie vereist.'
  END AS explanation,

  -- Batch distribution for drill-down
  COALESCE(i.batch_distribution, '[]'::jsonb) AS batch_distribution,

  -- Data quality
  CASE
    WHEN i.total_quantity_kg IS NULL AND v.avg_daily_sales_kg IS NULL THEN 'NO_DATA'
    WHEN i.total_quantity_kg IS NULL THEN 'NO_INVENTORY_DATA'
    WHEN v.avg_daily_sales_kg IS NULL OR v.avg_daily_sales_kg <= 0 THEN 'NO_VELOCITY_DATA'
    ELSE 'OK'
  END AS data_status

FROM inventory i
FULL OUTER JOIN velocity v ON v.part_code = i.part_code
LEFT JOIN tht_pressure tp ON tp.part_code = COALESCE(i.part_code, v.part_code)
ORDER BY
  -- Sort by pressure: red first, then orange, then green
  CASE
    WHEN COALESCE(i.total_quantity_kg, 0) = 0 THEN 99
    WHEN COALESCE(v.avg_daily_sales_kg, 0) <= 0 THEN 98
    WHEN (i.total_quantity_kg / v.avg_daily_sales_kg) >= 28 THEN 1
    WHEN (i.total_quantity_kg / v.avg_daily_sales_kg) >= 14 THEN 2
    ELSE 3
  END,
  COALESCE(i.part_code, v.part_code);

-- Comments
COMMENT ON VIEW v_sales_pressure_score IS
  'Sprint 3: Sales pressure per part. DSI = Days Sales Inventory. OBSERVATIONAL ONLY - no actions.';

COMMENT ON COLUMN v_sales_pressure_score.days_sales_inventory IS
  'DSI = inventory_kg / avg_daily_sales_kg. How many days of stock at current velocity.';

COMMENT ON COLUMN v_sales_pressure_score.pressure_flag IS
  'Pressure indicator: green (<14d), orange (14-28d), red (>28d), no_stock, no_velocity.';

COMMENT ON COLUMN v_sales_pressure_score.explanation IS
  'Human-readable explanation of pressure status (Dutch).';


-- ============================================================
-- MIGRATION 101: 20260124100100_table_elasticity_assumptions.sql
-- ============================================================

-- Sprint 4: elasticity_assumptions table
-- Stores scenario assumptions for price elasticity modeling
-- NOTE: These are ASSUMPTIONS, not facts - scenarios must be labeled as such

CREATE TABLE IF NOT EXISTS elasticity_assumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Scenario identification
  scenario_id TEXT NOT NULL,
  scenario_name TEXT NOT NULL,
  scenario_description TEXT,

  -- Part affected
  part_code TEXT NOT NULL,

  -- Assumption parameters
  price_change_pct DECIMAL(8,4) NOT NULL,
  expected_volume_change_pct DECIMAL(8,4) NOT NULL,

  -- Documentation (critical for transparency)
  assumption_source TEXT NOT NULL
    CHECK (assumption_source IN ('manual', 'historical', 'market_research', 'expert_estimate')),
  assumption_note TEXT,

  -- Validity period
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT valid_date_range CHECK (valid_until IS NULL OR valid_until >= valid_from),
  CONSTRAINT unique_scenario_part UNIQUE (scenario_id, part_code, valid_from)
);

-- Indexes
CREATE INDEX idx_elasticity_assumptions_scenario ON elasticity_assumptions(scenario_id);
CREATE INDEX idx_elasticity_assumptions_part ON elasticity_assumptions(part_code);
CREATE INDEX idx_elasticity_assumptions_valid ON elasticity_assumptions(valid_from, valid_until);

-- RLS
ALTER TABLE elasticity_assumptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read access" ON elasticity_assumptions
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert" ON elasticity_assumptions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow authenticated update" ON elasticity_assumptions
  FOR UPDATE USING (true);

-- Comments
COMMENT ON TABLE elasticity_assumptions IS
  'Sprint 4: Price elasticity scenario assumptions. ANALYTICAL ONLY - scenarios are labeled assumptions, not truth.';

COMMENT ON COLUMN elasticity_assumptions.scenario_id IS
  'Unique identifier for the scenario. Multiple parts can share a scenario.';

COMMENT ON COLUMN elasticity_assumptions.price_change_pct IS
  'Assumed price change percentage (e.g., -10.0 = 10% price decrease).';

COMMENT ON COLUMN elasticity_assumptions.expected_volume_change_pct IS
  'Expected volume change percentage (e.g., +15.0 = 15% volume increase).';

COMMENT ON COLUMN elasticity_assumptions.assumption_source IS
  'Source of the assumption: manual, historical, market_research, expert_estimate.';

COMMENT ON COLUMN elasticity_assumptions.assumption_note IS
  'Free-text note explaining the basis for this assumption. Required for transparency.';


-- ============================================================
-- MIGRATION 102: 20260124100101_view_customer_intake_profile.sql
-- ============================================================

-- Sprint 4: v_customer_intake_profile view
-- Shows each customer's intake profile by anatomical part
-- For comparison against carcass balance (vierkantsverwaarding)

CREATE OR REPLACE VIEW v_customer_intake_profile AS
WITH
  -- Sales aggregated by customer and part (last 90 days for relevance)
  customer_part_sales AS (
    SELECT
      st.customer_id,
      c.name AS customer_name,
      c.customer_code,
      p.anatomical_part AS part_code,
      SUM(st.quantity_kg) AS quantity_kg,
      SUM(st.line_total) AS revenue_eur,
      COUNT(DISTINCT st.invoice_number) AS transaction_count
    FROM sales_transactions st
    JOIN customers c ON c.id = st.customer_id
    JOIN products p ON p.id = st.product_id
    WHERE st.invoice_date >= CURRENT_DATE - INTERVAL '90 days'
      AND st.is_credit = false
      AND p.anatomical_part IS NOT NULL
    GROUP BY st.customer_id, c.name, c.customer_code, p.anatomical_part
  ),

  -- Total per customer for share calculation
  customer_totals AS (
    SELECT
      customer_id,
      SUM(quantity_kg) AS total_quantity_kg,
      SUM(revenue_eur) AS total_revenue_eur
    FROM customer_part_sales
    GROUP BY customer_id
  )

SELECT
  cps.customer_id,
  cps.customer_name,
  cps.customer_code,
  cps.part_code,
  ROUND(cps.quantity_kg::numeric, 2) AS quantity_kg,
  ROUND(cps.revenue_eur::numeric, 2) AS revenue_eur,
  cps.transaction_count,

  -- Share of customer's total
  ROUND(
    (cps.quantity_kg / NULLIF(ct.total_quantity_kg, 0) * 100)::numeric,
    2
  ) AS share_of_total_pct,

  -- Customer total for context
  ROUND(ct.total_quantity_kg::numeric, 2) AS customer_total_kg,
  ROUND(ct.total_revenue_eur::numeric, 2) AS customer_total_revenue_eur,

  -- Reference period
  '90_days' AS reference_period

FROM customer_part_sales cps
JOIN customer_totals ct ON ct.customer_id = cps.customer_id
ORDER BY cps.customer_id, cps.quantity_kg DESC;

-- Comments
COMMENT ON VIEW v_customer_intake_profile IS
  'Sprint 4: Customer intake profile by anatomical part. Shows distribution of purchases for vierkantsverwaarding analysis.';

COMMENT ON COLUMN v_customer_intake_profile.share_of_total_pct IS
  'Percentage of this part in the customer''s total intake. Used for carcass alignment comparison.';

COMMENT ON COLUMN v_customer_intake_profile.reference_period IS
  'Time period used for aggregation. Currently fixed at 90 days.';


-- ============================================================
-- MIGRATION 103: 20260124100102_view_customer_carcass_alignment.sql
-- ============================================================

-- Sprint 4: v_customer_carcass_alignment view
-- Compares customer intake profile against carcass balance (vierkantsverwaarding)
-- Shows deviation per part - ANALYTICAL, not prescriptive

CREATE OR REPLACE VIEW v_customer_carcass_alignment AS
WITH
  -- JA757 anatomical reference ratios (from KPI_DEFINITIONS.md)
  -- These represent the natural carcass composition
  carcass_reference AS (
    SELECT 'breast_cap' AS part_code, 35.85 AS carcass_share_pct UNION ALL  -- (34.8 + 36.9) / 2
    SELECT 'leg_quarter', 43.40 UNION ALL                                   -- (42.0 + 44.8) / 2
    SELECT 'wings', 10.70 UNION ALL                                         -- (10.6 + 10.8) / 2
    SELECT 'back_carcass', 7.60 UNION ALL                                   -- (7.0 + 8.2) / 2
    SELECT 'offal', 4.00                                                    -- (3.0 + 5.0) / 2
  ),

  -- Customer intake from profile view
  customer_intake AS (
    SELECT
      customer_id,
      customer_name,
      customer_code,
      part_code,
      quantity_kg,
      share_of_total_pct,
      customer_total_kg
    FROM v_customer_intake_profile
  ),

  -- Deviation calculation per customer/part
  deviation_calc AS (
    SELECT
      ci.customer_id,
      ci.customer_name,
      ci.customer_code,
      ci.part_code,
      ci.quantity_kg,
      ci.share_of_total_pct AS customer_share_pct,
      cr.carcass_share_pct,
      ci.customer_total_kg,

      -- Deviation from carcass balance
      -- Positive = over-uptake (buying more than carcass proportion)
      -- Negative = under-uptake (buying less than carcass proportion)
      ROUND(
        (ci.share_of_total_pct - cr.carcass_share_pct)::numeric,
        2
      ) AS deviation_pct,

      -- Absolute deviation for scoring
      ABS(ci.share_of_total_pct - cr.carcass_share_pct) AS abs_deviation_pct

    FROM customer_intake ci
    JOIN carcass_reference cr ON cr.part_code = ci.part_code
  ),

  -- Alignment score per customer (lower = better aligned)
  -- Score is average absolute deviation from carcass balance
  customer_scores AS (
    SELECT
      customer_id,
      ROUND(AVG(abs_deviation_pct)::numeric, 2) AS avg_abs_deviation_pct,
      ROUND(MAX(abs_deviation_pct)::numeric, 2) AS max_deviation_pct,
      COUNT(DISTINCT part_code) AS parts_purchased
    FROM deviation_calc
    GROUP BY customer_id
  )

SELECT
  dc.customer_id,
  dc.customer_name,
  dc.customer_code,
  dc.part_code,
  dc.quantity_kg,
  dc.customer_share_pct,
  dc.carcass_share_pct,
  dc.deviation_pct,
  dc.customer_total_kg,

  -- Alignment score (inverted: 100 = perfect alignment, 0 = maximum deviation)
  -- Based on avg absolute deviation, max 25% deviation = 0 score
  GREATEST(0, ROUND(
    (100 - (cs.avg_abs_deviation_pct * 4))::numeric,
    1
  )) AS alignment_score,

  -- Deviation category per part
  CASE
    WHEN dc.deviation_pct > 10 THEN 'OVER_UPTAKE_HIGH'
    WHEN dc.deviation_pct > 5 THEN 'OVER_UPTAKE_MODERATE'
    WHEN dc.deviation_pct < -10 THEN 'UNDER_UPTAKE_HIGH'
    WHEN dc.deviation_pct < -5 THEN 'UNDER_UPTAKE_MODERATE'
    ELSE 'BALANCED'
  END AS deviation_category,

  -- Customer metrics
  cs.avg_abs_deviation_pct,
  cs.max_deviation_pct,
  cs.parts_purchased,

  -- Reference info
  'JA757' AS carcass_reference_source,
  '90_days' AS reference_period

FROM deviation_calc dc
JOIN customer_scores cs ON cs.customer_id = dc.customer_id
ORDER BY dc.customer_id, dc.part_code;

-- Comments
COMMENT ON VIEW v_customer_carcass_alignment IS
  'Sprint 4: Customer carcass alignment analysis. Compares customer intake to natural carcass proportions (vierkantsverwaarding). ANALYTICAL ONLY - no scoring or blame.';

COMMENT ON COLUMN v_customer_carcass_alignment.deviation_pct IS
  'Deviation from carcass proportion. Positive = over-uptake, Negative = under-uptake.';

COMMENT ON COLUMN v_customer_carcass_alignment.alignment_score IS
  'Customer alignment score (0-100). Higher = more balanced. For visibility only, NOT customer scoring/ranking.';

COMMENT ON COLUMN v_customer_carcass_alignment.deviation_category IS
  'Categorical label for deviation. Descriptive only - no judgment implied.';

COMMENT ON COLUMN v_customer_carcass_alignment.carcass_reference_source IS
  'Source of carcass proportions. JA757 (Hubbard spec) is NORMATIVE.';


-- ============================================================
-- MIGRATION 104: 20260124100103_view_scenario_impact.sql
-- ============================================================

-- Sprint 4: v_scenario_impact view
-- Projects impact of price elasticity scenarios on carcass balance
-- CRITICAL: Scenarios are ASSUMPTIONS, explicitly labeled as non-binding

CREATE OR REPLACE VIEW v_scenario_impact AS
WITH
  -- Current velocity from Sprint 3
  current_velocity AS (
    SELECT
      part_code,
      avg_daily_sales_kg,
      total_sales_30d_kg
    FROM v_sales_velocity_by_part
  ),

  -- Active elasticity assumptions
  active_assumptions AS (
    SELECT
      scenario_id,
      scenario_name,
      scenario_description,
      part_code,
      price_change_pct,
      expected_volume_change_pct,
      assumption_source,
      assumption_note
    FROM elasticity_assumptions
    WHERE (valid_until IS NULL OR valid_until >= CURRENT_DATE)
      AND valid_from <= CURRENT_DATE
  ),

  -- Calculate projected impact
  scenario_projections AS (
    SELECT
      aa.scenario_id,
      aa.scenario_name,
      aa.scenario_description,
      aa.part_code,
      aa.price_change_pct,
      aa.expected_volume_change_pct,
      aa.assumption_source,
      aa.assumption_note,

      -- Current baseline
      cv.avg_daily_sales_kg AS current_daily_kg,
      cv.total_sales_30d_kg AS current_30d_kg,

      -- Projected volume change
      ROUND(
        (cv.avg_daily_sales_kg * (1 + aa.expected_volume_change_pct / 100))::numeric,
        2
      ) AS projected_daily_kg,

      -- Volume delta
      ROUND(
        (cv.avg_daily_sales_kg * aa.expected_volume_change_pct / 100)::numeric,
        2
      ) AS volume_change_daily_kg,

      -- 30-day projection
      ROUND(
        (cv.total_sales_30d_kg * (1 + aa.expected_volume_change_pct / 100))::numeric,
        2
      ) AS projected_30d_kg

    FROM active_assumptions aa
    LEFT JOIN current_velocity cv ON cv.part_code = aa.part_code
  ),

  -- JA757 carcass reference for balance impact
  carcass_reference AS (
    SELECT 'breast_cap' AS part_code, 35.85 AS carcass_share_pct UNION ALL
    SELECT 'leg_quarter', 43.40 UNION ALL
    SELECT 'wings', 10.70 UNION ALL
    SELECT 'back_carcass', 7.60 UNION ALL
    SELECT 'offal', 4.00
  ),

  -- Calculate impact on carcass balance
  balance_impact AS (
    SELECT
      sp.scenario_id,
      sp.part_code,
      sp.current_daily_kg,
      sp.projected_daily_kg,
      cr.carcass_share_pct,

      -- If volume changes, how does it affect balance?
      -- Positive impact = moving toward carcass balance
      -- Negative impact = moving away from carcass balance
      CASE
        WHEN sp.current_daily_kg IS NULL OR sp.current_daily_kg = 0 THEN 'NO_BASELINE'
        WHEN ABS(sp.volume_change_daily_kg) < 0.01 THEN 'NEUTRAL'
        ELSE 'CHANGES_BALANCE'
      END AS balance_effect

    FROM scenario_projections sp
    LEFT JOIN carcass_reference cr ON cr.part_code = sp.part_code
  )

SELECT
  sp.scenario_id,
  sp.scenario_name,
  sp.scenario_description,
  sp.part_code,

  -- Price assumption
  sp.price_change_pct,

  -- Volume projection
  sp.expected_volume_change_pct,
  ROUND(sp.current_daily_kg::numeric, 2) AS current_daily_kg,
  sp.projected_daily_kg,
  sp.volume_change_daily_kg,
  sp.projected_30d_kg,

  -- Balance impact
  bi.balance_effect,

  -- Assumption transparency (CRITICAL)
  sp.assumption_source,
  sp.assumption_note,

  -- Explicit non-binding label
  'SCENARIO_ASSUMPTION' AS data_type,
  'This projection is based on assumptions and is NOT a prediction or recommendation.' AS disclaimer,

  -- Reference
  'JA757' AS carcass_reference,
  CURRENT_DATE AS projection_date

FROM scenario_projections sp
LEFT JOIN balance_impact bi ON bi.scenario_id = sp.scenario_id AND bi.part_code = sp.part_code
ORDER BY sp.scenario_id, sp.part_code;

-- Comments
COMMENT ON VIEW v_scenario_impact IS
  'Sprint 4: Scenario impact projections. CRITICAL: All values are ASSUMPTIONS, not predictions. Explicitly non-binding.';

COMMENT ON COLUMN v_scenario_impact.data_type IS
  'Always SCENARIO_ASSUMPTION. This is NOT factual data.';

COMMENT ON COLUMN v_scenario_impact.disclaimer IS
  'Legal/operational disclaimer. Must be displayed in any UI showing this data.';

COMMENT ON COLUMN v_scenario_impact.assumption_source IS
  'Source of the assumption: manual, historical, market_research, expert_estimate.';

COMMENT ON COLUMN v_scenario_impact.balance_effect IS
  'Indicates whether this scenario affects carcass balance. Descriptive only.';


-- ============================================================
-- MIGRATION 105: 20260124100104_table_customer_contracts.sql
-- ============================================================

-- =============================================================================
-- Sprint 5: Customer Contracts Table
-- =============================================================================
-- Purpose: Store contractual agreements between Oranjehoen and customers
-- regarding expected part share ranges per anatomical part.
--
-- This table enables:
-- - Tracking agreed share ranges per customer/part
-- - Comparing actual intake vs contractual agreements
-- - Providing context for margin discussions
--
-- NOT FOR: Automatic price adjustments, customer ranking, optimization
-- =============================================================================

CREATE TABLE IF NOT EXISTS customer_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Customer reference
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Part reference (anatomical part code)
  part_code VARCHAR(50) NOT NULL,

  -- Agreed share range (as percentage of total intake)
  agreed_share_min NUMERIC(5,2) NOT NULL CHECK (agreed_share_min >= 0 AND agreed_share_min <= 100),
  agreed_share_max NUMERIC(5,2) NOT NULL CHECK (agreed_share_max >= 0 AND agreed_share_max <= 100),

  -- Contract metadata
  contract_start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  contract_end_date DATE,

  -- Price tier (for margin context, not price calculation)
  price_tier VARCHAR(50),

  -- Notes for context (why this agreement exists)
  notes TEXT,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,

  -- Constraints
  CONSTRAINT customer_contracts_share_range_valid CHECK (agreed_share_min <= agreed_share_max),
  CONSTRAINT customer_contracts_unique_customer_part UNIQUE (customer_id, part_code, contract_start_date)
);

-- Index for efficient lookups
CREATE INDEX idx_customer_contracts_customer ON customer_contracts(customer_id);
CREATE INDEX idx_customer_contracts_part ON customer_contracts(part_code);
CREATE INDEX idx_customer_contracts_active ON customer_contracts(contract_end_date)
  WHERE contract_end_date IS NULL OR contract_end_date >= CURRENT_DATE;

-- Comment for documentation
COMMENT ON TABLE customer_contracts IS
'Sprint 5: Contractual agreements for customer part share ranges.
Used for comparing actual intake vs agreements.
NOT for automatic pricing or customer scoring.
Source: Manual entry or contract documents.';

COMMENT ON COLUMN customer_contracts.agreed_share_min IS 'Minimum agreed share of this part (% of total intake)';
COMMENT ON COLUMN customer_contracts.agreed_share_max IS 'Maximum agreed share of this part (% of total intake)';
COMMENT ON COLUMN customer_contracts.price_tier IS 'Price tier for margin context (not for calculation)';


-- ============================================================
-- MIGRATION 106: 20260124100105_table_customer_margin_context.sql
-- ============================================================

-- =============================================================================
-- Sprint 5: Customer Margin Context Table
-- =============================================================================
-- Purpose: Store precomputed margin context per customer/part for explanation.
-- This table provides the "why" behind margin numbers.
--
-- IMPORTANT: This table is for CONTEXT, not for calculations.
-- Actual margin calculations come from Sprint 2 NRV + sales data.
--
-- NOT FOR: Automatic pricing, customer scoring, optimization
-- =============================================================================

CREATE TABLE IF NOT EXISTS customer_margin_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Customer and part reference
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  part_code VARCHAR(50) NOT NULL,

  -- Period reference (for which this context was calculated)
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Revenue and cost figures (from Sprint 2 calculations)
  revenue_eur NUMERIC(12,2) NOT NULL,
  cost_eur NUMERIC(12,2) NOT NULL,
  margin_eur NUMERIC(12,2) NOT NULL,
  margin_pct NUMERIC(5,2),

  -- Volume context
  quantity_kg NUMERIC(10,2) NOT NULL,
  transaction_count INTEGER NOT NULL DEFAULT 0,

  -- Margin explanation (Dutch, for UI display)
  -- Explains WHY this margin exists in carcass context
  margin_explanation TEXT NOT NULL,

  -- Carcass context (from Sprint 4 alignment)
  customer_share_pct NUMERIC(5,2), -- Customer's share of this part
  carcass_share_pct NUMERIC(5,2),  -- Natural carcass share
  deviation_pct NUMERIC(5,2),       -- Deviation from carcass

  -- Data quality
  data_completeness VARCHAR(20) NOT NULL DEFAULT 'COMPLETE'
    CHECK (data_completeness IN ('COMPLETE', 'PARTIAL', 'ESTIMATED')),

  -- Calculation metadata
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  calculation_version VARCHAR(20) NOT NULL DEFAULT '1.0',

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT customer_margin_context_period_valid CHECK (period_start <= period_end),
  CONSTRAINT customer_margin_context_unique UNIQUE (customer_id, part_code, period_start, period_end)
);

-- Indexes for efficient lookups
CREATE INDEX idx_customer_margin_context_customer ON customer_margin_context(customer_id);
CREATE INDEX idx_customer_margin_context_part ON customer_margin_context(part_code);
CREATE INDEX idx_customer_margin_context_period ON customer_margin_context(period_start, period_end);
CREATE INDEX idx_customer_margin_context_calculated ON customer_margin_context(calculated_at);

-- Comment for documentation
COMMENT ON TABLE customer_margin_context IS
'Sprint 5: Precomputed margin context per customer/part for explanation.
Provides the "why" behind margin numbers in carcass context.
Source: Calculated from Sprint 2 NRV + sales data + Sprint 4 alignment.
NOT for automatic pricing or customer scoring.';

COMMENT ON COLUMN customer_margin_context.margin_explanation IS
'Dutch text explaining why this margin exists. For UI display.
Example: "Bovengemiddelde marge door goede afname van restdelen."';

COMMENT ON COLUMN customer_margin_context.data_completeness IS
'COMPLETE = all data available, PARTIAL = some data missing, ESTIMATED = values estimated';


-- ============================================================
-- MIGRATION 107: 20260124100106_view_customer_margin_by_part.sql
-- ============================================================

-- =============================================================================
-- Sprint 5: Customer Margin by Part View
-- =============================================================================
-- Purpose: Calculate margin per customer per anatomical part.
-- Joins sales transactions with NRV costs (Sprint 2) to show margin in context.
--
-- IMPORTANT: This view provides ANALYTICAL data for understanding margin.
-- It does NOT provide price advice or customer scoring.
--
-- Sources:
-- - sales_transactions (revenue)
-- - v_batch_nrv_by_sku (cost from Sprint 2)
-- - sku_part_mapping (SKU to part linkage)
-- =============================================================================

CREATE OR REPLACE VIEW v_customer_margin_by_part AS
WITH
-- Get sales by customer/SKU with part mapping
customer_sales AS (
  SELECT
    st.customer_id,
    c.name AS customer_name,
    c.customer_code,
    spm.part_code,
    st.quantity_kg,
    st.line_total AS revenue_eur,
    st.allocated_cost,
    st.invoice_date,
    st.batch_id
  FROM sales_transactions st
  JOIN customers c ON c.id = st.customer_id
  JOIN products p ON p.id = st.product_id
  LEFT JOIN sku_part_mapping spm ON spm.sku = p.sku_code AND spm.is_active = TRUE
  WHERE st.is_credit = FALSE
    AND st.invoice_date >= CURRENT_DATE - INTERVAL '90 days'
),

-- Aggregate by customer/part
customer_part_totals AS (
  SELECT
    customer_id,
    customer_name,
    customer_code,
    part_code,
    SUM(quantity_kg) AS quantity_kg,
    SUM(revenue_eur) AS revenue_eur,
    SUM(COALESCE(allocated_cost, 0)) AS cost_eur,
    COUNT(*) AS transaction_count,
    MIN(invoice_date) AS first_sale_date,
    MAX(invoice_date) AS last_sale_date
  FROM customer_sales
  WHERE part_code IS NOT NULL
  GROUP BY customer_id, customer_name, customer_code, part_code
),

-- Calculate customer totals for share calculation
customer_totals AS (
  SELECT
    customer_id,
    SUM(quantity_kg) AS total_kg,
    SUM(revenue_eur) AS total_revenue_eur,
    SUM(cost_eur) AS total_cost_eur
  FROM customer_part_totals
  GROUP BY customer_id
)

SELECT
  cpt.customer_id,
  cpt.customer_name,
  cpt.customer_code,
  cpt.part_code,

  -- Volume and revenue
  cpt.quantity_kg,
  cpt.revenue_eur,
  cpt.cost_eur,

  -- Margin calculation
  (cpt.revenue_eur - cpt.cost_eur) AS margin_eur,
  CASE
    WHEN cpt.revenue_eur > 0
    THEN ROUND(((cpt.revenue_eur - cpt.cost_eur) / cpt.revenue_eur * 100)::numeric, 2)
    ELSE NULL
  END AS margin_pct,

  -- Customer context
  CASE
    WHEN ct.total_kg > 0
    THEN ROUND((cpt.quantity_kg / ct.total_kg * 100)::numeric, 2)
    ELSE NULL
  END AS customer_share_pct,
  ct.total_kg AS customer_total_kg,
  ct.total_revenue_eur AS customer_total_revenue_eur,
  ct.total_cost_eur AS customer_total_cost_eur,

  -- Transaction metrics
  cpt.transaction_count,
  cpt.first_sale_date,
  cpt.last_sale_date,

  -- Data quality
  CASE
    WHEN cpt.cost_eur > 0 THEN 'COST_AVAILABLE'
    ELSE 'NO_COST_DATA'
  END AS cost_data_status,

  -- Reference period
  '90_days' AS reference_period

FROM customer_part_totals cpt
JOIN customer_totals ct ON ct.customer_id = cpt.customer_id
WHERE cpt.quantity_kg > 0
ORDER BY cpt.customer_name, cpt.part_code;

-- Comment for documentation
COMMENT ON VIEW v_customer_margin_by_part IS
'Sprint 5: Margin per customer per anatomical part (90-day rolling window).
Source: sales_transactions + allocated costs (Sprint 2 NRV).
Purpose: Analytical view for understanding margin in carcass context.
NOT for: Price advice, customer scoring, optimization.';


-- ============================================================
-- MIGRATION 108: 20260124100107_view_customer_contract_deviation.sql
-- ============================================================

-- =============================================================================
-- Sprint 5: Customer Contract Deviation View
-- =============================================================================
-- Purpose: Compare actual customer intake vs contractual agreements.
-- Shows where customers deviate from agreed share ranges.
--
-- IMPORTANT: This view provides ANALYTICAL data for commercial conversations.
-- It does NOT judge customers or recommend actions.
--
-- Deviation flags are DESCRIPTIVE, not prescriptive:
-- - WITHIN_RANGE: Actual is within agreed range
-- - BELOW_RANGE: Actual is below agreed minimum
-- - ABOVE_RANGE: Actual is above agreed maximum
-- - NO_CONTRACT: No contract exists for this combination
-- =============================================================================

CREATE OR REPLACE VIEW v_customer_contract_deviation AS
WITH
-- Get actual intake from v_customer_intake_profile (Sprint 4)
actual_intake AS (
  SELECT
    cip.customer_id,
    cip.customer_name,
    cip.customer_code,
    cip.part_code,
    cip.quantity_kg,
    cip.share_of_total_pct AS actual_share,
    cip.customer_total_kg,
    cip.reference_period
  FROM v_customer_intake_profile cip
),

-- Get active contracts
active_contracts AS (
  SELECT
    cc.customer_id,
    cc.part_code,
    cc.agreed_share_min,
    cc.agreed_share_max,
    cc.price_tier,
    cc.notes AS contract_notes,
    cc.contract_start_date,
    cc.contract_end_date
  FROM customer_contracts cc
  WHERE cc.contract_end_date IS NULL
     OR cc.contract_end_date >= CURRENT_DATE
),

-- Join actual intake with contracts
intake_with_contracts AS (
  SELECT
    ai.customer_id,
    ai.customer_name,
    ai.customer_code,
    ai.part_code,
    ai.quantity_kg,
    ai.actual_share,
    ai.customer_total_kg,
    ai.reference_period,
    ac.agreed_share_min,
    ac.agreed_share_max,
    ac.price_tier,
    ac.contract_notes,
    ac.contract_start_date
  FROM actual_intake ai
  LEFT JOIN active_contracts ac
    ON ac.customer_id = ai.customer_id
    AND ac.part_code = ai.part_code
)

SELECT
  iwc.customer_id,
  iwc.customer_name,
  iwc.customer_code,
  iwc.part_code,

  -- Actual intake
  iwc.quantity_kg,
  iwc.actual_share,
  iwc.customer_total_kg,

  -- Contract range (NULL if no contract)
  iwc.agreed_share_min,
  iwc.agreed_share_max,
  CASE
    WHEN iwc.agreed_share_min IS NOT NULL
    THEN CONCAT(iwc.agreed_share_min::text, '% - ', iwc.agreed_share_max::text, '%')
    ELSE NULL
  END AS agreed_range,

  -- Deviation calculation
  CASE
    WHEN iwc.agreed_share_min IS NULL THEN NULL
    WHEN iwc.actual_share < iwc.agreed_share_min THEN iwc.actual_share - iwc.agreed_share_min
    WHEN iwc.actual_share > iwc.agreed_share_max THEN iwc.actual_share - iwc.agreed_share_max
    ELSE 0
  END AS deviation_pct,

  -- Deviation flag (DESCRIPTIVE, not prescriptive)
  CASE
    WHEN iwc.agreed_share_min IS NULL THEN 'NO_CONTRACT'
    WHEN iwc.actual_share < iwc.agreed_share_min THEN 'BELOW_RANGE'
    WHEN iwc.actual_share > iwc.agreed_share_max THEN 'ABOVE_RANGE'
    ELSE 'WITHIN_RANGE'
  END AS deviation_flag,

  -- Dutch explanation (for UI display)
  CASE
    WHEN iwc.agreed_share_min IS NULL THEN
      'Geen contract voor dit onderdeel.'
    WHEN iwc.actual_share < iwc.agreed_share_min THEN
      CONCAT('Afname (', ROUND(iwc.actual_share, 1)::text, '%) is lager dan afgesproken minimum (',
             iwc.agreed_share_min::text, '%).')
    WHEN iwc.actual_share > iwc.agreed_share_max THEN
      CONCAT('Afname (', ROUND(iwc.actual_share, 1)::text, '%) is hoger dan afgesproken maximum (',
             iwc.agreed_share_max::text, '%).')
    ELSE
      CONCAT('Afname (', ROUND(iwc.actual_share, 1)::text, '%) valt binnen afgesproken bandbreedte.')
  END AS explanation,

  -- Contract context
  iwc.price_tier,
  iwc.contract_notes,
  iwc.contract_start_date,

  -- Reference period
  iwc.reference_period,

  -- Data quality
  CASE
    WHEN iwc.agreed_share_min IS NOT NULL THEN 'CONTRACT_EXISTS'
    ELSE 'NO_CONTRACT'
  END AS contract_status

FROM intake_with_contracts iwc
ORDER BY iwc.customer_name, iwc.part_code;

-- Comment for documentation
COMMENT ON VIEW v_customer_contract_deviation IS
'Sprint 5: Compare actual customer intake vs contractual agreements.
Shows deviations from agreed share ranges with Dutch explanations.
Purpose: Support commercial conversations with context.
Deviation flags are DESCRIPTIVE (WITHIN_RANGE, BELOW_RANGE, ABOVE_RANGE, NO_CONTRACT).
NOT for: Customer scoring, automatic actions, price advice.';


-- ============================================================
-- MIGRATION 109: 20260124100108_table_batch_history.sql
-- ============================================================

-- =============================================================================
-- Sprint 6: Batch History Table
-- =============================================================================
-- Purpose: Store batch-level historical metrics for trend analysis.
-- This table enables time-based pattern analysis.
--
-- IMPORTANT: This is OBSERVATIONAL data for learning, not forecasting.
-- Trends are DESCRIPTIVE, not predictive.
--
-- NOT FOR: Forecasting, predictions, automatic optimization
-- =============================================================================

CREATE TABLE IF NOT EXISTS batch_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Batch reference
  batch_id UUID NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
  batch_ref TEXT NOT NULL,

  -- Time dimensions
  slaughter_date DATE NOT NULL,
  slaughter_week INTEGER NOT NULL,
  slaughter_month INTEGER NOT NULL,
  slaughter_quarter INTEGER NOT NULL,
  slaughter_year INTEGER NOT NULL,

  -- Season (for seasonal pattern analysis)
  season VARCHAR(20) NOT NULL CHECK (season IN ('Q1', 'Q2', 'Q3', 'Q4')),

  -- Key metrics snapshot (JSON for flexibility)
  key_metrics JSONB NOT NULL DEFAULT '{}',

  -- Individual metrics for efficient querying
  griller_yield_pct NUMERIC(5,2),
  total_cost_eur NUMERIC(12,2),
  total_revenue_eur NUMERIC(12,2),
  total_margin_eur NUMERIC(12,2),
  total_margin_pct NUMERIC(5,2),
  bird_count INTEGER,
  live_weight_kg NUMERIC(10,2),

  -- Part-level yields (for yield trend analysis)
  breast_cap_yield_pct NUMERIC(5,2),
  leg_quarter_yield_pct NUMERIC(5,2),
  wings_yield_pct NUMERIC(5,2),
  back_carcass_yield_pct NUMERIC(5,2),

  -- Data quality
  data_completeness VARCHAR(20) NOT NULL DEFAULT 'COMPLETE'
    CHECK (data_completeness IN ('COMPLETE', 'PARTIAL', 'ESTIMATED')),

  -- Snapshot metadata
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  snapshot_version VARCHAR(20) NOT NULL DEFAULT '1.0',

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT batch_history_unique_batch UNIQUE (batch_id)
);

-- Indexes for efficient trend queries
CREATE INDEX idx_batch_history_date ON batch_history(slaughter_date);
CREATE INDEX idx_batch_history_year_week ON batch_history(slaughter_year, slaughter_week);
CREATE INDEX idx_batch_history_year_month ON batch_history(slaughter_year, slaughter_month);
CREATE INDEX idx_batch_history_season ON batch_history(season, slaughter_year);
CREATE INDEX idx_batch_history_snapshot ON batch_history(snapshot_at);

-- Comment for documentation
COMMENT ON TABLE batch_history IS
'Sprint 6: Batch-level historical metrics for trend analysis.
Purpose: Enable pattern learning over time.
Trends are DESCRIPTIVE, not predictive.
NOT for forecasting or automatic optimization.';

COMMENT ON COLUMN batch_history.key_metrics IS
'JSONB snapshot of all relevant metrics at time of batch closure.
Includes: yields, costs, margins, quality indicators.';

COMMENT ON COLUMN batch_history.season IS
'Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec.
For seasonal pattern analysis only.';


-- ============================================================
-- MIGRATION 110: 20260124100109_view_part_trend_over_time.sql
-- ============================================================

-- =============================================================================
-- Sprint 6: Part Trend Over Time View
-- =============================================================================
-- Purpose: Show historical trends per anatomical part across periods.
-- Enables pattern recognition for yield, margin, and pressure over time.
--
-- IMPORTANT: Trends are DESCRIPTIVE, not predictive.
-- This view supports learning, not forecasting.
--
-- Aggregation levels: weekly, monthly, quarterly
-- =============================================================================

CREATE OR REPLACE VIEW v_part_trend_over_time AS
WITH
-- Get weekly yield data from batch_yields
weekly_yields AS (
  SELECT
    by_.anatomical_part AS part_code,
    DATE_TRUNC('week', pb.slaughter_date)::DATE AS period_start,
    'week' AS period_type,
    EXTRACT(WEEK FROM pb.slaughter_date)::INTEGER AS period_number,
    EXTRACT(YEAR FROM pb.slaughter_date)::INTEGER AS period_year,
    AVG(by_.yield_pct) AS avg_yield_pct,
    STDDEV(by_.yield_pct) AS yield_stddev,
    COUNT(DISTINCT pb.id) AS batch_count,
    SUM(by_.actual_weight_kg) AS total_weight_kg
  FROM batch_yields by_
  JOIN production_batches pb ON pb.id = by_.batch_id
  WHERE by_.is_correction = FALSE
    AND pb.slaughter_date >= CURRENT_DATE - INTERVAL '365 days'
  GROUP BY
    by_.anatomical_part,
    DATE_TRUNC('week', pb.slaughter_date),
    EXTRACT(WEEK FROM pb.slaughter_date),
    EXTRACT(YEAR FROM pb.slaughter_date)
),

-- Get monthly yield data
monthly_yields AS (
  SELECT
    by_.anatomical_part AS part_code,
    DATE_TRUNC('month', pb.slaughter_date)::DATE AS period_start,
    'month' AS period_type,
    EXTRACT(MONTH FROM pb.slaughter_date)::INTEGER AS period_number,
    EXTRACT(YEAR FROM pb.slaughter_date)::INTEGER AS period_year,
    AVG(by_.yield_pct) AS avg_yield_pct,
    STDDEV(by_.yield_pct) AS yield_stddev,
    COUNT(DISTINCT pb.id) AS batch_count,
    SUM(by_.actual_weight_kg) AS total_weight_kg
  FROM batch_yields by_
  JOIN production_batches pb ON pb.id = by_.batch_id
  WHERE by_.is_correction = FALSE
    AND pb.slaughter_date >= CURRENT_DATE - INTERVAL '365 days'
  GROUP BY
    by_.anatomical_part,
    DATE_TRUNC('month', pb.slaughter_date),
    EXTRACT(MONTH FROM pb.slaughter_date),
    EXTRACT(YEAR FROM pb.slaughter_date)
),

-- Get weekly sales/margin data from sales_transactions
weekly_sales AS (
  SELECT
    p.anatomical_part AS part_code,
    DATE_TRUNC('week', st.invoice_date)::DATE AS period_start,
    'week' AS period_type,
    EXTRACT(WEEK FROM st.invoice_date)::INTEGER AS period_number,
    EXTRACT(YEAR FROM st.invoice_date)::INTEGER AS period_year,
    SUM(st.quantity_kg) AS total_sold_kg,
    SUM(st.line_total) AS total_revenue_eur,
    SUM(COALESCE(st.allocated_cost, 0)) AS total_cost_eur,
    SUM(st.line_total - COALESCE(st.allocated_cost, 0)) AS total_margin_eur,
    CASE
      WHEN SUM(st.line_total) > 0
      THEN ROUND(((SUM(st.line_total - COALESCE(st.allocated_cost, 0)) / SUM(st.line_total)) * 100)::numeric, 2)
      ELSE NULL
    END AS avg_margin_pct,
    COUNT(*) AS transaction_count
  FROM sales_transactions st
  JOIN products p ON p.id = st.product_id
  WHERE p.anatomical_part IS NOT NULL
    AND st.is_credit = FALSE
    AND st.invoice_date >= CURRENT_DATE - INTERVAL '365 days'
  GROUP BY
    p.anatomical_part,
    DATE_TRUNC('week', st.invoice_date),
    EXTRACT(WEEK FROM st.invoice_date),
    EXTRACT(YEAR FROM st.invoice_date)
),

-- Get monthly sales data
monthly_sales AS (
  SELECT
    p.anatomical_part AS part_code,
    DATE_TRUNC('month', st.invoice_date)::DATE AS period_start,
    'month' AS period_type,
    EXTRACT(MONTH FROM st.invoice_date)::INTEGER AS period_number,
    EXTRACT(YEAR FROM st.invoice_date)::INTEGER AS period_year,
    SUM(st.quantity_kg) AS total_sold_kg,
    SUM(st.line_total) AS total_revenue_eur,
    SUM(COALESCE(st.allocated_cost, 0)) AS total_cost_eur,
    SUM(st.line_total - COALESCE(st.allocated_cost, 0)) AS total_margin_eur,
    CASE
      WHEN SUM(st.line_total) > 0
      THEN ROUND(((SUM(st.line_total - COALESCE(st.allocated_cost, 0)) / SUM(st.line_total)) * 100)::numeric, 2)
      ELSE NULL
    END AS avg_margin_pct,
    COUNT(*) AS transaction_count
  FROM sales_transactions st
  JOIN products p ON p.id = st.product_id
  WHERE p.anatomical_part IS NOT NULL
    AND st.is_credit = FALSE
    AND st.invoice_date >= CURRENT_DATE - INTERVAL '365 days'
  GROUP BY
    p.anatomical_part,
    DATE_TRUNC('month', st.invoice_date),
    EXTRACT(MONTH FROM st.invoice_date),
    EXTRACT(YEAR FROM st.invoice_date)
),

-- Get weekly DSI (inventory pressure) from pressure view
weekly_pressure AS (
  SELECT
    ip.part_code,
    DATE_TRUNC('week', ip.snapshot_date)::DATE AS period_start,
    'week' AS period_type,
    EXTRACT(WEEK FROM ip.snapshot_date)::INTEGER AS period_number,
    EXTRACT(YEAR FROM ip.snapshot_date)::INTEGER AS period_year,
    AVG(ip.quantity_kg) AS avg_inventory_kg
  FROM inventory_positions ip
  WHERE ip.snapshot_date >= CURRENT_DATE - INTERVAL '365 days'
  GROUP BY
    ip.part_code,
    DATE_TRUNC('week', ip.snapshot_date),
    EXTRACT(WEEK FROM ip.snapshot_date),
    EXTRACT(YEAR FROM ip.snapshot_date)
),

-- Combine weekly data
weekly_combined AS (
  SELECT
    COALESCE(wy.part_code, ws.part_code, wp.part_code) AS part_code,
    COALESCE(wy.period_start, ws.period_start, wp.period_start) AS period_start,
    'week' AS period_type,
    COALESCE(wy.period_number, ws.period_number, wp.period_number) AS period_number,
    COALESCE(wy.period_year, ws.period_year, wp.period_year) AS period_year,
    wy.avg_yield_pct,
    wy.yield_stddev,
    wy.batch_count,
    wy.total_weight_kg AS produced_kg,
    ws.total_sold_kg,
    ws.total_revenue_eur,
    ws.total_cost_eur,
    ws.total_margin_eur,
    ws.avg_margin_pct,
    ws.transaction_count,
    wp.avg_inventory_kg,
    CASE
      WHEN ws.total_sold_kg > 0 AND wp.avg_inventory_kg > 0
      THEN ROUND((wp.avg_inventory_kg / (ws.total_sold_kg / 7))::numeric, 1)
      ELSE NULL
    END AS avg_dsi
  FROM weekly_yields wy
  FULL OUTER JOIN weekly_sales ws
    ON ws.part_code = wy.part_code
    AND ws.period_start = wy.period_start
  FULL OUTER JOIN weekly_pressure wp
    ON wp.part_code = COALESCE(wy.part_code, ws.part_code)
    AND wp.period_start = COALESCE(wy.period_start, ws.period_start)
),

-- Combine monthly data
monthly_combined AS (
  SELECT
    COALESCE(my.part_code, ms.part_code) AS part_code,
    COALESCE(my.period_start, ms.period_start) AS period_start,
    'month' AS period_type,
    COALESCE(my.period_number, ms.period_number) AS period_number,
    COALESCE(my.period_year, ms.period_year) AS period_year,
    my.avg_yield_pct,
    my.yield_stddev,
    my.batch_count,
    my.total_weight_kg AS produced_kg,
    ms.total_sold_kg,
    ms.total_revenue_eur,
    ms.total_cost_eur,
    ms.total_margin_eur,
    ms.avg_margin_pct,
    ms.transaction_count,
    NULL::numeric AS avg_inventory_kg,
    NULL::numeric AS avg_dsi
  FROM monthly_yields my
  FULL OUTER JOIN monthly_sales ms
    ON ms.part_code = my.part_code
    AND ms.period_start = my.period_start
)

-- Final union
SELECT
  part_code,
  period_start,
  period_type,
  period_number,
  period_year,
  avg_yield_pct,
  yield_stddev,
  batch_count,
  produced_kg,
  total_sold_kg,
  total_revenue_eur,
  total_cost_eur,
  total_margin_eur,
  avg_margin_pct,
  transaction_count,
  avg_inventory_kg,
  avg_dsi,
  -- Data quality indicator
  CASE
    WHEN batch_count > 0 AND total_sold_kg > 0 THEN 'COMPLETE'
    WHEN batch_count > 0 OR total_sold_kg > 0 THEN 'PARTIAL'
    ELSE 'NO_DATA'
  END AS data_status,
  -- Data type label
  'HISTORICAL_TREND' AS data_type
FROM (
  SELECT * FROM weekly_combined
  UNION ALL
  SELECT * FROM monthly_combined
) combined
WHERE part_code IS NOT NULL
ORDER BY part_code, period_year DESC, period_number DESC;

-- Comment for documentation
COMMENT ON VIEW v_part_trend_over_time IS
'Sprint 6: Historical trends per anatomical part across periods (weekly, monthly).
Shows yield, margin, and DSI trends over the past 365 days.
Purpose: Pattern learning, not forecasting.
Trends are DESCRIPTIVE, not predictive.
NOT for: Forecasting, predictions, automatic optimization.';


-- ============================================================
-- MIGRATION 111: 20260124100110_view_customer_trend_over_time.sql
-- ============================================================

-- =============================================================================
-- Sprint 6: Customer Trend Over Time View
-- =============================================================================
-- Purpose: Show historical trends per customer across periods.
-- Enables pattern recognition for alignment, margin, and volume over time.
--
-- IMPORTANT: Trends are DESCRIPTIVE, not predictive.
-- This view supports learning, not forecasting.
--
-- Aggregation levels: monthly only (weekly too granular for customer analysis)
-- =============================================================================

CREATE OR REPLACE VIEW v_customer_trend_over_time AS
WITH
-- Get monthly customer sales with alignment data
monthly_customer_sales AS (
  SELECT
    st.customer_id,
    c.name AS customer_name,
    c.customer_code,
    DATE_TRUNC('month', st.invoice_date)::DATE AS period_start,
    'month' AS period_type,
    EXTRACT(MONTH FROM st.invoice_date)::INTEGER AS period_number,
    EXTRACT(YEAR FROM st.invoice_date)::INTEGER AS period_year,

    -- Volume metrics
    SUM(st.quantity_kg) AS total_kg,
    SUM(st.line_total) AS total_revenue_eur,
    SUM(COALESCE(st.allocated_cost, 0)) AS total_cost_eur,
    SUM(st.line_total - COALESCE(st.allocated_cost, 0)) AS total_margin_eur,
    CASE
      WHEN SUM(st.line_total) > 0
      THEN ROUND(((SUM(st.line_total - COALESCE(st.allocated_cost, 0)) / SUM(st.line_total)) * 100)::numeric, 2)
      ELSE NULL
    END AS margin_pct,
    COUNT(*) AS transaction_count

  FROM sales_transactions st
  JOIN customers c ON c.id = st.customer_id
  WHERE st.is_credit = FALSE
    AND st.invoice_date >= CURRENT_DATE - INTERVAL '365 days'
  GROUP BY
    st.customer_id,
    c.name,
    c.customer_code,
    DATE_TRUNC('month', st.invoice_date),
    EXTRACT(MONTH FROM st.invoice_date),
    EXTRACT(YEAR FROM st.invoice_date)
),

-- Get monthly customer alignment (via intake profile)
monthly_customer_alignment AS (
  SELECT
    st.customer_id,
    DATE_TRUNC('month', st.invoice_date)::DATE AS period_start,
    p.anatomical_part AS part_code,
    SUM(st.quantity_kg) AS part_kg,
    SUM(SUM(st.quantity_kg)) OVER (PARTITION BY st.customer_id, DATE_TRUNC('month', st.invoice_date)) AS customer_total_kg
  FROM sales_transactions st
  JOIN products p ON p.id = st.product_id
  WHERE p.anatomical_part IS NOT NULL
    AND st.is_credit = FALSE
    AND st.invoice_date >= CURRENT_DATE - INTERVAL '365 days'
  GROUP BY
    st.customer_id,
    DATE_TRUNC('month', st.invoice_date),
    p.anatomical_part
),

-- Calculate alignment score per month
-- Uses JA757 reference (midpoints)
monthly_alignment_score AS (
  SELECT
    mca.customer_id,
    mca.period_start,
    -- Calculate average absolute deviation from carcass proportions
    -- JA757 midpoints: breast_cap=35.85, leg_quarter=43.40, wings=10.70, back_carcass=7.60, offal=4.00
    AVG(ABS(
      CASE mca.part_code
        WHEN 'breast_cap' THEN (mca.part_kg / NULLIF(mca.customer_total_kg, 0) * 100) - 35.85
        WHEN 'leg_quarter' THEN (mca.part_kg / NULLIF(mca.customer_total_kg, 0) * 100) - 43.40
        WHEN 'wings' THEN (mca.part_kg / NULLIF(mca.customer_total_kg, 0) * 100) - 10.70
        WHEN 'back_carcass' THEN (mca.part_kg / NULLIF(mca.customer_total_kg, 0) * 100) - 7.60
        WHEN 'offal' THEN (mca.part_kg / NULLIF(mca.customer_total_kg, 0) * 100) - 4.00
        ELSE 0
      END
    )) AS avg_abs_deviation,
    -- Alignment score = 100 - (avg_abs_deviation * 4)
    GREATEST(0, 100 - (AVG(ABS(
      CASE mca.part_code
        WHEN 'breast_cap' THEN (mca.part_kg / NULLIF(mca.customer_total_kg, 0) * 100) - 35.85
        WHEN 'leg_quarter' THEN (mca.part_kg / NULLIF(mca.customer_total_kg, 0) * 100) - 43.40
        WHEN 'wings' THEN (mca.part_kg / NULLIF(mca.customer_total_kg, 0) * 100) - 10.70
        WHEN 'back_carcass' THEN (mca.part_kg / NULLIF(mca.customer_total_kg, 0) * 100) - 7.60
        WHEN 'offal' THEN (mca.part_kg / NULLIF(mca.customer_total_kg, 0) * 100) - 4.00
        ELSE 0
      END
    )) * 4)) AS alignment_score,
    COUNT(DISTINCT mca.part_code) AS parts_purchased
  FROM monthly_customer_alignment mca
  WHERE mca.customer_total_kg > 0
  GROUP BY mca.customer_id, mca.period_start
)

-- Final output
SELECT
  mcs.customer_id,
  mcs.customer_name,
  mcs.customer_code,
  mcs.period_start,
  mcs.period_type,
  mcs.period_number,
  mcs.period_year,

  -- Volume metrics
  mcs.total_kg,
  mcs.total_revenue_eur,
  mcs.total_cost_eur,
  mcs.total_margin_eur,
  mcs.margin_pct,
  mcs.transaction_count,

  -- Alignment metrics
  ROUND(mas.alignment_score::numeric, 1) AS alignment_score,
  ROUND(mas.avg_abs_deviation::numeric, 2) AS avg_abs_deviation,
  mas.parts_purchased,

  -- Trend indicators (compare to previous period)
  LAG(mcs.total_kg) OVER (
    PARTITION BY mcs.customer_id ORDER BY mcs.period_start
  ) AS prev_period_kg,
  LAG(mcs.margin_pct) OVER (
    PARTITION BY mcs.customer_id ORDER BY mcs.period_start
  ) AS prev_period_margin_pct,
  LAG(mas.alignment_score) OVER (
    PARTITION BY mcs.customer_id ORDER BY mcs.period_start
  ) AS prev_period_alignment,

  -- Volume change
  CASE
    WHEN LAG(mcs.total_kg) OVER (PARTITION BY mcs.customer_id ORDER BY mcs.period_start) > 0
    THEN ROUND(((mcs.total_kg - LAG(mcs.total_kg) OVER (PARTITION BY mcs.customer_id ORDER BY mcs.period_start))
           / LAG(mcs.total_kg) OVER (PARTITION BY mcs.customer_id ORDER BY mcs.period_start) * 100)::numeric, 1)
    ELSE NULL
  END AS volume_change_pct,

  -- Margin change
  CASE
    WHEN LAG(mcs.margin_pct) OVER (PARTITION BY mcs.customer_id ORDER BY mcs.period_start) IS NOT NULL
    THEN ROUND((mcs.margin_pct - LAG(mcs.margin_pct) OVER (PARTITION BY mcs.customer_id ORDER BY mcs.period_start))::numeric, 2)
    ELSE NULL
  END AS margin_change_pct,

  -- Alignment change
  CASE
    WHEN LAG(mas.alignment_score) OVER (PARTITION BY mcs.customer_id ORDER BY mcs.period_start) IS NOT NULL
    THEN ROUND((mas.alignment_score - LAG(mas.alignment_score) OVER (PARTITION BY mcs.customer_id ORDER BY mcs.period_start))::numeric, 1)
    ELSE NULL
  END AS alignment_change,

  -- Data quality
  CASE
    WHEN mcs.total_kg > 0 AND mas.alignment_score IS NOT NULL THEN 'COMPLETE'
    WHEN mcs.total_kg > 0 THEN 'PARTIAL'
    ELSE 'NO_DATA'
  END AS data_status,

  -- Data type label
  'HISTORICAL_TREND' AS data_type,

  -- Carcass reference
  'JA757' AS carcass_reference

FROM monthly_customer_sales mcs
LEFT JOIN monthly_alignment_score mas
  ON mas.customer_id = mcs.customer_id
  AND mas.period_start = mcs.period_start
ORDER BY mcs.customer_name, mcs.period_year DESC, mcs.period_number DESC;

-- Comment for documentation
COMMENT ON VIEW v_customer_trend_over_time IS
'Sprint 6: Historical trends per customer across monthly periods.
Shows alignment, margin, and volume trends over the past 365 days.
Includes period-over-period change indicators.
Purpose: Pattern learning, not forecasting.
Trends are DESCRIPTIVE, not predictive.
NOT for: Forecasting, predictions, automatic optimization.';


-- ============================================================
-- MIGRATION 112: 20260124100111_table_std_yields.sql
-- ============================================================

-- =============================================================================
-- Sprint 7: Standard Yields Table (Canonical Cost Engine)
-- =============================================================================
-- Purpose: Normative yields for every process step.
-- Used to calculate standard costs and variances.
--
-- Per canonical document Section 6.1:
-- "std_yields: Normative yields for every process step"
-- =============================================================================

CREATE TABLE IF NOT EXISTS std_yields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Process identification
  process_id VARCHAR(50) NOT NULL,
  process_name VARCHAR(100) NOT NULL,

  -- Input/Output parts
  input_part VARCHAR(50) NOT NULL,
  output_part VARCHAR(50) NOT NULL,

  -- Standard yield percentage (0-100)
  std_yield_pct NUMERIC(5,2) NOT NULL CHECK (std_yield_pct >= 0 AND std_yield_pct <= 100),

  -- Value category for cost allocation
  value_category VARCHAR(20) NOT NULL DEFAULT 'MAIN_PRODUCT'
    CHECK (value_category IN ('MAIN_PRODUCT', 'BY_PRODUCT')),

  -- Effective period
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,

  -- Source and notes
  source VARCHAR(100) NOT NULL DEFAULT 'manual',
  notes TEXT,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT std_yields_effective_dates CHECK (effective_to IS NULL OR effective_to > effective_from),
  CONSTRAINT std_yields_unique_process UNIQUE (process_id, input_part, output_part, effective_from)
);

-- Indexes
CREATE INDEX idx_std_yields_process ON std_yields(process_id);
CREATE INDEX idx_std_yields_input ON std_yields(input_part);
CREATE INDEX idx_std_yields_output ON std_yields(output_part);
CREATE INDEX idx_std_yields_effective ON std_yields(effective_from, effective_to);

-- Insert canonical yield data from document
INSERT INTO std_yields (process_id, process_name, input_part, output_part, std_yield_pct, value_category, source, notes)
VALUES
  -- Live to Griller (Level 0 → Level 1)
  ('SLAUGHTER', 'Slachten & Uitsnijden', 'live_bird', 'griller', 70.50, 'MAIN_PRODUCT', 'JA757', 'Canonical yield from slaughter report'),
  ('SLAUGHTER', 'Slachten & Uitsnijden', 'live_bird', 'blood', 2.70, 'BY_PRODUCT', 'JA757', 'Blood for rendering'),
  ('SLAUGHTER', 'Slachten & Uitsnijden', 'live_bird', 'feathers', 4.70, 'BY_PRODUCT', 'JA757', 'Feathers for rendering'),
  ('SLAUGHTER', 'Slachten & Uitsnijden', 'live_bird', 'offal', 3.50, 'BY_PRODUCT', 'JA757', 'Hearts, livers, gizzards'),
  ('SLAUGHTER', 'Slachten & Uitsnijden', 'live_bird', 'cat3_waste', 18.60, 'BY_PRODUCT', 'JA757', 'Category III material'),

  -- Griller to Primal Cuts (Level 1 → Level 2)
  ('CUTUP', 'Uitsnijden Griller', 'griller', 'breast_cap', 35.85, 'MAIN_PRODUCT', 'JA757', 'Breast cap with tenderloin'),
  ('CUTUP', 'Uitsnijden Griller', 'griller', 'leg_quarter', 43.40, 'MAIN_PRODUCT', 'JA757', 'Whole leg quarter'),
  ('CUTUP', 'Uitsnijden Griller', 'griller', 'wings', 10.70, 'MAIN_PRODUCT', 'JA757', 'Wing with tip'),
  ('CUTUP', 'Uitsnijden Griller', 'griller', 'back_carcass', 7.60, 'MAIN_PRODUCT', 'JA757', 'Back and carcass'),
  ('CUTUP', 'Uitsnijden Griller', 'griller', 'offal', 2.45, 'BY_PRODUCT', 'JA757', 'Remaining offal'),

  -- Leg Quarter to Boneless (Level 2 → Level 3)
  ('DEBONE_LEG', 'Uitbenen Poot', 'leg_quarter', 'thigh_meat', 62.50, 'MAIN_PRODUCT', 'Canonical', 'Boneless thigh meat'),
  ('DEBONE_LEG', 'Uitbenen Poot', 'leg_quarter', 'drumstick', 0.00, 'MAIN_PRODUCT', 'Canonical', 'If separating (optional)'),
  ('DEBONE_LEG', 'Uitbenen Poot', 'leg_quarter', 'bone', 12.90, 'BY_PRODUCT', 'Canonical', 'Leg bones for rendering'),
  ('DEBONE_LEG', 'Uitbenen Poot', 'leg_quarter', 'skin', 12.20, 'BY_PRODUCT', 'Canonical', 'Leg skin'),
  ('DEBONE_LEG', 'Uitbenen Poot', 'leg_quarter', 'trim', 12.40, 'BY_PRODUCT', 'Canonical', 'Trim and fat'),

  -- Breast to Fillet (Level 2 → Level 3)
  ('DEBONE_BREAST', 'Uitbenen Filet', 'breast_cap', 'breast_fillet', 95.00, 'MAIN_PRODUCT', 'Canonical', 'Boneless breast fillet'),
  ('DEBONE_BREAST', 'Uitbenen Filet', 'breast_cap', 'inner_fillet', 0.00, 'MAIN_PRODUCT', 'Canonical', 'If separating (optional)'),
  ('DEBONE_BREAST', 'Uitbenen Filet', 'breast_cap', 'breast_trim', 5.00, 'BY_PRODUCT', 'Canonical', 'Breast trim')
ON CONFLICT DO NOTHING;

-- Comment for documentation
COMMENT ON TABLE std_yields IS
'Sprint 7: Standard yields for canonical cost calculation.
Contains normative yields for every process step.
Used for standard costing and variance analysis.
Source: Poultry Cost Accounting Formalization (Canonical Document)';

COMMENT ON COLUMN std_yields.value_category IS
'MAIN_PRODUCT = Joint product driving production (SVASO allocation).
BY_PRODUCT = Incidental output (NRV treatment).';


-- ============================================================
-- MIGRATION 113: 20260124100112_table_std_prices.sql
-- ============================================================

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
  std_market_price_eur NUMERIC(10,4) NOT NULL CHECK (std_market_price_eur >= 0),

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

-- Comment for documentation
COMMENT ON TABLE std_prices IS
'Sprint 7: Standard prices for SVASO allocation (Vierkantsverwaarding).
These are STANDARD market prices used as allocation keys, not actual invoice prices.
Ensures cost stability across batches while reflecting market value proportions.
Negative prices indicate disposal costs for certain by-products.
Source: Poultry Cost Accounting Formalization (Canonical Document)';

COMMENT ON COLUMN std_prices.std_market_price_eur IS
'Standard market price per kg. Used for SVASO allocation.
Can be negative for by-products with disposal costs.';


-- ============================================================
-- MIGRATION 114: 20260124100113_table_cost_drivers.sql
-- ============================================================

-- =============================================================================
-- Sprint 7: Cost Drivers Table (Canonical Cost Engine)
-- =============================================================================
-- Purpose: Operational costs for labor, energy, and overhead.
-- Supports both standard costing and future Activity-Based Costing (ABC).
--
-- Per canonical document Section 6.1:
-- "cost_drivers: Operational costs for labor, energy, and overhead."
-- =============================================================================

CREATE TABLE IF NOT EXISTS cost_drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Period identification
  period_id VARCHAR(20) NOT NULL, -- e.g., '2026-01', '2026-W04'

  -- Cost type and description
  cost_type VARCHAR(50) NOT NULL,
  cost_name VARCHAR(100) NOT NULL,

  -- Unit cost
  unit_cost_eur NUMERIC(10,4) NOT NULL,

  -- Allocation base (how cost is applied)
  allocation_base VARCHAR(20) NOT NULL DEFAULT 'per_kg'
    CHECK (allocation_base IN ('per_kg', 'per_head', 'per_hour', 'per_unit', 'fixed')),

  -- Cost category for reporting
  cost_category VARCHAR(30) NOT NULL DEFAULT 'PROCESSING'
    CHECK (cost_category IN ('SLAUGHTER', 'PROCESSING', 'PACKAGING', 'OVERHEAD', 'TRANSPORT', 'ENERGY')),

  -- Cost classification (joint vs separable)
  cost_classification VARCHAR(20) NOT NULL DEFAULT 'SEPARABLE'
    CHECK (cost_classification IN ('JOINT', 'SEPARABLE')),

  -- Applies to specific part/SKU (NULL = all)
  applies_to_part_code VARCHAR(50),
  applies_to_sku VARCHAR(50),

  -- Source and validity
  source VARCHAR(100) NOT NULL DEFAULT 'manual',
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,

  -- Notes
  notes TEXT,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT cost_drivers_effective_dates CHECK (effective_to IS NULL OR effective_to > effective_from)
);

-- Indexes
CREATE INDEX idx_cost_drivers_period ON cost_drivers(period_id);
CREATE INDEX idx_cost_drivers_type ON cost_drivers(cost_type);
CREATE INDEX idx_cost_drivers_category ON cost_drivers(cost_category);
CREATE INDEX idx_cost_drivers_effective ON cost_drivers(effective_from, effective_to);

-- Insert canonical cost driver data
INSERT INTO cost_drivers (period_id, cost_type, cost_name, unit_cost_eur, allocation_base, cost_category, cost_classification, source, notes)
VALUES
  -- Slaughter costs (JOINT - applied before split-off)
  ('2026-01', 'SLAUGHTER_LABOR', 'Slacht arbeid', 0.12, 'per_head', 'SLAUGHTER', 'JOINT', 'Canonical', 'Direct labor for slaughter'),
  ('2026-01', 'SLAUGHTER_OVERHEAD', 'Slacht overhead', 0.156, 'per_head', 'SLAUGHTER', 'JOINT', 'Canonical', 'Factory overhead slaughter'),
  ('2026-01', 'CATCHING_FEE', 'Vangkosten', 0.0764, 'per_head', 'SLAUGHTER', 'JOINT', 'Canonical', 'Catching crew'),
  ('2026-01', 'TRANSPORT_LIVE', 'Transport levend', 0.04, 'per_kg', 'TRANSPORT', 'JOINT', 'Canonical', 'Live bird transport'),

  -- Processing costs (SEPARABLE - applied after split-off)
  ('2026-01', 'DEBONE_LEG', 'Uitbenen poot', 0.68, 'per_kg', 'PROCESSING', 'SEPARABLE', 'Canonical', 'Labor cost per kg output'),
  ('2026-01', 'DEBONE_BREAST', 'Uitbenen filet', 0.30, 'per_kg', 'PROCESSING', 'SEPARABLE', 'Canonical', 'Labor cost per kg output'),
  ('2026-01', 'CUTTING', 'Snijwerk', 0.15, 'per_kg', 'PROCESSING', 'SEPARABLE', 'Canonical', 'General cutting labor'),
  ('2026-01', 'VACUUM', 'Vacumeren', 0.08, 'per_kg', 'PACKAGING', 'SEPARABLE', 'Canonical', 'Vacuum sealing'),

  -- Packaging costs (SEPARABLE)
  ('2026-01', 'TRAY_SMALL', 'Schaal klein', 0.05, 'per_unit', 'PACKAGING', 'SEPARABLE', 'Canonical', 'Small packaging tray'),
  ('2026-01', 'TRAY_LARGE', 'Schaal groot', 0.08, 'per_unit', 'PACKAGING', 'SEPARABLE', 'Canonical', 'Large packaging tray'),
  ('2026-01', 'FILM', 'Folie', 0.02, 'per_unit', 'PACKAGING', 'SEPARABLE', 'Canonical', 'Packaging film'),
  ('2026-01', 'LABEL', 'Etiket', 0.01, 'per_unit', 'PACKAGING', 'SEPARABLE', 'Canonical', 'Product label'),
  ('2026-01', 'BOX', 'Doos', 0.15, 'per_unit', 'PACKAGING', 'SEPARABLE', 'Canonical', 'Shipping box'),

  -- Overhead costs (SEPARABLE)
  ('2026-01', 'FACTORY_OVERHEAD', 'Fabriek overhead', 0.50, 'per_kg', 'OVERHEAD', 'SEPARABLE', 'Canonical', 'General factory overhead per kg'),
  ('2026-01', 'ENERGY', 'Energie toeslag', 0.05, 'per_kg', 'ENERGY', 'SEPARABLE', 'Canonical', 'Energy surcharge'),
  ('2026-01', 'TRANSPORT_FINISHED', 'Transport klaar', 0.03, 'per_kg', 'TRANSPORT', 'SEPARABLE', 'Canonical', 'Finished goods transport')
ON CONFLICT DO NOTHING;

-- Comment for documentation
COMMENT ON TABLE cost_drivers IS
'Sprint 7: Operational cost drivers for canonical cost calculation.
Supports standard costing with future ABC capability.
JOINT costs are allocated before split-off (live bird, slaughter).
SEPARABLE costs are applied after split-off (processing, packaging).
Source: Poultry Cost Accounting Formalization (Canonical Document)';

COMMENT ON COLUMN cost_drivers.cost_classification IS
'JOINT = Applied before split-off, allocated via SVASO.
SEPARABLE = Applied after split-off, traced directly to products.';


-- ============================================================
-- MIGRATION 115: 20260124100114_table_batch_valuation.sql
-- ============================================================

-- =============================================================================
-- Sprint 7: Batch Valuation Table (Canonical Cost Engine)
-- =============================================================================
-- Purpose: Store calculated Griller cost and k-factor per batch.
-- This is the core valuation record linking physical batch to financial value.
--
-- Per canonical document Section 6.1:
-- "batch_valuation: Stores the calculated Griller cost and k-factor per batch."
-- =============================================================================

CREATE TABLE IF NOT EXISTS batch_valuation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Batch reference
  batch_id UUID NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
  batch_ref TEXT NOT NULL,

  -- Level 0: Landed Cost
  input_live_kg NUMERIC(12,2) NOT NULL,
  input_count INTEGER NOT NULL,
  live_price_per_kg NUMERIC(10,4) NOT NULL,
  transport_cost_eur NUMERIC(10,2) NOT NULL DEFAULT 0,
  catching_fee_eur NUMERIC(10,2) NOT NULL DEFAULT 0,
  landed_cost_eur NUMERIC(12,2) NOT NULL,
  landed_cost_per_kg NUMERIC(10,4) NOT NULL,

  -- DOA handling
  doa_count INTEGER NOT NULL DEFAULT 0,
  usable_live_kg NUMERIC(12,2) NOT NULL,
  abnormal_doa_variance_eur NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- Level 1: Griller Cost
  slaughter_fee_eur NUMERIC(10,2) NOT NULL DEFAULT 0,
  by_product_credit_eur NUMERIC(10,2) NOT NULL DEFAULT 0,
  net_slaughter_cost_eur NUMERIC(12,2) NOT NULL,
  griller_weight_kg NUMERIC(12,2) NOT NULL,
  griller_yield_pct NUMERIC(5,2) NOT NULL,
  griller_cost_per_kg NUMERIC(10,4) NOT NULL,
  griller_cost_total_eur NUMERIC(12,2) NOT NULL,

  -- Level 2: SVASO Allocation
  total_market_value_eur NUMERIC(12,2),
  k_factor NUMERIC(10,6),
  k_factor_interpretation VARCHAR(20)
    CHECK (k_factor_interpretation IN ('PROFITABLE', 'BREAK_EVEN', 'LOSS')),

  -- Validation
  sum_allocation_factors NUMERIC(10,6),
  is_valid BOOLEAN NOT NULL DEFAULT TRUE,

  -- Calculation metadata
  price_period_id VARCHAR(20),
  calculation_version VARCHAR(20) NOT NULL DEFAULT '7.0',
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Audit trail (JSON for flexibility)
  audit_trail JSONB,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT batch_valuation_unique_batch UNIQUE (batch_id),
  CONSTRAINT batch_valuation_yield_range CHECK (griller_yield_pct >= 0 AND griller_yield_pct <= 100),
  CONSTRAINT batch_valuation_k_factor_positive CHECK (k_factor IS NULL OR k_factor >= 0)
);

-- Indexes
CREATE INDEX idx_batch_valuation_batch ON batch_valuation(batch_id);
CREATE INDEX idx_batch_valuation_calculated ON batch_valuation(calculated_at);
CREATE INDEX idx_batch_valuation_k_factor ON batch_valuation(k_factor);
CREATE INDEX idx_batch_valuation_valid ON batch_valuation(is_valid);

-- Comment for documentation
COMMENT ON TABLE batch_valuation IS
'Sprint 7: Canonical batch valuation records.
Stores complete cost calculation from Live (Level 0) through Griller (Level 1) to SVASO (Level 2).
k_factor is THE critical KPI: k < 1 = profitable, k > 1 = loss.
Source: Poultry Cost Accounting Formalization (Canonical Document)';

COMMENT ON COLUMN batch_valuation.k_factor IS
'k = Total_Batch_Cost / Total_Market_Value.
k < 1: Theoretically profitable (Market Value > Cost).
k = 1: Break-even.
k > 1: Theoretically loss-making (Cost > Market Value).';

COMMENT ON COLUMN batch_valuation.griller_cost_per_kg IS
'THE BASE for all subsequent calculations.
This is the cost multiplier effect of yield loss.
Example: €2.60/kg live becomes €3.69/kg griller at 70.5% yield.';


-- ============================================================
-- MIGRATION 116: 20260124100115_table_part_valuation.sql
-- ============================================================

-- =============================================================================
-- Sprint 7: Part Valuation Table (Canonical Cost Engine)
-- =============================================================================
-- Purpose: Store allocated cost for each primal part per batch.
-- This is the result of SVASO allocation (Level 2).
--
-- Per canonical document Section 6.1:
-- "part_valuation: Stores the allocated cost for each primal part per batch."
-- =============================================================================

CREATE TABLE IF NOT EXISTS part_valuation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Batch reference
  batch_id UUID NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
  batch_valuation_id UUID REFERENCES batch_valuation(id) ON DELETE CASCADE,

  -- Part identification
  part_code VARCHAR(50) NOT NULL,
  part_name VARCHAR(100),

  -- Physical data
  weight_kg NUMERIC(12,2) NOT NULL,

  -- Standard price for allocation
  std_market_price_per_kg NUMERIC(10,4) NOT NULL,

  -- Market value calculation
  market_value_eur NUMERIC(12,2) NOT NULL,

  -- SVASO Allocation
  allocation_factor NUMERIC(10,6) NOT NULL,
  allocated_cost_per_kg NUMERIC(10,4) NOT NULL,
  allocated_cost_total_eur NUMERIC(12,2) NOT NULL,

  -- Theoretical margin (at standard price)
  theoretical_margin_eur NUMERIC(12,2),
  theoretical_margin_pct NUMERIC(6,2),

  -- Cost level (for tracking through hierarchy)
  cost_level INTEGER NOT NULL DEFAULT 2
    CHECK (cost_level IN (2, 3, 4)), -- Primal=2, Secondary=3, SKU=4

  -- Validation
  is_main_product BOOLEAN NOT NULL DEFAULT TRUE,

  -- Calculation metadata
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT part_valuation_unique_batch_part UNIQUE (batch_id, part_code, cost_level),
  CONSTRAINT part_valuation_weight_positive CHECK (weight_kg > 0),
  CONSTRAINT part_valuation_factor_range CHECK (allocation_factor >= 0 AND allocation_factor <= 1)
);

-- Indexes
CREATE INDEX idx_part_valuation_batch ON part_valuation(batch_id);
CREATE INDEX idx_part_valuation_part ON part_valuation(part_code);
CREATE INDEX idx_part_valuation_level ON part_valuation(cost_level);
CREATE INDEX idx_part_valuation_calculated ON part_valuation(calculated_at);

-- Comment for documentation
COMMENT ON TABLE part_valuation IS
'Sprint 7: Part-level valuation from SVASO allocation.
Stores allocated cost for each primal part per batch.
Allocation uses Relative Sales Value at Split-off (SVASO).
Sum of allocation_factor for a batch should equal 1.0.
Source: Poultry Cost Accounting Formalization (Canonical Document)';

COMMENT ON COLUMN part_valuation.allocated_cost_per_kg IS
'Allocated cost = k_factor × std_market_price_per_kg.
This prevents low-value parts (backs) from carrying weight-based costs.';

COMMENT ON COLUMN part_valuation.theoretical_margin_eur IS
'Margin at standard price = market_value - allocated_cost.
For insight only, not for actual P&L (actual prices may differ).';


-- ============================================================
-- MIGRATION 117: 20260124100116_view_cost_waterfall.sql
-- ============================================================

-- =============================================================================
-- Sprint 7: Cost Waterfall View (Canonical Cost Engine)
-- =============================================================================
-- Purpose: Visualize the complete cost flow from Live to SKU.
--
-- Per canonical document Section 8:
-- "The dashboard must clearly show the Waterfall of costs:
--  Live Cost → Yield Loss → Processing Cost → Variance → Final SKU Cost"
-- =============================================================================

CREATE OR REPLACE VIEW v_cost_waterfall AS
SELECT
  bv.batch_id,
  bv.batch_ref,

  -- Level 0: Landed Cost
  bv.input_live_kg,
  bv.input_count,
  bv.live_price_per_kg,
  bv.landed_cost_eur AS level_0_landed_cost_eur,
  bv.landed_cost_per_kg AS level_0_cost_per_kg,

  -- Level 0 → Level 1 Transformation
  bv.slaughter_fee_eur,
  bv.by_product_credit_eur,
  bv.net_slaughter_cost_eur,

  -- Level 1: Griller Cost
  bv.griller_weight_kg,
  bv.griller_yield_pct,
  bv.griller_cost_per_kg AS level_1_cost_per_kg,
  bv.griller_cost_total_eur AS level_1_griller_cost_eur,

  -- Yield Loss (cost impact of material loss)
  ROUND((bv.usable_live_kg - bv.griller_weight_kg) * bv.live_price_per_kg, 2) AS level_1_yield_loss_eur,

  -- Level 2: SVASO Allocation
  bv.total_market_value_eur AS level_2_tmv_eur,
  bv.k_factor AS level_2_k_factor,
  bv.k_factor_interpretation,

  -- Primal allocations (aggregated)
  (
    SELECT COALESCE(SUM(pv.allocated_cost_total_eur), 0)
    FROM part_valuation pv
    WHERE pv.batch_id = bv.batch_id AND pv.cost_level = 2
  ) AS level_2_primal_cost_eur,

  -- Variances
  bv.abnormal_doa_variance_eur AS variance_doa_eur,

  -- Cost multiplier (live to griller)
  CASE
    WHEN bv.live_price_per_kg > 0
    THEN ROUND((bv.griller_cost_per_kg / bv.live_price_per_kg)::numeric, 2)
    ELSE NULL
  END AS live_to_griller_multiplier,

  -- Cost multiplier estimate (live to meat, ~2.2x per canonical)
  CASE
    WHEN bv.live_price_per_kg > 0
    THEN ROUND((bv.griller_cost_per_kg / bv.live_price_per_kg / 0.625)::numeric, 2)
    ELSE NULL
  END AS live_to_meat_multiplier_est,

  -- Validation
  bv.is_valid,
  bv.sum_allocation_factors,

  -- Metadata
  bv.calculation_version,
  bv.calculated_at,

  -- Data type label
  'COST_WATERFALL' AS data_type

FROM batch_valuation bv
WHERE bv.is_valid = TRUE
ORDER BY bv.calculated_at DESC;

-- Comment for documentation
COMMENT ON VIEW v_cost_waterfall IS
'Sprint 7: Cost waterfall showing flow from Live Batch to Primal Parts.
Visualizes cost transformation at each level:
- Level 0: Landed Cost (live birds at factory gate)
- Level 1: Griller Cost (after slaughter, yield loss applied)
- Level 2: SVASO Allocation (primal cuts valued by market proportion)
Includes k-factor for batch profitability assessment.
Source: Poultry Cost Accounting Formalization (Canonical Document)';


-- ============================================================
-- MIGRATION 118: 20260124100117_table_price_scenarios.sql
-- ============================================================

-- =============================================================================
-- Sprint 7: Price Scenarios Table (Canonical Cost Engine)
-- =============================================================================
-- Purpose: Store scenario price vectors for simulation.
-- Enables "what-if" analysis without changing actual accounting records.
--
-- Per canonical document Section 4.2:
-- "The system must allow for a Simulation Mode where the user can
--  adjust the StandardPrice vector in the allocation algorithm
--  without changing the actual accounting records."
-- =============================================================================

CREATE TABLE IF NOT EXISTS price_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Scenario identification
  scenario_id VARCHAR(50) NOT NULL,
  scenario_name VARCHAR(100) NOT NULL,
  scenario_description TEXT,

  -- Scenario type
  scenario_type VARCHAR(30) NOT NULL DEFAULT 'WHAT_IF'
    CHECK (scenario_type IN ('WHAT_IF', 'MARKET_STRESS', 'EXPORT_BAN', 'SEASONAL', 'CUSTOM')),

  -- Prices per part (JSONB for flexibility)
  price_vector JSONB NOT NULL DEFAULT '{}',

  -- Is this the base/current scenario?
  is_base BOOLEAN NOT NULL DEFAULT FALSE,

  -- Active status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Audit fields
  created_by VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT price_scenarios_unique_scenario UNIQUE (scenario_id)
);

-- Indexes
CREATE INDEX idx_price_scenarios_active ON price_scenarios(is_active);
CREATE INDEX idx_price_scenarios_type ON price_scenarios(scenario_type);

-- Insert canonical scenarios
INSERT INTO price_scenarios (scenario_id, scenario_name, scenario_description, scenario_type, price_vector, is_base)
VALUES
  (
    'BASE_2026_01',
    'Basis januari 2026',
    'Standaard marktprijzen januari 2026 voor SVASO allocatie.',
    'WHAT_IF',
    '{"breast_cap": 9.50, "leg_quarter": 5.50, "wings": 4.50, "back_carcass": 0.50}',
    TRUE
  ),
  (
    'WING_DROP_20',
    'Vleugels marktprijs -20%',
    'Scenario: Exportban naar belangrijke afzetmarkt. Vleugelprijs daalt 20%. Let op: dit verhoogt de kostenbasis van filet omdat filet een groter deel van de joint cost moet dragen.',
    'EXPORT_BAN',
    '{"breast_cap": 9.50, "leg_quarter": 5.50, "wings": 3.60, "back_carcass": 0.50}',
    FALSE
  ),
  (
    'BREAST_PREMIUM_10',
    'Filet marktprijs +10%',
    'Scenario: Premium vraag naar filet (bijv. seizoen BBQ). Let op: dit verlaagt de relatieve kostenbasis van poot/vleugel.',
    'SEASONAL',
    '{"breast_cap": 10.45, "leg_quarter": 5.50, "wings": 4.50, "back_carcass": 0.50}',
    FALSE
  ),
  (
    'LEG_DROP_15',
    'Poot marktprijs -15%',
    'Scenario: Overaanbod donker vlees of exportproblemen. Pootprijs daalt 15%.',
    'MARKET_STRESS',
    '{"breast_cap": 9.50, "leg_quarter": 4.68, "wings": 4.50, "back_carcass": 0.50}',
    FALSE
  ),
  (
    'ALL_DOWN_10',
    'Alle prijzen -10%',
    'Scenario: Marktbrede prijsdaling door overproductie. Alle prijzen -10%.',
    'MARKET_STRESS',
    '{"breast_cap": 8.55, "leg_quarter": 4.95, "wings": 4.05, "back_carcass": 0.45}',
    FALSE
  )
ON CONFLICT (scenario_id) DO NOTHING;

-- Comment for documentation
COMMENT ON TABLE price_scenarios IS
'Sprint 7: Price scenarios for SVASO allocation simulation.
Enables "what-if" analysis showing interdependencies between part prices.
Key insight: A drop in wing prices raises the cost base of breast meat.
These are simulations, NOT predictions or recommendations.
Source: Poultry Cost Accounting Formalization (Canonical Document)';

COMMENT ON COLUMN price_scenarios.price_vector IS
'JSONB containing prices per part_code.
Example: {"breast_cap": 9.50, "leg_quarter": 5.50, "wings": 4.50, "back_carcass": 0.50}
All prices in EUR per kg.';

