# @daboss2003/capacitor-image-marker

A Capacitor plugin for adding text and image watermarks to images on **iOS**, **Android**, and **Web**.

This is a from-scratch Capacitor port of the API surface of
[`react-native-image-marker`](https://github.com/JimmyDaddy/react-native-image-marker)
(MIT licensed, by [@JimmyDaddy](https://github.com/JimmyDaddy)). No source code
from the original project is included — see `NOTICE` for attribution.

## Install

```bash
npm install @daboss2003/capacitor-image-marker
npx cap sync
```

### Platform requirements

| Platform | Minimum |
| --- | --- |
| iOS    | 13.0 |
| Android | SDK 22 |
| Web    | Any modern browser with Canvas 2D |

## Example app

A working Capacitor app that exercises every feature (text watermarks, image
watermarks, position presets, font size, scale, max-size, save format, etc.)
lives in [`example/`](./example). Quick start:

```bash
cd example
npm install
npm run dev            # opens http://localhost:5173

# Native:
npx cap add ios && npm run ios
npx cap add android && npm run android
```

See [`example/README.md`](./example/README.md) for details.

## Image sources

Wherever an `ImageOptions.src` is accepted, you may pass:

- An absolute `file://` path (e.g. from `@capacitor/filesystem`)
- An `http://` / `https://` URL
- A `data:image/...;base64,...` data URI
- A bare base64 string (will be treated as PNG/JPEG payload)

No `require('./image.png')` style asset references — pass real URIs.

## Quick start

### Mark text on an image

```ts
import {
  ImageMarker,
  Position,
  TextBackgroundType,
  ImageFormat,
} from '@daboss2003/capacitor-image-marker';

const result = await ImageMarker.markText({
  backgroundImage: {
    src: 'file:///path/to/photo.jpg',
    scale: 1,
    rotate: 0,
    alpha: 1,
  },
  watermarkTexts: [
    {
      text: 'Hello, World',
      position: { position: Position.bottomRight },
      style: {
        color: '#ffffff',
        fontSize: 36,
        fontName: 'Helvetica',
        bold: true,
        shadowStyle: {
          dx: 2,
          dy: 2,
          radius: 4,
          color: '#000000aa',
        },
        textBackgroundStyle: {
          type: TextBackgroundType.none,
          color: '#00000088',
          padding: '8 12',
          cornerRadius: {
            all: { x: 6, y: 6 },
          },
        },
      },
    },
  ],
  quality: 90,
  saveFormat: ImageFormat.jpg,
});

console.log(result.uri); // file:// path (or data: URI when saveFormat is base64)
```

### Mark image on image

```ts
const result = await ImageMarker.markImage({
  backgroundImage: { src: 'file:///path/to/photo.jpg' },
  watermarkImages: [
    {
      src: 'file:///path/to/logo.png',
      scale: 0.5,
      alpha: 0.8,
      rotate: 0,
      position: { position: Position.bottomLeft },
    },
  ],
  saveFormat: ImageFormat.png,
});
```

## API

```ts
ImageMarker.markText(options: TextMarkOptions): Promise<MarkResult>
ImageMarker.markImage(options: ImageMarkOptions): Promise<MarkResult>
```

Both methods resolve with `{ uri: string }`:

- For `saveFormat: 'png' | 'jpg'` (default `jpg`), `uri` is a `file://` path
  to the rendered image in the app's cache directory.
- For `saveFormat: 'base64'`, `uri` is a `data:image/png;base64,...` data URI.

### `TextMarkOptions`

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `backgroundImage` | `ImageOptions` | — | Image to draw text on. |
| `watermarkTexts` | `TextOptions[]` | `[]` | Text watermarks to render. |
| `quality` | `number` (0–100) | `100` | JPEG quality. |
| `filename` | `string` | random | Output filename in cache dir. |
| `saveFormat` | `'png' \| 'jpg' \| 'base64'` | `'jpg'` | Output format. |
| `maxSize` | `number` | `2048` | Downscale source so neither side exceeds this. |

### `ImageMarkOptions`

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `backgroundImage` | `ImageOptions` | — | Image to draw watermarks on. |
| `watermarkImages` | `WatermarkImageOptions[]` | — | One or more image watermarks. |
| `quality` | `number` | `100` | JPEG quality. |
| `filename` | `string` | random | Output filename in cache dir. |
| `saveFormat` | `'png' \| 'jpg' \| 'base64'` | `'jpg'` | Output format. |
| `maxSize` | `number` | `2048` | Downscale source so neither side exceeds this. |

### `ImageOptions`

```ts
interface ImageOptions {
  src: string;       // file:// | http(s):// | data: | bare base64
  scale?: number;    // default 1
  rotate?: number;   // degrees, default 0
  alpha?: number;    // 0..1, default 1
}
```

### `WatermarkImageOptions`

Same as `ImageOptions` plus:

```ts
interface WatermarkImageOptions extends ImageOptions {
  position?: PositionOptions;
}
```

### `PositionOptions`

Anchor a watermark either with an enum or with explicit coordinates.

```ts
interface PositionOptions {
  X?: number | string;   // px, or "10%" of background width
  Y?: number | string;   // px, or "10%" of background height
  position?: Position;   // takes precedence if set
}

enum Position {
  topLeft, topCenter, topRight,
  bottomLeft, bottomCenter, bottomRight,
  center,
}
```

### `TextOptions`

```ts
interface TextOptions {
  text: string;
  position?: PositionOptions;
  style?: TextStyle;
}
```

### `TextStyle`

```ts
interface TextStyle {
  color?: string;                     // CSS hex (#RGB, #RGBA, #RRGGBB, #RRGGBBAA)
  fontName?: string;
  fontSize?: number;                  // px / pt / sp
  shadowStyle?: ShadowLayerStyle | null;
  textBackgroundStyle?: TextBackgroundStyle | null;
  underline?: boolean;
  strikeThrough?: boolean;
  textAlign?: 'left' | 'center' | 'right';
  italic?: boolean;
  bold?: boolean;
  skewX?: number;                     // degrees, alternative to italic
  rotate?: number;                    // degrees around anchor
}
```

### `TextBackgroundStyle`

A filled (optionally rounded) rectangle drawn behind the text.

```ts
interface TextBackgroundStyle extends Padding {
  type?: 'stretchX' | 'stretchY' | 'fit';   // default 'fit'
  color: string;
  cornerRadius?: CornerRadius;
}
```

Padding is CSS-like — any of these forms work:

```ts
{ padding: 10 }
{ padding: '10%' }
{ padding: '10 20' }
{ padding: '10% 20 30 40' }
{ paddingHorizontal: 12, paddingVertical: 8 }
{ paddingX: 12, paddingY: 8 }
{ paddingLeft: 8, paddingRight: 4, paddingTop: 2, paddingBottom: 2 }
```

`CornerRadius` accepts per-corner or an `all` shorthand:

```ts
{
  cornerRadius: {
    topLeft: { x: 8, y: 8 },
    topRight: { x: 8, y: 8 },
    all: { x: 4, y: 4 },        // applies to corners not set above
  }
}
```

### `ShadowLayerStyle`

```ts
interface ShadowLayerStyle {
  dx: number;
  dy: number;
  radius: number;
  color: string;
}
```

## Notes & caveats

- Coordinates are expressed in pixels of the background image (after any
  `maxSize` downscaling). `'10%'` values are resolved relative to the parent
  dimension (width for `X`/horizontal padding, height for `Y`/vertical
  padding).
- The default outer margin used by the enum `Position` values is `20px`.
- On Web the output is always a `data:` URI (the browser has no file system
  to write to). The `saveFormat` still controls MIME type (PNG vs JPEG).
- iOS uses `UIGraphicsImageRenderer`; Android uses `Bitmap` + `Canvas`; Web
  uses `<canvas>` 2D.

## License

MIT — see [`LICENSE`](./LICENSE) and [`NOTICE`](./NOTICE).
