import React from 'react';
import { LineItem, TotalSummary } from '../types/scanner';
import { X, Check, EyeOff, Edit2, Trash2, Plus, AlertTriangle, ShieldCheck } from 'lucide-react';

interface ItemsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: LineItem[];
  summary: TotalSummary;
  currencySymbol: string;
  onEditItem: (item: LineItem) => void;
  onToggleInclusion: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onAddManual: () => void;
  onClearAll: () => void;
}

export const ItemsDrawer: React.FC<ItemsDrawerProps> = ({
  isOpen,
  onClose,
  items,
  summary,
  currencySymbol,
  onEditItem,
  onToggleInclusion,
  onDeleteItem,
  onAddManual,
  onClearAll,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Background Dismiss Tap */}
      <div className="flex-1" onClick={onClose} />

      {/* Drawer Card */}
      <div className="bg-slate-900 border-t border-slate-700/80 rounded-t-3xl max-h-[85vh] max-h-[85dvh] flex flex-col shadow-2xl overflow-hidden pb-safe">
        {/* Mobile Pull / Drag Indicator Handle */}
        <div className="w-10 h-1.5 bg-slate-700/80 rounded-full mx-auto mt-2.5 mb-1 flex-shrink-0" />

        {/* Header Bar */}
        <div className="px-3 sm:px-4 py-2.5 sm:py-3.5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 min-w-0">
            <span className="w-2.5 h-2.5 flex-shrink-0 rounded-full bg-emerald-400" />
            <h3 className="text-sm sm:text-base font-bold text-white truncate">Detected Items</h3>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] sm:text-[11px] font-mono text-emerald-400 font-semibold border border-slate-700 flex-shrink-0">
              {summary.itemCount} Included
            </span>
          </div>

          <div className="flex items-center space-x-1.5 sm:space-x-2 flex-shrink-0">
            <button
              onClick={onAddManual}
              className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center space-x-1 hover:bg-emerald-500/30 active:scale-95 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 active:scale-95 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Total Banner Inside Drawer */}
        <div className="px-4 py-3 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              Current Live Sum
            </div>
            <div className="text-2xl font-black text-emerald-400 font-mono">
              {summary.formattedTotal}
            </div>
          </div>
          <button
            onClick={onClearAll}
            className="text-xs text-rose-400 hover:text-rose-300 font-medium px-2.5 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 active:scale-95 transition-all"
          >
            Clear Document
          </button>
        </div>

        {/* Items Scrollable List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {items.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              No amounts detected yet. Point the camera at a handwritten bill amount column.
            </div>
          ) : (
            items.map((item) => {
              const isIncluded = item.isIncluded && item.validationStatus === 'accepted';
              return (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl border transition-all flex items-center justify-between ${
                    isIncluded
                      ? 'bg-slate-800/60 border-emerald-500/40 text-slate-100'
                      : item.validationStatus === 'uncertain'
                      ? 'bg-amber-950/20 border-amber-500/30 text-amber-200'
                      : 'bg-slate-900/40 border-slate-800 text-slate-500 opacity-70'
                  }`}
                >
                  {/* Left: Checkmark & Details */}
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => onToggleInclusion(item.id)}
                      title={isIncluded ? 'Exclude from sum' : 'Include in sum'}
                      className={`w-6 h-6 rounded-lg flex items-center justify-center border text-xs transition-all ${
                        isIncluded
                          ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                          : 'border-slate-600 bg-slate-800/80 text-slate-400'
                      }`}
                    >
                      {isIncluded ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>

                    <div>
                      <div className="flex items-center space-x-2">
                        <span
                          className={`font-mono text-base font-bold ${
                            isIncluded ? 'text-white' : 'line-through text-slate-400'
                          }`}
                        >
                          {currencySymbol}
                          {item.displayAmount}
                        </span>
                        {item.isManuallyEdited && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            Edited
                          </span>
                        )}
                        {item.validationStatus === 'accepted' && !item.isManuallyEdited && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 flex items-center space-x-0.5">
                            <ShieldCheck className="w-3 h-3" />
                            <span>{(item.confidence * 100).toFixed(0)}%</span>
                          </span>
                        )}
                        {item.validationStatus === 'uncertain' && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 flex items-center space-x-0.5">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Review</span>
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                        {item.exclusionReason || `OCR: "${item.originalText}"`}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => onEditItem(item)}
                      title="Edit amount"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 active:scale-95 transition-all"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDeleteItem(item.id)}
                      title="Delete item"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-700 active:scale-95 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
