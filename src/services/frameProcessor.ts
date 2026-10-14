import { CameraService } from './cameraService';
import { ImagePreprocessor } from './imagePreprocessor';
import { DocumentDetector } from './documentDetector';
import { AmountParser } from './amountParser';
import { AmountColumnDetector } from './amountColumnDetector';
import { LineItemTracker } from './lineItemTracker';
import { TotalCalculator } from './totalCalculator';
import { OcrManager } from './ocr/ocrManager';
import {
  ScannerConfig,
  ScannerStatus,
  CandidateAmount,
  LineItem,
  TotalSummary,
  DocumentBounds,
  ColumnBoundary,
} from '../types/scanner';

export interface FrameProcessingEvent {
  status: ScannerStatus;
  statusMessage: string;
  items: LineItem[];
  acceptedItems: LineItem[];
  totalSummary: TotalSummary;
  documentBounds: DocumentBounds;
  columnBoundary: ColumnBoundary;
  activeProvider: string;
  isProcessing: boolean;
  fps: number;
}

export class FrameProcessor {
  private camera: CameraService;
  private ocrManager: OcrManager;
  private tracker: LineItemTracker;
  private config: ScannerConfig;

  private isRunning: boolean = false;
  private isProcessingFrame: boolean = false;
  private timerId: number | null = null;
  private lastProcessTimestamp: number = 0;
  private frameCount: number = 0;
  private fps: number = 0;
  private fpsTimer: number = 0;

  private currentDocBounds: DocumentBounds = {
    topLeft: { x: 0, y: 0 },
    topRight: { x: 1, y: 0 },
    bottomRight: { x: 1, y: 1 },
    bottomLeft: { x: 0, y: 1 },
    confidence: 0,
    isConfident: false,
  };

  private currentColumnBoundary: ColumnBoundary = {
    minX: 0.55,
    maxX: 1.0,
    confidence: 0.5,
  };

  private listeners: ((event: FrameProcessingEvent) => void)[] = [];

  constructor(
    camera: CameraService,
    ocrManager: OcrManager,
    tracker: LineItemTracker,
    config: ScannerConfig
  ) {
    this.camera = camera;
    this.ocrManager = ocrManager;
    this.tracker = tracker;
    this.config = config;
  }

  public onFrameProcessed(listener: (event: FrameProcessingEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public updateConfig(newConfig: Partial<ScannerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.loop();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.timerId !== null) {
      window.clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  private notify(status: ScannerStatus, message: string, isProcessing: boolean = false): void {
    const items = this.tracker.getItems();
    const acceptedItems = this.tracker.getAcceptedItems();
    const totalSummary = TotalCalculator.calculateTotal(items, this.config.currencySymbol);

    const event: FrameProcessingEvent = {
      status,
      statusMessage: message,
      items,
      acceptedItems,
      totalSummary,
      documentBounds: this.currentDocBounds,
      columnBoundary: this.currentColumnBoundary,
      activeProvider: this.ocrManager.getActiveProviderName(),
      isProcessing,
      fps: this.fps,
    };

    for (const listener of this.listeners) {
      listener(event);
    }
  }

  private async loop(): Promise<void> {
    if (!this.isRunning) return;

    const now = performance.now();

    // Calculate FPS
    this.frameCount++;
    if (now - this.fpsTimer >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.fpsTimer = now;
    }

    // Check throttle interval
    const timeSinceLast = now - this.lastProcessTimestamp;
    if (timeSinceLast >= this.config.scanIntervalMs && !this.isProcessingFrame && !this.camera.getIsPaused()) {
      await this.processCurrentFrame();
    }

    if (this.isRunning) {
      // Schedule next check
      this.timerId = window.setTimeout(() => this.loop(), 100);
    }
  }

  /**
   * Process a single video frame through the computer vision and OCR pipeline.
   */
  public async processCurrentFrame(customCanvas?: HTMLCanvasElement): Promise<void> {
    if (this.isProcessingFrame) return;

    const sourceCanvas = customCanvas || this.camera.captureFrame();
    if (!sourceCanvas) return;

    this.isProcessingFrame = true;
    this.lastProcessTimestamp = performance.now();

    try {
      // Step 1: Image Quality Assessment (Motion Blur & Lighting)
      const quality = ImagePreprocessor.assessQuality(sourceCanvas);
      if (quality.isBlurry) {
        this.notify('low_quality', 'Low image quality — hold the camera steady', false);
        return;
      }
      if (quality.isTooDark) {
        this.notify('low_quality', 'Lighting too dark — point towards light', false);
        return;
      }

      // Step 2: Temporal Change Detection
      // If frame has not changed significantly from previous frame, skip heavy OCR pass
      const hasChanged = ImagePreprocessor.hasSignificantChange(sourceCanvas);
      if (!hasChanged && !customCanvas) {
        // Retain existing items without re-running OCR
        this.notify('scanning', 'Reading handwritten amounts...', false);
        return;
      }

      this.notify('processing', 'Reading handwritten amounts...', true);

      // Step 3: Document Boundary Detection
      const docBounds = DocumentDetector.detectDocument(sourceCanvas);
      this.currentDocBounds = docBounds;

      // Crop to document region if confidently detected
      const { canvas: croppedCanvas, offsetBbox } = DocumentDetector.cropDocumentRegion(
        sourceCanvas,
        docBounds
      );

      // Step 4: Image Preprocessing (grayscale, contrast stretching, ink sharpening)
      const enhancedCanvas = ImagePreprocessor.enhanceForOcr(croppedCanvas);

      // Step 5: OCR Execution
      const ocrResult = await this.ocrManager.recognize(enhancedCanvas);

      // Map OCR line bounding boxes back to full frame normalized coordinates
      const mappedLines = ocrResult.lines.map((l) => ({
        ...l,
        bbox: {
          x: offsetBbox.x + l.bbox.x * offsetBbox.width,
          y: offsetBbox.y + l.bbox.y * offsetBbox.height,
          width: l.bbox.width * offsetBbox.width,
          height: l.bbox.height * offsetBbox.height,
        },
      }));

      // Step 6: Parse Candidate Amounts from OCR Lines
      const candidates: CandidateAmount[] = [];
      for (const line of mappedLines) {
        const candidate = AmountParser.extractCandidateFromLine(line.text, line.bbox, line.confidence);
        if (candidate) {
          candidates.push(candidate);
        }
      }

      // Step 7: Amount Column Detection & Filtering (rightmost amount column)
      const { boundary, candidates: columnClassifiedCandidates } = AmountColumnDetector.detectAmountColumn(
        mappedLines,
        candidates,
        this.config
      );
      this.currentColumnBoundary = boundary;

      // Step 8: Spatial and Temporal Tracking / Deduplication / Registry Update
      this.tracker.processFrame(columnClassifiedCandidates, this.config);

      const acceptedCount = this.tracker.getAcceptedItems().length;
      const statusMsg = acceptedCount > 0
        ? `${acceptedCount} amount${acceptedCount > 1 ? 's' : ''} detected`
        : 'Scanning bill for amounts...';

      this.notify('scanning', statusMsg, false);
    } catch (err: any) {
      console.error('Frame processing error:', err);
      this.notify('error', `OCR Error: ${err.message || 'Processing failed'}`, false);
    } finally {
      this.isProcessingFrame = false;
    }
  }
}
