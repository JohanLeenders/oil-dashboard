'use client';

import type { ExtraBewerkingInput } from '@/lib/data/demo-batch-v2';
import type { FullSKUCostResult } from '@/lib/engine/canonical-cost';
import { ExtraBewerking } from './ExtraBewerking';

interface Props {
  bewerkingen: ExtraBewerkingInput[];
  onAdd: () => void;
  onUpdate: (id: string, updates: Partial<ExtraBewerkingInput>) => void;
  onRemove: (id: string) => void;
  level6Result: FullSKUCostResult;
}

export function ExtraBewerkingList({
  bewerkingen,
  onAdd,
  onUpdate,
  onRemove,
  level6Result,
}: Props) {
  return (
    <div className="space-y-4">
      {bewerkingen.length === 0 ? (
        <p className="text-sm text-gray-500 italic">
          Geen extra bewerkingen toegevoegd. Klik hieronder om er een toe te voegen.
        </p>
      ) : (
        bewerkingen.map((b) => (
          <ExtraBewerking
            key={b.id}
            bewerking={b}
            onUpdate={(updates) => onUpdate(b.id, updates)}
            onRemove={() => onRemove(b.id)}
            inputSkuCost={level6Result}
          />
        ))
      )}

      <button
        onClick={onAdd}
        className="w-full py-2 px-4 border-2 border-dashed border-yellow-300 rounded-lg text-sm text-yellow-700 hover:bg-yellow-50 hover:border-yellow-400 transition-colors"
      >
        + Voeg extra bewerking toe
      </button>
    </div>
  );
}
