import { IOcrProvider } from './ocrProvider';
import { OcrResult, OcrLine } from '../../types/scanner';

export class CloudOcrProvider implements IOcrProvider {
  public id = 'cloud-ocr';
  public name = 'Cloud Neural OCR (Handwriting Specialist)';
  public description = 'Server-side neural handwriting OCR via Google Cloud Vision / OpenAI / Azure API.';

  private activeBackendName: string = 'Cloud Backend';

  public async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch('/api/ocr/status', {
        headers: { 'Accept': 'application/json' },
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data.available) {
        this.activeBackendName = data.provider || 'Cloud Backend';
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  public async recognize(canvas: HTMLCanvasElement): Promise<OcrResult> {
    const startTime = performance.now();

    // Export compressed JPEG base64 (75% quality is optimal for bandwidth and handwriting readability)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.75);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

    try {
      const response = await fetch('/api/ocr/recognize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageBase64: dataUrl }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.message || `Cloud OCR server returned ${response.status}`);
      }

      const data = await response.json();
      const lines: OcrLine[] = (data.lines || []).map((l: any) => ({
        text: l.text,
        confidence: typeof l.confidence === 'number' ? l.confidence : 0.9,
        bbox: {
          x: Math.max(0, Math.min(1, l.bbox?.x ?? 0)),
          y: Math.max(0, Math.min(1, l.bbox?.y ?? 0)),
          width: Math.max(0, Math.min(1, l.bbox?.width ?? 0.2)),
          height: Math.max(0, Math.min(1, l.bbox?.height ?? 0.04)),
        },
      }));

      const duration = performance.now() - startTime;
      return {
        lines,
        rawText: data.rawText || lines.map((l) => l.text).join('\n'),
        processingTimeMs: Math.round(duration),
        provider: `${this.name} (${this.activeBackendName})`,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      throw err;
    }
  }
}
