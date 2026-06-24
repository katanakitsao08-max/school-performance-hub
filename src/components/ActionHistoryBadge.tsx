import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Trash2, FilePen, Archive, Upload, RotateCcw, UserCog, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  recordType?: string;
  recordId?: string;
  module?: string;
  className?: string;
  /** Visual variant; "inline" is a small chip for table rows. */
  variant?: 'inline' | 'card';
}

const ACTION_ICON: Record<string, any> = {
  delete: Trash2,
  edit: FilePen,
  archive: Archive,
  restore: RotateCcw,
  bulk_upload: Upload,
  replace: FilePen,
  disable: ShieldCheck,
  update_user: UserCog,
};

/**
 * 🛡 ACTION HISTORY badge — surfaces the most recent destructive/sensitive
 * action on a record. Click to open a full audit trail dialog.
 */
export function ActionHistoryBadge({ recordType, recordId, module, className, variant = 'inline' }: Props) {
  const [open, setOpen] = useState(false);

  const { data: latest } = useQuery({
    queryKey: ['audit-latest', recordType, recordId, module],
    queryFn: async () => {
      let q = supabase.from('audit_logs')
        .select('id,user_name,role,action,module,record_type,record_id,affected_count,created_at,reason')
        .order('created_at', { ascending: false })
        .limit(1);
      if (recordType) q = q.eq('record_type', recordType);
      if (recordId) q = q.eq('record_id', recordId);
      if (module) q = q.eq('module', module);
      const { data } = await q;
      return data?.[0] || null;
    },
    enabled: !!(recordType || recordId || module),
  });

  const { data: history } = useQuery({
    queryKey: ['audit-history', recordType, recordId, module, open],
    queryFn: async () => {
      let q = supabase.from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (recordType) q = q.eq('record_type', recordType);
      if (recordId) q = q.eq('record_id', recordId);
      if (module) q = q.eq('module', module);
      const { data } = await q;
      return data || [];
    },
    enabled: open,
  });

  if (!latest) return null;
  const Icon = ACTION_ICON[latest.action] || ShieldCheck;

  if (variant === 'inline') {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full border border-amber-300/60 bg-amber-50 text-amber-800 hover:bg-amber-100 transition ${className || ''}`}
          title="View action history"
        >
          <ShieldCheck className="h-3 w-3" />
          {latest.user_name || 'Admin'} · {latest.action}
        </button>
        <HistoryDialog open={open} onOpenChange={setOpen} history={history || []} />
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`w-full text-left rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 hover:bg-amber-50 transition ${className || ''}`}
      >
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-900">
          <ShieldCheck className="h-4 w-4" /> Action History
        </div>
        <div className="mt-1 text-sm text-amber-950 flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <span className="font-medium">{latest.user_name || 'Admin'}</span>
          <Badge variant="outline" className="capitalize">{latest.role}</Badge>
          <span>· {latest.action}</span>
          {latest.affected_count > 1 && <span>· {latest.affected_count} records</span>}
        </div>
        <div className="mt-0.5 text-[11px] text-amber-800 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {format(new Date(latest.created_at), 'd MMM yyyy · HH:mm')} UTC
        </div>
      </button>
      <HistoryDialog open={open} onOpenChange={setOpen} history={history || []} />
    </>
  );
}

function HistoryDialog({ open, onOpenChange, history }: { open: boolean; onOpenChange: (v: boolean) => void; history: any[] }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Action History
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto space-y-2">
          {history.length === 0 && <p className="text-sm text-muted-foreground">No history.</p>}
          {history.map((h) => {
            const Icon = ACTION_ICON[h.action] || ShieldCheck;
            return (
              <div key={h.id} className="rounded-md border bg-card p-3 text-sm">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                      {(h.user_name || 'A').split(' ').map((s: string) => s[0]).slice(0, 2).join('')}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{h.user_name || 'Unknown'} <Badge variant="outline" className="ml-1 capitalize">{h.role}</Badge></div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Icon className="h-3 w-3" />
                        <span className="capitalize">{h.action}</span> · <span>{h.module}</span>
                        {h.record_type && <span>· {h.record_type}</span>}
                        {h.affected_count > 1 && <span>· {h.affected_count} records</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {format(new Date(h.created_at), 'd MMM yyyy · HH:mm')}
                  </div>
                </div>
                {h.reason && <div className="mt-2 text-xs italic text-muted-foreground">"{h.reason}"</div>}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
