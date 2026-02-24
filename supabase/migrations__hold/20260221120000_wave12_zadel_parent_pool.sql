DO $$
BEGIN--
 Wave 12: Zadel as Parent Pool — Two-route co-production model
--
-- Problem: The current model has Dij anatomisch (14.68%) and Drumstick (16.56%)
-- as independent primary products. But they are children of the Zadel (43.50% of griller).
-- The Zadel is a real parent pool (from Storteboom bestelschema).
--
-- Changes:
--   1. Create Zadel product (parent pool, not directly sellable)
--   2. Create Zadel snij-verlies product (Putten cut loss)
--   3. Remove Dij anatomisch and Drumstick from yield_profiles (they become chain children)
--   4. Add Zadel as Putten parent in yield_profiles at 43.50%
--   5. Create Putten→Putten yield chains (forced co-production: dij + drum + loss)
--   6. Update Nijkerk chains: parent becomes Zadel with correct yields (% of zadel)
--   7. Add Drumsticks 15kg as Nijkerk chain child of Zadel

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. NEW PRODUCTS: Zadel (parent) + Snijverlies (loss child)
-- ═══════════════════════════════════════════════════════════════════════════

-- Zadel: the whole leg quarter / bout — 43.50% of griller
-- Not directly sellable; consumed via Putten cut or Nijkerk cascade
INSERT INTO products (sku_code, description, internal_name, category, anatomical_part, is_active, is_saleable)
VALUES ('OH-ZADEL-001', 'Zadel (heel)', 'zadel', 'zadel', 'leg_quarter', true, false)
ON CONFLICT (sku_code) DO UPDATE SET description = 'Zadel (heel)', is_active = true, is_saleable = false;

-- Zadel snij-verlies Putten: bone, cartilage, loss when cutting at Putten
INSERT INTO products (sku_code, description, internal_name, category, anatomical_part, is_active, is_saleable)
VALUES ('OH-ZADEL-LOSS-P', 'Zadel snijverlies Putten', 'zadel_loss_putten', 'verlies', 'leg_quarter', true, false)
ON CONFLICT (sku_code) DO UPDATE SET description = 'Zadel snijverlies Putten', is_active = true, is_saleable = false;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. UPDATE YIELD PROFILES: Remove dij/drum as primary, add Zadel as parent
-- ═══════════════════════════════════════════════════════════════════════════

-- Remove Dij anatomisch as independent primary (it becomes a Putten→Putten chain child)
DELETE FROM location_yield_profiles
WHERE location_id = 'LOC_PUTTEN'
  AND product_id = (SELECT id FROM products WHERE sku_code = 'OH-DIJANA-001');

-- Remove Drumstick 10kg as independent primary (it becomes a Putten→Putten chain child)
DELETE FROM location_yield_profiles
WHERE location_id = 'LOC_PUTTEN'
  AND product_id = (SELECT id FROM products WHERE sku_code = 'OH-DRUM-BULK-001');

-- Add Zadel as Putten parent: 43.50% of griller
INSERT INTO location_yield_profiles (location_id, product_id, yield_percentage, is_active)
SELECT 'LOC_PUTTEN', id, 0.435000, true FROM products WHERE sku_code = 'OH-ZADEL-001'
ON CONFLICT (location_id, product_id) DO UPDATE SET yield_percentage = 0.435000, is_active = true;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. PUTTEN→PUTTEN YIELD CHAINS (forced co-production)
--    When a customer orders dij anatomisch or drumstick at Putten,
--    the zadel must be cut open. ALL children are produced together.
--    source_location = LOC_PUTTEN, target_location = LOC_PUTTEN
-- ═══════════════════════════════════════════════════════════════════════════

-- Zadel → Dij anatomisch (Putten cut): 33.74% of zadel
INSERT INTO product_yield_chains
  (parent_product_id, child_product_id, source_location_id, target_location_id, yield_pct, sort_order)
SELECT
  (SELECT id FROM products WHERE sku_code = 'OH-ZADEL-001'),
  (SELECT id FROM products WHERE sku_code = 'OH-DIJANA-001'),
  'LOC_PUTTEN', 'LOC_PUTTEN', 0.337400, 20
