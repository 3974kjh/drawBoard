import type { BoardElement, Stroke } from './board-types';
import { TEXT_EDITABLE_TYPES } from './board-types';

export const drawThemeBackground = (
	ctx: CanvasRenderingContext2D,
	width: number,
	height: number,
	background: string,
	gridColor: string
): void => {
	ctx.fillStyle = background;
	ctx.fillRect(0, 0, width, height);
	ctx.strokeStyle = gridColor;
	ctx.lineWidth = 1;
	const gap = 32;
	for (let x = 0; x < width; x += gap) {
		ctx.beginPath();
		ctx.moveTo(x, 0);
		ctx.lineTo(x, height);
		ctx.stroke();
	}
	for (let y = 0; y < height; y += gap) {
		ctx.beginPath();
		ctx.moveTo(0, y);
		ctx.lineTo(width, y);
		ctx.stroke();
	}
};

/** Draw a single pen stroke. Eraser strokes are skipped (legacy data). */
export const drawStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke): void => {
	if (stroke.tool === 'eraser') return;
	if (stroke.points.length === 0) return;
	ctx.save();
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
	ctx.lineWidth = stroke.size;
	ctx.strokeStyle = stroke.color;
	ctx.beginPath();
	ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
	for (let i = 1; i < stroke.points.length; i += 1) {
		const point = stroke.points[i];
		ctx.lineTo(point.x, point.y);
	}
	ctx.stroke();
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

/** Draw a board element to canvas (used for PDF export & thumbnail). */
export const drawElementToCanvas = (
	ctx: CanvasRenderingContext2D,
	element: BoardElement,
	imageMap?: Map<string, HTMLImageElement>
): void => {
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

/**
 * Render a small JPEG thumbnail of the board for card previews.
 * Returns a data-URL string.
 */
export const renderThumbnail = (
	stageWidth: number,
	stageHeight: number,
	background: string,
	gridColor: string,
	strokes: Stroke[],
	elements: BoardElement[],
	imageMap?: Map<string, HTMLImageElement>
): string => {
	const thumbW = 280;
	const thumbH = Math.round(thumbW * (stageHeight / stageWidth));
	const canvas = document.createElement('canvas');
	canvas.width = thumbW;
	canvas.height = thumbH;
	const ctx = canvas.getContext('2d');
	if (!ctx) return '';
	ctx.scale(thumbW / stageWidth, thumbH / stageHeight);
	drawThemeBackground(ctx, stageWidth, stageHeight, background, gridColor);
	strokes.forEach((s) => drawStroke(ctx, s));
	elements.forEach((e) => drawElementToCanvas(ctx, e, imageMap));
	return canvas.toDataURL('image/jpeg', 0.55);
};
