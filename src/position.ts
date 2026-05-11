import type { PositionOptions, SpreadValue } from './definitions';
import { Position } from './definitions';
import { resolveSpread } from './padding';

/** Default outer margin (in px) used when an enum position is supplied. */
export const DEFAULT_POSITION_MARGIN = 20;

export interface Anchor {
  x: number;
  y: number;
}

/**
 * Resolves a {@link PositionOptions} block to absolute top-left pixel coordinates
 * for placing a box of size `contentW`×`contentH` inside `containerW`×`containerH`.
 *
 * When `options.position` is provided it takes precedence over `X`/`Y` and
 * the resulting anchor places the content at the chosen corner/center with
 * a small outer margin. Otherwise `X`/`Y` (numbers or `%`) are used directly.
 */
export function resolveAnchor(
  options: PositionOptions | undefined,
  contentW: number,
  contentH: number,
  containerW: number,
  containerH: number,
): Anchor {
  const margin = DEFAULT_POSITION_MARGIN;
  if (options?.position) {
    switch (options.position) {
      case Position.topLeft:
        return { x: margin, y: margin };
      case Position.topCenter:
        return { x: (containerW - contentW) / 2, y: margin };
      case Position.topRight:
        return { x: containerW - contentW - margin, y: margin };
      case Position.center:
        return { x: (containerW - contentW) / 2, y: (containerH - contentH) / 2 };
      case Position.bottomLeft:
        return { x: margin, y: containerH - contentH - margin };
      case Position.bottomCenter:
        return { x: (containerW - contentW) / 2, y: containerH - contentH - margin };
      case Position.bottomRight:
        return { x: containerW - contentW - margin, y: containerH - contentH - margin };
    }
  }
  return {
    x: resolveSpread(options?.X as SpreadValue | undefined, containerW),
    y: resolveSpread(options?.Y as SpreadValue | undefined, containerH),
  };
}
