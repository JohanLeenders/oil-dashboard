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
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full px-6 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {/* Level badge */}
          <span className={`px-2 py-0.5 rounded text-xs font-bold ${meta.colorBg} ${meta.color}`}>
            Level {level}
          </span>
          {/* Title */}
          <span className="font-medium text-gray-900">{meta.titleNL}</span>
          {/* Engine function */}
          <span className="text-xs text-gray-400 font-mono hidden md:inline">
            {meta.engineFn}()
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Rendement */}
          <span className="text-xs text-gray-500 hidden sm:inline">
            {rendement}
          </span>

          {/* Scenario diff indicator */}
          {isScenarioMode && costDiff !== null && costDiff !== 0 && (
            <span className={`text-xs font-medium ${costDiff > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatDeltaPerKg(costDiff)}
            </span>
          )}

          {/* Collapse chevron */}
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
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
        <div className="px-6 pb-6 pt-2 border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  );
}
