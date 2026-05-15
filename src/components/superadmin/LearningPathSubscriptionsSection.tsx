import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sparkles, CheckCircle2, XCircle, Clock, Loader2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

type Row = {
  id: string;
  learner_id: string;
  school_id: string;
  parent_user_id: string;
  status: 'pending' | 'active' | 'rejected' | 'expired';
  mpesa_code: string | null;
  mpesa_phone: string | null;
  amount: number;
  weeks: number;
  submitted_at: string;
  expires_at: string | null;
  rejection_reason: string | null;
  learner?: { full_name: string; grade: string; admission_number: string };
  school?: { school_name: string };
};

export default function LearningPathSubscriptionsSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'pending' | 'active' | 'rejected' | 'all'>('pending');
  const [rejecting, setRejecting] = useState<Row | null>(null);
  const [reason, setReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ['lp-entitlements', tab],
    queryFn: async () => {
      let q = supabase.from('learning_path_entitlements').select('*').order('submitted_at', { ascending: false });
      if (tab !== 'all') q = q.eq('status', tab);
      const { data } = await q;
      const list = (data || []) as Row[];
      // Hydrate learner & school
      const learnerIds = Array.from(new Set(list.map(r => r.learner_id)));
      const schoolIds = Array.from(new Set(list.map(r => r.school_id)));
      const [{ data: learners }, { data: schools }] = await Promise.all([
        learnerIds.length ? supabase.from('learners').select('id, full_name, grade, admission_number').in('id', learnerIds) : Promise.resolve({ data: [] } as any),
        schoolIds.length ? supabase.from('schools').select('id, school_name').in('id', schoolIds) : Promise.resolve({ data: [] } as any),
      ]);
      const lm = new Map<string, any>((learners || []).map((l: any) => [l.id, l]));
      const sm = new Map<string, any>((schools || []).map((s: any) => [s.id, s]));
      return list.map(r => ({ ...r, learner: lm.get(r.learner_id), school: sm.get(r.school_id) })) as Row[];
    },
  });

  const approve = async (row: Row) => {
    setBusyId(row.id);
    const expires = new Date();
    expires.setDate(expires.getDate() + row.weeks * 7);
    const { error } = await supabase.from('learning_path_entitlements').update({
      status: 'active', activated_at: new Date().toISOString(),
      expires_at: expires.toISOString(), activated_by: user?.id, rejection_reason: null,
    }).eq('id', row.id);
    setBusyId(null);
    if (error) return toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    toast({ title: 'Activated', description: `${row.learner?.full_name || 'Learner'} unlocked for ${row.weeks}w.` });
    qc.invalidateQueries({ queryKey: ['lp-entitlements'] });
    qc.invalidateQueries({ queryKey: ['lp-access'] });
  };

  const reject = async () => {
    if (!rejecting) return;
    setBusyId(rejecting.id);
    const { error } = await supabase.from('learning_path_entitlements').update({
      status: 'rejected', rejection_reason: reason.trim() || 'Payment not verified',
    }).eq('id', rejecting.id);
    setBusyId(null);
    if (error) return toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    toast({ title: 'Rejected' });
    setRejecting(null); setReason('');
    qc.invalidateQueries({ queryKey: ['lp-entitlements'] });
  };

  const revoke = async (row: Row) => {
    setBusyId(row.id);
    const { error } = await supabase.from('learning_path_entitlements').update({
      status: 'expired', expires_at: new Date().toISOString(),
    }).eq('id', row.id);
    setBusyId(null);
    if (error) return toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    toast({ title: 'Revoked' });
    qc.invalidateQueries({ queryKey: ['lp-entitlements'] });
  };

  const StatusBadge = ({ s }: { s: string }) => {
    if (s === 'active') return <Badge className="bg-primary/15 text-primary border-primary/30" variant="outline"><CheckCircle2 className="h-3 w-3 mr-1" />Active</Badge>;
    if (s === 'pending') return <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30" variant="outline"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    if (s === 'rejected') return <Badge className="bg-destructive/15 text-destructive border-destructive/30" variant="outline"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
    return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Expired</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-display font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Learning Path Subscriptions
            </CardTitle>
            <CardDescription className="text-xs">
              Approve M-Pesa payments from parents to unlock the Learning Path per child.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="grid grid-cols-4 w-full mb-3">
            <TabsTrigger value="pending" className="text-xs">Pending</TabsTrigger>
            <TabsTrigger value="active" className="text-xs">Active</TabsTrigger>
            <TabsTrigger value="rejected" className="text-xs">Rejected</TabsTrigger>
            <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
          </TabsList>

          <TabsContent value={tab}>
            {isLoading ? (
              <div className="py-8 text-center"><Loader2 className="h-5 w-5 mx-auto animate-spin text-primary" /></div>
            ) : rows.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No requests in this tab.</div>
            ) : (
              <div className="space-y-2">
                {rows.map(r => (
                  <div key={r.id} className="border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-sm">{r.learner?.full_name || '—'}</span>
                        <span className="text-xs text-muted-foreground">Grade {r.learner?.grade} • {r.learner?.admission_number}</span>
                        <StatusBadge s={r.status} />
                      </div>
                      <div className="text-xs text-muted-foreground">{r.school?.school_name}</div>
                      <div className="text-xs flex flex-wrap gap-x-3 gap-y-0.5">
                        <span>Code: <span className="font-mono font-semibold">{r.mpesa_code}</span></span>
                        <span>Phone: {r.mpesa_phone || '—'}</span>
                        <span>KES {r.amount} • {r.weeks}w</span>
                        <span>Sent: {format(new Date(r.submitted_at), 'dd MMM HH:mm')}</span>
                        {r.expires_at && <span>Expires: {format(new Date(r.expires_at), 'dd MMM yyyy')}</span>}
                      </div>
                      {r.rejection_reason && <div className="text-xs text-destructive">Reason: {r.rejection_reason}</div>}
                    </div>
                    <div className="flex gap-2">
                      {r.status === 'pending' && (
                        <>
                          <Button size="sm" onClick={() => approve(r)} disabled={busyId === r.id}>
                            {busyId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1" />}
                            Activate
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setRejecting(r)}>
                            <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                          </Button>
                        </>
                      )}
                      {r.status === 'active' && (
                        <Button size="sm" variant="outline" onClick={() => revoke(r)} disabled={busyId === r.id}>
                          Revoke
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Reason (shown to parent)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. M-Pesa code not found" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button variant="destructive" onClick={reject} disabled={busyId === rejecting?.id}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
