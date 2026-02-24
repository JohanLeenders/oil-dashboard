/**
 * scheduler.test.ts — Wave 10 Outreach Engine
 *
 * Tests for pure scheduling functions.
 * All Date.now() / Math.random() calls are injected — no real time or randomness.
 */

import { describe, it, expect } from 'vitest';
import {
  getISOWeekNumber,
  getISOYear,
  getWeekKey,
  isMonday,
  getMondaySendBase,
  randomizeSendAfter,
  buildSendSchedule,
  isCampaignDue,
  buildCronResult,
  DEFAULT_QUEUE_CONFIG,
} from './scheduler';

// =============================================================================
// HELPERS
// =============================================================================

/** Parse a date string to a local Date (avoids UTC vs local confusion in tests) */
function d(isoString: string): Date {
  return new Date(isoString);
}

// A known Monday: 2026-02-24 (week 09 of 2026)
const MONDAY_W09 = d('2026-02-23T09:00:00');  // Monday
const TUESDAY = d('2026-02-24T09:00:00');      // Tuesday
const SUNDAY = d('2026-02-22T09:00:00');       // Sunday

// =============================================================================
// getISOWeekNumber
// =============================================================================

describe('getISOWeekNumber', () => {
  it('returns week 9 for 2026-02-23 (Monday)', () => {
    expect(getISOWeekNumber(d('2026-02-23'))).toBe(9);
  });

  it('returns week 1 for 2026-01-05', () => {
    expect(getISOWeekNumber(d('2026-01-05'))).toBe(2);
  });

  it('returns week 53 for 2026-01-01 if it falls in previous year ISO week', () => {
    // 2026-01-01 is a Thursday — it's in week 1 of 2026
    expect(getISOWeekNumber(d('2026-01-01'))).toBe(1);
  });

  it('handles year boundaries correctly — 2015-12-31 is week 53 of 2015', () => {
    expect(getISOWeekNumber(d('2015-12-31'))).toBe(53);
    expect(getISOYear(d('2015-12-31'))).toBe(2015);
  });
});

// =============================================================================
// getWeekKey
// =============================================================================

describe('getWeekKey', () => {
  it('returns YYYY-WW-channel format', () => {
    expect(getWeekKey(d('2026-02-23'), 'whatsapp')).toBe('2026-09-whatsapp');
  });

  it('pads single-digit weeks with zero', () => {
    expect(getWeekKey(d('2026-01-05'), 'email')).toBe('2026-02-email');
  });

  it('produces different keys for different channels', () => {
    const wa = getWeekKey(d('2026-02-23'), 'whatsapp');
    const em = getWeekKey(d('2026-02-23'), 'email');
    expect(wa).not.toBe(em);
    expect(wa).toBe('2026-09-whatsapp');
    expect(em).toBe('2026-09-email');
  });

  it('produces same key for any day within the same ISO week', () => {
    const mon = getWeekKey(d('2026-02-23'), 'whatsapp'); // Monday W09
    const fri = getWeekKey(d('2026-02-27'), 'whatsapp'); // Friday W09
    expect(mon).toBe(fri);
  });
});

// =============================================================================
// isMonday
// =============================================================================

describe('isMonday', () => {
  it('returns true for a Monday', () => {
    expect(isMonday(d('2026-02-23T08:00:00'))).toBe(true);
  });

  it('returns false for Tuesday', () => {
    expect(isMonday(d('2026-02-24T08:00:00'))).toBe(false);
  });

  it('returns false for Sunday', () => {
    expect(isMonday(d('2026-02-22T08:00:00'))).toBe(false);
  });
});

// =============================================================================
// getMondaySendBase
// =============================================================================

describe('getMondaySendBase', () => {
  it('returns Monday 08:00 when today is Monday', () => {
    const base = getMondaySendBase(d('2026-02-23T10:30:00')); // Monday
    expect(base.getDay()).toBe(1); // Monday
    expect(base.getHours()).toBe(8);
    expect(base.getMinutes()).toBe(0);
  });

  it('returns the previous Monday 08:00 when today is Wednesday', () => {
    const base = getMondaySendBase(d('2026-02-25T10:00:00')); // Wednesday
    expect(base.getDay()).toBe(1); // Monday
    expect(base.getDate()).toBe(23); // 2026-02-23
    expect(base.getHours()).toBe(8);
  });

  it('returns the previous Monday 08:00 when today is Sunday', () => {
    const base = getMondaySendBase(d('2026-02-22T10:00:00')); // Sunday
    expect(base.getDay()).toBe(1); // Monday
    expect(base.getDate()).toBe(16); // 2026-02-16
  });
});

// =============================================================================
// randomizeSendAfter
// =============================================================================

