import { WebPlugin } from '@capacitor/core';

import type {
  CornerRadius,
  ImageMarkerPlugin,
  ImageMarkOptions,
  ImageOptions,
  MarkResult,
  RadiusValue,
  TextBackgroundStyle,
  TextMarkOptions,
  TextOptions,
  TextStyle,
  WatermarkImageOptions,
} from './definitions';
import { ImageFormat, TextBackgroundType } from './definitions';
import { resolvePadding, resolveSpread } from './padding';
import { resolveAnchor } from './position';

const DEFAULT_FONT_SIZE = 14;
const DEFAULT_TEXT_COLOR = '#000000';
const DEFAULT_FONT_FAMILY = 'sans-serif';

export class ImageMarkerWeb extends WebPlugin implements ImageMarkerPlugin {
  async markText(options: TextMarkOptions): Promise<MarkResult> {
    requireSrc(options.backgroundImage);
    const bg = await loadImage(options.backgroundImage.src);
    const { canvas, ctx } = createCanvas(bg.width, bg.height);

    drawBaseImage(ctx, bg, options.backgroundImage);

    for (const text of options.watermarkTexts ?? []) {
      drawText(ctx, text, canvas.width, canvas.height);
    }

    const rotated = applyBackgroundRotation(canvas, options.backgroundImage.rotate ?? 0);
    return exportCanvas(rotated, options.saveFormat, options.quality);
  }

  async markImage(options: ImageMarkOptions): Promise<MarkResult> {
    requireSrc(options.backgroundImage);
    if (!options.watermarkImages?.length) {
      throw new Error('please set mark image!');
    }
    options.watermarkImages.forEach(requireSrc);

    const bg = await loadImage(options.backgroundImage.src);
    const watermarks = await Promise.all(options.watermarkImages.map(m => loadImage(m.src)));
    const { canvas, ctx } = createCanvas(bg.width, bg.height);

    drawBaseImage(ctx, bg, options.backgroundImage);

    options.watermarkImages.forEach((opts, idx) => {
      drawWatermarkImage(ctx, watermarks[idx], opts, canvas.width, canvas.height);
    });

    const rotated = applyBackgroundRotation(canvas, options.backgroundImage.rotate ?? 0);
    return exportCanvas(rotated, options.saveFormat, options.quality);
  }
}

function requireSrc(opts: ImageOptions | undefined): asserts opts is ImageOptions {
  if (!opts || !opts.src) throw new Error('please set image!');
}

function createCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Unable to acquire 2D canvas context');
  return { canvas, ctx };
}

