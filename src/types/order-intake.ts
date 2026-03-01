/**
 * Order Intake Module Types — Wave 12
 *
 * Domain separation:
 *   OUT = InboundMessage (communication log — no business state)
 *   IN  = OrderIntent    (operational workbench with status workflow)
 *
 * Classifier is deterministic (rule-based, no AI).
 * Forwarding is provider-adaptive (PA/Graph/manual fallback).
 */

// =============================================================================
// CHANNELS & STATUS
// =============================================================================

export type InboundChannel = 'whatsapp' | 'email' | 'edi' | 'manual';

export type OrderIntentStatus =
  | 'new'
  | 'parsed'
  | 'needs_review'
  | 'accepted'
  | 'forwarded'
  | 'rejected';

// =============================================================================
// INBOUND MESSAGES (OUT domain)
// =============================================================================

export interface InboundMessage {
  id: string;
  created_at: string;
  source_channel: InboundChannel;
  sender_identifier: string;
  customer_id: string | null;
  raw_text: string;
  raw_payload: Record<string, unknown> | null;
}

// =============================================================================
// ORDER INTENTS (IN domain)
// =============================================================================

export interface OrderIntentLine {
  sku_guess?: string;
  name_guess: string;
  qty: number;
  uom: string;
}

export interface ParseSuggestion {
  lines: OrderIntentLine[];
}

export interface OrderIntent {
  id: string;
  created_at: string;
  source_channel: InboundChannel;
  customer_id: string | null;
  raw_text: string;
  parse_suggestion_json: ParseSuggestion;
  confidence_score: number;
  status: OrderIntentStatus;
  linked_message_id: string | null;
  accepted_by: string | null;
  accepted_at: string | null;
  forwarded_at: string | null;
  forwarded_email_subject: string | null;
  forwarded_email_body: string | null;
  notes: string | null;
}

/** OrderIntent enriched with customer name for UI display */
export interface OrderIntentWithCustomer extends OrderIntent {
  customer_name: string | null;
  customer_code: string | null;
}

// =============================================================================
// CLASSIFIER TYPES
// =============================================================================

export interface ClassificationResult {
  lines: OrderIntentLine[];
  confidence: number;
}

// =============================================================================
// META CLOUD API WEBHOOK TYPES
// =============================================================================

/**
 * Meta Cloud API sends this structure to the webhook.
 * Ref: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components
 */
export interface MetaWebhookPayload {
  object: string; // always 'whatsapp_business_account'
  entry: MetaWebhookEntry[];
}

export interface MetaWebhookEntry {
  id: string; // WABA ID
  changes: MetaWebhookChange[];
}

export interface MetaWebhookChange {
  value: MetaWebhookValue;
  field: string; // 'messages'
}

export interface MetaWebhookValue {
  messaging_product: string; // 'whatsapp'
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: MetaWebhookContact[];
  messages?: MetaWebhookMessage[];
  statuses?: MetaWebhookStatus[];
}

export interface MetaWebhookContact {
  profile: { name: string };
  wa_id: string;
}

export interface MetaWebhookMessage {
  from: string;       // sender phone number
  id: string;         // message ID
  timestamp: string;  // unix timestamp
  type: string;       // 'text' | 'image' | 'document' | etc.
  text?: { body: string };
}

export interface MetaWebhookStatus {
  id: string;
  status: string; // 'sent' | 'delivered' | 'read' | 'failed'
  timestamp: string;
  recipient_id: string;
}

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

export interface InboundWebhookRequest {
  channel: InboundChannel;
  sender_identifier: string;
  text: string;
  payload?: Record<string, unknown>;
}
