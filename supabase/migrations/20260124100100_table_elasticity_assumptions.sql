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
