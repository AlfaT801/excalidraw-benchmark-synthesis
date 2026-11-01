/**
 * Opaque-Box E2E Test Harness for Excalidraw Clone
 * 
 * Provides an authoritative, isolated, and headless test driver that adheres strictly
 * to the specifications in PROJECT.md and survey_datamodel_spec.md.
 * Enables end-to-end user interaction simulation (pointer, keyboard, toolbar, camera,
 * history, storage, and export) with observable state queries and contract verification.
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

export type FillStyle = 'hachure' | 'cross-hatch' | 'solid' | 'zigzag';
export type StrokeStyle = 'solid' | 'dashed' | 'dotted';
export type Arrowhead = 'arrow' | 'bar' | 'circle' | 'triangle' | 'diamond';
export type FontFamily = 1 | 2 | 3; // 1: Virgil, 2: Helvetica, 3: Cascadia
export type TextAlign = 'left' | 'center' | 'right';
export type VerticalAlign = 'top' | 'middle' | 'bottom';

export type LocalPoint = readonly [number, number];

export interface BoundElement {
  id: string;
  type: 'arrow' | 'text';
}

export interface ExcalidrawElement {
  id: string;
  type: ToolType;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number; // in radians
  strokeColor: string;
  backgroundColor: string;
  fillStyle: FillStyle;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  roughness: number;
  opacity: number;
  seed: number;
  version: number;
  versionNonce: number;
  isDeleted: boolean;
  groupIds: readonly string[];
  frameId: string | null;
  boundElements: readonly BoundElement[] | null;
  updated: number;
  created: number;
  link: string | null;
  locked: boolean;
  // Linear / FreeDraw / Text specifics
  points?: readonly LocalPoint[];
  pressures?: readonly number[];
  simulatePressure?: boolean;
  startArrowhead?: Arrowhead | null;
  endArrowhead?: Arrowhead | null;
  text?: string;
  originalText?: string;
  fontSize?: number;
  fontFamily?: FontFamily;
  textAlign?: TextAlign;
  verticalAlign?: VerticalAlign;
  containerId?: string | null;
  autoResize?: boolean;
  lineHeight?: number;
}

export interface Zoom {
  value: number;
}

export interface AppState {
  zoom: Zoom;
  scrollX: number;
  scrollY: number;
  width: number;
  height: number;
  offsetLeft: number;
  offsetTop: number;
  devicePixelRatio: number;
  activeTool: {
    type: ToolType;
    locked: boolean;
  };
  selectedElementIds: Record<string, boolean>;
  selectedGroupIds: Record<string, boolean>;
  draggingElement: ExcalidrawElement | null;
  resizingElement: ExcalidrawElement | null;
  editingTextElement: ExcalidrawElement | null;
  // Default styling options for new elements
  currentItemStrokeColor: string;
  currentItemBackgroundColor: string;
  currentItemFillStyle: FillStyle;
  currentItemStrokeWidth: number;
  currentItemStrokeStyle: StrokeStyle;
  currentItemRoughness: number;
  currentItemOpacity: number;
  currentItemFontFamily: FontFamily;
  currentItemFontSize: number;
  currentItemTextAlign: TextAlign;
  currentItemStartArrowhead: Arrowhead | null;
  currentItemEndArrowhead: Arrowhead | null;
  viewBackgroundColor: string;
}

export interface PointerOptions {
  button?: number; // 0: left, 1: middle, 2: right
  shiftKey?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  pressure?: number;
}

export interface KeyModifiers {
  shiftKey?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
}

export interface TransformHandle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TransformHandles {
  nw?: TransformHandle;
  n?: TransformHandle;
  ne?: TransformHandle;
  e?: TransformHandle;
  se?: TransformHandle;
  s?: TransformHandle;
  sw?: TransformHandle;
  w?: TransformHandle;
  rotation?: TransformHandle;
}

export interface CanvasSnapshot {
  width: number;
  height: number;
  renderedElementCount: number;
  staticLayersDrawn: number;
  interactiveLayersDrawn: number;
  commands: string[];
}

export interface HistoryEntry {
  elements: readonly ExcalidrawElement[];
  selectedElementIds: Record<string, boolean>;
}

// Global random counter for seed and ID generation
let idCounter = 1000;
export function generateTestId(prefix = 'elem_'): string {
  return `${prefix}${++idCounter}_${Math.random().toString(36).substring(2, 7)}`;
}

export function randomInteger(): number {
  return Math.floor(Math.random() * 2147483647);
}

// Mathematical pure utilities
export function rotatePoint(
  point: readonly [number, number],
  center: readonly [number, number],
  angle: number
): [number, number] {
  const [x, y] = point;
  const [cx, cy] = center;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [
    (x - cx) * cos - (y - cy) * sin + cx,
    (x - cx) * sin + (y - cy) * cos + cy,
  ];
}

export function pointDistance(p1: readonly [number, number], p2: readonly [number, number]): number {
  return Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
}

export function distanceToSegment(
  p: readonly [number, number],
  a: readonly [number, number],
  b: readonly [number, number]
): number {
  const [px, py] = p;
  const [ax, ay] = a;
  const [bx, by] = b;
  const l2 = (bx - ax) ** 2 + (by - ay) ** 2;
  if (l2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * (bx - ax)), py - (ay + t * (by - ay)));
}

/**
 * The ExcalidrawTestHarness encapsulates the entire application lifecycle,
 * state engine, math transformations, canvas rendering, and user input pipelines.
 */
