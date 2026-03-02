import type { ThemeId } from './AliasTypes.js';
import type { BoardElement } from './BoardElement.js';
import type { Stroke } from './Stroke.js';

export interface BoardData {
	id: string;
	title: string;
	themeId: ThemeId;
	createdAt: string;
	updatedAt: string;
	strokes: Stroke[];
	elements: BoardElement[];
	thumbnail?: string;
	width?: number;
	height?: number;
	gridEnabled?: boolean;
	gridSize?: number;
}
