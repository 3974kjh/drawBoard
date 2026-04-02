import type { BoardElement } from '$lib/Type/BoardElement.js';
import type { LayerEntry, LayerSegment } from '$lib/Type/LayerOrder.js';
import type { Stroke } from '$lib/Type/Stroke.js';

export type { LayerEntry, LayerSegment } from '$lib/Type/LayerOrder.js';

export const buildDefaultLayerOrder = (strokes: Stroke[], elements: BoardElement[]): LayerEntry[] => [
	...strokes.map((s) => ({ kind: 'stroke' as const, id: s.id })),
	...elements.map((e) => ({ kind: 'element' as const, id: e.id }))
];

/** Keep existing order, append any missing stroke/element ids (legacy boards). */
export const normalizeLayerOrder = (
	order: LayerEntry[] | undefined,
	strokes: Stroke[],
	elements: BoardElement[]
): LayerEntry[] => {
	const strokeIds = new Set(strokes.map((s) => s.id));
	const elementIds = new Set(elements.map((e) => e.id));
	const seen = new Set<string>();
	const out: LayerEntry[] = [];
	if (order?.length) {
		for (const e of order) {
			if (e.kind === 'stroke' && strokeIds.has(e.id) && !seen.has(`s:${e.id}`)) {
				seen.add(`s:${e.id}`);
				out.push(e);
			} else if (e.kind === 'element' && elementIds.has(e.id) && !seen.has(`e:${e.id}`)) {
				seen.add(`e:${e.id}`);
				out.push(e);
			}
		}
	}
	for (const s of strokes) {
		if (!seen.has(`s:${s.id}`)) out.push({ kind: 'stroke', id: s.id });
	}
	for (const el of elements) {
		if (!seen.has(`e:${el.id}`)) out.push({ kind: 'element', id: el.id });
	}
	return out;
};

export const layerOrderToSegments = (order: LayerEntry[]): LayerSegment[] => {
	const out: LayerSegment[] = [];
	let strokeRun: string[] = [];
	const flushStrokes = () => {
		if (strokeRun.length) {
			out.push({ kind: 'strokes', ids: [...strokeRun] });
			strokeRun = [];
		}
	};
	for (const entry of order) {
		if (entry.kind === 'stroke') {
			strokeRun.push(entry.id);
		} else {
			flushStrokes();
			out.push({ kind: 'element', id: entry.id });
		}
	}
	flushStrokes();
	return out;
};

export const bringLayerIdsToFront = (order: LayerEntry[], ids: Set<string>): LayerEntry[] => {
	const selected = order.filter((e) => ids.has(e.id));
	const rest = order.filter((e) => !ids.has(e.id));
	return [...rest, ...selected];
};

export const sendLayerIdsToBack = (order: LayerEntry[], ids: Set<string>): LayerEntry[] => {
	const selected = order.filter((e) => ids.has(e.id));
	const rest = order.filter((e) => !ids.has(e.id));
	return [...selected, ...rest];
};

export const removeLayerEntriesByIds = (order: LayerEntry[], ids: Set<string>): LayerEntry[] =>
	order.filter((e) => !ids.has(e.id));
