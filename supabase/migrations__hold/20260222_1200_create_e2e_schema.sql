-- ==========================================================================
-- Migration: 20260222_1200_create_e2e_schema.sql
-- Purpose:   Create isolated e2e schema for Cypress E2E tests.
--            Copies 5 tables used by E2E writes. Shared stamdata
--            (customers, products) stays in public.
-- Author:    Claude Code Agent
-- Date:      2026-02-22
-- ==========================================================================

-- 1. Schema + permissions
CREATE SCHEMA IF NOT EXISTS e2e;
GRANT USAGE ON SCHEMA e2e TO anon, authenticated, service_role;

-- 2. Copy table structures (columns, defaults, CHECK constraints, indexes)
--    FK constraints are NOT copied by LIKE — we add them manually below.
CREATE TABLE e2e.slaughter_calendar  (LIKE public.slaughter_calendar  INCLUDING ALL);
CREATE TABLE e2e.production_batches  (LIKE public.production_batches  INCLUDING ALL);
CREATE TABLE e2e.customer_orders     (LIKE public.customer_orders     INCLUDING ALL);
CREATE TABLE e2e.order_lines         (LIKE public.order_lines         INCLUDING ALL);
CREATE TABLE e2e.batch_yields        (LIKE public.batch_yields        INCLUDING ALL);

-- 3. Foreign keys — internal e2e relationships
ALTER TABLE e2e.customer_orders
  ADD CONSTRAINT fk_co_slaughter
    FOREIGN KEY (slaughter_id) REFERENCES e2e.slaughter_calendar(id);

ALTER TABLE e2e.order_lines
  ADD CONSTRAINT fk_ol_order
    FOREIGN KEY (order_id) REFERENCES e2e.customer_orders(id) ON DELETE CASCADE;

ALTER TABLE e2e.batch_yields
  ADD CONSTRAINT fk_by_batch
    FOREIGN KEY (batch_id) REFERENCES e2e.production_batches(id) ON DELETE CASCADE;

-- 4. Foreign keys — references to shared stamdata in public
ALTER TABLE e2e.customer_orders
  ADD CONSTRAINT fk_co_customer
    FOREIGN KEY (customer_id) REFERENCES public.customers(id);

ALTER TABLE e2e.order_lines
  ADD CONSTRAINT fk_ol_product
    FOREIGN KEY (product_id) REFERENCES public.products(id);

-- 5. Self-referencing FK on batch_yields (correction chain)
ALTER TABLE e2e.batch_yields
  ADD CONSTRAINT fk_by_corrects
    FOREIGN KEY (corrects_yield_id) REFERENCES e2e.batch_yields(id);

-- 6. updated_at triggers (reuse public.update_updated_at function)
CREATE TRIGGER trg_e2e_slaughter_updated
  BEFORE UPDATE ON e2e.slaughter_calendar
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_e2e_orders_updated
  BEFORE UPDATE ON e2e.customer_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_e2e_lines_updated
  BEFORE UPDATE ON e2e.order_lines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_e2e_batches_updated
  BEFORE UPDATE ON e2e.production_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 7. RLS — permissive policies on e2e tables only
ALTER TABLE e2e.slaughter_calendar  ENABLE ROW LEVEL SECURITY;
ALTER TABLE e2e.customer_orders     ENABLE ROW LEVEL SECURITY;
ALTER TABLE e2e.order_lines         ENABLE ROW LEVEL SECURITY;
ALTER TABLE e2e.production_batches  ENABLE ROW LEVEL SECURITY;
ALTER TABLE e2e.batch_yields        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "e2e_allow_all" ON e2e.slaughter_calendar  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "e2e_allow_all" ON e2e.customer_orders     FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "e2e_allow_all" ON e2e.order_lines         FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "e2e_allow_all" ON e2e.production_batches  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "e2e_allow_all" ON e2e.batch_yields        FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 8. Grant DML on all e2e tables
GRANT ALL ON ALL TABLES IN SCHEMA e2e TO anon, authenticated, service_role;
