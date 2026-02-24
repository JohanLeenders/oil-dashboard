/**
 * GET /api/outreach/process-queue
 *
 * Vercel cron handler — runs every 15 min on Monday 08:00–11:00.
 * Finds pending sends where send_after <= NOW() and dispatches them.
 *
 * Rate limited: max OUTREACH_MAX_SENDS_PER_RUN per invocation (default 10).
 *
 * Security: validates Authorization: Bearer {CRON_SECRET} header.
 *
 * Returns:
 *   { processed: number, failed: number, skipped: number, results: DispatchResult[] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { dispatchSend } from '@/lib/outreach/dispatch';
import type { OutreachSend } from '@/types/outreach';

const DEFAULT_MAX_SENDS = 10;

export async function GET(req: NextRequest) {
  // Security: validate CRON_SECRET via Authorization: Bearer header.
  // Fail closed — if CRON_SECRET not configured, reject all requests.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
  }
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const maxSends = parseInt(process.env.OUTREACH_MAX_SENDS_PER_RUN ?? '', 10) || DEFAULT_MAX_SENDS;

  const supabase = await createClient();

  // 2. Fetch pending sends due now, ordered by send_after
  const now = new Date().toISOString();
  const { data: pendingSends, error: fetchErr } = await supabase
    .from('outreach_sends')
    .select('*')
    .eq('status', 'pending')
    .lte('send_after', now)
    .order('send_after')
    .limit(maxSends);

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const sends = (pendingSends ?? []) as OutreachSend[];
  if (sends.length === 0) {
    return NextResponse.json({ processed: 0, failed: 0, skipped: 0, results: [] });
  }

  // 3. Dispatch each send
  let processed = 0;
  let failed = 0;
  const results: Array<{ send_id: string; success: boolean; event_type: string }> = [];

  for (const send of sends) {
    try {
      const result = await dispatchSend(send);

      // Always mark 'processed' — avoid infinite retry loops
      // Operators can re-trigger via /api/outreach/send for failed sends
      const processedAt = new Date().toISOString();
      await supabase
        .from('outreach_sends')
        .update({ status: 'processed', processed_at: processedAt })
        .eq('id', send.id);

      if (result.success) {
        processed++;
      } else {
        failed++;
      }

      results.push({ send_id: send.id, success: result.success, event_type: result.event_type });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`[process-queue] Error dispatching send ${send.id}:`, error);
      failed++;
      results.push({ send_id: send.id, success: false, event_type: 'failed' });
    }
  }

  console.log(`[process-queue] Done. processed=${processed} failed=${failed} of ${sends.length}`);

  return NextResponse.json({
    processed,
    failed,
    skipped: 0,
    results,
    timestamp: now,
  });
}
