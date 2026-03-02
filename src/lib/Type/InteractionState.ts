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
