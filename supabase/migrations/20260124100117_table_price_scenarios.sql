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
