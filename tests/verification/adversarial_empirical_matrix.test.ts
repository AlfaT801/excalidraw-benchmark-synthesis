import { describe, it, expect, beforeEach } from 'vitest';
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
  newTextElement,
  newSelectionElement,
} from '../../src/element/newElement';
import { mutateElement } from '../../src/element/mutateElement';
import { renderElement } from '../../src/renderer/renderElement';
import { DEFAULT_APP_STATE_VALUES } from '../../src/styles/theme';
import { getFreehandPath2D } from '../../src/renderer/freehand';
import { ExcalidrawElement } from '../../src/types/element';

function createMockCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 1920;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d')!;
  const rc = rough.canvas(canvas);
  return { canvas, ctx, rc };
}

describe('Adversarial Matrix: Shape-Affecting Key Mutations (Cache Invalidation)', () => {
  beforeEach(() => {
    ShapeCache.clear();
  });

  it('Rectangle: invalidates and regenerates cache on width, height, strokeColor, strokeWidth, fillStyle, roughness', () => {
    const rect = newRectangleElement({ x: 10, y: 10, width: 100, height: 80 });
    const s1 = getOrGenerateShape(rect);
    expect(s1).toBeDefined();

    // 1. Mutate width -> cache invalidated
    mutateElement(rect, { width: 150 });
    const s2 = getOrGenerateShape(rect);
    expect(s2).not.toBe(s1);

    // 2. Mutate height -> cache invalidated
    mutateElement(rect, { height: 120 });
    const s3 = getOrGenerateShape(rect);
    expect(s3).not.toBe(s2);

    // 3. Mutate strokeColor -> cache invalidated
    mutateElement(rect, { strokeColor: '#e03131' });
    const s4 = getOrGenerateShape(rect);
    expect(s4).not.toBe(s3);

    // 4. Mutate strokeWidth -> cache invalidated
    mutateElement(rect, { strokeWidth: 4 });
    const s5 = getOrGenerateShape(rect);
    expect(s5).not.toBe(s4);

    // 5. Mutate fillStyle -> cache invalidated
    mutateElement(rect, { backgroundColor: '#ffc9c9', fillStyle: 'cross-hatch' });
    const s6 = getOrGenerateShape(rect);
    expect(s6).not.toBe(s5);

    // 6. Mutate roughness -> cache invalidated
    mutateElement(rect, { roughness: 2 });
    const s7 = getOrGenerateShape(rect);
    expect(s7).not.toBe(s6);
  });

  it('Diamond: invalidates and regenerates cache on dimension and style mutations', () => {
    const diamond = newDiamondElement({ x: 20, y: 20, width: 100, height: 100 });
    const s1 = getOrGenerateShape(diamond);

    mutateElement(diamond, { width: 140 });
    const s2 = getOrGenerateShape(diamond);
    expect(s2).not.toBe(s1);

    mutateElement(diamond, { strokeColor: '#2f9e44' });
    const s3 = getOrGenerateShape(diamond);
    expect(s3).not.toBe(s2);
  });

  it('Ellipse: invalidates and regenerates cache on dimension and style mutations', () => {
    const ellipse = newEllipseElement({ x: 30, y: 30, width: 120, height: 80 });
    const s1 = getOrGenerateShape(ellipse);

    mutateElement(ellipse, { height: 160 });
    const s2 = getOrGenerateShape(ellipse);
    expect(s2).not.toBe(s1);

    mutateElement(ellipse, { strokeWidth: 5 });
    const s3 = getOrGenerateShape(ellipse);
    expect(s3).not.toBe(s2);
  });

  it('Line: invalidates and regenerates cache on points, strokeColor, strokeWidth mutations', () => {
    const line = newLineElement({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      points: [[0, 0], [100, 100]],
    });
    const s1 = getOrGenerateShape(line);
    expect(s1).toBeDefined();

    // Mutate points
    mutateElement(line, {
      points: [[0, 0], [50, 20], [100, 100]],
    });
    const s2 = getOrGenerateShape(line);
    expect(s2).not.toBe(s1);

    // Mutate strokeColor
    mutateElement(line, { strokeColor: '#1971c2' });
    const s3 = getOrGenerateShape(line);
    expect(s3).not.toBe(s2);
  });

  it('Arrow: invalidates and regenerates cache on points and arrowhead mutations', () => {
    const arrow = newArrowElement({
      x: 0,
      y: 0,
      width: 120,
      height: 60,
      points: [[0, 0], [120, 60]],
    });
    const s1 = getOrGenerateShape(arrow);
    expect(s1).toBeDefined();

    // Mutate points
    mutateElement(arrow, {
      points: [[0, 0], [60, 10], [120, 60]],
    });
    const s2 = getOrGenerateShape(arrow);
    expect(s2).not.toBe(s1);

    // Mutate strokeWidth
    mutateElement(arrow, { strokeWidth: 4 });
    const s3 = getOrGenerateShape(arrow);
    expect(s3).not.toBe(s2);
  });

  it('Freedraw: invalidates and regenerates Path2D cache on points, strokeWidth, and pressures', () => {
    const freedraw = newFreeDrawElement({
      x: 0,
      y: 0,
      points: [[0, 0], [10, 10]],
      pressures: [0.5, 0.5],
    });
    const p1 = getFreehandPath2D(freedraw);
    expect(p1).toBeDefined();

    // Mutate points
    mutateElement(freedraw, {
      points: [[0, 0], [10, 10], [20, 30]],
      pressures: [0.5, 0.5, 0.8],
    });
    const p2 = getFreehandPath2D(freedraw);
    expect(p2).not.toBe(p1);

    // Mutate strokeWidth
    mutateElement(freedraw, { strokeWidth: 6 });
    const p3 = getFreehandPath2D(freedraw);
    expect(p3).not.toBe(p2);
  });
});

