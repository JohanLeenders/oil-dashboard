'use server';

/**
 * Server Actions voor Planning Data
 * Sprint: Wave 2 — A1-S1 Planning UI + Wave 6 — A0-S2 Import
 *
 * REGRESSIE-CHECK:
 * - ✅ getSlaughterCalendar: Leest uit slaughter_calendar
 * - ✅ getSlaughterDetail: Leest enkele entry
 * - ✅ importSlaughterDays: Upsert naar slaughter_calendar (Wave 6)
 * - ✅ clearSlaughterCalendar: Delete all (Wave 6)
 */

import { createClient } from '@/lib/supabase/server';
import type { SlaughterCalendar } from '@/types/database';
import { importSlaughterDaysSchema } from '@/lib/schemas/planning';
import type { SlaughterDayImport } from '@/lib/utils/parseOpzetplanning';
import { getISOWeekNumber } from '@/lib/utils/parseOpzetplanning';

/**
 * Haal slachtkalender op — toekomstige en recente (laatste 2 weken)
 * SELECT * FROM slaughter_calendar ORDER BY slaughter_date ASC
 */
export async function getSlaughterCalendar(): Promise<SlaughterCalendar[]> {
  const supabase = await createClient();

  // 2 weken geleden als ondergrens
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const cutoffDate = twoWeeksAgo.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('slaughter_calendar')
    .select('*')
    .gte('slaughter_date', cutoffDate)
    .order('slaughter_date', { ascending: true });

  if (error) {
    console.error('Error fetching slaughter calendar:', error);
    throw new Error(`Failed to fetch slaughter calendar: ${error.message}`);
  }

  return data || [];
}

/**
 * Haal enkele slachtkalender entry op basis van ID
 * SELECT * FROM slaughter_calendar WHERE id = $id
 */
export async function getSlaughterDetail(id: string): Promise<SlaughterCalendar | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('slaughter_calendar')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching slaughter detail:', error);
    throw new Error(`Failed to fetch slaughter detail: ${error.message}`);
  }

  return data;
}

/**
 * Importeer slachtdagen vanuit opzetplanning (upsert)
 * INSERT/UPDATE slaughter_calendar
 */
export async function importSlaughterDays(
  rows: SlaughterDayImport[]
): Promise<{
  inserted: number;
  updated: number;
  rejected: number;
  errors: string[];
}> {
  // 1. Validate with Zod
  const parsed = importSlaughterDaysSchema.safeParse({ rows });
  if (!parsed.success) {
    return { inserted: 0, updated: 0, rejected: rows.length, errors: parsed.error.issues.map(i => i.message) };
  }

  const supabase = await createClient();
  let inserted = 0;
  let updated = 0;
  let rejected = 0;
  const errors: string[] = [];

  for (const row of parsed.data.rows) {
    try {
      const slaughterDate = new Date(row.slaughter_date);
      const weekNumber = getISOWeekNumber(slaughterDate);
      const year = slaughterDate.getFullYear();

      // Check if row exists with same date + location
      const { data: existing } = await supabase
        .from('slaughter_calendar')
        .select('id')
        .eq('slaughter_date', row.slaughter_date)
        .eq('slaughter_location', row.slaughter_location ?? '')
        .maybeSingle();

      if (existing) {
        // UPDATE existing row
        const { error } = await supabase
          .from('slaughter_calendar')
          .update({
            expected_birds: row.expected_birds,
            expected_live_weight_kg: row.expected_live_weight_kg,
            mester_breakdown: row.mester_breakdown,
            week_number: weekNumber,
          })
          .eq('id', existing.id);

        if (error) {
          rejected++;
          errors.push(`Rij ${row.slaughter_date}: update mislukt — ${error.message}`);
        } else {
          updated++;
        }
      } else {
        // INSERT new row
        const { error } = await supabase
          .from('slaughter_calendar')
          .insert({
            slaughter_date: row.slaughter_date,
            week_number: weekNumber,
            year,
            expected_birds: row.expected_birds,
            expected_live_weight_kg: row.expected_live_weight_kg,
            mester_breakdown: row.mester_breakdown,
            slaughter_location: row.slaughter_location ?? null,
            status: 'planned',
            notes: row.notes ?? null,
          });

        if (error) {
          rejected++;
          errors.push(`Rij ${row.slaughter_date}: insert mislukt — ${error.message}`);
        } else {
          inserted++;
        }
      }
    } catch (err) {
      rejected++;
      errors.push(`Rij ${row.slaughter_date}: onverwachte fout — ${err}`);
    }
  }

  return { inserted, updated, rejected, errors };
}

/**
 * Verwijder alle slachtkalender entries
 * DELETE FROM slaughter_calendar
 *
 * Cascade: verwijdert eerst alle afhankelijke rijen in de juiste volgorde:
 *   1. order_lines (FK → customer_orders)
 *   2. customer_orders (FK → slaughter_calendar)
 *   3. order_schema_snapshots (FK → slaughter_calendar)
 *   4. slaughter_calendar
 */
export async function clearSlaughterCalendar(): Promise<{ deleted: number; error: string | null }> {
  const supabase = await createClient();

  // Count slaughter entries first
  const { count } = await supabase
    .from('slaughter_calendar')
    .select('*', { count: 'exact', head: true });

  // 1. Get all order IDs linked to slaughter entries
  const { data: orders } = await supabase
    .from('customer_orders')
    .select('id');

  if (orders && orders.length > 0) {
    const orderIds = orders.map((o) => o.id);

    // 2. Delete all order_lines for those orders
    const { error: linesErr } = await supabase
      .from('order_lines')
      .delete()
      .in('order_id', orderIds);

    if (linesErr) {
      return { deleted: 0, error: `Orderregels verwijderen mislukt: ${linesErr.message}` };
    }

    // 3. Delete all customer_orders
    const { error: ordersErr } = await supabase
      .from('customer_orders')
      .delete()
      .in('id', orderIds);

    if (ordersErr) {
      return { deleted: 0, error: `Orders verwijderen mislukt: ${ordersErr.message}` };
    }
  }

  // 4. Delete all snapshots
  const { error: snapshotsErr } = await supabase
    .from('order_schema_snapshots')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (snapshotsErr) {
    return { deleted: 0, error: `Snapshots verwijderen mislukt: ${snapshotsErr.message}` };
  }

  // 5. Delete all slaughter calendar entries
  const { error } = await supabase
    .from('slaughter_calendar')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');

  if (error) {
    return { deleted: 0, error: error.message };
  }

  return { deleted: count ?? 0, error: null };
}
