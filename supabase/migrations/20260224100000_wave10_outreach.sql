-- =============================================================================
-- Wave 10: Outreach Module
-- Automated customer outreach via WhatsApp (Twilio) + Email (Power Automate)
-- =============================================================================
--
-- Design principles:
--   • outreach_outbox + outreach_delivery_events are APPEND-ONLY (triggers enforced)
--   • Status truth lives in delivery_events (no dual truth with outbox)
--   • outreach_sends.status = pending | processed only (delivery = events ledger)
--   • Graph-ready: outreach_outbox has nullable graph_message_id / graph_sender_upn
--   • Idempotency:
--       UNIQUE (campaign_id, customer_id, channel) on outreach_sends
--       UNIQUE (send_id) on outreach_outbox
--       UNIQUE (week_key) on outreach_campaigns (safe cron re-runs)
--   • event_type lifecycle: queued → processing → sent | failed
--       'bounced' reserved for future PA/Graph webhook integration
--   • Inline images: body_html must use PUBLIC Supabase Storage URLs
--       ✗ .../object/sign/...?token=...  (expires — breaks after hours/days)
--       ✓ .../object/public/outreach/... (permanent — use this)
--       Enforced as soft warning in application layer, not DB constraint
--   • Rate limit: MAX N sends per process-queue run (default 10)
--       Controlled via env OUTREACH_MAX_SENDS_PER_RUN in application layer
-- =============================================================================

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE outreach_channel AS ENUM ('whatsapp', 'email', 'both');
CREATE TYPE outreach_message_type AS ENUM ('uitvraag', 'actie');
CREATE TYPE outreach_campaign_status AS ENUM ('draft', 'scheduled', 'sending', 'sent', 'failed');
CREATE TYPE outreach_send_status AS ENUM ('pending', 'processed');
-- Lifecycle: queued → processing → sent | failed ('bounced' reserved for future use)
CREATE TYPE outreach_event_type AS ENUM ('queued', 'processing', 'sent', 'failed', 'bounced');
CREATE TYPE outreach_queue_status AS ENUM ('pending', 'sent', 'cancelled');

-- =============================================================================
-- EXTEND customer_delivery_info (Wave 8)
-- Add contact channels for outreach targeting
-- =============================================================================

ALTER TABLE customer_delivery_info
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_number TEXT; -- E.164 format: +31612345678

COMMENT ON COLUMN customer_delivery_info.email IS
  'Primary outreach email address for this customer';
COMMENT ON COLUMN customer_delivery_info.whatsapp_number IS
  'WhatsApp number in E.164 format (e.g. +31612345678). Used for Twilio outreach.';

-- =============================================================================
-- OUTREACH_TEMPLATES
-- Message templates for WhatsApp and/or email outreach
-- =============================================================================

CREATE TABLE IF NOT EXISTS outreach_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  channel       outreach_channel NOT NULL,
  message_type  outreach_message_type NOT NULL DEFAULT 'uitvraag',
  subject       TEXT,           -- Email subject line (required for email/both channels)
  body_html     TEXT,           -- Email body: HTML with inline <img src="PUBLIC-url">
  body_text     TEXT,           -- WhatsApp body: plain text, supports {{klant_naam}} etc.
  -- NOTE: body_html image URLs must be publicly accessible (no signed/expiring URLs)
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Cannot be active with no content
  CONSTRAINT chk_template_has_content CHECK (
    body_html IS NOT NULL OR body_text IS NOT NULL
  ),
  -- Email/both templates require a subject line
  CONSTRAINT chk_email_template_has_subject CHECK (
    channel = 'whatsapp' OR subject IS NOT NULL
  )
);

ALTER TABLE outreach_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_outreach_templates"
  ON outreach_templates FOR SELECT TO anon USING (true);
CREATE POLICY "anon_write_outreach_templates"
  ON outreach_templates FOR ALL TO anon USING (true) WITH CHECK (true);

-- =============================================================================
-- OUTREACH_CAMPAIGNS
-- week_key enforces idempotent Monday cron: one auto-campaign per week per channel
-- week_key format: 'IYYY-IW-channel' e.g. '2026-09-whatsapp'
-- Manual campaigns may omit week_key (NULL allowed, UNIQUE only on non-null)
-- =============================================================================