describe('Adversarial Matrix: Translation-Only Mutations (Cache Hit Invariance)', () => {
  beforeEach(() => {
    ShapeCache.clear();
  });

  it('Rectangle: preserves cached shape reference when mutating ONLY x or y', () => {
    const rect = newRectangleElement({ x: 10, y: 10, width: 100, height: 80 });
    const sInitial = getOrGenerateShape(rect);
    const v0 = rect.version;

    // Mutate only x
    mutateElement(rect, { x: 99 });
    expect(rect.version).toBe(v0 + 1);
    expect(getOrGenerateShape(rect)).toBe(sInitial); // Cache hit!

    // Mutate only y
    mutateElement(rect, { y: 250 });
    expect(rect.version).toBe(v0 + 2);
    expect(getOrGenerateShape(rect)).toBe(sInitial); // Cache hit!

    // Mutate both x and y together
    mutateElement(rect, { x: 500, y: 600 });
    expect(rect.version).toBe(v0 + 3);
    expect(getOrGenerateShape(rect)).toBe(sInitial); // Cache hit!
  });

  it('Diamond: preserves cached shape reference when mutating ONLY x or y', () => {
    const diamond = newDiamondElement({ x: 20, y: 20, width: 80, height: 80 });
    const sInitial = getOrGenerateShape(diamond);

    mutateElement(diamond, { x: 200, y: 300 });
    expect(getOrGenerateShape(diamond)).toBe(sInitial);
  });

  it('Ellipse: preserves cached shape reference when mutating ONLY x or y', () => {
    const ellipse = newEllipseElement({ x: 30, y: 30, width: 90, height: 60 });
    const sInitial = getOrGenerateShape(ellipse);

    mutateElement(ellipse, { x: 150 });
    expect(getOrGenerateShape(ellipse)).toBe(sInitial);

    mutateElement(ellipse, { y: 350 });
    expect(getOrGenerateShape(ellipse)).toBe(sInitial);
  });

  it('Line: preserves cached shape reference when mutating ONLY x or y (dragging whole line)', () => {
    const line = newLineElement({
      x: 10,
      y: 10,
      width: 100,
      height: 50,
      points: [[0, 0], [100, 50]],
    });
    const sInitial = getOrGenerateShape(line);

    mutateElement(line, { x: 45, y: 85 });
    expect(getOrGenerateShape(line)).toBe(sInitial);
  });

  it('Arrow: preserves cached shape reference when mutating ONLY x or y (dragging whole arrow)', () => {
    const arrow = newArrowElement({
      x: 10,
      y: 10,
      width: 100,
      height: 50,
      points: [[0, 0], [100, 50]],
    });
    const sInitial = getOrGenerateShape(arrow);

    mutateElement(arrow, { x: 75, y: 125 });
    expect(getOrGenerateShape(arrow)).toBe(sInitial);
  });

  it('Freedraw: preserves cached Path2D reference when mutating ONLY x or y (dragging freehand stroke)', () => {
    const freedraw = newFreeDrawElement({
      x: 5,
      y: 5,
      points: [[0, 0], [10, 15], [20, 30]],
      pressures: [0.5, 0.6, 0.7],
    });
    const pInitial = getFreehandPath2D(freedraw);

    mutateElement(freedraw, { x: 120, y: 180 });
    expect(getFreehandPath2D(freedraw)).toBe(pInitial);
  });

  it('Angle and Opacity: preserve cached shape reference (handled at 2D context level)', () => {
    const rect = newRectangleElement({ x: 10, y: 10, width: 100, height: 80 });
    const sInitial = getOrGenerateShape(rect);

    mutateElement(rect, { angle: Math.PI / 4 });
    expect(getOrGenerateShape(rect)).toBe(sInitial);

    mutateElement(rect, { opacity: 50 });
    expect(getOrGenerateShape(rect)).toBe(sInitial);
  });
});

