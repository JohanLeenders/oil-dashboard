-- Wave 6 seed: location_yield_profiles for Putten
-- Run after 20260220130000 which creates the tables and Putten location.
-- Product IDs are hardcoded UUIDs (verified from remote products table).

INSERT INTO location_yield_profiles (location_id, product_id, yield_percentage, is_active)
VALUES
  -- Filet bulk (OH-FILET-BULK-001)
  ('LOC_PUTTEN', 'c056b8b2-d22e-4bb5-8c2b-a2e2cad2e979', 0.235000, true),
  -- Dijvlees bulk (OH-DIJ-BULK-001)
  ('LOC_PUTTEN', '8845b798-c71a-4b9d-8d05-c6eafc4ca1c7', 0.120000, true),
  -- Drumstick bulk (OH-DRUM-BULK-001)
  ('LOC_PUTTEN', '07a406e1-997c-461a-849b-ce64320d478f', 0.140000, true),
  -- Vleugel (OH-VLEUGEL-001)
  ('LOC_PUTTEN', 'bf627dee-b4de-4a54-9553-87caf3e0aeeb', 0.095000, true)
ON CONFLICT (location_id, product_id) DO NOTHING;
