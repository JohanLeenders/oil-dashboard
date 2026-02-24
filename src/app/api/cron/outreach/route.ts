/**
 * GET /api/cron/outreach
 *
 * Vercel cron — runs every Monday at 08:00 (Europe/Amsterdam).
 * Creates an outreach campaign + per-customer sends with randomized send_after.
 *
 * Idempotent: week_key UNIQUE constraint prevents duplicate campaigns.
 * If week_key already exists → skips campaign creation and returns 'skipped'.
 *
 * Security: validates Authorization: Bearer {CRON_SECRET} header.
 *
 * Flow per channel (whatsapp + email):
 *   1. isCampaignDue(now, channel, existingWeekKeys)
 *   2. Create campaign + link all active channel templates
 *   3. Fetch active customers with contact info for this channel
 *   4. buildSendSchedule → randomized send_after per customer
 *   5. For each customer: selectTemplate, renderTemplate, INSERT outreach_send
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  isCampaignDue,
  buildSendSchedule,
  buildCronResult,
  getWeekKey,
  getISOWeekNumber,
} from '@/lib/engine/outreach/scheduler';
import { selectTemplate, renderTemplate } from '@/lib/engine/outreach/templateRenderer';
import type {
  OutreachSendChannel,
  OutreachTemplate,
  OutreachCampaign,
  OutreachCronResult,
} from '@/types/outreach';

// Channels processed by the auto-cron
const CRON_CHANNELS: OutreachSendChannel[] = ['whatsapp', 'email'];

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

  const now = new Date();
  const supabase = await createClient();

  // 2. Fetch existing week_keys for idempotency check
  const { data: weekKeyRows, error: wkErr } = await supabase
    .from('outreach_campaigns')
    .select('week_key')
    .not('week_key', 'is', null);

  if (wkErr) {
    return NextResponse.json({ error: wkErr.message }, { status: 500 });
  }

  const existingWeekKeys = (weekKeyRows ?? [])
    .map((r: unknown) => (r as { week_key: string }).week_key)
    .filter(Boolean) as string[];

  const weekNum = getISOWeekNumber(now).toString().padStart(2, '0');
  const results: OutreachCronResult[] = [];

  // 3. Process each channel independently
  for (const channel of CRON_CHANNELS) {
    const weekKey = getWeekKey(now, channel);

    // 3a. Check if campaign is due
    if (!isCampaignDue(now, channel, existingWeekKeys)) {
      results.push(buildCronResult(now, channel, null, 'skipped', 0, 0));
      console.log(`[cron/outreach] Skipped ${channel} — week_key ${weekKey} already exists or not Monday`);
      continue;
    }

    // 3b. Fetch active templates for this channel (exact + 'both')
    const { data: templateRows, error: tplErr } = await supabase
      .from('outreach_templates')
      .select('*')
      .eq('is_active', true)
      .in('channel', [channel, 'both'])
      .order('name');

    if (tplErr) {
      console.error(`[cron/outreach] Failed to fetch templates for ${channel}:`, tplErr.message);
      continue;
    }

    const templates = (templateRows ?? []) as OutreachTemplate[];
    if (templates.length === 0) {
      console.warn(`[cron/outreach] No active templates for channel=${channel} — skipping`);
      results.push(buildCronResult(now, channel, null, 'skipped', 0, 0));
      continue;
    }

    // 3c. Create campaign
    const { data: campaign, error: campErr } = await supabase
      .from('outreach_campaigns')
      .insert({
        name: `Wekelijkse uitvraag week ${weekNum} — ${channel}`,
        channel,
        week_key: weekKey,
        status: 'scheduled',
        scheduled_at: now.toISOString(),
      })
      .select()
      .single();

    if (campErr) {
      // Could be week_key conflict (race condition on Monday 08:00) — safe to skip
      if (campErr.code === '23505') {
        console.warn(`[cron/outreach] week_key conflict for ${channel} — already created`);
        results.push(buildCronResult(now, channel, null, 'skipped', 0, 0));
        continue;
      }
      console.error(`[cron/outreach] Campaign insert failed for ${channel}:`, campErr.message);
      continue;
    }

    const campId = (campaign as OutreachCampaign).id;

    // 3d. Link all active templates to this campaign
    const templateLinks = templates.map((t, idx) => ({
      campaign_id: campId,
      template_id: t.id,
      sort_order: idx,
    }));
    await supabase.from('outreach_campaign_templates').insert(templateLinks);

    // 3e. Fetch customers with contact info for this channel
    const contactField = channel === 'whatsapp' ? 'whatsapp_number' : 'email';
    const { data: infoRows, error: infoErr } = await supabase
      .from('customer_delivery_info')
      .select(`customer_id, ${contactField}`)
      .not(contactField, 'is', null);

    if (infoErr) {
      console.error(`[cron/outreach] Failed to fetch customer info for ${channel}:`, infoErr.message);
      continue;
    }

    const customerIds = (infoRows ?? [])
      .map((r: unknown) => (r as { customer_id: string }).customer_id)
      .filter(Boolean) as string[];

    if (customerIds.length === 0) {
      console.warn(`[cron/outreach] No customers with ${contactField} — skipping sends for ${channel}`);
      results.push(buildCronResult(now, channel, campId, 'created', 0, 0));
      continue;
    }

    // 3f. Build randomized send schedule
    const schedule = buildSendSchedule(customerIds, now);

    // 3g. Fetch customer names/codes for template rendering
    const { data: custRows } = await supabase
      .from('customers')
      .select('id, name, customer_code')
      .in('id', customerIds);

    const custMap = new Map<string, { name: string; customer_code: string }>();
    for (const c of (custRows ?? []) as Array<{ id: string; name: string; customer_code: string }>) {
      custMap.set(c.id, { name: c.name, customer_code: c.customer_code });
    }

    // 3h. Create outreach_sends
    let sendsCreated = 0;
    let sendsSkipped = 0;

    for (const entry of schedule) {
      const cust = custMap.get(entry.customer_id);
      if (!cust) continue;

      // Select template (no lastUsedTemplateId for auto-cron — full random rotation)
      const chosen = selectTemplate(templates, null);
      if (!chosen) continue;

      // Render
      let renderedBody: string;
      try {
        const rendered = renderTemplate(chosen, {
          klant_naam: cust.name,
          klant_code: cust.customer_code,
          week_nummer: weekNum,
        }, channel);
        renderedBody = rendered.body;
      } catch (err) {
        console.warn(`[cron/outreach] Render failed for customer ${entry.customer_id}:`, err);
        continue;
      }

      // INSERT outreach_send (ON CONFLICT DO NOTHING via UNIQUE constraint)
      const { error: sendErr } = await supabase.from('outreach_sends').insert({
        campaign_id: campId,
        customer_id: entry.customer_id,
        channel,
        template_id: chosen.id,
        rendered_body: renderedBody,
        send_after: entry.send_after.toISOString(),
        status: 'pending',
      });

      if (sendErr) {
        if (sendErr.code === '23505') {
          // Duplicate (campaign_id, customer_id, channel) — idempotent skip
          sendsSkipped++;
        } else {
          console.error(`[cron/outreach] Send insert failed for customer ${entry.customer_id}:`, sendErr.message);
        }
      } else {
        sendsCreated++;
      }
    }

    // 3i. Update campaign status to 'scheduled'
    await supabase
      .from('outreach_campaigns')
      .update({ status: 'scheduled' })
      .eq('id', campId);

    const cronResult = buildCronResult(now, channel, campId, 'created', sendsCreated, sendsSkipped);
    results.push(cronResult);

    // Add week_key to local set so next channel doesn't false-positive on isCampaignDue
    existingWeekKeys.push(weekKey);

    console.log(`[cron/outreach] ${channel}: campaign=${campId} sends_created=${sendsCreated} skipped=${sendsSkipped}`);
  }

  return NextResponse.json({ ok: true, results, timestamp: now.toISOString() });
}