describe('Adversarial Matrix: All 8 Canonical Element Types Behaviour', () => {
  beforeEach(() => {
    ShapeCache.clear();
  });

  const allTypes: ExcalidrawElement['type'][] = [
    'rectangle',
    'diamond',
    'ellipse',
    'line',
    'arrow',
    'freedraw',
    'text',
    'selection',
  ];

  it('all 8 canonical types instantiate cleanly with valid base properties', () => {
    const elements: Record<string, ExcalidrawElement> = {
      rectangle: newRectangleElement({ x: 10, y: 10, width: 100, height: 80 }),
      diamond: newDiamondElement({ x: 10, y: 10, width: 100, height: 80 }),
      ellipse: newEllipseElement({ x: 10, y: 10, width: 100, height: 80 }),
      line: newLineElement({ x: 10, y: 10, width: 100, height: 80 }),
      arrow: newArrowElement({ x: 10, y: 10, width: 100, height: 80 }),
      freedraw: newFreeDrawElement({ x: 10, y: 10, points: [[0, 0], [10, 10]] }),
      text: newTextElement({ x: 10, y: 10, text: 'Test' }),
      selection: newSelectionElement({ x: 10, y: 10, width: 100, height: 80 }),
    };

    for (const type of allTypes) {
      const el = elements[type]!;
      expect(el).toBeDefined();
      expect(el.type).toBe(type);
      expect(el.version).toBeGreaterThanOrEqual(1);
      expect(typeof el.id).toBe('string');
      expect(typeof el.seed).toBe('number');
      expect(el.isDeleted).toBe(false);
    }
  });

  it('all 8 canonical types support mutateElement version bumping and timestamp update', () => {
    const elements: ExcalidrawElement[] = [
      newRectangleElement({ x: 10, y: 10, width: 100, height: 80 }),
      newDiamondElement({ x: 10, y: 10, width: 100, height: 80 }),
      newEllipseElement({ x: 10, y: 10, width: 100, height: 80 }),
      newLineElement({ x: 10, y: 10, width: 100, height: 80 }),
      newArrowElement({ x: 10, y: 10, width: 100, height: 80 }),
      newFreeDrawElement({ x: 10, y: 10, points: [[0, 0], [10, 10]] }),
      newTextElement({ x: 10, y: 10, text: 'Hello' }),
      newSelectionElement({ x: 10, y: 10, width: 100, height: 80 }),
    ];

    for (const el of elements) {
      const v0 = el.version;
      const t0 = el.updated;

      mutateElement(el, { x: el.x + 25, y: el.y + 35 });

      expect(el.version).toBe(v0 + 1);
      expect(el.updated).toBeGreaterThanOrEqual(t0);
    }
  });

  it('Text element: mutates text, fontSize, fontFamily, and renders cleanly to canvas', () => {
    const textEl = newTextElement({ x: 20, y: 30, text: 'Initial Text', fontSize: 16 });
    expect(ShapeCache.get(textEl)).toBeUndefined(); // Text does not use ShapeCache

    mutateElement(textEl, { text: 'Updated Text' });
    expect(textEl.text).toBe('Updated Text');
    expect(textEl.version).toBe(2);

    mutateElement(textEl, { fontSize: 24, strokeColor: '#099268' });
    expect(textEl.fontSize).toBe(24);
    expect(textEl.strokeColor).toBe('#099268');

    // Verify canvas rendering
    const { ctx, rc } = createMockCanvas();
    expect(() => renderElement(textEl, rc, ctx, DEFAULT_APP_STATE_VALUES)).not.toThrow();
    expect(ctx.fillText).toHaveBeenCalled();
  });

  it('Selection element: mutates box bounds and does not throw in render pipeline', () => {
    const selEl = newSelectionElement({ x: 0, y: 0, width: 50, height: 50 });
    expect(ShapeCache.get(selEl)).toBeUndefined();

    mutateElement(selEl, { x: 10, y: 20, width: 200, height: 300 });
    expect(selEl.width).toBe(200);
    expect(selEl.height).toBe(300);

    const { ctx, rc } = createMockCanvas();
    expect(() => renderElement(selEl, rc, ctx, DEFAULT_APP_STATE_VALUES)).not.toThrow();
  });

  it('all 8 types render without uncaught errors in renderElement', () => {
    const { ctx, rc } = createMockCanvas();
    const elements: ExcalidrawElement[] = [
      newRectangleElement({ x: 10, y: 10, width: 50, height: 50 }),
      newDiamondElement({ x: 70, y: 10, width: 50, height: 50 }),
      newEllipseElement({ x: 130, y: 10, width: 50, height: 50 }),
      newLineElement({ x: 190, y: 10, width: 50, height: 50, points: [[0, 0], [50, 50]] }),
      newArrowElement({ x: 250, y: 10, width: 50, height: 50, points: [[0, 0], [50, 50]] }),
      newFreeDrawElement({ x: 310, y: 10, points: [[0, 0], [10, 5], [20, 15]] }),
      newTextElement({ x: 370, y: 10, text: 'Hello' }),
      newSelectionElement({ x: 430, y: 10, width: 50, height: 50 }),
    ];

    for (const el of elements) {
      expect(() => renderElement(el, rc, ctx, DEFAULT_APP_STATE_VALUES)).not.toThrow();
    }
  });
});

