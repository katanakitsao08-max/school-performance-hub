import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DollarSign, TrendingUp, Clock, CheckCircle2, FileText, Download, ArrowLeft,
  Building2, Pencil, Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { generateSubscriptionReceiptPDF, SubscriptionReceiptData } from '@/lib/subscription-receipt-pdf';
import { useAuth } from '@/contexts/AuthContext';
import { buildWaMeLink } from '@/lib/wa-link';
import logoUrl from '@/assets/performtrack-logo.png';

type School = {
  id: string;
  school_name: string;
  school_code?: string | null;
  subscription_status?: string | null;
  subscription_plan?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
};

type Payment = {
  id: string;
  schoolId: string;
  amount: number;
  date: string;
  notes?: string;
  createdAt: string;
};

type BillingCycle = 'annual' | 'termly' | 'monthly';

type PlanInfo = {
  plan: string;
  billingCycle: BillingCycle;
  amount: number;       // amount per billing cycle
  notes?: string;
  updatedBy?: string;
  updatedAt?: string;
};

const DEFAULT_PLAN_FEE: Record<string, number> = {
  free: 0, basic: 12000, standard: 24000, premium: 48000, enterprise: 96000,
};

const CYCLE_LABEL: Record<BillingCycle, string> = {
  annual: 'Annual', termly: 'Termly', monthly: 'Monthly',
};

function fmtKES(n: number) { return `KES ${Math.round(n || 0).toLocaleString()}`; }

// Compute total billable for a year given a billing cycle + per-cycle amount
function annualBillable(info: PlanInfo): number {
  const a = Number(info.amount) || 0;
  if (info.billingCycle === 'annual') return a;
  if (info.billingCycle === 'termly') return a * 3;
  return a * 12;
}

