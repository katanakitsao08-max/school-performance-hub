import { Wifi, WifiOff, RefreshCw, Cloud } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useOfflineSync } from '@/hooks/use-offline-sync';
import { cn } from '@/lib/utils';

export function OfflineStatusBar() {
  const { online, pending, syncing, syncQueue } = useOfflineSync();

  if (online && pending === 0) return null;

  return (
    <div className={cn(
      "fixed top-14 left-0 right-0 z-40 flex items-center justify-between px-4 py-2 text-xs font-medium transition-all no-print",
      online ? "bg-warning/10 text-warning border-b border-warning/20" : "bg-destructive/10 text-destructive border-b border-destructive/20"
    )}>
      <div className="flex items-center gap-2">
        {online ? (
          <Cloud className="h-3.5 w-3.5" />
        ) : (
          <WifiOff className="h-3.5 w-3.5" />
        )}
        <span>
          {!online ? 'You\'re offline — data will sync when connected' : `${pending} entries pending sync`}
        </span>
      </div>
      {online && pending > 0 && (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-xs text-warning"
          onClick={syncQueue}
          disabled={syncing}
        >
          <RefreshCw className={cn("h-3 w-3 mr-1", syncing && "animate-spin")} />
          {syncing ? 'Syncing...' : 'Sync Now'}
        </Button>
      )}
    </div>
  );
}
