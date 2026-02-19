-- ==========================================================================
-- Migration: 20260219200000_processing_tables.sql
-- Purpose:   OIL Order Module Phase 1 — Wave 4 Processing Tables
-- Sprint:    A0-S1b (Processing Schema)
-- Tables:    processing_recipes, processing_instructions
-- Author:    Claude Code Agent (Infra teammate)
-- Date:      2026-02-19
--
-- GOVERNANCE:
-- - processing_instructions is APPEND-ONLY (no UPDATE/DELETE)
-- - processing_recipes has updated_at trigger
-- ==========================================================================

-- --------------------------------------------------------------------------
-- 1. ENUM TYPE for processing instruction status
-- --------------------------------------------------------------------------

CREATE TYPE processing_instruction_status AS ENUM (
  'pending',
  'in_progress',
  'completed',
  'cancelled'
);

-- --------------------------------------------------------------------------
-- 2. processing_recipes — Verwerkingsrecepten per product
-- --------------------------------------------------------------------------

CREATE TABLE processing_recipes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id          uuid NOT NULL REFERENCES products(id),
  recipe_name         text NOT NULL,
  yield_percentage    numeric(8,4),
  instructions_json   jsonb,
  is_active           boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid,

  CONSTRAINT processing_recipes_yield_check CHECK (yield_percentage IS NULL OR (yield_percentage >= 0 AND yield_percentage <= 100))
);

-- Indexes
CREATE INDEX idx_processing_recipes_product ON processing_recipes(product_id);
CREATE INDEX idx_processing_recipes_active ON processing_recipes(is_active) WHERE is_active = true;

-- updated_at trigger
CREATE TRIGGER trg_processing_recipes_updated_at
  BEFORE UPDATE ON processing_recipes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- --------------------------------------------------------------------------
-- 3. processing_instructions — Gegenereerde verwerkingsinstructies
--    APPEND-ONLY: No UPDATE or DELETE allowed
-- --------------------------------------------------------------------------

CREATE TABLE processing_instructions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id         uuid NOT NULL REFERENCES order_schema_snapshots(id),
  recipe_id           uuid NOT NULL REFERENCES processing_recipes(id),
  instruction_data    jsonb NOT NULL,
  status              processing_instruction_status NOT NULL DEFAULT 'pending',
  generated_at        timestamptz NOT NULL DEFAULT now(),
  created_by          uuid

  -- NOTE: No updated_at — this table is APPEND-ONLY
);

-- Indexes
CREATE INDEX idx_processing_instructions_snapshot ON processing_instructions(snapshot_id);
CREATE INDEX idx_processing_instructions_recipe ON processing_instructions(recipe_id);
CREATE INDEX idx_processing_instructions_status ON processing_instructions(status);
