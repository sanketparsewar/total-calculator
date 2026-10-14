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
  onRoiChange?: (roi: { x: number; y: number; width: number; height: number }) => void;
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
  onRoiChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Compute normalized scanning ROI coordinates relative to the video feed
  const computeRoi = () => {
    if (!boxRef.current || !videoRef.current) return;
    const box = boxRef.current.getBoundingClientRect();
    const video = videoRef.current;
    const vw = video.videoWidth || video.clientWidth;
    const vh = video.videoHeight || video.clientHeight;
    if (!vw || !vh) return;

    const cw = video.clientWidth;
    const ch = video.clientHeight;
    if (!cw || !ch) return;

    const vAspect = vw / vh;
    const cAspect = cw / ch;

    let scale = 1;
    let ox = 0;
    let oy = 0;

    if (cAspect > vAspect) {
      scale = cw / vw;
      oy = (ch - vh * scale) / 2;
    } else {
      scale = ch / vh;
      ox = (cw - vw * scale) / 2;
    }

    const rw = vw * scale;
    const rh = vh * scale;

    const normX = Math.max(0, Math.min(1, (box.left - ox) / rw));
    const normY = Math.max(0, Math.min(1, (box.top - oy) / rh));
    const normW = Math.max(0.1, Math.min(1 - normX, box.width / rw));
    const normH = Math.max(0.1, Math.min(1 - normY, box.height / rh));

    onRoiChange?.({ x: normX, y: normY, width: normW, height: normH });
  };

  useEffect(() => {
    computeRoi();
    window.addEventListener('resize', computeRoi);
    const interval = setInterval(computeRoi, 1200);
    return () => {
      window.removeEventListener('resize', computeRoi);
      clearInterval(interval);
    };
  }, [cameraActive]);

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

      {/* Mobile-Fit Scanning Rectangle (Viewfinder ROI) */}
      {cameraActive && (
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center pb-24 z-10">
          <div
            ref={boxRef}
            className="relative w-[88vw] max-w-[420px] h-[65vh] max-h-[580px] min-h-[320px] rounded-3xl border-2 border-emerald-400/80 scanner-viewport-box overflow-hidden flex flex-col justify-between p-3.5"
          >
            {/* Glowing Corner Accents */}
            <div className="absolute -top-0.5 -left-0.5 w-7 h-7 border-t-[3.5px] border-l-[3.5px] border-emerald-400 rounded-tl-2xl shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
            <div className="absolute -top-0.5 -right-0.5 w-7 h-7 border-t-[3.5px] border-r-[3.5px] border-emerald-400 rounded-tr-2xl shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
            <div className="absolute -bottom-0.5 -left-0.5 w-7 h-7 border-b-[3.5px] border-l-[3.5px] border-emerald-400 rounded-bl-2xl shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
            <div className="absolute -bottom-0.5 -right-0.5 w-7 h-7 border-b-[3.5px] border-r-[3.5px] border-emerald-400 rounded-br-2xl shadow-[0_0_12px_rgba(52,211,153,0.9)]" />

            {/* Top Scanning Helper Pill */}
            <div className="self-center flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-950/85 backdrop-blur-md border border-emerald-500/30 text-[10px] font-semibold text-emerald-300 tracking-wider uppercase shadow-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
              <span>Align numbers inside box</span>
            </div>

            {/* Animated Laser Scanning Beam */}
            <div className="absolute left-3 right-3 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] animate-laser pointer-events-none" />

            {/* Subtle bottom indicator */}
            <div className="self-center text-[10px] text-slate-400/90 tracking-wide uppercase font-medium bg-slate-950/60 px-2.5 py-0.5 rounded-md backdrop-blur-sm">
              Live Total Calculation
            </div>
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
