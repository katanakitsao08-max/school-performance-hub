import { useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Wallet, Building2, AlertCircle, CheckCircle2, Smartphone, FileText, Download, Eye } from 'lucide-react';

const fmt = (n: number) => `KES ${Number(n || 0).toLocaleString()}`;

export default function SuperAdminBillingPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [reviewing, setReviewing] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const { data: payments = [] } = useQuery({
    queryKey: ['admin-billing-payments'],
    queryFn: async () => {
      const { data } = await supabase.from('billing_payments').select('*, schools(school_name, school_code)').order('created_at', { ascending: false }).limit(500);
      return data || [];
    },
  });
  const { data: subs = [] } = useQuery({
    queryKey: ['admin-billing-subs'],
    queryFn: async () => {
      const { data } = await supabase.from('school_subscriptions').select('*, schools(school_name, school_code), subscription_plans(name)').order('end_date', { ascending: false }).limit(500);
      return data || [];
    },
  });
  const { data: schools = [] } = useQuery({
    queryKey: ['admin-billing-schools'],
    queryFn: async () => {
      const { data } = await supabase.from('schools').select('id, school_name, school_code, subscription_status, plan_expires_at, subscription_grace_until').order('school_name');
      return data || [];
    },
  });

  const metrics = useMemo(() => {
    const approved = payments.filter((p: any) => p.status === 'approved');
    const totalRev = approved.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    const mpesa = approved.filter((p: any) => p.method === 'mpesa_stk').reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    const manual = totalRev - mpesa;
    const pending = payments.filter((p: any) => p.status === 'submitted').length;
    const active = schools.filter((s: any) => s.subscription_status === 'active').length;
    const expired = schools.filter((s: any) => s.subscription_status === 'expired').length;
    const month = new Date(); month.setDate(1);
    const monthly = approved.filter((p: any) => new Date(p.created_at) >= month).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    return { totalRev, mpesa, manual, pending, active, expired, monthly };
  }, [payments, schools]);

  async function approve(id: string) {
    const { error } = await supabase.functions.invoke('billing-manual-decide', { body: { payment_id: id, action: 'approve' } });
    if (error) return toast.error(error.message);
    toast.success('Approved & activated'); setReviewing(null); qc.invalidateQueries();
  }
  async function reject(id: string) {
    const { error } = await supabase.functions.invoke('billing-manual-decide', { body: { payment_id: id, action: 'reject', reason: rejectReason } });
    if (error) return toast.error(error.message);
    toast.success('Rejected'); setReviewing(null); setRejectReason(''); qc.invalidateQueries();
  }
  async function viewProof(url: string | null) {
    if (!url) return;
    const { data } = await supabase.storage.from('billing-proofs').createSignedUrl(url, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  }
  function exportCsv(rows: any[], name: string) {
    if (!rows.length) return;
    const keys = Object.keys(rows[0]).filter(k => typeof rows[0][k] !== 'object');
    const csv = [keys.join(','), ...rows.map(r => keys.map(k => JSON.stringify(r[k] ?? '')).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${name}.csv`; a.click();
  }

  const pendingList = payments.filter((p: any) => p.status === 'submitted');
  const filteredSubs = subs.filter((s: any) => !search || (s.schools?.school_name || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Billing & Collections</h1>
            <p className="text-muted-foreground">Super Admin control panel</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard icon={<Wallet/>} label="Total Revenue" value={fmt(metrics.totalRev)} />
          <MetricCard icon={<Building2/>} label="Active Schools" value={metrics.active.toString()} />
          <MetricCard icon={<AlertCircle/>} label="Pending Approvals" value={metrics.pending.toString()} highlight={metrics.pending > 0} />
          <MetricCard icon={<AlertCircle/>} label="Expired" value={metrics.expired.toString()} />
          <MetricCard icon={<Smartphone/>} label="M-Pesa Collections" value={fmt(metrics.mpesa)} />
          <MetricCard icon={<FileText/>} label="Manual Collections" value={fmt(metrics.manual)} />
          <MetricCard icon={<CheckCircle2/>} label="This Month" value={fmt(metrics.monthly)} />
        </div>

        <Tabs defaultValue="approvals">
          <TabsList>
            <TabsTrigger value="approvals">Pending Approvals {pendingList.length > 0 && <Badge className="ml-2">{pendingList.length}</Badge>}</TabsTrigger>
            <TabsTrigger value="subs">Subscriptions</TabsTrigger>
            <TabsTrigger value="payments">All Payments</TabsTrigger>
          </TabsList>

          <TabsContent value="approvals">
            <Card><CardContent className="pt-6 overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>School</TableHead><TableHead>Method</TableHead><TableHead>Amount</TableHead>
                  <TableHead>Reference</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Action</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {pendingList.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.schools?.school_name}</TableCell>
                      <TableCell>{p.method}</TableCell>
                      <TableCell>{fmt(p.amount)}</TableCell>
                      <TableCell className="font-mono text-xs">{p.reference}</TableCell>
                      <TableCell>{new Date(p.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => setReviewing(p)}>Review</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!pendingList.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No pending payments</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="subs">
            <Card><CardContent className="pt-6 space-y-3">
              <div className="flex justify-between gap-2 flex-wrap">
                <Input placeholder="Search school…" value={search} onChange={(e)=>setSearch(e.target.value)} className="max-w-xs"/>
                <Button variant="outline" size="sm" onClick={() => exportCsv(filteredSubs, 'subscriptions')}><Download className="w-4 h-4 mr-1"/>Export CSV</Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>School</TableHead><TableHead>Plan</TableHead><TableHead>Cycle</TableHead>
                    <TableHead>Amount</TableHead><TableHead>End Date</TableHead><TableHead>Status</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {filteredSubs.map((s: any) => (
                      <TableRow key={s.id}>
                        <TableCell>{s.schools?.school_name}</TableCell>
                        <TableCell>{s.subscription_plans?.name || '—'}</TableCell>
                        <TableCell>{s.billing_cycle}</TableCell>
                        <TableCell>{fmt(s.amount)}</TableCell>
                        <TableCell>{new Date(s.end_date).toLocaleDateString()}</TableCell>
                        <TableCell><Badge>{s.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="payments">
            <Card><CardContent className="pt-6 space-y-3">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => exportCsv(payments, 'payments')}><Download className="w-4 h-4 mr-1"/>Export CSV</Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Date</TableHead><TableHead>School</TableHead><TableHead>Method</TableHead>
                    <TableHead>Amount</TableHead><TableHead>Reference</TableHead><TableHead>Status</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {payments.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell>{new Date(p.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>{p.schools?.school_name}</TableCell>
                        <TableCell>{p.method}</TableCell>
                        <TableCell>{fmt(p.amount)}</TableCell>
                        <TableCell className="font-mono text-xs">{p.reference || '—'}</TableCell>
                        <TableCell><Badge variant={p.status==='approved'?'default':p.status==='failed'||p.status==='rejected'?'destructive':'secondary'}>{p.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Manual Payment</DialogTitle>
            <DialogDescription>{reviewing?.schools?.school_name}</DialogDescription>
          </DialogHeader>
          {reviewing && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><div className="text-muted-foreground">Method</div><div className="font-medium">{reviewing.method}</div></div>
                <div><div className="text-muted-foreground">Amount</div><div className="font-medium">{fmt(reviewing.amount)}</div></div>
                <div><div className="text-muted-foreground">Reference</div><div className="font-mono">{reviewing.reference}</div></div>
                <div><div className="text-muted-foreground">Payment Date</div><div>{reviewing.payment_date}</div></div>
                <div><div className="text-muted-foreground">Cycle</div><div>{reviewing.billing_cycle}</div></div>
              </div>
              {reviewing.notes && <div><div className="text-muted-foreground">Notes</div><div>{reviewing.notes}</div></div>}
              {reviewing.proof_url && <Button size="sm" variant="outline" onClick={() => viewProof(reviewing.proof_url)}><Eye className="w-4 h-4 mr-1"/>View Proof</Button>}
              <div>
                <label className="text-muted-foreground">Reject reason (if rejecting)</label>
                <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={2}/>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="destructive" onClick={() => reviewing && reject(reviewing.id)}>Reject</Button>
            <Button onClick={() => reviewing && approve(reviewing.id)}>Approve & Activate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function MetricCard({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? 'border-amber-500' : ''}>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">{icon}{label}</div>
        <div className="text-xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
