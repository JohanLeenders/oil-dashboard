-- Wave 6 Seed Script: Location & Cascade Engine Foundation
-- Source: docs/yield-data/ (Pre-Wave 6 deliverables)
--
-- Conflict strategy: DO NOTHING — canonical reference data.
-- If yields need to change, create a new migration.

-- ============================================================================
-- 1. New Products (from docs/yield-data/new_products.seed.json)
-- ============================================================================

INSERT INTO products (sku_code, storteboom_plu, description, internal_name, category, anatomical_part, target_yield_min, target_yield_max, is_saleable, default_market_price_per_kg, packaging_type, standard_weight_kg, notes)
VALUES
  ('OH-BORSTKAP-001', NULL, 'Borstkap (primair snijdeel)', 'Borstkap Putten', 'filet', 'breast_cap', NULL, NULL, true, 7.50, 'Bulk', NULL, 'Primair snijdeel van griller — bone-in borstkap. Kan verkocht worden op Putten of doorgestuurd naar Nijkerk voor fileren.'),
  ('OH-ZADEL-001', NULL, 'Zadel (primair snijdeel)', 'Zadel Putten', 'dij', 'leg_quarter', NULL, NULL, true, 5.00, 'Bulk', NULL, 'Primair snijdeel van griller — heel zadel (dij+drumstick, bone-in). Kan verkocht worden op Putten of doorgestuurd naar Nijkerk voor ontbenen.'),
  ('OH-FILET-HAAS-001', NULL, 'OH Filet half met haas', 'Filet Met Haas Nijkerk', 'filet', 'breast_cap', NULL, NULL, true, 10.50, 'Bulk 15kg', 15.00, 'Cascade-product Nijkerk — filet helft met haas (inner fillet), geproduceerd uit doorgestuurde borstkap.')
ON CONFLICT (sku_code) DO NOTHING;

-- ============================================================================
-- 2. Locations (from docs/yield-data/locations.seed.json)
-- ============================================================================

INSERT INTO locations (code, name, location_type, processing_day_offset, is_active)
VALUES
  ('putten', 'Putten', 'primary', 0, true),
  ('nijkerk', 'Nijkerk', 'secondary', 1, true)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 3. Location Yield Profiles (from docs/yield-data/location_yield_profiles.seed.json)
--    All values are 0.0-1.0 (fraction of griller weight)
--    Total saleable: 73.5% — remaining 26.5% is cutting loss
-- ============================================================================

INSERT INTO location_yield_profiles (location_id, product_id, yield_percentage)
SELECT l.id, p.id, v.yield_pct
FROM (VALUES
  ('putten', 'OH-BORSTKAP-001', 0.235),
  ('putten', 'OH-ZADEL-001',    0.280),
  ('putten', 'OH-VLEUGEL-001',  0.107),
  ('putten', 'OH-NAAKT-001',    0.075),
  ('putten', 'OH-LEVER-001',    0.018),
  ('putten', 'OH-MAAG-001',     0.010),
  ('putten', 'OH-HART-001',     0.005),
  ('putten', 'OH-HALS-001',     0.005)
) AS v(loc_code, sku, yield_pct)
JOIN locations l ON l.code = v.loc_code
JOIN products p ON p.sku_code = v.sku
ON CONFLICT (location_id, product_id) DO NOTHING;

-- ============================================================================
-- 4. Product Yield Chains (from docs/yield-data/product_yield_chains.seed.json)
--    Cascade: parent at Putten → child products at Nijkerk
--    All yield_pct values are 0.0-1.0 (fraction of forwarded parent kg)
-- ============================================================================

INSERT INTO product_yield_chains (parent_product_id, child_product_id, source_location_id, target_location_id, yield_pct, sort_order)
SELECT
  pp.id AS parent_product_id,
  cp.id AS child_product_id,
  sl.id AS source_location_id,
  tl.id AS target_location_id,
  v.yield_pct,
  v.sort_order
FROM (VALUES
  -- Borstkap → Nijkerk fileren (sum = 0.85, loss = 0.15)
  ('OH-BORSTKAP-001', 'OH-FILET-HAAS-001', 'putten', 'nijkerk', 0.420, 1),
  ('OH-BORSTKAP-001', 'OH-FILET-HALF-001', 'putten', 'nijkerk', 0.350, 2),
  ('OH-BORSTKAP-001', 'OH-HAAS-VAC-001',   'putten', 'nijkerk', 0.080, 3),
  -- Zadel → Nijkerk ontbenen (sum = 0.85, loss = 0.15)
  ('OH-ZADEL-001', 'OH-DIJ-VAC-001',  'putten', 'nijkerk', 0.350, 1),
  ('OH-ZADEL-001', 'OH-DRUM-001',     'putten', 'nijkerk', 0.300, 2),
  ('OH-ZADEL-001', 'OH-DRUMVL-001',   'putten', 'nijkerk', 0.200, 3)
) AS v(parent_sku, child_sku, source_loc, target_loc, yield_pct, sort_order)
JOIN products pp ON pp.sku_code = v.parent_sku
JOIN products cp ON cp.sku_code = v.child_sku
JOIN locations sl ON sl.code = v.source_loc
JOIN locations tl ON tl.code = v.target_loc
ON CONFLICT (parent_product_id, child_product_id) DO NOTHING;
