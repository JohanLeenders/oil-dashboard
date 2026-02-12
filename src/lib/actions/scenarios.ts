/**
 * Server Actions for Scenario Sandbox (Sprint 11A.2)
 *
 * CRUD operations for saved scenarios.
 * Uses Supabase client for database access.
 */

'use server';

import { createClient } from '@/lib/supabase/server';
import type { SandboxScenario } from '@/types/database';
import type { ScenarioInput, ScenarioResult } from '@/lib/engine/scenario-sandbox';

// ============================================================================
// TYPES
// ============================================================================

export interface CreateScenarioInput {
  batch_id: string;
  name: string;
  description?: string;
  inputs: ScenarioInput;
  result: ScenarioResult;
}

export interface UpdateScenarioNameInput {
  id: string;
  name: string;
}

export type ScenarioActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ============================================================================
// SERVER ACTIONS
// ============================================================================

/**
 * Create a new scenario and save it to the database.
 */
export async function createScenario(
  input: CreateScenarioInput
): Promise<ScenarioActionResult<SandboxScenario>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('sandbox_scenarios')
      .insert({
        batch_id: input.batch_id,
        name: input.name,
        description: input.description || null,
        inputs_json: input.inputs as unknown as Record<string, unknown>,
        result_json: input.result as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating scenario:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data as SandboxScenario };
  } catch (error) {
    console.error('Unexpected error creating scenario:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * List all scenarios for a specific batch.
 */
export async function listScenarios(
  batch_id: string
): Promise<ScenarioActionResult<SandboxScenario[]>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('sandbox_scenarios')
      .select('*')
      .eq('batch_id', batch_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error listing scenarios:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: (data as SandboxScenario[]) || [] };
  } catch (error) {
    console.error('Unexpected error listing scenarios:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Read a single scenario by ID.
 */
export async function readScenario(
  id: string
): Promise<ScenarioActionResult<SandboxScenario>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('sandbox_scenarios')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error reading scenario:', error);
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: 'Scenario not found' };
    }

    return { success: true, data: data as SandboxScenario };
  } catch (error) {
    console.error('Unexpected error reading scenario:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Rename a scenario (optional operation).
 */
export async function renameScenario(
  input: UpdateScenarioNameInput
): Promise<ScenarioActionResult<SandboxScenario>> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('sandbox_scenarios')
      .update({
        name: input.name,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.id)
      .select()
      .single();

    if (error) {
      console.error('Error renaming scenario:', error);
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: 'Scenario not found' };
    }

    return { success: true, data: data as SandboxScenario };
  } catch (error) {
    console.error('Unexpected error renaming scenario:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Delete a scenario by ID.
 */
export async function deleteScenario(
  id: string
): Promise<ScenarioActionResult<void>> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from('sandbox_scenarios')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting scenario:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Unexpected error deleting scenario:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
