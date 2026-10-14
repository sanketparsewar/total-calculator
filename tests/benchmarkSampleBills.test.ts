import { describe, it, expect } from 'vitest';
import { AmountParser } from '../src/services/amountParser';
import { LineItemTracker } from '../src/services/lineItemTracker';
import { TotalCalculator } from '../src/services/totalCalculator';
import { CandidateAmount, ScannerConfig } from '../src/types/scanner';

const BENCHMARK_BILLS = [
  {
    id: 'grocery-notebook',
    groundTruthTotalPaise: 39750,
    groundTruthFormatted: '₹397.50',
    items: [
      { name: 'Atta 5kg', amount: '125.00' },
      { name: 'Sugar 1kg', amount: '46.00' },
      { name: 'Toor Dal', amount: '35.00' },
      { name: 'Mustard Oil', amount: '20.00' },
      { name: 'Lifebuoy Soap', amount: '17.00' },
      { name: 'Red Label Tea', amount: '10.50' },
      { name: 'Parle-G Biscuit', amount: '9.50' },
      { name: 'Cow Ghee 50g', amount: '12.00' },
      { name: 'Basmati Rice', amount: '31.00' },
      { name: 'Tata Salt', amount: '23.00' },
      { name: 'Garam Masala', amount: '7.50' },
      { name: 'Matchbox pkt', amount: '2.50' },
      { name: 'Colgate Paste', amount: '32.00' },
      { name: 'Rin Detergent', amount: '6.00' },
      { name: 'Lays Chips', amount: '8.50' },
      { name: 'Dairy Milk', amount: '8.00' },
      { name: 'Maggi 2-min', amount: '4.00' },
    ],
  },
  {
    id: 'restaurant-receipt',
    groundTruthTotalPaise: 59000,
    groundTruthFormatted: '₹590.00',
    items: [
      { name: 'Paneer Tikka', amount: '180.00' },
      { name: 'Butter Naan', amount: '45.00' },
      { name: 'Butter Naan', amount: '45.00' },
      { name: 'Dal Makhani', amount: '160.00' },
      { name: 'Jeera Rice', amount: '110.00' },
      { name: 'Gulab Jamun', amount: '50.00' },
    ],
  },
];

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
    const bill = BENCHMARK_BILLS[0];
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
    const bill = BENCHMARK_BILLS[1];
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