export class ExcalidrawTestHarness {
  private elements: ExcalidrawElement[] = [];
  private appState: AppState;
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private localStorageStore: Record<string, string> = {};
  private activePointer: { x: number; y: number; isDown: boolean; startX: number; startY: number } | null = null;
  private draftElement: ExcalidrawElement | null = null;
  private renderLogs: CanvasSnapshot[] = [];
  private textEditorOverlay: {
    isOpen: boolean;
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    elementId: string | null;
  } = {
    isOpen: false,
    text: '',
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    elementId: null,
  };

  private constructor() {
    this.appState = this.createDefaultAppState();
    this.commitToHistory();
  }

  public static create(): ExcalidrawTestHarness {
    return new ExcalidrawTestHarness();
  }

  private createDefaultAppState(): AppState {
    return {
      zoom: { value: 1.0 },
      scrollX: 0,
      scrollY: 0,
      width: 1024,
      height: 768,
      offsetLeft: 0,
      offsetTop: 0,
      devicePixelRatio: 1.0,
      activeTool: {
        type: 'selection',
        locked: false,
      },
      selectedElementIds: {},
      selectedGroupIds: {},
      draggingElement: null,
      resizingElement: null,
      editingTextElement: null,
      currentItemStrokeColor: '#1e1e1e',
      currentItemBackgroundColor: 'transparent',
      currentItemFillStyle: 'solid',
      currentItemStrokeWidth: 2,
      currentItemStrokeStyle: 'solid',
      currentItemRoughness: 1,
      currentItemOpacity: 100,
      currentItemFontFamily: 1,
      currentItemFontSize: 20,
      currentItemTextAlign: 'left',
      currentItemStartArrowhead: null,
      currentItemEndArrowhead: 'arrow',
      viewBackgroundColor: '#ffffff',
    };
  }

  // --- Coordinate Transformations (Section 4.1) ---

  public viewportCoordsToSceneCoords(viewportX: number, viewportY: number): { sceneX: number; sceneY: number } {
    const zoom = this.appState.zoom.value;
    const sceneX = (viewportX - this.appState.offsetLeft) / zoom - this.appState.scrollX;
    const sceneY = (viewportY - this.appState.offsetTop) / zoom - this.appState.scrollY;
    return { sceneX, sceneY };
  }

  public sceneCoordsToViewportCoords(sceneX: number, sceneY: number): { viewportX: number; viewportY: number } {
    const zoom = this.appState.zoom.value;
    const viewportX = (sceneX + this.appState.scrollX) * zoom + this.appState.offsetLeft;
    const viewportY = (sceneY + this.appState.scrollY) * zoom + this.appState.offsetTop;
    return { viewportX, viewportY };
  }

  public calculateFocalZoom(
    cursorViewport: { x: number; y: number },
    newZoomValue: number
  ): { zoom: Zoom; scrollX: number; scrollY: number } {
    // Clamped zoom range [0.1, 30.0]
    const clampedZoom = Math.max(0.1, Math.min(30.0, Number.isFinite(newZoomValue) ? newZoomValue : 1.0));
    const oldZoom = this.appState.zoom.value;

    const sceneX = (cursorViewport.x - this.appState.offsetLeft) / oldZoom - this.appState.scrollX;
    const sceneY = (cursorViewport.y - this.appState.offsetTop) / oldZoom - this.appState.scrollY;

    const newScrollX = (cursorViewport.x - this.appState.offsetLeft) / clampedZoom - sceneX;
    const newScrollY = (cursorViewport.y - this.appState.offsetTop) / clampedZoom - sceneY;

    return {
      zoom: { value: clampedZoom },
      scrollX: newScrollX,
      scrollY: newScrollY,
    };
  }

  // --- Bounding Box & Hit Testing (Section 4.2 & 4.3) ---

  public getElementBounds(element: ExcalidrawElement): [number, number, number, number] {
    if (element.type === 'line' || element.type === 'arrow' || element.type === 'freedraw') {
      const points = element.points || [];
      if (points.length === 0) {
        return [element.x, element.y, element.x, element.y];
      }
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const [px, py] of points) {
        minX = Math.min(minX, px);
        minY = Math.min(minY, py);
        maxX = Math.max(maxX, px);
        maxY = Math.max(maxY, py);
      }
      return [element.x + minX, element.y + minY, element.x + maxX, element.y + maxY];
    }

    if (element.angle === 0) {
      const minX = Math.min(element.x, element.x + element.width);
      const maxX = Math.max(element.x, element.x + element.width);
      const minY = Math.min(element.y, element.y + element.height);
      const maxY = Math.max(element.y, element.y + element.height);
      return [minX, minY, maxX, maxY];
    }

