/**
 * 2D coordinate point [x, y] in scene space or local space
 */
export type Point = readonly [number, number];

/**
 * Rotation angle represented in radians (0 to 2*PI)
 */
export type Radians = number;

/**
 * Axis-aligned bounding box [minX, minY, maxX, maxY]
 */
export type Bounds = readonly [number, number, number, number];

/**
 * Geometric dimensions
 */
export type Dimensions = Readonly<{
  width: number;
  height: number;
}>;

/**
 * Supported fill patterns
 */
export type FillStyle = 'hachure' | 'cross-hatch' | 'solid' | 'zigzag';

/**
 * Stroke line pattern
 */
export type StrokeStyle = 'solid' | 'dashed' | 'dotted';

/**
 * Hand-drawn roughness levels (0 = clean architecture, 1 = default sketch, 2 = cartoon)
 */
export type Roughness = 0 | 1 | 2;

/**
 * Font families: 1: Virgil/Hand-drawn, 2: Nunito/Normal sans, 3: Comic Shanns/Code monospace
 */
export type FontFamily = 1 | 2 | 3;

export const FONT_FAMILY = {
  HAND_DRAWN: 1,
  NORMAL: 2,
  MONOSPACE: 3,
} as const;

/**
 * Text alignment options
 */
export type TextAlign = 'left' | 'center' | 'right';
export type VerticalAlign = 'top' | 'middle' | 'bottom';

/**
 * Arrowhead markers
 */
export type Arrowhead = 'arrow' | 'bar' | 'circle' | 'triangle' | 'diamond';

/**
 * Fixed point binding ratio [ratioX, ratioY] relative to bound target's bounding box
 */
export type FixedPointBinding = Readonly<{
  elementId: string;
  focus: number; // -1 to 1 along target edge
  gap: number;
}>;

/**
 * Bound element pointer
 */
export type BoundElement = Readonly<{
  id: string;
  type: 'arrow' | 'text';
}>;

/**
 * Corner roundness descriptor
 */
export type Roundness = Readonly<{
  type: 1 | 2 | 3; // 1: legacy, 2: adaptive radius, 3: proportional
  value?: number;
}>;
