/**
 * /oil/outreach — Wave 10 Outreach Module
 *
 * Server Component: loads campaigns, templates, and customer outreach info
 * in parallel, then passes to the client tab shell.
 */

import { getOutreachCampaigns, getTemplates, getOutreachCustomers } from '@/lib/actions/outreach';
import OutreachClient from './OutreachClient';

export default async function OutreachPage() {
  const [campaigns, templates, customers] = await Promise.all([
    getOutreachCampaigns(),
    getTemplates(),
    getOutreachCustomers(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-2xl font-brand tracking-tight"
          style={{ color: 'var(--color-text-main)' }}
        >
          Outreach
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Wekelijkse klantcommunicatie via email en WhatsApp
        </p>
      </div>
      <OutreachClient
        campaigns={campaigns}
        templates={templates}
        customers={customers}
      />
    </div>
  );
}
