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
