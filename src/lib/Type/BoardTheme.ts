import type { ThemeId } from './AliasTypes.js';

export interface BoardTheme {
	id: ThemeId;
	label: string;
	background: string;
	gridColor: string;
	defaultStrokeColor: string;
	defaultFillColor: string;
}
