/**
 * Thin IndexedDB access for the offline check-in stores.
 *
 * Everything here is synchronous-in-spirit: one database, two object stores,
 * one shared `requestToPromise` wrapper. No promise library, no generic
 * OfflineStore<T> — the outbox and the view cache are the only consumers.
 *
 * `indexedDB` is read lazily so importing this module in a non-browser
 * environment (unit tests) never throws; the tests install their own stub.
 */

export const OFFLINE_DB_NAME = "starstask-offline";
export const OFFLINE_DB_VERSION = 1;
export const OUTBOX_STORE = "checkin_outbox";
export const CACHE_STORE = "checkin_cache";

/** Fixed key for the single cached view record inside `checkin_cache`. */
export const LAST_VIEW_KEY = "last-view";

function getIdb(): IDBFactory {
  const idb = globalThis.indexedDB;

  if (!idb) {
    throw new Error(
      "IndexedDB is not available in this environment; offline persistence is disabled.",
    );
  }

  return idb;
}

export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      reject(request.error ?? new Error("IndexedDB request failed"));
    };
  });
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => {
      reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    };
    transaction.onabort = () => {
      reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
    };
  });
}

function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = getIdb().open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(OUTBOX_STORE)) {
        database.createObjectStore(OUTBOX_STORE, { keyPath: "id" });
      }

      if (!database.objectStoreNames.contains(CACHE_STORE)) {
        database.createObjectStore(CACHE_STORE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      reject(request.error ?? new Error("Could not open the offline database"));
    };
    request.onblocked = () => {
      reject(
        new Error("The offline database upgrade is blocked by another tab"),
      );
    };
  });
}

/**
 * Runs `work` against a single store and closes the database connection
 * afterwards. The connection lifetime is short by design; the outbox is not
 * hot enough to justify a pooled handle.
 */
export async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  const database = await openOfflineDb();

  try {
    const transaction = database.transaction(storeName, mode);
    // Attach completion handlers before issuing any request: real IndexedDB
    // fires `complete` after all requests in the transaction settle, so the
    // handler cannot race the requests. The in-test stub dispatches in
    // microtasks, which would beat a handler attached afterwards.
    const completion = transactionToPromise(transaction);
    const store = transaction.objectStore(storeName);
    const result = await work(store);

    await completion;

    return result;
  } finally {
    database.close();
  }
}

export async function getOutboxStore<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  return withStore(OUTBOX_STORE, mode, work);
}

export async function getCacheStore<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => Promise<T>,
): Promise<T> {
  return withStore(CACHE_STORE, mode, work);
}

/** Deletes every record in both stores without dropping the schema. */
export async function clearOfflineStores(): Promise<void> {
  const database = await openOfflineDb();

  try {
    const transaction = database.transaction(
      [OUTBOX_STORE, CACHE_STORE],
      "readwrite",
    );

    transaction.objectStore(OUTBOX_STORE).clear();
    transaction.objectStore(CACHE_STORE).clear();
    await transactionToPromise(transaction);
  } finally {
    database.close();
  }
}
