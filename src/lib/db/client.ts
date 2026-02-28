import { DB_NAME, DB_VERSION, STORE_BOARDS } from './schema';

let dbInstance: IDBDatabase | null = null;

/**
 * Opens the IndexedDB database. Creates the object store on first run.
 * Reuses the same connection on subsequent calls (browser context only).
 */
export function openDB(): Promise<IDBDatabase> {
	if (typeof indexedDB === 'undefined') {
		return Promise.reject(new Error('IndexedDB is not available'));
	}
	if (dbInstance) {
		return Promise.resolve(dbInstance);
	}
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onerror = () => reject(request.error);
		request.onsuccess = () => {
			dbInstance = request.result;
			resolve(dbInstance);
		};
		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;
			if (!db.objectStoreNames.contains(STORE_BOARDS)) {
				db.createObjectStore(STORE_BOARDS, { keyPath: 'id' });
			}
		};
	});
}

/**
 * Closes the database connection. Useful for tests or when clearing state.
 * Next openDB() will open a new connection.
 */
export function closeDB(): void {
	if (dbInstance) {
		dbInstance.close();
		dbInstance = null;
	}
}
