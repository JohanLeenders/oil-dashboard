-- ============================================================================
-- OIL - Enum Types (continued)
-- Migration: Batch status enum
-- ============================================================================

-- Batch status
CREATE TYPE batch_status AS ENUM (
  'planned',
  'slaughtered',
  'cut_up',
  'in_sales',
  'closed'
);
