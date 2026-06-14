import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getOfflineQueue, markSynced, markConflict, bumpAttempt, removeEntry,
  clearSyncedEntries, getPendingCount, getConflictCount, getConflicts,
  isOnline, OfflineEntry,
} from '@/lib/offline-queue';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

const RETRY_INTERVAL_MS = 60_000;       // periodic retry when online
const MAX_ATTEMPTS = 5;                  // give up after N failed network tries

export type ConflictResolution = 'keep_mine' | 'keep_server' | 'discard';

export function useOfflineSync() {
  const [online, setOnline] = useState(isOnline());
  const [pending, setPending] = useState(getPendingCount());
  const [conflicts, setConflicts] = useState<OfflineEntry[]>(getConflicts());
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);

  // --- Reactive counters: rebind on queue changes ---
  useEffect(() => {
    const refresh = () => {
      setPending(getPendingCount());
      setConflicts(getConflicts());
    };
    window.addEventListener('offline-queue:changed', refresh);
    window.addEventListener('offline-queue:hydrated', refresh);
    return () => {
      window.removeEventListener('offline-queue:changed', refresh);
      window.removeEventListener('offline-queue:hydrated', refresh);
    };
  }, []);

  const syncQueue = useCallback(async () => {
    if (!isOnline() || syncingRef.current) return;
    const queue = getOfflineQueue().filter(
      e => !e.synced && e.status !== 'conflict' && (e.attempts || 0) < MAX_ATTEMPTS,
    );
    if (queue.length === 0) return;

    syncingRef.current = true;
    setSyncing(true);
    let successCount = 0;
    let conflictCount = 0;

    for (const entry of queue) {
      try {
        if (entry.type === 'score') {
          const d = entry.data as any;
          // Conflict check: fetch existing row, compare updated_at to local timestamp.
          const { data: existing } = await supabase
            .from('scores')
            .select('id, score, updated_at, teacher_comment')
            .eq('learner_id', d.learner_id)
            .eq('learning_area_id', d.learning_area_id)
            .eq('term', d.term).eq('year', d.year)
            .eq('assessment_type', d.assessment_type)
            .maybeSingle();

          if (existing?.updated_at) {
            const serverTs = new Date(existing.updated_at).getTime();
            if (serverTs > entry.timestamp && Number(existing.score) !== Number(d.score)) {
              markConflict(entry.id, existing as any, 'Server has a newer value');
              conflictCount++;
              continue;
            }
          }
          const { error } = await supabase.from('scores').upsert(d, {
            onConflict: 'learner_id,learning_area_id,term,year,assessment_type',
          });
          if (error) { bumpAttempt(entry.id, error.message); continue; }
          markSynced(entry.id); successCount++;
        } else if (entry.type === 'score-delete') {
          const d = entry.data as any;
          const { error } = await supabase.from('scores').delete()
            .eq('learner_id', d.learner_id)
            .eq('learning_area_id', d.learning_area_id)
            .eq('term', d.term).eq('year', d.year)
            .eq('assessment_type', d.assessment_type);
          if (error) { bumpAttempt(entry.id, error.message); continue; }
          markSynced(entry.id); successCount++;
        } else if (entry.type === 'attendance') {
          const { error } = await supabase.from('attendance').upsert(entry.data as any);
          if (error) { bumpAttempt(entry.id, error.message); continue; }
          markSynced(entry.id); successCount++;
        }
      } catch (e: any) {
        bumpAttempt(entry.id, e?.message || String(e));
      }
    }

    clearSyncedEntries();
    setPending(getPendingCount());
    setConflicts(getConflicts());
    setSyncing(false);
    syncingRef.current = false;

    if (successCount > 0) {
      toast({ title: 'Synced', description: `${successCount} offline ${successCount === 1 ? 'entry' : 'entries'} synced.` });
    }
    if (conflictCount > 0) {
      toast({
        title: 'Sync conflicts',
        description: `${conflictCount} ${conflictCount === 1 ? 'entry conflicts' : 'entries conflict'} with newer server data — review needed.`,
        variant: 'destructive',
      });
    }
  }, []);

  // online/offline listeners + initial sync
  useEffect(() => {
    const handleOnline = () => { setOnline(true); void syncQueue(); };
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    // Try once on mount in case there are leftovers
    if (isOnline()) void syncQueue();
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncQueue]);

  // Periodic retry while online
  useEffect(() => {
    const id = setInterval(() => {
      if (isOnline() && getPendingCount() > 0) void syncQueue();
    }, RETRY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [syncQueue]);

  // Resolve a conflict
  const resolveConflict = useCallback(async (id: string, choice: ConflictResolution) => {
    const entry = getOfflineQueue().find(e => e.id === id);
    if (!entry) return;
    if (choice === 'keep_server' || choice === 'discard') {
      removeEntry(id);
      setConflicts(getConflicts());
      return;
    }
    // keep_mine — force-upsert local value
    if (entry.type === 'score') {
      const { error } = await supabase.from('scores').upsert(entry.data as any, {
        onConflict: 'learner_id,learning_area_id,term,year,assessment_type',
      });
      if (error) {
        toast({ title: 'Could not save', description: error.message, variant: 'destructive' });
        return;
      }
    } else if (entry.type === 'attendance') {
      const { error } = await supabase.from('attendance').upsert(entry.data as any);
      if (error) {
        toast({ title: 'Could not save', description: error.message, variant: 'destructive' });
        return;
      }
    }
    markSynced(id);
    clearSyncedEntries();
    setConflicts(getConflicts());
    setPending(getPendingCount());
    toast({ title: 'Resolved', description: 'Your version was saved.' });
  }, []);

  return { online, pending, conflicts, conflictCount: conflicts.length, syncing, syncQueue, resolveConflict };
}
