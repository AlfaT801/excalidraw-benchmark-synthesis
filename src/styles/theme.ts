export const THEME_COLORS = {
  canvasBackground: {
    light: '#ffffff',
    dark: '#121212',
  },
  gridColor: {
    light: '#e0e0e0',
    dark: '#2c2c2c',
  },
  primaryStrokeColors: [
    '#1e1e1e', // Charcoal Black
    '#e03131', // Crimson Red
    '#2f9e44', // Forest Green
    '#1971c2', // Ocean Blue
    '#f08c00', // Amber Orange
    '#9c36b5', // Purple
  ],
  backgroundFillColors: [
    'transparent',
    '#ffc9c9', // Light Red
    '#b2f2bb', // Light Green
    '#a5d8ff', // Light Blue
    '#ffec99', // Light Yellow
    '#eebefa', // Light Purple
  ],
  selectionBorder: '#6965db',
  selectionFill: 'rgba(105, 101, 219, 0.1)',
} as const;

export const DEFAULT_APP_STATE_VALUES = {
  scrollX: 0,
  scrollY: 0,
  zoom: { value: 1.0 },
  width: 0,
  height: 0,
  offsetLeft: 0,
  offsetTop: 0,
  activeTool: {
    type: 'selection' as const,
    locked: false,
    lastActiveTool: null,
  },
  selectedElementIds: {},
  hoveredElementId: null,
  selectedGroupIds: {},
  editingElement: null,
  resizingElement: null,
  draggingElement: null,
  selectionElement: null,
  cursorX: 0,
  cursorY: 0,
  isResizing: false,
  isRotating: false,
  isDragging: false,
  currentItemStrokeColor: '#1e1e1e',
  currentItemBackgroundColor: 'transparent',
  currentItemFillStyle: 'solid' as const,
  currentItemStrokeWidth: 2,
  currentItemStrokeStyle: 'solid' as const,
  currentItemRoughness: 1 as const,
  currentItemOpacity: 100,
  currentItemFontFamily: 1 as const,
  currentItemFontSize: 20,
  currentItemTextAlign: 'left' as const,
  currentItemStartArrowhead: null,
  currentItemEndArrowhead: 'arrow' as const,
  currentItemRoundness: 'round' as const,
  viewBackgroundColor: '#ffffff',
  gridSize: 20,
  gridStep: 5,
  gridModeEnabled: false,
  theme: 'light' as const,
  zenModeEnabled: false,
  viewModeEnabled: false,
};
