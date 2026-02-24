/**
 * scheduler.ts — Wave 10 Outreach Engine
 *
 * Pure functions for campaign scheduling and send-time randomization.
 * No database calls. No side effects. No Date.now() called internally —
 * all "current time" is injected as a parameter for full testability.
 *
 * Responsibilities:
 *   - Compute idempotency week_key for campaigns
 *   - Randomize individual send_after timestamps within the send window
 *   - Build per-customer send schedules (spread across window)
 *   - Guard: detect if a campaign is due for the current week
 */

import type { OutreachQueueConfig, OutreachCronResult } from '@/types/outreach';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default send window: Monday 08:00–10:00 local time */
export const DEFAULT_QUEUE_CONFIG: OutreachQueueConfig = {
  maxSendsPerRun: 10,
  sendWindowStartMinutes: 0,   // 0 min after 08:00 = 08:00
  sendWindowEndMinutes: 120,   // 120 min after 08:00 = 10:00
};

// =============================================================================
// WEEK KEY
// =============================================================================

/**
 * Compute the ISO week number (1–53) for a given date.
 * ISO week: week containing Thursday, Monday = first day.
 * Pure — no external deps.
 */
export function getISOWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Compute the ISO year for a given date.
 * The ISO year may differ from the calendar year near year boundaries.
 */
export function getISOYear(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  return d.getUTCFullYear();
}

/**
 * Build the campaign week_key for idempotent cron runs.
 * Format: 'YYYY-WW-channel' e.g. '2026-09-whatsapp'
 *
 * A campaign with this week_key already in the DB means this week's
 * auto-campaign already ran — cron should skip (INSERT ... ON CONFLICT DO NOTHING).
 */
export function getWeekKey(date: Date, channel: string): string {
  const year = getISOYear(date);
  const week = getISOWeekNumber(date).toString().padStart(2, '0');
  return `${year}-${week}-${channel}`;
}

// =============================================================================
// MONDAY DETECTION
// =============================================================================

/**
 * Returns true if the given date falls on a Monday (local time).
 * Day 1 = Monday in JS Date (0=Sun, 1=Mon, ..., 6=Sat).
 */
export function isMonday(date: Date): boolean {
  return date.getDay() === 1;
}

/**
 * Returns the most recent Monday (or today if today is Monday)
 * at 08:00 local time — the base of the send window.
 */
export function getMondaySendBase(date: Date): Date {
  const d = new Date(date);
  const dayOfWeek = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // back to Monday
  d.setDate(d.getDate() - daysToSubtract);
  d.setHours(8, 0, 0, 0); // 08:00 local time
  return d;
}

// =============================================================================
// SEND TIME RANDOMIZATION
// =============================================================================

/**
 * Compute a randomized send_after timestamp within the send window.
 *
 * The window is [base + startMinutes, base + endMinutes).
 * Random offset is injected for testability.
 *
 * @param base        Start of the window (e.g. Monday 08:00)
 * @param config      Window config (sendWindowStartMinutes, sendWindowEndMinutes)
 * @param random      RNG — defaults to Math.random, injectable for tests
 * @returns           Date within the window
 */
export function randomizeSendAfter(
  base: Date,
  config: Pick<OutreachQueueConfig, 'sendWindowStartMinutes' | 'sendWindowEndMinutes'>,
  random: () => number = Math.random,
): Date {
  const { sendWindowStartMinutes, sendWindowEndMinutes } = config;
  const rangeMinutes = sendWindowEndMinutes - sendWindowStartMinutes;
  const offsetMinutes =
    sendWindowStartMinutes + Math.floor(random() * rangeMinutes);
  const result = new Date(base.getTime() + offsetMinutes * 60_000);
  return result;
}

// =============================================================================
// SEND SCHEDULE BUILDING
// =============================================================================

export interface SendScheduleEntry {
  customer_id: string;
  send_after: Date;
}

/**
 * Build a per-customer send schedule for a campaign.
 *
 * Each customer gets an independently randomized send_after within the window.
 * The schedule is ordered by send_after ascending (earliest first).
 *
 * Pure — all randomness comes through the `random` parameter.
 *
 * @param customerIds   List of customer IDs to schedule
 * @param campaignDate  Date of the campaign run (typically Monday)
 * @param config        Queue config (window + rate limit)
 * @param random        Injected RNG for testability
 */
export function buildSendSchedule(
  customerIds: string[],
  campaignDate: Date,
  config: OutreachQueueConfig = DEFAULT_QUEUE_CONFIG,
  random: () => number = Math.random,
): SendScheduleEntry[] {
  const base = getMondaySendBase(campaignDate);

  const entries: SendScheduleEntry[] = customerIds.map((customer_id) => ({
    customer_id,
    send_after: randomizeSendAfter(base, config, random),
  }));

  // Sort ascending so the process-queue processes in time order
  return entries.sort((a, b) => a.send_after.getTime() - b.send_after.getTime());
}

// =============================================================================
// CAMPAIGN DUE CHECK
// =============================================================================

/**
 * Returns true if a new auto-campaign should be created for the given date.
 * Conditions: date is a Monday AND no existing week_key for this week/channel.
 *
 * @param now             Current date (injected — no Date.now() inside)
 * @param channel         Channel to check
 * @param existingWeekKeys  week_keys of campaigns already in the DB
 */
export function isCampaignDue(
  now: Date,
  channel: string,
  existingWeekKeys: string[],
): boolean {
  if (!isMonday(now)) return false;
  const key = getWeekKey(now, channel);
  return !existingWeekKeys.includes(key);
}

// =============================================================================
// CRON RESULT BUILDER
// =============================================================================

/**
 * Build the result object for a cron run.
 * Pure — used for logging and response payload construction.
 */
export function buildCronResult(
  now: Date,
  channel: string,
  campaignId: string | null,
  campaignAction: OutreachCronResult['campaign_action'],
  sendsCreated: number,
  sendsSkippedDuplicate: number,
): OutreachCronResult {
  return {
    week_key: getWeekKey(now, channel),
    campaign_id: campaignId,
    campaign_action: campaignAction,
    sends_created: sendsCreated,
    sends_skipped_duplicate: sendsSkippedDuplicate,
  };
}
