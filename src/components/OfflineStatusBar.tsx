import { useState } from 'react';
import { WifiOff, RefreshCw, Cloud, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOfflineSync } from '@/hooks/use-offline-sync';
import { OfflineConflictsDialog } from '@/components/OfflineConflictsDialog';
import { cn } from '@/lib/utils';

export function OfflineStatusBar() {
  const { online, pending, conflicts, conflictCount, syncing, syncQueue, resolveConflict } = useOfflineSync();
  const [dialogOpen, setDialogOpen] = useState(false);

  if (online && pending === 0 && conflictCount === 0) return null;

  const hasConflicts = conflictCount > 0;

  return (
    <>
      <div className={cn(
        "fixed top-14 left-0 right-0 z-40 flex items-center justify-between px-4 py-2 text-xs font-medium transition-all no-print",
        !online ? "bg-destructive/10 text-destructive border-b border-destructive/20" :
        hasConflicts ? "bg-warning/15 text-warning-foreground border-b border-warning/30" :
        "bg-warning/10 text-warning border-b border-warning/20"
      )}>
        <div className="flex items-center gap-2 min-w-0">
          {!online ? <WifiOff className="h-3.5 w-3.5 shrink-0" /> :
            hasConflicts ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" /> :
            <Cloud className="h-3.5 w-3.5 shrink-0" />}
          <span className="truncate">
            {!online ? "You're offline — saved locally, will sync when connected" :
              hasConflicts ? `${conflictCount} sync ${conflictCount === 1 ? 'conflict' : 'conflicts'} need review` :
              `${pending} ${pending === 1 ? 'entry' : 'entries'} pending sync`}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {hasConflicts && (
            <Button size="sm" variant="ghost" className="h-6 text-xs text-warning" onClick={() => setDialogOpen(true)}>
              Review
            </Button>
          )}
          {online && pending > 0 && !hasConflicts && (
            <Button size="sm" variant="ghost" className="h-6 text-xs text-warning" onClick={syncQueue} disabled={syncing}>
              <RefreshCw className={cn("h-3 w-3 mr-1", syncing && "animate-spin")} />
              {syncing ? 'Syncing…' : 'Sync now'}
            </Button>
          )}
        </div>
      </div>

      <OfflineConflictsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        conflicts={conflicts}
        onResolve={async (id, choice) => { await resolveConflict(id, choice); }}
      />
    </>
  );
}
