import { RoughCanvas } from 'roughjs/bin/canvas';
import { Drawable } from 'roughjs/bin/core';
import {
  ExcalidrawElement,
  ExcalidrawFreeDrawElement,
  ExcalidrawTextElement,
} from '../types/element';
import { AppState } from '../types/state';
import { getFreehandPath2D } from './freehand';
import { getOrGenerateShape } from './rough';

/**
 * Renders an individual ExcalidrawElement into the 2D canvas context.
 * Handles element positioning, rotation, opacity, Rough.js shapes, freedraw, and text.
 */
export function renderElement(
  element: ExcalidrawElement,
  rc: RoughCanvas,
  context: CanvasRenderingContext2D,
  _appState: AppState,
): void {
  if (element.isDeleted) return;

  context.save();

  // 1. Apply element opacity
  if (element.opacity < 100) {
    context.globalAlpha = (element.opacity / 100) * context.globalAlpha;
  }

  // 2. Apply element rotation around its geometric center
  const cx = element.x + element.width / 2;
  const cy = element.y + element.height / 2;

  context.translate(cx, cy);
  if (element.angle !== 0) {
    context.rotate(element.angle);
  }
  context.translate(-cx, -cy);

  // 3. Translate to element origin
  context.translate(element.x, element.y);

  // 4. Render element according to type
  switch (element.type) {
    case 'rectangle':
    case 'ellipse':
    case 'diamond':
    case 'line':
    case 'arrow': {
      const shape = getOrGenerateShape(element);
      if (shape) {
        if (Array.isArray(shape)) {
          for (const s of shape) {
            rc.draw(s as Drawable);
          }
        } else {
          rc.draw(shape as Drawable);
        }
      }
      break;
    }

    case 'freedraw': {
      const freehand = element as ExcalidrawFreeDrawElement;
      const path2d = getFreehandPath2D(freehand);
      context.fillStyle = element.strokeColor;
      context.fill(path2d);
      break;
    }

    case 'text': {
      const textElement = element as ExcalidrawTextElement;
      context.font = `${textElement.fontSize}px sans-serif`;
      context.fillStyle = textElement.strokeColor;
      context.textBaseline = 'top';
      context.textAlign = textElement.textAlign || 'left';

      const lines = (textElement.text || '').split('\n');
      const lineHeight = textElement.fontSize * (textElement.lineHeight || 1.25);

      for (let i = 0; i < lines.length; i++) {
        let lineX = 0;
        if (textElement.textAlign === 'center') {
          lineX = textElement.width / 2;
        } else if (textElement.textAlign === 'right') {
          lineX = textElement.width;
        }
        context.fillText(lines[i]!, lineX, i * lineHeight);
      }
      break;
    }
  }

  context.restore();
}
