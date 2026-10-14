import { describe, it, expect, beforeEach } from 'vitest';
import { LineItemTracker } from '../src/services/lineItemTracker';
import { TotalCalculator } from '../src/services/totalCalculator';
import { CandidateAmount, ScannerConfig } from '../src/types/scanner';

describe('Page Change, Grace Period & Reset Behaviors', () => {
  let tracker: LineItemTracker;
  const config: ScannerConfig = {
    scanIntervalMs: 650,
    minConfidence: 0.60,
    columnDetectionMode: 'auto',
    manualColumnMinX: 0.55,
    ocrProvider: 'local',
    gracePeriodMs: 200, // Short grace period for fast testing
    currencySymbol: '₹',
    showDiagnostics: false,
    excludeTotals: true,
  };

  beforeEach(() => {
    tracker = new LineItemTracker();
  });

  it('retains confirmed amounts during temporary loss of visibility (grace period)', () => {
    const candidates: CandidateAmount[] = [
      {
        rawText: '125.00',
        normalizedAmountPaise: 12500,
        displayAmount: '125.00',
        confidence: 0.95,
        bbox: { x: 0.70, y: 0.20, width: 0.15, height: 0.03 },
        isRightmostColumn: true,
        isGrandTotal: false,
        isSubtotal: false,
      },
    ];

    // Frame 1: Sees item
    tracker.processFrame(candidates, config);
    expect(TotalCalculator.calculateTotal(tracker.getItems()).totalPaise).toBe(12500);

    // Frame 2: Document briefly out of view (0 candidates detected)
    // Within grace period (< 200ms), item should still be retained!
    tracker.processFrame([], config);
    expect(TotalCalculator.calculateTotal(tracker.getItems()).totalPaise).toBe(12500);
  });

  it('prunes unconfirmed items once grace period has fully expired', async () => {
    const candidates: CandidateAmount[] = [
      {
        rawText: '50.00',
        normalizedAmountPaise: 5000,
        displayAmount: '50.00',
        confidence: 0.85,
        bbox: { x: 0.70, y: 0.30, width: 0.12, height: 0.03 },
        isRightmostColumn: true,
        isGrandTotal: false,
        isSubtotal: false,
      },
    ];

    tracker.processFrame(candidates, config);
    expect(TotalCalculator.calculateTotal(tracker.getItems()).totalPaise).toBe(5000);

    // Wait 250ms (longer than 200ms grace period)
    await new Promise((resolve) => setTimeout(resolve, 250));

    // Process empty frame after grace period
    tracker.processFrame([], config);
    expect(TotalCalculator.calculateTotal(tracker.getItems()).totalPaise).toBe(0);
  });

  it('resets registry cleanly on explicit reset without mixing totals', () => {
    tracker.addManualItem(10000, 0.2);
    tracker.addManualItem(5000, 0.4);
    expect(TotalCalculator.calculateTotal(tracker.getItems()).totalPaise).toBe(15000);

    tracker.reset('page-2');
    expect(tracker.getItems().length).toBe(0);
    expect(TotalCalculator.calculateTotal(tracker.getItems()).totalPaise).toBe(0);
  });
});
