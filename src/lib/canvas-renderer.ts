import type { BoardElement, Stroke } from './board-types';
import { TEXT_EDITABLE_TYPES } from './board-types';
import { getConnectorPath } from './connector-geometry';

export const drawThemeBackground = (
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	background: string,
	gridColor: string,
	gridEnabled = true,
	gridSize = 32
): void => {
	ctx.fillStyle = background;
	ctx.fillRect(0, 0, width, height);
	if (!gridEnabled) return;
	ctx.strokeStyle = gridColor;
	ctx.lineWidth = 1;
	for (let x = 0; x < width; x += gridSize) {
		ctx.beginPath();
		ctx.moveTo(x, 0);
		ctx.lineTo(x, height);
		ctx.stroke();
	}
	for (let y = 0; y < height; y += gridSize) {
		ctx.beginPath();
		ctx.moveTo(0, y);
		ctx.lineTo(width, y);
		ctx.stroke();
	}
};

/**
 * Draw a single pen stroke with quadratic Bezier smoothing.
 * Midpoints between consecutive control points are used as anchor points,
 * which produces natural, smooth curves that match the live-drawing preview.
 * Eraser strokes are skipped (legacy data).
 */
export const drawStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke): void => {
	if (stroke.tool === 'eraser') return;
	const pts = stroke.points;
	if (pts.length === 0) return;
	ctx.save();
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
	ctx.lineWidth = stroke.size;
	ctx.strokeStyle = stroke.color;
	ctx.fillStyle = stroke.color;

	if (pts.length === 1) {
		// Single tap → filled circle dot
		ctx.beginPath();
		ctx.arc(pts[0].x, pts[0].y, stroke.size / 2, 0, Math.PI * 2);
		ctx.fill();
	} else if (pts.length === 2) {
		ctx.beginPath();
		ctx.moveTo(pts[0].x, pts[0].y);
		ctx.lineTo(pts[1].x, pts[1].y);
		ctx.stroke();
	} else {
		// Quadratic Bezier: midpoints become anchor points, recorded points are control points
		ctx.beginPath();
		ctx.moveTo(pts[0].x, pts[0].y);
		for (let i = 1; i < pts.length - 1; i++) {
			const midX = (pts[i].x + pts[i + 1].x) / 2;
			const midY = (pts[i].y + pts[i + 1].y) / 2;
			ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
		}
		// Final segment to the last point
		ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
		ctx.stroke();
	}
	ctx.restore();
};

/**
 * Pre-load image elements into an HTMLImageElement map.
 * Call this once before rendering/exporting, then pass the result to drawElementToCanvas.
 */
export const loadImages = async (
	elements: BoardElement[]
): Promise<Map<string, HTMLImageElement>> => {
	const map = new Map<string, HTMLImageElement>();
	await Promise.all(
		elements
			.filter((e) => e.type === 'image' && e.imageDataUrl)
			.map(
				(e) =>
					new Promise<void>((resolve) => {
						const img = new Image();
						img.onload = () => {
							map.set(e.id, img);
							resolve();
						};
						img.onerror = () => resolve();
						img.src = e.imageDataUrl!;
					})
			)
	);
	return map;
};

/** Direction angle in radians: 0 = E, π/2 = S, π = W, -π/2 = N */
const ARROW_DIR_ANGLES: Record<string, number> = {
	e: 0,
	s: Math.PI / 2,
	w: Math.PI,
	n: -Math.PI / 2
};

/** Draw arrow head at (x,y). If angleRad is set, use it; else point from (fromX, fromY) toward (x,y). */
function drawArrowHead(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	fromX: number,
	fromY: number,
	size: number,
	fillStyle: string,
	angleRad?: number
) {
	const angle = angleRad ?? Math.atan2(y - fromY, x - fromX);
	const a1 = angle + Math.PI * 0.8;
	const a2 = angle - Math.PI * 0.8;
	ctx.save();
	ctx.fillStyle = fillStyle;
	ctx.beginPath();
	ctx.moveTo(x, y);
	ctx.lineTo(x - size * Math.cos(a1), y - size * Math.sin(a1));
	ctx.lineTo(x - size * Math.cos(a2), y - size * Math.sin(a2));
	ctx.closePath();
	ctx.fill();
	ctx.restore();
}

