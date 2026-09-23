/**
 * A very small promise wrapper around IndexedDB. Two stores:
 *  - outbox: actions taken at the desk while offline, replayed in order
 *  - cache:  last-known query data (Today, rooms, tape chart) for offline reads
 * Every call degrades to a no-op when IndexedDB is unavailable (private mode,
 * blocked storage), so the app keeps working online.
 */

const DB_NAME = "admin-offline";
const VERSION = 1;
export type StoreName = "outbox" | "cache";

let dbPromise: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("outbox")) db.createObjectStore("outbox", { keyPath: "id" });
        if (!db.objectStoreNames.contains("cache")) db.createObjectStore("cache", { keyPath: "key" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function tx<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return open().then(
    (db) =>
      new Promise<T | undefined>((resolve) => {
        if (!db) return resolve(undefined);
        try {
          const t = db.transaction(store, mode);
          const req = fn(t.objectStore(store));
          t.oncomplete = () => resolve(req ? (req.result as T) : undefined);
          t.onerror = () => resolve(undefined);
          t.onabort = () => resolve(undefined);
        } catch {
          resolve(undefined);
        }
      }),
  );
}

export const idb = {
  all: <T>(store: StoreName) => tx<T[]>(store, "readonly", (s) => s.getAll() as IDBRequest<T[]>).then((v) => v ?? []),
  get: <T>(store: StoreName, key: string) => tx<T>(store, "readonly", (s) => s.get(key) as IDBRequest<T>),
  put: <T>(store: StoreName, value: T) => tx(store, "readwrite", (s) => s.put(value)),
  delete: (store: StoreName, key: string) => tx(store, "readwrite", (s) => s.delete(key)),
  clear: (store: StoreName) => tx(store, "readwrite", (s) => s.clear()),
};
