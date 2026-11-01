import { describe, it, expect, beforeEach, vi } from 'vitest';
import rough from 'roughjs';
import { Drawable } from 'roughjs/bin/core';
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
import { mutateElement, newElementWith } from '../../src/element/mutateElement';
import { renderElement } from '../../src/renderer/renderElement';
import { DEFAULT_APP_STATE_VALUES } from '../../src/styles/theme';
import { getFreehandPath2D } from '../../src/renderer/freehand';
import { ExcalidrawElement } from '../../src/types/element';
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

describe('Adversarial Challenge: Seed Stability Invariance', () => {
  beforeEach(() => {
    ShapeCache.clear();
  });

  it('Rough.js generates mathematically identical drawable paths for same seed across repeated calls', () => {
    const fixedSeed = 123456789;

    // Test across all Rough.js shapes
    const elementsToTest: ExcalidrawElement[] = [
      newRectangleElement({ x: 10, y: 10, width: 200, height: 100 }),
      newDiamondElement({ x: 20, y: 20, width: 150, height: 150 }),
      newEllipseElement({ x: 30, y: 30, width: 180, height: 120 }),
      newLineElement({
        x: 0,
        y: 0,
        width: 300,
        height: 200,
        points: [
          [0, 0],
          [100, 50],
          [300, 200],
        ],
      }),
      newArrowElement({
        x: 0,
        y: 0,
        width: 250,
        height: 150,
        points: [
          [0, 0],
          [250, 150],
        ],
      }),
    ];

    for (const rawEl of elementsToTest) {
      const baseEl = newElementWith(rawEl, { seed: fixedSeed });

      // 1. First generation
      ShapeCache.clear();
      const shape1 = getOrGenerateShape(baseEl);
      expect(shape1).not.toBeNull();

      // 2. Second generation after clearing cache (forcing re-generation by Rough.js with same seed)
      ShapeCache.clear();
      const shape2 = getOrGenerateShape(baseEl);
      expect(shape2).not.toBeNull();

      // Extract sets
      const sets1 = Array.isArray(shape1)
        ? shape1.map((s) => (s as Drawable).sets)
        : (shape1 as Drawable).sets;
      const sets2 = Array.isArray(shape2)
        ? shape2.map((s) => (s as Drawable).sets)
        : (shape2 as Drawable).sets;

      // Assert mathematical identity
      expect(sets1).toEqual(sets2);

      // 3. Different seed MUST produce different drawable sets (verifying seed sensitivity)
      const diffSeedEl = newElementWith(baseEl, { seed: fixedSeed + 9999 });
      ShapeCache.clear();
      const shapeDiff = getOrGenerateShape(diffSeedEl);
      const setsDiff = Array.isArray(shapeDiff)
        ? shapeDiff.map((s) => (s as Drawable).sets)
        : (shapeDiff as Drawable).sets;

      expect(sets1).not.toEqual(setsDiff);
    }
  });

  it('Rendering same element across multiple simulated frames produces identical canvas calls (no visual jitter)', () => {
    const rect = newRectangleElement({ x: 50, y: 50, width: 120, height: 80 });
    const { ctx, rc } = createMockCanvas();

    // Track calls to context
    const callsFrame1: string[] = [];
    const callsFrame2: string[] = [];

    // Intercept stroke/fill/lineTo/moveTo calls
    const originalMoveTo = ctx.moveTo;
    const originalLineTo = ctx.lineTo;

    ctx.moveTo = (...args: [number, number]) => {
      callsFrame1.push(`moveTo(${args[0].toFixed(2)},${args[1].toFixed(2)})`);
      originalMoveTo?.apply(ctx, args);
    };
    ctx.lineTo = (...args: [number, number]) => {
      callsFrame1.push(`lineTo(${args[0].toFixed(2)},${args[1].toFixed(2)})`);
      originalLineTo?.apply(ctx, args);
    };

    renderElement(rect, rc, ctx, DEFAULT_APP_STATE_VALUES);

    // Second frame
    ctx.moveTo = (...args: [number, number]) => {
      callsFrame2.push(`moveTo(${args[0].toFixed(2)},${args[1].toFixed(2)})`);
      originalMoveTo?.apply(ctx, args);
    };
    ctx.lineTo = (...args: [number, number]) => {
      callsFrame2.push(`lineTo(${args[0].toFixed(2)},${args[1].toFixed(2)})`);
      originalLineTo?.apply(ctx, args);
    };

    renderElement(rect, rc, ctx, DEFAULT_APP_STATE_VALUES);

    expect(callsFrame1.length).toBeGreaterThan(0);
    expect(callsFrame1).toEqual(callsFrame2);
  });

  it('Freehand stroke generation produces identical path strings for identical input points', () => {
    const inputPoints: [number, number][] = [
      [10, 10],
      [20, 30],
      [40, 60],
      [80, 120],
      [100, 140],
    ];

    const freedraw1 = newFreeDrawElement({
      x: 0,
      y: 0,
      points: inputPoints,
      pressures: [0.5, 0.6, 0.7, 0.8, 0.5],
    });

    const freedraw2 = newFreeDrawElement({
      x: 0,
      y: 0,
      points: inputPoints,
      pressures: [0.5, 0.6, 0.7, 0.8, 0.5],
    });

    const path1 = getFreehandPath2D(freedraw1);
    const path2 = getFreehandPath2D(freedraw2);

    expect(path1).toBeDefined();
    expect(path2).toBeDefined();
    expect(path1).not.toBe(path2); // Distinct Path2D objects
    expect((path1 as unknown as { d: string }).d).toEqual(
      (path2 as unknown as { d: string }).d,
    );
  });
});

