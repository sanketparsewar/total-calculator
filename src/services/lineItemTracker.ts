import { CandidateAmount, LineItem, ScannerConfig } from '../types/scanner';

export class LineItemTracker {
  private registry: Map<string, LineItem> = new Map();
  private currentPageId: string = 'page-1';
  private consecutiveMismatches: number = 0;

  constructor() {
    this.currentPageId = `page-${Date.now()}`;
  }

  /**
   * Return all line items in the active registry.
   */
  public getItems(): LineItem[] {
    return Array.from(this.registry.values()).sort((a, b) => a.normalizedY - b.normalizedY);
  }

  /**
   * Return only currently accepted items that contribute to the live sum.
   */
  public getAcceptedItems(): LineItem[] {
    return this.getItems().filter((item) => item.isIncluded && item.validationStatus === 'accepted');
  }

  /**
   * Reset registry for a new document or clean start.
   */
  public reset(newPageId?: string): void {
    this.registry.clear();
    this.currentPageId = newPageId || `page-${Date.now()}`;
    this.consecutiveMismatches = 0;
  }

  /**
   * Manually edit an item's amount.
   */
  public editItemAmount(id: string, newAmountPaise: number): boolean {
    const item = this.registry.get(id);
    if (!item) return false;

    item.normalizedAmountPaise = newAmountPaise;
    item.manualOverridePaise = newAmountPaise;
    item.displayAmount = (newAmountPaise / 100).toFixed(2);
    item.isManuallyEdited = true;
    item.validationStatus = 'accepted';
    item.isIncluded = !item.isManuallyExcluded;
    return true;
  }

  /**
   * Manually toggle inclusion of an item.
   */
  public toggleItemInclusion(id: string, isIncluded?: boolean): boolean {
    const item = this.registry.get(id);
    if (!item) return false;

    const nextState = isIncluded !== undefined ? isIncluded : !item.isIncluded;
    item.isIncluded = nextState;
    item.isManuallyExcluded = !nextState;
    if (nextState && item.validationStatus === 'rejected') {
      item.validationStatus = 'accepted';
    }
    return true;
  }

  /**
   * Remove an item from the registry.
   */
  public removeItem(id: string): boolean {
    return this.registry.delete(id);
  }

