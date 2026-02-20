'use server';

import { createClient } from '@/lib/supabase/server';
import type { SimulatedAvailability } from '@/lib/engine/availability/simulator';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlanningScenario {
  id: string;
  slaughter_id: string;
  name: string;
  description: string | null;
  planning_inputs: Record<string, unknown>;
  cascaded_result: Record<string, unknown>;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export async function createPlanningScenario(
  slaughterId: string,
  name: string,
  description: string | null,
  simulationResult: SimulatedAvailability
): Promise<PlanningScenario> {
  const supabase = await createClient();

  // Separate inputs from cascaded result for storage
  const planningInputs = {
    input_birds: simulationResult.input_birds,
    input_live_weight_kg: simulationResult.input_live_weight_kg,
    avg_live_weight_kg: simulationResult.avg_live_weight_kg,
    griller_yield_pct: simulationResult.griller_yield_pct,
    original_griller_kg: simulationResult.original_griller_kg,
    whole_bird_pulls: simulationResult.whole_bird_pulls,
    total_whole_birds_pulled: simulationResult.total_whole_birds_pulled,
    total_whole_bird_kg: simulationResult.total_whole_bird_kg,
    remaining_birds: simulationResult.remaining_birds,
    remaining_live_weight_kg: simulationResult.remaining_live_weight_kg,
    adjusted_avg_live_weight_kg: simulationResult.adjusted_avg_live_weight_kg,
    adjusted_avg_griller_weight_kg: simulationResult.adjusted_avg_griller_weight_kg,
    remaining_griller_kg: simulationResult.remaining_griller_kg,
  };

  const { data, error } = await supabase
    .from('order_planning_scenarios')
    .insert({
      slaughter_id: slaughterId,
      name,
      description,
      planning_inputs: planningInputs,
      cascaded_result: simulationResult.cascaded as unknown as Record<string, unknown>,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create scenario: ${error.message}`);
  return data as PlanningScenario;
}

export async function listPlanningScenarios(
  slaughterId: string
): Promise<PlanningScenario[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('order_planning_scenarios')
    .select('*')
    .eq('slaughter_id', slaughterId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to list scenarios: ${error.message}`);
  return (data ?? []) as PlanningScenario[];
}

export async function deletePlanningScenario(id: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('order_planning_scenarios')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Failed to delete scenario: ${error.message}`);
}
