import React from 'react';
import { TotalSummary } from '../types/scanner';
import { ChevronUp, RotateCcw, ListFilter, Lock, Play } from 'lucide-react';

interface StickyTotalPanelProps {
  summary: TotalSummary;
  onOpenDrawer: () => void;
  onReset: () => void;
  isPaused: boolean;
  onTogglePause: () => void;
  statusText?: string;
}

export const StickyTotalPanel: React.FC<StickyTotalPanelProps> = ({
  summary,
  onOpenDrawer,
  onReset,
  isPaused,
  onTogglePause,
  statusText,
}) => {
  return (
    <div className="fixed bottom-0 inset-x-0 z-30 pointer-events-auto pb-safe">
      <div className="mx-3 mb-3 p-4 rounded-2xl bg-slate-900/90 backdrop-blur-xl border border-slate-700/60 shadow-2xl shadow-black/60 transition-all">
        <div className="flex items-center justify-between">
          {/* Left: Live Total Label & Big Amount */}
          <div className="flex flex-col">
            <div className="flex items-center space-x-2 mb-0.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  isPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'
                }`}
              />
              <span className="text-[11px] font-bold tracking-wider uppercase text-emerald-400">
                LIVE TOTAL
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium border flex items-center space-x-1 ${
                  isPaused
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                }`}
              >
                {isPaused ? <Lock className="w-2.5 h-2.5" /> : null}
                <span>{isPaused ? 'Locked' : statusText || 'Scanning...'}</span>
              </span>
            </div>

            <div className="text-3xl sm:text-4xl font-black tracking-tight text-white font-mono">
              {summary.formattedTotal}
            </div>

            <div className="text-xs text-slate-400 flex items-center space-x-2 mt-0.5">
              <span className="font-semibold text-slate-200">
                {summary.itemCount} {summary.itemCount === 1 ? 'item' : 'items'} detected
              </span>
              {summary.uncertainCount > 0 && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="text-amber-400">{summary.uncertainCount} uncertain</span>
                </>
              )}
            </div>
          </div>

          {/* Right: Quick Action Controls */}
          <div className="flex items-center space-x-2">
            {/* Pause / Lock Toggle Button */}
            <button
              onClick={onTogglePause}
              title={isPaused ? 'Unlock & resume scanning' : 'Pause & lock current amounts'}
              className={`flex items-center space-x-1.5 px-3 py-2.5 rounded-xl border text-xs font-bold active:scale-95 transition-all shadow-md ${
                isPaused
                  ? 'bg-amber-500/25 text-amber-300 border-amber-500/50 shadow-amber-500/10'
                  : 'bg-slate-800/90 text-slate-200 border-slate-700 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {isPaused ? (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Resume</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Pause/Lock</span>
                </>
              )}
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
