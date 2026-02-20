-- Wave 6: product_yield_chains table
-- Cascade chains: parent product → child products (Putten → Nijkerk processing)
-- yield_pct stored as 0.0-1.0 (fraction of forwarded parent kg)

CREATE TABLE product_yield_chains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_product_id UUID REFERENCES products(id),
  child_product_id UUID REFERENCES products(id),
  source_location_id UUID REFERENCES locations(id),
  target_location_id UUID REFERENCES locations(id),
  yield_pct NUMERIC(7,6) NOT NULL,  -- stored as 0.0-1.0 (e.g. 0.420000 = 42%)
  sort_order INT DEFAULT 0,
  UNIQUE (parent_product_id, child_product_id)
);

-- RLS: consistent with Wave 4 pattern (authenticated=allow, anon=deny)
ALTER TABLE product_yield_chains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all_product_yield_chains" ON product_yield_chains
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "deny_anon_product_yield_chains" ON product_yield_chains
  FOR ALL TO anon USING (false);
