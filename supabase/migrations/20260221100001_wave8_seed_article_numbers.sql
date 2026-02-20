-- Wave 8: Seed article numbers from Storteboom bestelschema
-- Source: docs/WAVE8_REFERENCE_EXCEL.md "Artikelnummers Master"

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. ADD MISSING PRODUCTS (not yet in products table)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO products (sku_code, storteboom_plu, description, internal_name, category, anatomical_part, is_saleable, packaging_type, standard_weight_kg, notes)
VALUES
  ('OH-HELE-1300', '400560', 'Hele hoen naakt 1300-1600', 'Hele hoen 1300-1600', 'hele_kip', NULL, true, 'Per stuk', 1.45, 'Hele hoen gewichtsklasse 1300-1600g'),
  ('OH-HELE-1800', '400584', 'Hele hoen naakt 1800-2100', 'Hele hoen 1800-2100', 'hele_kip', NULL, true, 'Per stuk', 1.95, 'Hele hoen gewichtsklasse 1800-2100g'),
  ('OH-HELE-MAP', NULL, 'Hele hoen MAP', 'Hele hoen MAP', 'hele_kip', NULL, true, 'MAP', 1.80, 'Hele hoen MAP verpakking (Zeewolde)'),
  ('OH-VLEUGEL-MIX', '386055', 'Vleugels mix', 'Vleugels mix', 'vleugels', 'wings', true, 'Bulk 10kg', 10.00, 'Vleugels mix (3-ledig)'),
  ('OH-FILET-BLOK-001', '513222', 'Kipfilet blokjes 10-15', 'Kipfilet blokjes', 'filet', 'breast_cap', true, 'Bulk 15kg', 15.00, 'Kipfilet blokjes 10-15mm'),
  ('OH-KARKAS-250', '669967', 'Karkas 250kg', 'Karkas Nijkerk', 'karkas', 'back_carcass', true, 'Bulk 250kg', 250.00, 'Karkas Nijkerk groot'),
  ('OH-OFFCUTS-001', '528356', 'Offcuts', 'Offcuts', 'filet', 'breast_cap', true, 'Bulk', NULL, 'Snijresten filet')
ON CONFLICT (sku_code) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. SEED ARTICLE NUMBERS
-- ═══════════════════════════════════════════════════════════════════════════

-- --- PUTTEN PRODUCTS ---

-- Hele hoen naakt 1300-1600: niet_vacuum 400560
INSERT INTO product_article_numbers (product_id, location, article_type, article_number, packaging_size)
SELECT p.id, 'putten', 'niet_vacuum', '400560', '11,6kg'
FROM products p WHERE p.sku_code = 'OH-HELE-1300'
ON CONFLICT (product_id, location, article_type) DO NOTHING;

-- Hele hoen naakt 1700-1800: niet_vacuum 400577
INSERT INTO product_article_numbers (product_id, location, article_type, article_number, packaging_size)
SELECT p.id, 'putten', 'niet_vacuum', '400577', '14kg'
FROM products p WHERE p.sku_code = 'OH-NAAKT-001'
ON CONFLICT (product_id, location, article_type) DO NOTHING;

-- Hele hoen naakt 1800-2100: niet_vacuum 400584
INSERT INTO product_article_numbers (product_id, location, article_type, article_number, packaging_size)
SELECT p.id, 'putten', 'niet_vacuum', '400584', '15,6kg'
FROM products p WHERE p.sku_code = 'OH-HELE-1800'
ON CONFLICT (product_id, location, article_type) DO NOTHING;

-- Vleugels mix: niet_vacuum 386055
INSERT INTO product_article_numbers (product_id, location, article_type, article_number, packaging_size)
SELECT p.id, 'putten', 'niet_vacuum', '386055', '10kg'
FROM products p WHERE p.sku_code = 'OH-VLEUGEL-MIX'
ON CONFLICT (product_id, location, article_type) DO NOTHING;

-- Vleugels z tip: niet_vacuum 382750
INSERT INTO product_article_numbers (product_id, location, article_type, article_number, packaging_size)
SELECT p.id, 'putten', 'niet_vacuum', '382750', '10kg'
FROM products p WHERE p.sku_code = 'OH-VLEUGEL-001'
ON CONFLICT (product_id, location, article_type) DO NOTHING;

