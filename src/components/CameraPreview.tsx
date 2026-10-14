import React, { useRef, useEffect } from 'react';
import { LineItem, DocumentBounds, ColumnBoundary, ScannerStatus } from '../types/scanner';
import { OverlayRenderer } from '../services/overlayRenderer';
import { AlertCircle, Eye, ScanLine } from 'lucide-react';

interface CameraPreviewProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  items: LineItem[];
  documentBounds?: DocumentBounds;
  columnBoundary?: ColumnBoundary;
  showDiagnostics?: boolean;
  currencySymbol?: string;
  status: ScannerStatus;
  statusMessage: string;
  isProcessing: boolean;
  fps: number;
  cameraActive: boolean;
  onStartCamera: () => void;
  permissionError?: string;
}

export const CameraPreview: React.FC<CameraPreviewProps> = ({
  videoRef,
  items,
  documentBounds,
  columnBoundary,
  showDiagnostics,
  currencySymbol = '₹',
  status,
  statusMessage,
  isProcessing,
  fps,
  cameraActive,
  onStartCamera,
  permissionError,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Render bounding boxes over live preview
  useEffect(() => {
    let animId: number;

    const renderLoop = () => {
      if (canvasRef.current && videoRef.current) {
        OverlayRenderer.render(canvasRef.current, videoRef.current, {
          items,
          documentBounds,
          columnBoundary,
          showDiagnostics,
          currencySymbol,
        });
      }
      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animId);
  }, [items, documentBounds, columnBoundary, showDiagnostics, currencySymbol]);

  return (
    <div className="relative w-full h-full flex-1 overflow-hidden bg-black select-none flex items-center justify-center">
      {/* Live Video Preview */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          cameraActive ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Overlay Canvas for Green Bounding Boxes */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
      />

      {/* Viewfinder Target Reticle / Guide Overlay */}
      {cameraActive && (
        <div className="absolute inset-x-6 inset-y-16 pointer-events-none border border-emerald-500/20 rounded-2xl z-0 flex flex-col justify-between p-4">
          <div className="flex justify-between items-start">
            <div className="w-6 h-6 border-t-2 border-l-2 border-emerald-400 rounded-tl-lg" />
            <div className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md text-[11px] font-medium text-emerald-300 border border-emerald-500/30">
              <ScanLine className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
              <span>Right column scanner</span>
            </div>
            <div className="w-6 h-6 border-t-2 border-r-2 border-emerald-400 rounded-tr-lg" />
          </div>

          {/* Right Column Target Guide */}
          <div className="self-end w-2/5 h-3/4 border-r-2 border-dashed border-emerald-400/40 rounded-r-lg flex items-center justify-center">
            <span className="text-[10px] tracking-wider uppercase font-semibold text-emerald-300/40 rotate-90 transform origin-center">
              Amount Area
            </span>
          </div>

          <div className="flex justify-between items-end">
            <div className="w-6 h-6 border-b-2 border-l-2 border-emerald-400 rounded-bl-lg" />
            <div className="w-6 h-6 border-b-2 border-r-2 border-emerald-400 rounded-br-lg" />
          </div>
        </div>
      )}

      {/* Non-active / Permission Screen */}
      {!cameraActive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-20 bg-slate-950/90 backdrop-blur-md">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4 border border-emerald-500/30">
            <Eye className="w-8 h-8 animate-pulse" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Live Bill Scanner</h2>
          <p className="text-slate-400 text-sm max-w-xs mb-6">
            Point your camera at handwritten bills, grocery receipts, or expense sheets to sum the rightmost amount column in real time.
          </p>

          {permissionError && (
            <div className="flex items-center space-x-2 text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg p-3 text-xs mb-4 max-w-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{permissionError}</span>
            </div>
          )}

          <button
            onClick={onStartCamera}
            className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold text-sm shadow-lg shadow-emerald-500/25 active:scale-95 transition-all flex items-center space-x-2"
          >
            <span>Start Live Camera</span>
          </button>
        </div>
      )}

      {/* Top Floating Status Pill */}
      {cameraActive && (
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none z-20">
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700/60 shadow-lg">
            <span
              className={`w-2 h-2 rounded-full ${
                status === 'low_quality'
                  ? 'bg-amber-400 animate-ping'
                  : isProcessing
                  ? 'bg-emerald-400 animate-pulse'
                  : 'bg-emerald-500'
              }`}
            />
            <span className="text-xs font-medium text-slate-200 truncate max-w-[200px]">
              {statusMessage}
            </span>
          </div>

          {fps > 0 && (
            <div className="px-2.5 py-1 rounded-md bg-slate-900/70 backdrop-blur-md border border-slate-800 text-[11px] font-mono text-slate-400">
              {fps} FPS
            </div>
          )}
        </div>
      )}

      {/* Low Image Quality Warning Banner */}
      {status === 'low_quality' && (
        <div className="absolute top-16 inset-x-6 z-20 bg-amber-500/90 backdrop-blur-md text-slate-950 font-medium text-xs py-2 px-3.5 rounded-xl shadow-lg flex items-center justify-center space-x-2 animate-bounce">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}
    </div>
  );
};
