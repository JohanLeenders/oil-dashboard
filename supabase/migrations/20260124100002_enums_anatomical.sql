-- ============================================================================
-- OIL - Enum Types (continued)
-- Migration: Anatomical part enum
-- ============================================================================

-- Anatomische delen voor yield tracking (Niveau 2: Cut-Up)
CREATE TYPE anatomical_part AS ENUM (
  'breast_cap',      -- Borstkap (34.8% - 36.9% van griller)
  'leg_quarter',     -- Achterkwartier (42.0% - 44.8% van griller)
  'wings',           -- Vleugels (10.6% - 10.8% van griller)
  'back_carcass',    -- Rug/Karkas (7.0% - 8.2% van griller)
  'offal'            -- Organen (nekken, lever, maag, hart)
);
