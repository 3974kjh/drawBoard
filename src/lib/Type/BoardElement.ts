import type {
	ConnectorAnchorId,
	ConnectorArrow,
	ConnectorArrowDirection,
	ConnectorStyle,
	ConnectorType,
	TextAlign,
	TextContentMode,
	TextVerticalAlign
} from './AliasTypes.js';

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
	/** How text is edited and rendered (rect / ellipse / text). Default: plain. */
	textMode?: TextContentMode;
	/** Sanitized HTML for plain mode (bold, inline size). Synced with `text` (innerText). */
	textHtml?: string;
	/** highlight.js language id for `code` mode (e.g. javascript, css, python). */
	textCodeLanguage?: string;
	imageDataUrl?: string;
	startElementId?: string;
	startAnchor?: ConnectorAnchorId;
	endElementId?: string;
	endAnchor?: ConnectorAnchorId;
	connectorStyle?: ConnectorStyle;
	connectorType?: ConnectorType;
	startArrow?: ConnectorArrow;
	endArrow?: ConnectorArrow;
	startArrowDirection?: ConnectorArrowDirection;
	endArrowDirection?: ConnectorArrowDirection;
	connectorBendX?: number;
	/** For orthogonal V-H-V path: Y of the horizontal segment (used when |dy| > |dx|). */
	connectorBendY?: number;
	connectorControlX?: number;
	connectorControlY?: number;
	connectorSelfBendX?: number;
	connectorSelfBendY?: number;
	connectorArrowSize?: number;
}
