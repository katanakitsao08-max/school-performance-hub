/**
 * Offline queue for scores and attendance entries.
 * Uses localStorage as a lightweight IndexedDB alternative.
 */

export interface OfflineEntry {
  id: string;
  type: 'score' | 'attendance' | 'score-delete';
  data: Record<string, unknown>;
  timestamp: number;
  synced: boolean;
}

const QUEUE_KEY = 'cbc_offline_queue';

export function getOfflineQueue(): OfflineEntry[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addToOfflineQueue(entry: Omit<OfflineEntry, 'id' | 'timestamp' | 'synced'>): void {
  const queue = getOfflineQueue();
  queue.push({
    ...entry,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    synced: false,
  });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function markSynced(id: string): void {
  const queue = getOfflineQueue();
  const updated = queue.map(e => e.id === id ? { ...e, synced: true } : e);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
}

export function clearSyncedEntries(): void {
  const queue = getOfflineQueue().filter(e => !e.synced);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function getPendingCount(): number {
  return getOfflineQueue().filter(e => !e.synced).length;
}

export function isOnline(): boolean {
  return navigator.onLine;
}
