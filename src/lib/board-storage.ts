import { browser } from '$app/environment';
import type { BoardData, ThemeId } from '$lib/board-types';

const STORAGE_KEY = 'drawboard.boards.v1';

const createId = () => {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
};

const safeParse = (value: string | null): BoardData[] => {
	if (!value) return [];
	try {
		const parsed = JSON.parse(value);
		return Array.isArray(parsed) ? (parsed as BoardData[]) : [];
	} catch {
		return [];
	}
};

const sortByUpdatedAt = (boards: BoardData[]) =>
	boards.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

export const getBoards = (): BoardData[] => {
	if (!browser) return [];
	return sortByUpdatedAt(safeParse(localStorage.getItem(STORAGE_KEY)));
};

export const getBoardById = (id: string): BoardData | null => {
	return getBoards().find((board) => board.id === id) ?? null;
};

export const upsertBoard = (board: BoardData): BoardData => {
	if (!browser) return board;
	const boards = getBoards();
	const nextBoard = { ...board, updatedAt: new Date().toISOString() };
	const idx = boards.findIndex((item) => item.id === nextBoard.id);
	if (idx > -1) {
		boards[idx] = nextBoard;
	} else {
		boards.push(nextBoard);
	}
	localStorage.setItem(STORAGE_KEY, JSON.stringify(sortByUpdatedAt(boards)));
	return nextBoard;
};

export const createBoard = (title: string, themeId: ThemeId): BoardData => {
	const now = new Date().toISOString();
	const board: BoardData = {
		id: createId(),
		title,
		themeId,
		createdAt: now,
		updatedAt: now,
		strokes: [],
		elements: []
	};
	return upsertBoard(board);
};

export const deleteBoard = (id: string): void => {
	if (!browser) return;
	const boards = getBoards().filter((board) => board.id !== id);
	localStorage.setItem(STORAGE_KEY, JSON.stringify(boards));
};
