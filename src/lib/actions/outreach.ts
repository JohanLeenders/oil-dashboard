'use server';

/**
 * Server Actions — Wave 10 Outreach Module
 *
 * Data access layer for the /oil/outreach page.
 * READ operations + campaign/template mutations.
 * Dispatch is handled separately by API route handlers (route.ts).
 */

import { createClient } from '@/lib/supabase/server';
import { dispatchSend } from '@/lib/outreach/dispatch';
import type {
  OutreachTemplate,
  OutreachCampaign,
  OutreachCampaignWithTemplates,
  OutreachSendWithStatus,
  OutreachDeliveryEvent,
  OutreachOutbox,
  OutreachSend,
  OutreachChannel,
} from '@/types/outreach';

// =============================================================================
// TYPE HELPERS
// =============================================================================

interface CustomerRow {
  id: string;
  name: string;
  customer_code: string;
  is_active: boolean;
}

interface DeliveryInfoRow {
  customer_id: string;
  email: string | null;
  whatsapp_number: string | null;
}

export interface OutreachCustomer {
  id: string;
  name: string;
  customer_code: string;
  email: string | null;
  whatsapp_number: string | null;
}

// =============================================================================
// TEMPLATES
// =============================================================================

/** All templates ordered by channel then name */
export async function getTemplates(): Promise<OutreachTemplate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('outreach_templates')
    .select('*')
    .order('channel')
    .order('name');

  if (error) throw new Error(`Failed to fetch templates: ${error.message}`);
  return (data ?? []) as OutreachTemplate[];
}

/** Active templates, optionally filtered by channel */
export async function getActiveTemplates(
  channel?: OutreachChannel,
): Promise<OutreachTemplate[]> {
  const supabase = await createClient();
  let query = supabase
    .from('outreach_templates')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (channel && channel !== 'both') {
    // Match exact channel OR 'both' templates (usable by this channel)
    query = query.in('channel', [channel, 'both']);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch active templates: ${error.message}`);
  return (data ?? []) as OutreachTemplate[];
}

/** Create a new template */
export async function createTemplate(
  input: Pick<OutreachTemplate, 'name' | 'channel' | 'message_type' | 'subject' | 'body_html' | 'body_text'>,
): Promise<OutreachTemplate> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('outreach_templates')
    .insert({ ...input, is_active: true })
    .select()
    .single();

  if (error) throw new Error(`Failed to create template: ${error.message}`);
  return data as OutreachTemplate;
}

/** Update an existing template (partial update) */
export async function updateTemplate(
  id: string,
  input: Partial<Pick<OutreachTemplate, 'name' | 'channel' | 'message_type' | 'subject' | 'body_html' | 'body_text' | 'is_active'>>,
): Promise<OutreachTemplate> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('outreach_templates')
    .update(input)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update template: ${error.message}`);
  return data as OutreachTemplate;
}

// =============================================================================
// CAMPAIGNS
// =============================================================================

/** List all campaigns ordered by created_at desc, with send counts */
export async function getOutreachCampaigns(): Promise<OutreachCampaignWithTemplates[]> {
  const supabase = await createClient();

  const { data: campaigns, error: campErr } = await supabase
    .from('outreach_campaigns')
    .select('*')
    .order('created_at', { ascending: false });

  if (campErr) throw new Error(`Failed to fetch campaigns: ${campErr.message}`);
  if (!campaigns?.length) return [];

  // Batch fetch: sends, templates per campaign
  const campaignIds = campaigns.map((c) => c.id as string);

  const [sendsRes, ctRes] = await Promise.all([
    supabase.from('outreach_sends').select('id, campaign_id, status').in('campaign_id', campaignIds),
    supabase.from('outreach_campaign_templates').select('campaign_id, template_id').in('campaign_id', campaignIds),
  ]);

  const templateIds = (ctRes.data ?? []).map((r) => (r as { template_id: string }).template_id);
  const templatesRes = templateIds.length
    ? await supabase.from('outreach_templates').select('*').in('id', templateIds)
    : { data: [] };

  const templateMap = new Map<string, OutreachTemplate>();
  for (const t of (templatesRes.data ?? []) as OutreachTemplate[]) {
    templateMap.set(t.id, t);
  }

  return (campaigns as OutreachCampaign[]).map((camp) => {
    const sends = (sendsRes.data ?? []).filter((s) => (s as OutreachSend).campaign_id === camp.id) as OutreachSend[];
    const ctLinks = (ctRes.data ?? []).filter((r) => (r as { campaign_id: string }).campaign_id === camp.id);
    const templates = ctLinks
      .map((r) => templateMap.get((r as { template_id: string }).template_id)!)
      .filter(Boolean);

    return {
      ...camp,
      templates,
      send_count: sends.length,
      processed_count: sends.filter((s) => s.status === 'processed').length,
    } as OutreachCampaignWithTemplates;
  });
}

/** Create a campaign and link template pool */
export async function createCampaign(input: {
  name: string;
  channel: OutreachChannel;
  scheduled_at?: string | null;
  week_key?: string | null;
  template_ids: string[];
}): Promise<OutreachCampaign> {
  const supabase = await createClient();

  const { data: campaign, error: campErr } = await supabase
    .from('outreach_campaigns')
    .insert({
      name: input.name,
      channel: input.channel,
      scheduled_at: input.scheduled_at ?? null,
      week_key: input.week_key ?? null,
      status: 'draft',
    })
    .select()
    .single();

  if (campErr) throw new Error(`Failed to create campaign: ${campErr.message}`);

  if (input.template_ids.length > 0) {
    const links = input.template_ids.map((tid, idx) => ({
      campaign_id: (campaign as OutreachCampaign).id,
      template_id: tid,
      sort_order: idx,
    }));
    const { error: linkErr } = await supabase.from('outreach_campaign_templates').insert(links);
    if (linkErr) throw new Error(`Failed to link templates: ${linkErr.message}`);
  }

  return campaign as OutreachCampaign;
}

