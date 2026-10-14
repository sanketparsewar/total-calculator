import { IOcrProvider } from './ocrProvider';
import { LocalTesseractProvider } from './localTesseractProvider';
import { CloudOcrProvider } from './cloudOcrProvider';
import { OcrResult } from '../../types/scanner';

export class OcrManager {
  private localProvider: LocalTesseractProvider;
  private cloudProvider: CloudOcrProvider;
  private activeProvider: IOcrProvider;
  private isCloudAvailable: boolean = false;

  constructor() {
    this.localProvider = new LocalTesseractProvider();
    this.cloudProvider = new CloudOcrProvider();
    // Default to cloud neural OCR provider (Gemini Flash Vision)
    this.activeProvider = this.cloudProvider;
    this.isCloudAvailable = true;
  }

  public async init(): Promise<{ activeProvider: string; cloudAvailable: boolean }> {
    try {
      this.isCloudAvailable = await this.cloudProvider.isAvailable();
    } catch {
      this.isCloudAvailable = false;
    }

    if (this.isCloudAvailable) {
      this.activeProvider = this.cloudProvider;
    } else {
      this.activeProvider = this.localProvider;
    }

    return {
      activeProvider: this.activeProvider.name,
      cloudAvailable: this.isCloudAvailable,
    };
  }

  public setCustomApiKey(key: string): void {
    this.cloudProvider.setCustomApiKey(key);
    if (key.trim()) {
      this.isCloudAvailable = true;
      this.activeProvider = this.cloudProvider;
    }
  }

  public setProvider(type: 'cloud' | 'local'): boolean {
    if (type === 'cloud') {
      if (this.isCloudAvailable) {
        this.activeProvider = this.cloudProvider;
        return true;
      }
      return false;
    } else {
      this.activeProvider = this.localProvider;
      return true;
    }
  }

  public getActiveProviderName(): string {
    return this.activeProvider.name;
  }

  public getActiveProviderId(): string {
    return this.activeProvider.id;
  }

  public isCloudReady(): boolean {
    return this.isCloudAvailable;
  }

  public async recognize(canvas: HTMLCanvasElement): Promise<OcrResult> {
    try {
      return await this.activeProvider.recognize(canvas);
    } catch (err) {
      // If cloud fails (e.g. network error, rate limit), auto fallback to local
      if (this.activeProvider === this.cloudProvider) {
        console.warn('Cloud OCR failed, falling back to local Tesseract OCR:', err);
        return await this.localProvider.recognize(canvas);
      }
      throw err;
    }
  }

  public async terminate(): Promise<void> {
    await this.localProvider.terminate();
  }
}
