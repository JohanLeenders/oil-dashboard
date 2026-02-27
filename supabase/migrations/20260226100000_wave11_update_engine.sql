-- =============================================================================
-- Wave 11: Update Engine — Outreach content creation layer
-- Extends Wave 10 outreach module with structured content editing, drafts,
-- team tracking, and performance overview.
--
-- Design principles:
--   • outreach_templates extended (nullable columns) — old templates untouched
--   • outreach_updates = the core content entity (draft → ready → sending → sent)
--   • outreach_update_recipients = per-customer targeting (links to sends on dispatch)
--   • No versioning table in MVP — versions come later
--   • Team tracking via simple text fields (no auth) — created_by, modified_by, sent_by
--   • Basic locking via locked_by + locked_at (auto-expire in app layer)
-- =============================================================================

-- =============================================================================
-- EXTEND outreach_templates (Wave 10) — ADD structured template support
-- Existing templates continue to work; new columns are nullable
-- =============================================================================

ALTER TABLE outreach_templates
  ADD COLUMN IF NOT EXISTS template_type TEXT,          -- 'wekelijkse_update' | 'batch_spotlight' | 'persoonlijke_followup'
  ADD COLUMN IF NOT EXISTS block_schema  JSONB,         -- Defines allowed blocks + structure for this template type
  ADD COLUMN IF NOT EXISTS default_content JSONB;       -- Tiptap JSON: starting content when creating an update from this template

COMMENT ON COLUMN outreach_templates.template_type IS
  'Structured template type. NULL = legacy Wave 10 template (body_html/body_text only).';
COMMENT ON COLUMN outreach_templates.block_schema IS
  'JSON schema defining which editor blocks are allowed/required. NULL = unrestricted.';
COMMENT ON COLUMN outreach_templates.default_content IS
  'Tiptap JSON document used as starting content for new updates. NULL = empty editor.';

-- =============================================================================
-- OUTREACH_UPDATES — Core content entity
-- An "update" is a composed message written in the Tiptap editor
-- =============================================================================

CREATE TABLE IF NOT EXISTS outreach_updates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     UUID REFERENCES outreach_templates(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,                -- Internal reference title
  content         JSONB NOT NULL DEFAULT '{}',  -- Tiptap JSON document
  rendered_html   TEXT,                         -- Cached: Tiptap → HTML (for email)
  rendered_text   TEXT,                         -- Cached: Tiptap → plain text (for WhatsApp)
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'ready', 'sending', 'sent')),
  target_type     TEXT NOT NULL DEFAULT 'bulk'
                  CHECK (target_type IN ('bulk', 'personal')),
  -- Optional: target customer for personal updates
  target_customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  -- Campaign link (set on dispatch — connects to existing send pipeline)
  campaign_id     UUID REFERENCES outreach_campaigns(id) ON DELETE SET NULL,
  -- Sent timestamp
  sent_at         TIMESTAMPTZ,
  -- Team tracking (simple text, no auth)
  created_by      TEXT,
  modified_by     TEXT,
  sent_by         TEXT,
  -- Basic locking (app layer: auto-expire after 10 min)
  locked_by       TEXT,
  locked_at       TIMESTAMPTZ,
  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_updates_status
  ON outreach_updates (status);

ALTER TABLE outreach_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_outreach_updates"
  ON outreach_updates FOR SELECT TO anon USING (true);
CREATE POLICY "anon_write_outreach_updates"
  ON outreach_updates FOR ALL TO anon USING (true) WITH CHECK (true);

COMMENT ON TABLE outreach_updates IS
  'Wave 11: Composed content pieces written in the Tiptap editor. The core entity of the Update Engine.';

-- =============================================================================
-- OUTREACH_UPDATE_RECIPIENTS — Per-customer targeting
-- Links an update to specific customers; after dispatch links to outreach_sends
-- =============================================================================

CREATE TABLE IF NOT EXISTS outreach_update_recipients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  update_id       UUID NOT NULL REFERENCES outreach_updates(id) ON DELETE CASCADE,
  customer_id     UUID NOT NULL REFERENCES customers(id),
  channel         TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  -- Linked after dispatch (nullable until sent)
  send_id         UUID REFERENCES outreach_sends(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One entry per customer per channel per update
  CONSTRAINT uq_update_recipient UNIQUE (update_id, customer_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_update_recipients_update
  ON outreach_update_recipients (update_id);

ALTER TABLE outreach_update_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_update_recipients"
  ON outreach_update_recipients FOR SELECT TO anon USING (true);
CREATE POLICY "anon_write_update_recipients"
  ON outreach_update_recipients FOR ALL TO anon USING (true) WITH CHECK (true);

COMMENT ON TABLE outreach_update_recipients IS
  'Wave 11: Per-customer targeting for updates. Links to outreach_sends after dispatch.';

-- =============================================================================
-- PERFORMANCE VIEW — Aggregate delivery stats per update
-- =============================================================================

CREATE OR REPLACE VIEW v_outreach_update_stats AS
SELECT
  u.id AS update_id,
  u.title,
  u.status,
  u.created_by,
  u.sent_by,
  u.created_at,
  COUNT(DISTINCT r.id) AS recipient_count,
  COUNT(DISTINCT r.send_id) AS dispatched_count,
  COUNT(DISTINCT CASE WHEN de.event_type = 'sent' THEN r.id END) AS delivered_count,
  COUNT(DISTINCT CASE WHEN de.event_type = 'failed' THEN r.id END) AS failed_count
FROM outreach_updates u
LEFT JOIN outreach_update_recipients r ON r.update_id = u.id
LEFT JOIN outreach_sends s ON s.id = r.send_id
LEFT JOIN outreach_outbox ob ON ob.send_id = s.id
LEFT JOIN LATERAL (
  SELECT event_type
  FROM outreach_delivery_events
  WHERE outbox_id = ob.id
  ORDER BY created_at DESC
  LIMIT 1
) de ON true
GROUP BY u.id, u.title, u.status, u.created_by, u.sent_by, u.created_at;

COMMENT ON VIEW v_outreach_update_stats IS
  'Wave 11: Aggregate delivery statistics per outreach update.';
