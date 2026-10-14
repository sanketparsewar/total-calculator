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
import { ItemsDrawer } from './components/ItemsDrawer';
import { ManualEditModal } from './components/ManualEditModal';
import { SettingsDrawer } from './components/SettingsDrawer';
import { TopBar } from './components/TopBar';

export const App: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Core Service Singletons (persisted across renders)
  const cameraRef = useRef<CameraService>(new CameraService());
  const ocrManagerRef = useRef<OcrManager>(new OcrManager());
  const trackerRef = useRef<LineItemTracker>(new LineItemTracker());
  const processorRef = useRef<FrameProcessor | null>(null);

  // Configuration state (default 1,500ms frame sampling as requested)
  const [config, setConfig] = useState<ScannerConfig>({
    scanIntervalMs: 1500,
    minConfidence: 0.60,
    columnDetectionMode: 'auto',
    manualColumnMinX: 0.55,
    ocrProvider: 'cloud',
    gracePeriodMs: 4500,
    currencySymbol: '₹',
    showDiagnostics: false,
    excludeTotals: true,
  });

  // UI State
  const [scannerStatus, setScannerStatus] = useState<ScannerStatus>('initializing');
  const [statusMessage, setStatusMessage] = useState<string>('Initializing camera...');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(0);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [permissionError, setPermissionError] = useState<string | undefined>();
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [uploadedImageSrc, setUploadedImageSrc] = useState<string | null>(null);

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
  const [activeProviderName, setActiveProviderName] = useState<string>('Cloud Neural OCR');
  const [isCloudReady, setIsCloudReady] = useState<boolean>(true);

  // Modal / Drawer States
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<LineItem | null>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);

  // Initialize OCR Manager and FrameProcessor
  useEffect(() => {
    const ocrManager = ocrManagerRef.current;
    const camera = cameraRef.current;
    const tracker = trackerRef.current;

    const savedKey = localStorage.getItem('user_gemini_api_key');
    if (savedKey) {
      ocrManager.setCustomApiKey(savedKey);
    }

    ocrManager.init().then(({ activeProvider, cloudAvailable }) => {
      setActiveProviderName(activeProvider);
      setIsCloudReady(cloudAvailable);
    });

    const processor = new FrameProcessor(camera, ocrManager, tracker, config);
    processorRef.current = processor;

    const unsubscribeProcessor = processor.onFrameProcessed((e: FrameProcessingEvent) => {
      setScannerStatus(e.status);
      setStatusMessage(e.statusMessage);
      setIsProcessing(e.isProcessing);
      setFps(e.fps);
      setItems(e.items);
      setTotalSummary(e.totalSummary);
      setDocumentBounds(e.documentBounds);
      setColumnBoundary(e.columnBoundary);
      setActiveProviderName(e.activeProvider);
    });

    const unsubscribeCamera = camera.onStateChange((cState) => {
      setCameraActive(cState.isActive);
      setIsPaused(cState.isPaused);
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
  }, []);

  // Update processor when config changes
  useEffect(() => {
    if (processorRef.current) {
      processorRef.current.updateConfig(config);
    }
    ocrManagerRef.current.setProvider(config.ocrProvider);
    setActiveProviderName(ocrManagerRef.current.getActiveProviderName());
  }, [config]);

  // Start Camera Automatically on Startup
  const handleStartCamera = useCallback(async () => {
    if (!videoRef.current) return;
    setUploadedImageSrc(null);
    setPermissionError(undefined);
    setStatusMessage('Requesting camera permission...');
    setScannerStatus('requesting_permission');

    try {
      await cameraRef.current.start(videoRef.current);
      setCameraActive(true);
      setScannerStatus('scanning');
      setStatusMessage('Looking for a bill...');
      if (processorRef.current) {
        processorRef.current.start();
      }
    } catch (err: any) {
      setPermissionError(err.message || 'Could not start camera');
      setScannerStatus('permission_denied');
    }
  }, []);

  // Auto-launch camera when component mounts and video element is ready
  useEffect(() => {
    if (videoRef.current && !cameraActive && !uploadedImageSrc) {
      handleStartCamera();
    }
  }, [handleStartCamera, cameraActive, uploadedImageSrc]);

  const handleTogglePause = () => {
    const cam = cameraRef.current;
    if (cam.getIsPaused() || isPaused) {
      cam.resume();
      setIsPaused(false);
      setStatusMessage('Scanning resumed');
    } else {
      cam.pause();
      setIsPaused(true);
      setStatusMessage('Scanner locked');
    }
  };

  const handleFlipCamera = async () => {
    setUploadedImageSrc(null);
    await cameraRef.current.toggleCamera();
  };

  const handleResetBill = () => {
    trackerRef.current.reset();
    setUploadedImageSrc(null);
    setItems([]);
    setTotalSummary({
      totalPaise: 0,
      formattedTotal: `${config.currencySymbol}0.00`,
      itemCount: 0,
      uncertainCount: 0,
      excludedCount: 0,
    });
    setStatusMessage('Bill cleared. Ready for next document.');
    if (cameraActive) {
      cameraRef.current.resume();
      setIsPaused(false);
    }
  };

  const handleUploadImage = (file: File) => {
    setStatusMessage('Loading uploaded bill image...');
    setScannerStatus('processing');
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onerror = () => {
      setStatusMessage('Failed to read image file');
      setScannerStatus('error');
      setIsProcessing(false);
    };

    reader.onload = () => {
      const dataUrl = reader.result as string;
      setUploadedImageSrc(dataUrl);

      const img = new Image();
      img.onerror = () => {
        setStatusMessage('Invalid image format');
        setScannerStatus('error');
        setIsProcessing(false);
      };

      img.onload = async () => {
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        const maxDim = 1600;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          // Pause camera so it doesn't overwrite uploaded image
          cameraRef.current.pause();
          setIsPaused(true);
          trackerRef.current.reset();
          setScannerStatus('processing');
          setStatusMessage('Detecting handwritten amounts with AI Vision...');
          if (processorRef.current) {
            try {
              await processorRef.current.processCurrentFrame(canvas);
            } catch (err: any) {
              setStatusMessage(`OCR Error: ${err.message || 'Detection failed'}`);
              setScannerStatus('error');
            }
          }
        }
        setIsProcessing(false);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleOpenEdit = (item: LineItem) => {
    setEditingItem(item);
    setIsManualModalOpen(true);
  };

  const handleOpenAddManual = () => {
    setEditingItem(null);
    setIsManualModalOpen(true);
  };

  const handleSaveAmount = (amountPaise: number) => {
    if (editingItem) {
      trackerRef.current.editItemAmount(editingItem.id, amountPaise);
    } else {
      trackerRef.current.addManualItem(amountPaise);
    }
    const currentItems = trackerRef.current.getItems();
    setItems(currentItems);
    const accepted = trackerRef.current.getAcceptedItems();
    const sumPaise = accepted.reduce((acc, i) => acc + i.normalizedAmountPaise, 0);
    setTotalSummary((prev) => ({
      ...prev,
      totalPaise: sumPaise,
      formattedTotal: `${config.currencySymbol}${(sumPaise / 100).toFixed(2)}`,
      itemCount: accepted.length,
    }));
  };

  const handleToggleInclusion = (id: string) => {
    trackerRef.current.toggleItemInclusion(id);
    const updated = trackerRef.current.getItems();
    setItems(updated);
    const accepted = trackerRef.current.getAcceptedItems();
    const sumPaise = accepted.reduce((acc, i) => acc + i.normalizedAmountPaise, 0);
    setTotalSummary((prev) => ({
      ...prev,
      totalPaise: sumPaise,
      formattedTotal: `${config.currencySymbol}${(sumPaise / 100).toFixed(2)}`,
      itemCount: accepted.length,
    }));
  };

  const handleDeleteItem = (id: string) => {
    trackerRef.current.removeItem(id);
    const updated = trackerRef.current.getItems();
    setItems(updated);
  };

  return (
    <div className="relative w-full w-screen h-screen h-dvh overflow-hidden bg-slate-950 font-sans flex flex-col select-none">
      {/* Top Bar with Title, Upload Bill, Flip Camera, Settings */}
      <TopBar
        activeProvider={activeProviderName}
        isCloudReady={isCloudReady}
        onFlipCamera={handleFlipCamera}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onUploadImage={handleUploadImage}
      />

      {/* Live Camera Viewfinder or Uploaded Bill with Green Bounding Boxes */}
      <CameraPreview
        videoRef={videoRef}
        uploadedImageSrc={uploadedImageSrc}
        items={items}
        documentBounds={documentBounds}
        columnBoundary={columnBoundary}
        showDiagnostics={config.showDiagnostics}
        currencySymbol={config.currencySymbol}
        status={scannerStatus}
        statusMessage={statusMessage}
        isProcessing={isProcessing}
        fps={fps}
        cameraActive={cameraActive}
        onStartCamera={handleStartCamera}
        onUploadImage={handleUploadImage}
        permissionError={permissionError}
      />

      {/* Sticky Bottom Total Panel */}
      <StickyTotalPanel
        summary={totalSummary}
        onOpenDrawer={() => setIsDrawerOpen(true)}
        onReset={handleResetBill}
        isPaused={isPaused}
        onTogglePause={handleTogglePause}
        statusText={isProcessing ? 'Analyzing...' : isPaused ? 'Locked' : 'Scanning...'}
      />

      {/* Line Items Drawer */}
      <ItemsDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        items={items}
        summary={totalSummary}
        currencySymbol={config.currencySymbol}
        onEditItem={handleOpenEdit}
        onToggleInclusion={handleToggleInclusion}
        onDeleteItem={handleDeleteItem}
        onAddManual={handleOpenAddManual}
        onClearAll={handleResetBill}
      />

      {/* Manual Amount Add / Edit Modal */}
      <ManualEditModal
        isOpen={isManualModalOpen}
        item={editingItem}
        currencySymbol={config.currencySymbol}
        onClose={() => setIsManualModalOpen(false)}
        onSave={handleSaveAmount}
      />

      {/* Settings Modal */}
      <SettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onUpdateConfig={(newConf) => setConfig((prev) => ({ ...prev, ...newConf }))}
        isCloudReady={isCloudReady}
        onUpdateApiKey={(k) => {
          ocrManagerRef.current.setCustomApiKey(k);
          setIsCloudReady(true);
          setActiveProviderName(ocrManagerRef.current.getActiveProviderName());
        }}
      />
    </div>
  );
};

export default App;
