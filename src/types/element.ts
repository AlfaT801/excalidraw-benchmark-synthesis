import {
  Point,
  Radians,
  FillStyle,
  StrokeStyle,
  Roughness,
  FontFamily,
  TextAlign,
  VerticalAlign,
  Arrowhead,
  FixedPointBinding,
  BoundElement,
  Roundness,
} from './base';

/**
 * Canonical element discriminators
 */
export type ElementType =
  | 'rectangle'
  | 'diamond'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'freedraw'
  | 'text'
  | 'selection';

/**
 * Base properties shared by every element in the canvas scene
 */
export type _ExcalidrawElementBase = Readonly<{
  /** Unique nanoid identifier */
  id: string;
  /** Element discriminator */
  type: ElementType;
  /** Top-left X coordinate in scene space */
  x: number;
  /** Top-left Y coordinate in scene space */
  y: number;
  /** Bounding box width (scene units) */
  width: number;
  /** Bounding box height (scene units) */
  height: number;
  /** Rotation angle in radians around center (0 to 2*PI) */
  angle: Radians;
  /** Stroke color as CSS hex or 'transparent' */
  strokeColor: string;
  /** Fill background color as CSS hex or 'transparent' */
  backgroundColor: string;
  /** Fill pattern: 'solid', 'hachure', 'cross-hatch', 'zigzag' */
  fillStyle: FillStyle;
  /** Stroke width in pixels (1, 2, 4) */
  strokeWidth: number;
  /** Stroke style: 'solid', 'dashed', 'dotted' */
  strokeStyle: StrokeStyle;
  /** Roughness factor for rough.js (0 = clean, 1 = sketchy, 2 = cartoon) */
  roughness: Roughness;
  /** Opacity percentage (0 to 100) */
  opacity: number;
  /** Random integer used as seed for deterministic Rough.js rendering */
  seed: number;
  /** Monotonically increasing revision counter */
  version: number;
  /** Random 32-bit integer for multiplayer/tie-breaking reconciliation */
  versionNonce: number;
  /** Soft-delete tombstone flag */
  isDeleted: boolean;
  /** Ordered array of parent group IDs */
  groupIds: readonly string[];
  /** Parent frame ID or null */
  frameId: string | null;
  /** Corner roundness specification or null */
  roundness: Roundness | null;
  /** Pointers to bound elements (e.g. arrows connected to this shape) */
  boundElements: readonly BoundElement[] | null;
  /** Milliseconds epoch timestamp of last mutation */
  updated: number;
  /** Milliseconds epoch timestamp of creation */
  created: number | null;
  /** Optional attached hyperlink */
  link: string | null;
  /** Lock flag to prevent accidental selection or moving */
  locked: boolean;
  /** Optional custom client metadata */
  customData?: Record<string, unknown>;
}>;

/**
 * Rectangle Shape
 */
export type ExcalidrawRectangleElement = _ExcalidrawElementBase & {
  type: 'rectangle';
};

/**
 * Diamond Shape
 */
export type ExcalidrawDiamondElement = _ExcalidrawElementBase & {
  type: 'diamond';
};

/**
 * Ellipse Shape
 */
export type ExcalidrawEllipseElement = _ExcalidrawElementBase & {
  type: 'ellipse';
};

export type { ToolType } from './state';

/**
 * Base Linear Element (Line or Arrow)
 */
export type _ExcalidrawLinearElementBase = _ExcalidrawElementBase &
  Readonly<{
    type: 'line' | 'arrow';
    /** Array of coordinates relative to element (x, y). First point is always [0, 0] */
    points: readonly Point[];
    /** Start binding information */
    startBinding: FixedPointBinding | null;
    /** End binding information */
    endBinding: FixedPointBinding | null;
    /** Arrowhead marker at start */
    startArrowhead: Arrowhead | null;
    /** Arrowhead marker at end */
    endArrowhead: Arrowhead | null;
  }>;

/**
 * Straight or multi-segment Line
 */
export type ExcalidrawLineElement = _ExcalidrawLinearElementBase & {
  type: 'line';
  polygon: boolean;
};

/**
 * Directional Arrow with optional elbow routing
 */
export type ExcalidrawArrowElement = _ExcalidrawLinearElementBase & {
  type: 'arrow';
  elbowed: boolean;
};

export type ExcalidrawLinearElement = ExcalidrawLineElement | ExcalidrawArrowElement;

/**
 * Freehand pencil stroke
 */
export type ExcalidrawFreeDrawElement = _ExcalidrawElementBase &
  Readonly<{
    type: 'freedraw';
    /** Array of sampled points relative to (x, y) */
    points: readonly Point[];
    /** Normalized pressure readings (0 to 1) */
    pressures: readonly number[];
    /** Whether pressure was simulated (mouse/touch fallback) */
    simulatePressure: boolean;
    /** Optional stroke smoothing options */
    strokeOptions?: {
      size?: number;
      thinning?: number;
      smoothing?: number;
      streamline?: number;
    };
  }>;

/**
 * Text Element
 */
export type ExcalidrawTextElement = _ExcalidrawElementBase &
  Readonly<{
    type: 'text';
    /** Formatted display text */
    text: string;
    /** Original raw text before auto-wrap */
    originalText: string;
    /** Font size in scene pixels */
    fontSize: number;
    /** Font family identifier */
    fontFamily: FontFamily;
    /** Horizontal text alignment */
    textAlign: TextAlign;
    /** Vertical text alignment */
    verticalAlign: VerticalAlign;
    /** ID of enclosing container if bound inside a shape */
    containerId: string | null;
    /** Unitless line height multiplier (e.g. 1.25) */
    lineHeight: number;
    /** True if box width expands with typing */
    autoResize: boolean;
  }>;

/**
 * Interactive Selection Marquee Box
 */
export type ExcalidrawSelectionElement = _ExcalidrawElementBase & {
  type: 'selection';
};

/**
 * Discriminated union of all scene elements
 */
export type ExcalidrawElement =
  | ExcalidrawRectangleElement
  | ExcalidrawDiamondElement
  | ExcalidrawEllipseElement
  | ExcalidrawLineElement
  | ExcalidrawArrowElement
  | ExcalidrawFreeDrawElement
  | ExcalidrawTextElement
  | ExcalidrawSelectionElement;

/**
 * Helper utility filtering out tombstone deleted elements
 */
export type NonDeleted<TElement extends ExcalidrawElement> = TElement & {
  isDeleted: false;
};

export type NonDeletedExcalidrawElement = NonDeleted<ExcalidrawElement>;

/**
 * Element ID index map
 */
export type ElementsMap = Map<string, ExcalidrawElement>;
export type NonDeletedElementsMap = Map<string, NonDeletedExcalidrawElement>;
