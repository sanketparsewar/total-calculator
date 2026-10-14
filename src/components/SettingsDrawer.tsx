import React from 'react';
import { ScannerConfig } from '../types/scanner';
import { X, Sliders, Shield, Cpu, HelpCircle } from 'lucide-react';

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  config: ScannerConfig;
  onUpdateConfig: (newConfig: Partial<ScannerConfig>) => void;
  isCloudReady: boolean;
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
  isCloudReady,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex-1" onClick={onClose} />

      <div className="bg-slate-900 border-t border-slate-700/80 rounded-t-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden pb-safe">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sliders className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">Scanner Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Settings Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-sm">
          {/* OCR Engine Selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
              <span>OCR Provider</span>
              <Cpu className="w-3.5 h-3.5 text-slate-400" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onUpdateConfig({ ocrProvider: 'local' })}
                className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  config.ocrProvider === 'local'
                    ? 'bg-emerald-500/15 border-emerald-500 text-white'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <div className="font-bold text-xs">Local On-Device</div>
                <div className="text-[11px] text-slate-400 mt-1">100% private in browser</div>
              </button>

              <button
                onClick={() => onUpdateConfig({ ocrProvider: 'cloud' })}
                disabled={!isCloudReady}
                className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  config.ocrProvider === 'cloud'
                    ? 'bg-sky-500/15 border-sky-500 text-white'
                    : isCloudReady
                    ? 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800'
                    : 'bg-slate-800/30 border-slate-800 text-slate-600 cursor-not-allowed'
                }`}
              >
                <div className="font-bold text-xs flex items-center justify-between">
                  <span>Cloud Neural OCR</span>
                  {!isCloudReady && <span className="text-[10px] text-amber-500">No Key</span>}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {isCloudReady ? 'Google / OpenAI Vision' : 'Configure in .env'}
                </div>
              </button>
            </div>
            {!isCloudReady && (
              <p className="text-[11px] text-slate-500 mt-1.5 flex items-center space-x-1">
                <HelpCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>To enable neural cloud OCR, add GOOGLE_VISION_API_KEY or OPENAI_API_KEY in server/.env.</span>
              </p>
            )}
          </div>

          {/* Currency Symbol */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Currency Symbol
            </label>
            <div className="grid grid-cols-4 gap-2">
              {['₹', '$', '€', '£'].map((sym) => (
                <button
                  key={sym}
                  onClick={() => onUpdateConfig({ currencySymbol: sym })}
                  className={`py-2 rounded-xl border font-bold text-base transition-all ${
                    config.currencySymbol === sym
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                      : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  {sym}
                </button>
              ))}
            </div>
          </div>

          {/* Amount Column Detection Mode */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Column Detection Mode
            </label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                onClick={() => onUpdateConfig({ columnDetectionMode: 'auto' })}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                  config.columnDetectionMode === 'auto'
                    ? 'bg-emerald-500/20 border-emerald-500 text-white'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400'
                }`}
              >
                Auto (Rightmost Column)
              </button>
              <button
                onClick={() => onUpdateConfig({ columnDetectionMode: 'manual' })}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                  config.columnDetectionMode === 'manual'
                    ? 'bg-emerald-500/20 border-emerald-500 text-white'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400'
                }`}
              >
                Manual Region Setting
              </button>
            </div>

            {config.columnDetectionMode === 'manual' && (
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Column start position</span>
                  <span className="font-mono text-emerald-400">
                    {(config.manualColumnMinX * 100).toFixed(0)}% from left
                  </span>
                </div>
                <input
                  type="range"
                  min="0.30"
                  max="0.85"
                  step="0.05"
                  value={config.manualColumnMinX}
                  onChange={(e) => onUpdateConfig({ manualColumnMinX: parseFloat(e.target.value) })}
                  className="w-full accent-emerald-500"
                />
              </div>
            )}
          </div>

          {/* Confidence Threshold */}
          <div>
            <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              <span>Confidence Acceptance Threshold</span>
              <span className="font-mono text-emerald-400">
                {(config.minConfidence * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="0.40"
              max="0.85"
              step="0.05"
              value={config.minConfidence}
              onChange={(e) => onUpdateConfig({ minConfidence: parseFloat(e.target.value) })}
              className="w-full accent-emerald-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Higher values reduce false positives from notebook paper smudges.
            </p>
          </div>

          {/* Toggle Switches */}
          <div className="space-y-3 pt-2 border-t border-slate-800">
            {/* Exclude Grand Total */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-white flex items-center space-x-1.5">
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Exclude Pre-Existing Grand Total</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Prevents counting the document's printed/written sum
                </div>
              </div>
              <input
                type="checkbox"
                checked={config.excludeTotals}
                onChange={(e) => onUpdateConfig({ excludeTotals: e.target.checked })}
                className="w-4 h-4 accent-emerald-500 rounded"
              />
            </div>

            {/* Diagnostic Overlays */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-white">Show Diagnostic Overlays</div>
                <div className="text-[11px] text-slate-400">
                  Draw column guideline and rejected candidates in red
                </div>
              </div>
              <input
                type="checkbox"
                checked={config.showDiagnostics}
                onChange={(e) => onUpdateConfig({ showDiagnostics: e.target.checked })}
                className="w-4 h-4 accent-emerald-500 rounded"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
