import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, FileDown, MessageCircle, Wallet, Phone, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildWaMeLink, normalizeWhatsAppPhone } from '@/lib/wa-link';
import { toast } from '@/hooks/use-toast';

interface Props {
  schoolId: string;
  selectedGrade: string;
  schoolName: string;
  onRecordPayment: (learnerId: string) => void;
  onStatement: (learner: any) => void;
}

const fmt = (n: number) => `KES ${Number(n || 0).toLocaleString()}`;

export default function LearnerAccountsTab({ schoolId, selectedGrade, schoolName, onRecordPayment, onStatement }: Props) {
  const [search, setSearch] = useState('');
  const [openLearner, setOpenLearner] = useState<any>(null);

  // Pull all active learners + all live fee records for the school in parallel.
  const { data: learners = [] } = useQuery({
    queryKey: ['accounts-learners', schoolId, selectedGrade],
    queryFn: async () => {
      let q = supabase.from('learners')
        .select('id, full_name, admission_number, grade, stream, parent_name, parent_phone, parent_phone_2')
        .eq('school_id', schoolId).eq('is_active', true);
      if (selectedGrade !== 'all') q = q.eq('grade', selectedGrade);
      const { data } = await q.order('full_name');
      return data || [];
    },
    enabled: !!schoolId,
  });

  const { data: allRecords = [] } = useQuery({
    queryKey: ['accounts-records', schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('fee_records')
        .select('*').eq('school_id', schoolId).is('voided_at', null)
        .order('created_at', { ascending: true });
      return data || [];
    },
    enabled: !!schoolId,
  });

  const accounts = useMemo(() => {
    const byLearner = new Map<string, any[]>();
    (allRecords as any[]).forEach(r => {
      const arr = byLearner.get(r.learner_id) || [];
      arr.push(r);
      byLearner.set(r.learner_id, arr);
    });
    return (learners as any[]).map(l => {
      const rows = byLearner.get(l.id) || [];
      const chargeRows = rows.filter(isCharge);
      const charged = chargeRows.reduce((s, r) => s + Number(r.amount_charged), 0);
      const paid = chargeRows.reduce((s, r) => s + Number(r.amount_paid), 0);
      const balance = charged - paid;
      const status = charged === 0 ? 'No charges' : balance <= 0 ? 'Fully Paid' : paid > 0 ? 'Partially Paid' : 'Unpaid';
      return { learner: l, rows, charged, paid, balance, status };
    });
  }, [learners, allRecords]);

  const filtered = useMemo(() => {
    if (!search.trim()) return accounts;
    const s = search.toLowerCase();
    return accounts.filter(a =>
      a.learner.full_name?.toLowerCase().includes(s)
      || a.learner.admission_number?.toLowerCase().includes(s)
      || a.learner.parent_name?.toLowerCase().includes(s)
      || a.learner.parent_phone?.includes(s),
    );
  }, [accounts, search]);

  const statusBadge = (s: string) => {
    if (s === 'Fully Paid') return <Badge className="text-[10px] bg-success/15 text-success border-success/30">Fully Paid</Badge>;
    if (s === 'Partially Paid') return <Badge className="text-[10px] bg-warning/15 text-warning border-warning/30">Partial</Badge>;
    if (s === 'Unpaid') return <Badge className="text-[10px] bg-destructive/15 text-destructive border-destructive/30">Unpaid</Badge>;
    return <Badge variant="outline" className="text-[10px]">{s}</Badge>;
  };

  const sendReminder = (a: any) => {
    const phone = a.learner.parent_phone;
    if (!phone || !normalizeWhatsAppPhone(phone)) {
      toast({ title: 'No valid phone', variant: 'destructive' });
      return;
    }
    const msg = `Dear ${a.learner.parent_name || 'Parent'},\n\nThis is a reminder that ${a.learner.full_name} has an outstanding fee balance of ${fmt(a.balance)}.\n\nKindly clear it at your earliest convenience.\n\nThank you.\n\n${schoolName} | PerformTrack.co.ke`;
    const url = buildWaMeLink(phone, msg);
    if (url) window.open(url, '_blank');
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name, admission #, parent name or phone..." value={search} onChange={e => setSearch(e.target.value)} className="pl-7 h-9 text-xs" />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="text-xs">Learner</TableHead>
              <TableHead className="text-xs">Parent Contact</TableHead>
              <TableHead className="text-xs text-right">Charged</TableHead>
              <TableHead className="text-xs text-right">Paid</TableHead>
              <TableHead className="text-xs text-right">Balance</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs w-[140px]">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-sm text-muted-foreground">No learner accounts found</TableCell></TableRow>
              ) : filtered.map(a => (
                <TableRow key={a.learner.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setOpenLearner(a)}>
                  <TableCell className="text-xs font-medium">
                    {a.learner.full_name}
                    <br /><span className="text-muted-foreground">{a.learner.admission_number} · G{a.learner.grade}{a.learner.stream}</span>
                  </TableCell>
                  <TableCell className="text-xs">
                    {a.learner.parent_name || '-'}
                    <br /><span className="text-muted-foreground">{a.learner.parent_phone || 'No phone'}</span>
                  </TableCell>
                  <TableCell className="text-xs text-right">{a.charged.toLocaleString()}</TableCell>
                  <TableCell className="text-xs text-right text-success">{a.paid.toLocaleString()}</TableCell>
                  <TableCell className={cn('text-xs text-right font-bold', a.balance > 0 ? 'text-destructive' : 'text-success')}>{a.balance.toLocaleString()}</TableCell>
                  <TableCell>{statusBadge(a.status)}</TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-7 text-[10px] px-2" onClick={() => onRecordPayment(a.learner.id)}>Pay</Button>
                      {a.balance > 0 && (
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => sendReminder(a)} title="WhatsApp reminder"><MessageCircle className="h-3.5 w-3.5 text-success" /></Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Sheet open={!!openLearner} onOpenChange={(o) => !o && setOpenLearner(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          {openLearner && (
            <>
              <SheetHeader><SheetTitle className="font-display">{openLearner.learner.full_name}</SheetTitle></SheetHeader>
              <div className="mt-4 space-y-4">
                {/* Identity card */}
                <Card><CardContent className="p-3 grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Adm #:</span> <b>{openLearner.learner.admission_number}</b></div>
                  <div><span className="text-muted-foreground">Class:</span> <b>Grade {openLearner.learner.grade} {openLearner.learner.stream}</b></div>
                  <div><span className="text-muted-foreground">Parent:</span> <b>{openLearner.learner.parent_name || '—'}</b></div>
                  <div className="flex items-center gap-1"><Phone className="h-3 w-3 text-muted-foreground" /> <b>{openLearner.learner.parent_phone || '—'}</b></div>
                  {openLearner.learner.parent_phone_2 && (
                    <div className="flex items-center gap-1"><Phone className="h-3 w-3 text-muted-foreground" /> {openLearner.learner.parent_phone_2}</div>
                  )}
                </CardContent></Card>

                {/* Summary */}
                <div className="grid grid-cols-3 gap-2">
                  <Card><CardContent className="p-3 text-center"><p className="text-base font-bold">{fmt(openLearner.charged)}</p><p className="text-[10px] text-muted-foreground">Total Charged</p></CardContent></Card>
                  <Card><CardContent className="p-3 text-center"><p className="text-base font-bold text-success">{fmt(openLearner.paid)}</p><p className="text-[10px] text-muted-foreground">Total Paid</p></CardContent></Card>
                  <Card><CardContent className="p-3 text-center"><p className={cn('text-base font-bold', openLearner.balance > 0 ? 'text-destructive' : 'text-success')}>{fmt(openLearner.balance)}</p><p className="text-[10px] text-muted-foreground">Balance</p></CardContent></Card>
                </div>

                {/* Per-fee-item breakdown */}
                <div>
                  <h4 className="text-xs font-bold mb-1 flex items-center gap-1"><Wallet className="h-3 w-3 text-primary" /> FEE ITEMS</h4>
                  <Card><Table><TableHeader><TableRow>
                    <TableHead className="text-xs">Item</TableHead><TableHead className="text-xs">Term</TableHead>
                    <TableHead className="text-xs text-right">Charged</TableHead><TableHead className="text-xs text-right">Paid</TableHead><TableHead className="text-xs text-right">Balance</TableHead>
                  </TableRow></TableHeader><TableBody>
                    {openLearner.rows.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-xs py-4 text-muted-foreground">No fee items yet</TableCell></TableRow>
                    ) : openLearner.rows.map((r: any) => {
                      const bal = Number(r.amount_charged) - Number(r.amount_paid);
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs capitalize">{r.fee_type}{r.description && <span className="text-muted-foreground"> — {r.description}</span>}</TableCell>
                          <TableCell className="text-xs">T{r.term}/{r.year}</TableCell>
                          <TableCell className="text-xs text-right">{Number(r.amount_charged).toLocaleString()}</TableCell>
                          <TableCell className="text-xs text-right text-success">{Number(r.amount_paid).toLocaleString()}</TableCell>
                          <TableCell className={cn('text-xs text-right font-bold', bal > 0 ? 'text-destructive' : 'text-success')}>{bal.toLocaleString()}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody></Table></Card>
                </div>

                {/* Ledger */}
                <div>
                  <h4 className="text-xs font-bold mb-1">LEDGER (Date · Description · Debit · Credit · Running Balance)</h4>
                  <Card><Table><TableHeader><TableRow>
                    <TableHead className="text-xs">Date</TableHead><TableHead className="text-xs">Description</TableHead>
                    <TableHead className="text-xs text-right">Debit</TableHead><TableHead className="text-xs text-right">Credit</TableHead><TableHead className="text-xs text-right">Running</TableHead>
                  </TableRow></TableHeader><TableBody>
                    {(() => {
                      let running = 0;
                      const sorted = [...openLearner.rows].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                      const ledger: any[] = [];
                      sorted.forEach((r: any) => {
                        if (Number(r.amount_charged) > 0) {
                          running += Number(r.amount_charged);
                          ledger.push({ date: new Date(r.created_at).toLocaleDateString(), desc: `Charge: ${r.fee_type} (T${r.term}/${r.year})`, debit: Number(r.amount_charged), credit: 0, running });
                        }
                        if (Number(r.amount_paid) > 0) {
                          running -= Number(r.amount_paid);
                          ledger.push({ date: new Date(r.payment_date || r.created_at).toLocaleDateString(), desc: `Payment ${r.payment_method?.toUpperCase()}${r.receipt_number ? ' · '+r.receipt_number : ''}`, debit: 0, credit: Number(r.amount_paid), running });
                        }
                      });
                      if (ledger.length === 0) return <TableRow><TableCell colSpan={5} className="text-center py-4 text-xs text-muted-foreground">No transactions</TableCell></TableRow>;
                      return ledger.map((e, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">{e.date}</TableCell>
                          <TableCell className="text-xs">{e.desc}</TableCell>
                          <TableCell className="text-xs text-right">{e.debit ? e.debit.toLocaleString() : '-'}</TableCell>
                          <TableCell className="text-xs text-right text-success">{e.credit ? e.credit.toLocaleString() : '-'}</TableCell>
                          <TableCell className={cn('text-xs text-right font-bold', e.running > 0 ? 'text-destructive' : 'text-success')}>{e.running.toLocaleString()}</TableCell>
                        </TableRow>
                      ));
                    })()}
                  </TableBody></Table></Card>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" onClick={() => { onRecordPayment(openLearner.learner.id); setOpenLearner(null); }}>Record Payment</Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => onStatement(openLearner.learner)}><FileDown className="h-3.5 w-3.5 mr-1" />Statement</Button>
                  {openLearner.balance > 0 && (
                    <Button size="sm" variant="outline" onClick={() => sendReminder(openLearner)}><MessageCircle className="h-3.5 w-3.5 mr-1 text-success" />Remind</Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
