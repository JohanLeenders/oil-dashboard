-- Wave 6 fix: anon read policies for location_yield_profiles and product_yield_chains
-- The app has no auth yet — all requests run as anon role.
-- The deny_anon policies from the Wave 6 migration block all access.

-- Drop deny policies
DROP POLICY IF EXISTS "deny_anon_location_yield_profiles" ON location_yield_profiles;
DROP POLICY IF EXISTS "deny_anon_product_yield_chains" ON product_yield_chains;

-- Allow anon SELECT (read-only)
CREATE POLICY "anon_read_location_yield_profiles" ON location_yield_profiles
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_product_yield_chains" ON product_yield_chains
  FOR SELECT TO anon USING (true);
