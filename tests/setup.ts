import '@testing-library/jest-dom';
import { vi } from 'vitest';

// ============================================================================
// 1. Path2D Mock Polyfill for Headless Node / JSDOM Environment
// ============================================================================
class MockPath2D {
  d: string;

  constructor(d?: string | MockPath2D) {
    if (typeof d === 'string') {
      this.d = d;
    } else if (d instanceof MockPath2D) {
      this.d = d.d;
    } else {
      this.d = '';
    }
  }

  addPath = vi.fn();
  closePath = vi.fn();
  moveTo = vi.fn();
  lineTo = vi.fn();
  bezierCurveTo = vi.fn();
  quadraticCurveTo = vi.fn();
  arc = vi.fn();
  arcTo = vi.fn();
  ellipse = vi.fn();
  rect = vi.fn();
  roundRect = vi.fn();
}

// Bind to both window and globalThis for browser and node context accessibility
if (typeof window !== 'undefined' && !window.Path2D) {
  (window as unknown as { Path2D: unknown }).Path2D = MockPath2D;
}
if (typeof globalThis !== 'undefined' && !globalThis.Path2D) {
  (globalThis as unknown as { Path2D: unknown }).Path2D = MockPath2D;
}

// ============================================================================
// 2. Factory for CanvasRenderingContext2D Mock
// ============================================================================
function createMockContext2D(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  let lineDash: number[] = [];

  const ctx = {
    canvas,

    // State Stack & Canvas Reset
    save: vi.fn(),
    restore: vi.fn(),
    reset: vi.fn(),

    // Coordinate Transformations
    scale: vi.fn(),
    rotate: vi.fn(),
    translate: vi.fn(),
    transform: vi.fn(),
    setTransform: vi.fn(),
    resetTransform: vi.fn(),
    getTransform: vi.fn(() => ({
      a: 1, b: 0, c: 0, d: 1, e: 0, f: 0,
      m11: 1, m12: 0, m13: 0, m14: 0,
      m21: 0, m22: 1, m23: 0, m24: 0,
      m31: 0, m32: 0, m33: 1, m34: 0,
      m41: 0, m42: 0, m43: 0, m44: 1,
      is2D: true,
      isIdentity: true,
      inverse: vi.fn(),
      multiply: vi.fn(),
      rotateAxisAngle: vi.fn(),
      rotate: vi.fn(),
      scale3d: vi.fn(),
      scale: vi.fn(),
      translate: vi.fn(),
      transformPoint: vi.fn(),
      toFloat32Array: vi.fn(),
      toFloat64Array: vi.fn(),
    })),

    // Path Creation & Segment Commands
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    arc: vi.fn(),
    arcTo: vi.fn(),
    ellipse: vi.fn(),
    rect: vi.fn(),
    roundRect: vi.fn(),

    // Drawing, Stroke, Fill & Clip Operations
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    clip: vi.fn(),

    // Hit Testing
    isPointInPath: vi.fn(() => false),
    isPointInStroke: vi.fn(() => false),

    // Text Rendering & Font Metrics
    fillText: vi.fn(),
    strokeText: vi.fn(),
    measureText: vi.fn((text: string) => ({
      width: text.length * 8,
      actualBoundingBoxAscent: 10,
      actualBoundingBoxDescent: 3,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: text.length * 8,
      fontBoundingBoxAscent: 10,
      fontBoundingBoxDescent: 3,
      emHeightAscent: 10,
      emHeightDescent: 3,
      hangingBaseline: 8,
      alphabeticBaseline: 0,
      ideographicBaseline: -2,
    })),

    // Line Styles & Dash Segments
    lineWidth: 1,
    lineCap: 'butt' as CanvasLineCap,
    lineJoin: 'miter' as CanvasLineJoin,
    miterLimit: 10,
    lineDashOffset: 0,
    setLineDash: vi.fn((segments: number[]) => {
      lineDash = [...segments];
    }),
    getLineDash: vi.fn(() => [...lineDash]),

    // Colors, Gradients & Patterns
    fillStyle: '#000000',
    strokeStyle: '#000000',
    createLinearGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    createConicGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    createPattern: vi.fn(() => ({
      setTransform: vi.fn(),
    })),

    // Typography Properties
    font: '10px sans-serif',
    textAlign: 'start' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    direction: 'inherit' as CanvasDirection,

    // Compositing & CSS Filters
    globalAlpha: 1.0,
    globalCompositeOperation: 'source-over' as GlobalCompositeOperation,
    filter: 'none',

    // Shadows
    shadowBlur: 0,
    shadowColor: 'rgba(0, 0, 0, 0)',
    shadowOffsetX: 0,
    shadowOffsetY: 0,

    // Image Smoothing
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'low' as ImageSmoothingQuality,

    // Bitmaps, Images & Pixels
    drawImage: vi.fn(),
    getImageData: vi.fn((_sx: number, _sy: number, sw = 1, sh = 1) => ({
      width: sw,
      height: sh,
      data: new Uint8ClampedArray(sw * sh * 4),
      colorSpace: 'srgb' as PredefinedColorSpace,
    })),
    putImageData: vi.fn(),
    createImageData: vi.fn((sw = 1, sh = 1) => ({
      width: sw,
      height: sh,
      data: new Uint8ClampedArray(sw * sh * 4),
      colorSpace: 'srgb' as PredefinedColorSpace,
    })),
  };

  return ctx as unknown as CanvasRenderingContext2D;
}

// ============================================================================
// 3. HTMLCanvasElement Prototype Extensions & Idempotent Context Caching
// ============================================================================
if (typeof window !== 'undefined' && typeof HTMLCanvasElement !== 'undefined') {
  const contextMap = new WeakMap<HTMLCanvasElement, CanvasRenderingContext2D>();

  // Use standard function definition to ensure 'this' binds to the HTMLCanvasElement instance
  HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation(function (
    this: HTMLCanvasElement,
    contextId: string,
  ) {
    if (contextId === '2d') {
      let ctx = contextMap.get(this);
      if (!ctx) {
        ctx = createMockContext2D(this);
        contextMap.set(this, ctx);
      }
      return ctx;
    }
    return null;
  });

  HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue('data:image/png;base64,mock');
  HTMLCanvasElement.prototype.toBlob = vi.fn().mockImplementation(function (
    this: HTMLCanvasElement,
    callback: BlobCallback,
    type = 'image/png',
  ) {
    callback(new Blob(['mock-blob-content'], { type }));
  });
}
