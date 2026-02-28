import type { BoardElement, ConnectorAnchorId, Point } from './board-types';
import { CONNECTABLE_TYPES } from './board-types';

export interface AnchorPoint {
	anchorId: ConnectorAnchorId;
	x: number;
	y: number;
}

/** Get anchor points for a connectable element (in element-local coords before rotation). */
function getAnchorPointsLocal(element: BoardElement): AnchorPoint[] {
	const { x, y, width, height } = element;
	const cx = x + width / 2;
	const cy = y + height / 2;

	// Rect / text / image: 4 edge centers (n,s,e,w) + 4 corners (nw,ne,se,sw)
	if (element.type === 'rect' || element.type === 'text' || element.type === 'image') {
		return [
			{ anchorId: 'n', x: cx, y: y },
			{ anchorId: 's', x: cx, y: y + height },
			{ anchorId: 'e', x: x + width, y: cy },
			{ anchorId: 'w', x, y: cy },
			{ anchorId: 'nw', x, y },
			{ anchorId: 'ne', x: x + width, y },
			{ anchorId: 'se', x: x + width, y: y + height },
			{ anchorId: 'sw', x, y: y + height }
		];
	}
	// Ellipse: 4 edge centers only (no corner anchors)
	if (element.type === 'ellipse') {
		return [
			{ anchorId: 'n', x: cx, y: y },
			{ anchorId: 's', x: cx, y: y + height },
			{ anchorId: 'e', x: x + width, y: cy },
			{ anchorId: 'w', x, y: cy }
		];
	}
	if (element.type === 'triangle') {
		// Top center, bottom-right, bottom-left (same as canvas-renderer)
		const p0 = { x: x + width / 2, y };
		const p1 = { x: x + width, y: y + height };
		const p2 = { x, y: y + height };
		return [
			{ anchorId: '0', ...p0 },
			{ anchorId: '1', ...p1 },
			{ anchorId: '2', ...p2 },
			{ anchorId: '0-mid', x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 },
			{ anchorId: '1-mid', x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
			{ anchorId: '2-mid', x: (p2.x + p0.x) / 2, y: (p2.y + p0.y) / 2 }
		];
	}
	return [];
}

/** Rotate a point around center (cx, cy) by angle in degrees */
function rotatePoint(px: number, py: number, cx: number, cy: number, deg: number): Point {
	const rad = (deg * Math.PI) / 180;
	const cos = Math.cos(rad);
	const sin = Math.sin(rad);
	const dx = px - cx;
	const dy = py - cy;
	return {
		x: cx + dx * cos - dy * sin,
		y: cy + dx * sin + dy * cos
	};
}

/** Get anchor position in stage coordinates (with rotation applied) */
export function getAnchorPosition(
	element: BoardElement,
	anchorId: ConnectorAnchorId,
	elements: BoardElement[]
): Point | null {
	if (!CONNECTABLE_TYPES.includes(element.type)) return null;
	const locals = getAnchorPointsLocal(element);
	const anchor = locals.find((a) => a.anchorId === anchorId);
	if (!anchor) return null;
	const cx = element.x + element.width / 2;
	const cy = element.y + element.height / 2;
	const rot = element.rotation ?? 0;
	return rotatePoint(anchor.x, anchor.y, cx, cy, rot);
}

/** Get all anchor positions for an element in stage coordinates */
export function getAnchorPoints(element: BoardElement): AnchorPoint[] {
	const locals = getAnchorPointsLocal(element);
	const cx = element.x + element.width / 2;
	const cy = element.y + element.height / 2;
	const rot = element.rotation ?? 0;
	return locals.map((a) => {
		const p = rotatePoint(a.x, a.y, cx, cy, rot);
		return { anchorId: a.anchorId, x: p.x, y: p.y };
	});
}

/** Orthogonal path: start -> horizontal to bendX -> vertical -> horizontal to end */
function orthogonalPathWithBend(
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	bendX?: number
): { path: string; bounds: { x: number; y: number; width: number; height: number }; bendX: number } {
	const midX = bendX ?? (x1 + x2) / 2;
	const path = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
	const minX = Math.min(x1, midX, x2);
	const maxX = Math.max(x1, midX, x2);
	const minY = Math.min(y1, y2);
	const maxY = Math.max(y1, y2);
	return {
		path,
		bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
		bendX: midX
	};
}

/** Curved path: quadratic bezier with optional control point */
function curvedPathWithControl(
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	ctrlX?: number,
	ctrlY?: number
): { path: string; bounds: { x: number; y: number; width: number; height: number } } {
	const midX = (x1 + x2) / 2;
	const midY = (y1 + y2) / 2;
	const dx = x2 - x1;
	const dy = y2 - y1;
	const perp = Math.sqrt(dx * dx + dy * dy) * 0.3;
	const cx = ctrlX ?? midX + (dy !== 0 ? perp : 0);
	const cy = ctrlY ?? midY - (dx !== 0 ? perp : 0);
	const path = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
	const minX = Math.min(x1, x2, cx);
	const maxX = Math.max(x1, x2, cx);
	const minY = Math.min(y1, y2, cy);
	const maxY = Math.max(y1, y2, cy);
	return {
		path,
		bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
	};
}

/** Outward direction from shape edge at anchor (before rotation). Used for self-connection path. */
function getAnchorOutward(anchorId: string): Point {
	if (anchorId === 'n') return { x: 0, y: -1 };
	if (anchorId === 's') return { x: 0, y: 1 };
	if (anchorId === 'e') return { x: 1, y: 0 };
	if (anchorId === 'w') return { x: -1, y: 0 };
	if (anchorId === 'nw') return { x: -0.707, y: -0.707 };
	if (anchorId === 'ne') return { x: 0.707, y: -0.707 };
	if (anchorId === 'se') return { x: 0.707, y: 0.707 };
	if (anchorId === 'sw') return { x: -0.707, y: 0.707 };
	if (anchorId === '0') return { x: 0, y: -1 };
	if (anchorId === '1') return { x: 0.707, y: 0.707 };
	if (anchorId === '2') return { x: -0.707, y: 0.707 };
	if (anchorId === '0-mid') return { x: 0.707, y: -0.5 };
	if (anchorId === '1-mid') return { x: 0, y: 1 };
	if (anchorId === '2-mid') return { x: -1, y: 0 };
	return { x: 0, y: -1 };
}

/** Apply element rotation to a direction vector (keeps unit length) */
function rotateDir(dx: number, dy: number, deg: number): Point {
	const rad = (deg * Math.PI) / 180;
	const cos = Math.cos(rad);
	const sin = Math.sin(rad);
	return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
}

/** Get total length of path (orthogonal: 3 segments; Q: one bezier) */
function getPathLength(parts: string[]): number {
	if (parts[0] !== 'M' || parts.length < 4) return 0;
	if (parts[3] === 'Q') {
		const x1 = Number(parts[1]);
		const y1 = Number(parts[2]);
		const cx = Number(parts[4]);
		const cy = Number(parts[5]);
		const x2 = Number(parts[6]);
		const y2 = Number(parts[7]);
		// Quadratic approx: sum of chord lengths
		const d1 = Math.hypot(cx - x1, cy - y1);
		const d2 = Math.hypot(x2 - cx, y2 - cy);
		return d1 + d2;
	}
	let len = 0;
	let px = Number(parts[1]);
	let py = Number(parts[2]);
	for (let i = 3; i + 2 < parts.length; i += 3) {
		if (parts[i] !== 'L') break;
		const nx = Number(parts[i + 1]);
		const ny = Number(parts[i + 2]);
		len += Math.hypot(nx - px, ny - py);
		px = nx;
		py = ny;
	}
	return len;
}

/** Get point at fraction t (0..1) along path */
function getPointOnPath(path: string, t: number): Point | null {
	const parts = path.split(/\s+/);
	if (parts[0] !== 'M' || parts.length < 4) return null;
	if (t <= 0) return { x: Number(parts[1]), y: Number(parts[2]) };
	if (t >= 1) {
		const last = parts.length - 1;
		return { x: Number(parts[last - 1]), y: Number(parts[last]) };
	}
	if (parts[3] === 'Q') {
		const x1 = Number(parts[1]);
		const y1 = Number(parts[2]);
		const cx = Number(parts[4]);
		const cy = Number(parts[5]);
		const x2 = Number(parts[6]);
		const y2 = Number(parts[7]);
		const mt = 1 - t;
		return {
			x: mt * mt * x1 + 2 * mt * t * cx + t * t * x2,
			y: mt * mt * y1 + 2 * mt * t * cy + t * t * y2
		};
	}
	let total = 0;
	let px = Number(parts[1]);
	let py = Number(parts[2]);
	const target = getPathLength(parts) * t;
	for (let i = 3; i + 2 < parts.length; i += 3) {
		if (parts[i] !== 'L') break;
		const nx = Number(parts[i + 1]);
		const ny = Number(parts[i + 2]);
		const seg = Math.hypot(nx - px, ny - py);
		if (total + seg >= target) {
			const u = (target - total) / seg || 0;
			return { x: px + (nx - px) * u, y: py + (ny - py) * u };
		}
		total += seg;
		px = nx;
		py = ny;
	}
	return { x: px, y: py };
}

export interface ConnectorPathData {
	path: string;
	start: Point;
	end: Point;
	bounds: { x: number; y: number; width: number; height: number };
	bendPoint?: Point;
	/** Arrow positions at 1/7 and 6/7 along path (when arrows enabled) */
	arrowAt1?: Point;
	arrowAt2?: Point;
}

export function getConnectorPath(
	connector: BoardElement,
	elements: BoardElement[]
): ConnectorPathData | null {
	if (connector.type !== 'connector' || !connector.startElementId || !connector.endElementId) return null;
	const startEl = elements.find((e) => e.id === connector.startElementId);
	const endEl = elements.find((e) => e.id === connector.endElementId);
	if (!startEl || !endEl) return null;
	const start = getAnchorPosition(startEl, connector.startAnchor!, elements);
	const end = getAnchorPosition(endEl, connector.endAnchor!, elements);
	if (!start || !end) return null;
	const type = connector.connectorType ?? 'orthogonal';
	const pad = (connector.borderWidth ?? 2) + 4;
	const hasStartArrow = connector.startArrow === 'arrow';
	const hasEndArrow = connector.endArrow === 'arrow';

	let path: string;
	let bounds: { x: number; y: number; width: number; height: number };
	let bendPoint: Point | undefined;

	const isSelf = connector.startElementId === connector.endElementId;
	if (isSelf) {
		const el = startEl;
		const outStart = getAnchorOutward(connector.startAnchor!);
		const outEnd = getAnchorOutward(connector.endAnchor!);
		const rot = el.rotation ?? 0;
		const d1 = rotateDir(outStart.x, outStart.y, rot);
		const d2 = rotateDir(outEnd.x, outEnd.y, rot);
		const offset = 48;
		const startOut = { x: start.x + d1.x * offset, y: start.y + d1.y * offset };
		const endOut = { x: end.x + d2.x * offset, y: end.y + d2.y * offset };
		const shapeCx = el.x + el.width / 2;
		const shapeCy = el.y + el.height / 2;
		const midX = (startOut.x + endOut.x) / 2;
		const midY = (startOut.y + endOut.y) / 2;
		const toMid = { x: midX - shapeCx, y: midY - shapeCy };
		const len = Math.hypot(toMid.x, toMid.y) || 1;
		const outDir = { x: toMid.x / len, y: toMid.y / len };
		const pushOut = 56;
		const defaultMid = { x: midX + outDir.x * pushOut, y: midY + outDir.y * pushOut };
		const midOut =
			connector.connectorSelfBendX != null && connector.connectorSelfBendY != null
				? { x: connector.connectorSelfBendX, y: connector.connectorSelfBendY }
				: defaultMid;
		path = `M ${start.x} ${start.y} L ${startOut.x} ${startOut.y} L ${midOut.x} ${midOut.y} L ${endOut.x} ${endOut.y} L ${end.x} ${end.y}`;
		const minX = Math.min(start.x, startOut.x, midOut.x, endOut.x, end.x);
		const maxX = Math.max(start.x, startOut.x, midOut.x, endOut.x, end.x);
		const minY = Math.min(start.y, startOut.y, midOut.y, endOut.y, end.y);
		const maxY = Math.max(start.y, startOut.y, midOut.y, endOut.y, end.y);
		bounds = { x: minX - pad, y: minY - pad, width: maxX - minX + pad * 2, height: maxY - minY + pad * 2 };
		bendPoint = { x: midOut.x, y: midOut.y };
	} else if (type === 'curved') {
		const midX = (start.x + end.x) / 2;
		const midY = (start.y + end.y) / 2;
		const dx = end.x - start.x;
		const dy = end.y - start.y;
		const perp = Math.sqrt(dx * dx + dy * dy) * 0.3;
		const defaultCx = midX + (dy !== 0 ? perp : 0);
		const defaultCy = midY - (dx !== 0 ? perp : 0);
		const ctrlX = connector.connectorControlX ?? defaultCx;
		const ctrlY = connector.connectorControlY ?? defaultCy;
		const out = curvedPathWithControl(start.x, start.y, end.x, end.y, ctrlX, ctrlY);
		path = out.path;
		bounds = out.bounds;
		bendPoint = { x: ctrlX, y: ctrlY };
	} else {
		const out = orthogonalPathWithBend(start.x, start.y, end.x, end.y, connector.connectorBendX);
		path = out.path;
		bounds = out.bounds;
		bendPoint = { x: out.bendX, y: (start.y + end.y) / 2 };
	}

	const finalBounds = { ...bounds, x: bounds.x - pad, y: bounds.y - pad, width: bounds.width + pad * 2, height: bounds.height + pad * 2 };
	const hasArrows = hasStartArrow || hasEndArrow;
	const arrowAt1 = hasArrows ? getPointOnPath(path, 1 / 7) : undefined;
	const arrowAt2 = hasArrows ? getPointOnPath(path, 6 / 7) : undefined;
	return { path, start, end, bounds: finalBounds, bendPoint, arrowAt1, arrowAt2 };
}

/** Update connector's x,y,width,height to match path bounds (for hit-test/selection) */
export function updateConnectorBounds(
	connector: BoardElement,
	elements: BoardElement[]
): BoardElement {
	const data = getConnectorPath(connector, elements);
	if (!data) return connector;
	return { ...connector, x: data.bounds.x, y: data.bounds.y, width: data.bounds.width, height: data.bounds.height };
}

/** Check if element type is connectable */
export function isConnectableType(type: BoardElement['type']): boolean {
	return CONNECTABLE_TYPES.includes(type);
}
