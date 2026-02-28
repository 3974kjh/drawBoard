import type { BoardData } from '$lib/board-types';
import { openDB } from './client';
import { STORE_BOARDS } from './schema';

/**
 * Returns all boards, sorted by updatedAt descending.
 */
export async function getAllBoards(): Promise<BoardData[]> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_BOARDS, 'readonly');
		const store = tx.objectStore(STORE_BOARDS);
		const request = store.getAll();
		request.onerror = () => reject(request.error);
		request.onsuccess = () => {
			const boards = (request.result as BoardData[]).sort(
				(a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
			);
			resolve(boards);
		};
	});
}

/**
 * Returns a single board by id, or null if not found.
 */
export async function getBoardById(id: string): Promise<BoardData | null> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_BOARDS, 'readonly');
		const store = tx.objectStore(STORE_BOARDS);
		const request = store.get(id);
		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result ?? null);
	});
}

/**
 * Inserts or updates a board. Returns the saved board (with updatedAt set).
 */
export async function putBoard(board: BoardData): Promise<BoardData> {
	const saved = { ...board, updatedAt: new Date().toISOString() };
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_BOARDS, 'readwrite');
		const store = tx.objectStore(STORE_BOARDS);
		const request = store.put(saved);
		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(saved);
	});
}

/**
 * Deletes a board by id.
 */
export async function deleteBoardById(id: string): Promise<void> {
	const db = await openDB();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_BOARDS, 'readwrite');
		const store = tx.objectStore(STORE_BOARDS);
		const request = store.delete(id);
		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve();
	});
}
