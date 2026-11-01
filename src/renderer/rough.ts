import rough from 'roughjs';
import { Drawable, Options } from 'roughjs/bin/core';
import { ExcalidrawElement, ExcalidrawLinearElement } from '../types/element';

export const generator = rough.generator();

export class ShapeCache {
  private static cache = new WeakMap<ExcalidrawElement, Drawable | Drawable[] | Path2D>();

  public static get(element: ExcalidrawElement): Drawable | Drawable[] | Path2D | undefined {
    return this.cache.get(element);
  }

  public static set(element: ExcalidrawElement, shape: Drawable | Drawable[] | Path2D): void {
    this.cache.set(element, shape);
  }

  public static delete(element: ExcalidrawElement): void {
    this.cache.delete(element);
  }

  public static clear(): void {
    this.cache = new WeakMap();
  }
}

export function adjustRoughness(element: { width: number; height: number; roughness: number }): number {
  const maxSize = Math.max(Math.abs(element.width), Math.abs(element.height));
  const minSize = Math.min(Math.abs(element.width), Math.abs(element.height));

  if (minSize >= 20 && maxSize >= 50) {
    return element.roughness;
  }
  return Math.min(element.roughness / (maxSize < 10 ? 3 : 2), 2.5);
}

export function getRoughOptions(element: ExcalidrawElement): Options {
  const options: Options = {
    seed: element.seed,
    stroke: element.strokeColor,
    strokeWidth: element.strokeWidth,
    roughness: adjustRoughness(element),
  };

  if (element.backgroundColor && element.backgroundColor !== 'transparent') {
    options.fill = element.backgroundColor;
    options.fillStyle = element.fillStyle;
    options.fillWeight = Math.max(0.5, element.strokeWidth / 2);
    options.hachureGap = Math.max(4, element.strokeWidth * 4);
  }

  if (element.strokeStyle === 'dashed') {
    options.strokeLineDash = [8, 8];
  } else if (element.strokeStyle === 'dotted') {
    options.strokeLineDash = [2, 4];
  }

  return options;
}

/**
 * Calculates arrowhead polygon at the terminal point of an arrow.
 */
function generateArrowhead(
  element: ExcalidrawLinearElement,
  options: Options,
): Drawable | null {
  const points = element.points;
  if (!points || points.length < 2) return null;

  const [p1x, p1y] = points[points.length - 2]!;
  const [p2x, p2y] = points[points.length - 1]!;

  const angle = Math.atan2(p2y - p1y, p2x - p1x);
  const size = Math.max(15, element.strokeWidth * 6);

  const leftX = p2x - size * Math.cos(angle - Math.PI / 6);
  const leftY = p2y - size * Math.sin(angle - Math.PI / 6);
  const rightX = p2x - size * Math.cos(angle + Math.PI / 6);
  const rightY = p2y - size * Math.sin(angle + Math.PI / 6);

  return generator.polygon(
    [
      [p2x, p2y],
      [leftX, leftY],
      [rightX, rightY],
    ],
    {
      ...options,
      fill: element.strokeColor,
      fillStyle: 'solid',
    },
  );
}

/**
 * Generates or retrieves cached Rough.js Drawable for geometric and linear elements.
 */
export function getOrGenerateShape(
  element: ExcalidrawElement,
): Drawable | Drawable[] | Path2D | null {
  const cached = ShapeCache.get(element);
  if (cached) {
    return cached;
  }

  const options = getRoughOptions(element);
  let shape: Drawable | Drawable[] | null = null;

  switch (element.type) {
    case 'rectangle': {
      shape = generator.rectangle(0, 0, element.width, element.height, options);
      break;
    }
    case 'ellipse': {
      shape = generator.ellipse(
        element.width / 2,
        element.height / 2,
        Math.abs(element.width),
        Math.abs(element.height),
        options,
      );
      break;
    }
    case 'diamond': {
      const w = element.width;
      const h = element.height;
      shape = generator.polygon(
        [
          [w / 2, 0],
          [w, h / 2],
          [w / 2, h],
          [0, h / 2],
        ],
        options,
      );
      break;
    }
    case 'line': {
      const linear = element as ExcalidrawLinearElement;
      if (linear.points && linear.points.length >= 2) {
        shape = generator.linearPath(linear.points as [number, number][], options);
      }
      break;
    }
    case 'arrow': {
      const linear = element as ExcalidrawLinearElement;
      if (linear.points && linear.points.length >= 2) {
        const lineDrawable = generator.linearPath(linear.points as [number, number][], options);
        const arrowheads = generateArrowhead(linear, options);
        shape = arrowheads ? [lineDrawable, arrowheads] : lineDrawable;
      }
      break;
    }
    default:
      return null;
  }

  if (shape) {
    ShapeCache.set(element, shape);
  }
  return shape;
}

export const generateShape = getOrGenerateShape;
