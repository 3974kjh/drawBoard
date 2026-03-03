import { browser } from '$app/environment';
import type { BoardElement, Stroke } from './board-types';

export interface LibraryItem {
	id: string;
	name: string;
	elements: BoardElement[];
	strokes: Stroke[];
	createdAt: string;
	/** Optional thumbnail data URL for list display */
	thumbnail?: string;
}

const STORAGE_KEY = 'drawboard.library.v1';

function createId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export function getLibraryItems(): LibraryItem[] {
	if (!browser) return [];
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

export function saveLibraryItem(
	name: string,
	elements: BoardElement[],
	strokes: Stroke[],
	thumbnail?: string
): LibraryItem {
	const items = getLibraryItems();
	const item: LibraryItem = {
		id: createId(),
		name,
		elements: JSON.parse(JSON.stringify(elements)),
		strokes: JSON.parse(JSON.stringify(strokes)),
		createdAt: new Date().toISOString(),
		thumbnail
	};
	items.unshift(item);
	localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
	return item;
}

export function deleteLibraryItem(id: string): void {
	if (!browser) return;
	const items = getLibraryItems().filter((i) => i.id !== id);
	localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function getLibraryItem(id: string): LibraryItem | null {
	return getLibraryItems().find((i) => i.id === id) ?? null;
}