export default function RevenueSubscriptionSection({ schools }: { schools: School[] }) {
  const { profile, user } = useAuth();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<string>(String(currentYear));
  const [payments, setPayments] = useState<Payment[]>(() => readJSON<Payment[]>(STORAGE_PAYMENTS, []));
  const [plans, setPlans] = useState<Record<string, PlanInfo>>(() => readJSON<Record<string, PlanInfo>>(STORAGE_PLANS, {}));

  const [openEdit, setOpenEdit] = useState(false);
  const [editSchool, setEditSchool] = useState<School | null>(null);
  const [editPlan, setEditPlan] = useState('basic');
  const [editCycle, setEditCycle] = useState<BillingCycle>('annual');
  const [editAmount, setEditAmount] = useState('12000');
  const [editPaid, setEditPaid] = useState('');
  const [editPaidDate, setEditPaidDate] = useState(new Date().toISOString().slice(0, 10));
  const [editNotes, setEditNotes] = useState('');

  const [openFab, setOpenFab] = useState(false);

  const [openPreview, setOpenPreview] = useState(false);
  const [previewData, setPreviewData] = useState<SubscriptionReceiptData | null>(null);
  const [pendingPayment, setPendingPayment] = useState<Payment | null>(null);

  useEffect(() => writeJSON(STORAGE_PAYMENTS, payments), [payments]);
  useEffect(() => writeJSON(STORAGE_PLANS, plans), [plans]);

  const yearOptions = useMemo(() => {
    const set = new Set<number>([currentYear, currentYear - 1, currentYear + 1]);
    payments.forEach(p => set.add(new Date(p.date).getFullYear()));
    return Array.from(set).sort((a, b) => b - a).map(String);
  }, [payments, currentYear]);

  const planFor = (school: School): PlanInfo => {
    const stored = plans[school.id];
    if (stored) return { ...stored, billingCycle: stored.billingCycle || 'annual' };
    const planKey = (school.subscription_plan || 'basic').toLowerCase();
    const annual = DEFAULT_PLAN_FEE[planKey] ?? 12000;
    return { plan: planKey, billingCycle: 'annual', amount: annual };
  };

  const rows = useMemo(() => {
    const today = new Date();
    return schools.map(s => {
      const info = planFor(s);
      const billable = annualBillable(info);
      const yearPayments = payments.filter(
        p => p.schoolId === s.id && new Date(p.date).getFullYear() === Number(year),
      );
      const amountPaid = yearPayments.reduce((sum, p) => sum + p.amount, 0);
      const balance = Math.max(billable - amountPaid, 0);
      const dueDate = new Date(`${year}-12-31`);
      let status: 'Cleared' | 'Active' | 'Pending' | 'Overdue';
      if (billable === 0) status = 'Cleared';
      else if (amountPaid >= billable) status = 'Cleared';
      else if (amountPaid > 0) status = 'Active';
      else if (today > dueDate) status = 'Overdue';
      else status = 'Pending';
      const last = yearPayments.sort((a, b) => b.date.localeCompare(a.date))[0];
      return { school: s, info, billable, amountPaid, balance, status, lastPayment: last?.date || null };
    });
  }, [schools, payments, plans, year]);

  const totals = useMemo(() => {
    const revenue = payments
      .filter(p => new Date(p.date).getFullYear() === Number(year))
      .reduce((s, p) => s + p.amount, 0);
    const pending = rows.reduce((s, r) => s + r.balance, 0);
    const active = rows.filter(r => r.status === 'Active' || r.status === 'Cleared').length;
    return { revenue, pending, active, totalSchools: schools.length };
  }, [payments, rows, year, schools]);

  const openEditFor = (school: School) => {
    const info = planFor(school);
    setEditSchool(school);
    setEditPlan(info.plan);
    setEditCycle(info.billingCycle);
    setEditAmount(String(info.amount));
    setEditPaid('');
    setEditPaidDate(new Date().toISOString().slice(0, 10));
    setEditNotes(info.notes || '');
    setOpenEdit(true);
    setOpenFab(false);
  };

  const onPlanChange = (v: string) => {
    setEditPlan(v);
    if (DEFAULT_PLAN_FEE[v] !== undefined) {
      const annual = DEFAULT_PLAN_FEE[v];
      const map: Record<BillingCycle, number> = { annual, termly: Math.round(annual / 3), monthly: Math.round(annual / 12) };
      setEditAmount(String(map[editCycle]));
    }
  };

  const onCycleChange = (v: string) => {
    const cycle = v as BillingCycle;
    setEditCycle(cycle);
    const annual = DEFAULT_PLAN_FEE[editPlan];
    if (annual !== undefined) {
      const map: Record<BillingCycle, number> = { annual, termly: Math.round(annual / 3), monthly: Math.round(annual / 12) };
      setEditAmount(String(map[cycle]));
    }
  };

  const buildReceiptMessage = (d: SubscriptionReceiptData) =>
    `PerformTrack — Official Payment Receipt\n\n` +
    `Receipt #: ${d.receiptNumber}\nDate: ${d.date}\n` +
    `School: ${d.schoolName}${d.schoolCode ? ' (' + d.schoolCode + ')' : ''}\n` +
    `Plan: ${String(d.plan).toUpperCase()}\nBilling year: ${d.year}\n` +
    `Subscription amount: ${fmtKES(d.annualFee)}\n` +
    `Amount received: ${fmtKES(d.amountPaid)}\n` +
    `Outstanding balance: ${fmtKES(d.balanceAfter)}\n\n` +
    `Issued by: ${d.issuedBy}\n(PDF receipt attached separately.)`;

  const sendToAdmin = (d: SubscriptionReceiptData, school: School | null) => {
    const phone = school?.contact_phone || '';
    const email = school?.contact_email || '';
    const msg = buildReceiptMessage(d);
    const wa = phone ? buildWaMeLink(phone, msg) : null;
    if (wa) window.open(wa, '_blank', 'noopener,noreferrer');
    else if (phone) toast.error('School contact phone is invalid for WhatsApp');
    if (email) {
      const subject = encodeURIComponent(`PerformTrack Receipt ${d.receiptNumber} — ${d.schoolName}`);
      const body = encodeURIComponent(msg);
      window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
    }
  };

  const saveEdit = () => {
    if (!editSchool) return;
    const amt = Number(editAmount);
    if (Number.isNaN(amt) || amt < 0) { toast.error('Enter a valid subscription amount'); return; }

    const newInfo: PlanInfo = {
      plan: editPlan,
      billingCycle: editCycle,
      amount: amt,
      notes: editNotes || undefined,
      updatedBy: profile?.full_name || user?.email || 'Super Admin',
      updatedAt: new Date().toISOString(),
    };
    setPlans(prev => ({ ...prev, [editSchool.id]: newInfo }));

    const paid = Number(editPaid);
    if (paid > 0) {
      const yearOfPayment = new Date(editPaidDate).getFullYear();
      const billable = annualBillable(newInfo);
      const paidThisYear =
        payments
          .filter(p => p.schoolId === editSchool.id && new Date(p.date).getFullYear() === yearOfPayment)
          .reduce((s, p) => s + p.amount, 0) + paid;
      const balanceAfter = Math.max(billable - paidThisYear, 0);
      const receiptNumber = `PT-${yearOfPayment}-${Date.now().toString().slice(-6)}`;
      const newPayment: Payment = {
        id: crypto.randomUUID(),
        schoolId: editSchool.id,
        amount: paid,
        date: editPaidDate,
        notes: editNotes || undefined,
        createdAt: new Date().toISOString(),
      };
      const receiptData: SubscriptionReceiptData = {
        receiptNumber,
        date: editPaidDate,
        schoolName: editSchool.school_name,
        schoolCode: editSchool.school_code || null,
        plan: `${newInfo.plan} (${CYCLE_LABEL[newInfo.billingCycle]})`,
        annualFee: billable,
        amountPaid: paid,
        balanceAfter,
        year: yearOfPayment,
        issuedBy: profile?.full_name || user?.email || 'Super Admin',
      };
      setPendingPayment(newPayment);
      setPreviewData(receiptData);
      setOpenEdit(false);
      setOpenPreview(true);
    } else {
      toast.success('Subscription updated');
      setOpenEdit(false);
    }
  };

  const confirmAndDownload = async () => {
    if (!pendingPayment || !previewData) return;
    setPayments(prev => [...prev, pendingPayment]);
    const school = schools.find(s => s.id === pendingPayment.schoolId) || null;
    try {
      await generateSubscriptionReceiptPDF(previewData);
      toast.success(`Payment of ${fmtKES(previewData.amountPaid)} recorded · Receipt downloaded`);
    } catch (e) {
      console.error(e);
      toast.error('Could not generate receipt PDF');
    }
    sendToAdmin(previewData, school);
    setOpenPreview(false);
    setPendingPayment(null);
    setPreviewData(null);
  };

  const cancelPreview = () => {
    setOpenPreview(false);
    setPendingPayment(null);
    setPreviewData(null);
    setOpenEdit(true);
  };

  const statusBadgeClass = (s: string) =>
    s === 'Cleared' ? 'border-success/40 text-success bg-success/10' :
    s === 'Active' ? 'border-primary/40 text-primary bg-primary/10' :
    s === 'Overdue' ? 'border-destructive/40 text-destructive bg-destructive/10' :
    'border-warning/40 text-warning bg-warning/10';

  return (
    <div className="space-y-4 relative">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg md:text-xl font-display font-bold text-foreground">Revenue & Subscriptions</h2>
          <p className="text-xs text-muted-foreground">Per-school subscription amount, billing cycle and payments</p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="year-filter" className="text-xs">Year</Label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger id="year-filter" className="h-8 w-[110px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {yearOptions.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="rounded-xl shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[11px] sm:text-sm font-medium text-muted-foreground">Total Schools</CardTitle>
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent><p className="text-xl sm:text-2xl font-display font-bold">{totals.totalSchools}</p></CardContent>
        </Card>
        <Card className="rounded-xl shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[11px] sm:text-sm font-medium text-muted-foreground">Active Subs</CardTitle>
            <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4 text-success" />
            </div>
          </CardHeader>
          <CardContent><p className="text-xl sm:text-2xl font-display font-bold">{totals.active}</p></CardContent>
        </Card>
        <Card className="rounded-xl shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[11px] sm:text-sm font-medium text-muted-foreground">Pending Payments</CardTitle>
            <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center">
              <Clock className="h-4 w-4 text-warning" />
            </div>
          </CardHeader>
          <CardContent><p className="text-base sm:text-2xl font-display font-bold">{fmtKES(totals.pending)}</p></CardContent>
        </Card>
        <Card className="rounded-xl shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-[11px] sm:text-sm font-medium text-muted-foreground">Revenue Collected</CardTitle>
            <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-success" />
            </div>
          </CardHeader>
          <CardContent><p className="text-base sm:text-2xl font-display font-bold">{fmtKES(totals.revenue)}</p></CardContent>
        </Card>
      </div>

      {/* Subscriptions table */}
      <Card className="rounded-xl shadow-sm overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Subscription Tracker
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
                <TableRow>
                  <TableHead className="text-xs whitespace-nowrap">School</TableHead>
                  <TableHead className="text-xs whitespace-nowrap">Plan</TableHead>
                  <TableHead className="text-xs whitespace-nowrap">Billing Cycle</TableHead>
                  <TableHead className="text-xs whitespace-nowrap text-right">Subscription Amount</TableHead>
                  <TableHead className="text-xs whitespace-nowrap text-right">Paid</TableHead>
                  <TableHead className="text-xs whitespace-nowrap text-right">Balance</TableHead>
                  <TableHead className="text-xs whitespace-nowrap">Status</TableHead>
                  <TableHead className="text-xs whitespace-nowrap">Last Payment</TableHead>
                  <TableHead className="text-xs whitespace-nowrap text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-6">No schools yet</TableCell>
                  </TableRow>
                )}
                {rows.map(({ school, info, billable, amountPaid, balance, status, lastPayment }) => (
                  <TableRow key={school.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium text-sm whitespace-nowrap">
                      {school.school_name}
                      {school.school_code && (
                        <div className="text-[10px] text-muted-foreground">{school.school_code}</div>
                      )}
                    </TableCell>
                    <TableCell className="capitalize text-sm">{info.plan}</TableCell>
                    <TableCell className="text-sm">
                      <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 font-normal">
                        {CYCLE_LABEL[info.billingCycle]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {fmtKES(info.amount)}
                      <div className="text-[10px] text-muted-foreground">/yr {fmtKES(billable)}</div>
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums text-success">{fmtKES(amountPaid)}</TableCell>
                    <TableCell className="text-right text-sm tabular-nums font-semibold">{fmtKES(balance)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusBadgeClass(status)}>{status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{lastPayment || '—'}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => openEditFor(school)} className="h-8 px-2">
                        <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Floating action button */}
      <button
        onClick={() => setOpenFab(true)}
        aria-label="Add or record"
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
      >
        <Plus className="h-6 w-6" />
      </button>

      {/* FAB chooser */}
      <Dialog open={openFab} onOpenChange={setOpenFab}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Quick Action</DialogTitle>
            <DialogDescription>Select a school to manage its subscription or record a payment</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {schools.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No schools available</p>}
            {schools.map(s => (
              <button
                key={s.id}
                onClick={() => openEditFor(s)}
                className="w-full text-left p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium">{s.school_name}</p>
                  <p className="text-[11px] text-muted-foreground capitalize">{planFor(s).plan} · {CYCLE_LABEL[planFor(s).billingCycle]}</p>
                </div>
                <Pencil className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit subscription / record payment modal */}
      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Subscription</DialogTitle>
            <DialogDescription>{editSchool?.school_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-plan" className="text-xs">Plan</Label>
                <Select value={editPlan} onValueChange={onPlanChange}>
                  <SelectTrigger id="edit-plan"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(DEFAULT_PLAN_FEE).map(p => (
                      <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-cycle" className="text-xs">Billing Cycle</Label>
                <Select value={editCycle} onValueChange={onCycleChange}>
                  <SelectTrigger id="edit-cycle"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="annual">Annual</SelectItem>
                    <SelectItem value="termly">Termly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="edit-amount" className="text-xs">Subscription Amount (KES) per {editCycle}</Label>
              <Input id="edit-amount" type="number" min="0" value={editAmount} onChange={e => setEditAmount(e.target.value)} />
              <p className="text-[11px] text-muted-foreground mt-1">
                Yearly billable: <span className="font-semibold">{fmtKES(annualBillable({ plan: editPlan, billingCycle: editCycle, amount: Number(editAmount) || 0 }))}</span>
              </p>
            </div>
            <div className="h-px bg-border" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-paid" className="text-xs">Record Payment (KES)</Label>
                <Input id="edit-paid" type="number" min="0" placeholder="Optional" value={editPaid} onChange={e => setEditPaid(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="edit-paid-date" className="text-xs">Payment Date</Label>
                <Input id="edit-paid-date" type="date" value={editPaidDate} onChange={e => setEditPaidDate(e.target.value)} />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-notes" className="text-xs">Notes</Label>
              <Textarea id="edit-notes" rows={2} placeholder="Optional notes..." value={editNotes} onChange={e => setEditNotes(e.target.value)} />
            </div>
            {editSchool && (() => {
              const info = { plan: editPlan, billingCycle: editCycle, amount: Number(editAmount) || 0 } as PlanInfo;
              const billable = annualBillable(info);
              const paidYr = payments
                .filter(p => p.schoolId === editSchool.id && new Date(p.date).getFullYear() === Number(year))
                .reduce((s, p) => s + p.amount, 0) + (Number(editPaid) || 0);
              const bal = Math.max(billable - paidYr, 0);
              return (
                <div className="rounded-md bg-muted/40 px-3 py-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Balance after this entry</span>
                  <span className="text-sm font-semibold">{fmtKES(bal)}</span>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenEdit(false)}>Cancel</Button>
            <Button onClick={saveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Preview Modal */}
      <Dialog open={openPreview} onOpenChange={setOpenPreview}>
        <DialogContent className="max-w-md sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Receipt Preview
            </DialogTitle>
            <DialogDescription>Review the receipt details before downloading</DialogDescription>
          </DialogHeader>
          {previewData && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border overflow-hidden bg-card">
                <div className="bg-primary px-4 py-3 flex items-center gap-3">
                  <img src={logoUrl} alt="PerformTrack" className="h-8 w-8 object-contain" />
                  <div>
                    <p className="text-primary-foreground font-bold text-sm">PerformTrack</p>
                    <p className="text-primary-foreground/80 text-[10px]">Official Subscription Receipt</p>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Receipt #</span>
                    <span className="text-sm font-mono font-medium">{previewData.receiptNumber}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Date</span>
                    <span className="text-sm font-medium">{previewData.date}</span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">School</span>
                    <span className="text-sm font-medium text-right max-w-[60%]">{previewData.schoolName}</span>
                  </div>
                  {previewData.schoolCode && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">School Code</span>
                      <span className="text-sm font-medium">{previewData.schoolCode}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Plan</span>
                    <span className="text-sm font-medium capitalize">{previewData.plan}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Billing Year</span>
                    <span className="text-sm font-medium">{previewData.year}</span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Subscription Amount (yr)</span>
                    <span className="text-sm font-medium">{fmtKES(previewData.annualFee)}</span>
                  </div>
                  <div className="flex items-center justify-between bg-success/10 rounded-md px-3 py-2">
                    <span className="text-xs font-semibold text-success">Amount Received</span>
                    <span className="text-base font-bold text-success">{fmtKES(previewData.amountPaid)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Outstanding Balance</span>
                    <span className="text-sm font-medium">{fmtKES(previewData.balanceAfter)}</span>
                  </div>
                  <div className="h-px bg-border" />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Issued By</span>
                    <span className="text-sm font-medium">{previewData.issuedBy}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={cancelPreview} className="w-full sm:w-auto">
              <ArrowLeft className="h-4 w-4 mr-1" /> Edit
            </Button>
            <Button onClick={confirmAndDownload} className="w-full sm:w-auto">
              <Download className="h-4 w-4 mr-1" /> Confirm & Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