/** Draw a board element to canvas (used for PDF export & thumbnail). allElements required when drawing connectors. */
export const drawElementToCanvas = (
	ctx: CanvasRenderingContext2D,
	element: BoardElement,
	imageMap?: Map<string, HTMLImageElement>,
	allElements?: BoardElement[]
): void => {
	if (element.type === 'connector') {
		if (!allElements) return;
		const data = getConnectorPath(element, allElements);
		if (!data) return;
		ctx.save();
		const bw = element.borderWidth ?? 2;
		ctx.strokeStyle = element.strokeColor;
		ctx.lineWidth = bw;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		const style = element.connectorStyle ?? 'solid';
		if (style === 'dashed') ctx.setLineDash([6, 4]);
		const path2d = new Path2D(data.path);
		if (style === 'double') {
			ctx.lineWidth = Math.max(1, Math.floor(bw / 2));
			ctx.stroke(path2d);
			ctx.translate(2, 0);
			ctx.stroke(path2d);
			ctx.translate(-2, 0);
			ctx.lineWidth = bw;
		} else {
			ctx.stroke(path2d);
		}
		const arrowSize = element.connectorArrowSize ?? 10;
		const startDir = element.startArrowDirection && element.startArrowDirection !== 'auto' ? ARROW_DIR_ANGLES[element.startArrowDirection] : undefined;
		const endDir = element.endArrowDirection && element.endArrowDirection !== 'auto' ? ARROW_DIR_ANGLES[element.endArrowDirection] : undefined;
		if (element.startArrow === 'arrow' && data.arrowAt1) drawArrowHead(ctx, data.arrowAt1.x, data.arrowAt1.y, data.start.x, data.start.y, arrowSize * 0.5, element.strokeColor, startDir);
		if (element.endArrow === 'arrow' && data.arrowAt2) drawArrowHead(ctx, data.arrowAt2.x, data.arrowAt2.y, data.end.x, data.end.y, arrowSize * 0.5, element.strokeColor, endDir);
		ctx.restore();
		return;
	}

	ctx.save();

	/* Apply rotation around the element centre */
	if (element.rotation) {
		const cx = element.x + element.width / 2;
		const cy = element.y + element.height / 2;
		ctx.translate(cx, cy);
		ctx.rotate((element.rotation * Math.PI) / 180);
		ctx.translate(-cx, -cy);
	}

	const bw = element.borderWidth ?? 2;
	ctx.lineWidth = bw;
	ctx.strokeStyle = element.strokeColor;
	ctx.fillStyle = element.fillColor;

	if (element.type === 'rect') {
		ctx.fillRect(element.x, element.y, element.width, element.height);
		if (bw > 0) ctx.strokeRect(element.x, element.y, element.width, element.height);
	} else if (element.type === 'ellipse') {
		ctx.beginPath();
		ctx.ellipse(
			element.x + element.width / 2,
			element.y + element.height / 2,
			Math.max(10, element.width / 2),
			Math.max(10, element.height / 2),
			0,
			0,
			Math.PI * 2
		);
		ctx.fill();
		if (bw > 0) ctx.stroke();
	} else if (element.type === 'triangle') {
		ctx.beginPath();
		ctx.moveTo(element.x + element.width / 2, element.y);
		ctx.lineTo(element.x + element.width, element.y + element.height);
		ctx.lineTo(element.x, element.y + element.height);
		ctx.closePath();
		ctx.fill();
		if (bw > 0) ctx.stroke();
	} else if (element.type === 'line-h') {
		const cy = element.y + element.height / 2;
		ctx.beginPath();
		ctx.moveTo(element.x, cy);
		ctx.lineTo(element.x + element.width, cy);
		ctx.stroke();
	} else if (element.type === 'line-v') {
		const cx = element.x + element.width / 2;
		ctx.beginPath();
		ctx.moveTo(cx, element.y);
		ctx.lineTo(cx, element.y + element.height);
		ctx.stroke();
	} else if (element.type === 'image') {
		const img = imageMap?.get(element.id);
		if (img) {
			ctx.drawImage(img, element.x, element.y, element.width, element.height);
		} else {
			/* Placeholder when image hasn't loaded */
			ctx.fillStyle = '#e2e8f0';
			ctx.fillRect(element.x, element.y, element.width, element.height);
			ctx.strokeStyle = '#94a3b8';
			ctx.lineWidth = 1;
			ctx.strokeRect(element.x, element.y, element.width, element.height);
		}
	}

	/* Only render text for types that support it */
	if (
		TEXT_EDITABLE_TYPES.includes(element.type) &&
		(element.text.trim().length > 0 || element.type === 'text')
	) {
		ctx.fillStyle = element.strokeColor;
		ctx.textAlign = element.textAlign;
		ctx.textBaseline = 'top';
		const fs = element.fontSize ?? 18;
		ctx.font = `${fs}px sans-serif`;
		const x =
			element.textAlign === 'left'
				? element.x + 10
				: element.textAlign === 'center'
					? element.x + element.width / 2
					: element.x + element.width - 10;
		const lines = element.text.split('\n');
		const lineHeight = fs + 4;
		const totalTextH = lines.length * lineHeight;
		const valign = element.textVerticalAlign ?? 'top';
		const startY =
			valign === 'top'
				? element.y + 10
				: valign === 'middle'
					? element.y + (element.height - totalTextH) / 2
					: element.y + element.height - totalTextH - 10;
		lines.forEach((line, idx) => {
			ctx.fillText(line, x, startY + idx * lineHeight, element.width - 16);
		});
	}
	ctx.restore();
};

