import { OcrResult } from '../../types/scanner';

export interface IOcrProvider {
  id: string;
  name: string;
  description: string;
  isAvailable(): Promise<boolean>;
  recognize(canvas: HTMLCanvasElement): Promise<OcrResult>;
}
