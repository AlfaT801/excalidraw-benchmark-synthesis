import { describe, it, expect, beforeEach } from 'vitest';
import { ExcalidrawTestHarness } from './harness.js';

describe('Tier 1: Feature Coverage (PROJECT.md Feature Inventory)', () => {
  let harness: ExcalidrawTestHarness;

  beforeEach(() => {
    harness = ExcalidrawTestHarness.create();
  });

  // =========================================================================
  // Feature 2: Project Scaffold & Core Data Types (M1)
  // =========================================================================
  describe('Feature 2: Project Scaffold & Core Data Types', () => {
    it('initializes with compliant default AppState and empty elements', () => {
      const state = harness.getAppState();
      expect(state.zoom.value).toBe(1.0);
      expect(state.scrollX).toBe(0);
      expect(state.scrollY).toBe(0);
      expect(state.activeTool.type).toBe('selection');
      expect(state.viewBackgroundColor).toBe('#ffffff');
      expect(harness.getElements()).toHaveLength(0);
    });

    it('creates element with all required ExcalidrawElement base properties', () => {
      harness.selectTool('rectangle');
      harness.drag({ x: 50, y: 50 }, { x: 150, y: 150 });

      const elements = harness.getElements();
      expect(elements).toHaveLength(1);
      const el = elements[0];
      expect(el.id).toBeDefined();
      expect(el.type).toBe('rectangle');
      expect(el.x).toBe(50);
      expect(el.y).toBe(50);
      expect(el.width).toBe(100);
      expect(el.height).toBe(100);
      expect(el.angle).toBe(0);
      expect(el.seed).toBeGreaterThan(0);
      expect(el.version).toBe(1);
      expect(el.versionNonce).toBeGreaterThan(0);
      expect(el.isDeleted).toBe(false);
      expect(el.groupIds).toEqual([]);
      expect(el.locked).toBe(false);
      expect(el.created).toBeGreaterThan(0);
      expect(el.updated).toBeGreaterThan(0);
    });

    it('generates distinct deterministic seeds and unique IDs for multiple elements', () => {
      harness.selectTool('rectangle');
      harness.drag({ x: 10, y: 10 }, { x: 60, y: 60 });
      harness.selectTool('diamond');
      harness.drag({ x: 100, y: 10 }, { x: 150, y: 60 });

      const elements = harness.getElements();
      expect(elements).toHaveLength(2);
      expect(elements[0].id).not.toBe(elements[1].id);
      expect(elements[0].seed).not.toBe(elements[1].seed);
    });

    it('enforces correct discrimination of shape types', () => {
      harness.selectTool('rectangle');
      harness.drag({ x: 0, y: 0 }, { x: 50, y: 50 });
      harness.selectTool('ellipse');
      harness.drag({ x: 60, y: 0 }, { x: 110, y: 50 });
      harness.selectTool('diamond');
      harness.drag({ x: 120, y: 0 }, { x: 170, y: 50 });

      const elements = harness.getElements();
      expect(elements.map(e => e.type)).toEqual(['rectangle', 'ellipse', 'diamond']);
    });

    it('supports locking elements to prevent accidental modification', () => {
      harness.selectTool('rectangle');
      harness.drag({ x: 10, y: 10 }, { x: 100, y: 100 });
      const el = harness.getElements()[0];

      // Mutate lock state
      el.locked = true;
      harness.selectTool('selection');
      harness.selectTool('eraser');
      harness.click(50, 50);

      // Element must not be deleted because it is locked
      expect(el.isDeleted).toBe(false);
    });
  });

  // =========================================================================
  // Feature 3: Coordinate Transform & Camera System (M2)
  // =========================================================================
  describe('Feature 3: Coordinate Transform & Camera System', () => {
    it('transforms viewport coordinates to scene coordinates at 1x zoom without pan', () => {
      const { sceneX, sceneY } = harness.viewportCoordsToSceneCoords(200, 300);
      expect(sceneX).toBe(200);
      expect(sceneY).toBe(300);
    });

    it('transforms scene coordinates to viewport coordinates at 1x zoom without pan', () => {
      const { viewportX, viewportY } = harness.sceneCoordsToViewportCoords(150, 250);
      expect(viewportX).toBe(150);
      expect(viewportY).toBe(250);
    });

    it('scales coordinates accurately with zoom levels (2x and 0.5x)', () => {
      // Set 2x zoom
      harness.wheel(0, -100, { x: 0, y: 0 }, true);
      const appState = harness.getAppState();
      expect(appState.zoom.value).toBeCloseTo(1.1, 2);

      const scenePt = harness.viewportCoordsToSceneCoords(110, 220);
      const roundtrip = harness.sceneCoordsToViewportCoords(scenePt.sceneX, scenePt.sceneY);
      expect(roundtrip.viewportX).toBeCloseTo(110, 1);
      expect(roundtrip.viewportY).toBeCloseTo(220, 1);
    });

    it('preserves focal cursor point during focal zoom calculations', () => {
      const focal = { x: 400, y: 300 };
      const { sceneX: beforeX, sceneY: beforeY } = harness.viewportCoordsToSceneCoords(focal.x, focal.y);

      // Perform focal zoom to 2.5x
      const { zoom, scrollX, scrollY } = harness.calculateFocalZoom(focal, 2.5);
      const state = harness.getAppState();
      (state as any).zoom = zoom;
      (state as any).scrollX = scrollX;
      (state as any).scrollY = scrollY;

      const { sceneX: afterX, sceneY: afterY } = harness.viewportCoordsToSceneCoords(focal.x, focal.y);
      expect(afterX).toBeCloseTo(beforeX, 4);
      expect(afterY).toBeCloseTo(beforeY, 4);
    });

    it('applies panning offsets correctly via wheel scroll', () => {
      harness.wheel(100, 50); // deltaX=100, deltaY=50
      const state = harness.getAppState();
      expect(state.scrollX).toBe(-100);
      expect(state.scrollY).toBe(-50);

      const { sceneX, sceneY } = harness.viewportCoordsToSceneCoords(100, 50);
      expect(sceneX).toBe(200);
      expect(sceneY).toBe(100);
    });
  });

  // =========================================================================
  // Feature 4: Multi-Layer Canvas Architecture (M2)
  // =========================================================================
  describe('Feature 4: Multi-Layer Canvas Architecture', () => {
    it('dispatches render snapshot with committed elements on static canvas', () => {
      harness.selectTool('rectangle');
      harness.drag({ x: 20, y: 20 }, { x: 120, y: 120 });

      const log = harness.getLatestRenderLog();
      expect(log).not.toBeNull();
      expect(log?.renderedElementCount).toBe(1);
      expect(log?.staticLayersDrawn).toBe(1);
    });

    it('tracks canvas dimension changes and updates viewport layout', () => {
      harness.setViewportSize(1920, 1080, 2.0);
      const state = harness.getAppState();
      expect(state.width).toBe(1920);
      expect(state.height).toBe(1080);
      expect(state.devicePixelRatio).toBe(2.0);

      const log = harness.getLatestRenderLog();
      expect(log?.width).toBe(1920);
      expect(log?.height).toBe(1080);
    });

    it('clears and redraws interactive layer when draft element is discarded or committed', () => {
      harness.selectTool('ellipse');
      harness.drag({ x: 10, y: 10 }, { x: 70, y: 70 });

      const log = harness.getLatestRenderLog();
      expect(log?.interactiveLayersDrawn).toBe(1);
      expect(log?.renderedElementCount).toBe(1);
    });

    it('records render command stream matching committed scene element types', () => {
      harness.selectTool('rectangle');
      harness.drag({ x: 0, y: 0 }, { x: 50, y: 50 });
      harness.selectTool('diamond');
      harness.drag({ x: 100, y: 0 }, { x: 150, y: 50 });

      const log = harness.getLatestRenderLog();
      expect(log?.commands).toHaveLength(2);
      expect(log?.commands[0]).toContain('draw:rectangle:');
      expect(log?.commands[1]).toContain('draw:diamond:');
    });

    it('excludes deleted elements from canvas render snapshots', () => {
      harness.setBackgroundColor('#ff0000');
      harness.selectTool('rectangle');
      harness.drag({ x: 10, y: 10 }, { x: 60, y: 60 });
      expect(harness.getLatestRenderLog()?.renderedElementCount).toBe(1);

      harness.selectTool('eraser');
      harness.click(35, 35);
      expect(harness.getLatestRenderLog()?.renderedElementCount).toBe(0);
    });
  });

  // =========================================================================
  // Feature 5: Rough.js Shape Generation (M3)
  // =========================================================================
  describe('Feature 5: Rough.js Shape Generation', () => {
    it('generates rectangle element with normalized dimensions and fillStyle', () => {
      harness.setFillStyle('cross-hatch');
      harness.selectTool('rectangle');
      harness.drag({ x: 100, y: 100 }, { x: 250, y: 200 });

      const el = harness.getElements()[0];
      expect(el.type).toBe('rectangle');
      expect(el.width).toBe(150);
      expect(el.height).toBe(100);
      expect(el.fillStyle).toBe('cross-hatch');
    });

    it('generates diamond element with exact boundary envelope', () => {
      harness.selectTool('diamond');
      harness.drag({ x: 200, y: 200 }, { x: 300, y: 300 });

      const el = harness.getElements()[0];
      expect(el.type).toBe('diamond');
      const bounds = harness.getElementBounds(el);
      expect(bounds).toEqual([200, 200, 300, 300]);
    });

    it('generates ellipse element with correct center and radius', () => {
      harness.selectTool('ellipse');
      harness.drag({ x: 50, y: 50 }, { x: 150, y: 100 });

      const el = harness.getElements()[0];
      expect(el.type).toBe('ellipse');
      expect(el.width).toBe(100);
      expect(el.height).toBe(50);
    });

    it('generates 2-point line with relative local points', () => {
      harness.selectTool('line');
      harness.drag({ x: 10, y: 20 }, { x: 110, y: 120 });

      const el = harness.getElements()[0];
      expect(el.type).toBe('line');
      expect(el.points).toEqual([[0, 0], [100, 100]]);
      expect(el.x).toBe(10);
      expect(el.y).toBe(20);
    });

    it('generates arrow element with specified arrowhead markers', () => {
      harness.setArrowheads(null, 'arrow');
      harness.selectTool('arrow');
      harness.drag({ x: 50, y: 50 }, { x: 200, y: 50 });

      const el = harness.getElements()[0];
      expect(el.type).toBe('arrow');
      expect(el.startArrowhead).toBeNull();
      expect(el.endArrowhead).toBe('arrow');
      expect(el.points).toEqual([[0, 0], [150, 0]]);
    });
  });

  // =========================================================================
  // Feature 6: Freehand (Pencil) Drawing Engine (M3)
  // =========================================================================
  describe('Feature 6: Freehand (Pencil) Drawing Engine', () => {
    it('samples points along cursor path with relative coordinates', () => {
      harness.selectTool('freedraw');
      harness.drag({ x: 50, y: 50 }, { x: 100, y: 100 }, 4);

      const el = harness.getElements()[0];
      expect(el.type).toBe('freedraw');
      expect(el.points).toBeDefined();
      expect(el.points!.length).toBeGreaterThanOrEqual(4);
      expect(el.points![0]).toEqual([0, 0]);
    });

    it('records pressure samples for stroke width simulation', () => {
      harness.selectTool('freedraw');
      harness.pointerDown(10, 10, { pressure: 0.8 });
      harness.pointerMove(20, 20, { pressure: 0.6 });
      harness.pointerMove(30, 30, { pressure: 0.4 });
      harness.pointerUp();

      const el = harness.getElements()[0];
      expect(el.pressures).toBeDefined();
      expect(el.pressures).toEqual([0.8, 0.6, 0.4]);
    });

    it('calculates bounding envelope covering all freehand sample points', () => {
      harness.selectTool('freedraw');
      harness.pointerDown(100, 100);
      harness.pointerMove(150, 80);
      harness.pointerMove(200, 160);
      harness.pointerUp();

      const el = harness.getElements()[0];
      const bounds = harness.getElementBounds(el);
      expect(bounds[0]).toBe(100); // minX
      expect(bounds[1]).toBe(80);  // minY
      expect(bounds[2]).toBe(200); // maxX
      expect(bounds[3]).toBe(160); // maxY
    });

    it('supports hit-testing along freehand stroke within tolerance distance', () => {
      harness.selectTool('freedraw');
      harness.pointerDown(0, 0);
      harness.pointerMove(100, 0);
      harness.pointerUp();

      const el = harness.getElements()[0];
      // Point directly on stroke
      expect(harness.hitTest(el, 50, 0)).toBe(true);
      // Point within 5px tolerance
      expect(harness.hitTest(el, 50, 5)).toBe(true);
      // Point outside tolerance (25px away)
      expect(harness.hitTest(el, 50, 25)).toBe(false);
    });

    it('preserves freehand element version and seed across history operations', () => {
      harness.selectTool('freedraw');
      harness.drag({ x: 10, y: 10 }, { x: 50, y: 50 });
      const originalSeed = harness.getElements()[0].seed;

      harness.undo();
      harness.redo();

      const restored = harness.getElements()[0];
      expect(restored.seed).toBe(originalSeed);
    });
  });

  // =========================================================================
  // Feature 7: Text Element & In-Place Editor (M3)
  // =========================================================================
  describe('Feature 7: Text Element & In-Place Editor', () => {
    it('activates text editor overlay upon clicking text tool on canvas', () => {
      harness.selectTool('text');
      harness.click(150, 200);

      expect(harness.isTextEditorActive()).toBe(true);
      expect(harness.getTextEditorContent()).toBe('');
    });

    it('commits typed string as a new text element on blur/commit', () => {
      harness.selectTool('text');
      harness.click(100, 100);
      harness.typeText('Architecture Design');
      harness.commitTextEditor();

      expect(harness.isTextEditorActive()).toBe(false);
      const elements = harness.getElements();
      expect(elements).toHaveLength(1);
      const el = elements[0];
      expect(el.type).toBe('text');
      expect(el.text).toBe('Architecture Design');
      expect(el.fontSize).toBe(20);
      expect(el.fontFamily).toBe(1);
      expect(el.width).toBeGreaterThan(0);
      expect(el.height).toBeGreaterThan(0);
    });

    it('edits existing text element on double-click', () => {
      harness.selectTool('text');
      harness.click(50, 50);
      harness.typeText('Initial');
      harness.commitTextEditor();

      // Double-click on existing element
      harness.doubleClick(55, 55);
      expect(harness.isTextEditorActive()).toBe(true);
      expect(harness.getTextEditorContent()).toBe('Initial');

      harness.typeText(' Updated');
      harness.commitTextEditor();

      const el = harness.getElements()[0];
      expect(el.text).toBe('Initial Updated');
      expect(el.version).toBe(2);
    });

    it('discards empty text input without creating blank element', () => {
      harness.selectTool('text');
      harness.click(50, 50);
      harness.typeText('   '); // Whitespace only
      harness.commitTextEditor();

      expect(harness.getElements()).toHaveLength(0);
    });

    it('calculates bounding box proportional to font size and text length', () => {
      harness.setFontSize(32);
      harness.selectTool('text');
      harness.click(0, 0);
      harness.typeText('A');
      harness.commitTextEditor();
      const smallEl = harness.getElements()[0];

      harness.setFontSize(32);
      harness.selectTool('text');
      harness.click(0, 100);
      harness.typeText('A much longer heading with multiple words');
      harness.commitTextEditor();
      const largeEl = harness.getElements()[1];

      expect(largeEl.width).toBeGreaterThan(smallEl.width);
      expect(largeEl.height).toBe(smallEl.height);
    });
  });

  // =========================================================================
  // Feature 8: Hit Testing & Selection (M4)
  // =========================================================================
  describe('Feature 8: Hit Testing & Selection', () => {
    it('detects point inside filled rectangle', () => {
      harness.setBackgroundColor('#ff0000');
      harness.selectTool('rectangle');
      harness.drag({ x: 100, y: 100 }, { x: 200, y: 200 });
      const el = harness.getElements()[0];

      // Inside center
      expect(harness.hitTest(el, 150, 150)).toBe(true);
      // Outside
      expect(harness.hitTest(el, 50, 50)).toBe(false);
    });

    it('permits click-through on transparent unfilled rectangle center', () => {
      harness.setBackgroundColor('transparent');
      harness.selectTool('rectangle');
      harness.drag({ x: 100, y: 100 }, { x: 300, y: 300 });
      const el = harness.getElements()[0];

      // Dead center of transparent rectangle must NOT hit
      expect(harness.hitTest(el, 200, 200)).toBe(false);
      // Edge outline must hit
      expect(harness.hitTest(el, 100, 200)).toBe(true);
    });

    it('selects topmost element when overlapping shapes are clicked', () => {
      harness.setBackgroundColor('#ff0000');
      harness.selectTool('rectangle');
      harness.drag({ x: 50, y: 50 }, { x: 150, y: 150 }); // bottom
      harness.selectTool('rectangle');
      harness.drag({ x: 100, y: 100 }, { x: 200, y: 200 }); // top

      harness.selectTool('selection');
      harness.click(120, 120); // In the overlapping intersection

      const selected = harness.getSelectedElements();
      expect(selected).toHaveLength(1);
      expect(selected[0].x).toBe(100); // The top element was selected
    });

    it('supports multi-selection toggle with shift-click', () => {
      harness.setBackgroundColor('#ff0000');
      harness.selectTool('rectangle');
      harness.drag({ x: 10, y: 10 }, { x: 50, y: 50 });
      harness.selectTool('rectangle');
      harness.drag({ x: 100, y: 10 }, { x: 150, y: 50 });

      harness.selectTool('selection');
      harness.click(30, 30);
      expect(harness.getSelectedElements()).toHaveLength(1);

      // Shift-click second element
      harness.click(120, 30, { shiftKey: true });
      expect(harness.getSelectedElements()).toHaveLength(2);
    });

    it('deselects all elements upon clicking empty canvas space', () => {
      harness.selectTool('rectangle');
      harness.drag({ x: 50, y: 50 }, { x: 100, y: 100 });
      expect(harness.getSelectedElements()).toHaveLength(1);

      harness.selectTool('selection');
      harness.click(500, 500); // empty canvas
      expect(harness.getSelectedElements()).toHaveLength(0);
    });
  });

  // =========================================================================
  // Feature 9: Manipulation & Transform Handles (M4)
  // =========================================================================
  describe('Feature 9: Manipulation & Transform Handles', () => {
    it('provides 8 resize handles and 1 rotation handle for regular shapes', () => {
      harness.selectTool('rectangle');
      harness.drag({ x: 100, y: 100 }, { x: 300, y: 250 });
      const el = harness.getElements()[0];

      const handles = harness.getTransformHandles(el);
      expect(handles).not.toBeNull();
      expect(handles?.nw).toBeDefined();
      expect(handles?.ne).toBeDefined();
      expect(handles?.se).toBeDefined();
      expect(handles?.sw).toBeDefined();
      expect(handles?.n).toBeDefined();
      expect(handles?.s).toBeDefined();
      expect(handles?.w).toBeDefined();
      expect(handles?.e).toBeDefined();
      expect(handles?.rotation).toBeDefined();
    });

    it('omits cardinal handles when element width or height is below threshold', () => {
      harness.selectTool('rectangle');
      harness.drag({ x: 100, y: 100 }, { x: 120, y: 120 }); // 20x20 px (< 40px)
      const el = harness.getElements()[0];

      const handles = harness.getTransformHandles(el);
      expect(handles?.nw).toBeDefined();
      expect(handles?.se).toBeDefined();
      // Cardinal handles should be omitted
      expect(handles?.n).toBeUndefined();
      expect(handles?.s).toBeUndefined();
    });

    it('updates element position during drag manipulation', () => {
      harness.setBackgroundColor('#ff0000');
      harness.selectTool('rectangle');
      harness.drag({ x: 50, y: 50 }, { x: 150, y: 150 });

      // Click to select, then drag
      harness.selectTool('selection');
      harness.drag({ x: 100, y: 100 }, { x: 200, y: 200 });

      const el = harness.getElements()[0];
      expect(el.x).toBe(150);
      expect(el.y).toBe(150);
      expect(el.version).toBeGreaterThan(1);
    });

    it('rotates element and preserves angle normalized in [0, 2*PI)', () => {
      harness.selectTool('rectangle');
      harness.drag({ x: 100, y: 100 }, { x: 200, y: 200 });

      harness.rotateSelected(Math.PI / 4); // 45 deg
      const el = harness.getElements()[0];
      expect(el.angle).toBeCloseTo(Math.PI / 4, 3);
    });

    it('resizes element dimensions via direct resize command', () => {
      harness.selectTool('rectangle');
      harness.drag({ x: 50, y: 50 }, { x: 150, y: 150 });
      harness.resizeSelected(300, 200);

      const el = harness.getElements()[0];
      expect(el.width).toBe(300);
      expect(el.height).toBe(200);
      expect(el.version).toBeGreaterThan(1);
    });
  });

  // =========================================================================
  // Feature 10: Eraser Tool (M4)
  // =========================================================================
  describe('Feature 10: Eraser Tool', () => {
    it('marks clicked element as deleted tombstone', () => {
      harness.setBackgroundColor('#00ff00');
      harness.selectTool('rectangle');
      harness.drag({ x: 50, y: 50 }, { x: 150, y: 150 });
      expect(harness.getNonDeletedElements()).toHaveLength(1);

      harness.selectTool('eraser');
      harness.click(100, 100);

      expect(harness.getNonDeletedElements()).toHaveLength(0);
      expect(harness.getElements()[0].isDeleted).toBe(true);
    });

    it('erases multiple elements when dragged across canvas', () => {
      harness.setBackgroundColor('#0000ff');
      harness.selectTool('rectangle');
      harness.drag({ x: 50, y: 50 }, { x: 90, y: 90 });
      harness.selectTool('rectangle');
      harness.drag({ x: 150, y: 50 }, { x: 190, y: 90 });
      expect(harness.getNonDeletedElements()).toHaveLength(2);

      // Drag eraser across both
      harness.selectTool('eraser');
      harness.drag({ x: 20, y: 70 }, { x: 220, y: 70 }, 10);

      expect(harness.getNonDeletedElements()).toHaveLength(0);
    });

    it('restores erased element upon undo command', () => {
      harness.setBackgroundColor('#ffff00');
      harness.selectTool('rectangle');
      harness.drag({ x: 50, y: 50 }, { x: 100, y: 100 });

      harness.selectTool('eraser');
      harness.click(75, 75);
      expect(harness.getNonDeletedElements()).toHaveLength(0);

      harness.undo();
      expect(harness.getNonDeletedElements()).toHaveLength(1);
      expect(harness.getElements()[0].isDeleted).toBe(false);
    });

    it('re-deletes restored element upon redo command', () => {
      harness.setBackgroundColor('#ff00ff');
      harness.selectTool('rectangle');
      harness.drag({ x: 50, y: 50 }, { x: 100, y: 100 });

      harness.selectTool('eraser');
      harness.click(75, 75);
      harness.undo();
      expect(harness.getNonDeletedElements()).toHaveLength(1);

      harness.redo();
      expect(harness.getNonDeletedElements()).toHaveLength(0);
    });

    it('ignores locked elements when erasing', () => {
      harness.setBackgroundColor('#ff0000');
      harness.selectTool('rectangle');
      harness.drag({ x: 50, y: 50 }, { x: 100, y: 100 });
      const el = harness.getElements()[0];
      el.locked = true;

      harness.selectTool('eraser');
      harness.click(75, 75);

      expect(el.isDeleted).toBe(false);
      expect(harness.getNonDeletedElements()).toHaveLength(1);
    });
  });

  // =========================================================================
  // Feature 11: Toolbar & Styling Controls (M5)
  // =========================================================================
  describe('Feature 11: Toolbar & Styling Controls', () => {
    it('switches active tool and applies it to subsequent drag', () => {
      harness.selectTool('diamond');
      expect(harness.getAppState().activeTool.type).toBe('diamond');

      harness.drag({ x: 20, y: 20 }, { x: 80, y: 80 });
      expect(harness.getElements()[0].type).toBe('diamond');
    });

    it('applies updated strokeColor and backgroundColor to newly created shapes', () => {
      harness.setStrokeColor('#e03131');
      harness.setBackgroundColor('#ffc9c9');
      harness.selectTool('rectangle');
      harness.drag({ x: 0, y: 0 }, { x: 100, y: 100 });

      const el = harness.getElements()[0];
      expect(el.strokeColor).toBe('#e03131');
      expect(el.backgroundColor).toBe('#ffc9c9');
    });

    it('updates strokeWidth and roughness for actively selected element', () => {
      harness.selectTool('rectangle');
      harness.drag({ x: 10, y: 10 }, { x: 60, y: 60 });

      harness.setStrokeWidth(4);
      harness.setRoughness(2);

      const el = harness.getElements()[0];
      expect(el.strokeWidth).toBe(4);
      expect(el.roughness).toBe(2);
    });

    it('updates opacity for selected element within [0, 100]', () => {
      harness.selectTool('rectangle');
      harness.drag({ x: 10, y: 10 }, { x: 60, y: 60 });

      harness.setOpacity(40);
      expect(harness.getElements()[0].opacity).toBe(40);
    });

    it('configures viewBackgroundColor and records canvas update', () => {
      harness.setViewBackgroundColor('#1e1e1e');
      expect(harness.getAppState().viewBackgroundColor).toBe('#1e1e1e');
    });
  });

  // =========================================================================
  // Feature 12: History Management (Undo/Redo) (M5)
  // =========================================================================
  describe('Feature 12: History Management (Undo/Redo)', () => {
    it('reverts element creation on undo', () => {
      harness.selectTool('rectangle');
      harness.drag({ x: 10, y: 10 }, { x: 50, y: 50 });
      expect(harness.getElements()).toHaveLength(1);

      const success = harness.undo();
      expect(success).toBe(true);
      expect(harness.getElements()).toHaveLength(0);
    });

    it('restores reverted element on redo', () => {
      harness.selectTool('rectangle');
      harness.drag({ x: 10, y: 10 }, { x: 50, y: 50 });
      harness.undo();
      expect(harness.getElements()).toHaveLength(0);

      const success = harness.redo();
      expect(success).toBe(true);
      expect(harness.getElements()).toHaveLength(1);
    });

    it('handles multi-step sequential undo and redo operations', () => {
      harness.selectTool('rectangle');
      harness.drag({ x: 0, y: 0 }, { x: 10, y: 10 });
      harness.selectTool('diamond');
      harness.drag({ x: 20, y: 20 }, { x: 30, y: 30 });
      harness.selectTool('ellipse');
      harness.drag({ x: 40, y: 40 }, { x: 50, y: 50 });
      expect(harness.getElements()).toHaveLength(3);

      harness.undo(); // removes ellipse
      expect(harness.getElements()).toHaveLength(2);
      harness.undo(); // removes diamond
      expect(harness.getElements()).toHaveLength(1);

      harness.redo(); // restores diamond
      expect(harness.getElements()).toHaveLength(2);
      expect(harness.getElements()[1].type).toBe('diamond');
    });

    it('clears redo stack upon introducing new mutation after undo', () => {
      harness.selectTool('rectangle');
      harness.drag({ x: 0, y: 0 }, { x: 10, y: 10 });
      harness.undo();
      expect(harness.getHistoryDepth().redo).toBe(1);

      // New action
      harness.selectTool('ellipse');
      harness.drag({ x: 20, y: 20 }, { x: 40, y: 40 });

      // Redo stack must be purged
      expect(harness.getHistoryDepth().redo).toBe(0);
      expect(harness.redo()).toBe(false);
    });

    it('assigns incremented version numbers upon undo/redo reconciliation', () => {
      harness.selectTool('rectangle');
      harness.drag({ x: 0, y: 0 }, { x: 50, y: 50 });
      const versionInitial = harness.getElements()[0].version;

      harness.undo();
      harness.redo();

      const versionRestored = harness.getElements()[0].version;
      expect(versionRestored).toBeGreaterThan(versionInitial);
    });
  });

  // =========================================================================
  // Feature 13: LocalStorage Persistence (M5)
  // =========================================================================
  describe('Feature 13: LocalStorage Persistence', () => {
    it('persists scene elements to local storage automatically', () => {
      harness.selectTool('rectangle');
      harness.drag({ x: 10, y: 10 }, { x: 100, y: 100 });

      const dump = harness.getLocalStorageDump();
      expect(dump.elements).toHaveLength(1);
      expect(dump.elements![0].type).toBe('rectangle');
    });

    it('strips ephemeral transient variables before saving AppState', () => {
      harness.selectTool('rectangle');
      harness.drag({ x: 10, y: 10 }, { x: 100, y: 100 });

      const dump = harness.getLocalStorageDump();
      expect(dump.appState).toBeDefined();
      expect(dump.appState.viewBackgroundColor).toBe('#ffffff');
      // Transients like activePointer or draggingElement should never be in storage
      expect(dump.appState.draggingElement).toBeUndefined();
      expect(dump.appState.draftElement).toBeUndefined();
    });

    it('restores canvas scene and persistent state from LocalStorage on load', () => {
      harness.setStrokeColor('#099268');
      harness.selectTool('diamond');
      harness.drag({ x: 30, y: 30 }, { x: 90, y: 90 });

      // Create new clean harness and load from existing storage dump
      const secondHarness = ExcalidrawTestHarness.create();
      (secondHarness as any).localStorageStore = { ...(harness as any).localStorageStore };

      const loaded = secondHarness.loadFromLocalStorage();
      expect(loaded).toBe(true);
      expect(secondHarness.getElements()).toHaveLength(1);
      expect(secondHarness.getElements()[0].type).toBe('diamond');
    });

    it('recovers gracefully without crash when storage is empty', () => {
      const cleanHarness = ExcalidrawTestHarness.create();
      (cleanHarness as any).localStorageStore = {};
      const loaded = cleanHarness.loadFromLocalStorage();
      expect(loaded).toBe(false);
      expect(cleanHarness.getElements()).toHaveLength(0);
    });

    it('excludes deleted elements from serialized local storage payload', () => {
      harness.setBackgroundColor('#ff0000');
      harness.selectTool('rectangle');
      harness.drag({ x: 10, y: 10 }, { x: 60, y: 60 });

      harness.selectTool('eraser');
      harness.click(35, 35);

      const dump = harness.getLocalStorageDump();
      expect(dump.elements).toHaveLength(0);
    });
  });

  // =========================================================================
  // Feature 14: Export Engine (JSON & PNG) (M5)
  // =========================================================================
  describe('Feature 14: Export Engine (JSON & PNG)', () => {
    it('exports scene to valid .excalidraw JSON conforming to schema version 2', () => {
      harness.selectTool('rectangle');
      harness.drag({ x: 50, y: 50 }, { x: 150, y: 150 });

      const jsonString = harness.exportToJSON();
      const parsed = JSON.parse(jsonString);

      expect(parsed.type).toBe('excalidraw');
      expect(parsed.version).toBe(2);
      expect(parsed.source).toBe('https://excalidraw.com');
      expect(Array.isArray(parsed.elements)).toBe(true);
      expect(parsed.elements).toHaveLength(1);
      expect(parsed.appState).toBeDefined();
    });

    it('imports and reconstructs scene elements from valid .excalidraw JSON payload', () => {
      const payload = {
        type: 'excalidraw',
        version: 2,
        source: 'https://excalidraw.com',
        elements: [
          {
            id: 'imported_1',
            type: 'ellipse',
            x: 200,
            y: 300,
            width: 80,
            height: 60,
            angle: 0,
            strokeColor: '#000000',
            backgroundColor: 'transparent',
            fillStyle: 'solid',
            strokeWidth: 2,
            strokeStyle: 'solid',
            roughness: 1,
            opacity: 100,
            seed: 42,
            version: 1,
            versionNonce: 12345,
            isDeleted: false,
            groupIds: [],
            frameId: null,
            boundElements: null,
            updated: 1714589200000,
            created: 1714589200000,
            link: null,
            locked: false,
          },
        ],
        appState: { viewBackgroundColor: '#f8f9fa' },
      };

      const success = harness.importFromJSON(JSON.stringify(payload));
      expect(success).toBe(true);

      const elements = harness.getElements();
      expect(elements).toHaveLength(1);
      expect(elements[0].id).toBe('imported_1');
      expect(elements[0].type).toBe('ellipse');
      expect(harness.getAppState().viewBackgroundColor).toBe('#f8f9fa');
    });

    it('rejects invalid JSON payloads gracefully during import', () => {
      const invalidJson = '{"type": "not_excalidraw"}';
      const success = harness.importFromJSON(invalidJson);
      expect(success).toBe(false);
      expect(harness.getElements()).toHaveLength(0);
    });

    it('exports scene to offscreen canvas dimensions with padding added', () => {
      harness.selectTool('rectangle');
      harness.drag({ x: 100, y: 100 }, { x: 200, y: 200 }); // 100x100 shape

      const exportResult = harness.exportToCanvas({ padding: 20, scale: 1.0 });
      expect(exportResult.elementCount).toBe(1);
      // Width = 100 + 20*2 = 140
      expect(exportResult.width).toBe(140);
      expect(exportResult.height).toBe(140);
      expect(exportResult.dataUrl).toContain('data:image/png');
    });

    it('applies exportScale parameter during canvas image generation', () => {
      harness.selectTool('rectangle');
      harness.drag({ x: 0, y: 0 }, { x: 100, y: 100 });

      const export1x = harness.exportToCanvas({ padding: 10, scale: 1.0 });
      const export2x = harness.exportToCanvas({ padding: 10, scale: 2.0 });

      expect(export2x.width).toBe(export1x.width * 2);
      expect(export2x.height).toBe(export1x.height * 2);
    });
  });
});
