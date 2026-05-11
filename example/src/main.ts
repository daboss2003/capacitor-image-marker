import { Capacitor } from '@capacitor/core';
import {
  ImageMarker,
  ImageFormat,
  Position,
  TextBackgroundType,
} from '@daboss2003/capacitor-image-marker';

const fileInput = document.getElementById('file-input') as HTMLInputElement;
const useSampleBtn = document.getElementById('use-sample') as HTMLButtonElement;
const sourcePreview = document.getElementById('source-preview') as HTMLImageElement;
const resultPreview = document.getElementById('result-preview') as HTMLImageElement;
const runTextBtn = document.getElementById('run-text') as HTMLButtonElement;
const runImageBtn = document.getElementById('run-image') as HTMLButtonElement;
const textInput = document.getElementById('text') as HTMLInputElement;
const positionSelect = document.getElementById('position') as HTMLSelectElement;
const colorInput = document.getElementById('color') as HTMLInputElement;
const fontSizeInput = document.getElementById('font-size') as HTMLInputElement;
const fontSizeValue = document.getElementById('font-size-value') as HTMLSpanElement;
const logoScaleInput = document.getElementById('logo-scale') as HTMLInputElement;
const logoScaleValue = document.getElementById('logo-scale-value') as HTMLSpanElement;
const maxSizeInput = document.getElementById('max-size') as HTMLInputElement;
const maxSizeValue = document.getElementById('max-size-value') as HTMLSpanElement;
const saveFormatSelect = document.getElementById('save-format') as HTMLSelectElement;
const logEl = document.getElementById('log') as HTMLPreElement;

bindRangeReadout(fontSizeInput, fontSizeValue);
bindRangeReadout(logoScaleInput, logoScaleValue);
bindRangeReadout(maxSizeInput, maxSizeValue);

function bindRangeReadout(input: HTMLInputElement, readout: HTMLSpanElement): void {
  const update = () => {
    readout.textContent = input.value;
  };
  input.addEventListener('input', update);
  update();
}

let sourceUri: string | null = null;

const SAMPLE_IMAGE =
  'https://picsum.photos/seed/capacitor-image-marker/1024/768';

/**
 * Native iOS/Android can't decode SVG to a raster bitmap (UIImage and
 * BitmapFactory only handle PNG/JPEG/etc). So we keep the SVG source readable
 * here but raster it to a PNG via <canvas> before handing it to the plugin.
 */
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
   <defs>
     <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
       <stop offset="0%" stop-color="#60a5fa"/>
       <stop offset="100%" stop-color="#2563eb"/>
     </linearGradient>
   </defs>
   <rect x="10" y="10" width="180" height="180" rx="24" fill="url(#g)"/>
   <text x="50%" y="55%" text-anchor="middle" fill="white"
         font-family="Helvetica, Arial, sans-serif" font-size="56" font-weight="700">
     CAP
   </text>
 </svg>`;

let logoPromise: Promise<string> | null = null;

function getLogoPngDataUri(): Promise<string> {
  if (logoPromise) return logoPromise;
  logoPromise = (async () => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load logo SVG'));
      img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(LOGO_SVG);
    });
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D unavailable');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  })().catch(err => {
    logoPromise = null;
    throw err;
  });
  return logoPromise;
}

function log(message: string, payload?: unknown): void {
  const stamp = new Date().toLocaleTimeString();
  const extra = payload === undefined ? '' : ` — ${typeof payload === 'string' ? payload : JSON.stringify(payload)}`;
  logEl.textContent = `[${stamp}] ${message}${extra}\n${logEl.textContent ?? ''}`;
}

function setSourceUri(uri: string): void {
  sourceUri = uri;
  sourcePreview.src = uri;
  runTextBtn.disabled = false;
  runImageBtn.disabled = false;
}

function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  try {
    const dataUri = await fileToDataUri(file);
    setSourceUri(dataUri);
    log('Loaded image from file picker', { name: file.name, size: file.size });
  } catch (err) {
    log('Failed to read file', (err as Error).message);
  }
});

useSampleBtn.addEventListener('click', () => {
  setSourceUri(SAMPLE_IMAGE);
  log('Using sample image', SAMPLE_IMAGE);
});

runTextBtn.addEventListener('click', async () => {
  if (!sourceUri) return;
  runTextBtn.disabled = true;
  try {
    const result = await ImageMarker.markText({
      backgroundImage: { src: sourceUri },
      watermarkTexts: [
        {
          text: textInput.value || 'Image Marker',
          position: { position: positionSelect.value as Position },
          style: {
            color: colorInput.value || '#ffffff',
            fontSize: Number(fontSizeInput.value),
            fontName: 'Helvetica',
            bold: true,
            shadowStyle: { dx: 2, dy: 2, radius: 4, color: '#000000aa' },
            textBackgroundStyle: {
              type: TextBackgroundType.none,
              color: '#00000088',
              padding: '8 14',
              cornerRadius: { all: { x: 8, y: 8 } },
            },
          },
        },
      ],
      quality: 92,
      saveFormat: saveFormatSelect.value as ImageFormat,
      maxSize: Number(maxSizeInput.value),
    });
    resultPreview.src = Capacitor.convertFileSrc(result.uri);
    log('markText OK', truncate(result.uri));
  } catch (err) {
    log('markText error', (err as Error).message);
  } finally {
    runTextBtn.disabled = false;
  }
});

runImageBtn.addEventListener('click', async () => {
  if (!sourceUri) return;
  runImageBtn.disabled = true;
  try {
    const logoSrc = await getLogoPngDataUri();
    const result = await ImageMarker.markImage({
      backgroundImage: { src: sourceUri },
      watermarkImages: [
        {
          src: logoSrc,
          scale: Number(logoScaleInput.value),
          alpha: 0.9,
          rotate: 0,
          position: { position: positionSelect.value as Position },
        },
      ],
      saveFormat: saveFormatSelect.value as ImageFormat,
      maxSize: Number(maxSizeInput.value),
    });
    resultPreview.src = Capacitor.convertFileSrc(result.uri);
    log('markImage OK', truncate(result.uri));
  } catch (err) {
    log('markImage error', (err as Error).message);
  } finally {
    runImageBtn.disabled = false;
  }
});

function truncate(s: string, max = 80): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

log('Plugin loaded. Pick an image or hit "Use sample" to begin.');
