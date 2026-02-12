-- ============================================================================
-- OIL (Oranjehoen Intelligence Layer) - Initial Database Schema
-- Versie: 1.0.0
-- Datum: 2026-01-24
-- ============================================================================
-- DESIGN PRINCIPLES:
-- 1. APPEND-ONLY: Brondata wordt NOOIT overschreven. Correcties via adjustment records.
-- 2. SVASO: Kostprijsallocatie op basis van Sales Value at Split-off, NIET op gewicht.
-- 3. AUDIT TRAIL: Alle mutaties worden getrackt met timestamps.
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ENUM TYPES
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

-- Anatomische delen voor yield tracking (Niveau 2: Cut-Up)
CREATE TYPE anatomical_part AS ENUM (
  'breast_cap',      -- Borstkap (34.8% - 36.9% van griller)
  'leg_quarter',     -- Achterkwartier (42.0% - 44.8% van griller)
  'wings',           -- Vleugels (10.6% - 10.8% van griller)
  'back_carcass',    -- Rug/Karkas (7.0% - 8.2% van griller)
  'offal'            -- Organen (nekken, lever, maag, hart)
);

-- THT status voor voorraad (Blueprint Spec)
CREATE TYPE tht_status AS ENUM (
  'green',   -- < 70% verstreken
  'orange',  -- 70-90% verstreken
  'red'      -- > 90% verstreken
);

-- Batch status
CREATE TYPE batch_status AS ENUM (
  'planned',
  'slaughtered',
  'cut_up',
  'in_sales',
  'closed'
);

-- ============================================================================
-- TABLE: products (SKU Master Data)
-- Bevat de mapping uit Hoofdstuk 6: Storteboom PLU -> Interne Term
-- ============================================================================

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Identificatie
  sku_code VARCHAR(20) NOT NULL UNIQUE,           -- Interne SKU code
  storteboom_plu VARCHAR(20),                      -- Storteboom PLU/Artikelcode
  description VARCHAR(255) NOT NULL,               -- Omschrijving op factuur/pakbon
  internal_name VARCHAR(100) NOT NULL,             -- Interne term (Dashboard)

  -- Categorisatie
  category product_category NOT NULL,
  anatomical_part anatomical_part,                 -- Welk deel van de kip (NULL voor kosten/emballage)

  -- Yield/Ratio targets (percentage van griller gewicht)
  target_yield_min DECIMAL(5,2),                   -- Minimum yield %
  target_yield_max DECIMAL(5,2),                   -- Maximum yield %

  -- Voor SVASO allocatie
  is_saleable BOOLEAN DEFAULT true,                -- Wordt dit verkocht? (false voor kosten/emballage)
  default_market_price_per_kg DECIMAL(10,2),       -- Default marktprijs voor SVASO

  -- Verpakking
  packaging_type VARCHAR(50),                       -- Vacuüm, Bulk, Krat
  standard_weight_kg DECIMAL(8,3),                  -- Standaard gewicht per eenheid

  -- Metadata
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index voor snelle PLU lookups
CREATE INDEX idx_products_storteboom_plu ON products(storteboom_plu);
CREATE INDEX idx_products_category ON products(category);

-- ============================================================================
-- TABLE: production_batches
-- Slachtbatches - kern van de massabalans
-- ============================================================================

CREATE TABLE production_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Identificatie
  batch_ref VARCHAR(50) NOT NULL UNIQUE,           -- Lotnummer (bijv. P2520210)
  slaughter_date DATE NOT NULL,

  -- Input: Levend gewicht (100% basis)
  live_weight_kg DECIMAL(12,3) NOT NULL,           -- Totaal levend gewicht batch
  bird_count INTEGER NOT NULL,                      -- Aantal kippen
  avg_bird_weight_kg DECIMAL(6,3) GENERATED ALWAYS AS (live_weight_kg / NULLIF(bird_count, 0)) STORED,

  -- Output: Griller (Niveau 1 yield)
  griller_weight_kg DECIMAL(12,3),                 -- Gewicht na slacht (Cold Carcass)
  griller_yield_pct DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN live_weight_kg > 0
         THEN (griller_weight_kg / live_weight_kg) * 100
         ELSE NULL
    END
  ) STORED,

  -- Verliesstromen (Cat 2/3)
  rejection_kg DECIMAL(10,3) DEFAULT 0,            -- Afkeur & DOA
  slaughter_waste_kg DECIMAL(10,3) DEFAULT 0,      -- Slachtafval (bloed, veren, etc.)

  -- THT tracking
  production_date DATE,
  expiry_date DATE,                                 -- THT datum

  -- Status & kosten
  status batch_status DEFAULT 'planned',
  total_batch_cost DECIMAL(12,2),                  -- Totale kosten (voor SVASO verdeling)

  -- Forecasting
  forecast_griller_yield_pct DECIMAL(5,2) DEFAULT 70.70,  -- Planning target

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT chk_griller_yield CHECK (griller_yield_pct IS NULL OR griller_yield_pct BETWEEN 0 AND 100),
  CONSTRAINT chk_live_weight CHECK (live_weight_kg > 0),
  CONSTRAINT chk_bird_count CHECK (bird_count > 0)
);

