/**
 * Capa de persistencia: IndexedDB con versionado y migraciones.
 *
 * Si IndexedDB no está disponible (navegador raro, modo privado viejo, tests)
 * cae a un almacén en memoria respaldado por localStorage, así la app nunca
 * queda rota — sólo pierde durabilidad y lo dice.
 */

export const DB_NAME = 'lake';
export const SCHEMA_VERSION = 1;

export const STORES = {
  kv: 'kv',
  sessions: 'sessions',
  challenges: 'challenges',
  achievements: 'achievements',
  weights: 'weights',
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

export type StorageMode = 'indexeddb' | 'fallback';

let dbPromise: Promise<IDBDatabase> | null = null;
let mode: StorageMode = 'indexeddb';

export const storageMode = (): StorageMode => mode;

function migrate(db: IDBDatabase, oldVersion: number): void {
  // Cada versión agrega lo suyo y no toca lo anterior.
  if (oldVersion < 1) {
    db.createObjectStore(STORES.kv, { keyPath: 'key' });
    const sessions = db.createObjectStore(STORES.sessions, { keyPath: 'id' });
    sessions.createIndex('date', 'date', { unique: false });
    db.createObjectStore(STORES.challenges, { keyPath: 'date' });
    db.createObjectStore(STORES.achievements, { keyPath: 'id' });
    const weights = db.createObjectStore(STORES.weights, { keyPath: 'id' });
    weights.createIndex('date', 'date', { unique: false });
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no disponible'));
      return;
    }
    const req = indexedDB.open(DB_NAME, SCHEMA_VERSION);
    req.onupgradeneeded = (event) => migrate(req.result, event.oldVersion);
    req.onsuccess = () => {
      req.result.onversionchange = () => req.result.close();
      resolve(req.result);
    };
    req.onerror = () => reject(req.error ?? new Error('No se pudo abrir IndexedDB'));
    req.onblocked = () => reject(new Error('IndexedDB bloqueada por otra pestaña'));
  });
}

/* ------------------------------------------------------------------ */
/* Fallback en memoria + localStorage                                  */
/* ------------------------------------------------------------------ */

const FALLBACK_KEY = 'lake:fallback';
type FallbackShape = Record<StoreName, Record<string, unknown>>;

const emptyFallback = (): FallbackShape => ({
  kv: {}, sessions: {}, challenges: {}, achievements: {}, weights: {},
});

let fallback: FallbackShape | null = null;

function loadFallback(): FallbackShape {
  if (fallback) return fallback;
  fallback = emptyFallback();
  try {
    const raw = localStorage.getItem(FALLBACK_KEY);
    if (raw) fallback = { ...emptyFallback(), ...(JSON.parse(raw) as FallbackShape) };
  } catch {
    /* arrancamos vacío */
  }
  return fallback;
}

function saveFallback(): void {
  try {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(loadFallback()));
  } catch {
    /* sin espacio: seguimos en memoria */
  }
}

const keyOf = (store: StoreName, value: Record<string, unknown>): string =>
  String(store === STORES.kv ? value.key : store === STORES.challenges ? value.date : value.id);

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

async function db(): Promise<IDBDatabase | null> {
  if (mode === 'fallback') return null;
  if (!dbPromise) {
    dbPromise = openDb().catch((e) => {
      console.warn('[LAKE] IndexedDB no disponible, uso almacenamiento local.', e);
      mode = 'fallback';
      throw e;
    });
  }
  try {
    return await dbPromise;
  } catch {
    return null;
  }
}

function tx<T>(store: StoreName, mode_: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(
    (conn) =>
      new Promise<T>((resolve, reject) => {
        if (!conn) {
          reject(new Error('fallback'));
          return;
        }
        const t = conn.transaction(store, mode_);
        const req = run(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

export async function getAll<T>(store: StoreName): Promise<T[]> {
  try {
    return await tx<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>);
  } catch {
    return Object.values(loadFallback()[store]) as T[];
  }
}

export async function get<T>(store: StoreName, key: string): Promise<T | undefined> {
  try {
    return await tx<T | undefined>(store, 'readonly', (s) => s.get(key) as IDBRequest<T | undefined>);
  } catch {
    return loadFallback()[store][key] as T | undefined;
  }
}

export async function put<T extends object>(store: StoreName, value: T): Promise<void> {
  try {
    await tx(store, 'readwrite', (s) => s.put(value) as IDBRequest<IDBValidKey>);
  } catch {
    const f = loadFallback();
    f[store][keyOf(store, value as Record<string, unknown>)] = value;
    saveFallback();
  }
}

export async function putMany<T extends object>(store: StoreName, values: T[]): Promise<void> {
  if (values.length === 0) return;
  const conn = await db();
  if (!conn) {
    const f = loadFallback();
    for (const v of values) f[store][keyOf(store, v as Record<string, unknown>)] = v;
    saveFallback();
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const t = conn.transaction(store, 'readwrite');
    const os = t.objectStore(store);
    for (const v of values) os.put(v);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function remove(store: StoreName, key: string): Promise<void> {
  try {
    await tx(store, 'readwrite', (s) => s.delete(key) as unknown as IDBRequest<undefined>);
  } catch {
    delete loadFallback()[store][key];
    saveFallback();
  }
}

export async function clearStore(store: StoreName): Promise<void> {
  try {
    await tx(store, 'readwrite', (s) => s.clear() as unknown as IDBRequest<undefined>);
  } catch {
    loadFallback()[store] = {};
    saveFallback();
  }
}

/** Borra todo. Sólo se usa desde "Resetear aplicación", con confirmación. */
export async function wipe(): Promise<void> {
  for (const store of Object.values(STORES)) await clearStore(store);
  fallback = emptyFallback();
  saveFallback();
}

/* --- clave/valor tipado para singletons ---------------------------- */

interface KvRow<T> {
  key: string;
  value: T;
}

export async function kvGet<T>(key: string): Promise<T | null> {
  const row = await get<KvRow<T>>(STORES.kv, key);
  return row ? row.value : null;
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  await put<KvRow<T>>(STORES.kv, { key, value });
}
