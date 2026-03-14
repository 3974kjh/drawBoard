import type { Point } from './Point.js';
import type { ResizeHandle } from './AliasTypes.js';

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
			handle: ResizeHandle;
			start: Point;
			originX: number;
			originY: number;
			originWidth: number;
			originHeight: number;
			/** Element rotation (degrees) at pointer down; when non-zero, resize uses rotated handle directions. */
			originRotation?: number;
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
			/** True when orthogonal path is vertical-first (V-H-V); bend drag updates connectorBendY. */
			orthogonalBendVertical?: boolean;
	  }
	| {
			kind: 'resize-group';
			pointerId: number;
			handle: ResizeHandle;
			start: Point;
			originBounds: { x: number; y: number; width: number; height: number };
			/** Bbox rotation (degrees) at pointer down; when set, scale is applied in bbox-local space. */
			originBboxRotation?: number;
			/** Last computed new bounds during resize; used to persist bbox on pointer up. */
			lastNewBounds?: { x: number; y: number; width: number; height: number };
			/** Snapshot of selected elements at pointer down (so scale is applied from origin, not cumulatively). */
			originElements: { id: string; x: number; y: number; width: number; height: number }[];
			/** Snapshot of selected strokes at pointer down. */
			originStrokes: { id: string; points: Point[] }[];
	  }
	| {
			kind: 'drag-group';
			pointerId: number;
			start: Point;
			/** Current drag delta so selection bbox can move with content during drag. */
			currentDx?: number;
			currentDy?: number;
			elementIds: string[];
			originById: Record<string, Point>;
			/** Snapshot of selected stroke points at pointer down for translation. */
			originStrokes: { id: string; points: Point[] }[];
	  }
	| {
			kind: 'rotate-group';
			pointerId: number;
			center: Point;
			startAngle: number;
			/** Bounds at pointer down; bbox stays this size during rotate so it doesn’t distort. */
			originBounds: { x: number; y: number; width: number; height: number };
			/** Rotation (degrees) of bbox at pointer down (persisted from previous drags). */
			originBboxRotation: number;
			/** Current rotation delta (degrees) for visual bbox rotation during drag. */
			currentDeltaDeg?: number;
			/** Element id -> rotation at pointer down (degrees). */
			originRotations: Record<string, number>;
			/** Element positions at pointer down (for rigid-body rotation). */
			originElements: { id: string; x: number; y: number; width: number; height: number }[];
			/** Stroke id -> points at pointer down (for rotating stroke paths). */
			originStrokes: { id: string; points: Point[] }[];
	  };
