import type {
	ConnectorAnchorId,
	ConnectorArrow,
	ConnectorArrowDirection,
	ConnectorStyle,
	ConnectorType,
	TextAlign,
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
	connectorControlX?: number;
	connectorControlY?: number;
	connectorSelfBendX?: number;
	connectorSelfBendY?: number;
	connectorArrowSize?: number;
}
