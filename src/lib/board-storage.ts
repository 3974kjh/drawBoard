import { browser } from '$app/environment';
import type { BoardData, ThemeId } from '$lib/board-types';
import { getAllBoards, getBoardById as dbGetBoardById, putBoard, deleteBoardById as dbDeleteBoardById } from '$lib/db';

const LEGACY_STORAGE_KEY = 'drawboard.boards.v1';
let migratedFromLocalStorage = false;

/** One-time migration: copy boards from localStorage to IndexedDB and clear the key. */
async function migrateFromLocalStorageIfNeeded(): Promise<void> {
	if (!browser || migratedFromLocalStorage) return;
	migratedFromLocalStorage = true;
	const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
	if (!raw) return;
	try {
		const parsed = JSON.parse(raw);
		const boards = Array.isArray(parsed) ? (parsed as BoardData[]) : [];
		for (const board of boards) {
			await putBoard(board);
		}
		localStorage.removeItem(LEGACY_STORAGE_KEY);
	} catch {
		// ignore parse/put errors; leave localStorage as-is
	}
}

const createId = (): string => {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
};

/** Returns all boards sorted by updatedAt descending. */
export async function getBoards(): Promise<BoardData[]> {
	if (!browser) return [];
	await migrateFromLocalStorageIfNeeded();
	return getAllBoards();
}

/** Returns a single board by id, or null. */
export async function getBoardById(id: string): Promise<BoardData | null> {
	if (!browser) return null;
	await migrateFromLocalStorageIfNeeded();
	return dbGetBoardById(id);
}

/** Inserts or updates a board. Returns the saved board. */
export async function upsertBoard(board: BoardData): Promise<BoardData> {
	if (!browser) return { ...board, updatedAt: new Date().toISOString() };
	return putBoard(board);
}

/** Creates a new board and saves it. Returns the created board. */
export async function createBoard(title: string, themeId: ThemeId): Promise<BoardData> {
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
}

/** Deletes a board by id. */
export async function deleteBoard(id: string): Promise<void> {
	if (!browser) return;
	await dbDeleteBoardById(id);
}
