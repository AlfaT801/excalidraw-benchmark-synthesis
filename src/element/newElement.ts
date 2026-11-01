import { nanoid } from 'nanoid';
import {
  ExcalidrawElement,
  ExcalidrawRectangleElement,
  ExcalidrawDiamondElement,
  ExcalidrawEllipseElement,
  ExcalidrawLineElement,
  ExcalidrawArrowElement,
  ExcalidrawFreeDrawElement,
  ExcalidrawTextElement,
  ExcalidrawSelectionElement,
  _ExcalidrawElementBase,
} from '../types/element';
import { AppState } from '../types/state';
import { Point, FONT_FAMILY } from '../types/base';

/**
 * Generates a pseudo-random 32-bit positive integer
 */
export function randomInteger(): number {
  return Math.floor(Math.random() * 2147483647);
}

/**
 * Generates base properties for any new element
 */
function createBaseProps(
  type: _ExcalidrawElementBase['type'],
  x: number,
  y: number,
  appState: Partial<AppState>,
): _ExcalidrawElementBase {
  const now = Date.now();
  return {
    id: nanoid(),
    type,
    x,
    y,
    width: 0,
    height: 0,
    angle: 0,
    strokeColor: appState.currentItemStrokeColor ?? '#1e1e1e',
    backgroundColor: appState.currentItemBackgroundColor ?? 'transparent',
    fillStyle: appState.currentItemFillStyle ?? 'solid',
    strokeWidth: appState.currentItemStrokeWidth ?? 2,
    strokeStyle: appState.currentItemStrokeStyle ?? 'solid',
    roughness: appState.currentItemRoughness ?? 1,
    opacity: appState.currentItemOpacity ?? 100,
    seed: randomInteger(),
    version: 1,
    versionNonce: randomInteger(),
    isDeleted: false,
    groupIds: [],
    frameId: null,
    roundness:
      appState.currentItemRoundness === 'round'
        ? { type: 3 }
        : null,
    boundElements: null,
    updated: now,
    created: now,
    link: null,
    locked: false,
  };
}

/**
 * Constructs a new rectangular shape
 */
export function newRectangleElement(
  opts: { x: number; y: number; width?: number; height?: number },
  appState: Partial<AppState> = {},
): ExcalidrawRectangleElement {
  return {
    ...createBaseProps('rectangle', opts.x, opts.y, appState),
    type: 'rectangle',
    width: opts.width ?? 0,
    height: opts.height ?? 0,
  };
}

/**
 * Constructs a new diamond shape
 */
export function newDiamondElement(
  opts: { x: number; y: number; width?: number; height?: number },
  appState: Partial<AppState> = {},
): ExcalidrawDiamondElement {
  return {
    ...createBaseProps('diamond', opts.x, opts.y, appState),
    type: 'diamond',
    width: opts.width ?? 0,
    height: opts.height ?? 0,
  };
}

/**
 * Constructs a new ellipse shape
 */
export function newEllipseElement(
  opts: { x: number; y: number; width?: number; height?: number },
  appState: Partial<AppState> = {},
): ExcalidrawEllipseElement {
  return {
    ...createBaseProps('ellipse', opts.x, opts.y, appState),
    type: 'ellipse',
    width: opts.width ?? 0,
    height: opts.height ?? 0,
  };
}

/**
 * Constructs a new multi-point line
 */
export function newLineElement(
  opts: { x: number; y: number; points?: Point[]; width?: number; height?: number },
  appState: Partial<AppState> = {},
): ExcalidrawLineElement {
  const points = opts.points ?? [[0, 0], [opts.width ?? 0, opts.height ?? 0]];
  return {
    ...createBaseProps('line', opts.x, opts.y, appState),
    type: 'line',
    points,
    width: opts.width ?? 0,
    height: opts.height ?? 0,
    startBinding: null,
    endBinding: null,
    startArrowhead: null,
    endArrowhead: null,
    polygon: false,
  };
}

/**
 * Constructs a new directional arrow
 */