ON CONFLICT (parent_product_id, child_product_id) DO UPDATE
SET yield_pct = 0.337400, source_location_id = 'LOC_PUTTEN', target_location_id = 'LOC_PUTTEN', sort_order = 20;

-- Zadel → Drumstick 10kg (Putten cut): 38.07% of zadel
INSERT INTO product_yield_chains
  (parent_product_id, child_product_id, source_location_id, target_location_id, yield_pct, sort_order)
SELECT
  (SELECT id FROM products WHERE sku_code = 'OH-ZADEL-001'),
  (SELECT id FROM products WHERE sku_code = 'OH-DRUM-BULK-001'),
  'LOC_PUTTEN', 'LOC_PUTTEN', 0.380700, 21
ON CONFLICT (parent_product_id, child_product_id) DO UPDATE
SET yield_pct = 0.380700, source_location_id = 'LOC_PUTTEN', target_location_id = 'LOC_PUTTEN', sort_order = 21;

-- Zadel → Snijverlies Putten (explicit loss): 28.19% of zadel
-- Sum: 33.74% + 38.07% + 28.19% = 100.00% ✓
INSERT INTO product_yield_chains
  (parent_product_id, child_product_id, source_location_id, target_location_id, yield_pct, sort_order)
SELECT
  (SELECT id FROM products WHERE sku_code = 'OH-ZADEL-001'),
  (SELECT id FROM products WHERE sku_code = 'OH-ZADEL-LOSS-P'),
  'LOC_PUTTEN', 'LOC_PUTTEN', 0.281900, 22
ON CONFLICT (parent_product_id, child_product_id) DO UPDATE
SET yield_pct = 0.281900, source_location_id = 'LOC_PUTTEN', target_location_id = 'LOC_PUTTEN', sort_order = 22;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. UPDATE NIJKERK YIELD CHAINS: parent becomes Zadel
--    When zadels go WHOLE to Nijkerk, they are processed into:
--    Dijvlees 28%, Drumsticks 15kg 31%, Drumvlees 15.19%, loss 25.81%
--    source_location = LOC_PUTTEN, target_location = LOC_NIJKERK
-- ═══════════════════════════════════════════════════════════════════════════

-- Dijfilet bulk: parent was OH-DIJANA-001, now becomes OH-ZADEL-001
-- yield was 63% of dij anatomisch, now 28% of zadel (from Excel)
UPDATE product_yield_chains
SET parent_product_id = (SELECT id FROM products WHERE sku_code = 'OH-ZADEL-001'),
    yield_pct = 0.280000,
    source_location_id = 'LOC_PUTTEN',
    target_location_id = 'LOC_NIJKERK'
WHERE child_product_id = (SELECT id FROM products WHERE sku_code = 'OH-DIJ-BULK-001');

-- Drumvlees: parent was OH-DIJANA-001, now becomes OH-ZADEL-001
-- yield was 49% of dij anatomisch, now 15.19% of zadel (from Excel)
UPDATE product_yield_chains
SET parent_product_id = (SELECT id FROM products WHERE sku_code = 'OH-ZADEL-001'),
    yield_pct = 0.151900,
    source_location_id = 'LOC_PUTTEN',
    target_location_id = 'LOC_NIJKERK'
WHERE child_product_id = (SELECT id FROM products WHERE sku_code = 'OH-DRUMVL-001');

-- Drumsticks 15kg: NEW Nijkerk chain from Zadel
-- 31.00% of zadel (from Excel)
INSERT INTO product_yield_chains
  (parent_product_id, child_product_id, source_location_id, target_location_id, yield_pct, sort_order)
SELECT
  (SELECT id FROM products WHERE sku_code = 'OH-ZADEL-001'),
  (SELECT id FROM products WHERE sku_code = 'OH-DRUM-001'),
  'LOC_PUTTEN', 'LOC_NIJKERK', 0.310000, 12
ON CONFLICT (parent_product_id, child_product_id) DO UPDATE
SET yield_pct = 0.310000, source_location_id = 'LOC_PUTTEN', target_location_id = 'LOC_NIJKERK', sort_order = 12;

END $$;
