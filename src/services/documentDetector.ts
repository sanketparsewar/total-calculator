import { DocumentBounds, BoundingBox } from '../types/scanner';

export class DocumentDetector {
  /**
   * Detect likely paper or bill region within the given canvas frame.
   * If detected with good confidence, returns the normalized bounds;
   * otherwise falls back to the full frame (0,0 to 1,1).
   */
  public static detectDocument(canvas: HTMLCanvasElement): DocumentBounds {
    const width = canvas.width;
    const height = canvas.height;

    // Use downscaled canvas for edge analysis
    const sampleW = 120;
    const sampleH = Math.round((120 / width) * height);
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = sampleW;
    sampleCanvas.height = sampleH;

    const ctx = sampleCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      return this.defaultFullBounds();
    }

    ctx.drawImage(canvas, 0, 0, sampleW, sampleH);
    const imgData = ctx.getImageData(0, 0, sampleW, sampleH);
    const data = imgData.data;

    // Compute luminance and edge map
    const gray = new Float32Array(sampleW * sampleH);
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      gray[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }

    // Sobel horizontal and vertical gradients
    const edge = new Float32Array(sampleW * sampleH);
    for (let y = 1; y < sampleH - 1; y++) {
      for (let x = 1; x < sampleW - 1; x++) {
        const idx = y * sampleW + x;
        const gx =
          -gray[idx - sampleW - 1] +
          gray[idx - sampleW + 1] -
          2 * gray[idx - 1] +
          2 * gray[idx + 1] -
          gray[idx + sampleW - 1] +
          gray[idx + sampleW + 1];

        const gy =
          -gray[idx - sampleW - 1] -
          2 * gray[idx - sampleW] -
          gray[idx - sampleW + 1] +
          gray[idx + sampleW - 1] +
          2 * gray[idx + sampleW] +
          gray[idx + sampleW + 1];

        edge[idx] = Math.hypot(gx, gy);
      }
    }

    // Analyze row and column edge densities to locate bill boundaries
    const colEdges = new Float32Array(sampleW);
    const rowEdges = new Float32Array(sampleH);

    for (let y = 0; y < sampleH; y++) {
      for (let x = 0; x < sampleW; x++) {
        const val = edge[y * sampleW + x];
        if (val > 45) {
          colEdges[x] += val;
          rowEdges[y] += val;
        }
      }
    }

    // Find likely left/right/top/bottom paper boundaries
    let left = 0;
    let right = sampleW - 1;
    let top = 0;
    let bottom = sampleH - 1;

    for (let x = 5; x < sampleW * 0.4; x++) {
      if (colEdges[x] > 400) {
        left = x;
        break;
      }
    }

    for (let x = sampleW - 6; x > sampleW * 0.6; x--) {
      if (colEdges[x] > 400) {
        right = x;
        break;
      }
    }

    for (let y = 5; y < sampleH * 0.4; y++) {
      if (rowEdges[y] > 400) {
        top = y;
        break;
      }
    }

    for (let y = sampleH - 6; y > sampleH * 0.6; y--) {
      if (rowEdges[y] > 400) {
        bottom = y;
        break;
      }
    }

    const normLeft = Math.max(0, left / sampleW);
    const normRight = Math.min(1, right / sampleW);
    const normTop = Math.max(0, top / sampleH);
    const normBottom = Math.min(1, bottom / sampleH);

    const docWidth = normRight - normLeft;
    const docHeight = normBottom - normTop;

    // Check if detected area forms a reasonable document shape (at least 35% of frame)
    const isReasonableDocument = docWidth >= 0.4 && docHeight >= 0.4 && docWidth * docHeight >= 0.25;

    if (isReasonableDocument && (normLeft > 0.04 || normRight < 0.96 || normTop > 0.04 || normBottom < 0.96)) {
      return {
        topLeft: { x: normLeft, y: normTop },
        topRight: { x: normRight, y: normTop },
        bottomRight: { x: normRight, y: normBottom },
        bottomLeft: { x: normLeft, y: normBottom },
        confidence: 0.82,
        isConfident: true,
      };
    }

    return this.defaultFullBounds();
  }

  private static defaultFullBounds(): DocumentBounds {
    return {
      topLeft: { x: 0, y: 0 },
      topRight: { x: 1, y: 0 },
      bottomRight: { x: 1, y: 1 },
      bottomLeft: { x: 0, y: 1 },
      confidence: 0.5,
      isConfident: false,
    };
  }

  /**
   * Crop the document region from the source canvas.
   */
  public static cropDocumentRegion(
    sourceCanvas: HTMLCanvasElement,
    bounds: DocumentBounds
  ): { canvas: HTMLCanvasElement; offsetBbox: BoundingBox } {
    if (!bounds.isConfident) {
      return {
        canvas: sourceCanvas,
        offsetBbox: { x: 0, y: 0, width: 1, height: 1 },
      };
    }

    const x = Math.round(bounds.topLeft.x * sourceCanvas.width);
    const y = Math.round(bounds.topLeft.y * sourceCanvas.height);
    const w = Math.round((bounds.bottomRight.x - bounds.topLeft.x) * sourceCanvas.width);
    const h = Math.round((bounds.bottomRight.y - bounds.topLeft.y) * sourceCanvas.height);

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = Math.max(1, w);
    cropCanvas.height = Math.max(1, h);

    const ctx = cropCanvas.getContext('2d');
    if (!ctx) {
      return { canvas: sourceCanvas, offsetBbox: { x: 0, y: 0, width: 1, height: 1 } };
    }

    ctx.drawImage(sourceCanvas, x, y, w, h, 0, 0, w, h);

    return {
      canvas: cropCanvas,
      offsetBbox: {
        x: bounds.topLeft.x,
        y: bounds.topLeft.y,
        width: bounds.bottomRight.x - bounds.topLeft.x,
        height: bounds.bottomRight.y - bounds.topLeft.y,
      },
    };
  }
}
