import type { Point } from './Point.js';

export interface Stroke {
	id: string;
	tool: 'pen' | 'eraser';
	color: string;
	size: number;
	points: Point[];
}