describe('randomizeSendAfter', () => {
  const base = d('2026-02-23T08:00:00'); // Monday 08:00

  it('returns base + startMinutes when random = 0', () => {
    const config = { sendWindowStartMinutes: 0, sendWindowEndMinutes: 120 };
    const result = randomizeSendAfter(base, config, () => 0);
    expect(result.getTime()).toBe(base.getTime()); // 08:00 + 0 min = 08:00
  });

  it('returns base + (endMinutes - 1) when random approaches 1', () => {
    const config = { sendWindowStartMinutes: 0, sendWindowEndMinutes: 120 };
    // floor(0.9917 * 120) = floor(119.004) = 119 minutes
    const result = randomizeSendAfter(base, config, () => 0.9917);
    const diffMinutes = (result.getTime() - base.getTime()) / 60_000;
    expect(diffMinutes).toBe(119);
  });

  it('result always falls within the window', () => {
    const config = DEFAULT_QUEUE_CONFIG;
    for (let i = 0; i < 50; i++) {
      const result = randomizeSendAfter(base, config);
      const diffMinutes = (result.getTime() - base.getTime()) / 60_000;
      expect(diffMinutes).toBeGreaterThanOrEqual(config.sendWindowStartMinutes);
      expect(diffMinutes).toBeLessThan(config.sendWindowEndMinutes);
    }
  });

  it('handles non-zero startMinutes', () => {
    const config = { sendWindowStartMinutes: 30, sendWindowEndMinutes: 60 };
    const result = randomizeSendAfter(base, config, () => 0);
    const diffMinutes = (result.getTime() - base.getTime()) / 60_000;
    expect(diffMinutes).toBe(30); // startMinutes + 0
  });
});

// =============================================================================
// buildSendSchedule
// =============================================================================

describe('buildSendSchedule', () => {
  const monday = d('2026-02-23T10:00:00'); // Monday (any time — base snaps to 08:00)
  const customers = ['cust-1', 'cust-2', 'cust-3'];

  it('returns one entry per customer', () => {
    const schedule = buildSendSchedule(customers, monday);
    expect(schedule).toHaveLength(3);
  });

  it('assigns unique customer_ids', () => {
    const schedule = buildSendSchedule(customers, monday);
    const ids = schedule.map((e) => e.customer_id);
    expect(new Set(ids).size).toBe(3);
  });

  it('sorts entries by send_after ascending', () => {
    // Use a cycling RNG to create varied times
    let i = 0;
    const rng = () => [0.9, 0.1, 0.5][i++ % 3];
    const schedule = buildSendSchedule(customers, monday, DEFAULT_QUEUE_CONFIG, rng);
    for (let j = 0; j < schedule.length - 1; j++) {
      expect(schedule[j].send_after.getTime()).toBeLessThanOrEqual(
        schedule[j + 1].send_after.getTime(),
      );
    }
  });

  it('all send_after values fall within Monday 08:00–10:00', () => {
    const schedule = buildSendSchedule(customers, monday);
    const base = new Date(monday);
    base.setHours(8, 0, 0, 0);
    const windowEnd = new Date(base.getTime() + 120 * 60_000);
    for (const entry of schedule) {
      expect(entry.send_after.getTime()).toBeGreaterThanOrEqual(base.getTime());
      expect(entry.send_after.getTime()).toBeLessThan(windowEnd.getTime());
    }
  });

  it('returns empty array for empty customer list', () => {
    expect(buildSendSchedule([], monday)).toEqual([]);
  });
});

// =============================================================================
// isCampaignDue
// =============================================================================

describe('isCampaignDue', () => {
  const monday = d('2026-02-23T09:00:00');
  const tuesday = d('2026-02-24T09:00:00');
  const channel = 'whatsapp';
  const thisWeekKey = '2026-09-whatsapp';

  it('returns true on Monday with no existing campaign this week', () => {
    expect(isCampaignDue(monday, channel, [])).toBe(true);
  });

  it('returns false on Monday when this week_key already exists', () => {
    expect(isCampaignDue(monday, channel, [thisWeekKey])).toBe(false);
  });

  it('returns false on Tuesday even with no existing campaigns', () => {
    expect(isCampaignDue(tuesday, channel, [])).toBe(false);
  });

  it('returns true on Monday if a different channel ran this week', () => {
    // Email ran this week — WhatsApp should still be due
    expect(isCampaignDue(monday, 'whatsapp', ['2026-09-email'])).toBe(true);
  });
});

// =============================================================================
// buildCronResult
// =============================================================================

describe('buildCronResult', () => {
  it('builds result with correct week_key', () => {
    const result = buildCronResult(
      d('2026-02-23'),
      'whatsapp',
      'campaign-abc',
      'created',
      10,
      2,
    );
    expect(result.week_key).toBe('2026-09-whatsapp');
    expect(result.campaign_id).toBe('campaign-abc');
    expect(result.campaign_action).toBe('created');
    expect(result.sends_created).toBe(10);
    expect(result.sends_skipped_duplicate).toBe(2);
  });

  it('handles skipped campaign (null campaign_id)', () => {
    const result = buildCronResult(d('2026-02-23'), 'email', null, 'skipped', 0, 0);
    expect(result.campaign_id).toBeNull();
    expect(result.campaign_action).toBe('skipped');
  });
});
