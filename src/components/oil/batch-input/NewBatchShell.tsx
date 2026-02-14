'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import type { BatchInputData } from '@/lib/data/batch-input-store';
import { saveBatch } from '@/lib/data/batch-input-store';
import { BatchInputForm } from './BatchInputForm';

function createEmptyBatch(): BatchInputData {
  const id = `BATCH-${Date.now()}`;
  return {
    batch_id: id,
    batch_ref: id,
    date: new Date().toISOString().slice(0, 10),
    batch_profile: 'oranjehoen',
    bird_count: 0,
    doa_count: 0,
    live_weight_kg: 0,
    griller_weight_kg: 0,
    slaughter_cost_mode: 'per_bird',
    slaughter_cost_per_bird: 0,
    slaughter_cost_total: 0,
    breast_cap_kg: 0,
    legs_kg: 0,
    wings_kg: 0,
    joint_products: [],
    filet_kg: 0,
    thigh_fillet_kg: 0,
    drum_meat_kg: 0,
    blood_kg: 0,
    feathers_kg: 0,
    offal_kg: 0,
    back_carcass_kg: 0,
    cat3_other_kg: 0,
    live_cost_per_kg: 0,
    transport_cost_eur: 0,
    catching_fee_eur: 0,
  };
}

export function NewBatchShell() {
  const router = useRouter();

  const handleSave = useCallback((data: BatchInputData) => {
    saveBatch(data);
    router.push(`/oil/batch-input/${encodeURIComponent(data.batch_id)}`);
  }, [router]);

  const handleSaveAndRecalc = useCallback((data: BatchInputData) => {
    saveBatch(data);
    router.push(`/oil/batch-input/${encodeURIComponent(data.batch_id)}`);
  }, [router]);

  return (
    <BatchInputForm
      initialData={createEmptyBatch()}
      onSave={handleSave}
      onSaveAndRecalc={handleSaveAndRecalc}
    />
  );
}
