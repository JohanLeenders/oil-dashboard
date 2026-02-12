-- =============================================================================
-- Sprint 5: Customer Contracts Table
-- =============================================================================
-- Purpose: Store contractual agreements between Oranjehoen and customers
-- regarding expected part share ranges per anatomical part.
--
-- This table enables:
-- - Tracking agreed share ranges per customer/part
-- - Comparing actual intake vs contractual agreements
-- - Providing context for margin discussions
--
-- NOT FOR: Automatic price adjustments, customer ranking, optimization
-- =============================================================================

CREATE TABLE IF NOT EXISTS customer_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Customer reference
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Part reference (anatomical part code)
  part_code VARCHAR(50) NOT NULL,

  -- Agreed share range (as percentage of total intake)
  agreed_share_min NUMERIC(5,2) NOT NULL CHECK (agreed_share_min >= 0 AND agreed_share_min <= 100),
  agreed_share_max NUMERIC(5,2) NOT NULL CHECK (agreed_share_max >= 0 AND agreed_share_max <= 100),

  -- Contract metadata
  contract_start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  contract_end_date DATE,

  -- Price tier (for margin context, not price calculation)
  price_tier VARCHAR(50),

  -- Notes for context (why this agreement exists)
  notes TEXT,

  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT,

  -- Constraints
  CONSTRAINT customer_contracts_share_range_valid CHECK (agreed_share_min <= agreed_share_max),
  CONSTRAINT customer_contracts_unique_customer_part UNIQUE (customer_id, part_code, contract_start_date)
);

-- Index for efficient lookups
CREATE INDEX idx_customer_contracts_customer ON customer_contracts(customer_id);
CREATE INDEX idx_customer_contracts_part ON customer_contracts(part_code);
CREATE INDEX idx_customer_contracts_active ON customer_contracts(contract_end_date)
  WHERE contract_end_date IS NULL;
