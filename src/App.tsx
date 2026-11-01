import React, { useState, useCallback } from 'react';
import {
  MousePointer,
  Square,
  Diamond,
  Circle,
  Minus,
  ArrowRight,
  Pencil,
  Hand,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
import { Canvas } from './components/Canvas';
import { ExcalidrawElement, ToolType } from './types/element';
import { AppState } from './types/state';
import { DEFAULT_APP_STATE_VALUES } from './styles/theme';
import { zoomIn, zoomOut, resetZoom } from './math/zoom';

const TOOLS: { type: ToolType; label: string; icon: React.ReactNode }[] = [
  { type: 'selection', label: 'Selection (V)', icon: <MousePointer size={18} /> },
  { type: 'rectangle', label: 'Rectangle (R)', icon: <Square size={18} /> },
  { type: 'diamond', label: 'Diamond (D)', icon: <Diamond size={18} /> },
  { type: 'ellipse', label: 'Ellipse (E)', icon: <Circle size={18} /> },
  { type: 'line', label: 'Line (L)', icon: <Minus size={18} /> },
  { type: 'arrow', label: 'Arrow (A)', icon: <ArrowRight size={18} /> },
  { type: 'freedraw', label: 'Draw (P)', icon: <Pencil size={18} /> },
  { type: 'hand', label: 'Hand Pan (H)', icon: <Hand size={18} /> },
];

export const App: React.FC = () => {
  const [elements, setElements] = useState<readonly ExcalidrawElement[]>([]);
  const [appState, setAppState] = useState<AppState>(DEFAULT_APP_STATE_VALUES as AppState);

  const handleUpdateElements = useCallback((nextElements: readonly ExcalidrawElement[]) => {
    setElements(nextElements);
  }, []);

  const handleUpdateAppState = useCallback((updater: (prev: AppState) => AppState) => {
    setAppState((prev) => updater(prev));
  }, []);

  const handleCommitElement = useCallback((element: ExcalidrawElement) => {
    setElements((prev) => [...prev, element]);
  }, []);

  const handleSelectTool = (tool: ToolType) => {
    setAppState((prev) => ({
      ...prev,
      activeTool: {
        ...prev.activeTool,
        type: tool,
      },
    }));
  };

  const handleZoomIn = () => {
    const res = zoomIn({ width: appState.width, height: appState.height }, appState);
    setAppState((prev) => ({
      ...prev,
      zoom: res.zoom,
      scrollX: res.scrollX,
      scrollY: res.scrollY,
    }));
  };

  const handleZoomOut = () => {
    const res = zoomOut({ width: appState.width, height: appState.height }, appState);
    setAppState((prev) => ({
      ...prev,
      zoom: res.zoom,
      scrollX: res.scrollX,
      scrollY: res.scrollY,
    }));
  };

  const handleResetZoom = () => {
    const res = resetZoom({ width: appState.width, height: appState.height }, appState);
    setAppState((prev) => ({
      ...prev,
      zoom: res.zoom,
      scrollX: res.scrollX,
      scrollY: res.scrollY,
    }));
  };

  const zoomPercent = Math.round(appState.zoom.value * 100);

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: appState.viewBackgroundColor,
      }}
    >
      {/* Top Center Floating Toolbar */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 4,
          padding: 4,
          backgroundColor: '#ffffff',
          borderRadius: 8,
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e0e0e0',
          zIndex: 10,
        }}
      >
        {TOOLS.map((t) => {
          const isActive = appState.activeTool.type === t.type;
          return (
            <button
              key={t.type}
              type="button"
              title={t.label}
              onClick={() => handleSelectTool(t.type)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: isActive ? '#e0e7ff' : 'transparent',
                color: isActive ? '#4338ca' : '#4b5563',
                transition: 'background-color 0.15s ease',
              }}
            >
              {t.icon}
            </button>
          );
        })}
      </div>

      {/* Top Left Title and Status Banner */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          padding: '8px 14px',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
          border: '1px solid #e0e0e0',
          fontSize: 13,
          fontWeight: 600,
          color: '#1e1e1e',
          zIndex: 10,
          pointerEvents: 'none',
        }}
      >
        Excalidraw Clone &middot; M1 ({elements.length} elements)
      </div>

      {/* Bottom Left Camera / Zoom Control Bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: 4,
          backgroundColor: '#ffffff',
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
          border: '1px solid #e0e0e0',
          fontSize: 12,
          fontWeight: 600,
          color: '#4b5563',
          zIndex: 10,
        }}
      >
        <button
          type="button"
          title="Zoom Out"
          onClick={handleZoomOut}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            backgroundColor: 'transparent',
            color: '#4b5563',
          }}
        >
          <ZoomOut size={16} />
        </button>
        <span
          style={{
            minWidth: 44,
            textAlign: 'center',
            userSelect: 'none',
          }}
        >
          {zoomPercent}%
        </span>
        <button
          type="button"
          title="Zoom In"
          onClick={handleZoomIn}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            backgroundColor: 'transparent',
            color: '#4b5563',
          }}
        >
          <ZoomIn size={16} />
        </button>
        <button
          type="button"
          title="Reset Zoom to 100%"
          onClick={handleResetZoom}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            backgroundColor: 'transparent',
            color: '#4b5563',
          }}
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Multi-Layer Canvas */}
      <Canvas
        elements={elements}
        appState={appState}
        onUpdateElements={handleUpdateElements}
        onUpdateAppState={handleUpdateAppState}
        onCommitElement={handleCommitElement}
      />
    </div>
  );
};

export default App;
