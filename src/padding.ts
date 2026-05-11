import type { Padding, SpreadValue } from './definitions';

export interface ResolvedInsets {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Resolves a {@link SpreadValue} to pixels. Strings ending in `%` are
 * interpreted as a percentage of `relativeTo`; bare numeric strings are
 * parsed as raw pixels.
 */
export function resolveSpread(value: SpreadValue | undefined, relativeTo: number): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return value;
  const trimmed = value.trim();
  if (trimmed.endsWith('%')) {
    const pct = parseFloat(trimmed.slice(0, -1));
    return Number.isFinite(pct) ? (pct / 100) * relativeTo : 0;
  }
  const px = parseFloat(trimmed);
  return Number.isFinite(px) ? px : 0;
}

function parseShorthand(shorthand: string): SpreadValue[] {
  return shorthand
    .trim()
    .split(/\s+/)
    .map(token => {
      if (token.endsWith('%')) return token;
      const n = Number(token);
      return Number.isFinite(n) ? n : token;
    });
}

/**
 * Expands a CSS-like shorthand (`"10"`, `"10 20"`, `"10 20 30"`,
 * `"10 20 30 40"`) into `[top, right, bottom, left]`.
 */
function expandShorthand(parts: SpreadValue[]): [SpreadValue, SpreadValue, SpreadValue, SpreadValue] {
  switch (parts.length) {
    case 1:
      return [parts[0], parts[0], parts[0], parts[0]];
    case 2:
      return [parts[0], parts[1], parts[0], parts[1]];
    case 3:
      return [parts[0], parts[1], parts[2], parts[1]];
    case 4:
    default:
      return [parts[0], parts[1], parts[2], parts[3]];
  }
}

/**
 * Resolves padding fields (with the same precedence rules as CSS:
 * shorthand → axis → side → individual) to pixel insets.
 *
 * `relativeWidth` / `relativeHeight` are used to resolve `%` values along
 * each axis.
 */
export function resolvePadding(
  padding: Padding | undefined,
  relativeWidth: number,
  relativeHeight: number,
): ResolvedInsets {
  if (!padding) return { left: 0, top: 0, right: 0, bottom: 0 };

  let top: SpreadValue = 0;
  let right: SpreadValue = 0;
  let bottom: SpreadValue = 0;
  let left: SpreadValue = 0;

  if (padding.padding !== undefined) {
    const tokens =
      typeof padding.padding === 'string'
        ? parseShorthand(padding.padding)
        : [padding.padding];
    [top, right, bottom, left] = expandShorthand(tokens);
  }

  const horizontal = padding.paddingHorizontal ?? padding.paddingX;
  if (horizontal !== undefined) {
    left = horizontal;
    right = horizontal;
  }
  const vertical = padding.paddingVertical ?? padding.paddingY;
  if (vertical !== undefined) {
    top = vertical;
    bottom = vertical;
  }

  if (padding.paddingLeft !== undefined) left = padding.paddingLeft;
  if (padding.paddingRight !== undefined) right = padding.paddingRight;
  if (padding.paddingTop !== undefined) top = padding.paddingTop;
  if (padding.paddingBottom !== undefined) bottom = padding.paddingBottom;

  return {
    left: resolveSpread(left, relativeWidth),
    right: resolveSpread(right, relativeWidth),
    top: resolveSpread(top, relativeHeight),
    bottom: resolveSpread(bottom, relativeHeight),
  };
}
