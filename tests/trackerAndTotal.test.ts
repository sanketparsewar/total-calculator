import { describe, it, expect, beforeEach } from 'vitest';
import { LineItemTracker } from '../src/services/lineItemTracker';
import { TotalCalculator } from '../src/services/totalCalculator';
import { CandidateAmount, ScannerConfig } from '../src/types/scanner';

describe('LineItemTracker & TotalCalculator Integration', () => {
  let tracker: LineItemTracker;
  const defaultConfig: ScannerConfig = {
    scanIntervalMs: 600,
    minConfidence: 0.6,
    columnDetectionMode: 'auto',
    manualColumnMinX: 0.55,
    ocrProvider: 'local',
    gracePeriodMs: 4000,
    currencySymbol: '₹',
    showDiagnostics: false,
    excludeTotals: true,
  };

  beforeEach(() => {
    tracker = new LineItemTracker();
  });

  it('calculates the exact sum for the prompt sample amounts', () => {
    // 125.00 + 46.00 + 35.00 + 20.00 + 17.00 + 10.50 + 9.50 + 12.00 + 31.00 + 23.00 + 7.50 + 2.50 + 32.00 + 6.00 + 8.50 + 8.00 + 4.00
    // Sum = 407.50 rupees = 40750 paise!
    const sampleAmounts = [
      12500, 4600, 3500, 2000, 1700, 1050, 950, 1200, 3100, 2300, 750, 250, 3200, 600, 850, 800, 400,
    ];

    sampleAmounts.forEach((paise, idx) => {
      tracker.addManualItem(paise, 0.05 + idx * 0.05);
    });

    const summary = TotalCalculator.calculateTotal(tracker.getItems());
    expect(summary.totalPaise).toBe(39750);
    expect(summary.formattedTotal).toBe('₹397.50');
    expect(summary.itemCount).toBe(17);
  });

  it('does not duplicate items when repeated frames see the same amounts', () => {
    const frame1Candidates: CandidateAmount[] = [
      {
        rawText: '125.00',
        normalizedAmountPaise: 12500,
        displayAmount: '125.00',
        confidence: 0.9,
        bbox: { x: 0.70, y: 0.20, width: 0.15, height: 0.03 },
        isRightmostColumn: true,
        isGrandTotal: false,
        isSubtotal: false,
      },
      {
        rawText: '46.00',
        normalizedAmountPaise: 4600,
        displayAmount: '46.00',
        confidence: 0.88,
        bbox: { x: 0.70, y: 0.28, width: 0.15, height: 0.03 },
        isRightmostColumn: true,
        isGrandTotal: false,
        isSubtotal: false,
      },
    ];

    // Frame 1
    tracker.processFrame(frame1Candidates, defaultConfig);
    let summary = TotalCalculator.calculateTotal(tracker.getItems());
    expect(summary.itemCount).toBe(2);
    expect(summary.totalPaise).toBe(17100); // 125.00 + 46.00 = 171.00

    // Frame 2: same amounts with slight camera movement (jitter)
    const frame2Candidates: CandidateAmount[] = [
      {
        rawText: '125.00',
        normalizedAmountPaise: 12500,
        displayAmount: '125.00',
        confidence: 0.92,
        bbox: { x: 0.71, y: 0.205, width: 0.15, height: 0.03 },
        isRightmostColumn: true,
        isGrandTotal: false,
        isSubtotal: false,
      },
      {
        rawText: '46.00',
        normalizedAmountPaise: 4600,
        displayAmount: '46.00',
        confidence: 0.91,
        bbox: { x: 0.695, y: 0.282, width: 0.15, height: 0.03 },
        isRightmostColumn: true,
        isGrandTotal: false,
        isSubtotal: false,
      },
    ];

    tracker.processFrame(frame2Candidates, defaultConfig);
    summary = TotalCalculator.calculateTotal(tracker.getItems());
    // Should still have exactly 2 items, total remaining 171.00!
    expect(summary.itemCount).toBe(2);
    expect(summary.totalPaise).toBe(17100);
    expect(summary.formattedTotal).toBe('₹171.00');
  });

  it('counts identical prices on distinct rows separately', () => {
    // Two separate line items with 10.00 on different lines (Y=0.20 and Y=0.40)
    const candidates: CandidateAmount[] = [
      {
        rawText: '10.00',
        normalizedAmountPaise: 1000,
        displayAmount: '10.00',
        confidence: 0.85,
        bbox: { x: 0.70, y: 0.20, width: 0.12, height: 0.03 },
        isRightmostColumn: true,
        isGrandTotal: false,
        isSubtotal: false,
      },
      {
        rawText: '10.00',
        normalizedAmountPaise: 1000,
        displayAmount: '10.00',
        confidence: 0.85,
        bbox: { x: 0.70, y: 0.40, width: 0.12, height: 0.03 },
        isRightmostColumn: true,
        isGrandTotal: false,
        isSubtotal: false,
      },
    ];

    tracker.processFrame(candidates, defaultConfig);
    const summary = TotalCalculator.calculateTotal(tracker.getItems());
    expect(summary.itemCount).toBe(2);
    expect(summary.totalPaise).toBe(2000);
    expect(summary.formattedTotal).toBe('₹20.00');
  });

  it('updates existing item when a clearer frame corrects an earlier OCR error', () => {
    // Frame 1: poor frame mistakenly reads "40.00" with low confidence 0.62
    const frame1: CandidateAmount[] = [
      {
        rawText: '40.00',
        normalizedAmountPaise: 4000,
        displayAmount: '40.00',
        confidence: 0.62,
        bbox: { x: 0.70, y: 0.30, width: 0.12, height: 0.03 },
        isRightmostColumn: true,
        isGrandTotal: false,
        isSubtotal: false,
      },
    ];
    tracker.processFrame(frame1, defaultConfig);
    let items = tracker.getItems();
    expect(items[0].normalizedAmountPaise).toBe(4000);

    // Frame 2: clear frame recognizes "46.00" with high confidence 0.95 at the same position
    const frame2: CandidateAmount[] = [
      {
        rawText: '46.00',
        normalizedAmountPaise: 4600,
        displayAmount: '46.00',
        confidence: 0.95,
        bbox: { x: 0.70, y: 0.302, width: 0.12, height: 0.03 },
        isRightmostColumn: true,
        isGrandTotal: false,
        isSubtotal: false,
      },
    ];
    tracker.processFrame(frame2, defaultConfig);
    items = tracker.getItems();
    // Still 1 item, but value corrected to 46.00!
    expect(items.length).toBe(1);
    expect(items[0].normalizedAmountPaise).toBe(4600);
    expect(items[0].displayAmount).toBe('46.00');
    expect(TotalCalculator.calculateTotal(items).totalPaise).toBe(4600);
  });

  it('preserves manual corrections against subsequent camera frames', () => {
    const frame1: CandidateAmount[] = [
      {
        rawText: '35.00',
        normalizedAmountPaise: 3500,
        displayAmount: '35.00',
        confidence: 0.8,
        bbox: { x: 0.70, y: 0.25, width: 0.12, height: 0.03 },
        isRightmostColumn: true,
        isGrandTotal: false,
        isSubtotal: false,
      },
    ];
    tracker.processFrame(frame1, defaultConfig);
    const item = tracker.getItems()[0];

    // User manually corrects item to 38.00 (3800 paise)
    tracker.editItemAmount(item.id, 3800);
    expect(TotalCalculator.calculateTotal(tracker.getItems()).totalPaise).toBe(3800);

    // Frame 2 arrives with old OCR read
    const frame2: CandidateAmount[] = [
      {
        rawText: '35.00',
        normalizedAmountPaise: 3500,
        displayAmount: '35.00',
        confidence: 0.99,
        bbox: { x: 0.70, y: 0.25, width: 0.12, height: 0.03 },
        isRightmostColumn: true,
        isGrandTotal: false,
        isSubtotal: false,
      },
    ];
    tracker.processFrame(frame2, defaultConfig);
    // User correction must NOT be overwritten!
    const updated = tracker.getItems()[0];
    expect(updated.normalizedAmountPaise).toBe(3800);
    expect(TotalCalculator.calculateTotal(tracker.getItems()).totalPaise).toBe(3800);
  });

  it('excludes pre-existing grand totals from summation', () => {
    const candidates: CandidateAmount[] = [
      {
        rawText: '50.00',
        normalizedAmountPaise: 5000,
        displayAmount: '50.00',
        confidence: 0.9,
        bbox: { x: 0.70, y: 0.25, width: 0.12, height: 0.03 },
        isRightmostColumn: true,
        isGrandTotal: false,
        isSubtotal: false,
      },
      {
        rawText: 'Grand Total 50.00',
        normalizedAmountPaise: 5000,
        displayAmount: '50.00',
        confidence: 0.9,
        bbox: { x: 0.70, y: 0.90, width: 0.20, height: 0.04 },
        isRightmostColumn: true,
        isGrandTotal: true,
        isSubtotal: false,
      },
    ];

    tracker.processFrame(candidates, defaultConfig);
    const summary = TotalCalculator.calculateTotal(tracker.getItems());
    // Only the line item of 50.00 should be accepted, not the 50.00 grand total (sum should be 50.00, not 100.00)
    expect(summary.itemCount).toBe(1);
    expect(summary.totalPaise).toBe(5000);
    expect(summary.excludedCount).toBe(1);
  });
});
