export interface BoundingBox {
  x: number; // 0 to 1 (relative to image/frame width)
  y: number; // 0 to 1 (relative to image/frame height)
  width: number; // 0 to 1
  height: number; // 0 to 1
}

export interface PixelBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OcrWord {
  text: string;
  confidence: number;
  bbox: BoundingBox;
}

export interface OcrLine {
  text: string;
  confidence: number;
  bbox: BoundingBox;
  words?: OcrWord[];
}

export interface OcrResult {
  lines: OcrLine[];
  rawText: string;
  processingTimeMs: number;
  provider: string;
}

export interface CandidateAmount {
  rawText: string;
  normalizedAmountPaise: number; // Stored in integer paise (e.g., 12500 for 125.00)
  displayAmount: string; // e.g. "125.00"
  confidence: number;
  bbox: BoundingBox;
  isRightmostColumn: boolean;
  isGrandTotal: boolean;
  isSubtotal: boolean;
  exclusionReason?: string;
}

export type ItemValidationStatus = 'accepted' | 'uncertain' | 'rejected';

export interface LineItem {
  id: string; // Stable UUID
  normalizedAmountPaise: number; // Exact integer paise
  displayAmount: string;
  originalText: string;
  confidence: number;
  bbox: BoundingBox;
  normalizedY: number; // Normalized center Y for row clustering
  normalizedX: number; // Normalized center X for column clustering
  firstSeenTimestamp: number;
  lastSeenTimestamp: number;
  seenCount: number;
  validationStatus: ItemValidationStatus;
  isIncluded: boolean; // Included in live sum
  isManuallyEdited: boolean;
  isManuallyExcluded: boolean;
  manualOverridePaise?: number;
  exclusionReason?: string;
  pageId: string;
}

export type ScannerStatus =
  | 'initializing'
  | 'requesting_permission'
  | 'permission_denied'
  | 'ready'
  | 'scanning'
  | 'processing'
  | 'paused'
  | 'stopped'
  | 'low_quality'
  | 'error';

export interface ScannerConfig {
  scanIntervalMs: number; // Throttle interval between OCR passes (e.g. 500-1000ms)
  minConfidence: number; // Threshold to accept (0.0 to 1.0, e.g. 0.60)
  columnDetectionMode: 'auto' | 'manual';
  manualColumnMinX: number; // 0.0 to 1.0 (e.g. 0.55 for right 45% of bill)
  ocrProvider: 'cloud' | 'local';
  gracePeriodMs: number; // Time to keep line item after losing visibility (e.g. 4000ms)
  currencySymbol: string; // e.g. '₹'
  showDiagnostics: boolean; // Show debug bounding boxes & column guides
  excludeTotals: boolean; // Automatically exclude grand totals / subtotals
}

export interface DocumentBounds {
  topLeft: { x: number; y: number };
  topRight: { x: number; y: number };
  bottomRight: { x: number; y: number };
  bottomLeft: { x: number; y: number };
  confidence: number;
  isConfident: boolean;
}

export interface ColumnBoundary {
  minX: number; // 0 to 1
  maxX: number; // 0 to 1
  headerDetected?: string;
  confidence: number;
}

export interface TotalSummary {
  totalPaise: number;
  formattedTotal: string;
  itemCount: number;
  uncertainCount: number;
  excludedCount: number;
}
