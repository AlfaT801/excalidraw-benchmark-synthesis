import { describe, it, expect, beforeEach } from 'vitest';
import { ExcalidrawTestHarness } from './harness.js';

describe('Tier 3: Cross-Feature Combinations (Pairwise & Multi-Way Interactions)', () => {
  let harness: ExcalidrawTestHarness;

  beforeEach(() => {
    harness = ExcalidrawTestHarness.create();
  });

  // Interaction 1: Draw shape + Resize via corner handle
  it('combines shape creation with resize manipulation, preserving seed and bumping version', () => {
    harness.selectTool('rectangle');
    harness.drag({ x: 50, y: 50 }, { x: 150, y: 150 });
    const initialEl = harness.getElements()[0];
    const initialSeed = initialEl.seed;
    const initialVersion = initialEl.version;

    // Direct resize
    harness.resizeSelected(300, 200);

    const updatedEl = harness.getElements()[0];
    expect(updatedEl.width).toBe(300);
    expect(updatedEl.height).toBe(200);
    expect(updatedEl.seed).toBe(initialSeed); // Rough.js determinism preserved
    expect(updatedEl.version).toBeGreaterThan(initialVersion);
  });

  // Interaction 2: Rotate element + Hit-test at rotated coordinates
  it('combines element rotation with rotated hit-testing math', () => {
    harness.setBackgroundColor('#ff0000');
    harness.selectTool('rectangle');
    // Draw 200x50 horizontal bar centered around (200, 200) -> x: 100, y: 175, w: 200, h: 50
    harness.drag({ x: 100, y: 175 }, { x: 300, y: 225 });

    // Rotate by 90 degrees (Math.PI / 2) -> now vertical bar (w: 50, h: 200)
    harness.rotateSelected(Math.PI / 2);
    const el = harness.getElements()[0];

    // Point (200, 260) was previously outside horizontal bar, but now inside vertical bar!
    expect(harness.hitTest(el, 200, 260)).toBe(true);

    // Point (280, 200) was previously inside horizontal bar, but now outside vertical bar!
    expect(harness.hitTest(el, 280, 200)).toBe(false);
  });

  // Interaction 3: Group elements + Drag selection
  it('combines element grouping with coordinated multi-element drag translation', () => {
    harness.setBackgroundColor('#00ff00');
    harness.selectTool('rectangle');
    harness.drag({ x: 10, y: 10 }, { x: 60, y: 60 });
    harness.selectTool('diamond');
    harness.drag({ x: 100, y: 100 }, { x: 150, y: 150 });

    harness.pressShortcut('Ctrl+A');
    const groupId = harness.groupSelected();
    expect(groupId).not.toBeNull();

    // Drag selection by (+50, +30)
    harness.selectTool('selection');
    harness.drag({ x: 20, y: 20 }, { x: 70, y: 50 });

    const el1 = harness.getElements()[0];
    const el2 = harness.getElements()[1];

    expect(el1.x).toBe(60);
    expect(el1.y).toBe(40);
    expect(el2.x).toBe(150);
    expect(el2.y).toBe(130);
  });

  // Interaction 4: Draw shapes + Eraser tool + Undo + Redo
  it('combines multiple element creation with eraser sweep, undo, and redo cycles', () => {
    harness.setBackgroundColor('#339af0');
    harness.selectTool('rectangle');
    harness.drag({ x: 0, y: 0 }, { x: 40, y: 40 });
    harness.selectTool('ellipse');
    harness.drag({ x: 50, y: 0 }, { x: 90, y: 40 });
    harness.selectTool('diamond');
    harness.drag({ x: 100, y: 0 }, { x: 140, y: 40 });
    expect(harness.getNonDeletedElements()).toHaveLength(3);

    // Erase center ellipse
    harness.selectTool('eraser');
    harness.click(70, 20);
    expect(harness.getNonDeletedElements()).toHaveLength(2);
    expect(harness.getElements()[1].isDeleted).toBe(true);

    // Undo erase
    harness.undo();
    expect(harness.getNonDeletedElements()).toHaveLength(3);
    expect(harness.getElements()[1].isDeleted).toBe(false);

    // Redo erase
    harness.redo();
    expect(harness.getNonDeletedElements()).toHaveLength(2);
    expect(harness.getElements()[1].isDeleted).toBe(true);
  });

  // Interaction 5: Zoom + Pan + Coordinate preservation
  it('combines camera focal zoom and pan scrolling with coordinate transformation stability', () => {
    // Pan viewport by (150, 200)
    harness.wheel(150, 200);

    // Zoom 2x with focal cursor at viewport center (512, 384)
    const focalVp = { x: 512, y: 384 };
    const { zoom, scrollX, scrollY } = harness.calculateFocalZoom(focalVp, 2.0);
    const state = harness.getAppState();
    (state as any).zoom = zoom;
    (state as any).scrollX = scrollX;
    (state as any).scrollY = scrollY;

    // Draw rectangle at current viewport coordinates
    harness.selectTool('rectangle');
    harness.drag({ x: 200, y: 200 }, { x: 300, y: 300 });

    const el = harness.getElements()[0];
    // Convert back from scene to viewport
    const vpStart = harness.sceneCoordsToViewportCoords(el.x, el.y);
    expect(vpStart.viewportX).toBeCloseTo(200, 1);
    expect(vpStart.viewportY).toBeCloseTo(200, 1);
  });

  // Interaction 6: Style change + Drawing + Undo
  it('combines styling defaults adjustment with undo, verifying default persistence', () => {
    harness.setStrokeColor('#d6336c');
    harness.setBackgroundColor('#fcc2d7');
    harness.setFillStyle('cross-hatch');

    harness.selectTool('rectangle');
    harness.drag({ x: 10, y: 10 }, { x: 60, y: 60 });
    expect(harness.getElements()).toHaveLength(1);

    // Undo removes the shape
    harness.undo();
    expect(harness.getElements()).toHaveLength(0);

    // Active tool and styling defaults must remain intact for the next shape!
    const appState = harness.getAppState();
    expect(appState.currentItemStrokeColor).toBe('#d6336c');
    expect(appState.currentItemBackgroundColor).toBe('#fcc2d7');
    expect(appState.currentItemFillStyle).toBe('cross-hatch');
  });

  // Interaction 7: In-place text editing + Arrow binding simulation
  it('combines in-place text creation with arrow annotations', () => {
    // 1. Create text element
    harness.selectTool('text');
    harness.click(100, 100);
    harness.typeText('Server Module');
    harness.commitTextEditor();
    const textEl = harness.getElements()[0];

    // 2. Create arrow pointing towards the text element
    harness.selectTool('arrow');
    harness.drag({ x: 300, y: 100 }, { x: 100 + textEl.width + 10, y: 100 });
    const arrowEl = harness.getElements()[1];

    expect(arrowEl.type).toBe('arrow');
    expect(arrowEl.points![1][0]).toBeLessThan(0); // Points leftwards towards text
  });

  // Interaction 8: Multi-element box selection + Batch styling
  it('combines multi-selection with simultaneous batch styling updates', () => {
    harness.selectTool('rectangle');
    harness.drag({ x: 10, y: 10 }, { x: 50, y: 50 });
    harness.selectTool('diamond');
    harness.drag({ x: 60, y: 10 }, { x: 100, y: 50 });
    harness.selectTool('ellipse');
    harness.drag({ x: 110, y: 10 }, { x: 150, y: 50 });

    harness.pressShortcut('Ctrl+A');
    expect(harness.getSelectedElements()).toHaveLength(3);

    // Update style properties in batch
    harness.setStrokeColor('#12b886');
    harness.setStrokeWidth(4);
    harness.setRoughness(2);

    for (const el of harness.getElements()) {
      expect(el.strokeColor).toBe('#12b886');
      expect(el.strokeWidth).toBe(4);
      expect(el.roughness).toBe(2);
    }
  });

  // Interaction 9: LocalStorage persistence + History sequence
  it('combines local storage state save with undo sequence and verifies storage sync', () => {
    harness.selectTool('rectangle');
    harness.drag({ x: 20, y: 20 }, { x: 80, y: 80 });
    expect(harness.getLocalStorageDump().elements).toHaveLength(1);

    harness.selectTool('diamond');
    harness.drag({ x: 100, y: 20 }, { x: 160, y: 80 });
    expect(harness.getLocalStorageDump().elements).toHaveLength(2);

    harness.undo();
    expect(harness.getLocalStorageDump().elements).toHaveLength(1);
    expect(harness.getLocalStorageDump().elements![0].type).toBe('rectangle');
  });

  // Interaction 10: Export JSON + Wipe canvas + Import JSON + Drag imported element
  it('combines JSON export and import with downstream interactive manipulation', () => {
    harness.setBackgroundColor('#fab005');
    harness.selectTool('rectangle');
    harness.drag({ x: 50, y: 50 }, { x: 150, y: 150 });

    const exportedJson = harness.exportToJSON();

    // Reset harness
    harness.reset();
    expect(harness.getElements()).toHaveLength(0);

    // Restore from exported JSON
    const imported = harness.importFromJSON(exportedJson);
    expect(imported).toBe(true);
    expect(harness.getElements()).toHaveLength(1);

    // Drag restored element
    harness.selectTool('selection');
    harness.drag({ x: 75, y: 75 }, { x: 175, y: 175 });

    const el = harness.getElements()[0];
    expect(el.x).toBe(150);
    expect(el.y).toBe(150);
    expect(el.backgroundColor).toBe('#fab005');
  });

  // Interaction 11: Freehand drawing + Selection + Eraser
  it('combines freehand sketch strokes with eraser intersection and cleanup', () => {
    harness.selectTool('freedraw', true);
    // Draw 3 horizontal lines at y=50, y=100, y=150
    harness.drag({ x: 50, y: 50 }, { x: 200, y: 50 });
    harness.drag({ x: 50, y: 100 }, { x: 200, y: 100 });
    harness.drag({ x: 50, y: 150 }, { x: 200, y: 150 });
    expect(harness.getNonDeletedElements()).toHaveLength(3);

    // Erase middle stroke with vertical eraser drag at x=120
    harness.selectTool('eraser');
    harness.drag({ x: 120, y: 80 }, { x: 120, y: 120 });

    expect(harness.getNonDeletedElements()).toHaveLength(2);
    expect(harness.getElements()[1].isDeleted).toBe(true);
  });

  // Interaction 12: Shape creation + Rotation + Resize combination
  it('combines shape creation, 45-deg rotation, and handle generation verification', () => {
    harness.selectTool('rectangle');
    harness.drag({ x: 100, y: 100 }, { x: 300, y: 200 });

    harness.rotateSelected(Math.PI / 4);
    const el = harness.getElements()[0];

    const handles = harness.getTransformHandles(el);
    expect(handles?.nw).toBeDefined();
    expect(handles?.rotation).toBeDefined();

    // Resize element
    harness.resizeSelected(400, 250);
    expect(el.width).toBe(400);
    expect(el.height).toBe(250);
    expect(el.angle).toBeCloseTo(Math.PI / 4, 3);
  });

  // Interaction 13: Drag selection + Delete key + Undo + Redo
  it('combines selection drag, keyboard Delete shortcut, and full undo/redo restoration', () => {
    harness.setBackgroundColor('#82c91e');
    harness.selectTool('rectangle');
    harness.drag({ x: 10, y: 10 }, { x: 80, y: 80 });

    // Select and delete via shortcut
    harness.selectTool('selection');
    harness.click(40, 40);
    harness.pressShortcut('Delete');
    expect(harness.getNonDeletedElements()).toHaveLength(0);

    harness.undo();
    expect(harness.getNonDeletedElements()).toHaveLength(1);

    harness.redo();
    expect(harness.getNonDeletedElements()).toHaveLength(0);
  });

  // Interaction 14: Zoom in + Draw + Zoom out + Export PNG
  it('combines focal zoom-in drawing with zoom-out and offscreen PNG rasterization', () => {
    // Zoom in 3x
    const { zoom } = harness.calculateFocalZoom({ x: 100, y: 100 }, 3.0);
    (harness.getAppState() as any).zoom = zoom;

    harness.selectTool('rectangle');
    harness.drag({ x: 50, y: 50 }, { x: 100, y: 100 });

    // Zoom back out to 1x
    const { zoom: resetZoom } = harness.calculateFocalZoom({ x: 100, y: 100 }, 1.0);
    (harness.getAppState() as any).zoom = resetZoom;

    const exportResult = harness.exportToCanvas({ padding: 15, scale: 2.0 });
    expect(exportResult.elementCount).toBe(1);
    expect(exportResult.width).toBeGreaterThan(0);
    expect(exportResult.dataUrl).toContain('data:image/png');
  });

  // Interaction 15: Shift-constrained 1:1 drawing + Shift-key 15° rotation + Export
  it('combines 1:1 aspect ratio constraint with 15-deg snapped rotation and JSON export', () => {
    harness.selectTool('rectangle');
    // Drag with shiftKey=true (dx=100, dy=60) -> constrained to 100x100 square
    harness.drag({ x: 50, y: 50 }, { x: 150, y: 110 }, 5, { shiftKey: true });

    const el = harness.getElements()[0];
    expect(el.width).toBe(100);
    expect(el.height).toBe(100);

    // Rotate with shift snapping (0.35 rad ~ 20 deg -> snaps to 15 deg = PI/12)
    harness.rotateSelected(0.35, true);
    expect(el.angle).toBeCloseTo(Math.PI / 12, 3);

    const json = harness.exportToJSON();
    const parsed = JSON.parse(json);
    expect(parsed.elements[0].width).toBe(100);
    expect(parsed.elements[0].height).toBe(100);
    expect(parsed.elements[0].angle).toBeCloseTo(Math.PI / 12, 3);
  });
});
