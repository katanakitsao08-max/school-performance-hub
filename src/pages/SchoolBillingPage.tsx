import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Smartphone, Upload, Receipt, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

type Cycle = 'monthly' | 'term' | 'annual';
const fmt = (n: number) => `KES ${Number(n || 0).toLocaleString()}`;

export default function SchoolBillingPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const schoolId = profile?.school_id;
  const [stkOpen, setStkOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [cycle, setCycle] = useState<Cycle>('monthly');

  const { data: plans = [] } = useQuery({
    queryKey: ['billing-plans'],
    queryFn: async () => {
      const { data } = await supabase
        .from('subscription_plans')
        .select('id, name, tier, description, price_monthly, price_term, price_annual, features, sort_order')
        .eq('is_active', true)
        .order('sort_order');
      return data || [];
    },
  });

  const { data: school } = useQuery({
    queryKey: ['billing-school', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data } = await supabase
        .from('schools')
        .select('id, school_name, school_code, subscription_status, plan_id, plan_expires_at, subscription_grace_until')
        .eq('id', schoolId!).maybeSingle();
      return data;
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['billing-payments', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data } = await supabase.from('billing_payments').select('*').eq('school_id', schoolId!).order('created_at', { ascending: false }).limit(50);
      return data || [];
    },
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['billing-invoices', schoolId],
    enabled: !!schoolId,
    queryFn: async () => {
      const { data } = await supabase.from('billing_invoices').select('*').eq('school_id', schoolId!).order('issued_at', { ascending: false }).limit(50);
      return data || [];
    },
  });

  const plan = plans.find((p) => p.id === selectedPlan);
  const amount = plan ? Number((plan as any)[`price_${cycle}`] || 0) : 0;

  function openStk(p: any) { setSelectedPlan(p.id); setCycle('monthly'); setStkOpen(true); }
  function openManual(p: any) { setSelectedPlan(p.id); setCycle('monthly'); setManualOpen(true); }

  const statusBadge = (s?: string | null) => {
    const map: Record<string, string> = {
      active: 'bg-emerald-100 text-emerald-800',
      trial: 'bg-blue-100 text-blue-800',
      pending_payment: 'bg-amber-100 text-amber-800',
      suspended: 'bg-rose-100 text-rose-800',
      expired: 'bg-rose-100 text-rose-800',
    };
    return <Badge className={map[s || ''] || ''}>{(s || 'unknown').replace('_', ' ')}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Subscription & Billing</h1>
          <p className="text-muted-foreground">Manage your PerformTrack subscription and payments.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between flex-wrap gap-2">
              <span>Current Subscription</span>
              {statusBadge(school?.subscription_status)}
            </CardTitle>
            <CardDescription>{school?.school_name} ({school?.school_code})</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-3 gap-4 text-sm">
              <div><div className="text-muted-foreground">Plan</div><div className="font-medium">{plans.find(p=>p.id===school?.plan_id)?.name || '—'}</div></div>
              <div><div className="text-muted-foreground">Expires</div><div className="font-medium">{school?.plan_expires_at ? new Date(school.plan_expires_at).toLocaleDateString() : '—'}</div></div>
              <div><div className="text-muted-foreground">Grace Until</div><div className="font-medium">{school?.subscription_grace_until ? new Date(school.subscription_grace_until).toLocaleDateString() : '—'}</div></div>
            </div>
          </CardContent>
        </Card>

        <div>
          <h2 className="text-xl font-semibold mb-3">Choose a Plan</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map((p: any) => (
              <Card key={p.id} className={school?.plan_id === p.id ? 'border-primary border-2' : ''}>
                <CardHeader>
                  <CardTitle>{p.name}</CardTitle>
                  <CardDescription>{p.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between"><span>Monthly</span><span className="font-semibold">{fmt(p.price_monthly)}</span></div>
                  <div className="flex justify-between"><span>Term</span><span className="font-semibold">{fmt(p.price_term)}</span></div>
                  <div className="flex justify-between"><span>Annual</span><span className="font-semibold">{fmt(p.price_annual)}</span></div>
                  <div className="pt-3 flex flex-col gap-2">
                    <Button size="sm" className="w-full" onClick={() => openStk(p)}><Smartphone className="w-4 h-4 mr-1"/>Pay with M-Pesa</Button>
                    <Button size="sm" variant="outline" className="w-full" onClick={() => openManual(p)}><Upload className="w-4 h-4 mr-1"/>Manual Payment</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Tabs defaultValue="payments">
          <TabsList>
            <TabsTrigger value="payments">Payment History</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
          </TabsList>
          <TabsContent value="payments">
            <Card><CardContent className="pt-6 overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Date</TableHead><TableHead>Method</TableHead><TableHead>Amount</TableHead>
                  <TableHead>Reference</TableHead><TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {payments.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell>{new Date(p.created_at).toLocaleString()}</TableCell>
                      <TableCell>{p.method.replace('_',' ')}</TableCell>
                      <TableCell>{fmt(p.amount)}</TableCell>
                      <TableCell className="font-mono text-xs">{p.reference || p.mpesa_checkout_request_id?.slice(0,12) || '—'}</TableCell>
                      <TableCell><Badge variant={p.status==='approved'?'default':p.status==='failed'||p.status==='rejected'?'destructive':'secondary'}>{p.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {!payments.length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No payments yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>
          <TabsContent value="invoices">
            <Card><CardContent className="pt-6 overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Invoice #</TableHead><TableHead>Issued</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {invoices.map((i: any) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-mono">{i.invoice_number}</TableCell>
                      <TableCell>{new Date(i.issued_at).toLocaleDateString()}</TableCell>
                      <TableCell>{fmt(i.amount)}</TableCell>
                      <TableCell><Badge>{i.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {!invoices.length && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No invoices yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>

      <StkDialog open={stkOpen} onOpenChange={setStkOpen} plan={plan} cycle={cycle} setCycle={setCycle} amount={amount} onDone={() => { qc.invalidateQueries(); }} />
      <ManualDialog open={manualOpen} onOpenChange={setManualOpen} plan={plan} cycle={cycle} setCycle={setCycle} amount={amount} schoolId={schoolId} onDone={() => qc.invalidateQueries()} />
    </DashboardLayout>
  );
}

function StkDialog({ open, onOpenChange, plan, cycle, setCycle, amount, onDone }: any) {
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<'idle'|'sending'|'waiting'|'success'|'failed'>('idle');
  const [message, setMessage] = useState('');

  async function send() {
    if (!plan || !phone) return;
    setStatus('sending'); setMessage('');
    try {
      const { data, error } = await supabase.functions.invoke('billing-stk-initiate', {
        body: { plan_id: plan.id, billing_cycle: cycle, amount, phone },
      });
      if (error) throw error;
      setStatus('waiting');
      // poll
      const checkoutId = data.checkout_request_id;
      let tries = 0;
      const iv = setInterval(async () => {
        tries++;
        try {
          const session = (await supabase.auth.getSession()).data.session;
          const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/billing-stk-status?checkout_request_id=${encodeURIComponent(checkoutId)}`, {
            headers: { Authorization: `Bearer ${session?.access_token}` },
          });
          const j = await res.json();
          if (j.status === 'approved') { clearInterval(iv); setStatus('success'); toast.success('Payment confirmed!'); onDone?.(); }
          else if (j.status === 'failed' || j.status === 'rejected') { clearInterval(iv); setStatus('failed'); setMessage(j.mpesa_result_desc || 'Payment failed'); }
        } catch {}
        if (tries > 30) { clearInterval(iv); setStatus((s) => s === 'success' ? s : 'failed'); setMessage('Timed out. If you paid, it will reflect shortly.'); }
      }, 3000);
    } catch (e: any) {
      setStatus('failed'); setMessage(e.message || 'Failed to initiate');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>M-Pesa STK Push</DialogTitle>
          <DialogDescription>{plan?.name} — {fmt(amount)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Billing cycle</Label>
            <Select value={cycle} onValueChange={(v) => setCycle(v as Cycle)}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="term">Term</SelectItem>
                <SelectItem value="annual">Annual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Phone (Safaricom)</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XXXXXXXX" disabled={status==='waiting'} />
          </div>
          {status === 'waiting' && <div className="flex items-center gap-2 text-sm text-amber-700"><Loader2 className="w-4 h-4 animate-spin"/>Check your phone and enter your M-Pesa PIN…</div>}
          {status === 'success' && <div className="flex items-center gap-2 text-emerald-700 text-sm"><CheckCircle2 className="w-4 h-4"/>Payment confirmed.</div>}
          {status === 'failed' && <div className="flex items-center gap-2 text-rose-700 text-sm"><XCircle className="w-4 h-4"/>{message}</div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={send} disabled={!phone || status==='sending' || status==='waiting'}>
            {status==='sending' ? 'Sending…' : status==='waiting' ? 'Waiting…' : 'Send STK Push'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManualDialog({ open, onOpenChange, plan, cycle, setCycle, amount, schoolId, onDone }: any) {
  const [method, setMethod] = useState('bank');
  const [reference, setReference] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0,10));
  const [notes, setNotes] = useState('');
  const [proof, setProof] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!plan || !reference) return;
    setBusy(true);
    try {
      let proof_url: string | null = null;
      if (proof && schoolId) {
        const key = `${schoolId}/${Date.now()}-${proof.name}`;
        const { error: upErr } = await supabase.storage.from('billing-proofs').upload(key, proof);
        if (upErr) throw upErr;
        proof_url = key;
      }
      const { error } = await supabase.functions.invoke('billing-manual-submit', {
        body: { plan_id: plan.id, billing_cycle: cycle, amount, method, reference, payment_date: paymentDate, notes, proof_url },
      });
      if (error) throw error;
      toast.success('Payment submitted. Awaiting verification.');
      onOpenChange(false); onDone?.();
    } catch (e: any) { toast.error(e.message || 'Failed'); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manual Payment</DialogTitle>
          <DialogDescription>{plan?.name} — {fmt(amount)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cycle</Label>
              <Select value={cycle} onValueChange={(v) => setCycle(v as Cycle)}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="term">Term</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">Bank Deposit</SelectItem>
                  <SelectItem value="eft">EFT</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="mobile_money">Mobile Money</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Reference Number</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} required /></div>
          <div><Label>Payment Date</Label><Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} /></div>
          <div><Label>Proof (optional)</Label><Input type="file" accept="image/*,application/pdf" onChange={(e) => setProof(e.target.files?.[0] || null)} /></div>
          <div><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !reference}>{busy ? 'Submitting…' : 'Submit for Approval'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
