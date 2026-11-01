import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ExcalidrawElement } from '../types/element';
import { AppState } from '../types/state';
import {
  viewportCoordsToSceneCoords,
} from '../math/coordinates';
import { calculateZoomFromWheel } from '../math/zoom';
import {
  renderInteractiveScene,
  renderStaticScene,
  SelectionBox,
} from '../renderer/canvas';
import {
  newRectangleElement,
  newDiamondElement,
  newEllipseElement,
  newLineElement,
  newArrowElement,
  newFreeDrawElement,
} from '../element/newElement';

export interface CanvasProps {
  elements: readonly ExcalidrawElement[];
  appState: AppState;
  onUpdateElements: (elements: readonly ExcalidrawElement[]) => void;
  onUpdateAppState: (updater: (prev: AppState) => AppState) => void;
  onCommitElement: (element: ExcalidrawElement) => void;
}

export const Canvas: React.FC<CanvasProps> = ({
  elements,
  appState,
  onUpdateAppState,
  onCommitElement,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const staticCanvasRef = useRef<HTMLCanvasElement>(null);
  const interactiveCanvasRef = useRef<HTMLCanvasElement>(null);

  // Interactive interaction state
  const [draftElement, setDraftElement] = useState<ExcalidrawElement | null>(null);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);

  // Gesture state tracking refs
  const isInteractingRef = useRef(false);
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ clientX: number; clientY: number; scrollX: number; scrollY: number }>({
    clientX: 0,
    clientY: 0,
    scrollX: 0,
    scrollY: 0,
  });
  const originScenePointRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // 1. ResizeObserver: Keep canvas dimensions synchronized with container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const rect = container.getBoundingClientRect();
        onUpdateAppState((prev) => ({
          ...prev,
          width,
          height,
          offsetLeft: rect.left,
          offsetTop: rect.top,
        }));
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [onUpdateAppState]);

  // 2. Static Canvas Render Effect
  useEffect(() => {
    const canvas = staticCanvasRef.current;
    if (!canvas || appState.width === 0 || appState.height === 0) return;

    renderStaticScene(canvas, elements, appState);
  }, [
    elements,
    appState.width,
    appState.height,
    appState.scrollX,
    appState.scrollY,
    appState.zoom.value,
    appState.viewBackgroundColor,
  ]);

  // 3. Interactive Canvas Render Loop
  const renderInteractive = useCallback(() => {
    const canvas = interactiveCanvasRef.current;
    if (!canvas || appState.width === 0 || appState.height === 0) return;

    const selectedElements = elements.filter(
      (el) => appState.selectedElementIds[el.id] && !el.isDeleted,
    );

    renderInteractiveScene(
      canvas,
      appState,
      draftElement,
      selectedElements,
      selectionBox,
    );
  }, [elements, appState, draftElement, selectionBox]);

  useEffect(() => {
    renderInteractive();
  }, [renderInteractive]);

  // 4. Pointer Event Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const container = containerRef.current;
    if (!container) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    isInteractingRef.current = true;

    const rect = container.getBoundingClientRect();
    const scenePoint = viewportCoordsToSceneCoords(e.clientX, e.clientY, appState, rect);
    originScenePointRef.current = scenePoint;

    // Check for Panning trigger (middle mouse button, space held, or hand tool)
    if (e.button === 1 || e.buttons === 4 || appState.activeTool.type === 'hand') {
      isPanningRef.current = true;
      panStartRef.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        scrollX: appState.scrollX,
        scrollY: appState.scrollY,
      };
      return;
    }

    // Only process left click for creation/selection
    if (e.button !== 0) return;

    const toolType = appState.activeTool.type;

    if (toolType === 'rectangle') {
      setDraftElement(newRectangleElement({ x: scenePoint.x, y: scenePoint.y }, appState));
    } else if (toolType === 'diamond') {
      setDraftElement(newDiamondElement({ x: scenePoint.x, y: scenePoint.y }, appState));
    } else if (toolType === 'ellipse') {
      setDraftElement(newEllipseElement({ x: scenePoint.x, y: scenePoint.y }, appState));
    } else if (toolType === 'line') {
      setDraftElement(newLineElement({ x: scenePoint.x, y: scenePoint.y, points: [[0, 0]] }, appState));
    } else if (toolType === 'arrow') {
      setDraftElement(newArrowElement({ x: scenePoint.x, y: scenePoint.y, points: [[0, 0]] }, appState));
    } else if (toolType === 'freedraw') {
      setDraftElement(
        newFreeDrawElement(
          {
            x: scenePoint.x,
            y: scenePoint.y,
            points: [[0, 0]],
            pressures: [e.pressure || 0.5],
          },
          appState,
        ),
      );
    } else if (toolType === 'selection') {
      // Start marquee selection box
      setSelectionBox({
        startX: scenePoint.x,
        startY: scenePoint.y,
        currentX: scenePoint.x,
        currentY: scenePoint.y,
      });
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isInteractingRef.current) return;

    const container = containerRef.current;
    if (!container) return;

    // Handle Panning
    if (isPanningRef.current) {
      const dx = (e.clientX - panStartRef.current.clientX) / appState.zoom.value;
      const dy = (e.clientY - panStartRef.current.clientY) / appState.zoom.value;
      onUpdateAppState((prev) => ({
        ...prev,
        scrollX: panStartRef.current.scrollX + dx,
        scrollY: panStartRef.current.scrollY + dy,
      }));
      return;
    }

    const rect = container.getBoundingClientRect();
    const currentScenePoint = viewportCoordsToSceneCoords(e.clientX, e.clientY, appState, rect);

    // Update Draft Element
    if (draftElement) {
      const origin = originScenePointRef.current;

      if (
        draftElement.type === 'rectangle' ||
        draftElement.type === 'ellipse' ||
        draftElement.type === 'diamond'
      ) {
        let width = currentScenePoint.x - origin.x;
        let height = currentScenePoint.y - origin.y;

        // Shift key constraint for 1:1 aspect ratio
        if (e.shiftKey) {
          const side = Math.max(Math.abs(width), Math.abs(height));
          width = Math.sign(width || 1) * side;
          height = Math.sign(height || 1) * side;
        }

        const x = width < 0 ? origin.x + width : origin.x;
        const y = height < 0 ? origin.y + height : origin.y;

        setDraftElement({
          ...draftElement,
          x,
          y,
          width: Math.abs(width),
          height: Math.abs(height),
          version: draftElement.version + 1,
        });
      } else if (draftElement.type === 'line' || draftElement.type === 'arrow') {
        const dx = currentScenePoint.x - origin.x;
        const dy = currentScenePoint.y - origin.y;
        setDraftElement({
          ...draftElement,
          width: Math.abs(dx),
          height: Math.abs(dy),
          points: [
            [0, 0],
            [dx, dy],
          ],
          version: draftElement.version + 1,
        });
      } else if (draftElement.type === 'freedraw') {
        const dx = currentScenePoint.x - draftElement.x;
        const dy = currentScenePoint.y - draftElement.y;
        const nextPoints = [...(draftElement.points || []), [dx, dy] as [number, number]];
        const nextPressures = [...(draftElement.pressures || []), e.pressure || 0.5];

        setDraftElement({
          ...draftElement,
          points: nextPoints,
          pressures: nextPressures,
          version: draftElement.version + 1,
        });
      }
    } else if (selectionBox) {
      setSelectionBox((prev) =>
        prev ? { ...prev, currentX: currentScenePoint.x, currentY: currentScenePoint.y } : null,
      );
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    isInteractingRef.current = false;

    if (isPanningRef.current) {
      isPanningRef.current = false;
      return;
    }

    if (draftElement) {
      // Validate element (filter out accidental zero-size clicks)
      const isValid =
        (draftElement.type === 'freedraw' && (draftElement.points?.length ?? 0) > 1) ||
        (draftElement.type !== 'freedraw' &&
          (draftElement.width >= 2 || draftElement.height >= 2));

      if (isValid) {
        onCommitElement(draftElement);
      }

      setDraftElement(null);
    }

    if (selectionBox) {
      setSelectionBox(null);
    }
  };

  // 5. Wheel Handler for 2D Panning & Focal Zoom
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();

    if (e.ctrlKey || e.metaKey) {
      // Focal Zoom
      const newZoomState = calculateZoomFromWheel(
        { clientX: e.clientX, clientY: e.clientY },
        e.deltaY,
        appState,
        rect,
      );
      onUpdateAppState((prev) => ({
        ...prev,
        zoom: newZoomState.zoom,
        scrollX: newZoomState.scrollX,
        scrollY: newZoomState.scrollY,
      }));
    } else {
      // 2D Pan
      const zoom = appState.zoom.value;
      onUpdateAppState((prev) => ({
        ...prev,
        scrollX: prev.scrollX - e.deltaX / zoom,
        scrollY: prev.scrollY - e.deltaY / zoom,
      }));
    }
  };

  return (
    <div
      ref={containerRef}
      className="canvas-container"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      {/* Layer 1: Static Scene Canvas */}
      <canvas
        ref={staticCanvasRef}
        id="static-canvas"
        className="static-canvas canvas-layer"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* Layer 2: Interactive Draft and Overlay Canvas */}
      <canvas
        ref={interactiveCanvasRef}
        id="interactive-canvas"
        className="interactive-canvas canvas-layer canvas-interactive"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'auto',
          zIndex: 2,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
};

export default Canvas;
