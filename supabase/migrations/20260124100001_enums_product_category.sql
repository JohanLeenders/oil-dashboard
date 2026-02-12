-- ============================================================================
-- OIL (Oranjehoen Intelligence Layer) - Enum Types
-- Migration: Product category enum
-- ============================================================================

-- Product categorieën conform Hoofdstuk 6 TRD
CREATE TYPE product_category AS ENUM (
  'hele_kip',        -- Griller / Hele Kip
  'filet',           -- Borstfilet (premium)
  'haas',            -- Kippenhaasje / Inner fillet
  'dij',             -- Dijvlees
  'drumstick',       -- Drumstick (heel)
  'drumvlees',       -- Drumvlees (ontbeend)
  'vleugels',        -- Vleugels
  'karkas',          -- Rest/Karkas (Dijana, Naakt)
  'organen',         -- Lever, Maag, Hart, Nek
  'vel',             -- Huidvel (Cat 3/verwerking)
  'kosten',          -- Doorbelasting snijkosten etc.
  'emballage'        -- Kratten/fust
);
