-- Wave 6: Fix product descriptions and yield profiles
-- Based on actual Storteboom bestelschema rendementen (blad 1)
--
-- Changes:
--   1. Trim product descriptions (remove BLK1STER/Oranje Hoen prefix noise)
--   2. Replace Putten yield profiles with correct products + rendement %
--   3. Add Nijkerk products as yield chains from Kappen and Zadels

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. TRIM PRODUCT DESCRIPTIONS
-- ═══════════════════════════════════════════════════════════════════════════
-- Remove "BLK1STER Oranje Hoen Kip " prefix
UPDATE products SET description = REPLACE(description, 'BLK1STER Oranje Hoen Kip ', '')
WHERE description LIKE 'BLK1STER Oranje Hoen Kip %';

-- Remove "BLK1Ster OH " prefix
UPDATE products SET description = REPLACE(description, 'BLK1Ster OH ', '')
WHERE description LIKE 'BLK1Ster OH %';

-- Remove "BLK1STER OH " prefix (uppercase variant)
UPDATE products SET description = REPLACE(description, 'BLK1STER OH ', '')
WHERE description LIKE 'BLK1STER OH %';

-- Remove "BLK1STER Oranje Hoen " prefix (without "Kip")
UPDATE products SET description = REPLACE(description, 'BLK1STER Oranje Hoen ', '')
WHERE description LIKE 'BLK1STER Oranje Hoen %';

-- Remove "Oranje Hoen " prefix
UPDATE products SET description = REPLACE(description, 'Oranje Hoen ', '')
WHERE description LIKE 'Oranje Hoen %';

-- Remove "BLK1Ster " prefix (remaining)
UPDATE products SET description = REPLACE(description, 'BLK1Ster ', '')
WHERE description LIKE 'BLK1Ster %';

-- Rename "Oranjehoen Hele Kip JH 1ST" → "Hele Kip"
UPDATE products SET description = 'Hele Kip' WHERE sku_code = 'OH-HELE-001';


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. FIX PUTTEN YIELD PROFILES
-- ═══════════════════════════════════════════════════════════════════════════
-- The current profiles are wrong (had filet instead of kappen/zadels).
-- Putten primary parts from the bestelschema:
--
--   Borstkappen met vel  36.75%  (→ goes to Nijkerk if not sold at Putten)
--   Dij anatomisch       14.68%  (= "zadels" → goes to Nijkerk if not sold)
--   Drumsticks 10kg      16.56%
--   Vleugels             9.57%
--   Nekken               1.97%
--   Levertjes            1.74%
--   Maagjes              1.07%
--   Hartjes              0.19%

-- Delete all existing Putten profiles (they were wrong)
DELETE FROM location_yield_profiles WHERE location_id = 'LOC_PUTTEN';

-- Insert correct Putten yield profiles
-- Borstkappen met vel (OH-BORST-KAL-001) — 36.75%
INSERT INTO location_yield_profiles (location_id, product_id, yield_percentage, is_active)
SELECT 'LOC_PUTTEN', id, 0.367500, true FROM products WHERE sku_code = 'OH-BORST-KAL-001'
ON CONFLICT (location_id, product_id) DO UPDATE SET yield_percentage = 0.367500;

-- Dij anatomisch (OH-DIJANA-001) — 14.68%
INSERT INTO location_yield_profiles (location_id, product_id, yield_percentage, is_active)
SELECT 'LOC_PUTTEN', id, 0.146828, true FROM products WHERE sku_code = 'OH-DIJANA-001'
ON CONFLICT (location_id, product_id) DO UPDATE SET yield_percentage = 0.146828;

-- Drumsticks 10kg (OH-DRUM-BULK-001) — 16.56%
INSERT INTO location_yield_profiles (location_id, product_id, yield_percentage, is_active)
SELECT 'LOC_PUTTEN', id, 0.165572, true FROM products WHERE sku_code = 'OH-DRUM-BULK-001'
ON CONFLICT (location_id, product_id) DO UPDATE SET yield_percentage = 0.165572;

-- Vleugels z tip (OH-VLEUGEL-001) — 9.57%
INSERT INTO location_yield_profiles (location_id, product_id, yield_percentage, is_active)
SELECT 'LOC_PUTTEN', id, 0.095700, true FROM products WHERE sku_code = 'OH-VLEUGEL-001'
ON CONFLICT (location_id, product_id) DO UPDATE SET yield_percentage = 0.095700;

-- Nekken (OH-HALS-001) — 1.97%
INSERT INTO location_yield_profiles (location_id, product_id, yield_percentage, is_active)
SELECT 'LOC_PUTTEN', id, 0.019700, true FROM products WHERE sku_code = 'OH-HALS-001'
ON CONFLICT (location_id, product_id) DO UPDATE SET yield_percentage = 0.019700;

-- Levertjes (OH-LEVER-001) — 1.74%
INSERT INTO location_yield_profiles (location_id, product_id, yield_percentage, is_active)
SELECT 'LOC_PUTTEN', id, 0.017400, true FROM products WHERE sku_code = 'OH-LEVER-001'
ON CONFLICT (location_id, product_id) DO UPDATE SET yield_percentage = 0.017400;

-- Maagjes (OH-MAAG-001) — 1.07%
INSERT INTO location_yield_profiles (location_id, product_id, yield_percentage, is_active)
SELECT 'LOC_PUTTEN', id, 0.010700, true FROM products WHERE sku_code = 'OH-MAAG-001'
ON CONFLICT (location_id, product_id) DO UPDATE SET yield_percentage = 0.010700;

