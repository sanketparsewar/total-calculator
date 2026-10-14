import { CandidateAmount, BoundingBox } from '../types/scanner';

export class AmountParser {
  // Regex to detect common non-amount patterns
  private static DATE_REGEX = /\b(?:\d{1,2}[-/.])(?:\d{1,2}[-/.])(?:\d{2,4})\b/;
  private static PHONE_REGEX = /\b(?:\+91[- ]?)?[6789]\d{9}\b/;
  private static PINCODE_REGEX = /\b[1-9]\d{5}\b/;
  private static INVOICE_NO_REGEX = /\b(?:inv(?:oice)?|bill|memo|sl\.?|no\.?|token|order)[\s:#-]*\d+/i;
  private static QUANTITY_UNIT_REGEX = /\b\d+(?:\.\d+)?\s*(?:kg|g|gm|gms|ltr|ml|pcs|pkt|nos|dz|doz|box|tin|bundle|packet)\b/i;
  private static PERCENT_REGEX = /\b\d+(?:\.\d+)?\s*%/;

  // Total keywords (case-insensitive)
  private static TOTAL_KEYWORDS = [
    'grand total',
    'g.total',
    'g total',
    'total',
    'tot.',
    'sub total',
    'sub-total',
    'subtotal',
    'net amount',
    'net amt',
    'final amount',
    'balance',
    'bal',
    'paid',
    'due',
    'advance',
    'adv',
    'kul', // Hindi "कुल" or Marathi transliteration
    'ekun', // Marathi "एकूण"
  ];

  /**
   * Parse a monetary text string into integer paise.
   * 1 Rupee = 100 paise.
   * e.g., "125.00" -> 12500 paise
   * e.g., "10.50" -> 1050 paise
   * e.g., "7.50" -> 750 paise
   * e.g., "1190" -> 119000 paise
   */
  public static parseToPaise(text: string): { paise: number; formatted: string } | null {
    if (!text || typeof text !== 'string') return null;

    let cleaned = text.trim();

    // Check for negative signs or non-monetary text
    if (cleaned.length === 0) return null;

    // Filter out obvious dates, phone numbers, quantities
    if (this.DATE_REGEX.test(cleaned)) return null;
    if (this.PHONE_REGEX.test(cleaned)) return null;
    if (this.QUANTITY_UNIT_REGEX.test(cleaned)) return null;
    if (this.PERCENT_REGEX.test(cleaned)) return null;

    // Strip currency symbols and prefixes/suffixes: ₹, Rs., Rs, R, INR, /-, /-., =-
    cleaned = cleaned
      .replace(/[₹\u20B9]/g, '')
      .replace(/\b(?:rs\.?|inr|rp)\b/gi, '')
      .replace(/[\/=\-~]+$/g, '') // remove trailing /-, =-, etc.
      .replace(/^[\/=\-~]+/g, '')
      .trim();

    // In handwriting, sometimes commas are used instead of dots: "10,50" -> "10.50"
    // or notebook lines create artifacts like "125.oo" or "125.oO" or "125.0O"
    cleaned = cleaned
      .replace(/(\d)[oO](\d)/g, '$10$2')
      .replace(/\.([oO]{2})\b/g, '.00')
      .replace(/\.([oO])\b/g, '.0');

    // If string ends with comma and 1-2 digits (like 10,50 or 7,5), convert to decimal dot
    cleaned = cleaned.replace(/,(\d{1,2})$/, '.$1');

    // Match numeric amount: digits with optional comma thousand separators, followed by optional dot and 1-2 digits
    const amountRegex = /(\d[\d,]*)(?:\.(\d{1,2}))?/;
    const match = cleaned.match(amountRegex);

    if (!match) return null;

    const integerPartStr = match[1].replace(/,/g, '');
    const decimalPartStr = match[2];

    const integerPart = parseInt(integerPartStr, 10);
    if (isNaN(integerPart)) return null;

    // Financial sanity checks for line-item amounts:
    // Single line items in typical grocery/restaurant bills are > 0 and < 10,000,000 (1 crore)
    if (integerPart < 0 || integerPart > 10000000) return null;

    let decimalPart = 0;
    if (decimalPartStr !== undefined) {
      if (decimalPartStr.length === 1) {
        decimalPart = parseInt(decimalPartStr, 10) * 10;
      } else {
        decimalPart = parseInt(decimalPartStr.slice(0, 2), 10);
      }
    }

    const totalPaise = integerPart * 100 + decimalPart;
    if (totalPaise <= 0) return null;

    const formatted = `${integerPart}.${decimalPart.toString().padStart(2, '0')}`;
    return { paise: totalPaise, formatted };
  }

  /**
   * Check if a line or surrounding context indicates a total or subtotal.
   */
  public static isTotalLine(lineText: string, yPosition?: number): boolean {
    const lower = lineText.toLowerCase();

    for (const kw of this.TOTAL_KEYWORDS) {
      if (lower.includes(kw)) {
        return true;
      }
    }

    // Double underline or equals sign or "Tot" abbreviations
    if (/===+|---+|___+/.test(lower) && /\d+/.test(lower)) {
      return true;
    }

    // If yPosition is provided and line is at very bottom (> 88% down) and has isolated big number
    if (yPosition !== undefined && yPosition > 0.90 && /^\s*\d+[\s.,\/-]*$/.test(lower)) {
      // Possible bottom grand total
      return true;
    }

    return false;
  }

  /**
   * Determine if this candidate amount line might be an invoice number, date, or serial number.
   */
  public static isExcludedIdentifier(lineText: string): boolean {
    const lower = lineText.toLowerCase();
    if (this.INVOICE_NO_REGEX.test(lower)) return true;
    if (this.PINCODE_REGEX.test(lower)) return true;
    if (/\b(?:ph|phone|mob|mobile|tel|cell|tin|gst|gstin|pan|vat)[\s:#-]*\d+/i.test(lower)) {
      return true;
    }
    return false;
  }

  /**
   * Parse candidate amounts from an OCR line.
   */
  public static extractCandidateFromLine(
    lineText: string,
    bbox: BoundingBox,
    confidence: number
  ): CandidateAmount | null {
    if (this.isExcludedIdentifier(lineText)) {
      return null;
    }

    const isTotal = this.isTotalLine(lineText, bbox.y + bbox.height / 2);
    const parsed = this.parseToPaise(lineText);

    if (!parsed) return null;

    return {
      rawText: lineText,
      normalizedAmountPaise: parsed.paise,
      displayAmount: parsed.formatted,
      confidence,
      bbox,
      isRightmostColumn: false, // will be evaluated by AmountColumnDetector
      isGrandTotal: isTotal,
      isSubtotal: /sub[\s-]?total/i.test(lineText),
      exclusionReason: isTotal ? 'Identified as grand total or subtotal' : undefined,
    };
  }

  /**
   * Format paise back into standard Indian Rupee string: e.g. "₹125.00", "₹1,250.50"
   */
  public static formatPaise(paise: number, currencySymbol: string = '₹'): string {
    const isNegative = paise < 0;
    const absPaise = Math.abs(paise);
    const rupees = Math.floor(absPaise / 100);
    const remainingPaise = absPaise % 100;

    // Format rupees with Indian comma separation: 1,23,456
    const rupeeStr = rupees.toString();
    let formattedRupees = '';

    if (rupeeStr.length > 3) {
      const lastThree = rupeeStr.substring(rupeeStr.length - 3);
      const rest = rupeeStr.substring(0, rupeeStr.length - 3);
      const withCommas = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
      formattedRupees = `${withCommas},${lastThree}`;
    } else {
      formattedRupees = rupeeStr;
    }

    const decimalStr = remainingPaise.toString().padStart(2, '0');
    return `${isNegative ? '-' : ''}${currencySymbol}${formattedRupees}.${decimalStr}`;
  }
}
