import React, { useState } from 'react';
import { SAMPLE_BILLS, SampleBill, renderSampleBillToCanvas } from '../data/sampleBills';
import { X, Play, CheckCircle2 } from 'lucide-react';

interface SampleBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTestSample: (canvas: HTMLCanvasElement) => Promise<void>;
  currentTotalFormatted: string;
}

export const SampleBillModal: React.FC<SampleBillModalProps> = ({
  isOpen,
  onClose,
  onTestSample,
  currentTotalFormatted,
}) => {
  const [selectedBill, setSelectedBill] = useState<SampleBill>(SAMPLE_BILLS[0]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [testedBillId, setTestedBillId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRunTest = async (bill: SampleBill) => {
    setSelectedBill(bill);
    setIsProcessing(true);
    try {
      const canvas = renderSampleBillToCanvas(bill);
      await onTestSample(canvas);
      setTestedBillId(bill.id);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl p-5 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white flex items-center space-x-2">
              <span>Benchmark & Sample Bills</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Test the real-time detection & summation engine against standard handwritten bills.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Bill Selection Cards */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3">
          {SAMPLE_BILLS.map((bill) => {
            const isSelected = selectedBill.id === bill.id;
            const hasBeenTested = testedBillId === bill.id;

            return (
              <div
                key={bill.id}
                className={`p-4 rounded-2xl border transition-all ${
                  isSelected
                    ? 'bg-slate-800/80 border-emerald-500/60 shadow-lg'
                    : 'bg-slate-950/40 border-slate-800 hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-sm text-white">{bill.title}</h4>
                    <div className="flex items-center space-x-2 text-xs text-slate-400 mt-1">
                      <span>{bill.items.length} Line Items</span>
                      <span>•</span>
                      <span className="font-semibold text-emerald-400">
                        Ground Truth: {bill.groundTruthFormatted}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRunTest(bill)}
                    disabled={isProcessing}
                    className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold text-xs shadow-md shadow-emerald-500/20 active:scale-95 transition-all disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{isProcessing && isSelected ? 'Scanning...' : 'Test Bill'}</span>
                  </button>
                </div>

                {/* Bill Preview Preview Snippet */}
                <div className="mt-3 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[11px] font-mono text-slate-300">
                  <div className="text-slate-500 mb-1">Sample Amounts Included:</div>
                  <div className="truncate">
                    {bill.items.map((i) => i.amount).join(', ')}
                  </div>
                  {bill.hasGrandTotal && (
                    <div className="text-rose-400 mt-1 font-semibold">
                      Contains Grand Total: {bill.grandTotalText} (Test exclusion)
                    </div>
                  )}
                </div>

                {/* Benchmark Comparison Result */}
                {hasBeenTested && (
                  <div className="mt-2.5 p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-1.5 text-emerald-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Live Total Calculated:</span>
                    </div>
                    <span className="font-bold font-mono text-white text-sm">
                      {currentTotalFormatted}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="pt-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold hover:bg-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
