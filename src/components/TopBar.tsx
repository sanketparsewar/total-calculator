import React from 'react';
import { Settings, RefreshCw, Sparkles, ReceiptText } from 'lucide-react';

interface TopBarProps {
  activeProvider: string;
  isCloudReady: boolean;
  onFlipCamera: () => void;
  onOpenSettings: () => void;
  onOpenSampleBills: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeProvider,
  isCloudReady,
  onFlipCamera,
  onOpenSettings,
  onOpenSampleBills,
}) => {
  return (
    <header className="fixed top-0 inset-x-0 z-30 pointer-events-auto pt-safe">
      <div className="mx-3 mt-3 px-3.5 py-2.5 rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-slate-700/60 shadow-lg flex items-center justify-between">
        {/* App Title & Provider Tag */}
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
            <ReceiptText className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight flex items-center space-x-1.5">
              <span>Live Bill Scanner</span>
            </h1>
            <div className="flex items-center space-x-1">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isCloudReady ? 'bg-sky-400' : 'bg-emerald-400'
                }`}
              />
              <span className="text-[10px] text-slate-400 truncate max-w-[150px]">
                {activeProvider}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-1.5">
          {/* Sample Bills Demo Picker */}
          <button
            onClick={onOpenSampleBills}
            title="Test Sample Bills"
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-semibold hover:bg-indigo-500/25 active:scale-95 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Sample Bills</span>
          </button>

          {/* Flip Camera */}
          <button
            onClick={onFlipCamera}
            title="Switch front / rear camera"
            className="p-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 active:scale-95 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Settings */}
          <button
            onClick={onOpenSettings}
            title="Scanner Settings"
            className="p-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 active:scale-95 transition-all"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
