import rough from 'roughjs';
import { ExcalidrawElement } from '../types/element';
import { AppState } from '../types/state';
import { snapScrollToDevicePixels } from '../math/coordinates';
import { renderElement } from './renderElement';

/**
 * Initializes and scales a canvas context for Retina/high-DPI screens.
 */
export function setupCanvasContext(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  dpr: number,
): CanvasRenderingContext2D {
  const scaledWidth = Math.round(width * dpr);
  const scaledHeight = Math.round(height * dpr);

  if (canvas.width !== scaledWidth || canvas.height !== scaledHeight) {
    canvas.width = scaledWidth;
    canvas.height = scaledHeight;
  }

  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  return ctx;
}

/**
 * Renders the background color and optional grid onto the StaticCanvas.
 */
export function renderGrid(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  scrollX: number,
  scrollY: number,
  zoom: number,
  gridSize = 20,
): void {
  context.save();
  context.strokeStyle = 'rgba(0, 0, 0, 0.06)';
  context.lineWidth = 1 / zoom;

  const step = gridSize * zoom;
  if (step < 8) {
    context.restore();
    return; // Grid is too dense to render legibly
  }

  const offsetX = (scrollX * zoom) % step;
  const offsetY = (scrollY * zoom) % step;

  context.beginPath();
  for (let x = offsetX; x < width; x += step) {
    context.moveTo(x, 0);
    context.lineTo(x, height);
  }
  for (let y = offsetY; y < height; y += step) {
    context.moveTo(0, y);
    context.lineTo(width, y);
  }
  context.stroke();
  context.restore();
}

/**
 * Renders the static committed scene elements into StaticCanvas.
 */
export function renderStaticScene(
  canvas: HTMLCanvasElement,
  elements: readonly ExcalidrawElement[],
  appState: AppState,
): void {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const ctx = setupCanvasContext(canvas, appState.width, appState.height, dpr);

  // Clear canvas buffer
  ctx.clearRect(0, 0, appState.width, appState.height);

  // Fill background
  if (appState.viewBackgroundColor) {
    ctx.fillStyle = appState.viewBackgroundColor;
    ctx.fillRect(0, 0, appState.width, appState.height);
  }

  // Snap scroll to prevent sub-pixel blur
  const snapped = snapScrollToDevicePixels(appState, dpr);
  const scrollX = snapped.scrollX;
  const scrollY = snapped.scrollY;

  // Render grid if dimensions > 0
  if (appState.width > 0 && appState.height > 0) {
    renderGrid(ctx, appState.width, appState.height, scrollX, scrollY, appState.zoom.value);
  }

  // Apply camera transform: scale by zoom, then translate by scroll
  ctx.save();
  ctx.scale(appState.zoom.value, appState.zoom.value);
  ctx.translate(scrollX, scrollY);

  const rc = rough.canvas(canvas);

  for (const element of elements) {
    if (!element.isDeleted) {
      renderElement(element, rc, ctx, appState);
    }
  }

  ctx.restore();
}

export const renderScene = renderStaticScene;

