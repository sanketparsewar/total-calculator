import React from 'react';
import { TotalSummary } from '../types/scanner';
import { ChevronUp, RotateCcw, ListFilter } from 'lucide-react';

interface StickyTotalPanelProps {
  summary: TotalSummary;
  onOpenDrawer: () => void;
  onReset: () => void;
  isPaused: boolean;
  onTogglePause: () => void;
}

export const StickyTotalPanel: React.FC<StickyTotalPanelProps> = ({
  summary,
  onOpenDrawer,
  onReset,
  isPaused,
  onTogglePause,
}) => {
  return (
    <div className="fixed bottom-0 inset-x-0 z-30 pointer-events-auto pb-safe">
      <div className="mx-3 mb-3 p-4 rounded-2xl bg-slate-900/90 backdrop-blur-xl border border-slate-700/60 shadow-2xl shadow-black/60 transition-all">
        <div className="flex items-center justify-between">
          {/* Left: Live Total Label & Big Amount */}
          <div className="flex flex-col">
            <div className="flex items-center space-x-1.5 mb-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-bold tracking-wider uppercase text-emerald-400">
                LIVE TOTAL
              </span>
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white font-mono">
              {summary.formattedTotal}
            </div>
            <div className="text-xs text-slate-400 flex items-center space-x-2 mt-0.5">
              <span className="font-medium text-slate-300">
                {summary.itemCount} {summary.itemCount === 1 ? 'amount' : 'amounts'} accepted
              </span>
              {summary.uncertainCount > 0 && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="text-amber-400">{summary.uncertainCount} uncertain</span>
                </>
              )}
              {summary.excludedCount > 0 && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-500">{summary.excludedCount} excluded</span>
                </>
              )}
            </div>
          </div>

          {/* Right: Quick Action Controls */}
          <div className="flex items-center space-x-2">
            {/* Pause / Resume Button */}
            <button
              onClick={onTogglePause}
              title={isPaused ? 'Resume scanning' : 'Pause scanning'}
              className={`p-2.5 rounded-xl border text-xs font-semibold active:scale-95 transition-all ${
                isPaused
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {isPaused ? 'Resume' : 'Pause'}
            </button>

            {/* Reset Bill Button */}
            <button
              onClick={onReset}
              title="Clear bill and start fresh"
              className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 active:scale-95 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* View / Edit Items Drawer Toggle */}
            <button
              onClick={onOpenDrawer}
              className="flex items-center space-x-1.5 px-3 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-semibold shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
            >
              <ListFilter className="w-4 h-4" />
              <span>Items</span>
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
