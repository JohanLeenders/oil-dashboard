'use client';

import { formatDeltaPerKg } from '@/lib/data/demo-batch-v2';

interface LevelMeta {
  level: number | string;
  titleNL: string;
  engineFn: string;
  color: string;
  colorBg: string;
}

interface Props {
  level: number | string;
  meta: LevelMeta;
  rendement: string;
  isCollapsed: boolean;
  onToggle: () => void;
  isScenarioMode: boolean;
  costDiff: number | null;
  children: React.ReactNode;
}

export function WaterfallLevelCard({
  level,
  meta,
  rendement,
  isCollapsed,
  onToggle,
  isScenarioMode,
  costDiff,
  children,
}: Props) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-shadow hover:shadow-md">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {/* Level badge — round pill */}
          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${meta.colorBg} ${meta.color}`}>
            {level}
          </span>
          {/* Title */}
          <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{meta.titleNL}</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Rendement */}
          <span className="text-xs text-gray-400 hidden sm:inline tabular-nums">
            {rendement}
          </span>

          {/* Scenario diff indicator */}
          {isScenarioMode && costDiff !== null && costDiff !== 0 && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${costDiff > 0 ? 'text-red-700 bg-red-50 dark:bg-red-900/40' : 'text-green-700 bg-green-50 dark:bg-green-900/40'}`}>
              {formatDeltaPerKg(costDiff)}
            </span>
          )}

          {/* Collapse chevron */}
          <svg
            className={`w-4 h-4 text-gray-300 dark:text-gray-500 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </button>

      {/* Body (expanded by default) */}
      {!isCollapsed && (
        <div className="px-5 pb-5 pt-2 border-t border-gray-50 dark:border-gray-700">
          {children}
        </div>
      )}
    </div>
  );
}
