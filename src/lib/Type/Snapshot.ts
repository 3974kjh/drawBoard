import type { ThemeId } from './AliasTypes.js';
import type { BoardElement } from './BoardElement.js';
import type { Stroke } from './Stroke.js';

export interface Snapshot {
	strokes: Stroke[];
	elements: BoardElement[];
	themeId: ThemeId;
	stageWidth: number;
	stageHeight: number;
	gridEnabled: boolean;
	gridSize: number;
}