describe('Adversarial Challenge: Mutation Cache Invalidation', () => {
  beforeEach(() => {
    ShapeCache.clear();
  });

  it('reuses cached shape when element is unchanged', () => {
    const rect = newRectangleElement({ x: 10, y: 10, width: 100, height: 80 });
    const shape1 = getOrGenerateShape(rect);
    const shape2 = getOrGenerateShape(rect);

    expect(shape1).toBeDefined();
    expect(shape2).toBe(shape1); // Reference equality: cache hit
  });

  it('regenerates shape in ShapeCache when mutateElement is called with new dimensions', () => {
    const rect = newRectangleElement({ x: 10, y: 10, width: 100, height: 80 });
    const shape1 = getOrGenerateShape(rect);
    expect(shape1).toBeDefined();

    const initialVersion = rect.version;

    // Mutate element in place with new dimensions
    mutateElement(rect, { width: 300, height: 250 });

    // Invariant 1: version must be incremented
    expect(rect.version).toBe(initialVersion + 1);

    // Invariant 2: ShapeCache must regenerate the shape (NOT return stale shape1)
    const shape2 = getOrGenerateShape(rect);
    expect(shape2).toBeDefined();
    expect(shape2).not.toBe(shape1); // MUST NOT return the stale cached shape
  });

  it('regenerates shape in ShapeCache when mutateElement updates stroke or fill styles', () => {
    const rect = newRectangleElement(
      { x: 10, y: 10, width: 100, height: 80 },
      { currentItemStrokeColor: '#000000' },
    );
    const shape1 = getOrGenerateShape(rect);

    // Mutate strokeColor and strokeWidth
    mutateElement(rect, { strokeColor: '#ff0000', strokeWidth: 5 });

    const shape2 = getOrGenerateShape(rect);
    expect(shape2).not.toBe(shape1); // MUST NOT return stale shape with black stroke
  });

  it('regenerates Path2D in ShapeCache when mutateElement updates freehand points', () => {
    const freedraw = newFreeDrawElement({
      x: 0,
      y: 0,
      points: [
        [0, 0],
        [10, 10],
      ],
      pressures: [0.5, 0.5],
    });

    const path1 = getFreehandPath2D(freedraw);

    // Mutate freedraw points during drawing
    mutateElement(freedraw, {
      points: [
        [0, 0],
        [10, 10],
        [20, 25],
        [30, 45],
      ],
      pressures: [0.5, 0.5, 0.6, 0.7],
    });

    const path2 = getFreehandPath2D(freedraw);
    expect(path2).not.toBe(path1); // MUST NOT return stale 2-point path
  });

  it('preserves cached shape when mutateElement is called with identical values (no-op mutation)', () => {
    const rect = newRectangleElement({ x: 10, y: 10, width: 100, height: 80 });
    const shape1 = getOrGenerateShape(rect);
    const initialVersion = rect.version;

    // Mutate with same values
    mutateElement(rect, { width: 100, height: 80 });

    expect(rect.version).toBe(initialVersion); // Version should NOT bump on no-op
    const shape2 = getOrGenerateShape(rect);
    expect(shape2).toBe(shape1); // Should preserve cache on no-op
  });

  it('newElementWith produces a new object reference and fresh shape', () => {
    const rect = newRectangleElement({ x: 10, y: 10, width: 100, height: 80 });
    const shape1 = getOrGenerateShape(rect);

    const updatedRect = newElementWith(rect, { width: 400 });
    const shape2 = getOrGenerateShape(updatedRect);

    expect(shape2).toBeDefined();
    expect(shape2).not.toBe(shape1);
  });
});

