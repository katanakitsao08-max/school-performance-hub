import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, MessageCircle, CheckCircle2, XCircle, Send, ExternalLink, Smartphone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { buildWaMeLink } from '@/lib/wa-link';

export interface WhatsAppRecipient {
  learner_id: string;
  full_name: string;
  grade: string;
  recipient: string; // raw parent_phone
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  recipients: WhatsAppRecipient[];
  term: number;
  year: number;
  assessmentType: string;
  schoolName: string;
  title?: string;
}

interface ResultRow {
  learner_id: string;
  status: 'sent' | 'failed';
  channel?: string;
  error?: string;
  url?: string;
  recipient?: string;
  message?: string;
}

interface PreparedRow extends ResultRow {
  waLink?: string | null;
  opened?: boolean;
}

export function WhatsAppSendDialog({
  open, onOpenChange, recipients, term, year, assessmentType, schoolName, title,
}: Props) {
  const { schoolId } = useAuth();
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [prepared, setPrepared] = useState<PreparedRow[] | null>(null);

  const valid = useMemo(() => recipients.filter(r => r.recipient && r.recipient.trim().length >= 9), [recipients]);
  const missing = recipients.length - valid.length;

  const callEdge = async (mode: 'auto' | 'manual_links') => {
    return supabase.functions.invoke('send-report-whatsapp', {
      body: {
        items: valid.map(r => ({
          learner_id: r.learner_id,
          recipient: r.recipient,
          full_name: r.full_name,
          grade: r.grade,
        })),
        term, year, assessment_type: assessmentType,
        app_url: window.location.origin,
        school_name: schoolName,
        mode,
      },
    });
  };

  const handleAutoSend = async () => {
    if (!valid.length) { toast.error('No valid phone numbers to send to'); return; }
    setSending(true);
    setResults(null);
    setPrepared(null);
    try {
      const { data, error } = await callEdge('auto');
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Send failed');
      setResults(data.results);
      toast.success(`Sent ${data.sent} of ${valid.length}`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const handlePrepareManual = async () => {
    if (!valid.length) { toast.error('No valid phone numbers to send to'); return; }
    setSending(true);
    setResults(null);
    setPrepared(null);
    try {
      const { data, error } = await callEdge('manual_links');
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to prepare links');
      const rows: PreparedRow[] = (data.results || []).map((r: ResultRow) => ({
        ...r,
        waLink: r.recipient && r.message ? buildWaMeLink(r.recipient, r.message) : null,
      }));
      setPrepared(rows);
      toast.success(`Prepared ${rows.filter(r => r.waLink).length} message${rows.length === 1 ? '' : 's'} — tap each to open WhatsApp`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to prepare links');
    } finally {
      setSending(false);
    }
  };

  const openOne = (idx: number) => {
    setPrepared(prev => {
      if (!prev) return prev;
      const row = prev[idx];
      if (row?.waLink) window.open(row.waLink, '_blank', 'noopener,noreferrer');
      return prev.map((r, i) => i === idx ? { ...r, opened: true } : r);
    });
  };

  const openAllRemaining = () => {
    if (!prepared) return;
    const toOpen = prepared.filter(r => r.waLink && !r.opened);
    if (toOpen.length === 0) { toast.info('All messages already opened'); return; }
    if (toOpen.length > 5) {
      const ok = window.confirm(
        `Open ${toOpen.length} WhatsApp chats in new tabs? Your browser may block this — if so, tap each row individually.`
      );
      if (!ok) return;
    }
    toOpen.forEach(r => window.open(r.waLink!, '_blank', 'noopener,noreferrer'));
    setPrepared(prev => prev?.map(r => r.waLink ? { ...r, opened: true } : r) || null);
  };

  const lookupName = (id: string) => recipients.find(r => r.learner_id === id)?.full_name || id;

  const reset = () => { setResults(null); setPrepared(null); };

  const showingResults = !!results;
  const showingPrepared = !!prepared;
  const showingPicker = !showingResults && !showingPrepared;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            {title || 'Send Reports via WhatsApp'}
          </DialogTitle>
          <DialogDescription>
            Choose how to deliver report cards. Each parent receives a secure 48-hour view link.
          </DialogDescription>
        </DialogHeader>

        {showingPicker && (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-md border p-3 text-sm">
              <span>Recipients with valid numbers</span>
              <Badge>{valid.length} of {recipients.length}</Badge>
            </div>
            {missing > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {missing} learner{missing > 1 ? 's' : ''} have no parent phone number on file and will be skipped.
              </p>
            )}
            <ScrollArea className="h-40 rounded-md border">
              <ul className="p-2 text-sm">
                {recipients.map(r => (
                  <li key={r.learner_id} className="flex items-center justify-between py-1">
                    <span className="truncate">{r.full_name} <span className="text-muted-foreground text-xs">· G{r.grade}</span></span>
                    <span className="text-xs text-muted-foreground ml-2">{r.recipient || '— no number —'}</span>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </div>
        )}

        {showingPrepared && prepared && (
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-md border p-3 text-sm bg-muted/40">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-primary" />
                <span>Tap each row to open in <strong>your WhatsApp</strong></span>
              </div>
              <Badge variant="outline">{prepared.filter(r => r.opened).length}/{prepared.length} opened</Badge>
            </div>
            <ScrollArea className="h-64 rounded-md border">
              <ul className="divide-y">
                {prepared.map((r, idx) => (
                  <li key={r.learner_id} className="flex items-center justify-between p-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{lookupName(r.learner_id)}</div>
                      <div className="text-xs text-muted-foreground truncate">{r.recipient || 'no number'}</div>
                    </div>
                    <Button
                      size="sm"
                      variant={r.opened ? 'outline' : 'default'}
                      disabled={!r.waLink}
                      onClick={() => openOne(idx)}
                      className="ml-2 shrink-0"
                    >
                      {r.opened
                        ? <><CheckCircle2 className="h-3 w-3 mr-1" />Opened</>
                        : <><ExternalLink className="h-3 w-3 mr-1" />Open</>}
                    </Button>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </div>
        )}

        {showingResults && results && (
          <ScrollArea className="h-64 rounded-md border">
            <ul className="p-2 text-sm">
              {results.map(r => (
                <li key={r.learner_id} className="flex items-center justify-between py-1">
                  <span className="truncate flex items-center gap-2">
                    {r.status === 'sent'
                      ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                      : <XCircle className="h-4 w-4 text-destructive shrink-0" />}
                    {lookupName(r.learner_id)}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {r.status === 'sent' ? r.channel : (r.error || 'failed')}
                  </span>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {showingPicker && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>Cancel</Button>
              <Button
                variant="secondary"
                onClick={handleAutoSend}
                disabled={sending || !valid.length}
                title="Auto-send via Africa's Talking (WhatsApp/SMS)"
              >
                {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Send className="h-4 w-4 mr-2" />
                Auto-send
              </Button>
              <Button
                onClick={handlePrepareManual}
                disabled={sending || !valid.length}
                title="Prepare wa.me links — sends from your personal WhatsApp"
              >
                {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Smartphone className="h-4 w-4 mr-2" />
                Send via my WhatsApp
              </Button>
            </>
          )}
          {showingPrepared && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Done</Button>
              <Button onClick={openAllRemaining} disabled={!prepared?.some(r => r.waLink && !r.opened)}>
                <ExternalLink className="h-4 w-4 mr-2" />Open all remaining
              </Button>
            </>
          )}
          {showingResults && (
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
