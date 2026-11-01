import { describe, it, expect, beforeEach, vi } from 'vitest';
import rough from 'roughjs';
import {
  ShapeCache,
  getOrGenerateShape,
} from '../../src/renderer/rough';
import {
  newRectangleElement,
  newDiamondElement,
  newEllipseElement,
  newLineElement,
  newArrowElement,
  newFreeDrawElement,
} from '../../src/element/newElement';
import { mutateElement } from '../../src/element/mutateElement';
import { renderElement } from '../../src/renderer/renderElement';
import { DEFAULT_APP_STATE_VALUES } from '../../src/styles/theme';
import { getFreehandPath2D } from '../../src/renderer/freehand';
import { ExcalidrawElement, ExcalidrawFreeDrawElement } from '../../src/types/element';
import { Roughness } from '../../src/types/base';

function createMockCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 1920;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d')!;
  ctx.bezierCurveTo = ctx.bezierCurveTo || vi.fn();
  ctx.quadraticCurveTo = ctx.quadraticCurveTo || vi.fn();
  canvas.getContext = ((id: string) => {
    if (id === '2d') return ctx;
    return null;
  }) as any;
  const rc = rough.canvas(canvas);
  return { canvas, ctx, rc };
}

function generate1000MixedElements(): ExcalidrawElement[] {
  const COUNT_PER_TYPE = 200; // 5 types * 200 = 1,000 elements
  const elements: ExcalidrawElement[] = [];

  // 1. 200 Rectangles
  for (let i = 0; i < COUNT_PER_TYPE; i++) {
    elements.push(
      newRectangleElement(
        {
          x: (i % 20) * 50,
          y: Math.floor(i / 20) * 50,
          width: 40 + (i % 30),
          height: 30 + (i % 20),
        },
        {
          currentItemStrokeColor: i % 2 === 0 ? '#1e1e1e' : '#e03131',
          currentItemBackgroundColor: i % 3 === 0 ? '#ffc9c9' : 'transparent',
          currentItemFillStyle: i % 2 === 0 ? 'hachure' : 'solid',
          currentItemRoughness: (i % 3) as Roughness,
        },
      ),
    );
  }

  // 2. 200 Diamonds
  for (let i = 0; i < COUNT_PER_TYPE; i++) {
    elements.push(
      newDiamondElement(
        {
          x: (i % 20) * 60,
          y: Math.floor(i / 20) * 60,
          width: 50 + (i % 25),
          height: 50 + (i % 25),
        },
        {
          currentItemStrokeColor: '#2f9e44',
          currentItemRoughness: 1,
        },
      ),
    );
  }

  // 3. 200 Ellipses
  for (let i = 0; i < COUNT_PER_TYPE; i++) {
    elements.push(
      newEllipseElement(
        {
          x: (i % 20) * 55,
          y: Math.floor(i / 20) * 55,
          width: 60 + (i % 20),
          height: 40 + (i % 15),
        },
        {
          currentItemStrokeColor: '#1971c2',
          currentItemBackgroundColor: '#a5d8ff',
          currentItemFillStyle: 'cross-hatch',
        },
      ),
    );
  }

  // 4. 200 Lines and Arrows
  for (let i = 0; i < COUNT_PER_TYPE; i++) {
    if (i % 2 === 0) {
      elements.push(
        newLineElement({
          x: (i % 20) * 70,
          y: Math.floor(i / 20) * 70,
          width: 100,
          height: 50,
          points: [
            [0, 0],
            [50, 25],
            [100, 50],
          ],
        }),
      );
    } else {
      elements.push(
        newArrowElement({
          x: (i % 20) * 70,
          y: Math.floor(i / 20) * 70,
          width: 80,
          height: 60,
          points: [
            [0, 0],
            [80, 60],
          ],
        }),
      );
    }
  }

  // 5. 200 Freehand Strokes
  for (let i = 0; i < COUNT_PER_TYPE; i++) {
    const strokePoints: [number, number][] = [];
    const pressures: number[] = [];
    const numPoints = 10 + (i % 20);
    for (let p = 0; p < numPoints; p++) {
      strokePoints.push([p * 5, Math.sin(p / 3) * 20]);
      pressures.push(0.3 + 0.4 * Math.sin(p));
    }
    elements.push(
      newFreeDrawElement(
        {
          x: (i % 20) * 80,
          y: Math.floor(i / 20) * 80,
          points: strokePoints,
          pressures,
        },
        {
          currentItemStrokeWidth: 2,
        },
      ),
    );
  }

  return elements;
}