  /**
   * Add a manual line item.
   */
  public addManualItem(amountPaise: number, normalizedY: number = 0.5): LineItem {
    const id = `manual-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newItem: LineItem = {
      id,
      normalizedAmountPaise: amountPaise,
      displayAmount: (amountPaise / 100).toFixed(2),
      originalText: (amountPaise / 100).toFixed(2),
      confidence: 1.0,
      bbox: { x: 0.65, y: normalizedY, width: 0.25, height: 0.04 },
      normalizedX: 0.75,
      normalizedY,
      firstSeenTimestamp: Date.now(),
      lastSeenTimestamp: Date.now(),
      seenCount: 1,
      validationStatus: 'accepted',
      isIncluded: true,
      isManuallyEdited: true,
      isManuallyExcluded: false,
      manualOverridePaise: amountPaise,
      pageId: this.currentPageId,
    };
    this.registry.set(id, newItem);
    return newItem;
  }

  /**
   * Process a set of candidate amounts from a new camera frame.
   * Performs spatial matching, temporal smoothing, OCR correction reconciliation,
   * deduplication, and grace period pruning.
   */
  public processFrame(candidates: CandidateAmount[], config: ScannerConfig): LineItem[] {
    const now = Date.now();

    // Prune items that have exceeded the grace period, unless manually edited
    this.pruneExpiredItems(now, config.gracePeriodMs);

    // If no candidates in this frame, retain confirmed items within grace period
    if (candidates.length === 0) {
      return this.getItems();
    }

    // Step 1: Detect potential page changes
    // If we have existing items, but all candidates in the current frame have high spatial divergence
    if (this.registry.size >= 3 && candidates.length >= 3) {
      let matchedCount = 0;
      for (const candidate of candidates) {
        const cY = candidate.bbox.y + candidate.bbox.height / 2;
        const cX = candidate.bbox.x + candidate.bbox.width / 2;
        for (const existing of this.registry.values()) {
          const dy = Math.abs(existing.normalizedY - cY);
          const dx = Math.abs(existing.normalizedX - cX);
          if (dy < 0.05 && dx < 0.12) {
            matchedCount++;
            break;
          }
        }
      }

      // If less than 20% of candidates match existing layout, could be page transition
      if (matchedCount === 0) {
        this.consecutiveMismatches++;
        // If 4 consecutive frames mismatch completely, switch page safely
        if (this.consecutiveMismatches >= 4) {
          this.reset(`page-${now}`);
        }
      } else {
        this.consecutiveMismatches = 0;
      }
    }

    // Step 2: Spatial matching between frame candidates and existing registry items
    const matchedExistingIds = new Set<string>();

    for (const candidate of candidates) {
      const cCenterY = candidate.bbox.y + candidate.bbox.height / 2;
      const cCenterX = candidate.bbox.x + candidate.bbox.width / 2;

      // Find the closest existing line item in the same row
      let bestMatch: LineItem | null = null;
      let minDistance = Infinity;

      for (const existing of this.registry.values()) {
        if (matchedExistingIds.has(existing.id)) continue;

        const dy = Math.abs(existing.normalizedY - cCenterY);
        const dx = Math.abs(existing.normalizedX - cCenterX);

        // Vertical tolerance: within 2.8% of page height (prevents merging adjacent bill rows)
        // Horizontal tolerance: within 14% of page width
        if (dy <= 0.028 && dx <= 0.14) {
          // Weighted distance (vertical alignment is primary)
          const dist = Math.hypot(dx * 0.4, dy);
          if (dist < minDistance) {
            minDistance = dist;
            bestMatch = existing;
          }
        }
      }

      if (bestMatch) {
        matchedExistingIds.add(bestMatch.id);
        this.updateExistingItem(bestMatch, candidate, cCenterX, cCenterY, now, config);
      } else {
        // No matching row found -> create new candidate item
        this.createNewItem(candidate, cCenterX, cCenterY, now, config);
      }
    }

    return this.getItems();
  }

  /**
   * Update an existing line item from a new frame observation.
   */
  private updateExistingItem(
    existing: LineItem,
    candidate: CandidateAmount,
    cX: number,
    cY: number,
    now: number,
    config: ScannerConfig
  ): void {
    existing.lastSeenTimestamp = now;
    existing.seenCount++;

    // Smooth bounding box coordinates using Exponential Moving Average (EMA) to prevent jitter
    const alpha = 0.35; // 35% new frame, 65% existing
    existing.bbox = {
      x: existing.bbox.x * (1 - alpha) + candidate.bbox.x * alpha,
      y: existing.bbox.y * (1 - alpha) + candidate.bbox.y * alpha,
      width: existing.bbox.width * (1 - alpha) + candidate.bbox.width * alpha,
      height: existing.bbox.height * (1 - alpha) + candidate.bbox.height * alpha,
    };
    existing.normalizedX = existing.normalizedX * (1 - alpha) + cX * alpha;
    existing.normalizedY = existing.normalizedY * (1 - alpha) + cY * alpha;

    // If item was manually edited or excluded by user, do NOT let OCR overwrite it
    if (existing.isManuallyEdited || existing.isManuallyExcluded) {
      return;
    }

    // OCR value reconciliation:
    // If the candidate has higher confidence and recognized a different amount, update!
    if (candidate.confidence > existing.confidence && candidate.normalizedAmountPaise !== existing.normalizedAmountPaise) {
      existing.normalizedAmountPaise = candidate.normalizedAmountPaise;
      existing.displayAmount = candidate.displayAmount;
      existing.originalText = candidate.rawText;
      existing.confidence = candidate.confidence;
    } else {
      // Retain the higher confidence
      existing.confidence = Math.max(existing.confidence, candidate.confidence);
    }

    // Validation status check
    if (existing.validationStatus === 'uncertain' && existing.seenCount >= 2 && existing.confidence >= config.minConfidence) {
      if (candidate.isRightmostColumn && (!candidate.isGrandTotal || !config.excludeTotals)) {
        existing.validationStatus = 'accepted';
        existing.isIncluded = true;
      }
    }
  }

  /**
   * Create a new line item in the registry.
   */
  private createNewItem(
    candidate: CandidateAmount,
    cX: number,
    cY: number,
    now: number,
    config: ScannerConfig
  ): LineItem {
    const id = `item-${now}-${Math.random().toString(36).substring(2, 6)}`;

    let validationStatus: 'accepted' | 'uncertain' | 'rejected' = 'accepted';
    let isIncluded = true;
    let exclusionReason = candidate.exclusionReason;

    if (candidate.isGrandTotal && config.excludeTotals) {
      validationStatus = 'rejected';
      isIncluded = false;
      exclusionReason = 'Excluded pre-existing grand total';
    } else if (!candidate.isRightmostColumn) {
      validationStatus = 'rejected';
      isIncluded = false;
    } else if (candidate.confidence < config.minConfidence) {
      validationStatus = 'uncertain';
      isIncluded = false;
      exclusionReason = `Low confidence (${(candidate.confidence * 100).toFixed(0)}% < ${(config.minConfidence * 100).toFixed(0)}%)`;
    }

    const newItem: LineItem = {
      id,
      normalizedAmountPaise: candidate.normalizedAmountPaise,
      displayAmount: candidate.displayAmount,
      originalText: candidate.rawText,
      confidence: candidate.confidence,
      bbox: candidate.bbox,
      normalizedX: cX,
      normalizedY: cY,
      firstSeenTimestamp: now,
      lastSeenTimestamp: now,
      seenCount: 1,
      validationStatus,
      isIncluded,
      isManuallyEdited: false,
      isManuallyExcluded: false,
      exclusionReason,
      pageId: this.currentPageId,
    };

    this.registry.set(id, newItem);
    return newItem;
  }

  /**
   * Remove items that have disappeared beyond the grace period.
   * Manually edited items are preserved.
   */
  private pruneExpiredItems(now: number, gracePeriodMs: number): void {
    for (const [id, item] of this.registry.entries()) {
      if (item.isManuallyEdited) continue; // Keep user edits
      if (now - item.lastSeenTimestamp > gracePeriodMs) {
        this.registry.delete(id);
      }
    }
  }
}
