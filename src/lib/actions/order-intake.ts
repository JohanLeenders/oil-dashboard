'use server';

/**
 * Order Intake Server Actions — Wave 12
 *
 * Domain separation:
 *   OUT = inbound_messages (raw log only)
 *   IN  = order_intents   (operational workbench)
 */

import { createClient } from '@/lib/supabase/server';
import { classifyInboundMessage } from '@/lib/engine/order-intake/classifier';
import { formatForwardEmail, type ForwardEmailOutput } from '@/lib/engine/order-intake/formatForwardEmail';
import type {
  OrderIntent,
  OrderIntentWithCustomer,
  OrderIntentStatus,
  InboundChannel,
  ParseSuggestion,
  InboundMessage,
} from '@/types/order-intake';

// =============================================================================
// ORDER INTENTS — READ
// =============================================================================

export interface IntentFilters {
  status?: OrderIntentStatus | OrderIntentStatus[];
  channel?: InboundChannel;
}

/**
 * Get all order intents, optionally filtered by status/channel.
 * Joins customer name for display.
 */
export async function getOrderIntents(
  filters?: IntentFilters
): Promise<OrderIntentWithCustomer[]> {
  const supabase = await createClient();

  let query = supabase
    .from('order_intents')
    .select('*, customers(name, customer_code)')
    .order('created_at', { ascending: false });

  if (filters?.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    query = query.in('status', statuses);
  }

  if (filters?.channel) {
    query = query.eq('source_channel', filters.channel);
  }

  const { data, error } = await query;
  if (error) throw new Error(`getOrderIntents failed: ${error.message}`);

  return (data ?? []).map((row) => {
    const customer = row.customers as { name: string; customer_code: string } | null;
    return {
      ...row,
      customers: undefined,
      customer_name: customer?.name ?? null,
      customer_code: customer?.customer_code ?? null,
    } as OrderIntentWithCustomer;
  });
}

/**
 * Get a single order intent by ID with linked inbound message.
 */
export async function getOrderIntent(
  id: string
): Promise<{ intent: OrderIntentWithCustomer; message: InboundMessage | null }> {
  const supabase = await createClient();

  const { data: intent, error } = await supabase
    .from('order_intents')
    .select('*, customers(name, customer_code)')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`getOrderIntent failed: ${error.message}`);
  if (!intent) throw new Error('Order intent not found');

  const customer = intent.customers as { name: string; customer_code: string } | null;
  const enriched: OrderIntentWithCustomer = {
    ...intent,
    customers: undefined,
    customer_name: customer?.name ?? null,
    customer_code: customer?.customer_code ?? null,
  } as OrderIntentWithCustomer;

  // Fetch linked inbound message if exists
  let message: InboundMessage | null = null;
  if (intent.linked_message_id) {
    const { data: msgData } = await supabase
      .from('inbound_messages')
      .select('*')
      .eq('id', intent.linked_message_id)
      .maybeSingle();
    message = msgData as InboundMessage | null;
  }

  return { intent: enriched, message };
}

// =============================================================================
// INBOUND MESSAGE — CREATE + PROCESS
// =============================================================================

export interface CreateInboundInput {
  source_channel: InboundChannel;
  sender_identifier: string;
  raw_text: string;
  customer_id?: string | null;
  raw_payload?: Record<string, unknown> | null;
}

/**
 * Create an inbound message record (OUT domain — raw log).
 * Returns the created message ID.
 */
export async function createInboundMessage(
  input: CreateInboundInput
): Promise<string> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('inbound_messages')
    .insert({
      source_channel: input.source_channel,
      sender_identifier: input.sender_identifier,
      raw_text: input.raw_text,
      customer_id: input.customer_id ?? null,
      raw_payload: input.raw_payload ?? null,
    })
    .select('id')
    .single();

  if (error) throw new Error(`createInboundMessage failed: ${error.message}`);
  return data.id as string;
}

/**
 * Run classifier on an inbound message and create an order intent if match.
 * Returns the order intent ID if created, null if no match.
 */
export async function processInboundMessage(
  messageId: string
): Promise<string | null> {
  const supabase = await createClient();

  // Fetch the inbound message
  const { data: msg, error: fetchErr } = await supabase
    .from('inbound_messages')
    .select('*')
    .eq('id', messageId)
    .maybeSingle();

  if (fetchErr) throw new Error(`processInboundMessage: fetch failed: ${fetchErr.message}`);
  if (!msg) throw new Error(`processInboundMessage: message ${messageId} not found`);

  const message = msg as InboundMessage;

  // Run classifier
  const classification = classifyInboundMessage(message.raw_text);

  // No match → message stays in OUT only
  if (!classification) return null;

  // Match → create order intent in IN domain
  const { data: intent, error: insertErr } = await supabase
    .from('order_intents')
    .insert({
      source_channel: message.source_channel,
      customer_id: message.customer_id,
      raw_text: message.raw_text,
      parse_suggestion_json: { lines: classification.lines },
      confidence_score: classification.confidence,
      status: 'new' as const,
      linked_message_id: message.id,
    })
    .select('id')
    .single();

  if (insertErr) throw new Error(`processInboundMessage: insert failed: ${insertErr.message}`);
  return intent.id as string;
}

// =============================================================================
// ORDER INTENTS — UPDATE
// =============================================================================

/**
 * Update parse suggestion on an order intent (manual edit by user).
 */
export async function updateIntentParseSuggestion(
  id: string,
  suggestion: ParseSuggestion
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('order_intents')
    .update({
      parse_suggestion_json: suggestion,
      status: 'needs_review' as const,
    })
    .eq('id', id);

  if (error) throw new Error(`updateIntentParseSuggestion failed: ${error.message}`);
}

