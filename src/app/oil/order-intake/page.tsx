/**
 * /oil/order-intake — Wave 12 Order Intake Werkbak
 *
 * Server Component: loads intents + counts in parallel,
 * then passes to OrderIntakeClient.
 *
 * Queries are wrapped in safeQuery so the page loads
 * even before the Wave 12 migration has run.
 */

import type { OrderIntentWithCustomer, OrderIntentStatus } from '@/types/order-intake';
import { getOrderIntents, getIntentCounts } from '@/lib/actions/order-intake';
import OrderIntakeClient from './OrderIntakeClient';

/** Safe wrapper: returns fallback if query fails (e.g. table not yet migrated) */
async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    console.warn(`[order-intake] query failed (migration not yet applied?) — using fallback`);
    return fallback;
  }
}

const EMPTY_COUNTS: Record<OrderIntentStatus, number> = {
  new: 0,
  parsed: 0,
  needs_review: 0,
  accepted: 0,
  forwarded: 0,
  rejected: 0,
};

export default async function OrderIntakePage() {
  const [intents, counts] = await Promise.all([
    safeQuery<OrderIntentWithCustomer[]>(getOrderIntents, []),
    safeQuery<Record<OrderIntentStatus, number>>(getIntentCounts, EMPTY_COUNTS),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-2xl font-brand tracking-tight"
          style={{ color: 'var(--color-text-main)' }}
        >
          Order Intake
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Inkomende bestellingen verwerken — WhatsApp, email en handmatig
        </p>
      </div>
      <OrderIntakeClient
        initialIntents={intents}
        counts={counts}
      />
    </div>
  );
}
