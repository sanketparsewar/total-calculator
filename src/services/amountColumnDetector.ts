import { CandidateAmount, OcrLine, ColumnBoundary, ScannerConfig } from '../types/scanner';

export class AmountColumnDetector {
  private static HEADER_KEYWORDS = ['amount', 'amt', 'rs.', 'rs', '₹', 'rupees', 'price', 'total'];

  /**
   * Detect the rightmost amount column from OCR lines and candidates.
   */
  public static detectAmountColumn(
    allLines: OcrLine[],
    candidates: CandidateAmount[],
    config: ScannerConfig
  ): { boundary: ColumnBoundary; candidates: CandidateAmount[] } {
    if (config.columnDetectionMode === 'manual') {
      const boundary: ColumnBoundary = {
        minX: config.manualColumnMinX,
        maxX: 1.0,
        headerDetected: 'Manual Column Setting',
        confidence: 1.0,
      };

      const filtered = candidates.map((c) => {
        const centerX = c.bbox.x + c.bbox.width / 2;
        const rightX = c.bbox.x + c.bbox.width;
        // Accept if the item is within or extends into the manual column
        const inColumn = rightX >= boundary.minX || centerX >= boundary.minX;
        return {
          ...c,
          isRightmostColumn: inColumn,
          exclusionReason: inColumn
            ? c.exclusionReason
            : `Left of amount column (X: ${(centerX * 100).toFixed(0)}% < ${(boundary.minX * 100).toFixed(0)}%)`,
        };
      });

      return { boundary, candidates: filtered };
    }

    // AUTO MODE:
    // Step 1: Look for explicit header clues in the document
    let headerBoundary: ColumnBoundary | null = null;
    let rightmostHeaderX = -1;
    let foundHeaderName: string | undefined;

    for (const line of allLines) {
      // Headers usually sit in top 40% of the document
      if (line.bbox.y > 0.45) continue;

      const lower = line.text.toLowerCase().trim();
      for (const kw of this.HEADER_KEYWORDS) {
        if (lower.includes(kw)) {
          const rightEdge = line.bbox.x + line.bbox.width;
          if (rightEdge > rightmostHeaderX) {
            rightmostHeaderX = rightEdge;
            foundHeaderName = line.text;
            headerBoundary = {
              minX: Math.max(0.40, line.bbox.x - 0.05),
              maxX: Math.min(1.0, rightEdge + 0.10),
              headerDetected: line.text,
              confidence: 0.85,
            };
          }
        }
      }
    }

    // Step 2: Spatial cluster analysis of candidate numbers
    // Find right edge distribution of candidate amounts
    if (candidates.length === 0) {
      const defaultBoundary: ColumnBoundary = {
        minX: headerBoundary ? headerBoundary.minX : 0.55,
        maxX: 1.0,
        headerDetected: foundHeaderName,
        confidence: headerBoundary ? 0.8 : 0.5,
      };
      return { boundary: defaultBoundary, candidates };
    }

    // Calculate candidate X positions
    const candidateRightEdges = candidates.map((c) => c.bbox.x + c.bbox.width);
    const candidateLeftEdges = candidates.map((c) => c.bbox.x);

    const maxRightX = Math.max(...candidateRightEdges);
    const minLeftX = Math.min(...candidateLeftEdges);

    // If all candidates are tightly vertically aligned in one single column (e.g. handwritten notebook list)
    // where items are written: "Milk 45.00", "Sugar 35.00"
    // The amounts naturally cluster on the far right.
    let computedMinX = 0.50; // default assumption: amounts are in right half

    if (headerBoundary) {
      computedMinX = headerBoundary.minX;
    } else {
      // Find candidate clusters along X axis
      // If candidate amounts have a spread, find the rightmost group
      const rightHalfCandidates = candidates.filter((c) => c.bbox.x + c.bbox.width / 2 >= 0.45);
      
      if (rightHalfCandidates.length >= 2) {
        // Find the leftmost X in this rightmost group
        const groupMinX = Math.min(...rightHalfCandidates.map((c) => c.bbox.x));
        // Add a slight margin
        computedMinX = Math.max(0.40, groupMinX - 0.06);
      } else if (maxRightX - minLeftX > 0.30) {
        // Wide spread with items on left (e.g. quantities or serial nos) and right (amounts)
        // Divide into left vs right groups
        computedMinX = Math.max(0.50, maxRightX - 0.35);
      } else {
        // All items might be in a single handwritten column or page is cropped to the column
        // e.g. user pointed camera directly at the amount column
        computedMinX = Math.max(0.10, minLeftX - 0.05);
      }
    }

    const finalBoundary: ColumnBoundary = {
      minX: computedMinX,
      maxX: 1.0,
      headerDetected: foundHeaderName,
      confidence: headerBoundary ? 0.85 : 0.70,
    };

    // Step 3: Classify each candidate
    const classified = candidates.map((c) => {
      const centerX = c.bbox.x + c.bbox.width / 2;
      const rightX = c.bbox.x + c.bbox.width;

      // Item is in amount column if its center or right edge is within computedMinX
      // or if it's within 5% tolerance of the column
      const inColumn = rightX >= finalBoundary.minX || centerX >= finalBoundary.minX - 0.04;

      let exclusionReason = c.exclusionReason;
      if (!inColumn && !exclusionReason) {
        exclusionReason = `Quantity or item number on left (X: ${(centerX * 100).toFixed(0)}% < ${(finalBoundary.minX * 100).toFixed(0)}%)`;
      }

      return {
        ...c,
        isRightmostColumn: inColumn,
        exclusionReason,
      };
    });

    return { boundary: finalBoundary, candidates: classified };
  }
}
