/**
 * POST /api/outreach/send
 *
 * Manually dispatches a single outreach send by ID.
 * Used by the UI "Verstuur nu" button — bypasses the queue schedule.
 *
 * Body: { send_id: string }
 *
 * Flow:
 *   1. Validate request
 *   2. Fetch send record (must be 'pending')
 *   3. dispatchSend() → Twilio (WhatsApp) or PA outbox (email)
 *   4. Mark send as 'processed'
 *   5. Return result
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { dispatchSend } from '@/lib/outreach/dispatch';

export async function POST(req: NextRequest) {
  // Security: validate x-outreach-secret header (same guard as email-ack)
  // Fail closed — if OUTREACH_WEBHOOK_SECRET not configured, reject all requests.
  const secret = process.env.OUTREACH_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'OUTREACH_WEBHOOK_SECRET not configured' }, { status: 503 });
  }
  if (req.headers.get('x-outreach-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let send_id: string | undefined;
  try {
    const body = (await req.json()) as { send_id?: string };
    send_id = body.send_id;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!send_id) {
    return NextResponse.json({ error: 'send_id is required' }, { status: 400 });
  }

  const supabase = await createClient();

  // 1. Fetch the send
  const { data: send, error: fetchErr } = await supabase
    .from('outreach_sends')
    .select('*')
    .eq('id', send_id)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  if (!send) {
    return NextResponse.json({ error: 'Send not found' }, { status: 404 });
  }
  if ((send as { status: string }).status === 'processed') {
    return NextResponse.json({ error: 'Send already processed' }, { status: 409 });
  }

  // 2. Dispatch (dispatchSend creates its own supabase client internally)
  const result = await dispatchSend(send as import('@/types/outreach').OutreachSend);

  // 3. Mark as processed (always — on failure, operator retries manually)
  const now = new Date().toISOString();
  await supabase
    .from('outreach_sends')
    .update({ status: 'processed', processed_at: now })
    .eq('id', send_id);

  return NextResponse.json({
    send_id,
    success: result.success,
    event_type: result.event_type,
    payload: result.payload,
    outbox_id: result.outbox_id ?? null,
  });
}
