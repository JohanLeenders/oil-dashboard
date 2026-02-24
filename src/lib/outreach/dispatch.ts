/**
 * dispatch.ts — Wave 10 Outreach Dispatch Layer
 *
 * Handles actual message delivery:
 *   - WhatsApp: Twilio REST API (synchronous)
 *   - Email: Power Automate HTTP webhook → outreach_outbox + delivery events
 *
 * NOT a server action — imported by route handlers only (Next.js request context).
 * Creates its own Supabase client per call (cookies() available in route context).
 *
 * Env vars required:
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM
 *   POWER_AUTOMATE_OUTREACH_URL
 */

import { createClient } from '@/lib/supabase/server';
import type { OutreachSend } from '@/types/outreach';

// =============================================================================
// RESULT TYPE
// =============================================================================

export interface DispatchResult {
  success: boolean;
  event_type: 'sent' | 'failed';
  payload: Record<string, unknown>;
  outbox_id?: string;
}

// =============================================================================
// WHATSAPP — Twilio REST
// =============================================================================

export async function dispatchWhatsApp(send: OutreachSend): Promise<DispatchResult> {
  const supabase = await createClient();

  // 1. Fetch WhatsApp number
  const { data: info } = await supabase
    .from('customer_delivery_info')
    .select('whatsapp_number')
    .eq('customer_id', send.customer_id)
    .maybeSingle();

  const to = (info as { whatsapp_number?: string | null } | null)?.whatsapp_number;
  if (!to) {
    return { success: false, event_type: 'failed', payload: { error: 'Geen WhatsApp-nummer voor deze klant' } };
  }

  // 2. Twilio credentials
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM; // e.g. 'whatsapp:+14155238886'
  if (!accountSid || !authToken || !from) {
    return { success: false, event_type: 'failed', payload: { error: 'Twilio env vars niet geconfigureerd' } };
  }

  // 3. Send via Twilio
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const body = new URLSearchParams({ From: from, To: `whatsapp:${to}`, Body: send.rendered_body });
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      return { success: false, event_type: 'failed', payload: { error: text, http_status: res.status } };
    }

    const json = (await res.json()) as { sid?: string };
    return { success: true, event_type: 'sent', payload: { twilio_sid: json.sid, to } };
  } catch (err) {
    return { success: false, event_type: 'failed', payload: { error: err instanceof Error ? err.message : String(err) } };
  }
}

// =============================================================================
// EMAIL — Power Automate outbox + webhook
// =============================================================================

export async function dispatchEmail(send: OutreachSend): Promise<DispatchResult> {
  const supabase = await createClient();

  // 1. Fetch customer email
  const { data: info } = await supabase
    .from('customer_delivery_info')
    .select('email')
    .eq('customer_id', send.customer_id)
    .maybeSingle();

  const to = (info as { email?: string | null } | null)?.email;
  if (!to) {
    return { success: false, event_type: 'failed', payload: { error: 'Geen e-mailadres voor deze klant' } };
  }

  // 2. Fetch template subject
  const { data: template } = await supabase
    .from('outreach_templates')
    .select('subject')
    .eq('id', send.template_id)
    .maybeSingle();

  const subject = (template as { subject?: string | null } | null)?.subject ?? 'Bestelling Oranjehoen';

  // 3. INSERT outreach_outbox (idempotent — check existing first)
  let outboxId: string;
  const { data: existingOutbox } = await supabase
    .from('outreach_outbox')
    .select('id')
    .eq('send_id', send.id)
    .maybeSingle();

  if (existingOutbox) {
    outboxId = (existingOutbox as { id: string }).id;
  } else {
    const { data: newOutbox, error: outboxErr } = await supabase
      .from('outreach_outbox')
      .insert({ send_id: send.id, to_email: to, from_name: 'Oranjehoen', subject, body_html: send.rendered_body })
      .select('id')
      .single();

    if (outboxErr || !newOutbox) {
      return { success: false, event_type: 'failed', payload: { error: outboxErr?.message ?? 'Outbox insert mislukt' } };
    }

    outboxId = (newOutbox as { id: string }).id;

    // INSERT 'queued' delivery event when outbox row is created
    await supabase.from('outreach_delivery_events').insert({
      outbox_id: outboxId, event_type: 'queued', payload: null,
    });
  }

  // 4. POST to Power Automate webhook
  const paUrl = process.env.POWER_AUTOMATE_OUTREACH_URL;
  if (!paUrl) {
    await supabase.from('outreach_delivery_events').insert({
      outbox_id: outboxId, event_type: 'failed',
      payload: { error: 'POWER_AUTOMATE_OUTREACH_URL niet geconfigureerd' },
    });
    return { success: false, event_type: 'failed', payload: { error: 'PA URL niet geconfigureerd' }, outbox_id: outboxId };
  }

  try {
    const paPayload = { outbox_id: outboxId, send_id: send.id, to_email: to, from_name: 'Oranjehoen', subject, body_html: send.rendered_body };
    const res = await fetch(paUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(paPayload),
    });

    if (!res.ok) {
      const text = await res.text();
      await supabase.from('outreach_delivery_events').insert({
        outbox_id: outboxId, event_type: 'failed', payload: { error: `PA HTTP ${res.status}: ${text}` },
      });
      return { success: false, event_type: 'failed', payload: { error: text }, outbox_id: outboxId };
    }

    // PA accepted webhook — delivery confirmation arrives via /api/outreach/email-ack
    return { success: true, event_type: 'sent', payload: { outbox_id: outboxId, to }, outbox_id: outboxId };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await supabase.from('outreach_delivery_events').insert({
      outbox_id: outboxId, event_type: 'failed', payload: { error },
    });
    return { success: false, event_type: 'failed', payload: { error }, outbox_id: outboxId };
  }
}

// =============================================================================
// UNIFIED DISPATCH
// =============================================================================

export async function dispatchSend(send: OutreachSend): Promise<DispatchResult> {
  if (send.channel === 'whatsapp') return dispatchWhatsApp(send);
  return dispatchEmail(send);
}
