'use server';

/**
 * Server Actions voor Export Bundle Page
 * Wave 4 — A4-S1: Read-only queries for finalized snapshots
 *
 * REGRESSIE-CHECK:
 * - Read-only queries
 * - No mutations
 */

import { createClient } from '@/lib/supabase/server';
import type { OrderSchemaSnapshot, ProcessingInstruction } from '@/types/database';

// ============================================================================
// Types
// ============================================================================

export interface FinalizedSnapshotRow extends OrderSchemaSnapshot {
  slaughter_date: string;
}

// ============================================================================
// READ ACTIONS
// ============================================================================

/**
 * Haal alle gefinal­iseerde snapshots op met slachtdatum
 */
export async function getFinalizedSnapshots(): Promise<FinalizedSnapshotRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('order_schema_snapshots')
    .select('*, slaughter_calendar(slaughter_date)')
    .eq('snapshot_type', 'finalized')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching finalized snapshots:', error);
    throw new Error(`Failed to fetch finalized snapshots: ${error.message}`);
  }

  return (data || []).map((row) => {
    const typed = row as Record<string, unknown> & {
      slaughter_calendar?: { slaughter_date: string } | null;
    };
    return {
      id: row.id,
      slaughter_id: row.slaughter_id,
      snapshot_type: row.snapshot_type,
      schema_data: row.schema_data,
      version: row.version,
      snapshot_date: row.snapshot_date,
      notes: row.notes,
      created_at: row.created_at,
      created_by: row.created_by,
      slaughter_date: typed.slaughter_calendar?.slaughter_date ?? 'Onbekend',
    } as FinalizedSnapshotRow;
  });
}

/**
 * Haal verwerkingsinstructies op voor een snapshot
 */
export async function getInstructionsForSnapshot(
  snapshotId: string
): Promise<ProcessingInstruction[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('processing_instructions')
    .select('*')
    .eq('snapshot_id', snapshotId)
    .order('generated_at', { ascending: false });

  if (error) {
    console.error('Error fetching instructions for snapshot:', error);
    throw new Error(`Failed to fetch instructions: ${error.message}`);
  }

  return data || [];
}
