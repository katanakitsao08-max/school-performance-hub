import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Check, X, Cloud, User } from 'lucide-react';
import type { OfflineEntry } from '@/lib/offline-queue';
import type { ConflictResolution } from '@/hooks/use-offline-sync';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  conflicts: OfflineEntry[];
  onResolve: (id: string, choice: ConflictResolution) => void | Promise<void>;
}

function describe(entry: OfflineEntry) {
  const d = entry.data as any;
  if (entry.type === 'score') return `Score ${d.score} (term ${d.term}/${d.year}, ${d.assessment_type})`;
  if (entry.type === 'score-delete') return `Delete score (term ${d.term}/${d.year})`;
  if (entry.type === 'attendance') return `Attendance ${d.status} on ${d.date}`;
  return entry.type;
}

export function OfflineConflictsDialog({ open, onOpenChange, conflicts, onResolve }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Resolve sync conflicts
          </DialogTitle>
          <DialogDescription>
            These entries changed on the server after you saved them offline. Choose which version to keep.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-2">
          <div className="space-y-3">
            {conflicts.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No conflicts 🎉</p>
            )}
            {conflicts.map((c) => {
              const server = c.serverSnapshot as any;
              return (
                <div key={c.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="text-[10px]">{c.type}</Badge>
                    <span className="text-[10px] text-muted-foreground">
                      Saved {new Date(c.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md bg-primary/5 p-2">
                      <div className="flex items-center gap-1 text-[10px] font-semibold text-primary mb-1">
                        <User className="h-3 w-3" /> Your version
                      </div>
                      <div className="font-mono">{describe(c)}</div>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2">
                      <div className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground mb-1">
                        <Cloud className="h-3 w-3" /> Server version
                      </div>
                      <div className="font-mono">
                        {server?.score !== undefined ? `Score ${server.score}` : '—'}
                        {server?.updated_at && (
                          <div className="text-[10px] text-muted-foreground mt-1">
                            {new Date(server.updated_at).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="default" className="flex-1 h-8 text-xs" onClick={() => onResolve(c.id, 'keep_mine')}>
                      <Check className="h-3 w-3 mr-1" /> Keep mine
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => onResolve(c.id, 'keep_server')}>
                      <Cloud className="h-3 w-3 mr-1" /> Keep server
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => onResolve(c.id, 'discard')}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
