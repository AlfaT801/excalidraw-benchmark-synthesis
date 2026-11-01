import { describe, it, expect } from 'vitest';
import {
  calculateZoom,
  calculateZoomFromWheel,
  getNormalizedZoom,
  zoomIn,
  zoomOut,
  resetZoom,
  getZoomToFit,
  MIN_ZOOM,
  MAX_ZOOM,
} from '../../src/math/zoom';
import { viewportCoordsToSceneCoords } from '../../src/math/coordinates';

describe('Zoom Calculation Engine (zoom.test.ts)', () => {
  const canvasRect = { left: 0, top: 0, width: 1000, height: 800 };

  describe('1. Focal Anchor Invariance (Stationary Cursor Principle)', () => {
    it('keeps the scene point under the cursor stationary after zooming in (1.0 -> 2.0)', () => {
      const cursor = { x: 400, y: 300 };
      const prevState = {
        zoom: { value: 1.0 },
        scrollX: 50,
        scrollY: 20,
        offsetLeft: 0,
        offsetTop: 0,
      };

      // Point before zoom
      const sceneBefore = viewportCoordsToSceneCoords(cursor.x, cursor.y, prevState, canvasRect);

      // Perform zoom
      const nextState = calculateZoom(cursor, 2.0, prevState, canvasRect);

      // Point after zoom
      const stateAfter = {
        zoom: nextState.zoom,
        scrollX: nextState.scrollX,
        scrollY: nextState.scrollY,
        offsetLeft: 0,
        offsetTop: 0,
      };
      const sceneAfter = viewportCoordsToSceneCoords(cursor.x, cursor.y, stateAfter, canvasRect);

      expect(sceneAfter.sceneX).toBeCloseTo(sceneBefore.sceneX, 6);
      expect(sceneAfter.sceneY).toBeCloseTo(sceneBefore.sceneY, 6);
    });

    it('keeps the scene point stationary after zooming out (1.0 -> 0.5)', () => {
      const cursor = { x: 750, y: 150 };
      const prevState = {
        zoom: { value: 1.0 },
        scrollX: -100,
        scrollY: 250,
        offsetLeft: 0,
        offsetTop: 0,
      };

      const sceneBefore = viewportCoordsToSceneCoords(cursor.x, cursor.y, prevState, canvasRect);
      const nextState = calculateZoom(cursor, 0.5, prevState, canvasRect);
      const sceneAfter = viewportCoordsToSceneCoords(cursor.x, cursor.y, nextState, canvasRect);

      expect(sceneAfter.sceneX).toBeCloseTo(sceneBefore.sceneX, 6);
      expect(sceneAfter.sceneY).toBeCloseTo(sceneBefore.sceneY, 6);
    });

    it('maintains focal invariance with non-zero canvas DOM offsets', () => {
      const offsetRect = { left: 120, top: 80, width: 800, height: 600 };
      const cursor = { x: 300, y: 400 };
      const prevState = {
        zoom: { value: 1.2 },
        scrollX: 80,
        scrollY: -40,
        offsetLeft: 120,
        offsetTop: 80,
      };

      const sceneBefore = viewportCoordsToSceneCoords(cursor.x, cursor.y, prevState, offsetRect);
      const nextState = calculateZoom(cursor, 2.5, prevState, offsetRect);
      const sceneAfter = viewportCoordsToSceneCoords(cursor.x, cursor.y, nextState, offsetRect);

      expect(sceneAfter.sceneX).toBeCloseTo(sceneBefore.sceneX, 6);
      expect(sceneAfter.sceneY).toBeCloseTo(sceneBefore.sceneY, 6);
    });
  });

  describe('2. Zoom Clamping & Normalization', () => {
    it('clamps values below MIN_ZOOM (0.1)', () => {
      expect(getNormalizedZoom(0.05)).toBe(MIN_ZOOM);
      expect(getNormalizedZoom(-1)).toBe(MIN_ZOOM);
    });

    it('clamps values above MAX_ZOOM (30.0)', () => {
      expect(getNormalizedZoom(35.0)).toBe(MAX_ZOOM);
      expect(getNormalizedZoom(100.0)).toBe(MAX_ZOOM);
    });

    it('normalizes zoom to 3 decimal places', () => {
      expect(getNormalizedZoom(1.33333333)).toBe(1.333);
    });

    it('does not move scroll when targetZoom equals currentZoom', () => {
      const state = { zoom: { value: 1.5 }, scrollX: 100, scrollY: 200 };
      const result = calculateZoom({ x: 500, y: 400 }, 1.5, state, canvasRect);
      expect(result.scrollX).toBe(100);
      expect(result.scrollY).toBe(200);
      expect(result.zoom.value).toBe(1.5);
    });
  });

  describe('3. Wheel Delta Zoom', () => {
    it('zooms in on negative wheel delta', () => {
      const state = { zoom: { value: 1.0 }, scrollX: 0, scrollY: 0 };
      const result = calculateZoomFromWheel({ x: 500, y: 400 }, -50, state, canvasRect);
      expect(result.zoom.value).toBeGreaterThan(1.0);
    });

    it('zooms out on positive wheel delta', () => {
      const state = { zoom: { value: 1.0 }, scrollX: 0, scrollY: 0 };
      const result = calculateZoomFromWheel({ x: 500, y: 400 }, 50, state, canvasRect);
      expect(result.zoom.value).toBeLessThan(1.0);
    });
  });

  describe('4. Programmatic Discrete Zoom Helpers', () => {
    const viewportSize = { width: 800, height: 600 };
    const state = { zoom: { value: 1.0 }, scrollX: 0, scrollY: 0 };

    it('zoomIn multiplies zoom by stepFactor centered on viewport', () => {
      const res = zoomIn(viewportSize, state, 1.2, canvasRect);
      expect(res.zoom.value).toBe(1.2);
    });

    it('zoomOut divides zoom by stepFactor centered on viewport', () => {
      const res = zoomOut(viewportSize, state, 1.2, canvasRect);
      expect(res.zoom.value).toBeCloseTo(1.0 / 1.2, 3);
    });

    it('resetZoom resets zoom to 1.0', () => {
      const zoomedState = { zoom: { value: 2.5 }, scrollX: -300, scrollY: -200 };
      const res = resetZoom(viewportSize, zoomedState, canvasRect);
      expect(res.zoom.value).toBe(1.0);
    });
  });

  describe('5. Zoom To Fit', () => {
    it('fits scene bounding box inside viewport with padding', () => {
      const bounds = { minX: 100, minY: 100, maxX: 500, maxY: 400 };
      const viewport = { width: 880, height: 680 };
      const fit = getZoomToFit(bounds, viewport, 40);
      expect(fit.zoom.value).toBe(1.0);
      expect(fit.scrollX).toBe(140);
      expect(fit.scrollY).toBe(90);
    });

    it('zooms out when content is larger than viewport', () => {
      const bounds = { minX: 0, minY: 0, maxX: 1600, maxY: 1200 };
      const viewport = { width: 880, height: 680 };
      const fit = getZoomToFit(bounds, viewport, 40);
      expect(fit.zoom.value).toBe(0.5);
    });

    it('returns 1.0 zoom and (0,0) scroll for empty scene', () => {
      const fit = getZoomToFit(null, { width: 800, height: 600 });
      expect(fit.zoom.value).toBe(1.0);
      expect(fit.scrollX).toBe(0);
      expect(fit.scrollY).toBe(0);
    });
  });
});