// =============================================================================
// SENDS WITH DELIVERY STATUS
// =============================================================================

/** Sends for a campaign, each enriched with latest delivery event */
export async function getOutreachSendsWithStatus(
  campaignId: string,
): Promise<OutreachSendWithStatus[]> {
  const supabase = await createClient();

  const { data: sends, error: sendErr } = await supabase
    .from('outreach_sends')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('send_after');

  if (sendErr) throw new Error(`Failed to fetch sends: ${sendErr.message}`);
  if (!sends?.length) return [];

  const sendIds = (sends as OutreachSend[]).map((s) => s.id);

  // Fetch outbox entries
  const { data: outboxRows } = await supabase
    .from('outreach_outbox')
    .select('*')
    .in('send_id', sendIds);

  const outboxBySendId = new Map<string, OutreachOutbox>();
  for (const ob of (outboxRows ?? []) as OutreachOutbox[]) {
    outboxBySendId.set(ob.send_id, ob);
  }

  // Fetch latest delivery event per outbox
  const outboxIds = (outboxRows ?? []).map((ob) => (ob as OutreachOutbox).id);
  const latestEventByOutboxId = new Map<string, OutreachDeliveryEvent>();

  if (outboxIds.length > 0) {
    const { data: events } = await supabase
      .from('outreach_delivery_events')
      .select('*')
      .in('outbox_id', outboxIds)
      .order('created_at', { ascending: false });

    // Keep only the latest event per outbox_id
    for (const ev of (events ?? []) as OutreachDeliveryEvent[]) {
      if (!latestEventByOutboxId.has(ev.outbox_id)) {
        latestEventByOutboxId.set(ev.outbox_id, ev);
      }
    }
  }

  return (sends as OutreachSend[]).map((send) => {
    const outbox = outboxBySendId.get(send.id) ?? null;
    const latest_event = outbox ? (latestEventByOutboxId.get(outbox.id) ?? null) : null;

    return {
      ...send,
      outbox,
      latest_event,
      delivery_status: latest_event?.event_type ?? 'pending',
    } as OutreachSendWithStatus;
  });
}

// =============================================================================
// CUSTOMERS
// =============================================================================

/** Active customers with their outreach contact info */
export async function getOutreachCustomers(): Promise<OutreachCustomer[]> {
  const supabase = await createClient();

  const [custRes, infoRes] = await Promise.all([
    supabase.from('customers').select('id, name, customer_code, is_active').eq('is_active', true).order('name'),
    supabase.from('customer_delivery_info').select('customer_id, email, whatsapp_number'),
  ]);

  if (custRes.error) throw new Error(`Failed to fetch customers: ${custRes.error.message}`);

  const infoMap = new Map<string, DeliveryInfoRow>();
  for (const row of (infoRes.data ?? []) as DeliveryInfoRow[]) {
    infoMap.set(row.customer_id, row);
  }

  return ((custRes.data ?? []) as CustomerRow[]).map((c) => {
    const info = infoMap.get((c as CustomerRow).id);
    return {
      id: (c as CustomerRow).id,
      name: (c as CustomerRow).name,
      customer_code: (c as CustomerRow).customer_code,
      email: info?.email ?? null,
      whatsapp_number: info?.whatsapp_number ?? null,
    };
  });
}

// =============================================================================
// DISPATCH
// =============================================================================

/** Manually dispatch all pending sends for a campaign (UI "Verstuur nu" button) */
export async function dispatchCampaignSends(
  campaignId: string,
): Promise<{ dispatched: number; failed: number; total: number }> {
  const supabase = await createClient();

  const { data: sends, error } = await supabase
    .from('outreach_sends')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('status', 'pending');

  if (error) throw new Error(`Failed to fetch sends: ${error.message}`);

  const pending = (sends ?? []) as OutreachSend[];
  let dispatched = 0;
  let failed = 0;

  for (const send of pending) {
    try {
      const result = await dispatchSend(send);
      await supabase
        .from('outreach_sends')
        .update({ status: 'processed', processed_at: new Date().toISOString() })
        .eq('id', send.id);
      if (result.success) dispatched++;
      else failed++;
    } catch {
      failed++;
    }
  }

  return { dispatched, failed, total: pending.length };
}

// =============================================================================
// CRON HELPERS
// =============================================================================

/** Existing campaign week_keys for isCampaignDue idempotency check */
export async function getExistingWeekKeys(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('outreach_campaigns')
    .select('week_key')
    .not('week_key', 'is', null);

  if (error) throw new Error(`Failed to fetch week_keys: ${error.message}`);
  return (data ?? []).map((r) => (r as { week_key: string }).week_key).filter(Boolean);
}

/** Fetch a single send by ID (used by /api/outreach/send) */
export async function getOutreachSendById(id: string): Promise<OutreachSend | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('outreach_sends')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch send: ${error.message}`);
  return data as OutreachSend | null;
}
