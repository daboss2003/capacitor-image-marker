/**
 * Position of a watermark relative to the background image.
 */
export enum Position {
  topLeft = 'topLeft',
  topCenter = 'topCenter',
  topRight = 'topRight',
  bottomLeft = 'bottomLeft',
  bottomCenter = 'bottomCenter',
  bottomRight = 'bottomRight',
  center = 'center',
}

/**
 * How a text background should be sized relative to its text.
 * - `stretchX` — background spans the full width of the parent image
 * - `stretchY` — background spans the full height of the parent image
 * - `fit` — background hugs the text plus padding
 */
export enum TextBackgroundType {
  stretchX = 'stretchX',
  stretchY = 'stretchY',
  fit = 'fit',
}

/**
 * Output format for the marked image.
 * `png` and `jpg` write to a temp file and return its file URI.
 * `base64` returns a `data:image/...;base64,...` data URI.
 */
export enum ImageFormat {
  png = 'png',
  jpg = 'jpg',
  base64 = 'base64',
}

/** A scalar or percent string like `"10%"`. Percents are relative to the parent dimension. */
export type SpreadValue = number | string;

/**
 * CSS-like padding. May be supplied as numbers, percent strings, or shorthand
 * `padding` strings like `"10 20% 30 40"`. Individual sides take precedence over shorthand.
 */
export interface Padding {
  padding?: SpreadValue;
  paddingLeft?: SpreadValue;
  paddingRight?: SpreadValue;
  paddingTop?: SpreadValue;
  paddingBottom?: SpreadValue;
  paddingHorizontal?: SpreadValue;
  paddingVertical?: SpreadValue;
  paddingX?: SpreadValue;
  paddingY?: SpreadValue;
}

/**
 * Watermark anchor. Supply either `X`/`Y` (absolute or `%` of background dims)
 * or a `position` enum value. If `position` is set the explicit coordinates are
 * ignored.
 */
export interface PositionOptions {
  X?: SpreadValue;
  Y?: SpreadValue;
  position?: Position;
}

/** Drop shadow under text. */
export interface ShadowLayerStyle {
  dx: number;
  dy: number;
  radius: number;
  color: string;
}

/** Per-axis corner radius value. */
export interface RadiusValue {
  x: SpreadValue;
  y: SpreadValue;
}

/** Per-corner radii for a text background rectangle. */
export interface CornerRadius {
  topLeft?: RadiusValue;
  topRight?: RadiusValue;
  bottomLeft?: RadiusValue;
  bottomRight?: RadiusValue;
  /** Convenience: applies to every corner unless that corner is overridden. */
  all?: RadiusValue;
}

/** Filled rectangle drawn behind text. */
export interface TextBackgroundStyle extends Padding {
  type?: TextBackgroundType | null;
  color: string;
  cornerRadius?: CornerRadius;
}

/** Glyph styling for a single watermark text. */
export interface TextStyle {
  color?: string;
  fontName?: string;
  /** Font size in pt (iOS) / sp (Android) / px (Web). */
  fontSize?: number;
  shadowStyle?: ShadowLayerStyle | null;
  textBackgroundStyle?: TextBackgroundStyle | null;
  underline?: boolean;
  /** X-axis skew angle in degrees, an alternative to `italic`. */
  skewX?: number;
  strikeThrough?: boolean;
  textAlign?: 'left' | 'center' | 'right';
  italic?: boolean;
  bold?: boolean;
  /** Rotation of the text in degrees around its anchor. */
  rotate?: number;
}

/**
 * A single watermark text instance.
 */
export interface TextOptions {
  text: string;
  /**
   * Position of the watermark. Either `position`/`X`/`Y` describing an anchor
   * or one of the enum positions for the corners/center of the parent image.
   */
  position?: PositionOptions;
  style?: TextStyle;
}

/** Common image-source description shared by background and watermark images. */
export interface ImageOptions {
  /**
   * Image source. Accepted forms:
   * - An absolute `file://` path
   * - An `http://` or `https://` URL
   * - A `data:image/...;base64,...` data URI
   * - A bare base64 string (no `data:` prefix); will be decoded as PNG/JPEG.
   */
  src: string;
  /** Uniform scale factor. Defaults to `1`. */
  scale?: number;
  /** Rotation in degrees. Defaults to `0`. */
  rotate?: number;
  /** Opacity from `0` (transparent) to `1` (opaque). Defaults to `1`. */
  alpha?: number;
}

/** A watermark image with its own position. */
export interface WatermarkImageOptions extends ImageOptions {
  position?: PositionOptions;
}

/** Arguments to {@link ImageMarkerPlugin.markText}. */
export interface TextMarkOptions {
  backgroundImage: ImageOptions;
  watermarkTexts: TextOptions[];
  /** JPEG compression quality 0–100. Defaults to `100`. */
  quality?: number;
  /** Optional output filename (without path). Ignored for `base64` output. */
  filename?: string;
  /** Output format. Defaults to `jpg`. */
  saveFormat?: ImageFormat;
  /** Upper bound for either side of the source image in pixels. Defaults to `2048`. */
  maxSize?: number;
}

/** Arguments to {@link ImageMarkerPlugin.markImage}. */
export interface ImageMarkOptions {
  backgroundImage: ImageOptions;
  watermarkImages: WatermarkImageOptions[];
  quality?: number;
  filename?: string;
  saveFormat?: ImageFormat;
  maxSize?: number;
}

/** Result envelope returned from both `markText` and `markImage`. */
export interface MarkResult {
  /**
   * Either a `file://` path to the rendered image on disk, or, when
   * `saveFormat` is `ImageFormat.base64`, a `data:image/png;base64,...` URI.
   */
  uri: string;
}

export interface ImageMarkerPlugin {
  /**
   * Render one or more text watermarks on top of a background image.
   * Resolves with the URI of the produced image.
   */
  markText(options: TextMarkOptions): Promise<MarkResult>;

  /**
   * Render one or more image watermarks on top of a background image.
   * Resolves with the URI of the produced image.
   */
  markImage(options: ImageMarkOptions): Promise<MarkResult>;
}
