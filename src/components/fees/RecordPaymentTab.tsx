import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Search, Receipt as ReceiptIcon, MessageCircle, Phone } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { allocateFIFO, allocateManual, type OutstandingCharge } from '@/lib/fee-allocation';
import { logFeeAudit } from '@/lib/fee-audit';
import { buildWaMeLink, normalizeWhatsAppPhone } from '@/lib/wa-link';

interface Props {
  schoolId: string;
  userId: string;
  schoolName: string;
  preselectLearnerId?: string | null;
  onAfterPayment?: (record: any) => void; // for printing receipt
}

const METHODS = ['cash', 'mpesa', 'bank', 'cheque'];
const fmt = (n: number) => `KES ${Number(n || 0).toLocaleString()}`;

export default function RecordPaymentTab({ schoolId, userId, schoolName, preselectLearnerId, onAfterPayment }: Props) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [learnerId, setLearnerId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [reference, setReference] = useState('');
  const [payerPhone, setPayerPhone] = useState('');
  const [autoAllocate, setAutoAllocate] = useState(true);
  const [manual, setManual] = useState<Record<string, string>>({});
  const [sendSms, setSendSms] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (preselectLearnerId) setLearnerId(preselectLearnerId); }, [preselectLearnerId]);

  const { data: matches = [] } = useQuery({
    queryKey: ['rp-search', schoolId, search],
    queryFn: async () => {
      if (!search.trim()) return [];
      const s = search.trim().replace(/'/g, "''");
      const { data } = await supabase.from('learners')
        .select('id, full_name, admission_number, grade, stream, parent_name, parent_phone')
        .eq('school_id', schoolId).eq('is_active', true)
        .or(`full_name.ilike.%${s}%,admission_number.ilike.%${s}%,parent_phone.ilike.%${s}%,parent_name.ilike.%${s}%`)
        .order('full_name').limit(15);
      return data || [];
    },
    enabled: !!schoolId && search.trim().length > 1,
  });

  const { data: learner } = useQuery({
    queryKey: ['rp-learner', learnerId],
    queryFn: async () => {
      if (!learnerId) return null;
      const { data } = await supabase.from('learners')
        .select('id, full_name, admission_number, grade, stream, parent_name, parent_phone, parent_phone_2')
        .eq('id', learnerId).maybeSingle();
      return data;
    },
    enabled: !!learnerId,
  });

  const { data: charges = [] } = useQuery({
    queryKey: ['rp-charges', learnerId],
    queryFn: async () => {
      if (!learnerId) return [];
      const { data } = await supabase.from('fee_records')
        .select('id, fee_type, amount_charged, amount_paid, created_at, term, year, description')
        .eq('learner_id', learnerId).is('voided_at', null)
        .order('created_at', { ascending: true });
      return data || [];
    },
    enabled: !!learnerId,
  });

  const outstandingCharges: OutstandingCharge[] = useMemo(() => (charges as any[])
    .filter(c => Number(c.amount_charged) - Number(c.amount_paid) > 0),
    [charges]);

  const totals = useMemo(() => {
    const charged = (charges as any[]).reduce((s, c) => s + Number(c.amount_charged), 0);
    const paid = (charges as any[]).reduce((s, c) => s + Number(c.amount_paid), 0);
    return { charged, paid, balance: charged - paid };
  }, [charges]);

  const plan = useMemo(() => {
    const amt = Number(amount) || 0;
    if (amt <= 0) return { entries: [], remaining: amt };
    if (autoAllocate) return allocateFIFO(outstandingCharges, amt);
    const m: Record<string, number> = {};
    Object.entries(manual).forEach(([k, v]) => { m[k] = Number(v) || 0; });
    return allocateManual(outstandingCharges, m);
  }, [amount, autoAllocate, manual, outstandingCharges]);

  const manualTotal = useMemo(() => Object.values(manual).reduce((s, v) => s + (Number(v) || 0), 0), [manual]);

  const submit = async () => {
    if (!learnerId || !learner) { toast({ title: 'Pick a learner first' }); return; }
    const amt = Number(amount) || 0;
    if (amt <= 0) { toast({ title: 'Enter an amount' }); return; }
    if (!autoAllocate && Math.abs(manualTotal - amt) > 0.01) {
      toast({ title: 'Manual allocation must equal payment amount', description: `${fmt(manualTotal)} ≠ ${fmt(amt)}`, variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      // Receipt number via RPC
      const { data: rn } = await supabase.rpc('generate_receipt_number', { _school_id: schoolId });
      const receiptNumber = rn as string;

      // 1) Update each charge's amount_paid
      for (const entry of plan.entries) {
        const charge = (charges as any[]).find(c => c.id === entry.charge_id);
        if (!charge) continue;
        const { error } = await supabase.from('fee_records').update({
          amount_paid: entry.new_amount_paid,
          payment_method: method,
          mpesa_reference: method === 'mpesa' ? reference : null,
          payment_date: new Date().toISOString().split('T')[0],
        }).eq('id', entry.charge_id);
        if (error) throw error;
      }

      // 2) Insert a single "payment" ledger row tied to first allocation (or standalone if remaining)
      const today = new Date().toISOString().split('T')[0];
      const paymentRow: any = {
        learner_id: learnerId,
        school_id: schoolId,
        term: (charges as any[])[0]?.term || 1,
        year: (charges as any[])[0]?.year || new Date().getFullYear(),
        fee_type: plan.entries[0]?.fee_type || 'other',
        amount_charged: 0,
        amount_paid: amt,
        payment_date: today,
        payment_method: method,
        mpesa_reference: method === 'mpesa' ? reference : null,
        description: plan.entries.length > 1 ? `Allocated across ${plan.entries.length} items` : (plan.remaining > 0 ? `Advance/Credit: ${fmt(plan.remaining)}` : null),
        receipt_number: receiptNumber,
        recorded_by: userId,
        transaction_type: 'payment',
        allocation_mode: autoAllocate ? 'auto' : 'manual',
        payer_phone: payerPhone || null,
      };
      const { data: inserted, error: insErr } = await supabase.from('fee_records').insert(paymentRow)
        .select('*, learners!fee_records_learner_id_fkey(full_name, admission_number, grade, stream)').single();
      if (insErr) throw insErr;

      await logFeeAudit({
        schoolId, action: 'payment_recorded', entityType: 'fee_records', entityId: inserted.id,
        after: { amount: amt, method, allocation: plan.entries, remaining: plan.remaining },
      });

      const newBalance = totals.balance - amt;
      const fullyCleared = newBalance <= 0;

      // 3) SMS notifications
      if (sendSms && learner.parent_phone && normalizeWhatsAppPhone(learner.parent_phone)) {
        const baseMsg = fullyCleared
          ? `Dear Parent,\n\nThank you. ${learner.full_name}'s school fees have been fully cleared.\n\nCurrent Balance: KES 0.\n\nWe appreciate your cooperation.\n\n${schoolName} | PerformTrack.co.ke`
          : `Dear Parent,\n\nWe have received your payment of ${fmt(amt)} for ${learner.full_name}.\n\nReceipt No: ${receiptNumber}\n\nOutstanding Balance: ${fmt(Math.max(0, newBalance))}\n\nThank you.\n\n${schoolName} | PerformTrack.co.ke`;
        try {
          await supabase.functions.invoke('send-sms-v2', {
            body: { school_id: schoolId, recipients: [{ phone: learner.parent_phone, learner_id: learnerId }], message: baseMsg, source: 'fee_payment' },
          });
          await logFeeAudit({ schoolId, action: 'sms_sent', entityType: 'payment_confirmation', entityId: inserted.id });
        } catch {
          // Fallback to WhatsApp link
          const url = buildWaMeLink(learner.parent_phone, baseMsg);
          if (url) window.open(url, '_blank');
        }
      }

      toast({ title: 'Payment recorded', description: `Receipt ${receiptNumber} · ${fmt(amt)}` });
      qc.invalidateQueries({ queryKey: ['rp-charges'] });
      qc.invalidateQueries({ queryKey: ['fee-records'] });
      qc.invalidateQueries({ queryKey: ['accounts-records'] });
      onAfterPayment?.(inserted);

      // Reset
      setAmount(''); setReference(''); setManual({}); setPayerPhone('');
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-3">
      {/* LEFT: search + selected learner */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">1. Find Learner</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name, admission # or parent phone" value={search} onChange={e => setSearch(e.target.value)} className="pl-7 h-9 text-xs" />
          </div>
          {search.length > 1 && matches.length > 0 && !learnerId && (
            <div className="max-h-48 overflow-y-auto border rounded-md">
              {(matches as any[]).map(m => (
                <button key={m.id} type="button" className="w-full text-left p-2 hover:bg-muted/50 text-xs border-b last:border-0" onClick={() => { setLearnerId(m.id); setSearch(''); }}>
                  <b>{m.full_name}</b> <span className="text-muted-foreground">· {m.admission_number} · G{m.grade}{m.stream}</span>
                </button>
              ))}
            </div>
          )}
          {learner && (
            <div className="rounded-md border p-3 bg-muted/30 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <b className="text-sm">{learner.full_name}</b>
                <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => { setLearnerId(null); setAmount(''); setManual({}); }}>Change</Button>
              </div>
              <div className="text-muted-foreground">{learner.admission_number} · Grade {learner.grade} {learner.stream}</div>
              <div>Parent: <b>{learner.parent_name || '—'}</b></div>
              {learner.parent_phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" /> {learner.parent_phone}</div>}
              <div className="grid grid-cols-3 gap-1 mt-2 text-center">
                <div className="rounded bg-background p-2"><div className="text-[10px] text-muted-foreground">Charged</div><b>{fmt(totals.charged)}</b></div>
                <div className="rounded bg-background p-2"><div className="text-[10px] text-muted-foreground">Paid</div><b className="text-success">{fmt(totals.paid)}</b></div>
                <div className="rounded bg-background p-2"><div className="text-[10px] text-muted-foreground">Balance</div><b className={totals.balance > 0 ? 'text-destructive' : 'text-success'}>{fmt(totals.balance)}</b></div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* RIGHT: payment form + allocation preview */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">2. Payment Details</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Amount (KES)</Label><Input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} className="h-9 text-xs" disabled={!learnerId} /></div>
            <div><Label className="text-xs">Method</Label>
              <Select value={method} onValueChange={setMethod} disabled={!learnerId}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{METHODS.map(m => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          {(method === 'mpesa' || method === 'bank' || method === 'cheque') && (
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">{method === 'mpesa' ? 'M-Pesa Code' : 'Reference'}</Label><Input maxLength={50} value={reference} onChange={e => setReference(e.target.value)} className="h-9 text-xs" /></div>
              {method === 'mpesa' && <div><Label className="text-xs">Payer Phone (optional)</Label><Input maxLength={15} value={payerPhone} onChange={e => setPayerPhone(e.target.value)} className="h-9 text-xs" placeholder="2547..." /></div>}
            </div>
          )}
          <div className="flex items-center justify-between rounded-md border p-2">
            <div>
              <Label className="text-xs font-bold">Auto-Allocate (FIFO)</Label>
              <p className="text-[10px] text-muted-foreground">{autoAllocate ? 'Oldest charges cleared first' : 'Set amount per item below'}</p>
            </div>
            <Switch checked={autoAllocate} onCheckedChange={setAutoAllocate} disabled={!learnerId} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-2">
            <div>
              <Label className="text-xs font-bold">Send SMS confirmation</Label>
              <p className="text-[10px] text-muted-foreground">To parent's primary phone</p>
            </div>
            <Switch checked={sendSms} onCheckedChange={setSendSms} disabled={!learnerId} />
          </div>

          <Button onClick={submit} disabled={!learnerId || !amount || saving} className="w-full mt-2"><ReceiptIcon className="h-4 w-4 mr-1" />{saving ? 'Saving...' : 'Record Payment & Generate Receipt'}</Button>
        </CardContent>
      </Card>

      {/* Allocation preview spans both cols */}
      {learnerId && (
        <Card className="md:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm">3. Allocation Preview</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="text-xs">Fee Item</TableHead><TableHead className="text-xs">Term</TableHead>
                <TableHead className="text-xs text-right">Balance</TableHead>
                <TableHead className="text-xs text-right">{autoAllocate ? 'Auto Allocation' : 'Manual'}</TableHead>
                <TableHead className="text-xs text-right">After</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {outstandingCharges.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-xs py-4 text-muted-foreground">No outstanding charges {Number(amount) > 0 && '— payment will be saved as credit/advance'}</TableCell></TableRow>
                ) : outstandingCharges.map((c: any) => {
                  const bal = Number(c.amount_charged) - Number(c.amount_paid);
                  const planEntry = plan.entries.find(e => e.charge_id === c.id);
                  const alloc = planEntry?.amount || 0;
                  const after = bal - alloc;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="text-xs capitalize">{c.fee_type}{c.description && <span className="text-muted-foreground"> — {c.description}</span>}</TableCell>
                      <TableCell className="text-xs">T{c.term}/{c.year}</TableCell>
                      <TableCell className="text-xs text-right">{bal.toLocaleString()}</TableCell>
                      <TableCell className="text-xs text-right">
                        {autoAllocate ? (
                          <span className={cn(alloc > 0 && 'font-bold text-success')}>{alloc.toLocaleString()}</span>
                        ) : (
                          <Input type="number" min="0" max={bal} value={manual[c.id] || ''} onChange={e => setManual(m => ({ ...m, [c.id]: e.target.value }))} className="h-7 text-xs w-24 ml-auto" />
                        )}
                      </TableCell>
                      <TableCell className={cn('text-xs text-right font-bold', after > 0 ? 'text-destructive' : 'text-success')}>{after.toLocaleString()}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {plan.remaining > 0 && (
              <div className="p-2 bg-warning/10 border-t border-warning/30 text-xs">
                <Badge variant="outline" className="border-warning/40 text-warning mr-2">Advance</Badge>
                {fmt(plan.remaining)} will be saved as a credit/overpayment.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
