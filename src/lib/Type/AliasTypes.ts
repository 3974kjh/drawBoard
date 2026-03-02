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
	| 'image'
	| 'connector';

export type ConnectorStyle = 'solid' | 'dashed' | 'double';
export type ConnectorType = 'orthogonal' | 'curved';
export type ConnectorArrow = 'none' | 'arrow';
export type ConnectorArrowDirection = 'auto' | 'n' | 's' | 'e' | 'w';
export type ConnectorAnchorId = string;

export type TextAlign = 'left' | 'center' | 'right';
export type TextVerticalAlign = 'top' | 'middle' | 'bottom';
export type AlignMode = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
export type ResizeHandle = 'nw' | 'n' | 'ne' | 'w' | 'e' | 'sw' | 's' | 'se';
export type DistributeMode = 'horizontal' | 'vertical';
export type Axis = 'x' | 'y';
export type Orientation = 'vertical' | 'horizontal';
