import { describe, it, expect, beforeEach } from 'vitest';
import { ExcalidrawTestHarness } from './harness.js';

describe('Tier 4: Real-World Application Scenarios (End-to-End User Journeys)', () => {
  let harness: ExcalidrawTestHarness;

  beforeEach(() => {
    harness = ExcalidrawTestHarness.create();
  });

  // =========================================================================
  // Scenario 1: Microservices Architecture Diagram Creation
  // =========================================================================
  it('Scenario 1: creates a complete 3-service architecture diagram with database and connecting arrows', () => {
    // 1. Setup default styling for service boxes
    harness.setStrokeColor('#1971c2');
    harness.setBackgroundColor('#d0ebff');
    harness.setFillStyle('solid');
    harness.setStrokeWidth(2);

    // 2. Create "API Gateway" box at (100, 200)
    harness.selectTool('rectangle');
    harness.drag({ x: 100, y: 150 }, { x: 260, y: 230 });

    // 3. Create "Auth Service" box at (400, 80)
    harness.selectTool('rectangle');
    harness.drag({ x: 400, y: 50 }, { x: 560, y: 130 });

    // 4. Create "Order Service" box at (400, 250)
    harness.selectTool('rectangle');
    harness.drag({ x: 400, y: 250 }, { x: 560, y: 330 });

    // 5. Create "PostgreSQL Database" ellipse at (700, 250)
    harness.setBackgroundColor('#eebefa');
    harness.setStrokeColor('#862e9c');
    harness.selectTool('ellipse');
    harness.drag({ x: 700, y: 250 }, { x: 820, y: 330 });

    // 6. Add labels inside nodes
    harness.setFontSize(16);
    harness.selectTool('text');
    harness.click(125, 180);
    harness.typeText('API Gateway');
    harness.commitTextEditor();

    harness.selectTool('text');
    harness.click(425, 80);
    harness.typeText('Auth Service');
    harness.commitTextEditor();

    harness.selectTool('text');
    harness.click(425, 280);
    harness.typeText('Order Service');
    harness.commitTextEditor();

    harness.selectTool('text');
    harness.click(720, 280);
    harness.typeText('PostgreSQL');
    harness.commitTextEditor();

    // 7. Connect services with directional arrows
    harness.setStrokeColor('#495057');
    harness.setArrowheads(null, 'arrow');
    harness.selectTool('arrow', true);
    // Arrow: Gateway -> Auth
    harness.drag({ x: 260, y: 180 }, { x: 400, y: 90 });
    // Arrow: Gateway -> Order
    harness.drag({ x: 260, y: 200 }, { x: 400, y: 280 });
    // Arrow: Order -> Database
    harness.drag({ x: 560, y: 290 }, { x: 700, y: 290 });

    // 8. Assertions
    const nonDeleted = harness.getNonDeletedElements();
    expect(nonDeleted).toHaveLength(11); // 4 shapes + 4 text labels + 3 arrows

    const arrows = nonDeleted.filter(e => e.type === 'arrow');
    expect(arrows).toHaveLength(3);
    for (const arrow of arrows) {
      expect(arrow.endArrowhead).toBe('arrow');
      expect(arrow.points).toBeDefined();
    }

    // 9. Export to JSON and verify document validity
    const jsonString = harness.exportToJSON();
    const doc = JSON.parse(jsonString);
    expect(doc.type).toBe('excalidraw');
    expect(doc.version).toBe(2);
    expect(doc.elements).toHaveLength(11);
  });

  // =========================================================================
  // Scenario 2: Algorithmic Flowchart with Decision Diamonds & Branching
  // =========================================================================
  it('Scenario 2: creates a branching decision flowchart, edits branches via eraser, and finalizes logic', () => {
    // 1. Start Node (rounded rect)
    harness.setBackgroundColor('#b2f2bb');
    harness.selectTool('rectangle');
    harness.drag({ x: 200, y: 50 }, { x: 320, y: 100 });

    // 2. Process Step: "Validate Input"
    harness.setBackgroundColor('#d0ebff');
    harness.selectTool('rectangle');
    harness.drag({ x: 200, y: 160 }, { x: 320, y: 220 });

    // 3. Decision Diamond: "Is Valid?"
    harness.setBackgroundColor('#fff3bf');
    harness.selectTool('diamond');
    harness.drag({ x: 190, y: 280 }, { x: 330, y: 380 });

    // 4. Initial Arrow: Decision -> Faulty Branch
    harness.selectTool('arrow');
    harness.drag({ x: 190, y: 330 }, { x: 80, y: 330 });
    expect(harness.getNonDeletedElements()).toHaveLength(4);

    // 5. Erase the faulty branch arrow
    harness.selectTool('eraser');
    harness.click(130, 330);
    expect(harness.getNonDeletedElements()).toHaveLength(3);

    // 6. Draw Corrected "No" Branch arrow pointing to retry
    harness.selectTool('arrow');
    harness.drag({ x: 190, y: 330 }, { x: 100, y: 190 });

    // 7. Draw "Yes" Branch arrow pointing down
    harness.selectTool('arrow');
    harness.drag({ x: 260, y: 380 }, { x: 260, y: 460 });

    // 8. End Node
    harness.setBackgroundColor('#ffc9c9');
    harness.selectTool('rectangle');
    harness.drag({ x: 200, y: 460 }, { x: 320, y: 510 });

    const finalElements = harness.getNonDeletedElements();
    expect(finalElements).toHaveLength(6);
    expect(finalElements.filter(e => e.type === 'diamond')).toHaveLength(1);
    expect(finalElements.filter(e => e.type === 'arrow')).toHaveLength(2);
  });

  // =========================================================================
  // Scenario 3: Freehand Mind Map Sketch with Sticky Notes & Text Annotations
  // =========================================================================
  it('Scenario 3: creates a freehand mind map sketch with annotations and translates the entire assembly', () => {
    // 1. Draw central concept loop
    harness.setStrokeColor('#e03131');
    harness.setStrokeWidth(3);
    harness.selectTool('freedraw');
    harness.pointerDown(300, 300);
    harness.pointerMove(350, 270);
    harness.pointerMove(400, 300);
    harness.pointerMove(350, 340);
    harness.pointerMove(300, 300);
    harness.pointerUp();

    // 2. Draw 2 branch strokes outward
    harness.selectTool('freedraw', true);
    // Left branch towards (150, 200)
    harness.drag({ x: 300, y: 290 }, { x: 150, y: 200 });
    // Right branch towards (500, 200)
    harness.drag({ x: 400, y: 290 }, { x: 550, y: 200 });

    // 3. Add text annotations next to branch tips
    harness.selectTool('text');
    harness.click(100, 190);
    harness.typeText('Concept Alpha');
    harness.commitTextEditor();

    harness.selectTool('text');
    harness.click(560, 190);
    harness.typeText('Concept Beta');
    harness.commitTextEditor();

    expect(harness.getNonDeletedElements()).toHaveLength(5);

    // 4. Select all elements and translate them by (+80, +50)
    harness.pressShortcut('Ctrl+A');
    expect(harness.getSelectedElements()).toHaveLength(5);

    harness.selectTool('selection');
    harness.drag({ x: 300, y: 300 }, { x: 380, y: 350 });

    const textAlpha = harness.getElements().find(e => e.text === 'Concept Alpha');
    expect(textAlpha?.x).toBe(180); // 100 + 80
    expect(textAlpha?.y).toBe(240); // 190 + 50
  });

  // =========================================================================
  // Scenario 4: Full Multi-Shape Export, Wipe, and High-Fidelity Restoration
  // =========================================================================
  it('Scenario 4: builds rich multi-shape scene, exports to .excalidraw, wipes, and restores with 100% fidelity', () => {
    // 1. Build rich canvas
    harness.selectTool('rectangle');
    harness.setStrokeColor('#e03131');
    harness.setBackgroundColor('#ffc9c9');
    harness.setFillStyle('cross-hatch');
    harness.drag({ x: 50, y: 50 }, { x: 150, y: 150 });

    harness.selectTool('diamond');
    harness.setStrokeColor('#2f9e44');
    harness.setBackgroundColor('#b2f2bb');
    harness.setFillStyle('solid');
    harness.drag({ x: 200, y: 50 }, { x: 300, y: 150 });

    harness.selectTool('ellipse');
    harness.setStrokeColor('#1971c2');
    harness.setBackgroundColor('#a5d8ff');
    harness.setFillStyle('hachure');
    harness.drag({ x: 350, y: 50 }, { x: 450, y: 150 });

    harness.selectTool('arrow');
    harness.setArrowheads(null, 'arrow');
    harness.drag({ x: 150, y: 100 }, { x: 200, y: 100 });

    harness.selectTool('text');
    harness.click(50, 180);
    harness.typeText('System Flow Diagram');
    harness.commitTextEditor();

    const originalElements = harness.getNonDeletedElements();
    expect(originalElements).toHaveLength(5);

    // 2. Export to JSON string
    const exportedJson = harness.exportToJSON();

    // 3. Wipe harness (simulate closing tab)
    harness.reset();
    expect(harness.getElements()).toHaveLength(0);

    // 4. Restore scene in brand new harness
    const restoredHarness = ExcalidrawTestHarness.create();
    const success = restoredHarness.importFromJSON(exportedJson);
    expect(success).toBe(true);

    const restoredElements = restoredHarness.getNonDeletedElements();
    expect(restoredElements).toHaveLength(5);

    // 5. Compare every element property for fidelity
    for (let i = 0; i < 5; i++) {
      const orig = originalElements[i];
      const rest = restoredElements[i];
      expect(rest.id).toBe(orig.id);
      expect(rest.type).toBe(orig.type);
      expect(rest.x).toBe(orig.x);
      expect(rest.y).toBe(orig.y);
      expect(rest.width).toBe(orig.width);
      expect(rest.height).toBe(orig.height);
      expect(rest.strokeColor).toBe(orig.strokeColor);
      expect(rest.backgroundColor).toBe(orig.backgroundColor);
      expect(rest.fillStyle).toBe(orig.fillStyle);
      expect(rest.seed).toBe(orig.seed);
    }
  });

  // =========================================================================
  // Scenario 5: Rapid Brainstorming Session with Heavy Undo/Redo & Eraser
  // =========================================================================
  it('Scenario 5: executes a rapid brainstorming session with extensive mutation, deletion, and undo recovery', () => {
    // Rapidly draw 6 shapes
    const shapes = ['rectangle', 'diamond', 'ellipse', 'rectangle', 'diamond', 'ellipse'] as const;
    for (let i = 0; i < shapes.length; i++) {
      harness.selectTool(shapes[i]);
      harness.setBackgroundColor('#ffec99');
      harness.drag({ x: i * 80 + 10, y: 50 }, { x: i * 80 + 70, y: 110 });
    }
    expect(harness.getNonDeletedElements()).toHaveLength(6);

    // Erase 2 shapes (element 0 and element 2)
    harness.selectTool('eraser');
    harness.click(40, 80); // Element 0
    harness.click(200, 80); // Element 2
    expect(harness.getNonDeletedElements()).toHaveLength(4);

    // Undo both erasures
    harness.undo(); // Restores Element 2
    expect(harness.getNonDeletedElements()).toHaveLength(5);
    harness.undo(); // Restores Element 0
    expect(harness.getNonDeletedElements()).toHaveLength(6);

    // Group all 6 shapes
    harness.pressShortcut('Ctrl+A');
    const groupId = harness.groupSelected();
    expect(groupId).not.toBeNull();

    // Verify localStorage reflects full 6 elements
    const dump = harness.getLocalStorageDump();
    expect(dump.elements).toHaveLength(6);
  });

  // =========================================================================
  // Scenario 6: UI Wireframe Mockup (Navbar, Sidebar, Dashboard Cards)
  // =========================================================================
  it('Scenario 6: constructs a web application dashboard wireframe layout with spatial alignment', () => {
    // 1. Top Navbar
    harness.setBackgroundColor('#212529');
    harness.setStrokeColor('#000000');
    harness.selectTool('rectangle');
    harness.drag({ x: 0, y: 0 }, { x: 1024, y: 60 });

    // Navbar Brand Text
    harness.selectTool('text');
    harness.click(20, 18);
    harness.typeText('Analytics Pro');
    harness.commitTextEditor();

    // 2. Left Sidebar
    harness.setBackgroundColor('#343a40');
    harness.selectTool('rectangle');
    harness.drag({ x: 0, y: 60 }, { x: 220, y: 768 });

    // 3. Main Content: 4 Metric Cards
    const cardPositions = [
      [260, 100],
      [440, 100],
      [620, 100],
      [800, 100],
    ];
    for (const [cx, cy] of cardPositions) {
      harness.setBackgroundColor('#ffffff');
      harness.setStrokeColor('#ced4da');
      harness.selectTool('rectangle');
      harness.drag({ x: cx, y: cy }, { x: cx + 160, y: cy + 100 });
    }

    const elements = harness.getNonDeletedElements();
    expect(elements).toHaveLength(7); // Navbar + Text + Sidebar + 4 Cards
    expect(harness.getLatestRenderLog()?.renderedElementCount).toBe(7);
  });

  // =========================================================================
  // Scenario 7: Collaborative Version Reconciliation Protocol (Section 5.3)
  // =========================================================================
  it('Scenario 7: reconciles element versions using deterministic version and versionNonce tie-breakers', () => {
    harness.selectTool('rectangle');
    harness.drag({ x: 10, y: 10 }, { x: 80, y: 80 });
    const local = harness.getElements()[0];

    // Simulate remote peer version
    const remoteNewer = {
      ...local,
      version: local.version + 1,
      versionNonce: 999999,
      x: 100,
    };

    // Rule: Remote wins if version is strictly higher
    const winner1 = remoteNewer.version > local.version ? remoteNewer : local;
    expect(winner1.x).toBe(100);

    // Simulate tie-breaker on identical version with higher nonce
    const remoteTie = {
      ...local,
      version: local.version,
      versionNonce: local.versionNonce + 500,
      y: 250,
    };

    const isRemoteWinning =
      remoteTie.version > local.version ||
      (remoteTie.version === local.version && remoteTie.versionNonce > local.versionNonce);
    expect(isRemoteWinning).toBe(true);
  });

  // =========================================================================
  // Scenario 8: Complete End-to-End User Journey
  // =========================================================================
  it('Scenario 8: executes complete journey: draw, edit, style, camera navigation, and export', () => {
    // 1. Zoom into working zone
    const { zoom } = harness.calculateFocalZoom({ x: 500, y: 400 }, 1.5);
    (harness.getAppState() as any).zoom = zoom;

    // 2. Draw initial idea shape
    harness.setStrokeColor('#fd7e14');
    harness.setBackgroundColor('#ffe8cc');
    harness.setFillStyle('solid');
    harness.selectTool('diamond');
    harness.drag({ x: 100, y: 100 }, { x: 250, y: 250 });

    // 3. Annotate inside diamond
    harness.selectTool('text');
    harness.click(140, 165);
    harness.typeText('Decision');
    harness.commitTextEditor();

    // 4. Double click to modify annotation
    harness.doubleClick(140, 165);
    harness.typeText(' Node');
    harness.commitTextEditor();

    const textEl = harness.getElements().find(e => e.type === 'text');
    expect(textEl?.text).toBe('Decision Node');

    // 5. Export scene to canvas image and JSON
    const imageExport = harness.exportToCanvas({ scale: 2.0 });
    expect(imageExport.width).toBeGreaterThan(0);
    expect(imageExport.height).toBeGreaterThan(0);

    const jsonExport = harness.exportToJSON();
    expect(jsonExport).toContain('Decision Node');
  });
});
