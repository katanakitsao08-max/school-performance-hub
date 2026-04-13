import { useState, useEffect, useCallback } from 'react';
import { getOfflineQueue, markSynced, clearSyncedEntries, getPendingCount, isOnline, OfflineEntry } from '@/lib/offline-queue';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export function useOfflineSync() {
  const [online, setOnline] = useState(isOnline());
  const [pending, setPending] = useState(getPendingCount());
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => { setOnline(true); syncQueue(); };
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setPending(getPendingCount());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const syncQueue = useCallback(async () => {
    if (!isOnline() || syncing) return;
    const queue = getOfflineQueue().filter(e => !e.synced);
    if (queue.length === 0) return;

    setSyncing(true);
    let successCount = 0;

    for (const entry of queue) {
      try {
        if (entry.type === 'score') {
          const { error } = await supabase.from('scores').upsert(entry.data as any, {
            onConflict: 'learner_id,learning_area_id,term,year,assessment_type',
          });
          if (!error) { markSynced(entry.id); successCount++; }
        } else if (entry.type === 'attendance') {
          const { error } = await supabase.from('attendance').upsert(entry.data as any);
          if (!error) { markSynced(entry.id); successCount++; }
        }
      } catch (e) {
        console.error('Sync error for entry:', entry.id, e);
      }
    }

    clearSyncedEntries();
    setPending(getPendingCount());
    setSyncing(false);

    if (successCount > 0) {
      toast({ title: 'Synced', description: `${successCount} offline entries synced successfully.` });
    }
  }, [syncing]);

  return { online, pending, syncing, syncQueue };
}
