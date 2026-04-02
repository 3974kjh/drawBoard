/** Unified paint order: strokes and shapes interleave (later = on top). */
export type LayerEntry =
	| { kind: 'stroke'; id: string }
	| { kind: 'element'; id: string };

export type LayerSegment =
	| { kind: 'strokes'; ids: string[] }
	| { kind: 'element'; id: string };
