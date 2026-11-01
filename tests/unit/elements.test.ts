import { describe, it, expect } from 'vitest';
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
import { mutateElement, newElementWith } from '../../src/element/mutateElement';
import {
  isRectangleElement,
  isDiamondElement,
  isEllipseElement,
  isLinearElement,
  isArrowElement,
  isFreeDrawElement,
  isTextElement,
  isSelectionElement,
  isNonDeletedElement,
} from '../../src/element/typeChecks';
import { DEFAULT_APP_STATE_VALUES } from '../../src/styles/theme';

describe('Excalidraw Element Factories & Integrity', () => {
  it('creates rectangle element with deterministic seed and initial version 1', () => {
    const rect = newRectangleElement({ x: 10, y: 20, width: 100, height: 80 });

    expect(rect.type).toBe('rectangle');
    expect(rect.x).toBe(10);
    expect(rect.y).toBe(20);
    expect(rect.width).toBe(100);
    expect(rect.height).toBe(80);
    expect(rect.version).toBe(1);
    expect(rect.isDeleted).toBe(false);
    expect(typeof rect.seed).toBe('number');
    expect(typeof rect.id).toBe('string');
    expect(rect.id.length).toBeGreaterThan(0);
    expect(isRectangleElement(rect)).toBe(true);
    expect(isNonDeletedElement(rect)).toBe(true);
  });

  it('creates diamond and ellipse elements with proper type discrimination', () => {
    const diamond = newDiamondElement({ x: 0, y: 0, width: 50, height: 50 });
    const ellipse = newEllipseElement({ x: 5, y: 5, width: 60, height: 40 });

    expect(isDiamondElement(diamond)).toBe(true);
    expect(isDiamondElement(ellipse)).toBe(false);
    expect(isEllipseElement(ellipse)).toBe(true);
    expect(isEllipseElement(diamond)).toBe(false);
  });

  it('creates linear elements (line and arrow) with local points array', () => {
    const line = newLineElement({ x: 0, y: 0, width: 100, height: 50 });
    const arrow = newArrowElement({ x: 50, y: 50, width: 80, height: 0 });

    expect(isLinearElement(line)).toBe(true);
    expect(isLinearElement(arrow)).toBe(true);
    expect(isArrowElement(arrow)).toBe(true);
    expect(isArrowElement(line)).toBe(false);
    expect(arrow.endArrowhead).toBe('arrow');
    expect(arrow.points.length).toBe(2);
    expect(arrow.points[0]).toEqual([0, 0]);
  });

  it('creates freehand pencil element with sample pressures', () => {
    const freedraw = newFreeDrawElement({
      x: 0,
      y: 0,
      points: [[0, 0], [10, 10], [20, 25]],
      pressures: [0.5, 0.7, 0.6],
    });

    expect(isFreeDrawElement(freedraw)).toBe(true);
    expect(freedraw.points.length).toBe(3);
    expect(freedraw.pressures.length).toBe(3);
    expect(freedraw.simulatePressure).toBe(true);
  });

  it('creates text element with font attributes and autoResize', () => {
    const textEl = newTextElement({
      x: 100,
      y: 200,
      text: 'Hello Excalidraw',
      fontSize: 24,
    });

    expect(isTextElement(textEl)).toBe(true);
    expect(textEl.text).toBe('Hello Excalidraw');
    expect(textEl.fontSize).toBe(24);
    expect(textEl.autoResize).toBe(true);
  });

  it('creates selection marquee box with default styling', () => {
    const sel = newSelectionElement({ x: 0, y: 0, width: 200, height: 150 });

    expect(isSelectionElement(sel)).toBe(true);
    expect(sel.strokeColor).toBe('#6965db');
    expect(sel.roughness).toBe(0);
  });
});

describe('Element Mutation & Immutability Patterns', () => {
  it('mutateElement updates in-place and increments version counter', () => {
    const rect = newRectangleElement({ x: 0, y: 0, width: 50, height: 50 });
    const originalVersion = rect.version;
    const originalNonce = rect.versionNonce;

    mutateElement(rect, { width: 120, height: 90 });

    expect(rect.width).toBe(120);
    expect(rect.height).toBe(90);
    expect(rect.version).toBe(originalVersion + 1);
    expect(rect.versionNonce).not.toBe(originalNonce);
  });

  it('newElementWith returns a fresh immutable clone with bumped version', () => {
    const rect = newRectangleElement({ x: 0, y: 0, width: 50, height: 50 });
    const updated = newElementWith(rect, { x: 40 });

    expect(updated).not.toBe(rect);
    expect(updated.x).toBe(40);
    expect(rect.x).toBe(0); // Original unmodified
    expect(updated.version).toBe(rect.version + 1);
  });
});

describe('AppState Defaults Integrity', () => {
  it('default AppState satisfies initial camera and tool contracts', () => {
    expect(DEFAULT_APP_STATE_VALUES.zoom.value).toBe(1.0);
    expect(DEFAULT_APP_STATE_VALUES.scrollX).toBe(0);
    expect(DEFAULT_APP_STATE_VALUES.scrollY).toBe(0);
    expect(DEFAULT_APP_STATE_VALUES.activeTool.type).toBe('selection');
    expect(DEFAULT_APP_STATE_VALUES.viewBackgroundColor).toBe('#ffffff');
    expect(DEFAULT_APP_STATE_VALUES.currentItemRoughness).toBe(1);
    expect(DEFAULT_APP_STATE_VALUES.currentItemStrokeWidth).toBe(2);
  });
});