export function newArrowElement(
  opts: { x: number; y: number; points?: Point[]; width?: number; height?: number },
  appState: Partial<AppState> = {},
): ExcalidrawArrowElement {
  const points = opts.points ?? [[0, 0], [opts.width ?? 0, opts.height ?? 0]];
  return {
    ...createBaseProps('arrow', opts.x, opts.y, appState),
    type: 'arrow',
    points,
    width: opts.width ?? 0,
    height: opts.height ?? 0,
    startBinding: null,
    endBinding: null,
    startArrowhead: appState.currentItemStartArrowhead ?? null,
    endArrowhead: appState.currentItemEndArrowhead ?? 'arrow',
    elbowed: false,
  };
}

/**
 * Constructs a new freehand pencil stroke
 */
export function newFreeDrawElement(
  opts: { x: number; y: number; points?: Point[]; pressures?: number[] },
  appState: Partial<AppState> = {},
): ExcalidrawFreeDrawElement {
  return {
    ...createBaseProps('freedraw', opts.x, opts.y, appState),
    type: 'freedraw',
    points: opts.points ?? [[0, 0]],
    pressures: opts.pressures ?? [0.5],
    simulatePressure: true,
    strokeOptions: {
      size: (appState.currentItemStrokeWidth ?? 2) * 2,
      thinning: 0.6,
      smoothing: 0.5,
      streamline: 0.5,
    },
  };
}

/**
 * Constructs a new text element
 */
export function newTextElement(
  opts: {
    x: number;
    y: number;
    text: string;
    width?: number;
    height?: number;
    fontSize?: number;
    fontFamily?: 1 | 2 | 3;
    textAlign?: 'left' | 'center' | 'right';
  },
  appState: Partial<AppState> = {},
): ExcalidrawTextElement {
  const fontSize = opts.fontSize ?? appState.currentItemFontSize ?? 20;
  const text = opts.text;
  const width = opts.width ?? Math.max(20, text.length * fontSize * 0.6);
  const height = opts.height ?? fontSize * 1.25;
  return {
    ...createBaseProps('text', opts.x, opts.y, appState),
    type: 'text',
    text,
    originalText: text,
    width,
    height,
    fontSize,
    fontFamily: opts.fontFamily ?? appState.currentItemFontFamily ?? FONT_FAMILY.HAND_DRAWN,
    textAlign: opts.textAlign ?? appState.currentItemTextAlign ?? 'left',
    verticalAlign: 'top',
    containerId: null,
    lineHeight: 1.25,
    autoResize: true,
  };
}

/**
 * Constructs a new selection marquee box
 */
export function newSelectionElement(
  opts: { x: number; y: number; width?: number; height?: number },
): ExcalidrawSelectionElement {
  return {
    ...createBaseProps('selection', opts.x, opts.y, {}),
    type: 'selection',
    width: opts.width ?? 0,
    height: opts.height ?? 0,
    strokeColor: '#6965db',
    backgroundColor: 'rgba(105, 101, 219, 0.1)',
    fillStyle: 'solid',
    strokeWidth: 1,
    strokeStyle: 'solid',
    roughness: 0,
    opacity: 100,
  };
}

/**
 * Generic factory dispatcher
 */
export function newElement(
  type: ExcalidrawElement['type'],
  opts: { x: number; y: number; width?: number; height?: number; text?: string },
  appState: Partial<AppState> = {},
): ExcalidrawElement {
  switch (type) {
    case 'rectangle':
      return newRectangleElement(opts, appState);
    case 'diamond':
      return newDiamondElement(opts, appState);
    case 'ellipse':
      return newEllipseElement(opts, appState);
    case 'line':
      return newLineElement(opts, appState);
    case 'arrow':
      return newArrowElement(opts, appState);
    case 'freedraw':
      return newFreeDrawElement(opts, appState);
    case 'text':
      return newTextElement({ ...opts, text: opts.text ?? '' }, appState);
    case 'selection':
      return newSelectionElement(opts);
    default: {
      const _exhaustiveCheck: never = type;
      throw new Error(`Unsupported element type: ${_exhaustiveCheck}`);
    }
  }
}
