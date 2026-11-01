import {
  ExcalidrawElement,
  ExcalidrawRectangleElement,
  ExcalidrawDiamondElement,
  ExcalidrawEllipseElement,
  ExcalidrawLinearElement,
  ExcalidrawLineElement,
  ExcalidrawArrowElement,
  ExcalidrawFreeDrawElement,
  ExcalidrawTextElement,
  ExcalidrawSelectionElement,
  NonDeletedExcalidrawElement,
} from '../types/element';

export function isRectangleElement(
  element: ExcalidrawElement,
): element is ExcalidrawRectangleElement {
  return element.type === 'rectangle';
}

export function isDiamondElement(
  element: ExcalidrawElement,
): element is ExcalidrawDiamondElement {
  return element.type === 'diamond';
}

export function isEllipseElement(
  element: ExcalidrawElement,
): element is ExcalidrawEllipseElement {
  return element.type === 'ellipse';
}

export function isLinearElement(
  element: ExcalidrawElement,
): element is ExcalidrawLinearElement {
  return element.type === 'line' || element.type === 'arrow';
}

export function isLineElement(
  element: ExcalidrawElement,
): element is ExcalidrawLineElement {
  return element.type === 'line';
}

export function isArrowElement(
  element: ExcalidrawElement,
): element is ExcalidrawArrowElement {
  return element.type === 'arrow';
}

export function isFreeDrawElement(
  element: ExcalidrawElement,
): element is ExcalidrawFreeDrawElement {
  return element.type === 'freedraw';
}

export function isTextElement(
  element: ExcalidrawElement,
): element is ExcalidrawTextElement {
  return element.type === 'text';
}

export function isSelectionElement(
  element: ExcalidrawElement,
): element is ExcalidrawSelectionElement {
  return element.type === 'selection';
}

export function isNonDeletedElement(
  element: ExcalidrawElement,
): element is NonDeletedExcalidrawElement {
  return !element.isDeleted;
}
