'use client';

/**
 * ProductionComparisonBar — Kg-gebaseerde vergelijkingsbalk
 *
 * Toont natuurlijke productie (wat de kippen produceren) vs
 * klantafname (wat de klant koopt) in kg, met surplus/tekort.
 *
 * Gebruikt in het Kip-overzicht tab.
 */

interface Props {
  label: string;
  productionKg: number;
  demandKg: number;
  maxKg: number;
  isLeading?: boolean;
}

export function ProductionComparisonBar({
  label,
  productionKg,
  demandKg,
  maxKg,
  isLeading = false,
}: Props) {
  const delta = productionKg - demandKg;
  const isSurplus = delta > 10;
  const isTekort = delta < -10;

  // Kleuren
  const demandColor = isTekort
    ? 'bg-red-500'
    : isSurplus
      ? 'bg-blue-500'
      : 'bg-green-500';

  const productionColor = 'bg-gray-300 dark:bg-gray-600';

  // Breedte berekening (als percentage van maxKg)
  const safeMax = maxKg > 0 ? maxKg : 1;
  const productionWidth = Math.min((productionKg / safeMax) * 100, 100);
  const demandWidth = Math.min((demandKg / safeMax) * 100, 100);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className={`font-medium w-24 truncate ${
          isLeading
            ? 'text-orange-700 dark:text-orange-400'
            : 'text-gray-700 dark:text-gray-300'
        }`}>
          {label}
          {isLeading && <span className="ml-1 text-[10px]">(bepalend)</span>}
        </span>
        <span className={`text-xs font-mono ${
          isTekort ? 'text-red-600' : isSurplus ? 'text-orange-600' : 'text-green-600'
        }`}>
          {delta > 0 ? '+' : ''}{formatKg(delta)} kg
        </span>
      </div>
      <div className="relative h-4 w-full">
        {/* Natuurlijke productie (achtergrond — grijs) */}
        <div
          className={`absolute inset-y-0 left-0 ${productionColor} rounded-sm opacity-50`}
          style={{ width: `${productionWidth}%` }}
        />
        {/* Klant afname (voorgrond — gekleurd) */}
        <div
          className={`absolute inset-y-0 left-0 ${demandColor} rounded-sm`}
          style={{ width: `${demandWidth}%`, opacity: 0.85 }}
        />
        {/* Productie marker lijn */}
        {productionKg > 0 && (
          <div
            className="absolute inset-y-0 w-0.5 bg-gray-800 dark:bg-white z-10"
            style={{ left: `${productionWidth}%` }}
            title={`Productie: ${formatKg(productionKg)} kg`}
          />
        )}
      </div>
      <div className="flex items-center justify-between text-[10px] text-gray-400">
        <span>{formatKg(demandKg)} kg afname</span>
        <span>{formatKg(productionKg)} kg productie</span>
      </div>
    </div>
  );
}

function formatKg(kg: number): string {
  return kg.toLocaleString('nl-NL', { maximumFractionDigits: 0 });
}
