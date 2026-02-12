-- ============================================================================
-- OIL - Enum Types (continued)
-- Migration: THT status enum
-- ============================================================================

-- THT status voor voorraad (Blueprint Spec)
CREATE TYPE tht_status AS ENUM (
  'green',   -- < 70% verstreken
  'orange',  -- 70-90% verstreken
  'red'      -- > 90% verstreken
);