CREATE INDEX idx_batches_slaughter_date ON production_batches(slaughter_date);
CREATE INDEX idx_batches_status ON production_batches(status);
CREATE INDEX idx_batches_expiry ON production_batches(expiry_date);

-- ============================================================================
-- TABLE: batch_yields (Niveau 2: Cut-Up yields per anatomisch deel)
-- APPEND-ONLY: Nieuwe metingen worden toegevoegd, niet overschreven
-- ============================================================================

CREATE TABLE batch_yields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  batch_id UUID NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
  anatomical_part anatomical_part NOT NULL,

  -- Gewichten
  actual_weight_kg DECIMAL(10,3) NOT NULL,

  -- Berekende yield (percentage van griller)
  yield_pct DECIMAL(5,2),                          -- Wordt berekend bij insert

  -- Vergelijking met target
  target_yield_min DECIMAL(5,2),
  target_yield_max DECIMAL(5,2),
  delta_from_target DECIMAL(5,2),                  -- Afwijking van midpoint target

  -- Metadata
  measurement_source VARCHAR(50),                   -- 'slaughter_report', 'manual', 'scale'
  measured_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,

  -- Append-only: voor correcties
  is_correction BOOLEAN DEFAULT false,
  corrects_yield_id UUID REFERENCES batch_yields(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(batch_id, anatomical_part, measured_at)    -- Meerdere metingen mogelijk per moment
);

CREATE INDEX idx_batch_yields_batch ON batch_yields(batch_id);
CREATE INDEX idx_batch_yields_part ON batch_yields(anatomical_part);

-- ============================================================================
-- TABLE: market_benchmarks
-- Marktprijzen per product voor SVASO berekening
-- APPEND-ONLY: Nieuwe prijzen worden toegevoegd met datum
-- ============================================================================

CREATE TABLE market_benchmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  product_id UUID NOT NULL REFERENCES products(id),

  -- Prijs informatie
  price_per_kg DECIMAL(10,2) NOT NULL,
  price_source VARCHAR(100),                        -- 'storteboom', 'market_avg', 'manual'

  -- Geldigheid
  valid_from DATE NOT NULL,
  valid_until DATE,                                 -- NULL = nog geldig

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(100),

  CONSTRAINT chk_price_positive CHECK (price_per_kg > 0)
);

CREATE INDEX idx_benchmarks_product ON market_benchmarks(product_id);
CREATE INDEX idx_benchmarks_valid ON market_benchmarks(valid_from, valid_until);

-- ============================================================================
-- TABLE: batch_costs
-- Kosten per batch - APPEND-ONLY met correctie mechanisme
-- ============================================================================

CREATE TABLE batch_costs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  batch_id UUID NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,

  -- Kostensoort
  cost_type VARCHAR(50) NOT NULL,                   -- 'slaughter', 'cutting', 'vacuum', 'transport', 'other'
  description VARCHAR(255),

  -- Bedragen
  amount DECIMAL(12,2) NOT NULL,
  per_unit VARCHAR(20),                             -- 'batch', 'kg', 'piece'
  quantity DECIMAL(10,3),                           -- Aantal eenheden (indien per_unit != 'batch')

  -- Bron
  invoice_ref VARCHAR(100),                         -- Factuurnummer Storteboom
  invoice_date DATE,

  -- Append-only correcties
  is_adjustment BOOLEAN DEFAULT false,
  adjusts_cost_id UUID REFERENCES batch_costs(id),
  adjustment_reason TEXT,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by VARCHAR(100)
);

CREATE INDEX idx_batch_costs_batch ON batch_costs(batch_id);
CREATE INDEX idx_batch_costs_type ON batch_costs(cost_type);

