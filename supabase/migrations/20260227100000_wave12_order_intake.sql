-- =============================================================================
-- Wave 12: Order Intake Module
-- Inbound message logging (OUT domain) + Order Intent workbench (IN domain)
-- =============================================================================
--
-- Architecture:
--   WhatsApp → Meta Cloud API Webhook → inbound_messages → classifier → order_intents
--
-- Domain separation:
--   OUT = inbound_messages (pure communication log, no business state)
--   IN  = order_intents   (operational workbench with status workflow)
--
-- Design principles:
--   • inbound_messages is a raw log — no workflow state, no business logic
--   • order_intents has a status workflow: new → parsed → needs_review → accepted → forwarded | rejected
--   • Forwarding is provider-adaptive (PA/Graph/manual fallback)
--   • Customer matching via customer_delivery_info (email/whatsapp_number)
--   • Classifier is deterministic (rule-based, no AI)
-- =============================================================================

-- =============================================================================
-- INBOUND_MESSAGES (OUT domain — communication log)
-- Raw inbound messages from all channels
-- =============================================================================

CREATE TABLE IF NOT EXISTS inbound_messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_channel    TEXT NOT NULL CHECK (source_channel IN ('whatsapp', 'email', 'edi', 'manual')),
  sender_identifier TEXT NOT NULL,          -- phone number (E.164) or email address
  customer_id       UUID REFERENCES customers(id) ON DELETE SET NULL,
  raw_text          TEXT NOT NULL DEFAULT '',
  raw_payload       JSONB,                  -- full webhook payload for audit
  CONSTRAINT inbound_messages_channel_check CHECK (source_channel <> '')
);

COMMENT ON TABLE inbound_messages IS 'Raw inbound messages from all channels (OUT domain — communication log only)';
COMMENT ON COLUMN inbound_messages.sender_identifier IS 'Phone number in E.164 format or email address';
COMMENT ON COLUMN inbound_messages.raw_payload IS 'Full webhook payload preserved for audit trail';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_inbound_messages_created_at ON inbound_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inbound_messages_customer_id ON inbound_messages (customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inbound_messages_channel ON inbound_messages (source_channel);

-- RLS
ALTER TABLE inbound_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read inbound_messages"
  ON inbound_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert inbound_messages"
  ON inbound_messages FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Anon role (for webhook API route — no browser auth context)
CREATE POLICY "anon_read_inbound_messages"
  ON inbound_messages FOR SELECT TO anon USING (true);
CREATE POLICY "anon_write_inbound_messages"
  ON inbound_messages FOR ALL TO anon USING (true) WITH CHECK (true);

-- Service role
CREATE POLICY "Service role full access on inbound_messages"
  ON inbound_messages FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================================================
-- ORDER_INTENTS (IN domain — operational workbench)
-- Detected order intents with parse suggestions and status workflow
-- =============================================================================

CREATE TABLE IF NOT EXISTS order_intents (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_channel          TEXT NOT NULL CHECK (source_channel IN ('whatsapp', 'email', 'edi', 'manual')),
  customer_id             UUID REFERENCES customers(id) ON DELETE SET NULL,
  raw_text                TEXT NOT NULL DEFAULT '',
  parse_suggestion_json   JSONB NOT NULL DEFAULT '{"lines": []}'::jsonb,
  confidence_score        NUMERIC(3,2) NOT NULL DEFAULT 0.00
                          CHECK (confidence_score >= 0 AND confidence_score <= 1),
  status                  TEXT NOT NULL DEFAULT 'new'
                          CHECK (status IN ('new', 'parsed', 'needs_review', 'accepted', 'forwarded', 'rejected')),
  linked_message_id       UUID REFERENCES inbound_messages(id) ON DELETE SET NULL,
  accepted_by             TEXT,
  accepted_at             TIMESTAMPTZ,
  forwarded_at            TIMESTAMPTZ,
  forwarded_email_subject TEXT,
  forwarded_email_body    TEXT,
  notes                   TEXT
);

COMMENT ON TABLE order_intents IS 'Order Intent workbench (IN domain) — detected possible orders with parse suggestions';
COMMENT ON COLUMN order_intents.parse_suggestion_json IS 'JSON: { lines: [{ sku_guess?, name_guess, qty, uom }] }';
COMMENT ON COLUMN order_intents.confidence_score IS 'Classifier confidence 0.00–1.00';
COMMENT ON COLUMN order_intents.status IS 'Workflow: new → parsed → needs_review → accepted → forwarded | rejected';
COMMENT ON COLUMN order_intents.linked_message_id IS 'FK to inbound_messages — links intent to source message';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_order_intents_status ON order_intents (status);
CREATE INDEX IF NOT EXISTS idx_order_intents_created_at ON order_intents (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_intents_customer_id ON order_intents (customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_intents_linked_message ON order_intents (linked_message_id) WHERE linked_message_id IS NOT NULL;

-- RLS
ALTER TABLE order_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read order_intents"
  ON order_intents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert order_intents"
  ON order_intents FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update order_intents"
  ON order_intents FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Anon role (for webhook API route — no browser auth context)
CREATE POLICY "anon_read_order_intents"
  ON order_intents FOR SELECT TO anon USING (true);
CREATE POLICY "anon_write_order_intents"
  ON order_intents FOR ALL TO anon USING (true) WITH CHECK (true);

-- Service role
CREATE POLICY "Service role full access on order_intents"
  ON order_intents FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
