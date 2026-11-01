/**
 * Coordinate transformation and device-pixel snapping engine.
 * Pure mathematical functions converting between Viewport and Scene coordinate systems.
 */

export interface DOMRectLike {
  left: number;
  top: number;
  width?: number;
  height?: number;
}

export interface CoordinateTransformState {
  zoom: { value: number } | number;
  scrollX: number;
  scrollY: number;
  offsetLeft?: number;
  offsetTop?: number;
}

export interface ViewportCoords {
  viewportX: number;
  viewportY: number;
  x: number;
  y: number;
}

export interface SceneCoords {
  sceneX: number;
  sceneY: number;
  x: number;
  y: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Extracts normalized numeric zoom value from AppState.
 */
export function getZoomValue(zoom: { value: number } | number): number {
  const val = typeof zoom === 'number' ? zoom : zoom.value;
  return Number.isFinite(val) && val > 0 ? val : 1.0;
}

/**
 * Resolves canvas offsetLeft/offsetTop from either canvasRect or appState.
 */
export function getCanvasOffsets(
  canvasRect?: DOMRectLike | null,
  appState?: { offsetLeft?: number; offsetTop?: number },
): { offsetLeft: number; offsetTop: number } {
  if (canvasRect) {
    return {
      offsetLeft: canvasRect.left ?? 0,
      offsetTop: canvasRect.top ?? 0,
    };
  }
  return {
    offsetLeft: appState?.offsetLeft ?? 0,
    offsetTop: appState?.offsetTop ?? 0,
  };
}

/**
 * Converts Viewport client coordinates (clientX, clientY) to infinite Scene coordinates (sceneX, sceneY).
 *
 * Formula:
 *   sceneX = (viewportX - offsetLeft) / zoom - scrollX
 *   sceneY = (viewportY - offsetTop) / zoom - scrollY
 */
export function viewportCoordsToSceneCoords(
  viewportX: number,
  viewportY: number,
  appState: CoordinateTransformState,
  canvasRect?: DOMRectLike | null,
): SceneCoords {
  const zoom = getZoomValue(appState.zoom);
  const { offsetLeft, offsetTop } = getCanvasOffsets(canvasRect, appState);

  const sceneX = (viewportX - offsetLeft) / zoom - appState.scrollX;
  const sceneY = (viewportY - offsetTop) / zoom - appState.scrollY;

  return { sceneX, sceneY, x: sceneX, y: sceneY };
}

/**
 * Converts infinite Scene coordinates (sceneX, sceneY) to Viewport client coordinates (viewportX, viewportY).
 *
 * Formula:
 *   viewportX = (sceneX + scrollX) * zoom + offsetLeft
 *   viewportY = (sceneY + scrollY) * zoom + offsetTop
 */
export function sceneCoordsToViewportCoords(
  sceneX: number,
  sceneY: number,
  appState: CoordinateTransformState,
  canvasRect?: DOMRectLike | null,
): ViewportCoords {
  const zoom = getZoomValue(appState.zoom);
  const { offsetLeft, offsetTop } = getCanvasOffsets(canvasRect, appState);

  const viewportX = (sceneX + appState.scrollX) * zoom + offsetLeft;
  const viewportY = (sceneY + appState.scrollY) * zoom + offsetTop;

  return { viewportX, viewportY, x: viewportX, y: viewportY };
}

/**
 * Converts a distance or dimension from Viewport pixels to Scene units.
 */
export function viewportDistanceToSceneDistance(
  distance: number,
  zoom: { value: number } | number,
): number {
  const z = getZoomValue(zoom);
  return distance / z;
}

/**
 * Converts a distance or dimension from Scene units to Viewport pixels.
 */
export function sceneDistanceToViewportDistance(
  distance: number,
  zoom: { value: number } | number,
): number {
  const z = getZoomValue(zoom);
  return distance * z;
}

/**
 * Calculates pan displacement when dragging from prevCursor to currentCursor.
 * Returns delta to be ADDED to current scrollX / scrollY.
 *
 * Formula:
 *   deltaScrollX = (currentCursor.x - prevCursor.x) / zoom
 *   deltaScrollY = (currentCursor.y - prevCursor.y) / zoom
 */
export function calculatePanDisplacement(
  prevCursor: { x: number; y: number },
  currentCursor: { x: number; y: number },
  zoom: { value: number } | number,
): { deltaScrollX: number; deltaScrollY: number } {
  const z = getZoomValue(zoom);
  return {
    deltaScrollX: (currentCursor.x - prevCursor.x) / z,
    deltaScrollY: (currentCursor.y - prevCursor.y) / z,
  };
}

/**
 * Snaps scrollX and scrollY to physical device pixel boundaries to prevent
 * sub-pixel anti-aliasing blur and texture blitting shimmer on Retina displays.
 *
 * Supports both object state overload and scalar argument overload.
 */
export function snapScrollToDevicePixels<
  T extends { scrollX: number; scrollY: number; zoom: { value: number } | number },
>(appState: T, devicePixelRatio?: number): T;
export function snapScrollToDevicePixels(
  scrollX: number,
  scrollY: number,
  zoom: number,
  dpr?: number,
): { scrollX: number; scrollY: number };
export function snapScrollToDevicePixels(
  first: any,
  second?: any,
  third?: any,
  fourth?: any,
): any {
  if (typeof first === 'object' && first !== null) {
    const appState = first;
    const dpr =
      typeof second === 'number'
        ? second
        : typeof window !== 'undefined'
          ? window.devicePixelRatio || 1
          : 1;
    const zoom = getZoomValue(appState.zoom);
    const devicePixels = zoom * dpr;

    if (!(devicePixels > 0) || !Number.isFinite(devicePixels)) {
      return appState;
    }

    const scrollX = Math.round(appState.scrollX * devicePixels) / devicePixels;
    const scrollY = Math.round(appState.scrollY * devicePixels) / devicePixels;

    if (scrollX === appState.scrollX && scrollY === appState.scrollY) {
      return appState;
    }

    return {
      ...appState,
      scrollX,
      scrollY,
    };
  } else {
    const scrollX = first;
    const scrollY = second;
    const zoom = third;
    const dpr =
      typeof fourth === 'number'
        ? fourth
        : typeof window !== 'undefined'
          ? window.devicePixelRatio || 1
          : 1;
    const devicePixelsPerUnit = zoom * dpr;
    if (devicePixelsPerUnit <= 0) return { scrollX, scrollY };

    return {
      scrollX: Math.round(scrollX * devicePixelsPerUnit) / devicePixelsPerUnit,
      scrollY: Math.round(scrollY * devicePixelsPerUnit) / devicePixelsPerUnit,
    };
  }
}

/**
 * Snaps a scalar value to the nearest grid step.
 */
export function snapToGrid(value: number, gridStep: number = 20): number {
  if (gridStep <= 0) return value;
  return Math.round(value / gridStep) * gridStep;
}

export { calculateZoom } from './zoom';
