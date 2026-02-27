/**
 * /oil/outreach — Wave 10 + Wave 11 Outreach Module
 *
 * Server Component: loads campaigns, templates, customers, updates,
 * and structured templates in parallel, then passes to the client tab shell.
 *
 * Wave 11 queries (getUpdates, getStructuredTemplates) are wrapped in
 * try-catch so the page loads even before the Wave 11 migration has run.
 */

import {
  getOutreachCampaigns,
  getTemplates,
  getOutreachCustomers,
  getUpdates,
  getStructuredTemplates,
} from '@/lib/actions/outreach';
import type { OutreachUpdateWithDetails, OutreachTemplate } from '@/types/outreach';
import OutreachClient from './OutreachClient';

/** Safe wrapper: returns fallback if query fails (e.g. table not yet migrated) */
async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    console.warn(`[outreach] Wave 11 query failed (migration not yet applied?) — using fallback`);
    return fallback;
  }
}

export default async function OutreachPage() {
  const [campaigns, templates, customers, updates, structuredTemplates] = await Promise.all([
    getOutreachCampaigns(),
    getTemplates(),
    getOutreachCustomers(),
    safeQuery<OutreachUpdateWithDetails[]>(getUpdates, []),
    safeQuery<OutreachTemplate[]>(getStructuredTemplates, []),
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
        updates={updates}
        structuredTemplates={structuredTemplates}
      />
    </div>
  );
}
