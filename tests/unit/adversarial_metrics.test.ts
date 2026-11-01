import { describe, it } from 'vitest';
import {
  viewportCoordsToSceneCoords,
  sceneCoordsToViewportCoords,
  snapScrollToDevicePixels,
  CoordinateTransformState,
  DOMRectLike,
} from '../../src/math/coordinates';
import {
  calculateZoom,
  MIN_ZOOM,
  MAX_ZOOM,
} from '../../src/math/zoom';

describe('Empirical Verification Harness & Metric Collector', () => {
  it('collects empirical statistical metrics for coordinate & camera math', () => {
    // 1. Roundtrip Invertibility: 100,000 fuzz samples
    const TOTAL_SAMPLES = 100_000;
    const sceneErrors: number[] = new Float64Array(TOTAL_SAMPLES) as unknown as number[];
    const viewportErrors: number[] = new Float64Array(TOTAL_SAMPLES) as unknown as number[];

    let seed = 42;
    function nextRandom() {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    }

    const startRoundtrip = performance.now();
    for (let i = 0; i < TOTAL_SAMPLES; i++) {
      const zoom = Math.pow(10, nextRandom() * 4 - 2); // 0.01x to 100x
      const scrollX = (nextRandom() * 2 - 1) * 1e7;
      const scrollY = (nextRandom() * 2 - 1) * 1e7;
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
      };

      // Scene -> Viewport -> Scene
      const origSceneX = (nextRandom() * 2 - 1) * 1e7;
      const origSceneY = (nextRandom() * 2 - 1) * 1e7;
      const vp = sceneCoordsToViewportCoords(origSceneX, origSceneY, state, canvasRect);
      const recSc = viewportCoordsToSceneCoords(vp.viewportX, vp.viewportY, state, canvasRect);
      const errSc = Math.max(Math.abs(recSc.sceneX - origSceneX), Math.abs(recSc.sceneY - origSceneY));
      sceneErrors[i] = errSc;

      // Viewport -> Scene -> Viewport
      const origVpX = (nextRandom() * 2 - 1) * 1e6;
      const origVpY = (nextRandom() * 2 - 1) * 1e6;
      const sc = viewportCoordsToSceneCoords(origVpX, origVpY, state, canvasRect);
      const recVp = sceneCoordsToViewportCoords(sc.sceneX, sc.sceneY, state, canvasRect);
      const errVp = Math.max(Math.abs(recVp.viewportX - origVpX), Math.abs(recVp.viewportY - origVpY));
      viewportErrors[i] = errVp;
    }
    const elapsedRoundtrip = performance.now() - startRoundtrip;

    // Sort to compute percentiles
    sceneErrors.sort((a, b) => a - b);
    viewportErrors.sort((a, b) => a - b);

    const getStats = (arr: number[]) => {
      const min = arr[0];
      const max = arr[arr.length - 1];
      const p50 = arr[Math.floor(arr.length * 0.5)];
      const p95 = arr[Math.floor(arr.length * 0.95)];
      const p99 = arr[Math.floor(arr.length * 0.99)];
      const p999 = arr[Math.floor(arr.length * 0.999)];
      const sum = arr.reduce((acc, v) => acc + v, 0);
      const mean = sum / arr.length;
      return { min, max, mean, p50, p95, p99, p999 };
    };

    const scStats = getStats(sceneErrors);
    const vpStats = getStats(viewportErrors);

    // 2. Cursor Focal Anchor Invariance: 10,000 steps
    const FOCAL_SAMPLES = 10_000;
    const focalDrifts: number[] = new Float64Array(FOCAL_SAMPLES) as unknown as number[];

    const startFocal = performance.now();
    for (let i = 0; i < FOCAL_SAMPLES; i++) {
      const zCurr = MIN_ZOOM + nextRandom() * (MAX_ZOOM - MIN_ZOOM);
      const zTarget = MIN_ZOOM + nextRandom() * (MAX_ZOOM - MIN_ZOOM);
      const cursor = {
        x: (nextRandom() * 2 - 1) * 3000,
        y: (nextRandom() * 2 - 1) * 3000,
      };
      const canvasRect: DOMRectLike = {
        left: (nextRandom() * 2 - 1) * 500,
        top: (nextRandom() * 2 - 1) * 500,
      };
      const stateBefore = {
        zoom: { value: zCurr },
        scrollX: (nextRandom() * 2 - 1) * 50_000,
        scrollY: (nextRandom() * 2 - 1) * 50_000,
      };

      const ptBefore = viewportCoordsToSceneCoords(cursor.x, cursor.y, stateBefore, canvasRect);
      const stateAfter = calculateZoom(cursor, zTarget, stateBefore, canvasRect);
      const ptAfter = viewportCoordsToSceneCoords(cursor.x, cursor.y, stateAfter, canvasRect);

      focalDrifts[i] = Math.hypot(ptAfter.sceneX - ptBefore.sceneX, ptAfter.sceneY - ptBefore.sceneY);
    }
    const elapsedFocal = performance.now() - startFocal;

    focalDrifts.sort((a, b) => a - b);
    const focalStats = getStats(focalDrifts);

    // 3. Sub-Pixel Snapping Alignment & Monotonicity
    const DPR_SAMPLES = 10_000;
    const dprs = [1.0, 1.25, 1.333, 1.5, 2.0, 2.5, 3.0, 4.0];
    let maxPixelAlignDist = 0;
    let idempotencyFailures = 0;

    for (let i = 0; i < DPR_SAMPLES; i++) {
      const dpr = dprs[i % dprs.length];
      const zoom = 0.1 + nextRandom() * 29.9;
      const scrollX = (nextRandom() * 2 - 1) * 10_000;
      const scrollY = (nextRandom() * 2 - 1) * 10_000;

      const state = { zoom: { value: zoom }, scrollX, scrollY };
      const snapped1 = snapScrollToDevicePixels(state, dpr);
      const snapped2 = snapScrollToDevicePixels(snapped1, dpr);

      if (snapped1.scrollX !== snapped2.scrollX || snapped1.scrollY !== snapped2.scrollY) {
        idempotencyFailures++;
      }

      const devPixelsX = snapped1.scrollX * zoom * dpr;
      const distFromIntX = Math.abs(devPixelsX - Math.round(devPixelsX));
      if (distFromIntX > maxPixelAlignDist) maxPixelAlignDist = distFromIntX;
    }

    // Monotonic translation jitter test
    let jitterCount = 0;
    let lastSnap = -Infinity;
    for (let i = 0; i < 10_000; i++) {
      const x = 100.0 + i * 0.01;
      const s = snapScrollToDevicePixels({ zoom: { value: 1.5 }, scrollX: x, scrollY: 0 }, 2.0);
      if (s.scrollX < lastSnap) {
        jitterCount++;
      }
      lastSnap = s.scrollX;
    }

    // Print JSON output for reporting
    const metrics = {
      roundtrip: {
        totalSamples: TOTAL_SAMPLES,
        elapsedMs: elapsedRoundtrip,
        opsPerSec: Math.round((TOTAL_SAMPLES / elapsedRoundtrip) * 1000),
        sceneErrors: scStats,
        viewportErrors: vpStats,
      },
      focalZoom: {
        totalSamples: FOCAL_SAMPLES,
        elapsedMs: elapsedFocal,
        driftStats: focalStats,
      },
      subPixelSnapping: {
        totalSamples: DPR_SAMPLES,
        idempotencyFailures,
        maxPixelAlignDist,
        jitterCount,
      },
    };

    console.log('=== EMPIRICAL MEASUREMENT METRICS START ===');
    console.log(JSON.stringify(metrics, null, 2));
    console.log('=== EMPIRICAL MEASUREMENT METRICS END ===');
  });
});