export interface SelectionBox {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

/**
 * Renders interactive draft elements, selection boxes, and transform handles into InteractiveCanvas.
 * Supports both PROJECT.md signature and Explorer 3 signature.
 */
export function renderInteractiveScene(
  canvas: HTMLCanvasElement,
  appState: AppState,
  draftElement: ExcalidrawElement | null,
  selectedElements: readonly ExcalidrawElement[],
  selectionBox: SelectionBox | null,
): void;
export function renderInteractiveScene(
  canvas: HTMLCanvasElement,
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  draftElement: ExcalidrawElement | null,
): void;
export function renderInteractiveScene(
  canvas: HTMLCanvasElement,
  arg2: AppState | readonly ExcalidrawElement[],
  arg3: ExcalidrawElement | null | AppState,
  arg4?: readonly ExcalidrawElement[] | ExcalidrawElement | null,
  arg5?: SelectionBox | null,
): void {
  let appState: AppState;
  let draftElement: ExcalidrawElement | null = null;
  let selectedElements: readonly ExcalidrawElement[] = [];
  let selectionBox: SelectionBox | null = null;

  if (Array.isArray(arg2)) {
    // Signature: (canvas, elements, appState, draftElement)
    const elements = arg2 as readonly ExcalidrawElement[];
    appState = arg3 as AppState;
    draftElement = (arg4 as ExcalidrawElement | null) ?? null;
    selectedElements = elements.filter(
      (el) => appState.selectedElementIds[el.id] && !el.isDeleted,
    );
    selectionBox = null;
  } else {
    // Signature: (canvas, appState, draftElement, selectedElements, selectionBox)
    appState = arg2 as AppState;
    draftElement = (arg3 as ExcalidrawElement | null) ?? null;
    selectedElements = (arg4 as readonly ExcalidrawElement[]) || [];
    selectionBox = arg5 ?? null;
  }

  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const ctx = setupCanvasContext(canvas, appState.width, appState.height, dpr);

  // Clear previous frame
  ctx.clearRect(0, 0, appState.width, appState.height);

  const snapped = snapScrollToDevicePixels(appState, dpr);
  const scrollX = snapped.scrollX;
  const scrollY = snapped.scrollY;

  ctx.save();
  ctx.scale(appState.zoom.value, appState.zoom.value);
  ctx.translate(scrollX, scrollY);

  const rc = rough.canvas(canvas);

  // 1. Render active draft element
  if (draftElement) {
    renderElement(draftElement, rc, ctx, appState);
  }

  // 2. Render selection bounding boxes & resize handles
  if (selectedElements.length > 0) {
    renderSelectionOverlays(ctx, selectedElements, appState.zoom.value);
  }

  // 3. Render marquee selection box
  if (selectionBox) {
    renderSelectionMarquee(ctx, selectionBox, appState.zoom.value);
  }

  ctx.restore();
}

/**
 * Renders bounding boxes and 8-point resize handles around selected elements.
 */
function renderSelectionOverlays(
  ctx: CanvasRenderingContext2D,
  selectedElements: readonly ExcalidrawElement[],
  zoom: number,
): void {
  const margin = 4 / zoom;
  const handleSize = 8 / zoom;

  ctx.save();
  ctx.strokeStyle = '#3b82f6'; // Blue highlight
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = 1.5 / zoom;

  for (const el of selectedElements) {
    ctx.save();

    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    ctx.translate(cx, cy);
    if (el.angle !== 0) ctx.rotate(el.angle);
    ctx.translate(-cx, -cy);

    const x = el.x - margin;
    const y = el.y - margin;
    const w = el.width + margin * 2;
    const h = el.height + margin * 2;

    // Draw dashed bounding box
    ctx.setLineDash([4 / zoom, 4 / zoom]);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);

    // Draw 8-point handles
    const handles = [
      [x, y], // nw
      [x + w / 2, y], // n
      [x + w, y], // ne
      [x + w, y + h / 2], // e
      [x + w, y + h], // se
      [x + w / 2, y + h], // s
      [x, y + h], // sw
      [x, y + h / 2], // w
    ];

    for (const [hx, hy] of handles) {
      ctx.fillRect(hx! - handleSize / 2, hy! - handleSize / 2, handleSize, handleSize);
      ctx.strokeRect(hx! - handleSize / 2, hy! - handleSize / 2, handleSize, handleSize);
    }

    // Rotation handle
    const rotY = y - 20 / zoom;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w / 2, rotY);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x + w / 2, rotY, handleSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  ctx.restore();
}

/**
 * Renders the semi-transparent marquee drag selection box.
 */
function renderSelectionMarquee(
  ctx: CanvasRenderingContext2D,
  box: SelectionBox,
  zoom: number,
): void {
  const x = Math.min(box.startX, box.currentX);
  const y = Math.min(box.startY, box.currentY);
  const w = Math.abs(box.currentX - box.startX);
  const h = Math.abs(box.currentY - box.startY);

  ctx.save();
  ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 1 / zoom;

  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}
