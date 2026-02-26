import type { Axis, BoardElement, Bounds, GuideDistance } from './board-types';

export type SnapResult = { delta: number; line: number } | null;

export const getBounds = (items: BoardElement[]): Bounds | null => {
	if (items.length === 0) return null;
	const minX = Math.min(...items.map((e) => e.x));
	const minY = Math.min(...items.map((e) => e.y));
	const maxX = Math.max(...items.map((e) => e.x + e.width));
	const maxY = Math.max(...items.map((e) => e.y + e.height));
	return {
		x: minX,
		y: minY,
		right: maxX,
		bottom: maxY,
		width: maxX - minX,
		height: maxY - minY,
		centerX: (minX + maxX) / 2,
		centerY: (minY + maxY) / 2
	};
};

export const getSnapDelta = (
	selectedValues: number[],
	candidateValues: number[],
	threshold: number
): SnapResult => {
	let best: SnapResult = null;
	for (const value of selectedValues) {
		for (const candidate of candidateValues) {
			const delta = candidate - value;
			if (Math.abs(delta) > threshold) continue;
			if (!best || Math.abs(delta) < Math.abs(best.delta)) {
				best = { delta, line: candidate };
			}
		}
	}
	return best;
};

export const chooseCloserSnap = (a: SnapResult, b: SnapResult): SnapResult => {
	if (!a) return b;
	if (!b) return a;
	return Math.abs(a.delta) <= Math.abs(b.delta) ? a : b;
};

export const rangesOverlap = (
	aStart: number,
	aEnd: number,
	bStart: number,
	bEnd: number
): boolean => aStart < bEnd && bStart < aEnd;

export const getGapMatchSnap = (
	axis: Axis,
	bounds: Bounds,
	staticElements: BoardElement[],
	threshold: number
): SnapResult => {
	if (staticElements.length < 2) return null;
	const isX = axis === 'x';
	const start = isX ? bounds.x : bounds.y;
	const end = isX ? bounds.right : bounds.bottom;
	const crossStart = isX ? bounds.y : bounds.x;
	const crossEnd = isX ? bounds.bottom : bounds.right;

	const segments = staticElements
		.map((item) => ({
			start: isX ? item.x : item.y,
			end: (isX ? item.x : item.y) + (isX ? item.width : item.height),
			crossStart: isX ? item.y : item.x,
			crossEnd: (isX ? item.y : item.x) + (isX ? item.height : item.width)
		}))
		.sort((a, b) => a.start - b.start);

	const knownGaps: number[] = [];
	for (let i = 0; i < segments.length - 1; i += 1) {
		const gap = segments[i + 1].start - segments[i].end;
		if (gap > 0) knownGaps.push(gap);
	}
	if (knownGaps.length === 0) return null;

	let best: SnapResult = null;
	for (const segment of segments) {
		if (!rangesOverlap(crossStart, crossEnd, segment.crossStart - 40, segment.crossEnd + 40)) {
			continue;
		}

		const currentGapFromLeft = start - segment.end;
		for (const gap of knownGaps) {
			const delta = gap - currentGapFromLeft;
			if (Math.abs(delta) > threshold) continue;
			if (!best || Math.abs(delta) < Math.abs(best.delta)) {
				best = { delta, line: segment.end + gap };
			}
		}

		const currentGapFromRight = segment.start - end;
		for (const gap of knownGaps) {
			const delta = currentGapFromRight - gap;
			if (Math.abs(delta) > threshold) continue;
			if (!best || Math.abs(delta) < Math.abs(best.delta)) {
				best = { delta, line: segment.start - gap };
			}
		}
	}
	return best;
};

export const getDistanceLabels = (
	moving: Bounds,
	staticElements: BoardElement[]
): GuideDistance[] => {
	const labels: GuideDistance[] = [];

	let leftCandidate: BoardElement | null = null;
	let rightCandidate: BoardElement | null = null;
	let topCandidate: BoardElement | null = null;
	let bottomCandidate: BoardElement | null = null;

	for (const item of staticElements) {
		const itemRight = item.x + item.width;
		const itemBottom = item.y + item.height;
		const overlapY = rangesOverlap(item.y, itemBottom, moving.y, moving.bottom);
		const overlapX = rangesOverlap(item.x, itemRight, moving.x, moving.right);

		if (overlapY && itemRight <= moving.x) {
			if (!leftCandidate || itemRight > leftCandidate.x + leftCandidate.width) {
				leftCandidate = item;
			}
		}
		if (overlapY && item.x >= moving.right) {
			if (!rightCandidate || item.x < rightCandidate.x) {
				rightCandidate = item;
			}
		}
		if (overlapX && itemBottom <= moving.y) {
			if (!topCandidate || itemBottom > topCandidate.y + topCandidate.height) {
				topCandidate = item;
			}
		}
		if (overlapX && item.y >= moving.bottom) {
			if (!bottomCandidate || item.y < bottomCandidate.y) {
				bottomCandidate = item;
			}
		}
	}

	if (leftCandidate) {
		const distance = Math.round(moving.x - (leftCandidate.x + leftCandidate.width));
		if (distance >= 0 && distance <= 400) {
			labels.push({
				x: (moving.x + leftCandidate.x + leftCandidate.width) / 2,
				y: moving.centerY - 12,
				text: `${distance}px`
			});
		}
	}
	if (rightCandidate) {
		const distance = Math.round(rightCandidate.x - moving.right);
		if (distance >= 0 && distance <= 400) {
			labels.push({
				x: (moving.right + rightCandidate.x) / 2,
				y: moving.centerY + 12,
				text: `${distance}px`
			});
		}
	}
	if (topCandidate) {
		const distance = Math.round(moving.y - (topCandidate.y + topCandidate.height));
		if (distance >= 0 && distance <= 400) {
			labels.push({
				x: moving.centerX + 10,
				y: (moving.y + topCandidate.y + topCandidate.height) / 2,
				text: `${distance}px`
			});
		}
	}
	if (bottomCandidate) {
		const distance = Math.round(bottomCandidate.y - moving.bottom);
		if (distance >= 0 && distance <= 400) {
			labels.push({
				x: moving.centerX - 10,
				y: (moving.bottom + bottomCandidate.y) / 2,
				text: `${distance}px`
			});
		}
	}
	return labels;
};
