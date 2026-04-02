/**
 * 보드 데이터를 JSON 파일로 내보내기/가져오기.
 * 단일 보드: BoardData 객체 하나.
 * 다중 보드: BoardData[] 배열 (메인 페이지 일괄 내보내기/가져오기).
 */
import type { BoardData, LayerEntry } from '$lib/board-types';

const BOARD_JSON_VERSION = 1;

export type BoardJsonSingle = BoardData;

export type BoardJsonMulti = {
	version: number;
	exportedAt: string;
	boards: BoardData[];
};

/** 단일 보드를 JSON Blob으로 반환 */
export const boardToJsonBlob = (board: BoardData): Blob => {
	const json = JSON.stringify(board, null, 2);
	return new Blob([json], { type: 'application/json' });
};

/** 여러 보드를 하나의 JSON Blob으로 반환 */
export const boardsToJsonBlob = (boards: BoardData[]): Blob => {
	const payload: BoardJsonMulti = {
		version: BOARD_JSON_VERSION,
		exportedAt: new Date().toISOString(),
		boards
	};
	return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
};

/** Blob을 파일로 다운로드 */
export const downloadBlob = (blob: Blob, filename: string): void => {
	const a = document.createElement('a');
	a.href = URL.createObjectURL(blob);
	a.download = filename;
	a.click();
	URL.revokeObjectURL(a.href);
};

/** 파싱된 객체를 필수 필드가 있는 BoardData로 정규화 */
const normalizeParsedBoard = (o: Record<string, unknown>): BoardData => {
	const now = new Date().toISOString();
	return {
		id: typeof o.id === 'string' ? o.id : `import-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
		title: typeof o.title === 'string' ? o.title : 'Untitled',
		themeId: (typeof o.themeId === 'string' && (o.themeId === 'whiteboard' || o.themeId === 'chalkboard' || o.themeId === 'neon-grid')) ? o.themeId : 'whiteboard',
		createdAt: typeof o.createdAt === 'string' ? o.createdAt : now,
		updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : now,
		strokes: Array.isArray(o.strokes) ? o.strokes : [],
		elements: Array.isArray(o.elements) ? o.elements : [],
		layerOrder: Array.isArray(o.layerOrder)
			? (o.layerOrder as LayerEntry[]).filter(
					(e: unknown): e is LayerEntry =>
						e != null &&
						typeof e === 'object' &&
						((e as LayerEntry).kind === 'stroke' || (e as LayerEntry).kind === 'element') &&
						typeof (e as LayerEntry).id === 'string'
				)
			: undefined,
		thumbnail: typeof o.thumbnail === 'string' ? o.thumbnail : undefined,
		width: typeof o.width === 'number' ? o.width : undefined,
		height: typeof o.height === 'number' ? o.height : undefined,
		gridEnabled: typeof o.gridEnabled === 'boolean' ? o.gridEnabled : undefined,
		gridSize: typeof o.gridSize === 'number' ? o.gridSize : undefined
	};
};

/** JSON 문자열을 파싱. 단일 보드 또는 다중 보드 형식 반환. BOM/앞뒤 공백 제거 */
export const parseBoardJson = (text: string): BoardData[] => {
	const trimmed = text.replace(/^\uFEFF/, '').trim();
	if (!trimmed) return [];
	let raw: unknown;
	try {
		raw = JSON.parse(trimmed);
	} catch {
		return [];
	}
	if (Array.isArray(raw)) {
		return raw.filter((item): item is Record<string, unknown> => isBoardLike(item)).map(normalizeParsedBoard);
	}
	if (raw && typeof raw === 'object' && 'boards' in raw && Array.isArray((raw as BoardJsonMulti).boards)) {
		return (raw as BoardJsonMulti).boards
			.filter((item): item is Record<string, unknown> => isBoardLike(item))
			.map(normalizeParsedBoard);
	}
	if (isBoardLike(raw as Record<string, unknown>)) {
		return [normalizeParsedBoard(raw as Record<string, unknown>)];
	}
	return [];
};

/** 최소한 title + strokes + elements 형태인지 확인 */
const isBoardLike = (v: unknown): v is Record<string, unknown> => {
	if (!v || typeof v !== 'object') return false;
	const o = v as Record<string, unknown>;
	return (
		typeof o.title === 'string' &&
		Array.isArray(o.strokes) &&
		Array.isArray(o.elements)
	);
};
