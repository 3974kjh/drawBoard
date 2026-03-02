import type { DrawingTool } from '$lib/Type';

/**
 * 도구 선택 로직: 선택한 도구가 현재와 다르면 활성 도구를 바꾸고 콜백 호출.
 */
export const selectTool = (
	current: DrawingTool,
	next: DrawingTool,
	onToolChange?: (tool: DrawingTool) => void
): DrawingTool => {
	if (next === current) return current;
	onToolChange?.(next);
	return next;
};
