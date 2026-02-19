'use server';

/**
 * Server Actions voor Planning Data (READ-ONLY)
 * Sprint: Wave 2 — A1-S1 Planning UI
 *
 * REGRESSIE-CHECK:
 * - ✅ Leest alleen uit slaughter_calendar
 * - ✅ Geen writes of mutations
 * - ✅ Server Component compatible
 */

import { createClient } from '@/lib/supabase/server';
import type { SlaughterCalendar } from '@/types/database';

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
