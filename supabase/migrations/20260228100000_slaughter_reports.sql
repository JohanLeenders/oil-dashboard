-- ============================================================================
-- Wave 13: Slaughter Reports — Technical Yield Tracking
-- ============================================================================
-- Purpose: Store technical slaughter yields (Stage A: live → griller → cut-up)
--          and weight distribution histograms per flock.
--
-- Design: Extensible for future report types:
--   - 'slacht_putten'   (current: live → griller → verwerking)
--   - 'fileer_putten'   (future: breast cap → filet yields)
--   - 'fileer_corvoet'  (future: external processor yields)
--
-- Key dimension: mester (farmer) — trends tracked per mester.
-- ============================================================================

-- 1. slaughter_reports — One row per slaughter day / report
-- Contains header info + key summary metrics for trending
CREATE TABLE IF NOT EXISTS slaughter_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  lot_number TEXT NOT NULL,
  report_type TEXT NOT NULL DEFAULT 'slacht_putten',

  -- Mester/Farm — PRIMARY trend dimension
  mester TEXT NOT NULL,
  breed TEXT,
  barn TEXT,              -- hok

  -- Slaughter date
  slaughter_date DATE NOT NULL,

  -- Input (Aanvoer)
  live_count INTEGER,
  live_weight_kg NUMERIC(10,1),
  avg_live_weight_kg NUMERIC(6,3),
  doa_count INTEGER DEFAULT 0,
  doa_weight_kg NUMERIC(10,1) DEFAULT 0,

  -- Rejection (Cat2 — Afkeur)
  rejected_count INTEGER DEFAULT 0,
  rejected_weight_kg NUMERIC(10,1) DEFAULT 0,
  cat2_pct NUMERIC(5,2),

  -- By-products total (Cat3)
  cat3_pct NUMERIC(5,2),

  -- Key output yields
  total_yield_pct NUMERIC(5,2),
  griller_count INTEGER,
  griller_weight_kg NUMERIC(10,1),
  griller_avg_weight_kg NUMERIC(6,3),
  griller_yield_pct NUMERIC(5,2),

  -- Routing (how grillers were distributed)
  saw_count INTEGER DEFAULT 0,       -- zaag kuikens
  pack_count INTEGER DEFAULT 0,      -- kuikens inpakken (heel)
  cutup_count INTEGER DEFAULT 0,     -- kuikens delen

  -- Metadata
  source_file TEXT,
  notes TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(lot_number, slaughter_date, report_type)
);

COMMENT ON TABLE slaughter_reports IS 'Technical slaughter yield reports. One row per slaughter day. Extensible via report_type for future processing stages.';
COMMENT ON COLUMN slaughter_reports.report_type IS 'Report type: slacht_putten (current), fileer_putten, fileer_corvoet (future)';
COMMENT ON COLUMN slaughter_reports.mester IS 'Farmer/grower name — primary dimension for trend analysis';
COMMENT ON COLUMN slaughter_reports.total_yield_pct IS 'Overall slaughter yield % (typically 90-97%)';
COMMENT ON COLUMN slaughter_reports.griller_yield_pct IS 'Griller yield % of live weight (typically 70-76%)';
COMMENT ON COLUMN slaughter_reports.cat2_pct IS 'Rejection rate % (Cat2: condemned + contaminated)';
COMMENT ON COLUMN slaughter_reports.cat3_pct IS 'By-product total % (Cat3: blood, feathers, heads, feet, innards)';

-- 2. slaughter_report_lines — Detailed yield lines per report
-- Generic: stores cat3 breakdown, organ yields, and cut-up yields
-- Future report types add new lines with their own section/product_code values
CREATE TABLE IF NOT EXISTS slaughter_report_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES slaughter_reports(id) ON DELETE CASCADE,

  -- Classification
  section TEXT NOT NULL,         -- 'cat3', 'organen', 'verwerking' (extensible)
  product_code TEXT NOT NULL,    -- 'bloed', 'veren', 'bouten', 'borsten', etc.
  product_label TEXT NOT NULL,   -- Dutch display name

  -- Metrics (all nullable — not every line has all fields)
  item_count INTEGER,
  weight_kg NUMERIC(10,1),
  avg_weight_kg NUMERIC(6,3),
  yield_pct NUMERIC(5,2),

  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(report_id, section, product_code)
);

