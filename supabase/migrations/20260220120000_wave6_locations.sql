-- Wave 6: locations table
-- Multi-location model: Putten (primary) → Nijkerk (secondary)

CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  location_type TEXT NOT NULL
    CHECK (location_type IN ('primary', 'secondary')),
  processing_day_offset INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

-- RLS: consistent with Wave 4 pattern (authenticated=allow, anon=deny)
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_all_locations" ON locations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "deny_anon_locations" ON locations
  FOR ALL TO anon USING (false);
