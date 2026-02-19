-- ==========================================================================
-- Migration: 20260219200001_rls_policies.sql
-- Purpose:   OIL Order Module Phase 1 — Row Level Security Scaffolding
-- Sprint:    A6-S2 (RLS Scaffolding)
-- Author:    Claude Code Agent (Security teammate)
-- Date:      2026-02-19
--
-- GOVERNANCE:
-- - Phase 1 policy: allow all for authenticated, deny for anon
-- - Enables RLS on all order module + processing tables
-- - Future phases will add granular per-customer policies
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. Enable RLS on order module tables
-- --------------------------------------------------------------------------

ALTER TABLE customer_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_schema_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE slaughter_calendar ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- 2. Enable RLS on processing tables (Wave 4)
-- --------------------------------------------------------------------------

ALTER TABLE processing_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_instructions ENABLE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------
-- 3. Phase 1 policies: authenticated users get full access
--    NOTE: These are scaffolding policies. Future phases will add
--    granular per-customer/per-role policies.
-- --------------------------------------------------------------------------

-- customer_orders
CREATE POLICY "authenticated_all_customer_orders" ON customer_orders
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- order_lines
CREATE POLICY "authenticated_all_order_lines" ON order_lines
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- order_schema_snapshots (append-only enforced at application layer)
CREATE POLICY "authenticated_all_order_schema_snapshots" ON order_schema_snapshots
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- slaughter_calendar
CREATE POLICY "authenticated_all_slaughter_calendar" ON slaughter_calendar
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- processing_recipes
CREATE POLICY "authenticated_all_processing_recipes" ON processing_recipes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- processing_instructions (append-only enforced at application layer)
CREATE POLICY "authenticated_all_processing_instructions" ON processing_instructions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- --------------------------------------------------------------------------
-- 4. Deny anonymous access explicitly
-- --------------------------------------------------------------------------

-- customer_orders
CREATE POLICY "deny_anon_customer_orders" ON customer_orders
  FOR ALL TO anon USING (false);

-- order_lines
CREATE POLICY "deny_anon_order_lines" ON order_lines
  FOR ALL TO anon USING (false);

-- order_schema_snapshots
CREATE POLICY "deny_anon_order_schema_snapshots" ON order_schema_snapshots
  FOR ALL TO anon USING (false);

-- slaughter_calendar
CREATE POLICY "deny_anon_slaughter_calendar" ON slaughter_calendar
  FOR ALL TO anon USING (false);

-- processing_recipes
CREATE POLICY "deny_anon_processing_recipes" ON processing_recipes
  FOR ALL TO anon USING (false);

-- processing_instructions
CREATE POLICY "deny_anon_processing_instructions" ON processing_instructions
  FOR ALL TO anon USING (false);