COMMENT ON TABLE slaughter_report_lines IS 'Detailed yield lines per slaughter report. Sections: cat3 (by-products), organen (offal), verwerking (cut-up). Extensible for future report types.';
COMMENT ON COLUMN slaughter_report_lines.section IS 'Grouping: cat3, organen, verwerking — extensible for new report types';
COMMENT ON COLUMN slaughter_report_lines.product_code IS 'Machine-readable code: bloed, veren, bouten, borsten, vleugels, etc.';
COMMENT ON COLUMN slaughter_report_lines.yield_pct IS 'Yield percentage relative to griller weight (for verwerking) or live weight (for cat3)';

-- 3. weight_distributions — Per-flock weight histogram (from PDF scans)
CREATE TABLE IF NOT EXISTS weight_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES slaughter_reports(id) ON DELETE CASCADE,

  flock_number INTEGER NOT NULL,    -- koppel nummer
  flock_location TEXT,              -- e.g. 'Groenstege 2', 'Groenstege 3'
  rapport_number TEXT,              -- Storteboom rapport nummer
  weigher_number INTEGER NOT NULL,  -- weger nummer (1, 2)
  measured_at TIMESTAMPTZ,          -- timestamp from PDF header

  total_count INTEGER,
  -- Histogram bins: [{lower_g, upper_g, count, pct}]
  bins JSONB NOT NULL DEFAULT '[]',

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(report_id, flock_number, weigher_number)
);

COMMENT ON TABLE weight_distributions IS 'Weight distribution histograms per flock from Storteboom quality reports (PDF scans). Bins in 50g steps.';
COMMENT ON COLUMN weight_distributions.bins IS 'JSON array: [{lower_g: 850, upper_g: 899, count: 1, pct: 0.0}, ...]';

-- ============================================================================
-- Indexes
-- ============================================================================

-- Trending queries: filter by mester + report_type, order by date
CREATE INDEX idx_slaughter_reports_mester_date
  ON slaughter_reports (mester, slaughter_date DESC);

CREATE INDEX idx_slaughter_reports_type_date
  ON slaughter_reports (report_type, slaughter_date DESC);

-- Lines: lookup by report
CREATE INDEX idx_slaughter_report_lines_report
  ON slaughter_report_lines (report_id);

-- Weight distributions: lookup by report
CREATE INDEX idx_weight_distributions_report
  ON weight_distributions (report_id);

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE slaughter_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE slaughter_report_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE weight_distributions ENABLE ROW LEVEL SECURITY;

-- Authenticated users: full access (internal dashboard)
CREATE POLICY "authenticated_read_slaughter_reports"
  ON slaughter_reports FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "authenticated_insert_slaughter_reports"
  ON slaughter_reports FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "authenticated_update_slaughter_reports"
  ON slaughter_reports FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "authenticated_read_slaughter_report_lines"
  ON slaughter_report_lines FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "authenticated_insert_slaughter_report_lines"
  ON slaughter_report_lines FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "authenticated_read_weight_distributions"
  ON weight_distributions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "authenticated_insert_weight_distributions"
  ON weight_distributions FOR INSERT TO authenticated
  WITH CHECK (true);

-- Anon: read-only (for potential public dashboards)
CREATE POLICY "anon_read_slaughter_reports"
  ON slaughter_reports FOR SELECT TO anon
  USING (true);

CREATE POLICY "anon_read_slaughter_report_lines"
  ON slaughter_report_lines FOR SELECT TO anon
  USING (true);

CREATE POLICY "anon_read_weight_distributions"
  ON weight_distributions FOR SELECT TO anon
  USING (true);

-- Service role: full access (API routes, background jobs)
CREATE POLICY "service_role_all_slaughter_reports"
  ON slaughter_reports FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_slaughter_report_lines"
  ON slaughter_report_lines FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_weight_distributions"
  ON weight_distributions FOR ALL TO service_role
  USING (true) WITH CHECK (true);
