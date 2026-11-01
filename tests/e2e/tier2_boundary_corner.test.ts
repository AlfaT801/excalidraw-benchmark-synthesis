import { describe, it, expect, beforeEach } from 'vitest';
import { ExcalidrawTestHarness } from './harness.js';

describe('Tier 2: Boundary & Corner Cases (Adversarial Edge Testing)', () => {
  let harness: ExcalidrawTestHarness;

  beforeEach(() => {
    harness = ExcalidrawTestHarness.create();
  });

  // =========================================================================
  // Feature 2: Project Scaffold & Core Data Types (Corner Cases)
  // =========================================================================
  describe('Feature 2: Core Data Types - Boundary Conditions', () => {
    it('normalizes negative width and height when dragged backwards', () => {
      harness.selectTool('rectangle');
      // Drag from (200, 200) backwards to (50, 80)
      harness.drag({ x: 200, y: 200 }, { x: 50, y: 80 });

      const el = harness.getElements()[0];
      expect(el.x).toBe(50);
      expect(el.y).toBe(80);
      expect(el.width).toBe(150);
      expect(el.height).toBe(120);
    });

    it('clamps extreme opacity values strictly to [0, 100]', () => {
      harness.selectTool('rectangle');
      harness.drag({ x: 0, y: 0 }, { x: 50, y: 50 });

      harness.setOpacity(-50);
      expect(harness.getElements()[0].opacity).toBe(0);

      harness.setOpacity(999);
      expect(harness.getElements()[0].opacity).toBe(100);
    });

    it('handles zero-dimension elements without crash', () => {
      harness.selectTool('rectangle');
      harness.drag({ x: 100, y: 100 }, { x: 100, y: 100 }); // 0x0

      const el = harness.getElements()[0];
      expect(el.width).toBe(0);
      expect(el.height).toBe(0);
      const bounds = harness.getElementBounds(el);
      expect(bounds).toEqual([100, 100, 100, 100]);
    });

    it('increments version monotonically and regenerates versionNonce on each edit', () => {
      harness.selectTool('rectangle');
      harness.drag({ x: 0, y: 0 }, { x: 40, y: 40 });
      const el = harness.getElements()[0];

      const v1 = el.version;
      const n1 = el.versionNonce;

      harness.setStrokeWidth(4);
      expect(el.version).toBeGreaterThan(v1);
      expect(el.versionNonce).not.toBe(n1);
    });

    it('preserves immutable created timestamp across modifications and history', () => {
      harness.selectTool('rectangle');
      harness.drag({ x: 10, y: 10 }, { x: 50, y: 50 });
      const initialCreated = harness.getElements()[0].created;

      harness.setStrokeWidth(5);
      harness.undo();
      harness.redo();

      expect(harness.getElements()[0].created).toBe(initialCreated);
    });
  });

  // =========================================================================
  // Feature 3: Coordinate Transform & Camera System (Boundary Cases)
  // =========================================================================
  describe('Feature 3: Coordinate Transform - Boundary Conditions', () => {
    it('clamps negative or zero zoom values to minimum threshold (0.1x)', () => {
      const focal = { x: 100, y: 100 };
      const { zoom } = harness.calculateFocalZoom(focal, -5.0);
      expect(zoom.value).toBe(0.1);

      const zeroZoom = harness.calculateFocalZoom(focal, 0);
      expect(zeroZoom.zoom.value).toBe(0.1);
    });

    it('clamps extreme zoom-in values to maximum threshold (30.0x)', () => {
      const focal = { x: 200, y: 200 };
      const { zoom } = harness.calculateFocalZoom(focal, 100.0);
      expect(zoom.value).toBe(30.0);
    });

    it('handles non-finite NaN zoom requests gracefully by defaulting to 1.0x', () => {
      const focal = { x: 100, y: 100 };
      const { zoom } = harness.calculateFocalZoom(focal, NaN);
      expect(zoom.value).toBe(1.0);
    });

    it('preserves coordinate precision under extreme pan offsets (100,000 px)', () => {
      harness.wheel(-100000, -200000); // Massive pan
      const state = harness.getAppState();
      expect(state.scrollX).toBe(100000);
      expect(state.scrollY).toBe(200000);

      const scene = harness.viewportCoordsToSceneCoords(500, 500);
      const viewport = harness.sceneCoordsToViewportCoords(scene.sceneX, scene.sceneY);
      expect(viewport.viewportX).toBeCloseTo(500, 1);
      expect(viewport.viewportY).toBeCloseTo(500, 1);
    });

    it('handles 0x0 viewport dimensions gracefully without division by zero', () => {
      harness.setViewportSize(0, 0);
      const state = harness.getAppState();
      expect(state.width).toBe(0);
      expect(state.height).toBe(0);

      // Coordinate transforms must still produce numeric values
      const { sceneX, sceneY } = harness.viewportCoordsToSceneCoords(0, 0);
      expect(Number.isFinite(sceneX)).toBe(true);
      expect(Number.isFinite(sceneY)).toBe(true);
    });
  });

  // =========================================================================
  // Feature 4: Multi-Layer Canvas Architecture (Boundary Cases)
  // =========================================================================
  describe('Feature 4: Multi-Layer Canvas - Boundary Conditions', () => {
    it('renders empty canvas without error when elements array is empty', () => {
      harness.setViewportSize(800, 600);
      const log = harness.getLatestRenderLog();
      expect(log).not.toBeNull();
      expect(log?.renderedElementCount).toBe(0);
      expect(log?.commands).toHaveLength(0);
    });

    it('handles heavy load of 1,000 elements in render snapshot', () => {
      for (let i = 0; i < 1000; i++) {
        harness.selectTool('rectangle');
        harness.drag({ x: i, y: i }, { x: i + 10, y: i + 10 });
      }

      const log = harness.getLatestRenderLog();
      expect(log?.renderedElementCount).toBe(1000);
      expect(log?.commands).toHaveLength(1000);
    });

    it('dispatches rapid consecutive canvas resize cycles', () => {
      const resolutions = [
        [320, 240],
        [640, 480],
        [1024, 768],
        [1920, 1080],
        [3840, 2160],
      ];
      for (const [w, h] of resolutions) {
        harness.setViewportSize(w, h);
        const log = harness.getLatestRenderLog();
        expect(log?.width).toBe(w);
        expect(log?.height).toBe(h);
      }
    });

    it('retains high DPI devicePixelRatio scaling (3.0 for retina display)', () => {
      harness.setViewportSize(1200, 800, 3.0);
      expect(harness.getAppState().devicePixelRatio).toBe(3.0);
    });

    it('isolates interactive draft rendering without committing to elements list', () => {
      harness.selectTool('rectangle');
      harness.pointerDown(50, 50);
      harness.pointerMove(100, 100);

      // During active drag, element is not yet committed to elements array
      expect(harness.getElements()).toHaveLength(0);

      harness.pointerUp();
      // Only upon pointerUp is it committed
      expect(harness.getElements()).toHaveLength(1);
    });
  });

  // =========================================================================
  // Feature 5: Rough.js Shape Generation (Boundary Cases)
  // =========================================================================
  describe('Feature 5: Rough.js Shape Generation - Boundary Conditions', () => {
    it('creates micro 1x1 rectangle with valid bounding envelope', () => {
      harness.selectTool('rectangle');
      harness.drag({ x: 50, y: 50 }, { x: 51, y: 51 });

      const el = harness.getElements()[0];
      expect(el.width).toBe(1);
      expect(el.height).toBe(1);
      expect(harness.getElementBounds(el)).toEqual([50, 50, 51, 51]);
    });

    it('handles zero-length line where start and end points coincide', () => {
      harness.selectTool('line');
      harness.drag({ x: 100, y: 100 }, { x: 100, y: 100 });

      const el = harness.getElements()[0];
      expect(el.points).toEqual([[0, 0], [0, 0]]);
      expect(harness.getElementBounds(el)).toEqual([100, 100, 100, 100]);
    });

    it('handles zero-dimension flat ellipse without numerical error', () => {
      harness.selectTool('ellipse');
      harness.drag({ x: 200, y: 200 }, { x: 300, y: 200 }); // height = 0

      const el = harness.getElements()[0];
      expect(el.height).toBe(0);
      // Hit test should safely return false without division by zero
      expect(harness.hitTest(el, 250, 200)).toBe(false);
    });

    it('creates arrow with identical start and end points without throwing', () => {
      harness.selectTool('arrow');
      harness.drag({ x: 150, y: 150 }, { x: 150, y: 150 });

      const el = harness.getElements()[0];
      expect(el.type).toBe('arrow');
      expect(el.points).toEqual([[0, 0], [0, 0]]);
    });

    it('enforces roughness levels strictly between [0, 3]', () => {
      harness.setRoughness(-10);
      expect(harness.getAppState().currentItemRoughness).toBe(0);

      harness.setRoughness(10);
      expect(harness.getAppState().currentItemRoughness).toBe(3);
    });
  });

  // =========================================================================
  // Feature 6: Freehand (Pencil) Drawing Engine (Boundary Cases)
  // =========================================================================
  describe('Feature 6: Freehand Engine - Boundary Conditions', () => {
    it('creates single-point freehand click with valid points array', () => {
      harness.selectTool('freedraw');
      harness.click(100, 100);

      const el = harness.getElements()[0];
      expect(el.type).toBe('freedraw');
      expect(el.points).toEqual([[0, 0]]);
    });

    it('clamps extreme pressure samples safely to [0, 1]', () => {
      harness.selectTool('freedraw');
      harness.pointerDown(10, 10, { pressure: 0.0 });
      harness.pointerMove(20, 20, { pressure: 1.0 });
      harness.pointerUp();

      const el = harness.getElements()[0];
      expect(el.pressures).toEqual([0.0, 1.0]);
    });

    it('computes exact bounding envelope for a 500-point dense curve', () => {
      harness.selectTool('freedraw');
      harness.pointerDown(0, 0);
      for (let i = 1; i <= 500; i++) {
        harness.pointerMove(Math.sin(i / 10) * 100, Math.cos(i / 10) * 50);
      }
      harness.pointerUp();

      const el = harness.getElements()[0];
      expect(el.points?.length).toBe(501);
      const bounds = harness.getElementBounds(el);
      expect(bounds[0]).toBeLessThanOrEqual(0);
      expect(bounds[2]).toBeGreaterThanOrEqual(50);
    });

    it('hit-tests successfully on closed loop freehand stroke', () => {
      harness.selectTool('freedraw');
      // Draw circular loop: (50,50) -> (100,50) -> (100,100) -> (50,100) -> (50,50)
      harness.pointerDown(50, 50);
      harness.pointerMove(100, 50);
      harness.pointerMove(100, 100);
      harness.pointerMove(50, 100);
      harness.pointerMove(50, 50);
      harness.pointerUp();

      const el = harness.getElements()[0];
      expect(harness.hitTest(el, 50, 50)).toBe(true);
      expect(harness.hitTest(el, 100, 75)).toBe(true);
    });

    it('handles empty points array without error in bounds calculation', () => {
      harness.selectTool('freedraw');
      harness.click(50, 50);
      const el = harness.getElements()[0];
      el.points = [];

      const bounds = harness.getElementBounds(el);
      expect(Number.isFinite(bounds[0])).toBe(true);
    });
  });

  // =========================================================================
  // Feature 7: Text Element & In-Place Editor (Boundary Cases)
  // =========================================================================
  describe('Feature 7: Text Element - Boundary Conditions', () => {
    it('discards text inputs containing only newlines and whitespace', () => {
      harness.selectTool('text');
      harness.click(50, 50);
      harness.typeText('\n\n   \n\t  ');
      harness.commitTextEditor();

      expect(harness.getElements()).toHaveLength(0);
    });

    it('renders multi-byte Unicode, symbols, and emoji strings accurately', () => {
      harness.selectTool('text');
      harness.click(100, 100);
      const unicodeString = '🚀 Excalidraw Clone 🎨 日本語テスト — 100% ✨';
      harness.typeText(unicodeString);
      harness.commitTextEditor();

      const el = harness.getElements()[0];
      expect(el.text).toBe(unicodeString);
      expect(el.width).toBeGreaterThan(100);
    });

    it('clamps font sizes strictly between minimum 4 and maximum 200', () => {
      harness.setFontSize(1);
      expect(harness.getAppState().currentItemFontSize).toBe(4);

      harness.setFontSize(500);
      expect(harness.getAppState().currentItemFontSize).toBe(200);
    });

    it('calculates proportional box dimensions for a 1,000-character paragraph', () => {
      harness.selectTool('text');
      harness.click(0, 0);
      const longText = 'A'.repeat(1000);
      harness.typeText(longText);
      harness.commitTextEditor();

      const el = harness.getElements()[0];
      expect(el.width).toBeGreaterThanOrEqual(1000 * 20 * 0.5);
    });

    it('preserves line breaks in multi-line text input', () => {
      harness.selectTool('text');
      harness.click(20, 20);
      harness.typeText('Line 1\nLine 2\nLine 3');
      harness.commitTextEditor();

      const el = harness.getElements()[0];
      expect(el.text).toBe('Line 1\nLine 2\nLine 3');
    });
  });

  // =========================================================================
  // Feature 8: Hit Testing & Selection (Boundary Cases)
  // =========================================================================
  describe('Feature 8: Hit Testing - Boundary Conditions', () => {
    it('detects hit at exact vertex perimeter coordinates', () => {
      harness.setBackgroundColor('#ff0000');
      harness.selectTool('rectangle');
      harness.drag({ x: 100, y: 100 }, { x: 200, y: 200 });
      const el = harness.getElements()[0];

      // Exact top-left corner
      expect(harness.hitTest(el, 100, 100)).toBe(true);
      // Exact bottom-right corner
      expect(harness.hitTest(el, 200, 200)).toBe(true);
    });

    it('detects hit on rotated shape corner at 45 degrees', () => {
      harness.setBackgroundColor('#ff0000');
      harness.selectTool('rectangle');
      harness.drag({ x: 100, y: 100 }, { x: 200, y: 200 });
      harness.rotateSelected(Math.PI / 4); // 45 deg

      const el = harness.getElements()[0];
      // Center (150, 150) must remain hit
      expect(harness.hitTest(el, 150, 150)).toBe(true);
    });

    it('handles negative scene coordinates during hit testing', () => {
      harness.setBackgroundColor('#ff0000');
      harness.selectTool('rectangle');
      harness.drag({ x: -200, y: -200 }, { x: -100, y: -100 });
      const el = harness.getElements()[0];

      expect(harness.hitTest(el, -150, -150)).toBe(true);
      expect(harness.hitTest(el, 0, 0)).toBe(false);
    });

    it('expands hit tolerance threshold dynamically when zoomed out to 0.1x', () => {
      harness.setBackgroundColor('transparent');
      harness.selectTool('rectangle');
      harness.drag({ x: 100, y: 100 }, { x: 200, y: 200 });
      const el = harness.getElements()[0];

      // Zoom out to 0.1x
      const { zoom } = harness.calculateFocalZoom({ x: 0, y: 0 }, 0.1);
      (harness.getAppState() as any).zoom = zoom;

      // At 0.1x, tolerance = 10 / 0.1 = 100px!
      // A point 30px away from the boundary should hit!
      expect(harness.hitTest(el, 70, 150)).toBe(true);
    });

    it('narrows hit tolerance threshold dynamically when zoomed in to 10.0x', () => {
      harness.setBackgroundColor('transparent');
      harness.selectTool('rectangle');
      harness.drag({ x: 100, y: 100 }, { x: 200, y: 200 });
      const el = harness.getElements()[0];

      // Zoom in to 10.0x
      const { zoom } = harness.calculateFocalZoom({ x: 0, y: 0 }, 10.0);
      (harness.getAppState() as any).zoom = zoom;

      // At 10x, tolerance = 10 / 10 = 1px!
      // A point 5px away should NOT hit!
      expect(harness.hitTest(el, 95, 150)).toBe(false);
    });
  });

  // =========================================================================
  // Feature 9: Manipulation & Transform Handles (Boundary Cases)
  // =========================================================================
  describe('Feature 9: Manipulation - Boundary Conditions', () => {
    it('prevents drag manipulation of locked elements', () => {
      harness.setBackgroundColor('#00ff00');
      harness.selectTool('rectangle');
      harness.drag({ x: 50, y: 50 }, { x: 100, y: 100 });
      const el = harness.getElements()[0];
      el.locked = true;

      harness.selectTool('selection');
      harness.drag({ x: 75, y: 75 }, { x: 200, y: 200 });

      // Position must remain completely unchanged
      expect(el.x).toBe(50);
      expect(el.y).toBe(50);
    });

    it('wraps rotation angle modulo 2*PI when rotated beyond full circle', () => {
      harness.selectTool('rectangle');
      harness.drag({ x: 100, y: 100 }, { x: 200, y: 200 });

      // Rotate by 5*PI (2.5 turns)
      harness.rotateSelected(5 * Math.PI);
      const el = harness.getElements()[0];
      expect(el.angle).toBeCloseTo(Math.PI, 3);
    });

    it('snaps rotation angle to 15-degree increments when shift key is active', () => {
      harness.selectTool('rectangle');
      harness.drag({ x: 100, y: 100 }, { x: 200, y: 200 });

      // Rotate by 17 degrees (~0.2967 rad) with snap = true
      harness.rotateSelected(0.2967, true);
      const el = harness.getElements()[0];
      // Must snap to 15 degrees = Math.PI / 12
      expect(el.angle).toBeCloseTo(Math.PI / 12, 3);
    });

    it('handles negative resize dimensions gracefully', () => {
      harness.selectTool('rectangle');
      harness.drag({ x: 50, y: 50 }, { x: 150, y: 150 });
      harness.resizeSelected(-50, -80);

      const el = harness.getElements()[0];
      expect(el.width).toBe(-50);
      expect(el.height).toBe(-80);
      const bounds = harness.getElementBounds(el);
      expect(bounds).toEqual([0, -30, 50, 50]);
    });

    it('omits transform handles entirely for freehand and linear elements', () => {
      harness.selectTool('freedraw');
      harness.drag({ x: 10, y: 10 }, { x: 50, y: 50 });
      const freeEl = harness.getElements()[0];
      expect(harness.getTransformHandles(freeEl)).toBeNull();

      harness.selectTool('line');
      harness.drag({ x: 60, y: 60 }, { x: 100, y: 100 });
      const lineEl = harness.getElements()[1];
      expect(harness.getTransformHandles(lineEl)).toBeNull();
    });
  });

  // =========================================================================
  // Feature 10: Eraser Tool (Boundary Cases)
  // =========================================================================
  describe('Feature 10: Eraser Tool - Boundary Conditions', () => {
    it('executes without error when clicking empty canvas space with eraser', () => {
      harness.selectTool('eraser');
      expect(() => harness.click(500, 500)).not.toThrow();
    });

    it('does not double-delete an already deleted tombstone element', () => {
      harness.setBackgroundColor('#ff0000');
      harness.selectTool('rectangle');
      harness.drag({ x: 50, y: 50 }, { x: 100, y: 100 });

      harness.selectTool('eraser');
      harness.click(75, 75);
      const versionAfterFirstErase = harness.getElements()[0].version;

      // Click again at same coordinates
      harness.click(75, 75);
      expect(harness.getElements()[0].version).toBe(versionAfterFirstErase);
    });

    it('protects locked elements from drag-eraser destruction', () => {
      harness.setBackgroundColor('#00ff00');
      harness.selectTool('rectangle');
      harness.drag({ x: 50, y: 50 }, { x: 90, y: 90 });
      harness.getElements()[0].locked = true;

      harness.selectTool('eraser');
      harness.drag({ x: 20, y: 70 }, { x: 120, y: 70 });

      expect(harness.getElements()[0].isDeleted).toBe(false);
      expect(harness.getNonDeletedElements()).toHaveLength(1);
    });

    it('erases 20 densely overlapping elements in a single sweep', () => {
      for (let i = 0; i < 20; i++) {
        harness.setBackgroundColor('#0000ff');
        harness.selectTool('rectangle');
        harness.drag({ x: i * 10, y: 50 }, { x: i * 10 + 20, y: 90 });
      }
      expect(harness.getNonDeletedElements()).toHaveLength(20);

      harness.selectTool('eraser');
      harness.drag({ x: 0, y: 70 }, { x: 250, y: 70 }, 25);

      expect(harness.getNonDeletedElements()).toHaveLength(0);
    });

    it('correctly transforms eraser coordinates during zoomed-in state', () => {
      harness.setBackgroundColor('#ffff00');
      harness.selectTool('rectangle');
      harness.drag({ x: 100, y: 100 }, { x: 200, y: 200 });

      // Zoom in 2x with focal point at (150, 150)
      const { zoom, scrollX, scrollY } = harness.calculateFocalZoom({ x: 150, y: 150 }, 2.0);
      (harness.getAppState() as any).zoom = zoom;
      (harness.getAppState() as any).scrollX = scrollX;
      (harness.getAppState() as any).scrollY = scrollY;

      // Click center of shape in viewport space
      const vp = harness.sceneCoordsToViewportCoords(150, 150);
      harness.selectTool('eraser');
      harness.click(vp.viewportX, vp.viewportY);

      expect(harness.getNonDeletedElements()).toHaveLength(0);
    });
  });

  // =========================================================================
  // Feature 11: Toolbar & Styling Controls (Boundary Cases)
  // =========================================================================
  describe('Feature 11: Styling Controls - Boundary Conditions', () => {
    it('clamps strokeWidth strictly to minimum 1 on zero or negative values', () => {
      harness.setStrokeWidth(0);
      expect(harness.getAppState().currentItemStrokeWidth).toBe(1);

      harness.setStrokeWidth(-10);
      expect(harness.getAppState().currentItemStrokeWidth).toBe(1);
    });

    it('supports all strokeStyle values: solid, dashed, dotted', () => {
      const styles = ['solid', 'dashed', 'dotted'] as const;
      for (const st of styles) {
        harness.setStrokeStyle(st);
        expect(harness.getAppState().currentItemStrokeStyle).toBe(st);
      }
    });

    it('applies batch styling changes to all multi-selected elements simultaneously', () => {
      harness.selectTool('rectangle');
      harness.drag({ x: 0, y: 0 }, { x: 40, y: 40 });
      harness.selectTool('rectangle');
      harness.drag({ x: 50, y: 0 }, { x: 90, y: 40 });

      // Select all via shortcut
      harness.pressShortcut('Ctrl+A');
      expect(harness.getSelectedElements()).toHaveLength(2);

      harness.setStrokeColor('#7950f2');
      harness.setStrokeWidth(8);

      const elements = harness.getElements();
      expect(elements[0].strokeColor).toBe('#7950f2');
      expect(elements[1].strokeColor).toBe('#7950f2');
      expect(elements[0].strokeWidth).toBe(8);
      expect(elements[1].strokeWidth).toBe(8);
    });

    it('maintains custom styling defaults across tool switches', () => {
      harness.setStrokeColor('#e64980');
      harness.setFillStyle('zigzag');

      harness.selectTool('rectangle');
      harness.selectTool('diamond');
      harness.selectTool('ellipse');

      expect(harness.getAppState().currentItemStrokeColor).toBe('#e64980');
      expect(harness.getAppState().currentItemFillStyle).toBe('zigzag');
    });

    it('handles rapid alternating tool selection without state drift', () => {
      const sequence = ['rectangle', 'diamond', 'ellipse', 'line', 'arrow', 'freedraw', 'text'] as const;
      for (let i = 0; i < 49; i++) {
        harness.selectTool(sequence[i % sequence.length]);
      }
      expect(harness.getAppState().activeTool.type).toBe('text');
    });
  });

  // =========================================================================
  // Feature 12: History Management (Undo/Redo) (Boundary Cases)
  // =========================================================================
  describe('Feature 12: History Management - Boundary Conditions', () => {
    it('returns false when undo is attempted on empty undoStack', () => {
      expect(harness.undo()).toBe(false);
      expect(harness.getElements()).toHaveLength(0);
    });

    it('returns false when redo is attempted on empty redoStack', () => {
      expect(harness.redo()).toBe(false);
    });

    it('stress tests 30 consecutive alternating undo and redo cycles', () => {
      harness.selectTool('rectangle');
      harness.drag({ x: 10, y: 10 }, { x: 50, y: 50 });

      for (let i = 0; i < 30; i++) {
        const u = harness.undo();
        expect(u).toBe(true);
        expect(harness.getElements()).toHaveLength(0);

        const r = harness.redo();
        expect(r).toBe(true);
        expect(harness.getElements()).toHaveLength(1);
      }
    });

    it('preserves redo stack when canvas deselection occurs without mutation', () => {
      harness.selectTool('rectangle');
      harness.drag({ x: 0, y: 0 }, { x: 30, y: 30 });
      harness.undo();
      expect(harness.getHistoryDepth().redo).toBe(1);

      // Deselect via Escape
      harness.pressShortcut('Escape');
      // Redo stack must be preserved!
      expect(harness.getHistoryDepth().redo).toBe(1);
      expect(harness.redo()).toBe(true);
    });

    it('tracks element group memberships accurately across undo and redo', () => {
      harness.selectTool('rectangle');
      harness.drag({ x: 0, y: 0 }, { x: 20, y: 20 });
      harness.selectTool('rectangle');
      harness.drag({ x: 30, y: 0 }, { x: 50, y: 20 });

      harness.pressShortcut('Ctrl+A');
      const groupId = harness.groupSelected();
      expect(groupId).not.toBeNull();

      harness.undo();
      expect(harness.getElements()[0].groupIds).toEqual([]);

      harness.redo();
      expect(harness.getElements()[0].groupIds).toContain(groupId);
    });
  });

  // =========================================================================
  // Feature 13: LocalStorage Persistence (Boundary Cases)
  // =========================================================================
  describe('Feature 13: LocalStorage - Boundary Conditions', () => {
    it('handles corrupted JSON payload in local storage gracefully without throwing', () => {
      harness.injectCorruptLocalStorage('excalidraw', '{corrupted:invalid');
      const loaded = harness.loadFromLocalStorage();
      expect(loaded).toBe(false);
    });

    it('handles empty local storage gracefully without errors', () => {
      (harness as any).localStorageStore = {};
      expect(harness.loadFromLocalStorage()).toBe(false);
      expect(harness.getElements()).toHaveLength(0);
    });

    it('persists and restores multi-element scenes with full fidelity', () => {
      harness.selectTool('rectangle');
      harness.drag({ x: 10, y: 10 }, { x: 40, y: 40 });
      harness.selectTool('ellipse');
      harness.drag({ x: 50, y: 50 }, { x: 90, y: 90 });

      const newHarness = ExcalidrawTestHarness.create();
      (newHarness as any).localStorageStore = { ...(harness as any).localStorageStore };

      expect(newHarness.loadFromLocalStorage()).toBe(true);
      expect(newHarness.getElements()).toHaveLength(2);
      expect(newHarness.getElements()[0].type).toBe('rectangle');
      expect(newHarness.getElements()[1].type).toBe('ellipse');
    });

    it('retains viewBackgroundColor in storage across save/load cycle', () => {
      harness.setViewBackgroundColor('#343a40');

      const newHarness = ExcalidrawTestHarness.create();
      (newHarness as any).localStorageStore = { ...(harness as any).localStorageStore };
      newHarness.loadFromLocalStorage();

      expect(newHarness.getAppState().viewBackgroundColor).toBe('#343a40');
    });

    it('filters out locked state and transient editor pointers from storage', () => {
      harness.selectTool('rectangle');
      harness.drag({ x: 0, y: 0 }, { x: 50, y: 50 });
      harness.openTextEditor(100, 100);

      const dump = harness.getLocalStorageDump();
      expect(dump.appState.textEditorOverlay).toBeUndefined();
      expect(dump.appState.draftElement).toBeUndefined();
    });
  });

  // =========================================================================
  // Feature 14: Export Engine (JSON & PNG) (Boundary Cases)
  // =========================================================================
  describe('Feature 14: Export Engine - Boundary Conditions', () => {
    it('exports empty canvas to valid schema with empty elements array', () => {
      const json = harness.exportToJSON();
      const parsed = JSON.parse(json);
      expect(parsed.elements).toEqual([]);
      expect(parsed.type).toBe('excalidraw');
      expect(parsed.version).toBe(2);
    });

    it('exports scene with negative scene coordinates accurately', () => {
      harness.selectTool('rectangle');
      harness.drag({ x: -500, y: -300 }, { x: -400, y: -200 });

      const json = harness.exportToJSON();
      const parsed = JSON.parse(json);
      expect(parsed.elements[0].x).toBe(-500);
      expect(parsed.elements[0].y).toBe(-300);
    });

    it('rejects import of JSON with wrong type identifier', () => {
      const invalidPayload = JSON.stringify({
        type: 'drawio',
        version: 1,
        elements: [],
      });
      expect(harness.importFromJSON(invalidPayload)).toBe(false);
    });

    it('rejects import of non-JSON string gracefully', () => {
      expect(harness.importFromJSON('<<<MALFORMED XML>>>')).toBe(false);
    });

    it('exports empty scene to minimum 100x100 default fallback canvas', () => {
      const canvasResult = harness.exportToCanvas();
      expect(canvasResult.width).toBe(100);
      expect(canvasResult.height).toBe(100);
      expect(canvasResult.elementCount).toBe(0);
    });
  });
});
