import { describe, it, expect } from 'vitest';
import { AmountColumnDetector } from '../src/services/amountColumnDetector';
import { CandidateAmount, OcrLine, ScannerConfig } from '../src/types/scanner';

describe('AmountColumnDetector', () => {
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

  it('identifies rightmost column from header "Amount Rs."', () => {
    const lines: OcrLine[] = [
      {
        text: 'Particulars',
        confidence: 0.9,
        bbox: { x: 0.10, y: 0.10, width: 0.25, height: 0.03 },
      },
      {
        text: 'Amount Rs.',
        confidence: 0.95,
        bbox: { x: 0.65, y: 0.10, width: 0.25, height: 0.03 },
      },
    ];

    const candidates: CandidateAmount[] = [
      {
        rawText: '2', // Item quantity on left
        normalizedAmountPaise: 200,
        displayAmount: '2.00',
        confidence: 0.8,
        bbox: { x: 0.15, y: 0.25, width: 0.05, height: 0.03 },
        isRightmostColumn: false,
        isGrandTotal: false,
        isSubtotal: false,
      },
      {
        rawText: '125.00', // Real amount in right column
        normalizedAmountPaise: 12500,
        displayAmount: '125.00',
        confidence: 0.92,
        bbox: { x: 0.70, y: 0.25, width: 0.15, height: 0.03 },
        isRightmostColumn: false,
        isGrandTotal: false,
        isSubtotal: false,
      },
    ];

    const { boundary, candidates: results } = AmountColumnDetector.detectAmountColumn(
      lines,
      candidates,
      defaultConfig
    );

    expect(boundary.headerDetected).toBe('Amount Rs.');
    // Quantity on left should be excluded from rightmost amount column
    expect(results[0].isRightmostColumn).toBe(false);
    expect(results[0].exclusionReason).toContain('on left');

    // Amount on right should be included in rightmost amount column
    expect(results[1].isRightmostColumn).toBe(true);
    expect(results[1].exclusionReason).toBeUndefined();
  });

  it('respects manual column mode region boundary', () => {
    const manualConfig: ScannerConfig = {
      ...defaultConfig,
      columnDetectionMode: 'manual',
      manualColumnMinX: 0.60,
    };

    const candidates: CandidateAmount[] = [
      {
        rawText: '50.00',
        normalizedAmountPaise: 5000,
        displayAmount: '50.00',
        confidence: 0.85,
        bbox: { x: 0.40, y: 0.30, width: 0.12, height: 0.03 }, // Center ~0.46 < 0.60
        isRightmostColumn: false,
        isGrandTotal: false,
        isSubtotal: false,
      },
      {
        rawText: '100.00',
        normalizedAmountPaise: 10000,
        displayAmount: '100.00',
        confidence: 0.95,
        bbox: { x: 0.70, y: 0.30, width: 0.15, height: 0.03 }, // Center ~0.77 > 0.60
        isRightmostColumn: false,
        isGrandTotal: false,
        isSubtotal: false,
      },
    ];

    const { results: _res, candidates: results } = AmountColumnDetector.detectAmountColumn(
      [],
      candidates,
      manualConfig
    );

    expect(results[0].isRightmostColumn).toBe(false);
    expect(results[1].isRightmostColumn).toBe(true);
  });
});
