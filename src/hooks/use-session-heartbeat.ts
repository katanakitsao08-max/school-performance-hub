import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

const STORAGE_KEY = 'pt_session_token';

function getOrCreateToken(): string {
  try {
    let t = sessionStorage.getItem(STORAGE_KEY);
    if (!t) {
      t = (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)) + '-' + Date.now();
      sessionStorage.setItem(STORAGE_KEY, t);
    }
    return t;
  } catch {
    return 'fallback-' + Date.now();
  }
}

async function ping(event: 'heartbeat' | 'login' | 'logout' = 'heartbeat') {
  try {
    const token = getOrCreateToken();
    await supabase.functions.invoke('session-heartbeat', {
      body: { session_token: token, event },
    });
  } catch {
    // ignore
  }
}

/**
 * Maintains a presence heartbeat for the current user.
 * - Records login on first call
 * - Pings every 60s while tab is visible
 * - Sends logout beacon on unload / signOut
 */
export function useSessionHeartbeat(userId: string | null) {
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    ping('login').catch(() => {});

    const start = () => {
      if (intervalRef.current) return;
      intervalRef.current = window.setInterval(() => {
        if (document.visibilityState === 'visible') ping('heartbeat').catch(() => {});
      }, 60_000);
    };
    const stop = () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    start();

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        ping('heartbeat').catch(() => {});
        start();
      }
    };
    const onUnload = () => {
      try {
        const token = sessionStorage.getItem(STORAGE_KEY);
        if (!token) return;
        // Best-effort logout beacon
        ping('logout').catch(() => {});
      } catch {}
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', onUnload);

    return () => {
      cancelled = true;
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [userId]);
}

export async function sendLogoutBeacon() {
  await ping('logout');
  try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
}
