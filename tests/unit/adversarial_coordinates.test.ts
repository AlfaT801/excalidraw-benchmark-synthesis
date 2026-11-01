import { describe, it, expect } from 'vitest';
import {
  viewportCoordsToSceneCoords,
  sceneCoordsToViewportCoords,
  snapScrollToDevicePixels,
  calculatePanDisplacement,
  getZoomValue,
  CoordinateTransformState,
  DOMRectLike,
} from '../../src/math/coordinates';
import {
  calculateZoom,
  calculateZoomFromWheel,
  getZoomToFit,
  MIN_ZOOM,
  MAX_ZOOM,
} from '../../src/math/zoom';

describe('Adversarial Coordinate & Camera Math Stress Suite', () => {
  describe('1. 100,000 Random Fuzz Roundtrip Invertibility', () => {
    it('verifies roundtrip invertibility across extreme zooms (0.01x to 100x) and offsets (-1e7 to 1e7)', () => {
      const TOTAL_SAMPLES = 100_000;
      let maxDriftSceneToViewport = 0;
      let maxDriftViewportToScene = 0;
      let totalDriftScene = 0;
      let totalDriftViewport = 0;

      // Seeded-like deterministic LCG PRNG for reproducibility
      let seed = 42;
      function nextRandom() {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      }

      for (let i = 0; i < TOTAL_SAMPLES; i++) {
        // Logarithmic zoom distribution across 4 orders of magnitude: 10^(-2) = 0.01 to 10^2 = 100
        const logZoom = nextRandom() * 4 - 2;
        const zoom = Math.pow(10, logZoom);

        // Extreme canvas scroll offsets: [-10^7, 10^7]
        const scrollX = (nextRandom() * 2 - 1) * 1e7;
        const scrollY = (nextRandom() * 2 - 1) * 1e7;

        // Arbitrary DOM offsets: [-10^4, 10^4]
        const offsetLeft = (nextRandom() * 2 - 1) * 1e4;
        const offsetTop = (nextRandom() * 2 - 1) * 1e4;

        const state: CoordinateTransformState = {
          zoom: { value: zoom },
          scrollX,
          scrollY,
          offsetLeft,
          offsetTop,
        };

        const canvasRect: DOMRectLike = {
          left: offsetLeft,
          top: offsetTop,
          width: 1920,
          height: 1080,
        };

        // --- Part A: Scene -> Viewport -> Scene ---
        // Test points across [-10^7, 10^7]
        const origSceneX = (nextRandom() * 2 - 1) * 1e7;
        const origSceneY = (nextRandom() * 2 - 1) * 1e7;

        const viewport = sceneCoordsToViewportCoords(origSceneX, origSceneY, state, canvasRect);
        const recoveredScene = viewportCoordsToSceneCoords(
          viewport.viewportX,
          viewport.viewportY,
          state,
          canvasRect,
        );

        const driftSceneX = Math.abs(recoveredScene.sceneX - origSceneX);
        const driftSceneY = Math.abs(recoveredScene.sceneY - origSceneY);
        const driftScene = Math.max(driftSceneX, driftSceneY);

        if (driftScene > maxDriftSceneToViewport) {
          maxDriftSceneToViewport = driftScene;
        }
        totalDriftScene += driftScene;

        // Strict assertion required by task: Math.abs(...) < 1e-4
        expect(driftScene).toBeLessThan(1e-4);

        // --- Part B: Viewport -> Scene -> Viewport ---
        const origViewportX = (nextRandom() * 2 - 1) * 1e6;
        const origViewportY = (nextRandom() * 2 - 1) * 1e6;

        const scene = viewportCoordsToSceneCoords(origViewportX, origViewportY, state, canvasRect);
        const recoveredViewport = sceneCoordsToViewportCoords(
          scene.sceneX,
          scene.sceneY,
          state,
          canvasRect,
        );

        const driftVpX = Math.abs(recoveredViewport.viewportX - origViewportX);
        const driftVpY = Math.abs(recoveredViewport.viewportY - origViewportY);
        const driftVp = Math.max(driftVpX, driftVpY);

        if (driftVp > maxDriftViewportToScene) {
          maxDriftViewportToScene = driftVp;
        }
        totalDriftViewport += driftVp;

        expect(driftVp).toBeLessThan(1e-4);
      }

      expect(totalDriftScene / TOTAL_SAMPLES).toBeLessThan(1e-6);
      expect(totalDriftViewport / TOTAL_SAMPLES).toBeLessThan(1e-6);
      expect(maxDriftSceneToViewport).toBeLessThan(1e-4);
      expect(maxDriftViewportToScene).toBeLessThan(1e-4);
    });

    it('verifies roundtrip identity at exact mathematical boundary extremes', () => {
      const boundaryCases = [
        { zoom: 0.01, scrollX: -1e7, scrollY: -1e7, pt: { x: -1e7, y: -1e7 } },
        { zoom: 0.01, scrollX: 1e7, scrollY: 1e7, pt: { x: 1e7, y: 1e7 } },
        { zoom: 100.0, scrollX: -1e7, scrollY: -1e7, pt: { x: -1e7, y: -1e7 } },
        { zoom: 100.0, scrollX: 1e7, scrollY: 1e7, pt: { x: 1e7, y: 1e7 } },
        { zoom: 1.0, scrollX: 0, scrollY: 0, pt: { x: 0, y: 0 } },
        { zoom: 0.01, scrollX: 0, scrollY: 0, pt: { x: 0.3333333333333333, y: 0.7777777777777778 } },
        { zoom: 100.0, scrollX: 1e6, scrollY: -1e6, pt: { x: 1e-6, y: -1e-6 } },
      ];

      for (const { zoom, scrollX, scrollY, pt } of boundaryCases) {
        const state: CoordinateTransformState = {
          zoom: { value: zoom },
          scrollX,
          scrollY,
        };
        const canvasRect: DOMRectLike = { left: 100, top: 50 };

        const vp = sceneCoordsToViewportCoords(pt.x, pt.y, state, canvasRect);
        const sc = viewportCoordsToSceneCoords(vp.viewportX, vp.viewportY, state, canvasRect);

        expect(Math.abs(sc.sceneX - pt.x)).toBeLessThan(1e-4);
        expect(Math.abs(sc.sceneY - pt.y)).toBeLessThan(1e-4);
      }
    });
  });

  describe('2. Cursor Focal Anchor Invariance Stress Tests', () => {
    it('preserves exact scene point under cursor across 10,000 arbitrary zoom steps', () => {
      let seed = 12345;
      function nextRandom() {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      }

      let maxFocalDrift = 0;
      const SAMPLES = 10_000;

      for (let i = 0; i < SAMPLES; i++) {
        // Initial zoom in valid range [MIN_ZOOM, MAX_ZOOM]
        const currentZoom = MIN_ZOOM + nextRandom() * (MAX_ZOOM - MIN_ZOOM);
        const targetZoom = MIN_ZOOM + nextRandom() * (MAX_ZOOM - MIN_ZOOM);

        const cursor = {
          x: (nextRandom() * 2 - 1) * 2000,
          y: (nextRandom() * 2 - 1) * 2000,
        };

        const canvasRect: DOMRectLike = {
          left: (nextRandom() * 2 - 1) * 500,
          top: (nextRandom() * 2 - 1) * 500,
        };

        const stateBefore: CoordinateTransformState = {
          zoom: { value: currentZoom },
          scrollX: (nextRandom() * 2 - 1) * 100_000,
          scrollY: (nextRandom() * 2 - 1) * 100_000,
        };

        // Scene coordinate under cursor BEFORE zoom
        const sceneBefore = viewportCoordsToSceneCoords(
          cursor.x,
          cursor.y,
          stateBefore,
          canvasRect,
        );

        // Compute new camera state
        const stateAfter = calculateZoom(cursor, targetZoom, stateBefore, canvasRect);

        // Scene coordinate under cursor AFTER zoom
        const sceneAfter = viewportCoordsToSceneCoords(
          cursor.x,
          cursor.y,
          stateAfter,
          canvasRect,
        );

        const drift = Math.hypot(sceneAfter.sceneX - sceneBefore.sceneX, sceneAfter.sceneY - sceneBefore.sceneY);
        if (drift > maxFocalDrift) {
          maxFocalDrift = drift;
        }

        // Float precision expectation: drift < 1e-6
        expect(drift).toBeLessThan(1e-6);
      }

      expect(maxFocalDrift).toBeLessThan(1e-6);
    });

    it('preserves focal anchor through 100 sequential zoom steps and reverse steps without drift', () => {
      const cursor = { x: 537.25, y: 382.11 };
      const canvasRect: DOMRectLike = { left: 64, top: 48 };

      let currentState: CoordinateTransformState = {
        zoom: { value: 1.0 },
        scrollX: 120.5,
        scrollY: -85.25,
      };

      const initialScene = viewportCoordsToSceneCoords(cursor.x, cursor.y, currentState, canvasRect);

      // Perform 50 zoom-in operations
      for (let step = 0; step < 50; step++) {
        const nextZoom = getZoomValue(currentState.zoom) * 1.05;
        const nextState = calculateZoom(cursor, nextZoom, currentState, canvasRect);
        currentState = {
          zoom: nextState.zoom,
          scrollX: nextState.scrollX,
          scrollY: nextState.scrollY,
        };

        const sceneNow = viewportCoordsToSceneCoords(cursor.x, cursor.y, currentState, canvasRect);
        expect(Math.abs(sceneNow.sceneX - initialScene.sceneX)).toBeLessThan(1e-6);
        expect(Math.abs(sceneNow.sceneY - initialScene.sceneY)).toBeLessThan(1e-6);
      }

      // Perform 50 zoom-out operations
      for (let step = 0; step < 50; step++) {
        const nextZoom = getZoomValue(currentState.zoom) / 1.05;
        const nextState = calculateZoom(cursor, nextZoom, currentState, canvasRect);
        currentState = {
          zoom: nextState.zoom,
          scrollX: nextState.scrollX,
          scrollY: nextState.scrollY,
        };

        const sceneNow = viewportCoordsToSceneCoords(cursor.x, cursor.y, currentState, canvasRect);
        expect(Math.abs(sceneNow.sceneX - initialScene.sceneX)).toBeLessThan(1e-6);
        expect(Math.abs(sceneNow.sceneY - initialScene.sceneY)).toBeLessThan(1e-6);
      }
    });

    it('maintains focal invariance under wheel zoom acceleration over 1,000 events', () => {
      const cursor = { clientX: 450, clientY: 300 };
      const canvasRect: DOMRectLike = { left: 0, top: 0 };

      let state: CoordinateTransformState = {
        zoom: { value: 1.0 },
        scrollX: 0,
        scrollY: 0,
      };

      let seed = 999;
      function nextRandom() {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      }

      for (let i = 0; i < 1000; i++) {
        const deltaY = (nextRandom() * 2 - 1) * 100; // Wheel deltas between -100 and +100
        const sceneBefore = viewportCoordsToSceneCoords(cursor.clientX, cursor.clientY, state, canvasRect);
        const nextState = calculateZoomFromWheel(cursor, deltaY, state, canvasRect);
        const sceneAfter = viewportCoordsToSceneCoords(cursor.clientX, cursor.clientY, nextState, canvasRect);

        expect(Math.abs(sceneAfter.sceneX - sceneBefore.sceneX)).toBeLessThan(1e-6);
        expect(Math.abs(sceneAfter.sceneY - sceneBefore.sceneY)).toBeLessThan(1e-6);

        state = {
          zoom: nextState.zoom,
          scrollX: nextState.scrollX,
          scrollY: nextState.scrollY,
        };
      }
    });
  });

  describe('3. Sub-Pixel Snapping Stability & Jitter Invariance', () => {
    it('is strictly idempotent across 10,000 random states and arbitrary devicePixelRatios', () => {
      const dprs = [1, 1.25, 1.333, 1.5, 2.0, 2.25, 2.5, 3.0, 4.0];

      let seed = 777;
      function nextRandom() {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      }

      for (let i = 0; i < 10_000; i++) {
        const dpr = dprs[i % dprs.length];
        const zoom = 0.1 + nextRandom() * 29.9;
        const scrollX = (nextRandom() * 2 - 1) * 10_000;
        const scrollY = (nextRandom() * 2 - 1) * 10_000;

        const state = { zoom: { value: zoom }, scrollX, scrollY };
        const snapped1 = snapScrollToDevicePixels(state, dpr);
        const snapped2 = snapScrollToDevicePixels(snapped1, dpr);

        // Idempotency: second snap must not change values
        expect(snapped2.scrollX).toBe(snapped1.scrollX);
        expect(snapped2.scrollY).toBe(snapped1.scrollY);

        // Must return identical reference for already snapped object
        expect(snapped2).toBe(snapped1);
      }
    });

    it('guarantees snapped scroll coordinates align to exact device integer pixels', () => {
      const dprs = [1, 1.5, 2.0, 3.0];

      for (const dpr of dprs) {
        for (let z = 0.5; z <= 5.0; z += 0.5) {
          for (let frac = 0.01; frac < 1.0; frac += 0.07) {
            const state = {
              zoom: { value: z },
              scrollX: 100 + frac,
              scrollY: 200 - frac,
            };

            const snapped = snapScrollToDevicePixels(state, dpr);
            const devPixelsX = snapped.scrollX * z * dpr;
            const devPixelsY = snapped.scrollY * z * dpr;

            // Physical device pixel must be within machine epsilon of an integer
            const distFromIntX = Math.abs(devPixelsX - Math.round(devPixelsX));
            const distFromIntY = Math.abs(devPixelsY - Math.round(devPixelsY));

            expect(distFromIntX).toBeLessThan(1e-10);
            expect(distFromIntY).toBeLessThan(1e-10);
          }
        }
      }
    });

    it('demonstrates monotonic translation without jitter when translating by sub-pixel fractions', () => {
      // Simulate continuous translation in 0.05px sub-pixel steps over 1,000 frames
      const dpr = 2.0;
      const zoom = 1.0;
      const subpixelStep = 0.05;
      const baseScrollX = 100.0;

      let lastSnappedX = -Infinity;

      for (let i = 0; i <= 1000; i++) {
        const rawScrollX = baseScrollX + i * subpixelStep;
        const snapped = snapScrollToDevicePixels(
          { zoom: { value: zoom }, scrollX: rawScrollX, scrollY: 0 },
          dpr,
        );

        // Monotonicity assertion: snapped value must never decrease (no backward jitter)
        expect(snapped.scrollX).toBeGreaterThanOrEqual(lastSnappedX);
        lastSnappedX = snapped.scrollX;
      }
    });

    it('demonstrates no divergence or drift under micro-oscillation translation', () => {
      // Translating back and forth around a pixel boundary must not cause cumulative drift
      const dpr = 2.0;
      const zoom = 1.0;
      const baseScroll = 50.0;

      let accumulatedScroll = baseScroll;

      for (let cycle = 0; cycle < 500; cycle++) {
        // Step forward by 0.25px
        accumulatedScroll += 0.25;
        const snapForward = snapScrollToDevicePixels(
          { zoom: { value: zoom }, scrollX: accumulatedScroll, scrollY: 0 },
          dpr,
        );
        expect(snapForward.scrollX).toBe(50.5);

        // Step back by 0.25px
        accumulatedScroll -= 0.25;
        const snapBack = snapScrollToDevicePixels(
          { zoom: { value: zoom }, scrollX: accumulatedScroll, scrollY: 0 },
          dpr,
        );
        expect(snapBack.scrollX).toBe(50.0);
      }

      expect(accumulatedScroll).toBe(baseScroll);
    });

    it('preserves pan displacement accuracy across fractional drags', () => {
      const zoom = 1.75;
      const prev = { x: 100.2, y: 200.7 };
      const curr = { x: 100.9, y: 200.1 };

      const pan = calculatePanDisplacement(prev, curr, zoom);
      const expectedDx = (100.9 - 100.2) / 1.75;
      const expectedDy = (200.1 - 200.7) / 1.75;

      expect(pan.deltaScrollX).toBeCloseTo(expectedDx, 10);
      expect(pan.deltaScrollY).toBeCloseTo(expectedDy, 10);
    });
  });

  describe('4. Adversarial Edge Cases & Boundary Resilience', () => {
    it('handles zero, negative, NaN, and infinite zooms safely without crash or NaN propagation', () => {
      const baseCanvasRect: DOMRectLike = { left: 0, top: 0, width: 800, height: 600 };

      // Zero zoom defaults safely to 1.0
      const sceneZero = viewportCoordsToSceneCoords(100, 100, { zoom: { value: 0 }, scrollX: 0, scrollY: 0 }, baseCanvasRect);
      expect(sceneZero.sceneX).toBe(100);

      // Negative zoom defaults safely to 1.0
      const sceneNeg = viewportCoordsToSceneCoords(100, 100, { zoom: { value: -5 }, scrollX: 0, scrollY: 0 }, baseCanvasRect);
      expect(sceneNeg.sceneX).toBe(100);

      // NaN zoom defaults safely to 1.0
      const sceneNaN = viewportCoordsToSceneCoords(100, 100, { zoom: { value: NaN }, scrollX: 0, scrollY: 0 }, baseCanvasRect);
      expect(sceneNaN.sceneX).toBe(100);

      // Infinite zoom defaults safely to 1.0
      const sceneInf = viewportCoordsToSceneCoords(100, 100, { zoom: { value: Infinity }, scrollX: 0, scrollY: 0 }, baseCanvasRect);
      expect(sceneInf.sceneX).toBe(100);
    });

    it('handles calculateZoom with degenerate or empty cursor objects', () => {
      const state = { zoom: { value: 1.0 }, scrollX: 100, scrollY: 100 };
      const resEmpty = calculateZoom({}, 2.0, state);
      expect(Number.isFinite(resEmpty.scrollX)).toBe(true);
      expect(Number.isFinite(resEmpty.scrollY)).toBe(true);
      expect(resEmpty.zoom.value).toBe(2.0);
    });

    it('handles getZoomToFit with inverted or zero-size bounding box', () => {
      const viewport = { width: 800, height: 600 };

      const invertedBounds = { minX: 500, minY: 400, maxX: 100, maxY: 100 };
      const resInverted = getZoomToFit(invertedBounds, viewport);
      expect(resInverted.zoom.value).toBe(1.0);
      expect(resInverted.scrollX).toBe(0);

      const zeroBounds = { minX: 100, minY: 100, maxX: 100, maxY: 100 };
      const resZero = getZoomToFit(zeroBounds, viewport);
      expect(resZero.zoom.value).toBe(1.0);
      expect(resZero.scrollX).toBe(0);
    });
  });
});
