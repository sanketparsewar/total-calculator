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
    <div className="fixed bottom-0 inset-x-0 z-30 pointer-events-auto pb-safe px-safe">
      <div className="mx-2 sm:mx-3 mb-2 sm:mb-3 p-3 sm:p-4 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-slate-700/60 shadow-2xl shadow-black/60 transition-all">
        <div className="flex items-center justify-between gap-2">
          {/* Left: Live Total Label & Big Amount */}
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center space-x-1.5 sm:space-x-2 mb-0.5">
              <span
                className={`w-2 h-2 flex-shrink-0 rounded-full ${
                  isPaused ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'
                }`}
              />
              <span className="text-[10px] sm:text-[11px] font-bold tracking-wider uppercase text-emerald-400 flex-shrink-0">
                LIVE TOTAL
              </span>
              <span
                className={`text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-full font-medium border flex items-center space-x-1 truncate ${
                  isPaused
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                }`}
              >
                {isPaused ? <Lock className="w-2.5 h-2.5 flex-shrink-0" /> : null}
                <span className="truncate">{isPaused ? 'Locked' : statusText || 'Scanning...'}</span>
              </span>
            </div>

            <div className="text-2xl min-[380px]:text-3xl sm:text-4xl font-black tracking-tight text-white font-mono leading-tight truncate">
              {summary.formattedTotal}
            </div>

            <div className="text-[11px] sm:text-xs text-slate-400 flex items-center space-x-1.5 sm:space-x-2 mt-0.5 truncate">
              <span className="font-semibold text-slate-200 truncate">
                {summary.itemCount} {summary.itemCount === 1 ? 'item' : 'items'} detected
              </span>
              {summary.uncertainCount > 0 && (
                <>
                  <span className="text-slate-600">•</span>
                  <span className="text-amber-400 truncate">{summary.uncertainCount} uncertain</span>
                </>
              )}
            </div>
          </div>

          {/* Right: Quick Action Controls */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 flex-shrink-0">
            {/* Pause / Lock Toggle Button */}
            <button
              onClick={onTogglePause}
              title={isPaused ? 'Unlock & resume scanning' : 'Pause & lock current amounts'}
              className={`flex items-center justify-center space-x-1 px-2.5 py-2 sm:px-3 sm:py-2.5 rounded-xl border text-xs font-bold active:scale-95 transition-all shadow-md touch-target ${
                isPaused
                  ? 'bg-amber-500/25 text-amber-300 border-amber-500/50 shadow-amber-500/10'
                  : 'bg-slate-800/90 text-slate-200 border-slate-700 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {isPaused ? (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span className="hidden min-[380px]:inline">Resume</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span className="hidden min-[380px]:inline">Pause</span>
                </>
              )}
            </button>

            {/* Reset Bill Button */}
            <button
              onClick={onReset}
              title="Clear bill and start fresh"
              className="p-2 sm:p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 active:scale-95 transition-all flex items-center justify-center touch-target"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* View / Edit Items Drawer Toggle */}
            <button
              onClick={onOpenDrawer}
              title="View and edit detected items"
              className="flex items-center justify-center space-x-1 sm:space-x-1.5 px-2.5 py-2 sm:px-3 sm:py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-semibold shadow-lg shadow-emerald-500/20 active:scale-95 transition-all touch-target"
            >
              <ListFilter className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="font-mono font-bold text-xs">{summary.itemCount}</span>
              <span className="hidden min-[440px]:inline">Items</span>
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
