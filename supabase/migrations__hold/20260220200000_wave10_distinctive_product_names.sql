-- Wave 10 D2: Onderscheidende productnamen
-- Maakt productnamen uniek zodat ze in dropdowns duidelijk van elkaar te onderscheiden zijn.
-- Gebaseerd op Storteboom bestelschema naming (docs/WAVE8_REFERENCE_EXCEL.md)

-- ── Putten producten ──
UPDATE products SET description = 'Borstkappen met vel 11,5kg' WHERE sku_code = 'OH-BORST-KAL-001';
UPDATE products SET description = 'Dij anatomisch 10kg' WHERE sku_code = 'OH-DIJANA-001';
UPDATE products SET description = 'Drumstick 10kg bulk' WHERE sku_code = 'OH-DRUM-BULK-001';
UPDATE products SET description = 'Drumstick 15kg' WHERE sku_code = 'OH-DRUM-001';
UPDATE products SET description = 'Vleugels z/tip 10kg' WHERE sku_code = 'OH-VLEUGEL-001';
UPDATE products SET description = 'Nekken 10kg' WHERE sku_code = 'OH-HALS-001';
UPDATE products SET description = 'Levertjes 10kg' WHERE sku_code = 'OH-LEVER-001';
UPDATE products SET description = 'Maagjes 10kg' WHERE sku_code = 'OH-MAAG-001';
UPDATE products SET description = 'Hartjes 10kg' WHERE sku_code = 'OH-HART-001';
UPDATE products SET description = 'Vel 15kg' WHERE sku_code = 'OH-VEL-001';

-- ── Nijkerk producten (filet cascade) ──
UPDATE products SET description = 'OH filet z/vel z/haas 15kg' WHERE sku_code = 'OH-FILET-BULK-001';
UPDATE products SET description = 'OH filet z/vel z/haas vacuum' WHERE sku_code = 'OH-FILET-VAC-001';
UPDATE products SET description = 'OH filet z/vel z/haas 195-220g' WHERE sku_code = 'OH-FILET-VAC-002';
UPDATE products SET description = 'OH filet half z/vel m/haas 15kg' WHERE sku_code = 'OH-FILET-HALF-001';
UPDATE products SET description = 'OH Haasjes vacuum' WHERE sku_code = 'OH-HAAS-VAC-001';

-- ── Nijkerk producten (zadel cascade) ──
UPDATE products SET description = 'Dijvlees bulk 15kg' WHERE sku_code = 'OH-DIJ-BULK-001';
UPDATE products SET description = 'Dijvlees vacuum 15kg' WHERE sku_code = 'OH-DIJ-VAC-001';
UPDATE products SET description = 'Drumvlees 15kg' WHERE sku_code = 'OH-DRUMVL-001';
UPDATE products SET description = 'Drumvlees vacuum 15kg' WHERE sku_code = 'OH-DRUMVL-VAC-001';

-- ── Hele hoenen ──
UPDATE products SET description = 'Hele hoen naakt 1700-1800' WHERE sku_code = 'OH-NAAKT-001';
