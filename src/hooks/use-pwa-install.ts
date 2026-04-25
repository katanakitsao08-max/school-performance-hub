import { useEffect, useState, useCallback } from 'react';

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const DISMISS_KEY = 'pt_pwa_install_dismissed_until';

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari
    (window.navigator as any).standalone === true
  );
}

function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function usePwaInstall() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(isStandalone());
  const [canPrompt, setCanPrompt] = useState(false);

  useEffect(() => {
    if (isInIframe()) return; // Don't engage inside Lovable preview iframe
    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setCanPrompt(true);
    };
    const onInstalled = () => {
      setInstalled(true);
      setCanPrompt(false);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onBIP);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return 'unavailable' as const;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    setCanPrompt(false);
    return choice.outcome;
  }, [deferred]);

  const snoozeDays = useCallback((days: number) => {
    const until = Date.now() + days * 24 * 60 * 60 * 1000;
    try { localStorage.setItem(DISMISS_KEY, String(until)); } catch {}
  }, []);

  const isSnoozed = useCallback(() => {
    try {
      const v = localStorage.getItem(DISMISS_KEY);
      if (!v) return false;
      return Number(v) > Date.now();
    } catch { return false; }
  }, []);

  return { canPrompt, installed, promptInstall, snoozeDays, isSnoozed, inIframe: isInIframe() };
}
