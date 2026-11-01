import {
  FillStyle,
  StrokeStyle,
  Roughness,
  FontFamily,
  TextAlign,
  Arrowhead,
} from './base';
import { ExcalidrawElement, NonDeletedExcalidrawElement } from './element';

/**
 * Normalized zoom level wrapper
 */
export type Zoom = Readonly<{
  /** Scale factor (1.0 = 100%, 0.5 = 50%, 2.0 = 200%). Clamped between 0.1 and 30.0 */
  value: number;
}>;

/**
 * Supported UI tools
 */
export type ToolType =
  | 'selection'
  | 'rectangle'
  | 'diamond'
  | 'ellipse'
  | 'arrow'
  | 'line'
  | 'freedraw'
  | 'text'
  | 'eraser'
  | 'hand';

export type ActiveTool = Readonly<{
  type: ToolType;
  /** Whether the tool stays active after creating one element */
  locked: boolean;
  /** Previous tool to restore after temporary hand/spacebar pan */
  lastActiveTool: ToolType | null;
}>;

/**
 * Comprehensive Application & Viewport State
 */
export interface AppState {
  /* ================= Viewport & Camera ================= */
  /** Horizontal canvas offset in scene pixels */
  scrollX: number;
  /** Vertical canvas offset in scene pixels */
  scrollY: number;
  /** Current zoom level */
  zoom: Zoom;
  /** Canvas DOM element width */
  width: number;
  /** Canvas DOM element height */
  height: number;
  /** Canvas DOM element client bounding offset left */
  offsetLeft: number;
  /** Canvas DOM element client bounding offset top */
  offsetTop: number;

  /* ================= Active Tool ================= */
  activeTool: ActiveTool;

  /* ================= Selection & Interaction Transients ================= */
  /** Map of currently selected element IDs */
  selectedElementIds: Readonly<Record<string, boolean>>;
  /** ID of element currently hovered under pointer */
  hoveredElementId: string | null;
  /** Group IDs currently selected */
  selectedGroupIds: Readonly<Record<string, boolean>>;
  /** Element currently being edited in-place (e.g. text) */
  editingElement: ExcalidrawElement | null;
  /** Element currently being resized */
  resizingElement: NonDeletedExcalidrawElement | null;
  /** Element currently being dragged */
  draggingElement: NonDeletedExcalidrawElement | null;
  /** Active selection marquee box */
  selectionElement: NonDeletedExcalidrawElement | null;
  /** Cursor scene coordinates */
  cursorX: number;
  cursorY: number;
  /** Flags indicating current pointer operation */
  isResizing: boolean;
  isRotating: boolean;
  isDragging: boolean;

  /* ================= Style Defaults (Applied to new shapes) ================= */
  currentItemStrokeColor: string;
  currentItemBackgroundColor: string;
  currentItemFillStyle: FillStyle;
  currentItemStrokeWidth: number;
  currentItemStrokeStyle: StrokeStyle;
  currentItemRoughness: Roughness;
  currentItemOpacity: number;
  currentItemFontFamily: FontFamily;
  currentItemFontSize: number;
  currentItemTextAlign: TextAlign;
  currentItemStartArrowhead: Arrowhead | null;
  currentItemEndArrowhead: Arrowhead | null;
  currentItemRoundness: 'round' | 'sharp';

  /* ================= Canvas & Theme Settings ================= */
  viewBackgroundColor: string;
  gridSize: number;
  gridStep: number;
  gridModeEnabled: boolean;
  theme: 'light' | 'dark';
  zenModeEnabled: boolean;
  viewModeEnabled: boolean;
}

/**
 * Sliced state subset stored in LocalStorage
 */
export type LocalStorageAppState = Pick<
  AppState,
  | 'scrollX'
  | 'scrollY'
  | 'zoom'
  | 'viewBackgroundColor'
  | 'gridSize'
  | 'gridStep'
  | 'gridModeEnabled'
  | 'theme'
  | 'currentItemStrokeColor'
  | 'currentItemBackgroundColor'
  | 'currentItemFillStyle'
  | 'currentItemStrokeWidth'
  | 'currentItemStrokeStyle'
  | 'currentItemRoughness'
  | 'currentItemOpacity'
  | 'currentItemFontFamily'
  | 'currentItemFontSize'
  | 'currentItemTextAlign'
>;

/**
 * Sliced state subset exported in .excalidraw JSON files
 */
export type ExportedAppState = Pick<
  AppState,
  'viewBackgroundColor' | 'gridSize' | 'gridStep' | 'gridModeEnabled'
>;
