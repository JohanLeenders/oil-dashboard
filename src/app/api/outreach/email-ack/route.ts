/**
 * POST /api/outreach/email-ack
 *
 * Power Automate callback — called after PA sends email via Outlook connector.
 * Inserts a delivery event (sent | failed) into outreach_delivery_events.
 *
 * Security: validates x-outreach-secret header against OUTREACH_WEBHOOK_SECRET env var.
 *
 * Body (PACallbackPayload):
 *   { outbox_id, event_type: 'sent' | 'failed', payload: { pa_run_id?, outlook_message_id?, error? } }
 *
 * Response: 200 on success, 4xx on validation error
 *
 * Note: outreach_delivery_events is APPEND-ONLY — this route only INSERTs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { PACallbackPayload } from '@/types/outreach';

export async function POST(req: NextRequest) {
  // 1. Validate shared secret
  const secret = process.env.OUTREACH_WEBHOOK_SECRET;
  if (secret) {
    const provided = req.headers.get('x-outreach-secret');
    if (provided !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // 2. Parse body
  let body: PACallbackPayload;
  try {
    body = (await req.json()) as PACallbackPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { outbox_id, event_type, payload } = body;

  if (!outbox_id || !event_type) {
    return NextResponse.json({ error: 'outbox_id and event_type required' }, { status: 400 });
  }

  if (event_type !== 'sent' && event_type !== 'failed') {
    return NextResponse.json({ error: 'event_type must be "sent" or "failed"' }, { status: 400 });
  }

  const supabase = await createClient();

  // 3. Verify outbox_id exists
  const { data: outbox, error: outboxErr } = await supabase
    .from('outreach_outbox')
    .select('id, send_id')
    .eq('id', outbox_id)
    .maybeSingle();

  if (outboxErr) {
    return NextResponse.json({ error: outboxErr.message }, { status: 500 });
  }
  if (!outbox) {
    return NextResponse.json({ error: 'Outbox entry not found' }, { status: 404 });
  }

  // 4. INSERT delivery event (append-only — no UPDATE on outbox)
  const { error: evtErr } = await supabase.from('outreach_delivery_events').insert({
    outbox_id,
    event_type,
    payload: payload ?? null,
  });

  if (evtErr) {
    return NextResponse.json({ error: evtErr.message }, { status: 500 });
  }

  // 5. Log result
  console.log(`[email-ack] outbox=${outbox_id} event=${event_type}`, payload);

  return NextResponse.json({ ok: true, outbox_id, event_type });
}
