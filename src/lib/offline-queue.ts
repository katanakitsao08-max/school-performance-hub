/**
 * Offline-first queue for scores & attendance.
 *
 * Backed by IndexedDB for durability across large datasets and tab restarts,
 * with an in-memory mirror so existing synchronous callers keep working.
 * Falls back to localStorage if IndexedDB is unavailable.
 *
 * Adds:
 *  - attempt counters & last error for retry visibility
 *  - status: pending | conflict | synced
 *  - serverSnapshot for conflict review (when server row is newer)
 *  - one-time migration from the legacy localStorage queue
 */

export type OfflineStatus = 'pending' | 'conflict' | 'synced';

export interface OfflineEntry {
  id: string;
  type: 'score' | 'attendance' | 'score-delete';
  data: Record<string, unknown>;
  timestamp: number;        // when the user made the change locally
  synced: boolean;          // legacy flag, kept for backward compat
  status?: OfflineStatus;
  attempts?: number;
  lastError?: string;
  serverSnapshot?: Record<string, unknown> | null;  // populated on conflict
  resolvedAt?: number;
}

const DB_NAME = 'pt_offline';
const STORE = 'queue';
const LEGACY_KEY = 'cbc_offline_queue';
const MIRROR_KEY = 'cbc_offline_queue'; // reuse same key for mirror (back-compat)

// ---------- IndexedDB primitives ----------

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

async function idbAll(): Promise<OfflineEntry[]> {
  const db = await openDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve((req.result || []) as OfflineEntry[]);
      req.onerror = () => resolve([]);
    } catch { resolve([]); }
  });
}

async function idbPut(entry: OfflineEntry): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch { resolve(); }
  });
}

async function idbDelete(id: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch { resolve(); }
  });
}

// ---------- In-memory mirror (hydrated on load) ----------

let mirror: OfflineEntry[] = [];

function loadMirrorFromLocal(): OfflineEntry[] {
  try {
    const raw = localStorage.getItem(MIRROR_KEY);
    return raw ? (JSON.parse(raw) as OfflineEntry[]) : [];
  } catch { return []; }
}

function persistMirror() {
  try { localStorage.setItem(MIRROR_KEY, JSON.stringify(mirror)); } catch {}
}

// Hydrate immediately from localStorage (sync) so getters work right away,
// then upgrade from IndexedDB (async) once available.
mirror = loadMirrorFromLocal();

(async () => {
  const fromIdb = await idbAll();
  if (fromIdb.length === 0 && mirror.length > 0) {
    // First-run migration: push legacy localStorage entries into IDB.
    for (const e of mirror) await idbPut(e);
  } else if (fromIdb.length > 0) {
    // IDB is the source of truth; merge any local-only entries (rare).
    const seen = new Set(fromIdb.map(e => e.id));
    const merged = [...fromIdb, ...mirror.filter(e => !seen.has(e.id))];
    mirror = merged;
    persistMirror();
  }
  // Notify listeners that hydration is done
  try { window.dispatchEvent(new CustomEvent('offline-queue:hydrated')); } catch {}
})();

// ---------- Public API (sync; backed by mirror + async IDB writes) ----------

export function getOfflineQueue(): OfflineEntry[] {
  return mirror.slice();
}

export function addToOfflineQueue(entry: Omit<OfflineEntry, 'id' | 'timestamp' | 'synced'>): void {
  const full: OfflineEntry = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    synced: false,
    status: 'pending',
    attempts: 0,
  };
  mirror.push(full);
  persistMirror();
  void idbPut(full);
  try { window.dispatchEvent(new CustomEvent('offline-queue:changed')); } catch {}
}

export function updateEntry(id: string, patch: Partial<OfflineEntry>): void {
  const idx = mirror.findIndex(e => e.id === id);
  if (idx < 0) return;
  mirror[idx] = { ...mirror[idx], ...patch };
  persistMirror();
  void idbPut(mirror[idx]);
  try { window.dispatchEvent(new CustomEvent('offline-queue:changed')); } catch {}
}

export function markSynced(id: string): void {
  updateEntry(id, { synced: true, status: 'synced', resolvedAt: Date.now() });
}

export function markConflict(id: string, serverSnapshot: Record<string, unknown> | null, error?: string): void {
  updateEntry(id, { status: 'conflict', serverSnapshot, lastError: error });
}

export function bumpAttempt(id: string, error?: string): void {
  const e = mirror.find(x => x.id === id);
  if (!e) return;
  updateEntry(id, { attempts: (e.attempts || 0) + 1, lastError: error });
}

export function removeEntry(id: string): void {
  mirror = mirror.filter(e => e.id !== id);
  persistMirror();
  void idbDelete(id);
  try { window.dispatchEvent(new CustomEvent('offline-queue:changed')); } catch {}
}

export function clearSyncedEntries(): void {
  const synced = mirror.filter(e => e.synced || e.status === 'synced');
  mirror = mirror.filter(e => !(e.synced || e.status === 'synced'));
  persistMirror();
  for (const e of synced) void idbDelete(e.id);
  try { window.dispatchEvent(new CustomEvent('offline-queue:changed')); } catch {}
}

export function getPendingCount(): number {
  return mirror.filter(e => !e.synced && e.status !== 'conflict' && e.status !== 'synced').length;
}

export function getConflictCount(): number {
  return mirror.filter(e => e.status === 'conflict').length;
}

export function getConflicts(): OfflineEntry[] {
  return mirror.filter(e => e.status === 'conflict');
}

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}
