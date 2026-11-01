import { describe, it, expect } from 'vitest';
import {
  ShapeCache,
  getOrGenerateShape,
  adjustRoughness,
  generator,
  getRoughOptions,
} from '../../src/renderer/rough';
import { getFreehandPath2D, getSvgPathFromStroke } from '../../src/renderer/freehand';
import { newRectangleElement, newFreeDrawElement } from '../../src/element/newElement';
import { Drawable } from 'roughjs/bin/core';

describe('Renderer Engine: Rough.js & ShapeCache', () => {
  it('memoizes generated shape in ShapeCache on identical element reference', () => {
    ShapeCache.clear();
    const rect = newRectangleElement({ x: 10, y: 10, width: 100, height: 80 });

    const shape1 = getOrGenerateShape(rect);
    const shape2 = getOrGenerateShape(rect);

    expect(shape1).toBeDefined();
    expect(shape2).toBe(shape1); // Strict object equality from WeakMap hit

    expect(ShapeCache.get(rect)).toBe(shape1);
    ShapeCache.delete(rect);
    expect(ShapeCache.get(rect)).toBeUndefined();
  });

  it('generates a new shape when element is cloned with new dimensions', () => {
    const rect = newRectangleElement({ x: 10, y: 10, width: 100, height: 80 });
    const shape1 = getOrGenerateShape(rect);

    const clonedRect = { ...rect, width: 250 };
    const shape2 = getOrGenerateShape(clonedRect);

    expect(shape2).toBeDefined();
    expect(shape2).not.toBe(shape1);
  });

  it('produces identical rough operations for same seed (seed determinism)', () => {
    const seed = 987654321;
    const opt = { seed, roughness: 1, stroke: '#1e1e1e', strokeWidth: 2 };

    const d1 = generator.rectangle(0, 0, 100, 100, opt);
    const d2 = generator.rectangle(0, 0, 100, 100, opt);

    expect((d1 as Drawable).sets).toEqual((d2 as Drawable).sets);
  });

  it('adjustRoughness reduces roughness for small dimensions', () => {
    expect(adjustRoughness({ width: 100, height: 80, roughness: 1 })).toBe(1);
    expect(adjustRoughness({ width: 8, height: 8, roughness: 1 })).toBeLessThan(1);
  });

  it('derives rough options including stroke and fill styles', () => {
    const rect = newRectangleElement({ x: 0, y: 0, width: 50, height: 50 }, {
      currentItemBackgroundColor: '#ffc9c9',
      currentItemFillStyle: 'cross-hatch',
      currentItemStrokeStyle: 'dashed',
    });

    const opts = getRoughOptions(rect);
    expect(opts.fill).toBe('#ffc9c9');
    expect(opts.fillStyle).toBe('cross-hatch');
    expect(opts.strokeLineDash).toEqual([8, 8]);
  });
});

describe('Renderer Engine: Freehand Stroke & Path2D', () => {
  it('converts stroke points into quadratic Bezier SVG path string', () => {
    const strokePoints = [
      [0, 0],
      [10, 5],
      [20, 15],
      [30, 20],
    ];

    const pathString = getSvgPathFromStroke(strokePoints);
    expect(pathString.startsWith('M 0 0 Q')).toBe(true);
    expect(pathString.endsWith('Z')).toBe(true);
  });

  it('generates and caches Path2D for freedraw elements', () => {
    const freedraw = newFreeDrawElement({
      x: 0,
      y: 0,
      points: [[0, 0], [15, 20], [30, 45], [50, 70]],
      pressures: [0.5, 0.6, 0.7, 0.5],
    });

    const path1 = getFreehandPath2D(freedraw);
    const path2 = getFreehandPath2D(freedraw);

    expect(path1).toBeDefined();
    expect(path2).toBe(path1); // Memoized
  });
});
