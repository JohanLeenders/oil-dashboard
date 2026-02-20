-- Wave 6 fix: existing locations table has wrong schema (no code/processing_day_offset columns)
-- and location_yield_profiles / product_yield_chains tables were never created.
--
-- Root cause: Wave 6 migrations (20260220120000-120002) were marked as applied in supabase_migrations
-- but never actually ran because the locations table already existed with a different schema
-- (it was used for delivery/customer locations, not slaughter-facility locations).
--
-- Strategy:
--   1. Add missing columns to the existing locations table (non-destructive, preserves existing rows)
--   2. Create location_yield_profiles and product_yield_chains (they don't exist)
--   3. Insert Putten + Nijkerk slaughter facility rows
--   4. Insert yield profiles for Putten (primary parts, Putten slaughter)
--   No yield chains yet — to be seeded when Nijkerk cascade is configured.

-- ─── 1. Patch locations table: add missing Wave 6 columns ────────────────────
ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS code TEXT,
  ADD COLUMN IF NOT EXISTS processing_day_offset INT DEFAULT 0;

-- Add unique constraint on code (only if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'locations_code_key' AND conrelid = 'locations'::regclass
  ) THEN
    ALTER TABLE locations ADD CONSTRAINT locations_code_key UNIQUE (code);
  END IF;
END $$;

-- The existing location_type column is TEXT without a constraint (or has a different one).
-- We do NOT touch it to preserve existing data.
-- The Wave 6 code queries .eq('code', 'putten') so as long as code is set, it works.


-- ─── 2. Create location_yield_profiles ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS location_yield_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id TEXT REFERENCES locations(id),
  product_id UUID REFERENCES products(id),
  yield_percentage NUMERIC(7,6) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  UNIQUE (location_id, product_id)
);

ALTER TABLE location_yield_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'location_yield_profiles'
      AND policyname = 'authenticated_all_location_yield_profiles'
  ) THEN
    CREATE POLICY "authenticated_all_location_yield_profiles" ON location_yield_profiles
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'location_yield_profiles'
      AND policyname = 'deny_anon_location_yield_profiles'
  ) THEN
    CREATE POLICY "deny_anon_location_yield_profiles" ON location_yield_profiles
      FOR ALL TO anon USING (false);
  END IF;
END $$;


-- ─── 3. Create product_yield_chains ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_yield_chains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_product_id UUID REFERENCES products(id),
  child_product_id UUID REFERENCES products(id),
  source_location_id TEXT REFERENCES locations(id),
  target_location_id TEXT REFERENCES locations(id),
  yield_pct NUMERIC(7,6) NOT NULL,
  sort_order INT DEFAULT 0,
  UNIQUE (parent_product_id, child_product_id)
);

ALTER TABLE product_yield_chains ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'product_yield_chains'
      AND policyname = 'authenticated_all_product_yield_chains'
  ) THEN
    CREATE POLICY "authenticated_all_product_yield_chains" ON product_yield_chains
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'product_yield_chains'
      AND policyname = 'deny_anon_product_yield_chains'
  ) THEN
    CREATE POLICY "deny_anon_product_yield_chains" ON product_yield_chains
      FOR ALL TO anon USING (false);
  END IF;
END $$;


-- ─── 4. Seed Putten and Nijkerk slaughter locations ──────────────────────────
-- Insert with ON CONFLICT on code so re-running is safe
-- location_type has a check constraint in the old table (allows WAREHOUSE or NULL).
-- We use NULL here and rely on the code column to identify slaughter locations.
INSERT INTO locations (id, code, name, location_type, processing_day_offset, is_active)
VALUES
  ('LOC_PUTTEN',  'putten',  'Putten (primair)',    NULL, 0, true),
  ('LOC_NIJKERK', 'nijkerk', 'Nijkerk (secundair)', NULL, 1, true)
ON CONFLICT (code) DO NOTHING;


-- ─── 5. Seed location yield profiles (Putten primary parts) ──────────────────
-- Yield percentages = fraction of griller kg that becomes each primary part at Putten.
-- Based on Oranjehoen production norms; these are the "Putten uitsnijding" yields.
--
-- Primary parts at Putten:
--   OH-FILET-BULK-001  Kipfilet bulk         ~23.5% of griller
--   OH-DIJ-BULK-001    Dijvlees bulk         ~12.0%
--   OH-DRUM-BULK-001   Drumstick bulk        ~14.0%
--   OH-VLEUGEL-001     Vleugel               ~9.5%
--   OH-HELE-001        Hele kip              ~100% (passthrough, when ordered whole)
--
-- Note: these are initial estimates. Update via Supabase dashboard when actuals are known.

DO $$
DECLARE
  v_putten_id TEXT;
BEGIN
  SELECT id INTO v_putten_id FROM locations WHERE code = 'putten';

  IF v_putten_id IS NULL THEN
    RAISE EXCEPTION 'Putten location not found after insert — aborting seed';
  END IF;

  -- Filet bulk
  INSERT INTO location_yield_profiles (location_id, product_id, yield_percentage, is_active)
  SELECT v_putten_id, p.id, 0.235000, true
  FROM products p WHERE p.sku_code = 'OH-FILET-BULK-001'
  ON CONFLICT (location_id, product_id) DO NOTHING;

  -- Dijvlees bulk
  INSERT INTO location_yield_profiles (location_id, product_id, yield_percentage, is_active)
  SELECT v_putten_id, p.id, 0.120000, true
  FROM products p WHERE p.sku_code = 'OH-DIJ-BULK-001'
  ON CONFLICT (location_id, product_id) DO NOTHING;

  -- Drumstick bulk
  INSERT INTO location_yield_profiles (location_id, product_id, yield_percentage, is_active)
  SELECT v_putten_id, p.id, 0.140000, true
  FROM products p WHERE p.sku_code = 'OH-DRUM-BULK-001'
  ON CONFLICT (location_id, product_id) DO NOTHING;

  -- Vleugel
  INSERT INTO location_yield_profiles (location_id, product_id, yield_percentage, is_active)
  SELECT v_putten_id, p.id, 0.095000, true
  FROM products p WHERE p.sku_code = 'OH-VLEUGEL-001'
  ON CONFLICT (location_id, product_id) DO NOTHING;

END $$;
