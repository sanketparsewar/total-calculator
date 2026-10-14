import React from 'react';
import { TotalSummary } from '../types/scanner';
import { RotateCcw } from 'lucide-react';

interface StickyTotalPanelProps {
  summary: TotalSummary;
  onReset: () => void;
  statusText?: string;
}

export const StickyTotalPanel: React.FC<StickyTotalPanelProps> = ({
  summary,
  onReset,
  statusText,
}) => {
  return (
    <div className="fixed bottom-0 inset-x-0 z-30 pointer-events-auto pb-safe px-safe">
      <div className="mx-3 mb-4 p-4 rounded-3xl bg-slate-900/90 backdrop-blur-2xl border border-slate-700/60 shadow-2xl shadow-black/80 flex items-center justify-between">
        {/* Total Display */}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center space-x-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
            <span className="text-[11px] font-bold tracking-wider uppercase text-emerald-400">
              LIVE TOTAL
            </span>
            <span className="text-[10px] text-slate-400 truncate">
              {summary.itemCount > 0
                ? `${summary.itemCount} number${summary.itemCount === 1 ? '' : 's'} detected`
                : statusText || 'Scanning live feed...'}
            </span>
          </div>

          <div className="text-3xl sm:text-5xl font-black tracking-tight text-white font-mono leading-none">
            {summary.formattedTotal}
          </div>
        </div>

        {/* Subtle Reset button */}
        {summary.itemCount > 0 && (
          <button
            onClick={onReset}
            title="Clear and scan new bill"
            className="p-3 rounded-2xl bg-slate-800/80 hover:bg-slate-700/90 text-slate-300 hover:text-white border border-slate-700/80 active:scale-95 transition-all flex items-center space-x-1.5 touch-target ml-3"
          >
            <RotateCcw className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold">Clear</span>
          </button>
        )}
      </div>
    </div>
  );
};
