-- ═══════════════════════════════════════════════════════════════════════
-- DROOGTEST Wave 12: Zadel Parent Pool Migratie
-- ═══════════════════════════════════════════════════════════════════════
-- Voer deze queries uit in Supabase SQL Editor VOOR de echte migratie.
-- Ze wijzigen NIETS — alleen SELECT-queries om te controleren of de migratie
-- veilig kan draaien.
--
-- ✅ = verwacht resultaat als alles goed is
-- ❌ = als dit resultaat komt, STOP en meld het
-- ═══════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────
-- CHECK 1: Bestaan de producten die we nodig hebben?
-- ✅ Verwacht: 4 rijen (OH-DIJANA-001, OH-DRUM-BULK-001, OH-DIJ-BULK-001, OH-DRUMVL-001)
-- ❌ Als er minder zijn: product ontbreekt, migratie zal falen
-- ───────────────────────────────────────────────────────────────────────
SELECT sku_code, description, category, anatomical_part, is_active
FROM products
WHERE sku_code IN ('OH-DIJANA-001', 'OH-DRUM-BULK-001', 'OH-DIJ-BULK-001', 'OH-DRUMVL-001')
ORDER BY sku_code;

-- ───────────────────────────────────────────────────────────────────────
-- CHECK 2: SKU-codes voor nieuwe producten bestaan NIET al?
-- ✅ Verwacht: 0 rijen (nog niet aangemaakt)
-- ⚠️ Als ze al bestaan: ON CONFLICT zal UPDATE doen — geen probleem, maar check beschrijving
-- ───────────────────────────────────────────────────────────────────────
SELECT sku_code, description, category
FROM products
WHERE sku_code IN ('OH-ZADEL-001', 'OH-ZADEL-LOSS-P');

-- ───────────────────────────────────────────────────────────────────────
-- CHECK 3: Huidige yield profiles voor Putten (wat wordt gewijzigd)
-- ✅ Verwacht: je ziet dij anatomisch (14.68%) en drumstick (16.56%) in de lijst
--    Deze worden verwijderd en vervangen door Zadel (43.50%)
-- ───────────────────────────────────────────────────────────────────────
SELECT
  lyp.location_id,
  p.sku_code,
  p.description,
  lyp.yield_percentage,
  lyp.is_active
FROM location_yield_profiles lyp
JOIN products p ON p.id = lyp.product_id
WHERE lyp.location_id = 'LOC_PUTTEN'
ORDER BY lyp.yield_percentage DESC;

-- ───────────────────────────────────────────────────────────────────────
-- CHECK 4: Huidige yield chains (wat wordt bijgewerkt)
-- ✅ Verwacht: chains met dij anatomisch als parent voor dijvlees en drumvlees
--    Deze worden geüpdated naar Zadel als parent
-- ───────────────────────────────────────────────────────────────────────
SELECT
  pp.sku_code AS parent_sku,
  pp.description AS parent,
  cp.sku_code AS child_sku,
  cp.description AS child,
  pyc.yield_pct,
  pyc.source_location_id,
  pyc.target_location_id,
  pyc.sort_order
FROM product_yield_chains pyc
JOIN products pp ON pp.id = pyc.parent_product_id
JOIN products cp ON cp.id = pyc.child_product_id
ORDER BY pyc.sort_order;

-- ───────────────────────────────────────────────────────────────────────
-- CHECK 5: Drumsticks 15kg product (nodig voor nieuwe Nijkerk chain)
-- ✅ Verwacht: 1 rij met OH-DRUM-001
-- ❌ Als 0 rijen: product ontbreekt, INSERT Nijkerk chain zal falen
-- ───────────────────────────────────────────────────────────────────────
SELECT sku_code, description, category, is_active
FROM products
WHERE sku_code = 'OH-DRUM-001';

-- ───────────────────────────────────────────────────────────────────────
-- CHECK 6: Bestaande orders op dij/drum (gevolgen van migratie)
-- ✅ Verwacht: order_lines die verwijzen naar dij anatomisch of drumstick
--    Na migratie worden deze als Putten-cut children behandeld door de engine
-- ───────────────────────────────────────────────────────────────────────
SELECT
  ol.id AS line_id,
  co.slaughter_id,
  c.name AS klant,
  p.sku_code,
  p.description AS product,
  ol.quantity_kg
FROM order_lines ol
JOIN customer_orders co ON co.id = ol.order_id
JOIN customers c ON c.id = co.customer_id
JOIN products p ON p.id = ol.product_id
WHERE p.sku_code IN ('OH-DIJANA-001', 'OH-DRUM-BULK-001')
ORDER BY co.slaughter_id, c.name;

-- ───────────────────────────────────────────────────────────────────────
-- CHECK 7: Yield som controle NA migratie (simulatie)
-- ✅ Verwacht: totaal yield moet < 100% zijn (er is altijd verlies)
-- Huidige yield_profiles som:
-- ───────────────────────────────────────────────────────────────────────
SELECT
  SUM(yield_percentage) AS total_yield_pct,
  COUNT(*) AS num_profiles
FROM location_yield_profiles
WHERE location_id = 'LOC_PUTTEN'
  AND is_active = true;

-- Na migratie zou dit worden: (huidige - 0.1468 - 0.1656 + 0.4350)
-- Check: is dat nog steeds < 1.0?

-- ───────────────────────────────────────────────────────────────────────
-- CHECK 8: Unique constraints die ON CONFLICT nodig hebben
-- ✅ Verwacht: bevestig dat products.sku_code UNIQUE is
--    en product_yield_chains (parent_product_id, child_product_id) UNIQUE is
-- ───────────────────────────────────────────────────────────────────────
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON kcu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'UNIQUE'
  AND tc.table_name IN ('products', 'product_yield_chains', 'location_yield_profiles')
ORDER BY tc.table_name, tc.constraint_name, kcu.ordinal_position;

-- ═══════════════════════════════════════════════════════════════════════
-- SAMENVATTING: Wat de migratie doet
-- ═══════════════════════════════════════════════════════════════════════
-- 1. INSERTS: 2 nieuwe producten (Zadel, Zadel snijverlies)
-- 2. DELETES: 2 yield_profiles (dij anatomisch, drumstick → worden chain children)
-- 3. INSERT:  1 yield_profile (Zadel 43.50%)
-- 4. INSERTS: 3 Putten→Putten chains (dij 33.74%, drum 38.07%, loss 28.19% = 100%)
-- 5. UPDATES: 2 Nijkerk chains (parent dij→zadel, nieuwe yields)
-- 6. INSERT:  1 Nijkerk chain (Drumsticks 15kg 31% van zadel)
--
-- ROLLBACK als het misgaat:
-- De migratie gebruikt ON CONFLICT voor de INSERT-statements.
-- De DELETE + UPDATE statements zijn NIET idempotent.
-- Als je moet rollbacken, voer dan handmatig de inverse stappen uit.
-- ═══════════════════════════════════════════════════════════════════════
