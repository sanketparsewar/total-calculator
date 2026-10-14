import { describe, it, expect } from 'vitest';
import { SAMPLE_BILLS } from '../src/data/sampleBills';
import { AmountParser } from '../src/services/amountParser';
import { LineItemTracker } from '../src/services/lineItemTracker';
import { TotalCalculator } from '../src/services/totalCalculator';
import { CandidateAmount, ScannerConfig } from '../src/types/scanner';

describe('Benchmark Sample Bills & Ground Truth Accuracy', () => {
  const config: ScannerConfig = {
    scanIntervalMs: 650,
    minConfidence: 0.60,
    columnDetectionMode: 'auto',
    manualColumnMinX: 0.55,
    ocrProvider: 'local',
    gracePeriodMs: 4000,
    currencySymbol: '₹',
    showDiagnostics: false,
    excludeTotals: true,
  };

  it('correctly benchmarks Sample Bill 1: Grocery Notebook (17 items, sum ₹397.50)', () => {
    const bill = SAMPLE_BILLS[0];
    const tracker = new LineItemTracker();

    // Convert items into candidates
    const candidates: CandidateAmount[] = bill.items.map((item, idx) => {
      const parsed = AmountParser.parseToPaise(item.amount)!;
      return {
        rawText: item.amount,
        normalizedAmountPaise: parsed.paise,
        displayAmount: parsed.formatted,
        confidence: 0.95,
        bbox: {
          x: 0.70,
          y: 0.15 + idx * 0.045,
          width: 0.18,
          height: 0.035,
        },
        isRightmostColumn: true,
        isGrandTotal: false,
        isSubtotal: false,
      };
    });

    tracker.processFrame(candidates, config);
    const summary = TotalCalculator.calculateTotal(tracker.getItems());

    expect(summary.itemCount).toBe(bill.items.length);
    expect(summary.totalPaise).toBe(bill.groundTruthTotalPaise);
    expect(summary.formattedTotal).toBe(bill.groundTruthFormatted);
  });

  it('correctly benchmarks Sample Bill 2: Restaurant Bill (Duplicate ₹45 + Grand Total Exclusion)', () => {
    const bill = SAMPLE_BILLS[1];
    const tracker = new LineItemTracker();

    const candidates: CandidateAmount[] = bill.items.map((item, idx) => {
      const parsed = AmountParser.parseToPaise(item.amount)!;
      return {
        rawText: item.amount,
        normalizedAmountPaise: parsed.paise,
        displayAmount: parsed.formatted,
        confidence: 0.92,
        bbox: {
          x: 0.70,
          y: 0.20 + idx * 0.06,
          width: 0.18,
          height: 0.04,
        },
        isRightmostColumn: true,
        isGrandTotal: false,
        isSubtotal: false,
      };
    });

    // Add pre-existing grand total at bottom
    candidates.push({
      rawText: 'Total: 590.00',
      normalizedAmountPaise: 59000,
      displayAmount: '590.00',
      confidence: 0.94,
      bbox: {
        x: 0.65,
        y: 0.88,
        width: 0.25,
        height: 0.05,
      },
      isRightmostColumn: true,
      isGrandTotal: true,
      isSubtotal: false,
      exclusionReason: 'Identified as grand total or subtotal',
    });

    tracker.processFrame(candidates, config);
    const summary = TotalCalculator.calculateTotal(tracker.getItems());

    // Both Butter Naan (45.00) items on separate lines should be counted
    // But Grand Total of 590.00 must NOT be added again (total remains 590.00, not 1180.00!)
    expect(summary.itemCount).toBe(6);
    expect(summary.totalPaise).toBe(bill.groundTruthTotalPaise);
    expect(summary.formattedTotal).toBe(bill.groundTruthFormatted);
    expect(summary.excludedCount).toBe(1);
  });
});
