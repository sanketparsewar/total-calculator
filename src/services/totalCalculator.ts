import { LineItem, TotalSummary } from '../types/scanner';
import { AmountParser } from './amountParser';

export class TotalCalculator {
  /**
   * Calculate live total summary from all registered items.
   * Uses exact integer arithmetic (in paise) to prevent floating-point calculation bugs.
   */
  public static calculateTotal(items: LineItem[], currencySymbol: string = '₹'): TotalSummary {
    let totalPaise = 0;
    let itemCount = 0;
    let uncertainCount = 0;
    let excludedCount = 0;

    for (const item of items) {
      if (item.validationStatus === 'accepted' && item.isIncluded) {
        totalPaise += item.normalizedAmountPaise;
        itemCount++;
      } else if (item.validationStatus === 'uncertain') {
        uncertainCount++;
      } else {
        excludedCount++;
      }
    }

    const formattedTotal = AmountParser.formatPaise(totalPaise, currencySymbol);

    return {
      totalPaise,
      formattedTotal,
      itemCount,
      uncertainCount,
      excludedCount,
    };
  }
}
