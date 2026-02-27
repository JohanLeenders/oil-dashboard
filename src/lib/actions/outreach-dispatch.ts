'use server';

/**
 * outreach-dispatch.ts — Wave 11 Update Engine: Send Integration
 *
 * Server actions for dispatching updates to recipients.
 * Links Wave 11 updates into the existing Wave 10 campaign → send → dispatch pipeline.
 *
 * Flow:
 *   1. Render update content to HTML (email) and text (WhatsApp)
 *   2. Save rendered content on the update record
 *   3. Create outreach_campaign linked to the update
 *   4. Create outreach_sends for each recipient × channel
 *   5. Create outreach_update_recipients linking update ↔ sends
 *   6. Mark update status = 'ready'
 *
 * Actual dispatch (Twilio / Power Automate) uses existing /api/outreach/send route.
 */

import { createClient } from '@/lib/supabase/server';
import { renderUpdateToHtml, renderUpdateToText } from '@/lib/engine/outreach/updateRenderer';
import type {
  OutreachUpdate,
  OutreachSendChannel,
  TiptapDocument,
} from '@/types/outreach';

// =============================================================================
// TYPES
// =============================================================================

interface RecipientInfo {
  customer_id: string;
  email: string | null;
  whatsapp_number: string | null;
}

export interface PrepareDispatchResult {
  success: boolean;
  error?: string;
  campaign_id?: string;
  send_count?: number;
}

// =============================================================================
// PREPARE UPDATE FOR DISPATCH
// =============================================================================

/**
 * Prepare an update for sending:
 * - Renders content to HTML + text
 * - Creates campaign + sends + recipients
 * - Marks update as 'ready'
 *
 * Does NOT trigger actual dispatch — that happens via the existing send API.
 */
export async function prepareUpdateForDispatch(
  updateId: string,
  sentBy?: string,
): Promise<PrepareDispatchResult> {
  const supabase = await createClient();

  // 1. Load the update
  const { data: raw, error: fetchErr } = await supabase
    .from('outreach_updates')
    .select('*')
    .eq('id', updateId)
    .single();

  if (fetchErr || !raw) {
    return { success: false, error: `Update niet gevonden: ${fetchErr?.message ?? 'unknown'}` };
  }

  const update = raw as unknown as OutreachUpdate;

  if (update.status !== 'draft') {
    return { success: false, error: `Update heeft status "${update.status}" — alleen concepten kunnen verzonden worden` };
  }

  if (!update.content) {
    return { success: false, error: 'Update heeft geen inhoud' };
  }

  // 2. Render content
  const renderedHtml = renderUpdateToHtml(update.content as TiptapDocument, update.title);
  const renderedText = renderUpdateToText(update.content as TiptapDocument, update.title);

  // 3. Save rendered content
  const { error: renderSaveErr } = await supabase
    .from('outreach_updates')
    .update({
      rendered_html: renderedHtml,
      rendered_text: renderedText,
      sent_by: sentBy ?? null,
    })
    .eq('id', updateId);

  if (renderSaveErr) {
    return { success: false, error: `Rendered content opslaan mislukt: ${renderSaveErr.message}` };
  }

  // 4. Get recipients based on target_type
  let recipients: RecipientInfo[];

  if (update.target_type === 'bulk') {
    // All active customers with contact info
    const { data: customers, error: custErr } = await supabase
      .from('customers')
      .select('id')
      .eq('is_active', true);

    if (custErr) return { success: false, error: `Klanten ophalen mislukt: ${custErr.message}` };

    const customerIds = (customers ?? []).map((c) => (c as { id: string }).id);
    if (customerIds.length === 0) return { success: false, error: 'Geen actieve klanten gevonden' };

    const { data: infoRows } = await supabase
      .from('customer_delivery_info')
      .select('customer_id, email, whatsapp_number')
      .in('customer_id', customerIds);

    recipients = (infoRows ?? []).map((r) => r as RecipientInfo).filter(
      (r) => r.email || r.whatsapp_number,
    );
  } else {
    // Single target — target_customer_id must be set
    if (!update.target_customer_id) {
      return { success: false, error: 'Persoonlijke update heeft geen klant geselecteerd' };
    }
    const { data: infoRow } = await supabase
      .from('customer_delivery_info')
      .select('customer_id, email, whatsapp_number')
      .eq('customer_id', update.target_customer_id)
      .maybeSingle();

    if (!infoRow) return { success: false, error: 'Geen contactgegevens voor deze klant' };
    recipients = [infoRow as RecipientInfo];
  }

  if (recipients.length === 0) {
    return { success: false, error: 'Geen ontvangers met contactgegevens gevonden' };
  }

  // 5. Create campaign
  const { data: campaign, error: campErr } = await supabase
    .from('outreach_campaigns')
    .insert({
      name: `Update: ${update.title}`,
      channel: 'both' as const,
      status: 'draft',
      week_key: null,
    })
    .select('id')
    .single();

  if (campErr || !campaign) {
    return { success: false, error: `Campagne aanmaken mislukt: ${campErr?.message ?? 'unknown'}` };
  }

  const campaignId = (campaign as { id: string }).id;

  // 6. Create sends for each recipient × channel
  const sends: Array<{
    campaign_id: string;
    customer_id: string;
    channel: OutreachSendChannel;
    template_id: string;
    rendered_body: string;
    send_after: string;
    status: 'pending';
  }> = [];

  const now = new Date().toISOString();

  for (const recip of recipients) {
    if (recip.email) {
      sends.push({
        campaign_id: campaignId,
        customer_id: recip.customer_id,
        channel: 'email',
        template_id: update.template_id ?? '00000000-0000-0000-0000-000000000000',
        rendered_body: renderedHtml,
        send_after: now,
        status: 'pending',
      });
    }
    if (recip.whatsapp_number) {
      sends.push({
        campaign_id: campaignId,
        customer_id: recip.customer_id,
        channel: 'whatsapp',
        template_id: update.template_id ?? '00000000-0000-0000-0000-000000000000',
        rendered_body: renderedText,
        send_after: now,
        status: 'pending',
      });
    }
  }

  if (sends.length === 0) {
    return { success: false, error: 'Geen verzendbare berichten gegenereerd' };
  }

  const { data: insertedSends, error: sendErr } = await supabase
    .from('outreach_sends')
    .insert(sends)
    .select('id, customer_id, channel');

  if (sendErr) {
    return { success: false, error: `Sends aanmaken mislukt: ${sendErr.message}` };
  }

  // 7. Create update_recipients
  const recipientRows = (insertedSends ?? []).map((s) => ({
    update_id: updateId,
    customer_id: (s as { customer_id: string }).customer_id,
    channel: (s as { channel: OutreachSendChannel }).channel,
    send_id: (s as { id: string }).id,
  }));

  const { error: recipErr } = await supabase
    .from('outreach_update_recipients')
    .insert(recipientRows);

  if (recipErr) {
    console.error('Recipients aanmaken mislukt (niet fataal):', recipErr.message);
  }

  // 8. Mark update as ready, link campaign
  const { error: statusErr } = await supabase
    .from('outreach_updates')
    .update({
      status: 'ready',
      campaign_id: campaignId,
      sent_by: sentBy ?? null,
      sent_at: now,
      updated_at: now,
    })
    .eq('id', updateId);

  if (statusErr) {
    console.error('Status update mislukt (niet fataal):', statusErr.message);
  }

  return {
    success: true,
    campaign_id: campaignId,
    send_count: sends.length,
  };
}
