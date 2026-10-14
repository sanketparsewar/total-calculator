import React, { useRef, useEffect } from 'react';
import { LineItem, DocumentBounds, ColumnBoundary, ScannerStatus } from '../types/scanner';
import { OverlayRenderer } from '../services/overlayRenderer';
import { Camera, AlertCircle } from 'lucide-react';

interface CameraPreviewProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  items: LineItem[];
  documentBounds?: DocumentBounds;
  columnBoundary?: ColumnBoundary;
  currencySymbol?: string;
  status: ScannerStatus;
  statusMessage: string;
  isProcessing: boolean;
  cameraActive: boolean;
  onStartCamera: () => void;
  permissionError?: string;
}

export const CameraPreview: React.FC<CameraPreviewProps> = ({
  videoRef,
  items,
  documentBounds,
  columnBoundary,
  currencySymbol = '₹',
  cameraActive,
  onStartCamera,
  permissionError,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Render bounding boxes over live video feed
  useEffect(() => {
    let animId: number;

    const renderLoop = () => {
      if (canvasRef.current && videoRef.current) {
        OverlayRenderer.render(canvasRef.current, videoRef.current, {
          items,
          documentBounds,
          columnBoundary,
          showDiagnostics: false,
          currencySymbol,
          fit: 'cover',
        });
      }
      animId = requestAnimationFrame(renderLoop);
    };

    animId = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(animId);
  }, [items, documentBounds, columnBoundary, currencySymbol, videoRef]);

  return (
    <div className="relative w-full h-full flex-1 overflow-hidden bg-black select-none flex items-center justify-center">
      {/* Live Full-Screen Video Stream */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          cameraActive ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Overlay Canvas for Real-Time Green Bounding Boxes */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
      />

      {/* Clean Subtle Reticle Guide (Corner brackets only) */}
      {cameraActive && (
        <div className="absolute inset-6 sm:inset-10 top-8 bottom-28 pointer-events-none z-0 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="w-8 h-8 border-t-2 border-l-2 border-emerald-400/60 rounded-tl-xl" />
            <div className="w-8 h-8 border-t-2 border-r-2 border-emerald-400/60 rounded-tr-xl" />
          </div>

          <div className="flex justify-between items-end">
            <div className="w-8 h-8 border-b-2 border-l-2 border-emerald-400/60 rounded-bl-xl" />
            <div className="w-8 h-8 border-b-2 border-r-2 border-emerald-400/60 rounded-br-xl" />
          </div>
        </div>
      )}

      {/* Minimal Camera Permission Activation (Shown only if camera not yet active) */}
      {!cameraActive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-20 bg-slate-950/95 backdrop-blur-md px-safe py-safe">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-6 border border-emerald-500/30 shadow-lg shadow-emerald-500/10">
            <Camera className="w-10 h-10 animate-pulse" />
          </div>
          <h1 className="text-3xl font-black text-white mb-2 tracking-tight">Bill Calculator</h1>
          <p className="text-slate-400 text-sm max-w-xs mb-8">
            Point your camera at the bill or column of numbers. They will be detected and summed in real time.
          </p>

          {permissionError && (
            <div className="flex items-center space-x-2 text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3.5 text-xs mb-6 max-w-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{permissionError}</span>
            </div>
          )}

          <button
            onClick={onStartCamera}
            className="w-full max-w-xs py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-base shadow-xl shadow-emerald-500/25 active:scale-95 transition-all flex items-center justify-center space-x-2 touch-target"
          >
            <Camera className="w-5 h-5" />
            <span>Open Camera</span>
          </button>
        </div>
      )}
    </div>
  );
};

