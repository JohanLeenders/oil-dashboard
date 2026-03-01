/**
 * WhatsApp Webhook — Meta Cloud API
 *
 * GET  /api/whatsapp/webhook — Verify token handshake (Meta requires this)
 * POST /api/whatsapp/webhook — Receive inbound messages, log to inbound_messages
 *
 * Architecture:
 *   Meta Cloud API → this endpoint → inbound_messages → classifier → order_intents
 *
 * Env vars required:
 *   WHATSAPP_VERIFY_TOKEN — chosen verify token (shared with Meta)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { normalizePhone } from '@/lib/order-intake/normalize';
import { classifyInboundMessage } from '@/lib/engine/order-intake/classifier';
import type {
  MetaWebhookPayload,
  MetaWebhookMessage,
  InboundChannel,
} from '@/types/order-intake';

// =============================================================================
// GET — Webhook Verification (Meta handshake)
// =============================================================================

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (!verifyToken) {
    return new NextResponse('WHATSAPP_VERIFY_TOKEN not configured', { status: 503 });
  }

  if (mode === 'subscribe' && token === verifyToken) {
    // Meta expects the challenge value back as plain text
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse('Forbidden', { status: 403 });
}

// =============================================================================
// POST — Receive inbound messages
// =============================================================================

export async function POST(req: NextRequest) {
  // Meta expects a quick 200 response; errors must not block
  try {
    const body = (await req.json()) as MetaWebhookPayload;

    // Validate this is a WhatsApp webhook
    if (body.object !== 'whatsapp_business_account') {
      return NextResponse.json({ status: 'ignored' }, { status: 200 });
    }

    const messages = extractMessages(body);

    if (messages.length === 0) {
      // Status updates, delivery receipts, etc. — acknowledge but don't log
      return NextResponse.json({ status: 'ok', messages: 0 }, { status: 200 });
    }

    const supabase = await createClient();
    const channel: InboundChannel = 'whatsapp';
    let logged = 0;

    for (const msg of messages) {
      // Only process text messages for MVP
      if (msg.type !== 'text' || !msg.text?.body) {
        continue;
      }

      const senderNormalized = normalizePhone(msg.from);

      // Customer matching: lookup by whatsapp_number
      const customerId = await matchCustomer(supabase, senderNormalized);

      // Log to inbound_messages (OUT domain — raw log only)
      const { data: inserted, error } = await supabase
        .from('inbound_messages')
        .insert({
          source_channel: channel,
          sender_identifier: senderNormalized,
          customer_id: customerId,
          raw_text: msg.text.body,
          raw_payload: body as unknown as Record<string, unknown>,
        })
        .select('id')
        .single();

      if (error || !inserted) {
        console.error('[whatsapp-webhook] Failed to insert inbound message:', error?.message);
        continue;
      }

      // Run classifier — create order intent if match (IN domain)
      const classification = classifyInboundMessage(msg.text.body);
      if (classification) {
        const { error: intentErr } = await supabase
          .from('order_intents')
          .insert({
            source_channel: channel,
            customer_id: customerId,
            raw_text: msg.text.body,
            parse_suggestion_json: { lines: classification.lines },
            confidence_score: classification.confidence,
            status: 'new',
            linked_message_id: inserted.id,
          });

        if (intentErr) {
          console.error('[whatsapp-webhook] Failed to create order intent:', intentErr.message);
        }
      }

      logged++;
    }

    return NextResponse.json({ status: 'ok', messages: logged }, { status: 200 });
  } catch (err) {
    // Always return 200 to Meta to prevent retries on parse errors
    console.error('[whatsapp-webhook] Error processing webhook:', err);
    return NextResponse.json({ status: 'error' }, { status: 200 });
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Extract text messages from the nested Meta webhook payload.
 * Defensive: handles missing fields gracefully.
 */
function extractMessages(payload: MetaWebhookPayload): MetaWebhookMessage[] {
  const messages: MetaWebhookMessage[] = [];

  if (!Array.isArray(payload.entry)) return messages;

  for (const entry of payload.entry) {
    if (!Array.isArray(entry.changes)) continue;

    for (const change of entry.changes) {
      if (change.field !== 'messages') continue;
      if (!Array.isArray(change.value?.messages)) continue;

      for (const msg of change.value.messages) {
        messages.push(msg);
      }
    }
  }

  return messages;
}

/**
 * Match sender phone number to a customer via customer_delivery_info.
 * Returns customer_id or null if no match.
 */
async function matchCustomer(
  supabase: Awaited<ReturnType<typeof createClient>>,
  normalizedPhone: string
): Promise<string | null> {
  // Try exact match first
  const { data } = await supabase
    .from('customer_delivery_info')
    .select('customer_id')
    .eq('whatsapp_number', normalizedPhone)
    .maybeSingle();

  if (data?.customer_id) {
    return data.customer_id as string;
  }

  // Try without leading + (some systems store without it)
  if (normalizedPhone.startsWith('+')) {
    const withoutPlus = normalizedPhone.slice(1);
    const { data: data2 } = await supabase
      .from('customer_delivery_info')
      .select('customer_id')
      .eq('whatsapp_number', withoutPlus)
      .maybeSingle();

    if (data2?.customer_id) {
      return data2.customer_id as string;
    }
  }

  return null;
}
