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
	| 'image';

export type TextAlign = 'left' | 'center' | 'right';
export type TextVerticalAlign = 'top' | 'middle' | 'bottom';
export type AlignMode = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
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
	type: 'rect' | 'ellipse' | 'triangle' | 'line-h' | 'line-v' | 'text' | 'image';
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
			start: Point;
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
	| { kind: 'marquee'; pointerId: number; start: Point; current: Point; append: boolean };

export interface Snapshot {
	strokes: Stroke[];
	elements: BoardElement[];
	themeId: ThemeId;
	stageWidth: number;
	stageHeight: number;
}

export interface ToolItem {
	tool: DrawingTool;
	label: string;
	icon: string;
}

/* Mouse-pointer (cursor arrow) SVG for the select/move tool */
const GRAB_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="m4 4 7.07 17 2.51-7.39L21 11.07z"/>
</svg>`;

/* Image/picture SVG icon */
const IMAGE_ICON = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;

export const TOOL_ITEMS: ToolItem[] = [
	{ tool: 'select', label: '선택', icon: GRAB_ICON },
	{ tool: 'pen', label: '펜', icon: '✏️' },
	{ tool: 'eraser', label: '지우개', icon: '🧹' },
	{ tool: 'rect', label: '사각형', icon: '⬜' },
	{ tool: 'ellipse', label: '원', icon: '⭕' },
	{ tool: 'triangle', label: '삼각형', icon: '△' },
	{ tool: 'line-h', label: '가로선', icon: '━' },
	{ tool: 'line-v', label: '세로선', icon: '┃' },
	{ tool: 'text', label: '텍스트', icon: '🔤' },
	{ tool: 'image', label: '이미지', icon: IMAGE_ICON }
];

export const BOARD_THEMES: BoardTheme[] = [
	{
		id: 'whiteboard',
		label: '화이트보드',
		background: '#ffffff',
		gridColor: '#f1f5f9',
		defaultStrokeColor: '#111827',
		defaultFillColor: '#ffffff'
	},
	{
		id: 'chalkboard',
		label: '칠판',
		background: '#10362f',
		gridColor: 'rgba(255,255,255,0.07)',
		defaultStrokeColor: '#f8fafc',
		defaultFillColor: '#1f4d43'
	},
	{
		id: 'neon-grid',
		label: '네온 그리드',
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
