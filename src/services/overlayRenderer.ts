import { LineItem, DocumentBounds, ColumnBoundary } from '../types/scanner';

export interface OverlayRenderOptions {
  items: LineItem[];
  documentBounds?: DocumentBounds;
  columnBoundary?: ColumnBoundary;
  showDiagnostics?: boolean;
  currencySymbol?: string;
}

export class OverlayRenderer {
  /**
   * Render green bounding boxes for accepted amounts, amber for uncertain,
   * and red/blue diagnostic guides onto the overlay canvas.
   */
  public static render(
    canvas: HTMLCanvasElement,
    video: HTMLVideoElement,
    options: OverlayRenderOptions
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const clientWidth = canvas.clientWidth;
    const clientHeight = canvas.clientHeight;

    // Adjust canvas resolution for Retina / high-DPI screens
    if (canvas.width !== clientWidth * dpr || canvas.height !== clientHeight * dpr) {
      canvas.width = clientWidth * dpr;
      canvas.height = clientHeight * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, clientWidth, clientHeight);

    const videoWidth = video.videoWidth || clientWidth;
    const videoHeight = video.videoHeight || clientHeight;

    if (videoWidth === 0 || videoHeight === 0) {
      ctx.restore();
      return;
    }

    // Calculate object-fit: cover transformation
    const videoAspect = videoWidth / videoHeight;
    const containerAspect = clientWidth / clientHeight;

    let scale = 1;
    let offsetX = 0;
    let offsetY = 0;

    if (containerAspect > videoAspect) {
      // Container is wider than video: cropped top and bottom
      scale = clientWidth / videoWidth;
      offsetY = (clientHeight - videoHeight * scale) / 2;
    } else {
      // Container is taller than video: cropped left and right
      scale = clientHeight / videoHeight;
      offsetX = (clientWidth - videoWidth * scale) / 2;
    }

    const renderWidth = videoWidth * scale;
    const renderHeight = videoHeight * scale;

    const toScreen = (normX: number, normY: number) => ({
      x: offsetX + normX * renderWidth,
      y: offsetY + normY * renderHeight,
    });

    const toScreenDim = (normW: number, normH: number) => ({
      width: normW * renderWidth,
      height: normH * renderHeight,
    });

    // 1. Draw Document Boundary if detected & diagnostics enabled
    if (options.showDiagnostics && options.documentBounds && options.documentBounds.isConfident) {
      const b = options.documentBounds;
      const tl = toScreen(b.topLeft.x, b.topLeft.y);
      const tr = toScreen(b.topRight.x, b.topRight.y);
      const br = toScreen(b.bottomRight.x, b.bottomRight.y);
      const bl = toScreen(b.bottomLeft.x, b.bottomLeft.y);

      ctx.beginPath();
      ctx.moveTo(tl.x, tl.y);
      ctx.lineTo(tr.x, tr.y);
      ctx.lineTo(br.x, br.y);
      ctx.lineTo(bl.x, bl.y);
      ctx.closePath();
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.7)'; // blue outline
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 2. Draw Column Boundary guideline if diagnostics enabled
    if (options.showDiagnostics && options.columnBoundary) {
      const col = options.columnBoundary;
      const colX = offsetX + col.minX * renderWidth;

      ctx.beginPath();
      ctx.moveTo(colX, 0);
      ctx.lineTo(colX, clientHeight);
      ctx.strokeStyle = 'rgba(234, 179, 8, 0.75)'; // yellow dashed line
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(234, 179, 8, 0.9)';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('AMOUNT COLUMN', colX + 6, 24);
    }

    // 3. Draw Bounding Boxes for Line Items
    for (const item of options.items) {
      const screenPos = toScreen(item.bbox.x, item.bbox.y);
      const screenDim = toScreenDim(item.bbox.width, item.bbox.height);

      // Clamp minimum box dimensions so labels and boxes are readable
      const boxW = Math.max(screenDim.width, 40);
      const boxH = Math.max(screenDim.height, 22);

      let strokeColor = '#10B981'; // Green (accepted & included)
      let fillColor = 'rgba(16, 185, 129, 0.15)';
      let badgeBg = '#10B981';

      if (item.validationStatus === 'accepted' && item.isIncluded) {
        strokeColor = '#10B981'; // Vibrant Green
        fillColor = 'rgba(16, 185, 129, 0.18)';
        badgeBg = '#059669';
      } else if (item.validationStatus === 'uncertain') {
        strokeColor = '#F59E0B'; // Amber
        fillColor = 'rgba(245, 158, 11, 0.15)';
        badgeBg = '#D97706';
      } else {
        // Rejected / Excluded
        if (!options.showDiagnostics) continue; // Don't clutter unless diagnostics requested
        strokeColor = '#EF4444'; // Red
        fillColor = 'rgba(239, 68, 68, 0.12)';
        badgeBg = '#DC2626';
      }

      // Rounded rectangle for the bounding box
      const radius = 4;
      ctx.beginPath();
      ctx.roundRect(screenPos.x, screenPos.y, boxW, boxH, radius);
      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Price Tag Badge on top-right of box
      const labelText = `${options.currencySymbol || '₹'}${item.displayAmount}`;
      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const textMetrics = ctx.measureText(labelText);
      const badgeW = textMetrics.width + 10;
      const badgeH = 18;
      const badgeX = Math.min(screenPos.x + boxW - badgeW, clientWidth - badgeW - 4);
      const badgeY = Math.max(screenPos.y - badgeH - 2, 4);

      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 3);
      ctx.fillStyle = badgeBg;
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(labelText, badgeX + 5, badgeY + 13);
    }

    ctx.restore();
  }
}
