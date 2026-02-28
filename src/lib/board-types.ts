export type ThemeId = 'whiteboard' | 'chalkboard' | 'neon-grid';

export type DrawingTool =
	| 'select'
	| 'pen'
	| 'eraser'
	| 'rect'
	| 'ellipse'
	| 'triangle'
	| 'line-h'
	| 'line-v'
	| 'text'
	| 'image'
	| 'connector';

/** Line style for connector: solid, dashed, or double line */
export type ConnectorStyle = 'solid' | 'dashed' | 'double';
/** Path type: orthogonal (right-angle) or curved (wavy) */
export type ConnectorType = 'orthogonal' | 'curved';
/** Arrow at start/end of connector */
export type ConnectorArrow = 'none' | 'arrow';
/** Arrow direction: auto (along path) or fixed n/s/e/w */
export type ConnectorArrowDirection = 'auto' | 'n' | 's' | 'e' | 'w';
/** Anchor id on a shape edge (e.g. "n", "s", "n-mid" for rect; "0", "1-mid" for triangle) */
export type ConnectorAnchorId = string;

export type TextAlign = 'left' | 'center' | 'right';
export type TextVerticalAlign = 'top' | 'middle' | 'bottom';
export type AlignMode = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
/** Which of the 8 resize handles is being dragged (compass directions). */
export type ResizeHandle = 'nw' | 'n' | 'ne' | 'w' | 'e' | 'sw' | 's' | 'se';
export type DistributeMode = 'horizontal' | 'vertical';
export type Axis = 'x' | 'y';
export type Orientation = 'vertical' | 'horizontal';

export interface Point {
	x: number;
	y: number;
}

export interface Stroke {
	id: string;
	tool: 'pen' | 'eraser';
	color: string;
	size: number;
	points: Point[];
}

export interface BoardElement {
	id: string;
	groupId?: string;
	type: 'rect' | 'ellipse' | 'triangle' | 'line-h' | 'line-v' | 'text' | 'image' | 'connector';
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
	strokeColor: string;
	fillColor: string;
	borderWidth: number;
	text: string;
	textAlign: TextAlign;
	textVerticalAlign: TextVerticalAlign;
	fontSize: number;
	/** base64 data-URL stored when type === 'image' */
	imageDataUrl?: string;
	/** Connector-only: start shape and anchor */
	startElementId?: string;
	startAnchor?: ConnectorAnchorId;
	/** Connector-only: end shape and anchor */
	endElementId?: string;
	endAnchor?: ConnectorAnchorId;
	connectorStyle?: ConnectorStyle;
	connectorType?: ConnectorType;
	startArrow?: ConnectorArrow;
	endArrow?: ConnectorArrow;
	/** Start arrow fixed direction (when startArrow === 'arrow') */
	startArrowDirection?: ConnectorArrowDirection;
	/** End arrow fixed direction (when endArrow === 'arrow') */
	endArrowDirection?: ConnectorArrowDirection;
	/** Orthogonal: x of the vertical segment (default: midpoint). Dragging the bend updates this. */
	connectorBendX?: number;
	/** Curved: quadratic bezier control point. When set, path uses this instead of default. */
	connectorControlX?: number;
	connectorControlY?: number;
	/** Self-connection: bend point (when startElementId === endElementId). Dragging updates this. */
	connectorSelfBendX?: number;
	connectorSelfBendY?: number;
	/** Arrow head size (user units). Default 10. */
	connectorArrowSize?: number;
}

export interface BoardData {
	id: string;
	title: string;
	themeId: ThemeId;
	createdAt: string;
	updatedAt: string;
	strokes: Stroke[];
	elements: BoardElement[];
	thumbnail?: string;
	/** Saved canvas dimensions so they persist across reloads */
	width?: number;
	height?: number;
	gridEnabled?: boolean;
	gridSize?: number;
}

export interface BoardTheme {
	id: ThemeId;
	label: string;
	background: string;
	gridColor: string;
	defaultStrokeColor: string;
	defaultFillColor: string;
}

export interface GuideLine {
	orientation: Orientation;
	value: number;
}

export interface GuideDistance {
	x: number;
	y: number;
	text: string;
}

export interface Bounds {
	x: number;
	y: number;
	right: number;
	bottom: number;
	width: number;
	height: number;
	centerX: number;
	centerY: number;
}