    // Rotated AABB
    const cx = element.x + element.width / 2;
    const cy = element.y + element.height / 2;
    const corners: [number, number][] = [
      [element.x, element.y],
      [element.x + element.width, element.y],
      [element.x + element.width, element.y + element.height],
      [element.x, element.y + element.height],
    ];

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const pt of corners) {
      const [rx, ry] = rotatePoint(pt, [cx, cy], element.angle);
      minX = Math.min(minX, rx);
      minY = Math.min(minY, ry);
      maxX = Math.max(maxX, rx);
      maxY = Math.max(maxY, ry);
    }

    return [minX, minY, maxX, maxY];
  }

  public hitTest(element: ExcalidrawElement, sceneX: number, sceneY: number): boolean {
    if (element.isDeleted) return false;
    const zoom = this.appState.zoom.value;
    const threshold = 10 / zoom;

    // FreeDraw & Linear elements
    if (element.type === 'freedraw' || element.type === 'line' || element.type === 'arrow') {
      const points = element.points || [];
      if (points.length === 0) return false;
      const localX = sceneX - element.x;
      const localY = sceneY - element.y;

      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        if (distanceToSegment([localX, localY], p1, p2) <= threshold) {
          return true;
        }
      }
      return false;
    }

    // Step 1: Broadphase inverse rotation
    const cx = element.x + element.width / 2;
    const cy = element.y + element.height / 2;
    const [localX, localY] = rotatePoint([sceneX, sceneY], [cx, cy], -element.angle);

    const minX = Math.min(element.x, element.x + element.width);
    const maxX = Math.max(element.x, element.x + element.width);
    const minY = Math.min(element.y, element.y + element.height);
    const maxY = Math.max(element.y, element.y + element.height);

    if (
      localX < minX - threshold ||
      localX > maxX + threshold ||
      localY < minY - threshold ||
      localY > maxY + threshold
    ) {
      return false;
    }

    // Step 2: Narrowphase
    const hasFill = element.backgroundColor !== 'transparent' && element.backgroundColor !== '';
    const isInsideBox = localX >= minX && localX <= maxX && localY >= minY && localY <= maxY;

    if (element.type === 'rectangle' || element.type === 'text') {
      if (hasFill || element.type === 'text') {
        return isInsideBox;
      }
      // Outline check
      const onEdge =
        Math.abs(localX - minX) <= threshold ||
        Math.abs(localX - maxX) <= threshold ||
        Math.abs(localY - minY) <= threshold ||
        Math.abs(localY - maxY) <= threshold;
      return onEdge && localX >= minX - threshold && localX <= maxX + threshold && localY >= minY - threshold && localY <= maxY + threshold;
    }

    if (element.type === 'ellipse') {
      const rx = Math.abs(element.width) / 2;
      const ry = Math.abs(element.height) / 2;
      if (rx === 0 || ry === 0) return false;
      const norm = ((localX - cx) / rx) ** 2 + ((localY - cy) / ry) ** 2;
      if (hasFill) {
        return norm <= 1.05;
      }
      return Math.abs(norm - 1.0) <= (threshold / Math.min(rx, ry)) * 2;
    }

    if (element.type === 'diamond') {
      // Diamond edges connect (cx, minY), (maxX, cy), (cx, maxY), (minX, cy)
      const top: [number, number] = [cx, minY];
      const right: [number, number] = [maxX, cy];
      const bottom: [number, number] = [cx, maxY];
      const left: [number, number] = [minX, cy];

      if (hasFill) {
        // Inside check using Manhattan-like diamond equation
        const dx = Math.abs(localX - cx) / (Math.abs(element.width) / 2 || 1);
        const dy = Math.abs(localY - cy) / (Math.abs(element.height) / 2 || 1);
        return dx + dy <= 1.05;
      }

      return (
        distanceToSegment([localX, localY], top, right) <= threshold ||
        distanceToSegment([localX, localY], right, bottom) <= threshold ||
        distanceToSegment([localX, localY], bottom, left) <= threshold ||
        distanceToSegment([localX, localY], left, top) <= threshold
      );
    }

    return isInsideBox;
  }

  public getElementAtPosition(sceneX: number, sceneY: number): ExcalidrawElement | null {
    // Reverse order for top-to-bottom z-index hit testing
    for (let i = this.elements.length - 1; i >= 0; i--) {
      const el = this.elements[i];
      if (!el.isDeleted && this.hitTest(el, sceneX, sceneY)) {
        return el;
      }
    }
    return null;
  }

  public getTransformHandles(element: ExcalidrawElement): TransformHandles | null {
    if (element.type === 'freedraw' || element.type === 'line' || element.type === 'arrow') {
      return null;
    }

    const zoom = this.appState.zoom.value;
    const margin = 4 / zoom;
    const handleSize = 8 / zoom;

    const x1 = Math.min(element.x, element.x + element.width);
    const x2 = Math.max(element.x, element.x + element.width);
    const y1 = Math.min(element.y, element.y + element.height);
    const y2 = Math.max(element.y, element.y + element.height);
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;

    const handles: TransformHandles = {
      nw: { x: x1 - margin - handleSize, y: y1 - margin - handleSize, width: handleSize, height: handleSize },
      ne: { x: x2 + margin, y: y1 - margin - handleSize, width: handleSize, height: handleSize },
      se: { x: x2 + margin, y: y2 + margin, width: handleSize, height: handleSize },
      sw: { x: x1 - margin - handleSize, y: y2 + margin, width: handleSize, height: handleSize },
      rotation: { x: cx - handleSize / 2, y: y1 - margin - 16 / zoom - handleSize, width: handleSize, height: handleSize },
    };

    // Cardinal handles omitted if width or height < 40 / zoom (Section 4.6)
    if (Math.abs(element.width) >= 40 / zoom && Math.abs(element.height) >= 40 / zoom) {
      handles.n = { x: cx - handleSize / 2, y: y1 - margin - handleSize, width: handleSize, height: handleSize };
      handles.s = { x: cx - handleSize / 2, y: y2 + margin, width: handleSize, height: handleSize };
      handles.w = { x: x1 - margin - handleSize, y: cy - handleSize / 2, width: handleSize, height: handleSize };
      handles.e = { x: x2 + margin, y: cy - handleSize / 2, width: handleSize, height: handleSize };
    }

    return handles;
  }

  // --- Pointer & User Interaction Simulation ---

  public pointerDown(viewportX: number, viewportY: number, options: PointerOptions = {}): void {
    const { sceneX, sceneY } = this.viewportCoordsToSceneCoords(viewportX, viewportY);
    this.activePointer = {
      x: sceneX,
      y: sceneY,
      startX: sceneX,
      startY: sceneY,
      isDown: true,
    };

    const tool = this.appState.activeTool.type;

    if (tool === 'selection') {
      const hit = this.getElementAtPosition(sceneX, sceneY);
      if (hit) {
        if (!this.appState.selectedElementIds[hit.id] || options.shiftKey) {
          const idsToSelect: Record<string, boolean> = { [hit.id]: true };
          if (hit.groupIds && hit.groupIds.length > 0) {
            for (const el of this.elements) {
              if (!el.isDeleted && el.groupIds.some(g => hit.groupIds.includes(g))) {
                idsToSelect[el.id] = true;
              }
            }
          }
          if (!options.shiftKey) {
            this.appState.selectedElementIds = idsToSelect;
          } else {
            for (const id of Object.keys(idsToSelect)) {
              this.appState.selectedElementIds[id] = !this.appState.selectedElementIds[id];
            }
          }
        }
        this.appState.draggingElement = hit;
      } else {
        if (!options.shiftKey) {
          this.appState.selectedElementIds = {};
        }
      }
      return;
    }

    if (tool === 'eraser') {
      const hit = this.getElementAtPosition(sceneX, sceneY);
      if (hit && !hit.locked) {
        hit.isDeleted = true;
        hit.version += 1;
        hit.updated = Date.now();
        this.commitToHistory();
        this.recordCanvasRender();
      }
      return;
    }

    if (tool === 'text') {
      this.openTextEditor(sceneX, sceneY);
      return;
    }

    // Drawing shapes: rectangle, diamond, ellipse, line, arrow, freedraw
    const newEl: ExcalidrawElement = {
      id: generateTestId(),
      type: tool,
      x: sceneX,
      y: sceneY,
      width: 0,
      height: 0,
      angle: 0,
      strokeColor: this.appState.currentItemStrokeColor,
      backgroundColor: this.appState.currentItemBackgroundColor,
      fillStyle: this.appState.currentItemFillStyle,
      strokeWidth: this.appState.currentItemStrokeWidth,
      strokeStyle: this.appState.currentItemStrokeStyle,
      roughness: this.appState.currentItemRoughness,
      opacity: this.appState.currentItemOpacity,
      seed: randomInteger(),
      version: 1,
      versionNonce: randomInteger(),
      isDeleted: false,
      groupIds: [],
      frameId: null,
      boundElements: null,
      updated: Date.now(),
      created: Date.now(),
      link: null,
      locked: false,
    };

    if (tool === 'freedraw') {
      newEl.points = [[0, 0]];
      newEl.pressures = [options.pressure ?? 0.5];
      newEl.simulatePressure = options.pressure === undefined;
    } else if (tool === 'line' || tool === 'arrow') {
      newEl.points = [[0, 0], [0, 0]];
      if (tool === 'arrow') {
        newEl.startArrowhead = this.appState.currentItemStartArrowhead;
        newEl.endArrowhead = this.appState.currentItemEndArrowhead;
      }
    }

    this.draftElement = newEl;
  }

  public pointerMove(viewportX: number, viewportY: number, options: PointerOptions = {}): void {
    if (!this.activePointer || !this.activePointer.isDown) return;
    const { sceneX, sceneY } = this.viewportCoordsToSceneCoords(viewportX, viewportY);
    const lastX = this.activePointer.x;
    const lastY = this.activePointer.y;
    this.activePointer.x = sceneX;
    this.activePointer.y = sceneY;

    const dx = sceneX - this.activePointer.startX;
    const dy = sceneY - this.activePointer.startY;
    const stepDx = sceneX - lastX;
    const stepDy = sceneY - lastY;

    // Dragging selected elements
    if (this.appState.activeTool.type === 'selection' && this.appState.draggingElement) {
      const selectedIds = Object.keys(this.appState.selectedElementIds);
      for (const id of selectedIds) {
        const el = this.elements.find(e => e.id === id);
        if (el && !el.locked) {
          el.x += stepDx;
          el.y += stepDy;
          el.version += 1;
        }
      }
      return;
    }

    // Eraser dragging
    if (this.appState.activeTool.type === 'eraser') {
      const hit = this.getElementAtPosition(sceneX, sceneY);
      if (hit && !hit.isDeleted && !hit.locked) {
        hit.isDeleted = true;
        hit.version += 1;
        hit.updated = Date.now();
      }
      return;
    }

    // Updating draft element
    if (this.draftElement) {
      if (this.draftElement.type === 'freedraw') {
        const originX = this.draftElement.x;
        const originY = this.draftElement.y;
        const localPt: LocalPoint = [sceneX - originX, sceneY - originY];
        this.draftElement.points = [...(this.draftElement.points || []), localPt];
        this.draftElement.pressures = [...(this.draftElement.pressures || []), options.pressure ?? 0.5];
      } else if (this.draftElement.type === 'line' || this.draftElement.type === 'arrow') {
        this.draftElement.points = [[0, 0], [dx, dy]];
        this.draftElement.width = dx;
        this.draftElement.height = dy;
      } else {
        // Shapes
        if (options.shiftKey) {
          // Constrain 1:1 aspect ratio
          const side = Math.max(Math.abs(dx), Math.abs(dy));
          this.draftElement.width = dx < 0 ? -side : side;
          this.draftElement.height = dy < 0 ? -side : side;
        } else {
          this.draftElement.width = dx;
          this.draftElement.height = dy;
        }
      }
    }
  }

  public pointerUp(_viewportX?: number, _viewportY?: number): void {
    if (!this.activePointer || !this.activePointer.isDown) return;
    this.activePointer.isDown = false;

    if (this.draftElement) {
      // Normalize width and height if negative
      if (
        this.draftElement.type === 'rectangle' ||
        this.draftElement.type === 'diamond' ||
        this.draftElement.type === 'ellipse'
      ) {
        if (this.draftElement.width < 0) {
          this.draftElement.x += this.draftElement.width;
          this.draftElement.width = Math.abs(this.draftElement.width);
        }
        if (this.draftElement.height < 0) {
          this.draftElement.y += this.draftElement.height;
          this.draftElement.height = Math.abs(this.draftElement.height);
        }
      }

      this.elements.push(this.draftElement);
      this.appState.selectedElementIds = { [this.draftElement.id]: true };
      this.draftElement = null;

      if (!this.appState.activeTool.locked) {
        this.appState.activeTool.type = 'selection';
      }

      this.commitToHistory();
    } else if (this.appState.draggingElement) {
      this.appState.draggingElement = null;
      this.commitToHistory();
    }

    this.recordCanvasRender();
  }

  public click(viewportX: number, viewportY: number, options: PointerOptions = {}): void {
    this.pointerDown(viewportX, viewportY, options);
    this.pointerUp(viewportX, viewportY);
  }

  public doubleClick(viewportX: number, viewportY: number): void {
    const { sceneX, sceneY } = this.viewportCoordsToSceneCoords(viewportX, viewportY);
    const hit = this.getElementAtPosition(sceneX, sceneY);
    if (hit && hit.type === 'text') {
      this.openTextEditor(hit.x, hit.y, hit);
    } else {
      this.openTextEditor(sceneX, sceneY);
    }
  }

  public drag(
    from: { x: number; y: number },
    to: { x: number; y: number },
    steps = 5,
    options: PointerOptions = {}
  ): void {
    this.pointerDown(from.x, from.y, options);
    for (let i = 1; i <= steps; i++) {
      const curX = from.x + ((to.x - from.x) * i) / steps;
      const curY = from.y + ((to.y - from.y) * i) / steps;
      this.pointerMove(curX, curY, options);
    }
    this.pointerUp(to.x, to.y);
  }

  public wheel(deltaX: number, deltaY: number, focalPoint?: { x: number; y: number }, ctrlKey = false): void {
    if (ctrlKey) {
      // Zoom interaction
      const factor = deltaY < 0 ? 1.1 : 0.9;
      const targetCursor = focalPoint || { x: this.appState.width / 2, y: this.appState.height / 2 };
      const { zoom, scrollX, scrollY } = this.calculateFocalZoom(targetCursor, this.appState.zoom.value * factor);
      this.appState.zoom = zoom;
      this.appState.scrollX = scrollX;
      this.appState.scrollY = scrollY;
    } else {
      // Pan interaction
      this.appState.scrollX -= deltaX / this.appState.zoom.value;
      this.appState.scrollY -= deltaY / this.appState.zoom.value;
    }
    this.recordCanvasRender();
  }

  // --- Text Editor In-Place ---

  public openTextEditor(sceneX: number, sceneY: number, existingElement?: ExcalidrawElement): void {
    this.textEditorOverlay = {
      isOpen: true,
      text: existingElement?.text || '',
      x: existingElement ? existingElement.x : sceneX,
      y: existingElement ? existingElement.y : sceneY,
      width: existingElement ? existingElement.width : 100,
      height: existingElement ? existingElement.height : 24,
      elementId: existingElement ? existingElement.id : null,
    };
  }

  public typeText(text: string): void {
    if (!this.textEditorOverlay.isOpen) return;
    this.textEditorOverlay.text += text;
  }

  public commitTextEditor(): void {
    if (!this.textEditorOverlay.isOpen) return;
    const content = this.textEditorOverlay.text.trim();

    if (this.textEditorOverlay.elementId) {
      const el = this.elements.find(e => e.id === this.textEditorOverlay.elementId);
      if (el) {
        if (content.length === 0) {
          el.isDeleted = true;
        } else {
          el.text = content;
          el.originalText = content;
          el.width = Math.max(20, content.length * (el.fontSize || 20) * 0.6);
          el.height = (el.fontSize || 20) * 1.25;
          el.version += 1;
        }
      }
    } else if (content.length > 0) {
      const fontSize = this.appState.currentItemFontSize;
      const textEl: ExcalidrawElement = {
        id: generateTestId('text_'),
        type: 'text',
        x: this.textEditorOverlay.x,
        y: this.textEditorOverlay.y,
        width: Math.max(20, content.length * fontSize * 0.6),
        height: fontSize * 1.25,
        angle: 0,
        strokeColor: this.appState.currentItemStrokeColor,
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeWidth: 1,
        strokeStyle: 'solid',
        roughness: 0,
        opacity: this.appState.currentItemOpacity,
        seed: randomInteger(),
        version: 1,
        versionNonce: randomInteger(),
        isDeleted: false,
        groupIds: [],
        frameId: null,
        boundElements: null,
        updated: Date.now(),
        created: Date.now(),
        link: null,
        locked: false,
        text: content,
        originalText: content,
        fontSize,
        fontFamily: this.appState.currentItemFontFamily,
        textAlign: this.appState.currentItemTextAlign,
        verticalAlign: 'top',
        containerId: null,
        autoResize: true,
        lineHeight: 1.25,
      };
      this.elements.push(textEl);
      this.appState.selectedElementIds = { [textEl.id]: true };
    }

    this.textEditorOverlay.isOpen = false;
    this.textEditorOverlay.text = '';
    this.textEditorOverlay.elementId = null;
    this.commitToHistory();
    this.recordCanvasRender();
  }

  public isTextEditorActive(): boolean {
    return this.textEditorOverlay.isOpen;
  }

  public getTextEditorContent(): string {
    return this.textEditorOverlay.text;
  }

  // --- Keyboard Shortcuts & Manipulations ---

  public pressShortcut(shortcut: string): void {
    const parts = shortcut.split('+').map(p => p.trim().toLowerCase());
    const hasCtrl = parts.includes('ctrl') || parts.includes('cmd');
    const hasShift = parts.includes('shift');
    const key = parts[parts.length - 1];

    if (hasCtrl && key === 'z' && !hasShift) {
      this.undo();
      return;
    }

    if ((hasCtrl && key === 'y') || (hasCtrl && hasShift && key === 'z')) {
      this.redo();
      return;
    }

    if (hasCtrl && key === 'a') {
      const ids: Record<string, boolean> = {};
      for (const el of this.elements) {
        if (!el.isDeleted) ids[el.id] = true;
      }
      this.appState.selectedElementIds = ids;
      return;
    }

    if (key === 'delete' || key === 'backspace') {
      this.deleteSelected();
      return;
    }

    if (key === 'escape') {
      if (this.textEditorOverlay.isOpen) {
        this.commitTextEditor();
      } else {
        this.appState.selectedElementIds = {};
        this.appState.activeTool.type = 'selection';
      }
      return;
    }
  }

  public deleteSelected(): void {
    let deletedCount = 0;
    for (const el of this.elements) {
      if (this.appState.selectedElementIds[el.id] && !el.locked) {
        el.isDeleted = true;
        el.version += 1;
        el.updated = Date.now();
        deletedCount++;
      }
    }
    if (deletedCount > 0) {
      this.appState.selectedElementIds = {};
      this.commitToHistory();
    }
  }

  public rotateSelected(deltaAngle: number, snap = false): void {
    let effectiveAngle = deltaAngle;
    if (snap) {
      const snapStep = Math.PI / 12; // 15 degrees
      effectiveAngle = Math.round(deltaAngle / snapStep) * snapStep;
    }
    for (const el of this.elements) {
      if (this.appState.selectedElementIds[el.id] && !el.locked) {
        el.angle = (el.angle + effectiveAngle) % (2 * Math.PI);
        if (el.angle < 0) el.angle += 2 * Math.PI;
        el.version += 1;
      }
    }
    this.commitToHistory();
  }

  public resizeSelected(newWidth: number, newHeight: number): void {
    for (const el of this.elements) {
      if (this.appState.selectedElementIds[el.id] && !el.locked) {
        el.width = newWidth;
        el.height = newHeight;
        el.version += 1;
      }
    }
    this.commitToHistory();
  }

  public groupSelected(): string | null {
    const selectedIds = Object.keys(this.appState.selectedElementIds);
    if (selectedIds.length <= 1) return null;
    const groupId = generateTestId('group_');
    for (const id of selectedIds) {
      const el = this.elements.find(e => e.id === id);
      if (el) {
        el.groupIds = [...el.groupIds, groupId];
        el.version += 1;
      }
    }
    this.commitToHistory();
    return groupId;
  }

  // --- History & State Synchronization (Section 5) ---

  private commitToHistory(): void {
    // Clone elements snapshot
    const snapshotElements: ExcalidrawElement[] = this.elements.map(el => ({
      ...el,
      points: el.points ? [...el.points] : undefined,
      groupIds: [...el.groupIds],
    }));

    this.undoStack.push({
      elements: snapshotElements,
      selectedElementIds: { ...this.appState.selectedElementIds },
    });
    // Any durable change clears the redo stack (Section 5.1)
    this.redoStack = [];
    this.saveToLocalStorage();
  }

  public undo(): boolean {
    if (this.undoStack.length <= 1) return false;
    const current = this.undoStack.pop()!;
    this.redoStack.push(current);

    const previous = this.undoStack[this.undoStack.length - 1];
    this.restoreSnapshot(previous);
    this.saveToLocalStorage();
    this.recordCanvasRender();
    return true;
  }

  public redo(): boolean {
    if (this.redoStack.length === 0) return false;
    const next = this.redoStack.pop()!;
    this.undoStack.push(next);

    this.restoreSnapshot(next);
    this.saveToLocalStorage();
    this.recordCanvasRender();
    return true;
  }

  private restoreSnapshot(entry: HistoryEntry): void {
    // Fresh version generation on undo/redo (Section 5.1 & 5.3)
    this.elements = entry.elements.map(el => ({
      ...el,
      version: el.version + 1,
      versionNonce: randomInteger(),
      points: el.points ? [...el.points] : undefined,
      groupIds: [...el.groupIds],
    }));
    this.appState.selectedElementIds = { ...entry.selectedElementIds };
  }

  public getHistoryDepth(): { undo: number; redo: number } {
    return {
      undo: Math.max(0, this.undoStack.length - 1),
      redo: this.redoStack.length,
    };
  }

  // --- LocalStorage Engine (Section 6.1) ---

  public saveToLocalStorage(): void {
    const nonDeleted = this.elements.filter(e => !e.isDeleted);
    this.localStorageStore['excalidraw'] = JSON.stringify(nonDeleted);

    // Stripping transients per Section 3.5 filter matrix
    const persistentState = {
      viewBackgroundColor: this.appState.viewBackgroundColor,
      scrollX: this.appState.scrollX,
      scrollY: this.appState.scrollY,
      zoom: this.appState.zoom,
      selectedElementIds: this.appState.selectedElementIds,
      currentItemStrokeColor: this.appState.currentItemStrokeColor,
      currentItemBackgroundColor: this.appState.currentItemBackgroundColor,
      currentItemFillStyle: this.appState.currentItemFillStyle,
      currentItemStrokeWidth: this.appState.currentItemStrokeWidth,
      currentItemRoughness: this.appState.currentItemRoughness,
    };
    this.localStorageStore['excalidraw-state'] = JSON.stringify(persistentState);
  }

  public loadFromLocalStorage(): boolean {
    const rawElements = this.localStorageStore['excalidraw'];
    const rawState = this.localStorageStore['excalidraw-state'];
    if (!rawElements) return false;

    try {
      this.elements = JSON.parse(rawElements);
      if (rawState) {
        const state = JSON.parse(rawState);
        Object.assign(this.appState, state);
      }
      return true;
    } catch {
      return false;
    }
  }

  public injectCorruptLocalStorage(key: string, corruptValue: string): void {
    this.localStorageStore[key] = corruptValue;
  }

  public getLocalStorageDump(): { elements: ExcalidrawElement[] | null; appState: any | null } {
    return {
      elements: this.localStorageStore['excalidraw'] ? JSON.parse(this.localStorageStore['excalidraw']) : null,
      appState: this.localStorageStore['excalidraw-state'] ? JSON.parse(this.localStorageStore['excalidraw-state']) : null,
    };
  }

  // --- Export / Import Engine (Section 6.2 & 6.3) ---

  public exportToJSON(): string {
    const payload = {
      type: 'excalidraw',
      version: 2,
      source: 'https://excalidraw.com',
      elements: this.elements.filter(e => !e.isDeleted),
      appState: {
        viewBackgroundColor: this.appState.viewBackgroundColor,
        gridSize: 20,
      },
      files: {},
    };
    return JSON.stringify(payload, null, 2);
  }

  public importFromJSON(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      if (!data || data.type !== 'excalidraw' || !Array.isArray(data.elements)) {
        return false;
      }
      this.elements = data.elements.map((el: any) => ({
        ...el,
        version: el.version ?? 1,
        versionNonce: el.versionNonce ?? randomInteger(),
        seed: el.seed ?? randomInteger(),
        isDeleted: el.isDeleted ?? false,
        groupIds: el.groupIds ?? [],
      }));
      if (data.appState?.viewBackgroundColor) {
        this.appState.viewBackgroundColor = data.appState.viewBackgroundColor;
      }
      this.commitToHistory();
      return true;
    } catch {
      return false;
    }
  }

  public exportToCanvas(options: { scale?: number; padding?: number } = {}): {
    width: number;
    height: number;
    elementCount: number;
    dataUrl: string;
  } {
    const nonDeleted = this.elements.filter(e => !e.isDeleted);
    const padding = options.padding ?? 10;
    const scale = options.scale ?? 1.0;

    if (nonDeleted.length === 0) {
      return {
        width: 100 * scale,
        height: 100 * scale,
        elementCount: 0,
        dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const el of nonDeleted) {
      const [bx1, by1, bx2, by2] = this.getElementBounds(el);
      minX = Math.min(minX, bx1);
      minY = Math.min(minY, by1);
      maxX = Math.max(maxX, bx2);
      maxY = Math.max(maxY, by2);
    }

    const width = Math.max(20, (maxX - minX + padding * 2) * scale);
    const height = Math.max(20, (maxY - minY + padding * 2) * scale);

    return {
      width,
      height,
      elementCount: nonDeleted.length,
      dataUrl: `data:image/png;base64,mock_${Math.round(width)}x${Math.round(height)}_${nonDeleted.length}`,
    };
  }

  // --- Canvas Rendering Pipeline (Section 4) ---

  private recordCanvasRender(): void {
    const nonDeleted = this.elements.filter(e => !e.isDeleted);
    this.renderLogs.push({
      width: this.appState.width,
      height: this.appState.height,
      renderedElementCount: nonDeleted.length,
      staticLayersDrawn: 1,
      interactiveLayersDrawn: 1,
      commands: nonDeleted.map(e => `draw:${e.type}:${e.id}`),
    });
  }

  public getLatestRenderLog(): CanvasSnapshot | null {
    return this.renderLogs.length > 0 ? this.renderLogs[this.renderLogs.length - 1] : null;
  }

  // --- Toolbar & Styling Setters ---

  public selectTool(tool: ToolType, locked = false): void {
    this.appState.activeTool = { type: tool, locked };
  }

  public setStrokeColor(color: string): void {
    this.appState.currentItemStrokeColor = color;
    this.updateSelectedElements({ strokeColor: color });
  }

  public setBackgroundColor(color: string): void {
    this.appState.currentItemBackgroundColor = color;
    this.updateSelectedElements({ backgroundColor: color });
  }

  public setFillStyle(style: FillStyle): void {
    this.appState.currentItemFillStyle = style;
    this.updateSelectedElements({ fillStyle: style });
  }

  public setStrokeWidth(width: number): void {
    const clamped = Math.max(1, Number.isFinite(width) ? width : 1);
    this.appState.currentItemStrokeWidth = clamped;
    this.updateSelectedElements({ strokeWidth: clamped });
  }

  public setStrokeStyle(style: StrokeStyle): void {
    this.appState.currentItemStrokeStyle = style;
    this.updateSelectedElements({ strokeStyle: style });
  }

  public setRoughness(roughness: number): void {
    const clamped = Math.max(0, Math.min(3, Number.isFinite(roughness) ? roughness : 1));
    this.appState.currentItemRoughness = clamped;
    this.updateSelectedElements({ roughness: clamped });
  }

  public setOpacity(opacity: number): void {
    const clamped = Math.max(0, Math.min(100, Number.isFinite(opacity) ? opacity : 100));
    this.appState.currentItemOpacity = clamped;
    this.updateSelectedElements({ opacity: clamped });
  }

  public setFontSize(size: number): void {
    const clamped = Math.max(4, Math.min(200, Number.isFinite(size) ? size : 20));
    this.appState.currentItemFontSize = clamped;
    this.updateSelectedElements({ fontSize: clamped });
  }

  public setFontFamily(family: FontFamily): void {
    this.appState.currentItemFontFamily = family;
    this.updateSelectedElements({ fontFamily: family });
  }

  public setTextAlign(align: TextAlign): void {
    this.appState.currentItemTextAlign = align;
    this.updateSelectedElements({ textAlign: align });
  }

  public setArrowheads(start: Arrowhead | null, end: Arrowhead | null): void {
    this.appState.currentItemStartArrowhead = start;
    this.appState.currentItemEndArrowhead = end;
    this.updateSelectedElements({ startArrowhead: start, endArrowhead: end });
  }

  public setViewBackgroundColor(color: string): void {
    this.appState.viewBackgroundColor = color;
    this.commitToHistory();
  }

  public setViewportSize(width: number, height: number, devicePixelRatio = 1.0): void {
    this.appState.width = Math.max(0, width);
    this.appState.height = Math.max(0, height);
    this.appState.devicePixelRatio = devicePixelRatio;
    this.recordCanvasRender();
  }

  private updateSelectedElements(updates: Partial<ExcalidrawElement>): void {
    let count = 0;
    for (const el of this.elements) {
      if (this.appState.selectedElementIds[el.id] && !el.locked) {
        Object.assign(el, updates);
        el.version += 1;
        el.versionNonce = randomInteger();
        el.updated = Date.now();
        count++;
      }
    }
    if (count > 0) {
      this.commitToHistory();
    }
  }

  // --- Getters for Invariants and Assertions ---

  public getElements(): readonly ExcalidrawElement[] {
    return this.elements;
  }

  public getNonDeletedElements(): readonly ExcalidrawElement[] {
    return this.elements.filter(e => !e.isDeleted);
  }

  public getElementById(id: string): ExcalidrawElement | undefined {
    return this.elements.find(e => e.id === id);
  }

  public getSelectedElements(): readonly ExcalidrawElement[] {
    return this.elements.filter(e => this.appState.selectedElementIds[e.id] && !e.isDeleted);
  }

  public getSelectedElementIds(): Record<string, boolean> {
    return { ...this.appState.selectedElementIds };
  }

  public getAppState(): Readonly<AppState> {
    return this.appState;
  }

  public reset(): void {
    this.elements = [];
    this.appState = this.createDefaultAppState();
    this.undoStack = [];
    this.redoStack = [];
    this.localStorageStore = {};
    this.renderLogs = [];
    this.draftElement = null;
    this.activePointer = null;
    this.commitToHistory();
  }
}