/**
 * Mark an intent as rejected (not an order).
 */
export async function rejectIntent(id: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('order_intents')
    .update({ status: 'rejected' as const })
    .eq('id', id);

  if (error) throw new Error(`rejectIntent failed: ${error.message}`);
}

/**
 * Accept an intent. Sets status to 'accepted'.
 * Does NOT forward — use acceptAndForwardIntent for that.
 */
export async function acceptIntent(
  id: string,
  acceptedBy: string
): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('order_intents')
    .update({
      status: 'accepted' as const,
      accepted_by: acceptedBy,
      accepted_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw new Error(`acceptIntent failed: ${error.message}`);
}

/**
 * Accept and attempt to forward an intent via PA webhook.
 *
 * Provider-adaptive:
 *   - If ORDER_FORWARD_PA_URL is set → POST to PA webhook, status = 'forwarded'
 *   - If not → status stays 'accepted', returns email content for manual fallback
 *
 * Only sets 'forwarded' when actual send succeeds.
 */
export async function acceptAndForwardIntent(
  id: string,
  acceptedBy: string
): Promise<{ forwarded: boolean; email: ForwardEmailOutput }> {
  const supabase = await createClient();

  // 1. Fetch intent with customer
  const { data: intentRow, error: fetchErr } = await supabase
    .from('order_intents')
    .select('*, customers(name, customer_code)')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr) throw new Error(`acceptAndForwardIntent: fetch failed: ${fetchErr.message}`);
  if (!intentRow) throw new Error('Order intent not found');

  const customer = intentRow.customers as { name: string; customer_code: string } | null;
  const intent = intentRow as OrderIntent;
  const parsedLines = (intent.parse_suggestion_json as ParseSuggestion)?.lines ?? [];

  // 2. Format email
  const email = formatForwardEmail({
    customerName: customer?.name ?? null,
    customerCode: customer?.customer_code ?? null,
    sourceChannel: intent.source_channel,
    rawText: intent.raw_text,
    lines: parsedLines,
    intentDate: intent.created_at,
    confidenceScore: intent.confidence_score,
  });

  // 3. Accept first
  const now = new Date().toISOString();
  const { error: acceptErr } = await supabase
    .from('order_intents')
    .update({
      status: 'accepted' as const,
      accepted_by: acceptedBy,
      accepted_at: now,
    })
    .eq('id', id);

  if (acceptErr) throw new Error(`acceptAndForwardIntent: accept failed: ${acceptErr.message}`);

  // 4. Try PA webhook
  const paUrl = process.env.ORDER_FORWARD_PA_URL;
  const toEmail = process.env.ORDER_FORWARD_EMAIL ?? 'bestellingen@oranjehoen.nl';

  if (!paUrl) {
    // No provider configured → manual fallback (status stays 'accepted')
    return { forwarded: false, email };
  }

  try {
    const res = await fetch(paUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to_email: toEmail,
        subject: email.subject,
        body_html: email.bodyHtml,
        intent_id: id,
      }),
    });

    if (!res.ok) {
      console.error(`[order-intake] PA forward failed: HTTP ${res.status}`);
      // Status stays 'accepted' — don't mark as forwarded on failure
      return { forwarded: false, email };
    }

    // Success → mark as forwarded
    await supabase
      .from('order_intents')
      .update({
        status: 'forwarded' as const,
        forwarded_at: new Date().toISOString(),
        forwarded_email_subject: email.subject,
        forwarded_email_body: email.bodyHtml,
      })
      .eq('id', id);

    return { forwarded: true, email };
  } catch (err) {
    console.error(`[order-intake] PA forward error:`, err);
    // Status stays 'accepted' — manual fallback
    return { forwarded: false, email };
  }
}

/**
 * Get the formatted email for an intent (for manual copy/mailto fallback).
 */
export async function getForwardEmail(id: string): Promise<ForwardEmailOutput> {
  const supabase = await createClient();

  const { data: intentRow, error } = await supabase
    .from('order_intents')
    .select('*, customers(name, customer_code)')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`getForwardEmail failed: ${error.message}`);
  if (!intentRow) throw new Error('Order intent not found');

  const customer = intentRow.customers as { name: string; customer_code: string } | null;
  const intent = intentRow as OrderIntent;
  const parsedLines = (intent.parse_suggestion_json as ParseSuggestion)?.lines ?? [];

  return formatForwardEmail({
    customerName: customer?.name ?? null,
    customerCode: customer?.customer_code ?? null,
    sourceChannel: intent.source_channel,
    rawText: intent.raw_text,
    lines: parsedLines,
    intentDate: intent.created_at,
    confidenceScore: intent.confidence_score,
  });
}

// =============================================================================
// CONTEXT — Recent communication for a customer
// =============================================================================

/**
 * Get recent inbound messages for a customer (for context in drawer).
 */
export async function getRecentCommunication(
  customerId: string,
  limit = 3
): Promise<InboundMessage[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('inbound_messages')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`getRecentCommunication failed: ${error.message}`);
  return (data ?? []) as InboundMessage[];
}

// =============================================================================
// STATS
// =============================================================================

/**
 * Get intent counts by status for badge/dashboard.
 */
export async function getIntentCounts(): Promise<Record<OrderIntentStatus, number>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('order_intents')
    .select('status');

  if (error) throw new Error(`getIntentCounts failed: ${error.message}`);

  const counts: Record<string, number> = {
    new: 0,
    parsed: 0,
    needs_review: 0,
    accepted: 0,
    forwarded: 0,
    rejected: 0,
  };

  for (const row of data ?? []) {
    const s = (row as { status: string }).status;
    if (s in counts) counts[s]++;
  }

  return counts as Record<OrderIntentStatus, number>;
}
