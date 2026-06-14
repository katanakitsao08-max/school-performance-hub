import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Share, Plus, Smartphone } from 'lucide-react';
import { usePwaInstall } from '@/hooks/use-pwa-install';
import { useAuth } from '@/contexts/AuthContext';

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
}

export function PwaInstallPrompt() {
  const { user, loading } = useAuth();
  const { canPrompt, installed, promptInstall, snoozeDays, isSnoozed, inIframe } = usePwaInstall();
  const [iosOpen, setIosOpen] = useState(false);
  const firedRef = useRef(false);

  // Auto-fire the native install prompt as soon as the browser allows it,
  // shortly after the user logs in. Browsers permit calling prompt() on the
  // deferred event without a fresh user gesture.
  useEffect(() => {
    if (loading || !user) return;
    if (installed || inIframe) return;
    if (isSnoozed()) return;
    if (firedRef.current) return;

    // Android / Chrome / Edge: native auto-install
    if (canPrompt) {
      firedRef.current = true;
      const t = setTimeout(async () => {
        const outcome = await promptInstall();
        if (outcome === 'dismissed') snoozeDays(3);
      }, 1200);
      return () => clearTimeout(t);
    }

    // iOS: no programmatic install — show one-time how-to.
    if (isIos()) {
      firedRef.current = true;
      const t = setTimeout(() => setIosOpen(true), 1500);
      return () => clearTimeout(t);
    }
  }, [loading, user, installed, inIframe, canPrompt, isSnoozed, promptInstall, snoozeDays]);

  const closeIos = () => {
    snoozeDays(7);
    setIosOpen(false);
  };

  return (
    <Dialog open={iosOpen} onOpenChange={(o) => { if (!o) closeIos(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
            <Smartphone className="h-7 w-7 text-primary" />
          </div>
          <DialogTitle className="text-center">Install PerformTrack</DialogTitle>
          <DialogDescription className="text-center">
            Add PerformTrack to your Home Screen for a full-screen, app-like experience.
          </DialogDescription>
        </DialogHeader>
        <ol className="space-y-3 text-sm text-foreground mt-2">
          <li className="flex items-start gap-2">
            <span className="font-bold text-primary">1.</span>
            <span className="flex-1">Tap the <Share className="inline h-4 w-4 mx-1 text-primary" /> <strong>Share</strong> button in Safari.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-primary">2.</span>
            <span className="flex-1">Scroll and tap <Plus className="inline h-4 w-4 mx-1 text-primary" /> <strong>Add to Home Screen</strong>.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold text-primary">3.</span>
            <span className="flex-1">Tap <strong>Add</strong>.</span>
          </li>
        </ol>
        <Button className="w-full mt-4" onClick={closeIos}>Got it</Button>
      </DialogContent>
    </Dialog>
  );
}