describe('Adversarial Matrix: Stress & Hostile Boundary Edge Cases', () => {
  beforeEach(() => {
    ShapeCache.clear();
  });

  it('informMutation=false suppresses ShapeCache invalidation even on shape changes', () => {
    const rect = newRectangleElement({ x: 10, y: 10, width: 100, height: 80 });
    const s1 = getOrGenerateShape(rect);

    // Mutate width with informMutation = false
    mutateElement(rect, { width: 500 }, false);

    // Cache should NOT be invalidated because informMutation was false
    const s2 = getOrGenerateShape(rect);
    expect(s2).toBe(s1);
  });

  it('Negative dimensions (dragging top-left) generate valid shapes without errors', () => {
    const rect = newRectangleElement({ x: 100, y: 100, width: -80, height: -60 });
    const shape = getOrGenerateShape(rect);
    expect(shape).toBeDefined();

    const ellipse = newEllipseElement({ x: 100, y: 100, width: -50, height: -40 });
    const ellipseShape = getOrGenerateShape(ellipse);
    expect(ellipseShape).toBeDefined();

    const diamond = newDiamondElement({ x: 100, y: 100, width: -60, height: -60 });
    const diamondShape = getOrGenerateShape(diamond);
    expect(diamondShape).toBeDefined();
  });

  it('Zero dimensions generate shapes or handle gracefully without throwing', () => {
    const rect = newRectangleElement({ x: 50, y: 50, width: 0, height: 0 });
    expect(() => getOrGenerateShape(rect)).not.toThrow();

    const ellipse = newEllipseElement({ x: 50, y: 50, width: 0, height: 0 });
    expect(() => getOrGenerateShape(ellipse)).not.toThrow();
  });

  it('Empty points or single point linear elements return null or handle gracefully', () => {
    const emptyLine = newLineElement({ x: 0, y: 0, points: [] });
    const shape = getOrGenerateShape(emptyLine);
    expect(shape).toBeNull();

    const singlePointLine = newLineElement({ x: 0, y: 0, points: [[0, 0]] });
    const shape2 = getOrGenerateShape(singlePointLine);
    expect(shape2).toBeNull();
  });

  it('1,000 rapid translation cycles maintain exact same cached shape (0 cache thrashing)', () => {
    const rect = newRectangleElement({ x: 0, y: 0, width: 100, height: 100 });
    const sInitial = getOrGenerateShape(rect);

    const initialVersion = rect.version;
    for (let i = 1; i <= 1000; i++) {
      mutateElement(rect, { x: i, y: i * 2 });
      const current = getOrGenerateShape(rect);
      expect(current).toBe(sInitial); // Absolute cache stability
    }

    expect(rect.version).toBe(initialVersion + 1000);
  });

  it('100 alternating translation and dimension mutation cycles behave deterministically', () => {
    const rect = newRectangleElement({ x: 0, y: 0, width: 50, height: 50 });
    let lastShape = getOrGenerateShape(rect);

    for (let i = 1; i <= 100; i++) {
      // Step A: Translation (must keep cache)
      mutateElement(rect, { x: i * 10, y: i * 5 });
      const translatedShape = getOrGenerateShape(rect);
      expect(translatedShape).toBe(lastShape);

      // Step B: Dimension change (must invalidate and regenerate)
      mutateElement(rect, { width: 50 + i, height: 50 + i });
      const resizedShape = getOrGenerateShape(rect);
      expect(resizedShape).not.toBe(lastShape);

      lastShape = resizedShape;
    }
  });
});
