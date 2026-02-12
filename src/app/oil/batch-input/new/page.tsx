/**
 * New Batch Input — Create a new batch from scratch.
 */

import { NewBatchShell } from '@/components/oil/batch-input/NewBatchShell';

export default function NewBatchPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Nieuwe Batch</h2>
        <p className="text-gray-600 mt-1">
          Voer de fysieke gewichten in. Rendementen worden automatisch berekend.
        </p>
      </div>

      <NewBatchShell />
    </div>
  );
}
