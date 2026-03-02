/**
 * Re-exports from Type/ and Enum/ for backward compatibility.
 * New code should import from '$lib/Type' and '$lib/Enum' directly.
 */
export type {
	ThemeId,
	DrawingTool,
	ConnectorStyle,
	ConnectorType,
	ConnectorArrow,
	ConnectorArrowDirection,
	ConnectorAnchorId,
	TextAlign,
	TextVerticalAlign,
	AlignMode,
	ResizeHandle,
	DistributeMode,
	Axis,
	Orientation,
	Point,
	Stroke,
	BoardElement,
	BoardData,
	BoardTheme,
	GuideLine,
	GuideDistance,
	Bounds,
	GroupBox,
	InteractionState,
	Snapshot,
	ToolItem
} from './Type/index.js';
export {
	TOOL_ITEMS,
	CONNECTABLE_TYPES,
	BOARD_THEMES,
	EMPTY_BOARD_CONTENT,
	TEXT_EDITABLE_TYPES
} from './Enum/index.js';
