/**
 * TEMPORARY seed endpoint — delete after use.
 * Inserts Klein Hurksveld slaughter data directly using the Supabase client.
 * Uses createClient from @supabase/supabase-js directly (no cookie auth needed).
 */
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const KLEIN_HURKSVELD_DATA = [
  {
    slaughter_date: '2026-02-23',
    week_number: 9,
    year: 2026,
    expected_birds: 16038,
    expected_live_weight_kg: 42500.70,
    mester_breakdown: [
      { mester: 'Klein Hurksveld', stal: 1, birds: 1980, avg_weight_kg: 2.65 },
      { mester: 'Klein Hurksveld', stal: 2, birds: 3564, avg_weight_kg: 2.65 },
      { mester: 'Klein Hurksveld', stal: 3, birds: 1980, avg_weight_kg: 2.65 },
      { mester: 'Klein Hurksveld', stal: 4, birds: 8514, avg_weight_kg: 2.65 },
    ],
    slaughter_location: 'Klein Hurksveld',
    status: 'planned',
    notes: 'Ronde 18 Klein Hurksveld — 757 S, 56 dagen',
  },
  {
    slaughter_date: '2026-04-28',
    week_number: 18,
    year: 2026,
    expected_birds: 16038,
    expected_live_weight_kg: 42500.70,
    mester_breakdown: [
      { mester: 'Klein Hurksveld', stal: 1, birds: 1980, avg_weight_kg: 2.65 },
      { mester: 'Klein Hurksveld', stal: 2, birds: 3564, avg_weight_kg: 2.65 },
      { mester: 'Klein Hurksveld', stal: 3, birds: 1980, avg_weight_kg: 2.65 },
      { mester: 'Klein Hurksveld', stal: 4, birds: 8514, avg_weight_kg: 2.65 },
    ],
    slaughter_location: 'Klein Hurksveld',
    status: 'planned',
    notes: 'Ronde 19 Klein Hurksveld — 757 S, 57 dagen',
  },
  {
    slaughter_date: '2026-06-30',
    week_number: 27,
    year: 2026,
    expected_birds: 16038,
    expected_live_weight_kg: 42500.70,
    mester_breakdown: [
      { mester: 'Klein Hurksveld', stal: 1, birds: 1980, avg_weight_kg: 2.65 },
      { mester: 'Klein Hurksveld', stal: 2, birds: 3564, avg_weight_kg: 2.65 },
      { mester: 'Klein Hurksveld', stal: 3, birds: 1980, avg_weight_kg: 2.65 },
      { mester: 'Klein Hurksveld', stal: 4, birds: 8514, avg_weight_kg: 2.65 },
    ],
    slaughter_location: 'Klein Hurksveld',
    status: 'planned',
    notes: 'Ronde 20 Klein Hurksveld — 757 S, 57 dagen',
  },
  {
    slaughter_date: '2026-09-01',
    week_number: 36,
    year: 2026,
    expected_birds: 16038,
    expected_live_weight_kg: 42500.70,
    mester_breakdown: [
      { mester: 'Klein Hurksveld', stal: 1, birds: 1980, avg_weight_kg: 2.65 },
      { mester: 'Klein Hurksveld', stal: 2, birds: 3564, avg_weight_kg: 2.65 },
      { mester: 'Klein Hurksveld', stal: 3, birds: 1980, avg_weight_kg: 2.65 },
      { mester: 'Klein Hurksveld', stal: 4, birds: 8514, avg_weight_kg: 2.65 },
    ],
    slaughter_location: 'Klein Hurksveld',
    status: 'planned',
    notes: 'Ronde 21 Klein Hurksveld — 757 S, 57 dagen',
  },
  {
    slaughter_date: '2026-11-03',
    week_number: 45,
    year: 2026,
    expected_birds: 16038,
    expected_live_weight_kg: 42500.70,
    mester_breakdown: [
      { mester: 'Klein Hurksveld', stal: 1, birds: 1980, avg_weight_kg: 2.65 },
      { mester: 'Klein Hurksveld', stal: 2, birds: 3564, avg_weight_kg: 2.65 },
      { mester: 'Klein Hurksveld', stal: 3, birds: 1980, avg_weight_kg: 2.65 },
      { mester: 'Klein Hurksveld', stal: 4, birds: 8514, avg_weight_kg: 2.65 },
    ],
    slaughter_location: 'Klein Hurksveld',
    status: 'planned',
    notes: 'Ronde 22 Klein Hurksveld — 757 S, 57 dagen',
  },
  {
    slaughter_date: '2027-01-05',
    week_number: 1,
    year: 2027,
    expected_birds: 16038,
    expected_live_weight_kg: 42500.70,
    mester_breakdown: [
      { mester: 'Klein Hurksveld', stal: 1, birds: 1980, avg_weight_kg: 2.65 },
      { mester: 'Klein Hurksveld', stal: 2, birds: 3564, avg_weight_kg: 2.65 },
      { mester: 'Klein Hurksveld', stal: 3, birds: 1980, avg_weight_kg: 2.65 },
      { mester: 'Klein Hurksveld', stal: 4, birds: 8514, avg_weight_kg: 2.65 },
    ],
    slaughter_location: 'Klein Hurksveld',
    status: 'planned',
    notes: 'Ronde 23 Klein Hurksveld — 757 S, 57 dagen',
  },
];

export async function GET() {
  // createClient inside handler to avoid build-time evaluation without env vars
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  // This is an anon client — RLS will block it.
  // Instead, use the service role or temporarily disable RLS.
  // For now, just try the insert and report the result.
  const results = [];

  for (const row of KLEIN_HURKSVELD_DATA) {
    const { data, error } = await supabase
      .from('slaughter_calendar')
      .insert(row)
      .select();

    results.push({
      date: row.slaughter_date,
      success: !error,
      error: error?.message,
    });
  }

  return NextResponse.json({ results });
}
