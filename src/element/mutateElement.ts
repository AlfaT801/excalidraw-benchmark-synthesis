import { ExcalidrawElement } from '../types/element';
import { randomInteger } from './newElement';
import { ShapeCache } from '../renderer/rough';

/**
 * Element properties that alter the visual shape geometry or style.
 * Modifications to these keys require invalidating the cached Rough.js Drawable
 * or perfect-freehand Path2D in ShapeCache.
 *
 * Position (x, y), angle, and opacity are excluded because they are handled
 * at the canvas 2D context transformation level without regenerating shape paths.
 */
const SHAPE_AFFECTING_KEYS = new Set<string>([
  'type',
  'width',
  'height',
  'strokeColor',
  'backgroundColor',
  'fillStyle',
  'strokeWidth',
  'strokeStyle',
  'roughness',
  'seed',
  'roundness',
  'points',
  'pressures',
  'simulatePressure',
  'strokeOptions',
  'startArrowhead',
  'endArrowhead',
]);

/**
 * Mutates an element in-place during active user interaction (drag, resize).
 * Bumps the revision version and updates the timestamp.
 * Invalidates ShapeCache when geometric or styling attributes change.
 */
export function mutateElement<T extends ExcalidrawElement>(
  element: T,
  updates: Partial<T>,
  informMutation: boolean = true,
): T {
  let hasChanges = false;
  let hasShapeChanges = false;

  for (const [key, value] of Object.entries(updates)) {
    if ((element as Record<string, unknown>)[key] !== value) {
      (element as Record<string, unknown>)[key] = value;
      hasChanges = true;
      if (SHAPE_AFFECTING_KEYS.has(key)) {
        hasShapeChanges = true;
      }
    }
  }

  if (hasChanges) {
    (element as { version: number }).version += 1;
    (element as { versionNonce: number }).versionNonce = randomInteger();
    (element as { updated: number }).updated = Date.now();

    if (informMutation && hasShapeChanges) {
      ShapeCache.delete(element);
    }
  }

  return element;
}

/**
 * Returns a new immutable copy of an element with given updates applied.
 * Used for committed scene transitions and undo/redo stacks.
 */
export function newElementWith<T extends ExcalidrawElement>(
  element: T,
  updates: Partial<T>,
): T {
  const version = updates.version ?? element.version + 1;
  const versionNonce = updates.versionNonce ?? randomInteger();
  const updated = Date.now();

  return {
    ...element,
    ...updates,
    version,
    versionNonce,
    updated,
  };
}
