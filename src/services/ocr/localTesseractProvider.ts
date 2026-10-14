import { createWorker, Worker } from 'tesseract.js';
import { IOcrProvider } from './ocrProvider';
import { OcrResult, OcrLine } from '../../types/scanner';

export class LocalTesseractProvider implements IOcrProvider {
  public id = 'local-tesseract';
  public name = 'Local On-Device OCR (Tesseract.js)';
  public description = 'Runs 100% locally in the browser. Best for high-contrast handwriting and printed numbers.';

  private worker: Worker | null = null;
  private isInitializing = false;
  private initPromise: Promise<void> | null = null;

  public async isAvailable(): Promise<boolean> {
    return true; // Always available in modern browsers
  }

  private async getWorker(): Promise<Worker> {
    if (this.worker) return this.worker;

    if (this.isInitializing && this.initPromise) {
      await this.initPromise;
      if (this.worker) return this.worker;
    }

    this.isInitializing = true;
    this.initPromise = (async () => {
      try {
        const worker = await createWorker('eng');
        await worker.setParameters({
          tessedit_char_whitelist: '0123456789.₹,/-RsTotalGrandSubItemQtyRateAmt ',
          tessedit_pageseg_mode: '6' as any, // Assume a single uniform block of text
        });
        this.worker = worker;
      } finally {
        this.isInitializing = false;
      }
    })();

    await this.initPromise;
    if (!this.worker) throw new Error('Failed to initialize local Tesseract worker');
    return this.worker;
  }

  public async recognize(canvas: HTMLCanvasElement): Promise<OcrResult> {
    const startTime = performance.now();
    const worker = await this.getWorker();

    const result = await worker.recognize(canvas);
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    const lines: OcrLine[] = [];
    const data = result.data as any;

    // Extract lines and words with normalized coordinates
    if (data && Array.isArray(data.lines)) {
      for (const line of data.lines) {
        const text = (line.text || '').trim();
        if (!text) continue;

        const bbox = line.bbox || { x0: 0, y0: 0, x1: canvasWidth, y1: canvasHeight };
        const normalizedBbox = {
          x: Math.max(0, bbox.x0 / canvasWidth),
          y: Math.max(0, bbox.y0 / canvasHeight),
          width: Math.min(1, Math.max(0.01, (bbox.x1 - bbox.x0) / canvasWidth)),
          height: Math.min(1, Math.max(0.01, (bbox.y1 - bbox.y0) / canvasHeight)),
        };

        const words = Array.isArray(line.words)
          ? line.words.map((w: any) => ({
              text: (w.text || '').trim(),
              confidence: (w.confidence ?? 80) / 100,
              bbox: {
                x: Math.max(0, (w.bbox?.x0 ?? 0) / canvasWidth),
                y: Math.max(0, (w.bbox?.y0 ?? 0) / canvasHeight),
                width: Math.min(1, Math.max(0.01, ((w.bbox?.x1 ?? 0) - (w.bbox?.x0 ?? 0)) / canvasWidth)),
                height: Math.min(1, Math.max(0.01, ((w.bbox?.y1 ?? 0) - (w.bbox?.y0 ?? 0)) / canvasHeight)),
              },
            }))
          : [];

        lines.push({
          text,
          confidence: (line.confidence ?? 80) / 100,
          bbox: normalizedBbox,
          words,
        });
      }
    }

    const duration = performance.now() - startTime;
    return {
      lines,
      rawText: result.data.text || '',
      processingTimeMs: Math.round(duration),
      provider: this.name,
    };
  }

  public async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}
