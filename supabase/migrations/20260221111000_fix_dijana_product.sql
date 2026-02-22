-- Fix OH-DIJANA-001: was category='karkas', anatomical_part='back_carcass'
-- Dit zorgde ervoor dat bestellingen als 'Hele kip uit verdeling' werden afgetrokken.
-- Correctie: dij_anatomisch / leg_quarter (Putten primair product)

UPDATE products
SET
  category = 'dij_anatomisch',
  anatomical_part = 'leg_quarter',
  internal_name = 'Dij anatomisch'
WHERE sku_code = 'OH-DIJANA-001';
