-- Wave 6: Make product descriptions human-readable
-- Current names are trimmed but still have cryptic codes like "vrs 10kg kr"

UPDATE products SET description = 'Borstkappen met vel' WHERE sku_code = 'OH-BORST-KAL-001';
UPDATE products SET description = 'Dijvlees bulk' WHERE sku_code = 'OH-DIJ-BULK-001';
UPDATE products SET description = 'Dijvlees vacuum' WHERE sku_code = 'OH-DIJ-VAC-001';
UPDATE products SET description = 'Dij anatomisch' WHERE sku_code = 'OH-DIJANA-001';
UPDATE products SET description = 'Drumstick' WHERE sku_code = 'OH-DRUM-001';
UPDATE products SET description = 'Drumstick 10kg bulk' WHERE sku_code = 'OH-DRUM-BULK-001';
UPDATE products SET description = 'Drumvlees' WHERE sku_code = 'OH-DRUMVL-001';
UPDATE products SET description = 'Drumvlees vacuum 15kg' WHERE sku_code = 'OH-DRUMVL-VAC-001';
UPDATE products SET description = 'Kipfilet' WHERE sku_code = 'OH-FILET-BULK-001';
UPDATE products SET description = 'Filet half z/vel m/haas' WHERE sku_code = 'OH-FILET-HALF-001';
UPDATE products SET description = 'Kipfilet vacuum' WHERE sku_code = 'OH-FILET-VAC-001';
UPDATE products SET description = 'Kipfilet vacuum (2)' WHERE sku_code = 'OH-FILET-VAC-002';
UPDATE products SET description = 'Haasjes vacuum' WHERE sku_code = 'OH-HAAS-VAC-001';
UPDATE products SET description = 'Nekken' WHERE sku_code = 'OH-HALS-001';
UPDATE products SET description = 'Hartjes' WHERE sku_code = 'OH-HART-001';
UPDATE products SET description = 'Levertjes' WHERE sku_code = 'OH-LEVER-001';
UPDATE products SET description = 'Maagjes' WHERE sku_code = 'OH-MAAG-001';
UPDATE products SET description = 'Naakt 1700-1800' WHERE sku_code = 'OH-NAAKT-001';
UPDATE products SET description = 'Vel' WHERE sku_code = 'OH-VEL-001';
UPDATE products SET description = 'Vleugels z/tip' WHERE sku_code = 'OH-VLEUGEL-001';