/** Fixed thumbnail size matching minimap proportions (letterboxed full board) */
const THUMB_W = 280;
const THUMB_H = 148;
/** Match minimap DPR for sharp thumbnails on high-DPI (main list & import modal) */
const THUMB_DPR = 2;

/**
 * Render a JPEG thumbnail of the board identical to the minimap: fixed size,
 * letterbox background, board scaled to fit inside. Rendered at THUMB_DPR× resolution
 * for sharpness on retina displays. Used for main list and import modal.
 */
export const renderThumbnail = (
	stageWidth: number,
	stageHeight: number,
	background: string,
	gridColor: string,
	strokes: Stroke[],
	elements: BoardElement[],
	imageMap?: Map<string, HTMLImageElement>,
	gridEnabled = true,
	gridSize = 32
): string => {
	const canvas = document.createElement('canvas');
	canvas.width = THUMB_W * THUMB_DPR;
	canvas.height = THUMB_H * THUMB_DPR;
	const ctx = canvas.getContext('2d');
	if (!ctx) return '';

	ctx.scale(THUMB_DPR, THUMB_DPR);

	const scale = Math.min(THUMB_W / stageWidth, THUMB_H / stageHeight);
	const boardW = stageWidth * scale;
	const boardH = stageHeight * scale;
	const ox = (THUMB_W - boardW) / 2;
	const oy = (THUMB_H - boardH) / 2;

	/* Letterbox (same as minimap) */
	ctx.fillStyle = '#dbe3ef';
	ctx.fillRect(0, 0, THUMB_W, THUMB_H);

	ctx.save();
	ctx.beginPath();
	ctx.rect(ox, oy, boardW, boardH);
	ctx.clip();
	ctx.translate(ox, oy);
	ctx.scale(scale, scale);
	drawThemeBackground(ctx, stageWidth, stageHeight, background, gridColor, gridEnabled, gridSize);
	strokes.forEach((s) => drawStroke(ctx, s));
	elements.forEach((e) => drawElementToCanvas(ctx, e, imageMap, elements));
	ctx.restore();

	return canvas.toDataURL('image/jpeg', 0.72);
};