-- Maagjes: niet_vacuum 646098
INSERT INTO product_article_numbers (product_id, location, article_type, article_number, packaging_size)
SELECT p.id, 'putten', 'niet_vacuum', '646098', '10kg'
FROM products p WHERE p.sku_code = 'OH-MAAG-001'
ON CONFLICT (product_id, location, article_type) DO NOTHING;

-- Levertjes: niet_vacuum 656196
INSERT INTO product_article_numbers (product_id, location, article_type, article_number, packaging_size)
SELECT p.id, 'putten', 'niet_vacuum', '656196', '10kg'
FROM products p WHERE p.sku_code = 'OH-LEVER-001'
ON CONFLICT (product_id, location, article_type) DO NOTHING;

-- Hartjes: niet_vacuum 636044
INSERT INTO product_article_numbers (product_id, location, article_type, article_number, packaging_size)
SELECT p.id, 'putten', 'niet_vacuum', '636044', '10kg'
FROM products p WHERE p.sku_code = 'OH-HART-001'
ON CONFLICT (product_id, location, article_type) DO NOTHING;

-- Nekken: niet_vacuum 608225
INSERT INTO product_article_numbers (product_id, location, article_type, article_number, packaging_size)
SELECT p.id, 'putten', 'niet_vacuum', '608225', '10kg'
FROM products p WHERE p.sku_code = 'OH-HALS-001'
ON CONFLICT (product_id, location, article_type) DO NOTHING;

-- Drumsticks 10kg: niet_vacuum 442133
INSERT INTO product_article_numbers (product_id, location, article_type, article_number, packaging_size)
SELECT p.id, 'putten', 'niet_vacuum', '442133', '10kg'
FROM products p WHERE p.sku_code = 'OH-DRUM-BULK-001'
ON CONFLICT (product_id, location, article_type) DO NOTHING;

-- Borstkappen met vel: niet_vacuum 325016
INSERT INTO product_article_numbers (product_id, location, article_type, article_number, packaging_size)
SELECT p.id, 'putten', 'niet_vacuum', '325016', '11,5kg'
FROM products p WHERE p.sku_code = 'OH-BORST-KAL-001'
ON CONFLICT (product_id, location, article_type) DO NOTHING;

-- Dij anatomisch: niet_vacuum 400553
INSERT INTO product_article_numbers (product_id, location, article_type, article_number, packaging_size)
SELECT p.id, 'putten', 'niet_vacuum', '400553', '10kg'
FROM products p WHERE p.sku_code = 'OH-DIJANA-001'
ON CONFLICT (product_id, location, article_type) DO NOTHING;


-- --- NIJKERK PRODUCTS ---

-- OH flt half, zonder vel MET haas: niet_vacuum 539574
INSERT INTO product_article_numbers (product_id, location, article_type, article_number, packaging_size)
SELECT p.id, 'nijkerk', 'niet_vacuum', '539574', NULL
FROM products p WHERE p.sku_code = 'OH-FILET-HALF-001'
ON CONFLICT (product_id, location, article_type) DO NOTHING;

-- OH Haasjes: vacuum 514298, niet_vacuum 598328
INSERT INTO product_article_numbers (product_id, location, article_type, article_number, packaging_size)
SELECT p.id, 'nijkerk', 'vacuum', '514298', NULL
FROM products p WHERE p.sku_code = 'OH-HAAS-VAC-001'
ON CONFLICT (product_id, location, article_type) DO NOTHING;

INSERT INTO product_article_numbers (product_id, location, article_type, article_number, packaging_size)
SELECT p.id, 'nijkerk', 'niet_vacuum', '598328', NULL
FROM products p WHERE p.sku_code = 'OH-HAAS-VAC-001'
ON CONFLICT (product_id, location, article_type) DO NOTHING;

-- OH flt half, zonder vel zonder haas: vacuum 540457, niet_vacuum 540327
INSERT INTO product_article_numbers (product_id, location, article_type, article_number, packaging_size)
SELECT p.id, 'nijkerk', 'vacuum', '540457', '15kg'
FROM products p WHERE p.sku_code = 'OH-FILET-VAC-001'
ON CONFLICT (product_id, location, article_type) DO NOTHING;

INSERT INTO product_article_numbers (product_id, location, article_type, article_number, packaging_size)
SELECT p.id, 'nijkerk', 'niet_vacuum', '540327', '15kg'
FROM products p WHERE p.sku_code = 'OH-FILET-VAC-001'
ON CONFLICT (product_id, location, article_type) DO NOTHING;

