import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CameraService } from './services/cameraService';
import { OcrManager } from './services/ocr/ocrManager';
import { LineItemTracker } from './services/lineItemTracker';
import { FrameProcessor, FrameProcessingEvent } from './services/frameProcessor';
import {
  ScannerConfig,
  ScannerStatus,
  LineItem,
  TotalSummary,
  DocumentBounds,
  ColumnBoundary,
} from './types/scanner';
import { CameraPreview } from './components/CameraPreview';
import { StickyTotalPanel } from './components/StickyTotalPanel';

export const App: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Core Services
  const cameraRef = useRef<CameraService>(new CameraService());
  const ocrManagerRef = useRef<OcrManager>(new OcrManager());
  const trackerRef = useRef<LineItemTracker>(new LineItemTracker());
  const processorRef = useRef<FrameProcessor | null>(null);

  // Fast real-time configuration (700ms throttle for live camera OCR)
  const [config] = useState<ScannerConfig>({
    scanIntervalMs: 700,
    minConfidence: 0.60,
    columnDetectionMode: 'auto',
    manualColumnMinX: 0.50,
    ocrProvider: 'cloud',
    gracePeriodMs: 4000,
    currencySymbol: '₹',
    showDiagnostics: false,
    excludeTotals: true,
  });

  // UI State
  const [scannerStatus, setScannerStatus] = useState<ScannerStatus>('initializing');
  const [statusMessage, setStatusMessage] = useState<string>('Starting camera...');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [permissionError, setPermissionError] = useState<string | undefined>();

  // Scanner Results State
  const [items, setItems] = useState<LineItem[]>([]);
  const [totalSummary, setTotalSummary] = useState<TotalSummary>({
    totalPaise: 0,
    formattedTotal: '₹0.00',
    itemCount: 0,
    uncertainCount: 0,
    excludedCount: 0,
  });
  const [documentBounds, setDocumentBounds] = useState<DocumentBounds | undefined>();
  const [columnBoundary, setColumnBoundary] = useState<ColumnBoundary | undefined>();

  // Initialize OCR Manager and FrameProcessor
  useEffect(() => {
    const ocrManager = ocrManagerRef.current;
    const camera = cameraRef.current;
    const tracker = trackerRef.current;

    const savedKey = localStorage.getItem('user_gemini_api_key');
    if (savedKey) {
      ocrManager.setCustomApiKey(savedKey);
    }

    ocrManager.init();

    const processor = new FrameProcessor(camera, ocrManager, tracker, config);
    processorRef.current = processor;

    const unsubscribeProcessor = processor.onFrameProcessed((e: FrameProcessingEvent) => {
      setScannerStatus(e.status);
      setStatusMessage(e.statusMessage);
      setIsProcessing(e.isProcessing);
      setItems(e.items);
      setTotalSummary(e.totalSummary);
      setDocumentBounds(e.documentBounds);
      setColumnBoundary(e.columnBoundary);
    });

    const unsubscribeCamera = camera.onStateChange((cState) => {
      setCameraActive(cState.isActive);
      if (cState.errorMessage) {
        setPermissionError(cState.errorMessage);
        setScannerStatus('permission_denied');
        setStatusMessage(cState.errorMessage);
      }
    });

    return () => {
      unsubscribeProcessor();
      unsubscribeCamera();
      processor.stop();
      camera.destroy();
      ocrManager.terminate();
    };
  }, [config]);

  // Start Camera Automatically on Startup
  const handleStartCamera = useCallback(async () => {
    if (!videoRef.current) return;
    setPermissionError(undefined);
    setStatusMessage('Opening camera...');
    setScannerStatus('requesting_permission');

    try {
      await cameraRef.current.start(videoRef.current);
      setCameraActive(true);
      setScannerStatus('scanning');
      setStatusMessage('Scanning bill for amounts...');
      if (processorRef.current) {
        processorRef.current.start();
      }
    } catch (err: any) {
      setPermissionError(err.message || 'Could not start camera');
      setScannerStatus('permission_denied');
    }
  }, []);

  // Auto-launch camera when component mounts
  useEffect(() => {
    if (videoRef.current && !cameraActive) {
      handleStartCamera();
    }
  }, [handleStartCamera, cameraActive]);

  const handleResetBill = () => {
    trackerRef.current.reset();
    setItems([]);
    setTotalSummary({
      totalPaise: 0,
      formattedTotal: `${config.currencySymbol}0.00`,
      itemCount: 0,
      uncertainCount: 0,
      excludedCount: 0,
    });
    setStatusMessage('Ready for next bill.');
  };

  return (
    <div className="relative w-full w-screen h-screen h-dvh overflow-hidden bg-black font-sans flex flex-col select-none">
      {/* Full-Screen Live Camera Preview with Real-Time #00FF00 Bounding Box Canvas Overlay */}
      <CameraPreview
        videoRef={videoRef}
        items={items}
        documentBounds={documentBounds}
        columnBoundary={columnBoundary}
        currencySymbol={config.currencySymbol}
        status={scannerStatus}
        statusMessage={statusMessage}
        isProcessing={isProcessing}
        cameraActive={cameraActive}
        onStartCamera={handleStartCamera}
        permissionError={permissionError}
        onRoiChange={(roi) => processorRef.current?.setScanRoi(roi)}
      />

      {/* At Bottom: JUST THE TOTAL */}
      <StickyTotalPanel
        summary={totalSummary}
        onReset={handleResetBill}
        statusText={isProcessing ? 'Calculating...' : 'Live scanning...'}
      />
    </div>
  );
};

export default App;