-- Hartjes (OH-HART-001) — 0.19%
INSERT INTO location_yield_profiles (location_id, product_id, yield_percentage, is_active)
SELECT 'LOC_PUTTEN', id, 0.001900, true FROM products WHERE sku_code = 'OH-HART-001'
ON CONFLICT (location_id, product_id) DO UPDATE SET yield_percentage = 0.001900;

-- Hele kip (OH-HELE-001) — these get pulled BEFORE the griller is split into parts
-- Yield = 100% of griller weight (passthrough, whole bird)
INSERT INTO location_yield_profiles (location_id, product_id, yield_percentage, is_active)
SELECT 'LOC_PUTTEN', id, 1.000000, false FROM products WHERE sku_code = 'OH-HELE-001'
ON CONFLICT (location_id, product_id) DO UPDATE SET yield_percentage = 1.000000, is_active = false;

-- Naakt (OH-NAAKT-001) — whole bird without organs, passthrough
INSERT INTO location_yield_profiles (location_id, product_id, yield_percentage, is_active)
SELECT 'LOC_PUTTEN', id, 1.000000, false FROM products WHERE sku_code = 'OH-NAAKT-001'
ON CONFLICT (location_id, product_id) DO UPDATE SET yield_percentage = 1.000000, is_active = false;


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. NIJKERK YIELD CHAINS (from Kappen and Zadels)
-- ═══════════════════════════════════════════════════════════════════════════
-- When Kappen (borstkappen) are NOT sold at Putten, they go to Nijkerk
-- and become these secondary products:
--
-- FROM KAPPEN (OH-BORST-KAL-001):
--   Filet z vel z haas (OH-FILET-BULK-001)   — 24.42% of griller = 66.45% of kap
--   Filet z vel m haas (OH-FILET-HALF-001)   — similar, alternate cut
--   Haasjes (OH-HAAS-VAC-001)                — small portion
--   Vel (OH-VEL-001)                         — 3.17% of griller = 8.63% of kap
--   Kipfilet blokjes (= offcuts)             — remainder
--
-- FROM ZADELS / DIJ ANATOMISCH (OH-DIJANA-001):
--   Dijfilet (OH-DIJ-BULK-001)               — 9.25% of griller = 63.0% of zadel
--   Drumsticks 15kg (OH-DRUM-001)            — 16.56% of griller
--   Drumvlees (OH-DRUMVL-001)                — 10.43% of griller

-- Clear existing chains
DELETE FROM product_yield_chains;

-- Kappen → Filet bulk (z vel z haas): 66.45% of kap weight
INSERT INTO product_yield_chains (parent_product_id, child_product_id, source_location_id, target_location_id, yield_pct, sort_order)
SELECT
  (SELECT id FROM products WHERE sku_code = 'OH-BORST-KAL-001'),
  (SELECT id FROM products WHERE sku_code = 'OH-FILET-BULK-001'),
  'LOC_PUTTEN', 'LOC_NIJKERK', 0.664500, 1
ON CONFLICT (parent_product_id, child_product_id) DO UPDATE SET yield_pct = 0.664500;

-- Kappen → Haasjes: 12% of kap weight
INSERT INTO product_yield_chains (parent_product_id, child_product_id, source_location_id, target_location_id, yield_pct, sort_order)
SELECT
  (SELECT id FROM products WHERE sku_code = 'OH-BORST-KAL-001'),
  (SELECT id FROM products WHERE sku_code = 'OH-HAAS-VAC-001'),
  'LOC_PUTTEN', 'LOC_NIJKERK', 0.120000, 2
ON CONFLICT (parent_product_id, child_product_id) DO UPDATE SET yield_pct = 0.120000;

-- Kappen → Vel: 8.63% of kap weight
INSERT INTO product_yield_chains (parent_product_id, child_product_id, source_location_id, target_location_id, yield_pct, sort_order)
SELECT
  (SELECT id FROM products WHERE sku_code = 'OH-BORST-KAL-001'),
  (SELECT id FROM products WHERE sku_code = 'OH-VEL-001'),
  'LOC_PUTTEN', 'LOC_NIJKERK', 0.086300, 3
ON CONFLICT (parent_product_id, child_product_id) DO UPDATE SET yield_pct = 0.086300;

-- Zadels → Dijfilet bulk: 63.0% of zadel weight
INSERT INTO product_yield_chains (parent_product_id, child_product_id, source_location_id, target_location_id, yield_pct, sort_order)
SELECT
  (SELECT id FROM products WHERE sku_code = 'OH-DIJANA-001'),
  (SELECT id FROM products WHERE sku_code = 'OH-DIJ-BULK-001'),
  'LOC_PUTTEN', 'LOC_NIJKERK', 0.630000, 10
ON CONFLICT (parent_product_id, child_product_id) DO UPDATE SET yield_pct = 0.630000;

-- Zadels → Drumvlees: 49% of zadel weight (drumvlees is the deboned meat from drumstick area)
INSERT INTO product_yield_chains (parent_product_id, child_product_id, source_location_id, target_location_id, yield_pct, sort_order)
SELECT
  (SELECT id FROM products WHERE sku_code = 'OH-DIJANA-001'),
  (SELECT id FROM products WHERE sku_code = 'OH-DRUMVL-001'),
  'LOC_PUTTEN', 'LOC_NIJKERK', 0.490000, 11
ON CONFLICT (parent_product_id, child_product_id) DO UPDATE SET yield_pct = 0.490000;
