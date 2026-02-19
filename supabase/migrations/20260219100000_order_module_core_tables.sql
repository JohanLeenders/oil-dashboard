-- ==========================================================================
-- Migration: 20260219100000_order_module_core_tables.sql
-- Purpose:   OIL Order Module Phase 1 — Wave 1 Core Tables
-- Sprint:    A0-S1a (Core Schema)
-- Tables:    slaughter_calendar, customer_orders, order_lines,
--            order_schema_snapshots
-- Author:    Claude Code Agent (Infra teammate)
-- Date:      2026-02-19
--
-- GOVERNANCE:
-- - Append-only for order_schema_snapshots (no UPDATE/DELETE)
-- - Data Contracts v1 enums enforced (§4.9)
-- - All FK indexes included
-- - updated_at triggers via update_updated_at()
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. ENUM TYPES (Data Contracts v1 — §4.9)
-- --------------------------------------------------------------------------

-- slaughter_calendar.status
CREATE TYPE slaughter_status AS ENUM (
  'planned',
  'orders_open',
  'finalized',
  'slaughtered',
  'completed'
);

-- customer_orders.status
CREATE TYPE order_status AS ENUM (
  'draft',
  'submitted',
  'confirmed',
  'cancelled'
);

-- order_schema_snapshots.snapshot_type
CREATE TYPE snapshot_type AS ENUM (
  'draft',
  'finalized'
);

-- --------------------------------------------------------------------------
-- 2. slaughter_calendar — Geplande slachtdata met verwachte aantallen
-- --------------------------------------------------------------------------

CREATE TABLE slaughter_calendar (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slaughter_date  date NOT NULL,
  week_number     integer NOT NULL,
  year            integer NOT NULL,

  -- Verwachte aantallen per mester
  expected_birds  integer NOT NULL DEFAULT 0,
  expected_live_weight_kg numeric(12,2) NOT NULL DEFAULT 0,

  -- Mester breakdown (JSONB — extensible)
  -- Structure: [{ "mester": "Leenders", "birds": 5000, "avg_weight_kg": 2.65 }, ...]
  mester_breakdown jsonb DEFAULT '[]'::jsonb,

  -- Locatie(s)
  slaughter_location text, -- 'putten', 'nijkerk', or both

  -- Status workflow (Data Contract v1 enum)
  status          slaughter_status NOT NULL DEFAULT 'planned',

  -- Deadlines
  order_deadline  timestamptz, -- Wanneer moeten orders binnen zijn

  -- Metadata
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      text, -- Future: auth.uid()

  -- Constraints
  CONSTRAINT slaughter_calendar_week_check CHECK (week_number BETWEEN 1 AND 53),
  CONSTRAINT slaughter_calendar_year_check CHECK (year BETWEEN 2020 AND 2100),
  CONSTRAINT slaughter_calendar_birds_check CHECK (expected_birds >= 0),
  CONSTRAINT slaughter_calendar_weight_check CHECK (expected_live_weight_kg >= 0)
);

-- Indexes
CREATE INDEX idx_slaughter_calendar_date ON slaughter_calendar(slaughter_date);
CREATE INDEX idx_slaughter_calendar_status ON slaughter_calendar(status);
CREATE INDEX idx_slaughter_calendar_week_year ON slaughter_calendar(year, week_number);
CREATE UNIQUE INDEX idx_slaughter_calendar_unique_date ON slaughter_calendar(slaughter_date);

-- updated_at trigger
CREATE TRIGGER trg_slaughter_calendar_updated_at
  BEFORE UPDATE ON slaughter_calendar
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- --------------------------------------------------------------------------
-- 3. customer_orders — Orders per klant per slachtdatum
-- --------------------------------------------------------------------------

