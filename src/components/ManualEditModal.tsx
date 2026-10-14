import React, { useState, useEffect } from 'react';
import { LineItem } from '../types/scanner';
import { AmountParser } from '../services/amountParser';
import { X, Check } from 'lucide-react';

interface ManualEditModalProps {
  isOpen: boolean;
  item: LineItem | null;
  currencySymbol: string;
  onClose: () => void;
  onSave: (amountPaise: number) => void;
}

export const ManualEditModal: React.FC<ManualEditModalProps> = ({
  isOpen,
  item,
  currencySymbol,
  onClose,
  onSave,
}) => {
  const [val, setVal] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setVal(item.displayAmount);
    } else {
      setVal('');
    }
    setError(null);
  }, [item, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const parsed = AmountParser.parseToPaise(val);
    if (!parsed || parsed.paise <= 0) {
      setError('Please enter a valid monetary amount (e.g. 125.00 or 46)');
      return;
    }
    onSave(parsed.paise);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-white">
            {item ? 'Edit Detected Amount' : 'Add Missing Amount'}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Monetary Amount ({currencySymbol})
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold font-mono">
              {currencySymbol}
            </span>
            <input
              type="text"
              autoFocus
              inputMode="decimal"
              value={val}
              onChange={(e) => {
                setVal(e.target.value);
                setError(null);
              }}
              placeholder="e.g. 125.00"
              className="w-full pl-8 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-xl font-bold focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          {error && <p className="text-rose-400 text-xs mt-1.5">{error}</p>}
        </div>

        <div className="flex items-center justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-slate-300 font-semibold text-xs hover:bg-slate-800 active:scale-95 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold text-xs shadow-lg shadow-emerald-500/20 active:scale-95 transition-all flex items-center space-x-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Save Amount</span>
          </button>
        </div>
      </div>
    </div>
  );
};
