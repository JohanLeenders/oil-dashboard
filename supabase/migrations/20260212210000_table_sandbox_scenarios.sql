-- =============================================================================
-- Sprint 11A: Sandbox Scenarios Table
-- =============================================================================
-- Purpose: Store saved scenario simulations for what-if analysis.
-- Enables users to save, name, and compare multiple scenario runs per batch.
--
-- A scenario represents a complete what-if analysis with:
-- - Input overrides (live price, yields, shadow prices)
-- - Computed waterfall results (L0-L7)
-- - Delta calculations (baseline vs scenario)
-- =============================================================================

CREATE TABLE IF NOT EXISTS sandbox_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to production batch
  batch_id UUID NOT NULL,

  -- Scenario identification
  name VARCHAR(200) NOT NULL,
  description TEXT,

  -- Scenario inputs (ScenarioInput as JSON)
  -- Contains: scenario_id, scenario_name, live_price_per_kg, yield_overrides, price_overrides
  inputs_json JSONB NOT NULL,

  -- Scenario results (ScenarioResult as JSON)
  -- Contains: success, error, baseline, scenario, deltas, meta
  result_json JSONB,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Foreign key constraint
  CONSTRAINT fk_sandbox_scenarios_batch
    FOREIGN KEY (batch_id)
    REFERENCES production_batches(id)
    ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_sandbox_scenarios_batch_id ON sandbox_scenarios(batch_id);
CREATE INDEX idx_sandbox_scenarios_created_at ON sandbox_scenarios(created_at DESC);

-- Comments for documentation
COMMENT ON TABLE sandbox_scenarios IS 'Saved scenario simulations for what-if analysis (Sprint 11A)';
COMMENT ON COLUMN sandbox_scenarios.batch_id IS 'Foreign key to production_batches table';
COMMENT ON COLUMN sandbox_scenarios.name IS 'User-friendly scenario name';
COMMENT ON COLUMN sandbox_scenarios.inputs_json IS 'ScenarioInput JSON object (overrides for live price, yields, shadow prices)';
COMMENT ON COLUMN sandbox_scenarios.result_json IS 'ScenarioResult JSON object (waterfall results, deltas, metadata)';