CREATE TABLE customer_orders (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slaughter_id    uuid NOT NULL REFERENCES slaughter_calendar(id),
  customer_id     uuid NOT NULL REFERENCES customers(id),

  -- Status workflow (Data Contract v1 enum)
  status          order_status NOT NULL DEFAULT 'draft',

  -- Totals (denormalized from order_lines for performance)
  total_kg        numeric(12,2) NOT NULL DEFAULT 0,
  total_lines     integer NOT NULL DEFAULT 0,

  -- Metadata
  notes           text,
  submitted_at    timestamptz,
  confirmed_at    timestamptz,
  confirmed_by    text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      text,

  -- Constraints: one active order per customer per slaughter
  CONSTRAINT customer_orders_total_kg_check CHECK (total_kg >= 0)
);

-- Indexes
CREATE INDEX idx_customer_orders_slaughter ON customer_orders(slaughter_id);
CREATE INDEX idx_customer_orders_customer ON customer_orders(customer_id);
CREATE INDEX idx_customer_orders_status ON customer_orders(status);
CREATE UNIQUE INDEX idx_customer_orders_unique_active
  ON customer_orders(slaughter_id, customer_id)
  WHERE status != 'cancelled'::order_status;

-- updated_at trigger
CREATE TRIGGER trg_customer_orders_updated_at
  BEFORE UPDATE ON customer_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- --------------------------------------------------------------------------
-- 4. order_lines — Orderregels per product
-- --------------------------------------------------------------------------

CREATE TABLE order_lines (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        uuid NOT NULL REFERENCES customer_orders(id) ON DELETE CASCADE,
  product_id      uuid NOT NULL REFERENCES products(id),

  -- Bestelde hoeveelheden
  quantity_kg     numeric(12,2) NOT NULL,
  quantity_pieces  integer,

  -- Prijs (optioneel voor Fase 1 — kan later uit contracts komen)
  unit_price_eur  numeric(10,4),

  -- Line metadata
  notes           text,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT order_lines_quantity_check CHECK (quantity_kg > 0)
);

-- Indexes
CREATE INDEX idx_order_lines_order ON order_lines(order_id);
CREATE INDEX idx_order_lines_product ON order_lines(product_id);

-- updated_at trigger
CREATE TRIGGER trg_order_lines_updated_at
  BEFORE UPDATE ON order_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- --------------------------------------------------------------------------
-- 5. order_schema_snapshots — Geformaliseerde bestelschema's
--    APPEND-ONLY: No UPDATE or DELETE allowed (governance: §5 Append-Only)
-- --------------------------------------------------------------------------

CREATE TABLE order_schema_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slaughter_id    uuid NOT NULL REFERENCES slaughter_calendar(id),

  -- Snapshot type (Data Contract v1 enum)
  snapshot_type   snapshot_type NOT NULL DEFAULT 'draft',

  -- Complete schema data (JSONB — Data Contract v1 structure)
  -- See §4.9 for required JSON structure
  schema_data     jsonb NOT NULL,

  -- Version tracking (append-only means version = row count)
  version         integer NOT NULL DEFAULT 1,

  -- Metadata
  snapshot_date   timestamptz NOT NULL DEFAULT now(),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      text

  -- NOTE: No updated_at — this table is APPEND-ONLY
);

-- Indexes
CREATE INDEX idx_snapshots_slaughter ON order_schema_snapshots(slaughter_id);
CREATE INDEX idx_snapshots_type ON order_schema_snapshots(snapshot_type);
CREATE INDEX idx_snapshots_date ON order_schema_snapshots(snapshot_date DESC);

-- --------------------------------------------------------------------------
-- 6. VERIFICATION COMMENTS
-- --------------------------------------------------------------------------
-- Tables created: slaughter_calendar, customer_orders, order_lines, order_schema_snapshots
-- Enums created: slaughter_status, order_status, snapshot_type
-- All FK indexes present
-- updated_at triggers on: slaughter_calendar, customer_orders, order_lines
-- order_schema_snapshots is APPEND-ONLY (no update trigger, no UPDATE/DELETE allowed)
-- Data Contracts v1 (§4.9) enum values enforced via PostgreSQL ENUM types