CREATE TABLE IF NOT EXISTS outreach_campaigns (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  channel       outreach_channel NOT NULL,
  scheduled_at  TIMESTAMPTZ,
  status        outreach_campaign_status NOT NULL DEFAULT 'draft',
  -- Idempotency key for cron-created campaigns (format: IYYY-IW-channel)
  week_key      TEXT UNIQUE,    -- NULL for manually created campaigns
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE outreach_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_outreach_campaigns"
  ON outreach_campaigns FOR SELECT TO anon USING (true);
CREATE POLICY "anon_write_outreach_campaigns"
  ON outreach_campaigns FOR ALL TO anon USING (true) WITH CHECK (true);

-- =============================================================================
-- OUTREACH_CAMPAIGN_TEMPLATES (join table)
-- Many-to-many: campaign uses a pool of templates (rotation selection)
-- =============================================================================

CREATE TABLE IF NOT EXISTS outreach_campaign_templates (
  campaign_id   UUID NOT NULL REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
  template_id   UUID NOT NULL REFERENCES outreach_templates(id) ON DELETE RESTRICT,
  sort_order    INT NOT NULL DEFAULT 0,
  PRIMARY KEY (campaign_id, template_id)
);

ALTER TABLE outreach_campaign_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_campaign_templates"
  ON outreach_campaign_templates FOR SELECT TO anon USING (true);
CREATE POLICY "anon_write_campaign_templates"
  ON outreach_campaign_templates FOR ALL TO anon USING (true) WITH CHECK (true);

-- =============================================================================
-- OUTREACH_SENDS
-- One row per (campaign × customer × channel)
-- status: pending = created/queued; processed = dispatched to Twilio/outbox
-- Delivery truth is in outreach_delivery_events — NOT duplicated here
-- send_after: randomized window (08:00–10:00) set by cron handler
-- =============================================================================

CREATE TABLE IF NOT EXISTS outreach_sends (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   UUID NOT NULL REFERENCES outreach_campaigns(id),
  customer_id   UUID NOT NULL REFERENCES customers(id),
  -- channel must be a single channel at send level (not 'both')
  channel       TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email')),
  template_id   UUID NOT NULL REFERENCES outreach_templates(id),
  rendered_body TEXT NOT NULL,  -- Final rendered message (frozen at creation time)
  send_after    TIMESTAMPTZ NOT NULL DEFAULT now(), -- Randomized: 08:00 + 0-120 min
  status        outreach_send_status NOT NULL DEFAULT 'pending',
  processed_at  TIMESTAMPTZ,   -- When status moved to 'processed'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Idempotency: one send per campaign × customer × channel
  CONSTRAINT uq_send_per_campaign_customer_channel
    UNIQUE (campaign_id, customer_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_outreach_sends_pending
  ON outreach_sends (send_after, status)
  WHERE status = 'pending';

ALTER TABLE outreach_sends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_outreach_sends"
  ON outreach_sends FOR SELECT TO anon USING (true);
CREATE POLICY "anon_write_outreach_sends"
  ON outreach_sends FOR ALL TO anon USING (true) WITH CHECK (true);

-- =============================================================================
-- OUTREACH_OUTBOX (APPEND-ONLY)
-- Email send queue consumed by Power Automate (HTTP trigger)
-- Graph-ready: graph_message_id + graph_sender_upn nullable for future upgrade
-- Status NOT stored here — always derived from outreach_delivery_events
-- UNIQUE (send_id): prevents duplicate outbox entries per send
-- =============================================================================

CREATE TABLE IF NOT EXISTS outreach_outbox (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  send_id           UUID NOT NULL,
  to_email          TEXT NOT NULL,
  from_name         TEXT NOT NULL DEFAULT 'Oranjehoen',
  subject           TEXT NOT NULL,
  body_html         TEXT NOT NULL,
  -- Graph-ready fields (NULL when using Power Automate; populated when using Graph API)
  graph_message_id  TEXT,
  graph_sender_upn  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Idempotency: one outbox entry per send
  CONSTRAINT uq_outbox_send_id UNIQUE (send_id),
  CONSTRAINT fk_outbox_send
    FOREIGN KEY (send_id) REFERENCES outreach_sends(id) ON DELETE RESTRICT
);

-- RLS: SELECT + INSERT only (no UPDATE/DELETE policy — append-only by design)
ALTER TABLE outreach_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_outreach_outbox"
  ON outreach_outbox FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_outreach_outbox"
  ON outreach_outbox FOR INSERT TO anon WITH CHECK (true);

-- =============================================================================
-- OUTREACH_DELIVERY_EVENTS (APPEND-ONLY LEDGER)
-- Replaces a status column on outreach_outbox (no dual truth, no UPDATE on outbox)
--
-- Lifecycle (per outbox_id):
--   queued     → inserted when outreach_outbox row is created
--   processing → inserted when process-queue picks up the send
--   sent       → inserted via PA email-ack callback (success)
--   failed     → inserted via PA email-ack callback (error)
--   bounced    → RESERVED for future PA/Graph bounce webhook
--
-- Derive current status:
--   SELECT event_type FROM outreach_delivery_events
--   WHERE outbox_id = ? ORDER BY created_at DESC LIMIT 1
--
-- payload JSONB examples:
--   { "pa_run_id": "...", "outlook_message_id": "..." }      (sent)
--   { "error": "...", "pa_run_id": "..." }                   (failed)
--   { "graph_message_id": "...", "graph_sender_upn": "..." } (Graph upgrade)
-- =============================================================================

CREATE TABLE IF NOT EXISTS outreach_delivery_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outbox_id   UUID NOT NULL REFERENCES outreach_outbox(id) ON DELETE RESTRICT,
  event_type  outreach_event_type NOT NULL,
  payload     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_delivery_events_outbox_latest
  ON outreach_delivery_events (outbox_id, created_at DESC);

-- RLS: SELECT + INSERT only
ALTER TABLE outreach_delivery_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_delivery_events"
  ON outreach_delivery_events FOR SELECT TO anon USING (true);
CREATE POLICY "anon_insert_delivery_events"
  ON outreach_delivery_events FOR INSERT TO anon WITH CHECK (true);

-- =============================================================================
-- OUTREACH_RESPONSE_QUEUE
-- Delayed WhatsApp response queue (30-60 min delay for human feel)
-- process-queue: picks up rows where send_after <= now() AND status = 'pending'
-- =============================================================================

CREATE TABLE IF NOT EXISTS outreach_response_queue (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   UUID NOT NULL REFERENCES customers(id),
  channel       outreach_channel NOT NULL DEFAULT 'whatsapp',
  message_text  TEXT NOT NULL,
  send_after    TIMESTAMPTZ NOT NULL,  -- now() + random(30, 60) minutes
  status        outreach_queue_status NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_response_queue_pending
  ON outreach_response_queue (send_after, status)
  WHERE status = 'pending';

ALTER TABLE outreach_response_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read_response_queue"
  ON outreach_response_queue FOR SELECT TO anon USING (true);
CREATE POLICY "anon_write_response_queue"
  ON outreach_response_queue FOR ALL TO anon USING (true) WITH CHECK (true);

-- =============================================================================
-- APPEND-ONLY ENFORCEMENT
-- Prevents UPDATE and DELETE on outreach_outbox and outreach_delivery_events
-- Both tables must remain immutable after insert (audit + delivery truth)
-- =============================================================================

CREATE OR REPLACE FUNCTION _prevent_outbox_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'outreach_outbox is append-only. Row % cannot be updated or deleted. '
    'Use outreach_delivery_events to record delivery status changes.',
    OLD.id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION _prevent_delivery_events_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'outreach_delivery_events is append-only. Row % cannot be updated or deleted. '
    'Insert a new event row to record state changes.',
    OLD.id;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_outbox_no_update
  BEFORE UPDATE ON outreach_outbox
  FOR EACH ROW EXECUTE FUNCTION _prevent_outbox_mutation();

CREATE TRIGGER trg_outbox_no_delete
  BEFORE DELETE ON outreach_outbox
  FOR EACH ROW EXECUTE FUNCTION _prevent_outbox_mutation();

CREATE TRIGGER trg_delivery_events_no_update
  BEFORE UPDATE ON outreach_delivery_events
  FOR EACH ROW EXECUTE FUNCTION _prevent_delivery_events_mutation();

CREATE TRIGGER trg_delivery_events_no_delete
  BEFORE DELETE ON outreach_delivery_events
  FOR EACH ROW EXECUTE FUNCTION _prevent_delivery_events_mutation();
