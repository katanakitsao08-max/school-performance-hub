import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, MessageCircle, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

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
}

export function WhatsAppSendDialog({
  open, onOpenChange, recipients, term, year, assessmentType, schoolName, title,
}: Props) {
  const { schoolId } = useAuth();
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<ResultRow[] | null>(null);

  const valid = useMemo(() => recipients.filter(r => r.recipient && r.recipient.trim().length >= 9), [recipients]);
  const missing = recipients.length - valid.length;

  const handleSend = async () => {
    if (!valid.length) { toast.error('No valid phone numbers to send to'); return; }
    setSending(true);
    setResults(null);
    try {
      const { data, error } = await supabase.functions.invoke('send-report-whatsapp', {
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
        },
      });
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

  const lookupName = (id: string) => recipients.find(r => r.learner_id === id)?.full_name || id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            {title || 'Send Reports via WhatsApp'}
          </DialogTitle>
          <DialogDescription>
            Parents will receive a secure 48-hour link. Sending falls back to SMS if WhatsApp delivery is unavailable.
          </DialogDescription>
        </DialogHeader>

        {!results ? (
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
            <ScrollArea className="h-48 rounded-md border">
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
        ) : (
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

        <DialogFooter>
          {!results ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>Cancel</Button>
              <Button onClick={handleSend} disabled={sending || !valid.length}>
                {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Send to {valid.length} parent{valid.length === 1 ? '' : 's'}
              </Button>
            </>
          ) : (
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
