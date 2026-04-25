import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Smartphone } from 'lucide-react';
import { usePwaInstall } from '@/hooks/use-pwa-install';
import { useAuth } from '@/contexts/AuthContext';

export function PwaInstallPrompt() {
  const { user, loading } = useAuth();
  const { canPrompt, installed, promptInstall, snoozeDays, isSnoozed, inIframe } = usePwaInstall();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    if (installed || inIframe || !canPrompt) return;
    if (isSnoozed()) return;
    // Slight delay so it doesn't fight the login redirect
    const t = setTimeout(() => setOpen(true), 1200);
    return () => clearTimeout(t);
  }, [loading, user, installed, inIframe, canPrompt, isSnoozed]);

  const handleInstall = async () => {
    await promptInstall();
    setOpen(false);
  };

  const handleLater = () => {
    snoozeDays(3);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
            <Smartphone className="h-7 w-7 text-primary" />
          </div>
          <DialogTitle className="text-center">Install PerformTrack</DialogTitle>
          <DialogDescription className="text-center">
            Install the app for faster access, a home-screen icon, and a full-screen experience.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 mt-2">
          <Button onClick={handleInstall} className="w-full gap-2">
            <Download className="h-4 w-4" /> Install Now
          </Button>
          <Button variant="ghost" onClick={handleLater} className="w-full">
            Maybe Later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