-- ============================================================================
-- TABLE: customers
-- Klantenmaster voor Cherry-Picker analyse
-- ============================================================================

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Identificatie
  customer_code VARCHAR(50) NOT NULL UNIQUE,        -- Exact Online debiteur code
  name VARCHAR(255) NOT NULL,

  -- Classificatie
  segment VARCHAR(50),                              -- 'retail', 'foodservice', 'wholesale'
  is_active BOOLEAN DEFAULT true,

  -- Cherry-picker metrics (cached, berekend door engine)
  total_revenue_ytd DECIMAL(14,2) DEFAULT 0,
  last_balance_score DECIMAL(5,2),                  -- 0-100 score
  last_score_calculated_at TIMESTAMPTZ,
  is_cherry_picker BOOLEAN DEFAULT false,           -- Alert flag

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_customers_code ON customers(customer_code);
CREATE INDEX idx_customers_cherry ON customers(is_cherry_picker) WHERE is_cherry_picker = true;

-- ============================================================================
-- TABLE: sales_transactions
-- Verkooptransacties - APPEND-ONLY
-- ============================================================================

CREATE TABLE sales_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Referenties
  customer_id UUID NOT NULL REFERENCES customers(id),
  product_id UUID NOT NULL REFERENCES products(id),
  batch_id UUID REFERENCES production_batches(id),   -- Kan NULL zijn (nog niet gekoppeld)

  -- Transactie details
  invoice_number VARCHAR(50) NOT NULL,
  invoice_date DATE NOT NULL,

  -- Hoeveelheden & prijzen
  quantity_kg DECIMAL(10,3) NOT NULL,
  quantity_pieces INTEGER,
  unit_price DECIMAL(10,2) NOT NULL,                 -- Prijs per kg
  line_total DECIMAL(12,2) GENERATED ALWAYS AS (quantity_kg * unit_price) STORED,

  -- SVASO allocatie (berekend door engine)
  allocated_cost DECIMAL(12,2),                      -- Toegewezen kostprijs
  gross_margin DECIMAL(12,2),                        -- Bruto marge (line_total - allocated_cost)
  margin_pct DECIMAL(5,2),                           -- Marge %

  -- Batch koppeling heuristiek (MVP)
  batch_ref_source VARCHAR(50),                      -- 'invoice', 'lot_code', 'heuristic', 'manual'

  -- Credit/correctie handling
  is_credit BOOLEAN DEFAULT false,
  credits_transaction_id UUID REFERENCES sales_transactions(id),
  credit_reason TEXT,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced_from VARCHAR(50),                           -- 'exact_online', 'manual'

  CONSTRAINT chk_quantity_positive CHECK (quantity_kg > 0)
);

CREATE INDEX idx_sales_customer ON sales_transactions(customer_id);
CREATE INDEX idx_sales_product ON sales_transactions(product_id);
CREATE INDEX idx_sales_batch ON sales_transactions(batch_id);
CREATE INDEX idx_sales_date ON sales_transactions(invoice_date);
CREATE INDEX idx_sales_invoice ON sales_transactions(invoice_number);

-- ============================================================================
-- TABLE: commercial_norms
-- Biologische ratio's per onderdeel (basis voor Cherry-Picker detectie)
-- ============================================================================

CREATE TABLE commercial_norms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  anatomical_part anatomical_part NOT NULL,
  product_category product_category NOT NULL,

  -- Biologische ratio (% van hele kip beschikbaar)
  anatomical_ratio_pct DECIMAL(5,2) NOT NULL,        -- Bijv. Filet = 22-24%

  -- Thresholds voor alerts
  cherry_picker_threshold_pct DECIMAL(5,2),          -- Alert als klant > dit % afneemt

  -- Geldigheid
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLE: computed_snapshots (Optional cache voor performance)
-- Caches berekende SVASO waarden - source of truth blijft append-only tables
-- ============================================================================

CREATE TABLE computed_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  batch_id UUID NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
  snapshot_type VARCHAR(50) NOT NULL,                -- 'svaso_allocation', 'yield_analysis', 'margin_calc'

  -- Snapshot data (JSONB voor flexibiliteit)
  computed_data JSONB NOT NULL,

  -- Validity
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  is_stale BOOLEAN DEFAULT false,                    -- Markeer als source data is gewijzigd

  -- Input hash voor invalidatie
  input_data_hash VARCHAR(64),                       -- SHA256 van input data

  UNIQUE(batch_id, snapshot_type)
);

CREATE INDEX idx_snapshots_batch ON computed_snapshots(batch_id);
CREATE INDEX idx_snapshots_stale ON computed_snapshots(is_stale) WHERE is_stale = true;

