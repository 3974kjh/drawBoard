import type { ThemeId } from './AliasTypes.js';
import type { BoardElement } from './BoardElement.js';
import type { LayerEntry } from './LayerOrder.js';
import type { Stroke } from './Stroke.js';

export interface Snapshot {
	strokes: Stroke[];
	elements: BoardElement[];
	/** Present from first save after load; omitted in older undo stacks. */
	layerOrder?: LayerEntry[];
	themeId: ThemeId;
	stageWidth: number;
	stageHeight: number;
	gridEnabled: boolean;
	gridSize: number;
}
