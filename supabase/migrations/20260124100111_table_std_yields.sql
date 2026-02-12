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
