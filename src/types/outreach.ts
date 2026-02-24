/**
 * Outreach Module Types — Wave 10
 *
 * Design notes:
 * - outreach_sends.status: 'pending' | 'processed' only (no delivery state here)
 * - Delivery state derived from outreach_delivery_events (latest event per outbox_id)
 * - Graph-ready: OutreachOutbox has nullable graph_message_id / graph_sender_upn
 * - week_key format: 'IYYY-IW-channel' e.g. '2026-09-whatsapp' (idempotent cron)
 */

// =============================================================================
// ENUMS
// =============================================================================

export type OutreachChannel = 'whatsapp' | 'email' | 'both';

/** At send level, channel is always a single value (not 'both') */
export type OutreachSendChannel = 'whatsapp' | 'email';

export type OutreachMessageType = 'uitvraag' | 'actie';

export type OutreachCampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'sending'
  | 'sent'
  | 'failed';

/** Dispatch status only — delivery truth lives in OutreachDeliveryEvent */
export type OutreachSendStatus = 'pending' | 'processed';

/**
 * Delivery event lifecycle:
 *   queued → processing → sent | failed
 *   'bounced' reserved for future PA/Graph bounce webhook integration
 */
export type OutreachEventType =
  | 'queued'
  | 'processing'
  | 'sent'
  | 'failed'
  | 'bounced';

export type OutreachQueueStatus = 'pending' | 'sent' | 'cancelled';

// =============================================================================
// TABLE INTERFACES
// =============================================================================

export interface OutreachTemplate {
  id: string;
  name: string;
  channel: OutreachChannel;
  message_type: OutreachMessageType;
  subject: string | null;      // Required for email/both; null for whatsapp-only
  body_html: string | null;    // Email HTML — images must use PUBLIC storage URLs
  body_text: string | null;    // WhatsApp plain text — supports {{klant_naam}} etc.
  is_active: boolean;
  created_at: string;
}

export interface OutreachCampaign {
  id: string;
  name: string;
  channel: OutreachChannel;
  scheduled_at: string | null;
  status: OutreachCampaignStatus;
  /** Idempotency key for cron-created campaigns: 'IYYY-IW-channel' | null for manual */
  week_key: string | null;
  created_at: string;
}

export interface OutreachCampaignTemplate {
  campaign_id: string;
  template_id: string;
  sort_order: number;
}

export interface OutreachSend {
  id: string;
  campaign_id: string;
  customer_id: string;
  channel: OutreachSendChannel;
  template_id: string;
  rendered_body: string;         // Final rendered message — frozen at creation time
  send_after: string;            // Randomized: Monday 08:00 + 0–120 min
  status: OutreachSendStatus;    // pending = not yet dispatched; processed = dispatched
  processed_at: string | null;
  created_at: string;
}

/**
 * Email outbox — APPEND-ONLY
 * No status column — derive from outreach_delivery_events
 * Graph-ready: graph_message_id + graph_sender_upn populated when Graph API is used
 */
export interface OutreachOutbox {
  id: string;
  send_id: string;              // FK to outreach_sends (UNIQUE)
  to_email: string;
  from_name: string;
  subject: string;
  body_html: string;
  graph_message_id: string | null;  // Graph API: populated on send via Graph
  graph_sender_upn: string | null;  // Graph API: sender UPN (e.g. user@oranjehoen.nl)
  created_at: string;
  // NOTE: no status field — current status = latest OutreachDeliveryEvent.event_type
}

/**
 * Delivery events ledger — APPEND-ONLY
 * Replaces status column on outreach_outbox (no dual truth, no UPDATE on outbox)
 *
 * payload examples:
 *   sent:    { pa_run_id: "...", outlook_message_id: "..." }
 *   failed:  { error: "...", pa_run_id: "..." }
 *   Graph:   { graph_message_id: "...", graph_sender_upn: "..." }
 */
export interface OutreachDeliveryEvent {
  id: string;
  outbox_id: string;
  event_type: OutreachEventType;
  payload: Record<string, unknown> | null;
  created_at: string;
}

export interface OutreachResponseQueue {
  id: string;
  customer_id: string;
  channel: OutreachChannel;
  message_text: string;
  send_after: string;           // now() + random(30, 60) minutes
  status: OutreachQueueStatus;
  created_at: string;
}

// =============================================================================
// DOMAIN / APPLICATION TYPES
// =============================================================================

/** Template variables available in body_text / body_html */
export interface OutreachTemplateVars {
  klant_naam: string;           // Customer name
  klant_code: string;           // Customer code
  week_nummer: string;          // ISO week number e.g. '09'
  product_aanbieding?: string;  // Optional: promoted product for 'actie' type
}

/** Derived delivery status — computed from latest delivery event */
export interface OutreachSendWithStatus extends OutreachSend {
  outbox: OutreachOutbox | null;
  latest_event: OutreachDeliveryEvent | null;
  /** Convenience: latest_event?.event_type ?? 'pending' */
  delivery_status: OutreachEventType | 'pending';
}

/** Campaign with its template pool */
export interface OutreachCampaignWithTemplates extends OutreachCampaign {
  templates: OutreachTemplate[];
  send_count: number;
  processed_count: number;
}

// =============================================================================
// POWER AUTOMATE INTEGRATION TYPES
// =============================================================================

/**
 * Payload sent to Power Automate HTTP trigger
 * PA reads this, sends email via Outlook connector, then POSTs back to email-ack
 */
export interface PATriggerPayload {
  outbox_id: string;
  send_id: string;
  to_email: string;
  from_name: string;
  subject: string;
  body_html: string;
}

/**
 * Callback payload sent by Power Automate to /api/outreach/email-ack
 * Results in INSERT to outreach_delivery_events (NEVER UPDATE on outbox)
 */
export interface PACallbackPayload {
  outbox_id: string;
  event_type: 'sent' | 'failed';
  payload: {
    pa_run_id?: string;
    outlook_message_id?: string;
    error?: string;
  };
}

// =============================================================================
// SCHEDULING TYPES
// =============================================================================

/** Config for the process-queue rate limiter */
export interface OutreachQueueConfig {
  /** Max sends processed per cron invocation. Env: OUTREACH_MAX_SENDS_PER_RUN (default 10) */
  maxSendsPerRun: number;
  /** Send window start offset from 08:00 in minutes (default 0) */
  sendWindowStartMinutes: number;
  /** Send window end offset from 08:00 in minutes (default 120 = 10:00) */
  sendWindowEndMinutes: number;
}

/** Result returned by the cron handler */
export interface OutreachCronResult {
  week_key: string;
  campaign_id: string | null;
  /** 'created' if new campaign; 'skipped' if week_key already exists */
  campaign_action: 'created' | 'skipped';
  sends_created: number;
  sends_skipped_duplicate: number;
}
