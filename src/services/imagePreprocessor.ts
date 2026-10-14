export interface QualityMetrics {
  isBlurry: boolean;
  laplacianVariance: number;
  averageBrightness: number;
  isTooDark: boolean;
  isTooBright: boolean;
}

export class ImagePreprocessor {
  private static lastFrameSample: Uint8ClampedArray | null = null;
  private static SAMPLE_GRID_SIZE = 32; // 32x32 = 1024 sample points for fast change detection

  /**
   * Convert an HTMLCanvasElement or ImageBitmap to an enhanced canvas optimized for handwriting OCR.
   * Steps:
   * 1. Grayscale
   * 2. Contrast stretching (removes gray shadows and background tint)
   * 3. Mild unsharp masking (crisper ink edges against paper fibers and notebook lines)
   */
  public static enhanceForOcr(
    sourceCanvas: HTMLCanvasElement,
    cropX: number = 0,
    cropY: number = 0,
    cropWidth: number = sourceCanvas.width,
    cropHeight: number = sourceCanvas.height
  ): HTMLCanvasElement {
    const destCanvas = document.createElement('canvas');
    destCanvas.width = cropWidth;
    destCanvas.height = cropHeight;

    const ctx = destCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return sourceCanvas;

    // Draw source cropped region
    ctx.drawImage(
      sourceCanvas,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight
    );

    const imgData = ctx.getImageData(0, 0, cropWidth, cropHeight);
    const data = imgData.data;
    const len = data.length;

    // 1. Grayscale & compute luminance histogram
    const hist = new Uint32Array(256);
    let totalPixels = 0;

    for (let i = 0; i < len; i += 4) {
      // Perceptual luminance
      const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      data[i] = lum;
      data[i + 1] = lum;
      data[i + 2] = lum;
      hist[lum]++;
      totalPixels++;
    }

    // 2. Contrast stretching (2% to 98% percentile)
    const lowerBoundPixelCount = totalPixels * 0.02;
    const upperBoundPixelCount = totalPixels * 0.98;

    let acc = 0;
    let minLum = 0;
    let maxLum = 255;

    for (let i = 0; i < 256; i++) {
      acc += hist[i];
      if (acc >= lowerBoundPixelCount && minLum === 0) {
        minLum = i;
      }
      if (acc >= upperBoundPixelCount) {
        maxLum = i;
        break;
      }
    }

    if (maxLum <= minLum) {
      maxLum = 255;
      minLum = 0;
    }

    const scale = 255 / (maxLum - minLum);

    // Apply linear stretching and slight gamma curve to preserve handwriting strokes
    for (let i = 0; i < len; i += 4) {
      let val = (data[i] - minLum) * scale;
      if (val < 0) val = 0;
      if (val > 255) val = 255;

      // Slight unsharp/contrast boost for dark ink strokes (< 160)
      if (val < 160) {
        val = val * 0.92; // deepen ink
      } else {
        val = Math.min(255, val * 1.05); // whiten paper background
      }

      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
    }

    ctx.putImageData(imgData, 0, 0);
    return destCanvas;
  }

  /**
   * Evaluate image quality: detects motion blur (Laplacian variance) and lighting issues.
   */
  public static assessQuality(canvas: HTMLCanvasElement): QualityMetrics {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      return {
        isBlurry: false,
        laplacianVariance: 50,
        averageBrightness: 128,
        isTooDark: false,
        isTooBright: false,
      };
    }

    // Sample a downscaled center region (160x120) for lightning-fast blur detection
    const sampleW = 160;
    const sampleH = 120;
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = sampleW;
    sampleCanvas.height = sampleH;
    const sCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
    if (!sCtx) {
      return {
        isBlurry: false,
        laplacianVariance: 50,
        averageBrightness: 128,
        isTooDark: false,
        isTooBright: false,
      };
    }

    sCtx.drawImage(canvas, 0, 0, sampleW, sampleH);
    const imgData = sCtx.getImageData(0, 0, sampleW, sampleH);
    const data = imgData.data;

    // Convert to grayscale grid
    const gray = new Float32Array(sampleW * sampleH);
    let sumLum = 0;

    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      gray[j] = lum;
      sumLum += lum;
    }

    const avgBrightness = sumLum / gray.length;

    // Compute Laplacian variance (standard computer vision blur metric)
    // 3x3 Laplacian kernel:
    // [ 0,  1,  0 ]
    // [ 1, -4,  1 ]
    // [ 0,  1,  0 ]
    let lapSum = 0;
    let lapSqSum = 0;
    let count = 0;

    for (let y = 1; y < sampleH - 1; y++) {
      const rowOffset = y * sampleW;
      for (let x = 1; x < sampleW - 1; x++) {
        const center = gray[rowOffset + x];
        const up = gray[rowOffset - sampleW + x];
        const down = gray[rowOffset + sampleW + x];
        const left = gray[rowOffset + x - 1];
        const right = gray[rowOffset + x + 1];

        const lap = up + down + left + right - 4 * center;
        lapSum += lap;
        lapSqSum += lap * lap;
        count++;
      }
    }

    const lapMean = lapSum / count;
    const lapVariance = lapSqSum / count - lapMean * lapMean;

    // A low variance indicates heavy motion blur or flat out-of-focus scene
    const isBlurry = lapVariance < 16.0;
    const isTooDark = avgBrightness < 35;
    const isTooBright = avgBrightness > 235;

    return {
      isBlurry,
      laplacianVariance: lapVariance,
      averageBrightness: avgBrightness,
      isTooDark,
      isTooBright,
    };
  }

  /**
   * Fast temporal change detection: check if the camera frame has noticeably moved or changed.
   * Returns true if frame has changed sufficiently to justify OCR processing.
   */
  public static hasSignificantChange(canvas: HTMLCanvasElement, thresholdPercent: number = 3.5): boolean {
    const size = this.SAMPLE_GRID_SIZE;
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = size;
    sampleCanvas.height = size;
    const ctx = sampleCanvas.getContext('2d');
    if (!ctx) return true;

    ctx.drawImage(canvas, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;

    if (!this.lastFrameSample) {
      this.lastFrameSample = new Uint8ClampedArray(data.length / 4);
      for (let i = 0, j = 0; i < data.length; i += 4, j++) {
        this.lastFrameSample[j] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      }
      return true;
    }

    let diffSum = 0;
    const totalPixels = size * size;

    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      diffSum += Math.abs(lum - this.lastFrameSample[j]);
      this.lastFrameSample[j] = lum;
    }

    const avgDiff = diffSum / totalPixels;
    // Normalized to 0..100%
    const changePercentage = (avgDiff / 255) * 100;
    return changePercentage >= thresholdPercent;
  }
}