describe('Empirical Verification: 1,000 Mixed Elements Volume Benchmark with Repeated Mutations', () => {
  beforeEach(() => {
    ShapeCache.clear();
  });

  it('measures performance of repeated mutations on 1,000 mixed elements', () => {
    const elements = generate1000MixedElements();
    expect(elements.length).toBe(1000);
    const { ctx, rc } = createMockCanvas();

    const memInitial = process.memoryUsage().heapUsed;

    // 1. Initial generation (Cold cache)
    const t0 = performance.now();
    for (const el of elements) {
      if (el.type === 'freedraw') {
        getFreehandPath2D(el as ExcalidrawFreeDrawElement);
      } else {
        getOrGenerateShape(el);
      }
    }
    const coldGenDuration = performance.now() - t0;

    // 2. Initial render (Warm cache)
    const t1 = performance.now();
    for (const el of elements) {
      renderElement(el, rc, ctx, DEFAULT_APP_STATE_VALUES);
    }
    const warmRenderDuration = performance.now() - t1;

    // Snapshot cached shape references
    const cachedShapesInitial = new Map<string, unknown>();
    for (const el of elements) {
      const shape = ShapeCache.get(el);
      expect(shape).toBeDefined();
      cachedShapesInitial.set(el.id, shape);
    }

    // 3. Repeated Non-Shape Mutations (Translation: x, y updates across all 1,000 elements)
    // 5 cycles of moving elements (e.g. pan / drag selection)
    const nonShapeMutationLatencies: number[] = [];
    const nonShapeRenderLatencies: number[] = [];

    for (let cycle = 1; cycle <= 5; cycle++) {
      const tMutStart = performance.now();
      for (const el of elements) {
        mutateElement(el, { x: el.x + 5, y: el.y + 2 });
      }
      nonShapeMutationLatencies.push(performance.now() - tMutStart);

      const tRendStart = performance.now();
      for (const el of elements) {
        renderElement(el, rc, ctx, DEFAULT_APP_STATE_VALUES);
      }
      nonShapeRenderLatencies.push(performance.now() - tRendStart);

      // Verify invariant: ShapeCache MUST preserve cached shape references!
      for (const el of elements) {
        const currentShape = ShapeCache.get(el);
        const initialShape = cachedShapesInitial.get(el.id);
        expect(currentShape).toBe(initialShape); // Reference equality: NO invalidation on translation
      }
    }

    // 4. Repeated Shape-Affecting Mutations (width/height resize on shapes, points on lines/freedraw)
    // 5 cycles of resizing/updating geometry across all 1,000 elements
    const shapeMutationLatencies: number[] = [];
    const shapeRegenAndRenderLatencies: number[] = [];

    for (let cycle = 1; cycle <= 5; cycle++) {
      const prevShapes = new Map<string, unknown>();
      for (const el of elements) {
        prevShapes.set(el.id, ShapeCache.get(el));
      }

      const tMutStart = performance.now();
      for (const el of elements) {
        if (el.type === 'freedraw') {
          const freedraw = el as ExcalidrawFreeDrawElement;
          const newPoints = freedraw.points.map(([px, py]) => [px + 1, py + 1] as [number, number]);
          mutateElement(freedraw, { points: newPoints });
        } else if (el.type === 'line' || el.type === 'arrow') {
          const linear = el as any;
          const newPoints = linear.points.map(([px, py]: [number, number]) => [px + 2, py + 1]);
          mutateElement(linear, { points: newPoints, width: linear.width + 1 });
        } else {
          mutateElement(el, { width: el.width + 2, height: el.height + 1 });
        }
      }
      shapeMutationLatencies.push(performance.now() - tMutStart);

      // Verify invariant: ShapeCache MUST be invalidated immediately upon mutation
      for (const el of elements) {
        const cachedAfterMutation = ShapeCache.get(el);
        expect(cachedAfterMutation).toBeUndefined(); // Must have been deleted from cache!
      }

      const tRendStart = performance.now();
      for (const el of elements) {
        renderElement(el, rc, ctx, DEFAULT_APP_STATE_VALUES);
      }
      shapeRegenAndRenderLatencies.push(performance.now() - tRendStart);

      // Verify invariant: newly generated shapes must NOT match previous shapes
      for (const el of elements) {
        const newShape = ShapeCache.get(el);
        const prevShape = prevShapes.get(el.id);
        expect(newShape).toBeDefined();
        expect(newShape).not.toBe(prevShape);
      }
    }

    // 5. Mixed Interactive Workload (10 frames: 90% translate, 10% resize/restyle)
    const frameTimes: number[] = [];
    for (let frame = 1; frame <= 10; frame++) {
      const tFrameStart = performance.now();

      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        if (i % 10 === 0) {
          // 10% active edit
          if (el.type === 'freedraw') {
            mutateElement(el, { strokeWidth: (el.strokeWidth % 4) + 1 });
          } else {
            mutateElement(el, { width: el.width + 1 });
          }
        } else {
          // 90% pan / position update
          mutateElement(el, { x: el.x + 1, y: el.y + 1 });
        }
      }

      for (const el of elements) {
        renderElement(el, rc, ctx, DEFAULT_APP_STATE_VALUES);
      }

      frameTimes.push(performance.now() - tFrameStart);
    }

    const memFinal = process.memoryUsage().heapUsed;
    const memDeltaMB = (memFinal - memInitial) / (1024 * 1024);

    const avgNonShapeRender = nonShapeRenderLatencies.reduce((a, b) => a + b, 0) / nonShapeRenderLatencies.length;
    const avgShapeRegenRender = shapeRegenAndRenderLatencies.reduce((a, b) => a + b, 0) / shapeRegenAndRenderLatencies.length;
    const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
    const maxFrameTime = Math.max(...frameTimes);

    console.log(`\n=== EMPIRICAL 1,000 MIXED ELEMENTS MUTATION BENCHMARK RESULTS ===`);
    console.log(`- Total Elements: ${elements.length}`);
    console.log(`- Cold Generation Time: ${coldGenDuration.toFixed(2)} ms (${(coldGenDuration / 1000).toFixed(3)} ms/elem)`);
    console.log(`- Warm Render Time: ${warmRenderDuration.toFixed(2)} ms (${(warmRenderDuration / 1000).toFixed(3)} ms/elem)`);
    console.log(`- Non-Shape Mutation Time (avg): ${(nonShapeMutationLatencies.reduce((a, b) => a + b, 0) / 5).toFixed(2)} ms`);
    console.log(`- Non-Shape Warm Render Time (avg): ${avgNonShapeRender.toFixed(2)} ms`);
    console.log(`- Shape-Affecting Mutation Time (avg): ${(shapeMutationLatencies.reduce((a, b) => a + b, 0) / 5).toFixed(2)} ms`);
    console.log(`- Shape Regeneration & Render Time (avg): ${avgShapeRegenRender.toFixed(2)} ms (${(avgShapeRegenRender / 1000).toFixed(3)} ms/elem)`);
    console.log(`- Mixed Interactive Frame Time (avg 10 frames): ${avgFrameTime.toFixed(2)} ms (Max: ${maxFrameTime.toFixed(2)} ms)`);
    console.log(`- Total Heap Delta: ${memDeltaMB.toFixed(2)} MB`);
    console.log(`=================================================================\n`);

    // Clear test strong references to old shapes so V8 GC can collect invalidated shapes
    cachedShapesInitial.clear();

    // Check mock calls accumulation
    const beginPathCalls = (ctx.beginPath as any)?.mock?.calls?.length ?? 0;
    const bezierCalls = (ctx.bezierCurveTo as any)?.mock?.calls?.length ?? 0;
    console.log(`- Canvas Mock Invocations accumulated: beginPath=${beginPathCalls}, bezierCurveTo=${bezierCalls}`);

    // Call vi.clearAllMocks() to isolate Vitest mock call history from JS Heap retention
    vi.clearAllMocks();
    if (global.gc) {
      global.gc();
    }
    const memAfterMockClear = process.memoryUsage().heapUsed;
    const trueEngineHeapDeltaMB = (memAfterMockClear - memInitial) / (1024 * 1024);
    console.log(`- True Engine Heap Delta (after GC and clearing mock history): ${trueEngineHeapDeltaMB.toFixed(2)} MB`);

    // Invariants
    expect(coldGenDuration).toBeLessThan(3000);
    expect(warmRenderDuration).toBeLessThan(500);
    expect(avgNonShapeRender).toBeLessThan(100);
    expect(avgShapeRegenRender).toBeLessThan(3000);
    expect(avgFrameTime).toBeLessThan(500);
    // True engine memory retention (excluding Vitest mock call recordings when GC available)
    if (global.gc) {
      expect(trueEngineHeapDeltaMB).toBeLessThan(120);
    } else {
      expect(trueEngineHeapDeltaMB).toBeLessThan(500);
    }
  });
});