describe('Adversarial Challenge: Stress Test 1,000 Mixed Elements Volume Benchmark', () => {
  beforeEach(() => {
    ShapeCache.clear();
  });

  it('generates and renders 1,000 mixed elements without crashes, memory spikes, or execution stalls', () => {
    const COUNT_PER_TYPE = 200; // 5 types * 200 = 1,000 elements
    const elements: ExcalidrawElement[] = [];

    // 1. Generate 200 Rectangles
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

    // 2. Generate 200 Diamonds
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

    // 3. Generate 200 Ellipses
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

    // 4. Generate 200 Lines and Arrows
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

    // 5. Generate 200 Freehand Strokes
    for (let i = 0; i < COUNT_PER_TYPE; i++) {
      const strokePoints: [number, number][] = [];
      const pressures: number[] = [];
      const numPoints = 10 + (i % 20); // 10 to 30 points per stroke
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

    expect(elements.length).toBe(1000);

    // Track memory before benchmark
    const memBefore = process.memoryUsage().heapUsed;

    // Phase 1: Shape Generation Benchmark (Cold Cache)
    const tGenStart = performance.now();
    for (const el of elements) {
      if (el.type === 'freedraw') {
        getFreehandPath2D(el);
      } else {
        const shape = getOrGenerateShape(el);
        expect(shape).not.toBeNull();
      }
    }
    const tGenEnd = performance.now();
    const generationDurationMs = tGenEnd - tGenStart;

    // Phase 2: Canvas Rendering Benchmark (Warm Cache)
    const { ctx, rc } = createMockCanvas();

    const tRenderStart = performance.now();
    for (const el of elements) {
      renderElement(el, rc, ctx, DEFAULT_APP_STATE_VALUES);
    }
    const tRenderEnd = performance.now();
    const warmRenderDurationMs = tRenderEnd - tRenderStart;

    // Phase 3: Second Render Pass (Validating throughput stability)
    const tRender2Start = performance.now();
    for (const el of elements) {
      renderElement(el, rc, ctx, DEFAULT_APP_STATE_VALUES);
    }
    const tRender2End = performance.now();
    const warmRender2DurationMs = tRender2End - tRender2Start;

    // Track memory after benchmark
    const memAfter = process.memoryUsage().heapUsed;
    const memDeltaMB = (memAfter - memBefore) / (1024 * 1024);

    console.log(`[STRESS TEST EMPIRICAL BENCHMARK: 1,000 MIXED ELEMENTS]`);
    console.log(`- Total elements: ${elements.length}`);
    console.log(`- Cold generation time: ${generationDurationMs.toFixed(2)} ms (${(generationDurationMs / 1000).toFixed(3)} ms/element)`);
    console.log(`- Warm render 1 time: ${warmRenderDurationMs.toFixed(2)} ms (${(warmRenderDurationMs / 1000).toFixed(3)} ms/element)`);
    console.log(`- Warm render 2 time: ${warmRender2DurationMs.toFixed(2)} ms (${(warmRender2DurationMs / 1000).toFixed(3)} ms/element)`);
    console.log(`- Heap memory delta: ${memDeltaMB.toFixed(2)} MB`);

    // Performance & Stability Assertions:
    // Generation of 1,000 shapes should take < 3000ms
    expect(generationDurationMs).toBeLessThan(3000);
    // Rendering with warm cache of 1,000 shapes should take < 500ms
    expect(warmRenderDurationMs).toBeLessThan(500);
    // Memory delta for 1,000 shapes should be bounded (< 50MB)
    expect(memDeltaMB).toBeLessThan(50);
  });
});