-- Dijfilet 15 kg vacuum: vacuum 392940, niet_vacuum 392841
INSERT INTO product_article_numbers (product_id, location, article_type, article_number, packaging_size)
SELECT p.id, 'nijkerk', 'vacuum', '392940', '15kg'
FROM products p WHERE p.sku_code = 'OH-DIJ-VAC-001'
ON CONFLICT (product_id, location, article_type) DO NOTHING;

INSERT INTO product_article_numbers (product_id, location, article_type, article_number, packaging_size)
SELECT p.id, 'nijkerk', 'niet_vacuum', '392841', '15kg'
FROM products p WHERE p.sku_code = 'OH-DIJ-VAC-001'
ON CONFLICT (product_id, location, article_type) DO NOTHING;

-- Kipfilet blokjes 10-15: vacuum 514281, niet_vacuum 513222
INSERT INTO product_article_numbers (product_id, location, article_type, article_number, packaging_size)
SELECT p.id, 'nijkerk', 'vacuum', '514281', '15kg'
FROM products p WHERE p.sku_code = 'OH-FILET-BLOK-001'
ON CONFLICT (product_id, location, article_type) DO NOTHING;

INSERT INTO product_article_numbers (product_id, location, article_type, article_number, packaging_size)
SELECT p.id, 'nijkerk', 'niet_vacuum', '513222', '15kg'
FROM products p WHERE p.sku_code = 'OH-FILET-BLOK-001'
ON CONFLICT (product_id, location, article_type) DO NOTHING;

-- Karkas 250kg: niet_vacuum 669967
INSERT INTO product_article_numbers (product_id, location, article_type, article_number, packaging_size)
SELECT p.id, 'nijkerk', 'niet_vacuum', '669967', '250kg'
FROM products p WHERE p.sku_code = 'OH-KARKAS-250'
ON CONFLICT (product_id, location, article_type) DO NOTHING;

-- Vel 15kg: niet_vacuum 849079
INSERT INTO product_article_numbers (product_id, location, article_type, article_number, packaging_size)
SELECT p.id, 'nijkerk', 'niet_vacuum', '849079', NULL
FROM products p WHERE p.sku_code = 'OH-VEL-001'
ON CONFLICT (product_id, location, article_type) DO NOTHING;

-- Drumsticks 15kg: niet_vacuum 442140
INSERT INTO product_article_numbers (product_id, location, article_type, article_number, packaging_size)
SELECT p.id, 'nijkerk', 'niet_vacuum', '442140', '15kg'
FROM products p WHERE p.sku_code = 'OH-DRUM-001'
ON CONFLICT (product_id, location, article_type) DO NOTHING;

-- Drumvlees 15kg: vacuum 430574, niet_vacuum 430406
INSERT INTO product_article_numbers (product_id, location, article_type, article_number, packaging_size)
SELECT p.id, 'nijkerk', 'vacuum', '430574', '15kg'
FROM products p WHERE p.sku_code = 'OH-DRUMVL-VAC-001'
ON CONFLICT (product_id, location, article_type) DO NOTHING;

INSERT INTO product_article_numbers (product_id, location, article_type, article_number, packaging_size)
SELECT p.id, 'nijkerk', 'niet_vacuum', '430406', '15kg'
FROM products p WHERE p.sku_code = 'OH-DRUMVL-VAC-001'
ON CONFLICT (product_id, location, article_type) DO NOTHING;

-- Filet zonder vel, zonder haas 195-220: niet_vacuum 540617
INSERT INTO product_article_numbers (product_id, location, article_type, article_number, packaging_size)
SELECT p.id, 'nijkerk', 'niet_vacuum', '540617', NULL
FROM products p WHERE p.sku_code = 'OH-FILET-VAC-002'
ON CONFLICT (product_id, location, article_type) DO NOTHING;

-- Offcuts: niet_vacuum 528356
INSERT INTO product_article_numbers (product_id, location, article_type, article_number, packaging_size)
SELECT p.id, 'nijkerk', 'niet_vacuum', '528356', NULL
FROM products p WHERE p.sku_code = 'OH-OFFCUTS-001'
ON CONFLICT (product_id, location, article_type) DO NOTHING;
