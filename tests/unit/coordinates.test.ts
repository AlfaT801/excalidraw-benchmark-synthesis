import { describe, it, expect } from 'vitest';
import {
  viewportCoordsToSceneCoords,
  sceneCoordsToViewportCoords,
  viewportDistanceToSceneDistance,
  sceneDistanceToViewportDistance,
  calculatePanDisplacement,
  snapScrollToDevicePixels,
  snapToGrid,
} from '../../src/math/coordinates';

describe('Coordinate Math Engine (coordinates.ts)', () => {
  const baseCanvasRect = { left: 0, top: 0, width: 800, height: 600 };

  describe('1. Basic 1:1 Mapping (zoom=1, scroll=0, offset=0)', () => {
    const state = { zoom: { value: 1 }, scrollX: 0, scrollY: 0, offsetLeft: 0, offsetTop: 0 };

    it('maps origin (0, 0) identically', () => {
      const scene = viewportCoordsToSceneCoords(0, 0, state, baseCanvasRect);
      expect(scene.sceneX).toBe(0);
      expect(scene.sceneY).toBe(0);

      const viewport = sceneCoordsToViewportCoords(0, 0, state, baseCanvasRect);
      expect(viewport.viewportX).toBe(0);
      expect(viewport.viewportY).toBe(0);
    });

    it('maps arbitrary point (250, 400) identically', () => {
      const scene = viewportCoordsToSceneCoords(250, 400, state, baseCanvasRect);
      expect(scene.sceneX).toBe(250);
      expect(scene.sceneY).toBe(400);

      const viewport = sceneCoordsToViewportCoords(250, 400, state, baseCanvasRect);
      expect(viewport.viewportX).toBe(250);
      expect(viewport.viewportY).toBe(400);
    });
  });

  describe('2. Canvas DOM Offsets (offsetLeft/offsetTop)', () => {
    const offsetRect = { left: 100, top: 50, width: 800, height: 600 };
    const state = { zoom: { value: 1 }, scrollX: 0, scrollY: 0 };

    it('subtracts DOM offset when converting viewport to scene', () => {
      const scene = viewportCoordsToSceneCoords(150, 120, state, offsetRect);
      expect(scene.sceneX).toBe(50);
      expect(scene.sceneY).toBe(70);
    });

    it('adds DOM offset when converting scene to viewport', () => {
      const viewport = sceneCoordsToViewportCoords(50, 70, state, offsetRect);
      expect(viewport.viewportX).toBe(150);
      expect(viewport.viewportY).toBe(120);
    });

    it('falls back to appState.offsetLeft/offsetTop when canvasRect is null', () => {
      const stateWithOffsets = {
        zoom: { value: 1 },
        scrollX: 0,
        scrollY: 0,
        offsetLeft: 80,
        offsetTop: 40,
      };
      const scene = viewportCoordsToSceneCoords(180, 140, stateWithOffsets, null);
      expect(scene.sceneX).toBe(100);
      expect(scene.sceneY).toBe(100);
    });
  });

  describe('3. Camera Zoom & Scroll Scaling', () => {
    it('scales correctly under 2x zoom', () => {
      const state = { zoom: { value: 2 }, scrollX: 0, scrollY: 0 };
      const scene = viewportCoordsToSceneCoords(200, 300, state, baseCanvasRect);
      expect(scene.sceneX).toBe(100);
      expect(scene.sceneY).toBe(150);

      const viewport = sceneCoordsToViewportCoords(100, 150, state, baseCanvasRect);
      expect(viewport.viewportX).toBe(200);
      expect(viewport.viewportY).toBe(300);
    });

    it('scales correctly under 0.5x zoom (zoomed out)', () => {
      const state = { zoom: { value: 0.5 }, scrollX: 0, scrollY: 0 };
      const scene = viewportCoordsToSceneCoords(100, 150, state, baseCanvasRect);
      expect(scene.sceneX).toBe(200);
      expect(scene.sceneY).toBe(300);

      const viewport = sceneCoordsToViewportCoords(200, 300, state, baseCanvasRect);
      expect(viewport.viewportX).toBe(100);
      expect(viewport.viewportY).toBe(150);
    });

    it('accounts for scroll offsets with zoom', () => {
      const state = { zoom: { value: 2 }, scrollX: 100, scrollY: -50 };
      const scene = viewportCoordsToSceneCoords(400, 200, state, baseCanvasRect);
      expect(scene.sceneX).toBe(100);
      expect(scene.sceneY).toBe(150);

      const viewport = sceneCoordsToViewportCoords(100, 150, state, baseCanvasRect);
      expect(viewport.viewportX).toBe(400);
      expect(viewport.viewportY).toBe(200);
    });
  });

  describe('4. Bi-directional Round-Trip Identity Invariance', () => {
    it('round-trips 1,000 random points without numerical drift', () => {
      const state = {
        zoom: { value: 1.732 },
        scrollX: 384.92,
        scrollY: -192.48,
        offsetLeft: 123.4,
        offsetTop: 56.7,
      };
      const canvasRect = { left: 123.4, top: 56.7 };

      for (let i = 0; i < 1000; i++) {
        const originalSceneX = (Math.random() - 0.5) * 10000;
        const originalSceneY = (Math.random() - 0.5) * 10000;

        const viewport = sceneCoordsToViewportCoords(
          originalSceneX,
          originalSceneY,
          state,
          canvasRect,
        );

        const recoveredScene = viewportCoordsToSceneCoords(
          viewport.viewportX,
          viewport.viewportY,
          state,
          canvasRect,
        );

        expect(recoveredScene.sceneX).toBeCloseTo(originalSceneX, 6);
        expect(recoveredScene.sceneY).toBeCloseTo(originalSceneY, 6);
      }
    });
  });

  describe('5. Distance Conversions', () => {
    it('converts viewport distances to scene distances', () => {
      expect(viewportDistanceToSceneDistance(100, 2.0)).toBe(50);
      expect(viewportDistanceToSceneDistance(100, 0.5)).toBe(200);
      expect(viewportDistanceToSceneDistance(100, { value: 4.0 })).toBe(25);
    });

    it('converts scene distances to viewport distances', () => {
      expect(sceneDistanceToViewportDistance(50, 2.0)).toBe(100);
      expect(sceneDistanceToViewportDistance(200, 0.5)).toBe(100);
      expect(sceneDistanceToViewportDistance(25, { value: 4.0 })).toBe(100);
    });
  });

  describe('6. Pan Displacement Math', () => {
    it('calculates pan displacement inversely proportional to zoom', () => {
      const prev = { x: 100, y: 100 };
      const curr = { x: 150, y: 120 };

      // At zoom 1.0: delta = (+50, +20)
      const pan1 = calculatePanDisplacement(prev, curr, 1.0);
      expect(pan1).toEqual({ deltaScrollX: 50, deltaScrollY: 20 });

      // At zoom 2.0: delta = (+25, +10)
      const pan2 = calculatePanDisplacement(prev, curr, 2.0);
      expect(pan2).toEqual({ deltaScrollX: 25, deltaScrollY: 10 });
    });
  });

  describe('7. Sub-Pixel Snapping (snapScrollToDevicePixels)', () => {
    it('snaps fractional scroll to integer physical pixels on Retina (dpr=2)', () => {
      const state = { zoom: { value: 1 }, scrollX: 100.27, scrollY: 50.81 };
      const snapped = snapScrollToDevicePixels(state, 2.0);
      expect(snapped.scrollX).toBe(100.5);
      expect(snapped.scrollY).toBe(51.0);

      // Verify physical device pixels are exact integers
      expect((snapped.scrollX * 2.0) % 1).toBe(0);
      expect((snapped.scrollY * 2.0) % 1).toBe(0);
    });

    it('is idempotent: snapping already snapped state returns identical values', () => {
      const state = { zoom: { value: 1.5 }, scrollX: 73.1234, scrollY: -45.6789 };
      const snapped1 = snapScrollToDevicePixels(state, 2.0);
      const snapped2 = snapScrollToDevicePixels(snapped1, 2.0);
      expect(snapped2).toBe(snapped1); // Same reference optimization
    });

    it('handles dpr=1 (standard display)', () => {
      const state = { zoom: { value: 1 }, scrollX: 10.4, scrollY: 20.6 };
      const snapped = snapScrollToDevicePixels(state, 1.0);
      expect(snapped.scrollX).toBe(10);
      expect(snapped.scrollY).toBe(21);
    });
  });

  describe('8. Snap to Grid Math', () => {
    it('snaps scalars to 20px grid boundaries', () => {
      expect(snapToGrid(0, 20)).toBe(0);
      expect(snapToGrid(9, 20)).toBe(0);
      expect(snapToGrid(10, 20)).toBe(20);
      expect(snapToGrid(28, 20)).toBe(20);
      expect(snapToGrid(31, 20)).toBe(40);
      expect(snapToGrid(-11, 20)).toBe(-20);
    });

    it('handles custom grid step', () => {
      expect(snapToGrid(14, 5)).toBe(15);
      expect(snapToGrid(12, 5)).toBe(10);
    });
  });

  describe('9. Defensive Edge Cases', () => {
    it('handles zero and negative zoom safely by defaulting to 1.0', () => {
      const stateZero = { zoom: { value: 0 }, scrollX: 0, scrollY: 0 };
      const scene0 = viewportCoordsToSceneCoords(100, 100, stateZero, baseCanvasRect);
      expect(scene0.sceneX).toBe(100);
      expect(scene0.sceneY).toBe(100);

      const stateNeg = { zoom: { value: -2 }, scrollX: 0, scrollY: 0 };
      const sceneNeg = viewportCoordsToSceneCoords(100, 100, stateNeg, baseCanvasRect);
      expect(sceneNeg.sceneX).toBe(100);
      expect(sceneNeg.sceneY).toBe(100);
    });

    it('handles bare numeric zoom in appState', () => {
      const stateNumeric = { zoom: 2.0, scrollX: 10, scrollY: 10 };
      const scene = viewportCoordsToSceneCoords(20, 20, stateNumeric, baseCanvasRect);
      expect(scene.sceneX).toBe(0);
      expect(scene.sceneY).toBe(0);
    });
  });
});
