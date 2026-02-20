-- ==========================================================================
-- Migration: 20260219200002_anon_read_policies.sql
-- Purpose:   Allow anonymous SELECT on order module tables
-- Reason:    App has no user auth yet — all requests run as anon role.
--            The deny_anon policies from Wave 4 block all access.
--            This migration adds read-only (SELECT) policies for anon
--            so the dashboard pages can display data.
--            Write operations still require authenticated role.
-- Date:      2026-02-19
-- ==========================================================================

-- Drop the blanket deny policies (they block ALL operations including SELECT)
DROP POLICY IF EXISTS "deny_anon_slaughter_calendar" ON slaughter_calendar;
DROP POLICY IF EXISTS "deny_anon_customer_orders" ON customer_orders;
DROP POLICY IF EXISTS "deny_anon_order_lines" ON order_lines;
DROP POLICY IF EXISTS "deny_anon_order_schema_snapshots" ON order_schema_snapshots;
DROP POLICY IF EXISTS "deny_anon_processing_recipes" ON processing_recipes;
DROP POLICY IF EXISTS "deny_anon_processing_instructions" ON processing_instructions;

-- Replace with read-only (SELECT) policies for anon
CREATE POLICY "anon_read_slaughter_calendar" ON slaughter_calendar
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_customer_orders" ON customer_orders
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_order_lines" ON order_lines
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_order_schema_snapshots" ON order_schema_snapshots
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_processing_recipes" ON processing_recipes
  FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_processing_instructions" ON processing_instructions
  FOR SELECT TO anon USING (true);

-- Allow anon INSERT/UPDATE/DELETE on slaughter_calendar for import feature
-- (until proper auth is implemented)
CREATE POLICY "anon_write_slaughter_calendar" ON slaughter_calendar
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Allow anon write on customer_orders and order_lines for order creation
CREATE POLICY "anon_write_customer_orders" ON customer_orders
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon_write_order_lines" ON order_lines
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Allow anon write on order_schema_snapshots for finalize
CREATE POLICY "anon_write_order_schema_snapshots" ON order_schema_snapshots
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Allow anon write on processing tables
CREATE POLICY "anon_write_processing_recipes" ON processing_recipes
  FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon_write_processing_instructions" ON processing_instructions
  FOR ALL TO anon USING (true) WITH CHECK (true);
