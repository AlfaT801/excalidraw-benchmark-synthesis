import { getStroke } from 'perfect-freehand';
import { ExcalidrawFreeDrawElement } from '../types/element';
import { ShapeCache } from './rough';

/**
 * Converts a sequence of stroke polygon outline points into an SVG Path string
 * smoothed with quadratic Bezier curves through segment midpoints.
 */
export function getSvgPathFromStroke(points: number[][]): string {
  if (!points.length) return '';
  const max = points.length - 1;

  const med = (a: number[], b: number[]) => [(a[0]! + b[0]!) / 2, (a[1]! + b[1]!) / 2];

  return points
    .reduce(
      (acc, point, i, arr) => {
        if (i === max) {
          acc.push(point, med(point, arr[0]!), 'L', arr[0]!, 'Z');
        } else {
          acc.push(point, med(point, arr[i + 1]!));
        }
        return acc;
      },
      ['M', points[0]!, 'Q'] as (string | number[])[],
    )
    .flat()
    .join(' ');
}

/**
 * Generates and caches a Path2D vector path for a FreeDraw element using perfect-freehand.
 */
export function getFreehandPath2D(element: ExcalidrawFreeDrawElement): Path2D {
  const cached = ShapeCache.get(element);
  if (cached instanceof Path2D) {
    return cached;
  }

  const inputPoints = element.simulatePressure
    ? element.points.map(([x, y]) => [x, y])
    : element.points.map(([x, y], i) => [x, y, element.pressures?.[i] ?? 0.5]);

  const strokePoints = getStroke(inputPoints, {
    size: element.strokeWidth * 4.25,
    thinning: 0.6,
    smoothing: 0.5,
    streamline: 0.45,
    simulatePressure: element.simulatePressure,
    last: true,
  });

  const pathString = getSvgPathFromStroke(strokePoints);
  const path2d = new Path2D(pathString);

  ShapeCache.set(element, path2d);
  return path2d;
}