function normalizeSrc(src: string): string {
  if (!src) return src;
  if (
    src.startsWith('data:') ||
    src.startsWith('blob:') ||
    src.startsWith('http://') ||
    src.startsWith('https://') ||
    src.startsWith('file://') ||
    src.startsWith('/')
  ) {
    return src;
  }
  // Assume bare base64
  return `data:image/png;base64,${src}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = normalizeSrc(src);
  });
}

function drawBaseImage(ctx: CanvasRenderingContext2D, img: HTMLImageElement, opts: ImageOptions): void {
  ctx.save();
  ctx.globalAlpha = clamp(opts.alpha ?? 1, 0, 1);
  const scale = opts.scale ?? 1;
  if (scale !== 1 && scale > 0) {
    const cx = ctx.canvas.width / 2;
    const cy = ctx.canvas.height / 2;
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.translate(-cx, -cy);
  }
  ctx.drawImage(img, 0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

function drawWatermarkImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  opts: WatermarkImageOptions,
  containerW: number,
  containerH: number,
): void {
  const scale = opts.scale ?? 1;
  const w = img.width * scale;
  const h = img.height * scale;
  const anchor = resolveAnchor(opts.position, w, h, containerW, containerH);

  ctx.save();
  ctx.globalAlpha = clamp(opts.alpha ?? 1, 0, 1);
  const rotate = opts.rotate ?? 0;
  if (rotate !== 0) {
    const cx = anchor.x + w / 2;
    const cy = anchor.y + h / 2;
    ctx.translate(cx, cy);
    ctx.rotate((rotate * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  }
  ctx.drawImage(img, anchor.x, anchor.y, w, h);
  ctx.restore();
}

function drawText(
  ctx: CanvasRenderingContext2D,
  options: TextOptions,
  containerW: number,
  containerH: number,
): void {
  const style: TextStyle = options.style ?? {};
  const fontSize = style.fontSize ?? DEFAULT_FONT_SIZE;
  const fontFamily = style.fontName ?? DEFAULT_FONT_FAMILY;
  const fontParts: string[] = [];
  if (style.italic) fontParts.push('italic');
  if (style.bold) fontParts.push('bold');
  fontParts.push(`${fontSize}px`);
  fontParts.push(`"${fontFamily}"`);

  ctx.save();
  ctx.font = fontParts.join(' ');
  ctx.textBaseline = 'top';

  const lines = (options.text ?? '').split(/\r?\n/);
  const metrics = lines.map(l => ctx.measureText(l));
  const lineHeight = fontSize * 1.2;
  const textWidth = Math.max(0, ...metrics.map(m => m.width));
  const textHeight = lineHeight * lines.length;

  const anchor = resolveAnchor(options.position, textWidth, textHeight, containerW, containerH);
  const rotate = style.rotate ?? 0;
  const skew = style.skewX ?? 0;

  ctx.translate(anchor.x, anchor.y);
  if (rotate !== 0) {
    ctx.translate(textWidth / 2, textHeight / 2);
    ctx.rotate((rotate * Math.PI) / 180);
    ctx.translate(-textWidth / 2, -textHeight / 2);
  }
  if (skew !== 0) {
    const t = -Math.tan((skew * Math.PI) / 180);
    ctx.transform(1, 0, t, 1, 0, 0);
  }

  if (style.textBackgroundStyle) {
    drawTextBackground(
      ctx,
      style.textBackgroundStyle,
      textWidth,
      textHeight,
      containerW,
      containerH,
      anchor.x,
      anchor.y,
    );
  }

  if (style.shadowStyle) {
    ctx.shadowOffsetX = style.shadowStyle.dx;
    ctx.shadowOffsetY = style.shadowStyle.dy;
    ctx.shadowBlur = style.shadowStyle.radius;
    ctx.shadowColor = style.shadowStyle.color;
  }

  ctx.fillStyle = style.color ?? DEFAULT_TEXT_COLOR;
  const align = style.textAlign ?? 'left';
  lines.forEach((line, i) => {
    const w = metrics[i].width;
    let x = 0;
    if (align === 'center') x = (textWidth - w) / 2;
    else if (align === 'right') x = textWidth - w;
    const y = i * lineHeight;
    ctx.fillText(line, x, y);

    if (style.underline) {
      drawHorizontalRule(ctx, x, y + fontSize, w, Math.max(1, fontSize / 14));
    }
    if (style.strikeThrough) {
      drawHorizontalRule(ctx, x, y + fontSize / 2, w, Math.max(1, fontSize / 14));
    }
  });

  ctx.restore();
}

function drawHorizontalRule(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  thickness: number,
): void {
  ctx.save();
  ctx.shadowColor = 'transparent';
  ctx.fillRect(x, y, width, thickness);
  ctx.restore();
}

function drawTextBackground(
  ctx: CanvasRenderingContext2D,
  bg: TextBackgroundStyle,
  textWidth: number,
  textHeight: number,
  containerW: number,
  containerH: number,
  textOriginX: number,
  textOriginY: number,
): void {
  const insets = resolvePadding(bg, containerW, containerH);
  const type = bg.type ?? TextBackgroundType.fit;

  let x: number;
  let y: number;
  let w: number;
  let h: number;

  if (type === TextBackgroundType.stretchX) {
    x = -textOriginX;
    y = -insets.top;
    w = containerW;
    h = textHeight + insets.top + insets.bottom;
  } else if (type === TextBackgroundType.stretchY) {
    x = -insets.left;
    y = -textOriginY;
    w = textWidth + insets.left + insets.right;
    h = containerH;
  } else {
    x = -insets.left;
    y = -insets.top;
    w = textWidth + insets.left + insets.right;
    h = textHeight + insets.top + insets.bottom;
  }

  ctx.save();
  ctx.fillStyle = bg.color;
  if (bg.cornerRadius) {
    fillRoundedRect(ctx, x, y, w, h, bg.cornerRadius, containerW, containerH);
  } else {
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

function radiusOr(r: RadiusValue | undefined, fallback: RadiusValue | undefined): RadiusValue {
  return r ?? fallback ?? { x: 0, y: 0 };
}

function fillRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radii: CornerRadius,
  relW: number,
  relH: number,
): void {
  const tl = radiusOr(radii.topLeft, radii.all);
  const tr = radiusOr(radii.topRight, radii.all);
  const br = radiusOr(radii.bottomRight, radii.all);
  const bl = radiusOr(radii.bottomLeft, radii.all);

  const tlx = resolveSpread(tl.x, relW);
  const tly = resolveSpread(tl.y, relH);
  const trx = resolveSpread(tr.x, relW);
  const try_ = resolveSpread(tr.y, relH);
  const brx = resolveSpread(br.x, relW);
  const bry = resolveSpread(br.y, relH);
  const blx = resolveSpread(bl.x, relW);
  const bly = resolveSpread(bl.y, relH);

  ctx.beginPath();
  ctx.moveTo(x + tlx, y);
  ctx.lineTo(x + w - trx, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + try_);
  ctx.lineTo(x + w, y + h - bry);
  ctx.quadraticCurveTo(x + w, y + h, x + w - brx, y + h);
  ctx.lineTo(x + blx, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - bly);
  ctx.lineTo(x, y + tly);
  ctx.quadraticCurveTo(x, y, x + tlx, y);
  ctx.closePath();
  ctx.fill();
}

function applyBackgroundRotation(source: HTMLCanvasElement, rotate: number): HTMLCanvasElement {
  if (!rotate) return source;
  const rad = (rotate * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const w = Math.round(source.width * cos + source.height * sin);
  const h = Math.round(source.width * sin + source.height * cos);
  const { canvas, ctx } = createCanvas(w, h);
  ctx.translate(w / 2, h / 2);
  ctx.rotate(rad);
  ctx.drawImage(source, -source.width / 2, -source.height / 2);
  return canvas;
}

function exportCanvas(
  canvas: HTMLCanvasElement,
  saveFormat: ImageFormat | undefined,
  quality: number | undefined,
): MarkResult {
  const fmt = saveFormat ?? ImageFormat.jpg;
  const q = clamp(quality ?? 100, 0, 100) / 100;
  if (fmt === ImageFormat.base64) {
    return { uri: canvas.toDataURL('image/png') };
  }
  const mime = fmt === ImageFormat.png ? 'image/png' : 'image/jpeg';
  return { uri: canvas.toDataURL(mime, q) };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