-- ============================================================================
-- TABLE: commercial_signals (Phase 2 - Signaling Layer)
-- Alerts en acties voor commercieel team
-- ============================================================================

CREATE TABLE commercial_signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Context
  signal_type VARCHAR(50) NOT NULL,                  -- 'cherry_picker', 'yield_alert', 'tht_warning', 'margin_drop'
  severity VARCHAR(20) NOT NULL,                     -- 'info', 'warning', 'critical'

  -- Referenties (één of meer)
  customer_id UUID REFERENCES customers(id),
  batch_id UUID REFERENCES production_batches(id),
  product_id UUID REFERENCES products(id),

  -- Signal details
  title VARCHAR(255) NOT NULL,
  description TEXT,
  metric_value DECIMAL(10,2),                        -- De waarde die het signaal triggerde
  threshold_value DECIMAL(10,2),                     -- De drempelwaarde

  -- Action tracking
  status VARCHAR(20) DEFAULT 'open',                 -- 'open', 'acknowledged', 'resolved', 'dismissed'
  assigned_to VARCHAR(100),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_signals_type ON commercial_signals(signal_type);
CREATE INDEX idx_signals_status ON commercial_signals(status);
CREATE INDEX idx_signals_customer ON commercial_signals(customer_id);
CREATE INDEX idx_signals_batch ON commercial_signals(batch_id);

-- ============================================================================
-- VIEWS voor Sankey Diagram Data (Massabalans)
-- ============================================================================

-- View: Massabalans per batch (voor Sankey diagram)
CREATE VIEW v_batch_mass_balance AS
SELECT
  b.id AS batch_id,
  b.batch_ref,
  b.slaughter_date,

  -- Niveau 1: Levend -> Griller
  b.live_weight_kg AS source_live_weight,
  b.rejection_kg AS loss_rejection,
  b.slaughter_waste_kg AS loss_slaughter,
  b.griller_weight_kg AS node_griller,

  -- Niveau 2: Griller -> Delen (aggregatie van yields)
  COALESCE(y.breast_cap_kg, 0) AS node_breast_cap,
  COALESCE(y.leg_quarter_kg, 0) AS node_leg_quarter,
  COALESCE(y.wings_kg, 0) AS node_wings,
  COALESCE(y.back_carcass_kg, 0) AS node_back_carcass,
  COALESCE(y.offal_kg, 0) AS node_offal,

  -- Unaccounted (verschil tussen griller en som delen)
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
    AND by2.is_correction = false  -- Alleen originele metingen
  GROUP BY by2.batch_id
) y ON true;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function: Bereken THT status
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

-- Function: Update timestamps trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update trigger to relevant tables
CREATE TRIGGER trg_products_updated
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_batches_updated
  BEFORE UPDATE ON production_batches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_customers_updated
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_signals_updated
  BEFORE UPDATE ON commercial_signals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - Prepared for multi-tenant if needed
-- ============================================================================

-- Enable RLS on sensitive tables (disabled by default for MVP)
-- ALTER TABLE sales_transactions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- COMMENTS for documentation
-- ============================================================================

COMMENT ON TABLE products IS 'SKU master met Storteboom PLU mapping (Hoofdstuk 6 TRD)';
COMMENT ON TABLE production_batches IS 'Slachtbatches - kern van massabalans (Append-only)';
COMMENT ON TABLE batch_yields IS 'Cut-up yields per anatomisch deel (Niveau 2, Append-only)';
COMMENT ON TABLE market_benchmarks IS 'Marktprijzen voor SVASO berekening (Append-only)';
COMMENT ON TABLE batch_costs IS 'Kosten per batch incl. nabelastingen (Append-only)';
COMMENT ON TABLE sales_transactions IS 'Verkooptransacties (Append-only met credit mechanisme)';
COMMENT ON TABLE customers IS 'Klanten met Cherry-Picker metrics';
COMMENT ON TABLE commercial_norms IS 'Biologische ratio thresholds voor balance score';
COMMENT ON TABLE computed_snapshots IS 'Cache voor berekende waarden (niet source of truth)';
COMMENT ON TABLE commercial_signals IS 'Alerts en acties voor commercieel team (Phase 2)';

COMMENT ON VIEW v_batch_mass_balance IS 'Sankey-ready view voor massabalans visualisatie';

COMMENT ON FUNCTION calc_tht_status IS 'Bereken THT kleur (green/orange/red) op basis van % verstreken';