export interface GroupBox {
	groupId: string;
	x: number;
	y: number;
	width: number;
	height: number;
}

export type InteractionState =
	| null
	| { kind: 'drawing'; pointerId: number }
	| { kind: 'erasing'; pointerId: number }
	| {
			kind: 'drag';
			pointerId: number;
			start: Point;
			elementIds: string[];
			originById: Record<string, Point>;
	  }
	| {
			kind: 'resize';
			pointerId: number;
			elementId: string;
			/** Which handle is being dragged (compass: nw/n/ne/w/e/sw/s/se). */
			handle: ResizeHandle;
			start: Point;
			originX: number;
			originY: number;
			originWidth: number;
			originHeight: number;
	  }
	| {
			kind: 'rotate';
			pointerId: number;
			elementId: string;
			center: Point;
			startAngle: number;
			originRotation: number;
	  }
	| { kind: 'marquee'; pointerId: number; start: Point; current: Point; append: boolean }
	| {
			kind: 'connector-bend';
			pointerId: number;
			connectorId: string;
			start: Point;
			originalBendX?: number;
			originalBendY?: number;
			originalControlX?: number;
			originalControlY?: number;
	  };

export interface Snapshot {
	strokes: Stroke[];
	elements: BoardElement[];
	themeId: ThemeId;
	stageWidth: number;
	stageHeight: number;
	gridEnabled: boolean;
	gridSize: number;
}

export interface ToolItem {
	tool: DrawingTool;
	label: string;
	icon: string;
}

/* ── Tool SVG icons ── */
const SELECT_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m4 4 7.07 17 2.51-7.39L21 11.07z"/></svg>`;
const PEN_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`;
const ERASER_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21H7z"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>`;
const RECT_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`;
const ELLIPSE_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/></svg>`;
const TRIANGLE_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 20h20L12 2z"/></svg>`;
const LINE_H_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="2" y1="12" x2="22" y2="12"/></svg>`;
const LINE_V_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="2" x2="12" y2="22"/></svg>`;
const TEXT_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>`;
const IMAGE_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
const CONNECTOR_ICON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4v16l5-5 5 5V4"/><path d="M2 12h4"/><path d="M18 12h4"/></svg>`;

export const TOOL_ITEMS: ToolItem[] = [
	{ tool: 'select', label: 'Select', icon: SELECT_ICON },
	{ tool: 'pen', label: 'Pen', icon: PEN_ICON },
	{ tool: 'eraser', label: 'Eraser', icon: ERASER_ICON },
	{ tool: 'rect', label: 'Rectangle', icon: RECT_ICON },
	{ tool: 'ellipse', label: 'Ellipse', icon: ELLIPSE_ICON },
	{ tool: 'triangle', label: 'Triangle', icon: TRIANGLE_ICON },
	{ tool: 'line-h', label: 'H-Line', icon: LINE_H_ICON },
	{ tool: 'line-v', label: 'V-Line', icon: LINE_V_ICON },
	{ tool: 'text', label: 'Text', icon: TEXT_ICON },
	{ tool: 'image', label: 'Image', icon: IMAGE_ICON }
];

/** Element types that can have connectors attached (anchors) */
export const CONNECTABLE_TYPES: BoardElement['type'][] = ['rect', 'ellipse', 'triangle', 'text', 'image'];

export const BOARD_THEMES: BoardTheme[] = [
	{
		id: 'whiteboard',
		label: 'Whiteboard',
		background: '#ffffff',
		gridColor: '#f1f5f9',
		defaultStrokeColor: '#111827',
		defaultFillColor: '#ffffff'
	},
	{
		id: 'chalkboard',
		label: 'Chalkboard',
		background: '#10362f',
		gridColor: 'rgba(255,255,255,0.07)',
		defaultStrokeColor: '#f8fafc',
		defaultFillColor: '#1f4d43'
	},
	{
		id: 'neon-grid',
		label: 'Neon Grid',
		background: '#080c24',
		gridColor: 'rgba(56, 189, 248, 0.18)',
		defaultStrokeColor: '#e2e8f0',
		defaultFillColor: '#0f172a'
	}
];

export const EMPTY_BOARD_CONTENT = {
	strokes: [] as Stroke[],
	elements: [] as BoardElement[]
};

/** Types that support inline text editing */
export const TEXT_EDITABLE_TYPES: BoardElement['type'][] = ['rect', 'ellipse', 'text'];
