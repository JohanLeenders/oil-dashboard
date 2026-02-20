-- Wave 6: location_yield_profiles table
-- Griller → primary parts yield at each location (stored as 0.0-1.0)

CREATE TABLE location_yield_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID REFERENCES locations(id),
  product_id UUID REFERENCES products(id),
  yield_percentage NUMERIC(7,6) NOT NULL,  -- stored as 0.0-1.0 (e.g. 0.235000 = 23.5%)
  is_active BOOLEAN DEFAULT true,
  UNIQUE (location_id, product_id)
);

-- RLS: consistent with Wave 4 pattern (authenticated=allow, anon=deny)
ALTER TABLE location_yield_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all_location_yield_profiles" ON location_yield_profiles
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "deny_anon_location_yield_profiles" ON location_yield_profiles
  FOR ALL TO anon USING (false);
