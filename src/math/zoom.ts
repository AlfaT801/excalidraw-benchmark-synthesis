/**
 * Zoom calculation engine supporting cursor-anchored focal zoom, wheel delta scaling,
 * and zoom-to-fit calculation.
 */

import {
  DOMRectLike,
  CoordinateTransformState,
  getZoomValue,
  getCanvasOffsets,
} from './coordinates';

export const MIN_ZOOM = 0.1; // 10%
export const MAX_ZOOM = 30.0; // 3000%
export const ZOOM_STEP = 0.1;

export interface ZoomResult {
  zoom: { value: number };
  scrollX: number;
  scrollY: number;
}

/**
 * Clamps and normalizes zoom value to 3 decimal places within [MIN_ZOOM, MAX_ZOOM].
 */
export function getNormalizedZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) {
    return 1.0;
  }
  const clamped = Math.min(Math.max(zoom, MIN_ZOOM), MAX_ZOOM);
  return Math.round(clamped * 1000) / 1000;
}

/**
 * Calculates updated camera state (zoom, scrollX, scrollY) such that the scene point
 * beneath cursor remains stationary at the cursor's viewport position after zoom.
 *
 * Supports both { x, y } and { clientX, clientY } cursor objects.
 *
 * Derivation:
 *   X_scene = (cursorX - offsetLeft) / currentZoom - currentScrollX
 *   X_scene = (cursorX - offsetLeft) / nextZoom - nextScrollX
 *   => nextScrollX = currentScrollX + (cursorX - offsetLeft) * (1 / nextZoom - 1 / currentZoom)
 */
export function calculateZoom(
  cursor: { x?: number; y?: number; clientX?: number; clientY?: number },
  targetZoom: number,
  appState: CoordinateTransformState,
  canvasRect?: DOMRectLike | null,
): ZoomResult {
  const currentZoom = getZoomValue(appState.zoom);
  const nextZoom = getNormalizedZoom(targetZoom);

  // If zoom is unchanged, return current state
  if (nextZoom === currentZoom) {
    return {
      zoom: { value: currentZoom },
      scrollX: appState.scrollX,
      scrollY: appState.scrollY,
    };
  }

  const { offsetLeft, offsetTop } = getCanvasOffsets(canvasRect, appState);
  const cursorX = cursor.x ?? cursor.clientX ?? 0;
  const cursorY = cursor.y ?? cursor.clientY ?? 0;

  const layerX = cursorX - offsetLeft;
  const layerY = cursorY - offsetTop;

  // Focal zoom delta
  const zoomFactor = 1 / nextZoom - 1 / currentZoom;
  const nextScrollX = appState.scrollX + layerX * zoomFactor;
  const nextScrollY = appState.scrollY + layerY * zoomFactor;

  return {
    zoom: { value: nextZoom },
    scrollX: nextScrollX,
    scrollY: nextScrollY,
  };
}

/**
 * Calculates focal zoom resulting from a wheel or trackpad pinch event.
 * Incorporates Excalidraw's logarithmic acceleration for zoom > 1.0.
 */
export function calculateZoomFromWheel(
  cursor: { x?: number; y?: number; clientX?: number; clientY?: number },
  deltaY: number,
  appState: CoordinateTransformState,
  canvasRect?: DOMRectLike | null,
): ZoomResult {
  const currentZoom = getZoomValue(appState.zoom);
  const sign = Math.sign(deltaY);
  const absDelta = Math.abs(deltaY);

  // Base step
  let newZoom = currentZoom - deltaY / 100;

  // Amplify step when zoomed in (smooth trackpad fine control)
  if (currentZoom > 1) {
    newZoom += Math.log10(currentZoom) * -sign * Math.min(1, absDelta / 20);
  }

  return calculateZoom(cursor, newZoom, appState, canvasRect);
}

/**
 * Helper to step zoom in by discrete ratio (e.g. toolbar '+' button).
 * Defaults cursor to canvas center.
 */
export function zoomIn(
  viewportSize: { width: number; height: number },
  appState: CoordinateTransformState,
  stepFactor: number = 1.1,
  canvasRect?: DOMRectLike | null,
): ZoomResult {
  const currentZoom = getZoomValue(appState.zoom);
  const targetZoom = currentZoom * stepFactor;
  const center = {
    x: (canvasRect?.left ?? appState.offsetLeft ?? 0) + viewportSize.width / 2,
    y: (canvasRect?.top ?? appState.offsetTop ?? 0) + viewportSize.height / 2,
  };
  return calculateZoom(center, targetZoom, appState, canvasRect);
}

/**
 * Helper to step zoom out by discrete ratio (e.g. toolbar '-' button).
 * Defaults cursor to canvas center.
 */
export function zoomOut(
  viewportSize: { width: number; height: number },
  appState: CoordinateTransformState,
  stepFactor: number = 1.1,
  canvasRect?: DOMRectLike | null,
): ZoomResult {
  const currentZoom = getZoomValue(appState.zoom);
  const targetZoom = currentZoom / stepFactor;
  const center = {
    x: (canvasRect?.left ?? appState.offsetLeft ?? 0) + viewportSize.width / 2,
    y: (canvasRect?.top ?? appState.offsetTop ?? 0) + viewportSize.height / 2,
  };
  return calculateZoom(center, targetZoom, appState, canvasRect);
}

/**
 * Resets zoom to 100% (1.0), anchored at canvas center.
 */
export function resetZoom(
  viewportSize: { width: number; height: number },
  appState: CoordinateTransformState,
  canvasRect?: DOMRectLike | null,
): ZoomResult {
  const center = {
    x: (canvasRect?.left ?? appState.offsetLeft ?? 0) + viewportSize.width / 2,
    y: (canvasRect?.top ?? appState.offsetTop ?? 0) + viewportSize.height / 2,
  };
  return calculateZoom(center, 1.0, appState, canvasRect);
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Computes camera state to fit an array of element bounding boxes inside the viewport with padding.
 */
export function getZoomToFit(
  bounds: BoundingBox | null,
  viewport: { width: number; height: number },
  padding: number = 40,
): ZoomResult {
  if (!bounds || bounds.maxX <= bounds.minX || bounds.maxY <= bounds.minY) {
    return {
      zoom: { value: 1.0 },
      scrollX: 0,
      scrollY: 0,
    };
  }

  const contentWidth = bounds.maxX - bounds.minX;
  const contentHeight = bounds.maxY - bounds.minY;

  const availableWidth = Math.max(1, viewport.width - padding * 2);
  const availableHeight = Math.max(1, viewport.height - padding * 2);

  const scaleX = availableWidth / contentWidth;
  const scaleY = availableHeight / contentHeight;
  const targetZoom = getNormalizedZoom(Math.min(scaleX, scaleY, 1.0)); // Don't zoom past 100% on fit

  // Center bounding box in viewport
  const centerSceneX = bounds.minX + contentWidth / 2;
  const centerSceneY = bounds.minY + contentHeight / 2;

  const scrollX = viewport.width / (2 * targetZoom) - centerSceneX;
  const scrollY = viewport.height / (2 * targetZoom) - centerSceneY;

  return {
    zoom: { value: targetZoom },
    scrollX,
    scrollY,
  };
}
