-- Planning Simulator: order_planning_scenarios table
-- Stores scenario inputs (bird count, weight, whole-bird pulls) and cascaded results.

CREATE TABLE order_planning_scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slaughter_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  planning_inputs JSONB NOT NULL,
  cascaded_result JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_planning_scenarios_slaughter ON order_planning_scenarios(slaughter_id);

ALTER TABLE order_planning_scenarios ENABLE ROW LEVEL SECURITY;

-- App runs without auth — allow anon full access (consistent with other order tables)
CREATE POLICY "anon_all_planning_scenarios" ON order_planning_scenarios
  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_all_planning_scenarios" ON order_planning_scenarios
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
