import { describe, it, expect } from 'vitest';
import { AmountParser } from '../src/services/amountParser';

describe('AmountParser', () => {
  it('correctly parses example amounts into exact integer paise', () => {
    const examples = [
      { input: '125.00', expectedPaise: 12500, expectedFormatted: '125.00' },
      { input: '46.00', expectedPaise: 4600, expectedFormatted: '46.00' },
      { input: '35.00', expectedPaise: 3500, expectedFormatted: '35.00' },
      { input: '20.00', expectedPaise: 2000, expectedFormatted: '20.00' },
      { input: '17.00', expectedPaise: 1700, expectedFormatted: '17.00' },
      { input: '10.50', expectedPaise: 1050, expectedFormatted: '10.50' },
      { input: '9.50', expectedPaise: 950, expectedFormatted: '9.50' },
      { input: '12.00', expectedPaise: 1200, expectedFormatted: '12.00' },
      { input: '31.00', expectedPaise: 3100, expectedFormatted: '31.00' },
      { input: '23.00', expectedPaise: 2300, expectedFormatted: '23.00' },
      { input: '7.50', expectedPaise: 750, expectedFormatted: '7.50' },
      { input: '2.50', expectedPaise: 250, expectedFormatted: '2.50' },
      { input: '32.00', expectedPaise: 3200, expectedFormatted: '32.00' },
      { input: '6.00', expectedPaise: 600, expectedFormatted: '6.00' },
      { input: '8.50', expectedPaise: 850, expectedFormatted: '8.50' },
      { input: '8.00', expectedPaise: 800, expectedFormatted: '8.00' },
      { input: '4.00', expectedPaise: 400, expectedFormatted: '4.00' },
      { input: '1190', expectedPaise: 119000, expectedFormatted: '1190.00' },
      { input: '128.50', expectedPaise: 12850, expectedFormatted: '128.50' },
    ];

    for (const eg of examples) {
      const res = AmountParser.parseToPaise(eg.input);
      expect(res).not.toBeNull();
      expect(res?.paise).toBe(eg.expectedPaise);
      expect(res?.formatted).toBe(eg.expectedFormatted);
    }
  });

  it('handles Indian currency notations and suffixes', () => {
    expect(AmountParser.parseToPaise('₹125.00')?.paise).toBe(12500);
    expect(AmountParser.parseToPaise('Rs. 46.00')?.paise).toBe(4600);
    expect(AmountParser.parseToPaise('Rs 35/-')?.paise).toBe(3500);
    expect(AmountParser.parseToPaise('250/-')?.paise).toBe(25000);
    expect(AmountParser.parseToPaise('10,50')?.paise).toBe(1050);
  });

  it('filters out non-amount items like dates, phones, quantities', () => {
    expect(AmountParser.parseToPaise('14/10/2026')).toBeNull();
    expect(AmountParser.parseToPaise('12-05-24')).toBeNull();
    expect(AmountParser.parseToPaise('9876543210')).toBeNull();
    expect(AmountParser.parseToPaise('2 kg')).toBeNull();
    expect(AmountParser.parseToPaise('500 gm')).toBeNull();
    expect(AmountParser.parseToPaise('18%')).toBeNull();
  });

  it('detects total and grand total lines', () => {
    expect(AmountParser.isTotalLine('Total: 400.80')).toBe(true);
    expect(AmountParser.isTotalLine('Grand Total 1250')).toBe(true);
    expect(AmountParser.isTotalLine('G.Total Rs. 550')).toBe(true);
    expect(AmountParser.isTotalLine('Sub Total 300.00')).toBe(true);
    expect(AmountParser.isTotalLine('Item 1: Rice 45.00')).toBe(false);
  });

  it('formats amounts in Indian numbering system', () => {
    expect(AmountParser.formatPaise(12500, '₹')).toBe('₹125.00');
    expect(AmountParser.formatPaise(1050, '₹')).toBe('₹10.50');
    expect(AmountParser.formatPaise(12500000, '₹')).toBe('₹1,25,000.00');
    expect(AmountParser.formatPaise(40080, '₹')).toBe('₹400.80');
  });
});
