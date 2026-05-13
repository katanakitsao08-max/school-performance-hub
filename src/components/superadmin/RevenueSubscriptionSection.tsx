import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { DollarSign, TrendingUp, Clock, CheckCircle2, FileText, Download, ArrowLeft } from 'lucide-react';
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
  date: string; // ISO yyyy-mm-dd
  createdAt: string;
};

type TermFees = { term1: number; term2: number; term3: number };
type PlanInfo = {
  plan: string;
  annualFee: number; // legacy + auto-derived sum of default termFees
  termFees: TermFees; // default per-term fees
  yearOverrides?: Record<string, TermFees>; // optional per-year overrides
};

const STORAGE_PAYMENTS = 'subscriptionPayments';
const STORAGE_PLANS = 'subscriptionPlans';

// Default annual fees by plan name (KES). Used to seed term fees when plan changes.
const DEFAULT_PLAN_FEE: Record<string, number> = {
  free: 0,
  basic: 12000,
  standard: 24000,
  premium: 48000,
  enterprise: 96000,
};

const splitToTerms = (annual: number): TermFees => {
  const each = Math.round((annual || 0) / 3);
  return { term1: each, term2: each, term3: Math.max(0, (annual || 0) - each * 2) };
};
const sumTerms = (t: TermFees) => Number(t.term1 || 0) + Number(t.term2 || 0) + Number(t.term3 || 0);

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

function fmtKES(n: number) {
  return `KES ${Math.round(n).toLocaleString()}`;
}

export default function RevenueSubscriptionSection({ schools }: { schools: School[] }) {
  const { profile, user } = useAuth();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<string>(String(currentYear));
  const [payments, setPayments] = useState<Payment[]>(() => readJSON<Payment[]>(STORAGE_PAYMENTS, []));
  const [plans, setPlans] = useState<Record<string, PlanInfo>>(() => readJSON<Record<string, PlanInfo>>(STORAGE_PLANS, {}));

  const [openPay, setOpenPay] = useState(false);
  const [activeSchool, setActiveSchool] = useState<School | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));

  const [openPlan, setOpenPlan] = useState(false);
  const [planSchool, setPlanSchool] = useState<School | null>(null);
  const [planName, setPlanName] = useState('basic');
  const [planYearScope, setPlanYearScope] = useState<string>('default');
  const [term1, setTerm1] = useState('4000');
  const [term2, setTerm2] = useState('4000');
  const [term3, setTerm3] = useState('4000');

  const [openPreview, setOpenPreview] = useState(false);
  const [previewData, setPreviewData] = useState<SubscriptionReceiptData | null>(null);
  const [pendingPayment, setPendingPayment] = useState<Payment | null>(null);
  const [payTerm, setPayTerm] = useState<string>('1');

  useEffect(() => writeJSON(STORAGE_PAYMENTS, payments), [payments]);
  useEffect(() => writeJSON(STORAGE_PLANS, plans), [plans]);

  const yearOptions = useMemo(() => {
    const set = new Set<number>([currentYear, currentYear - 1, currentYear + 1]);
    payments.forEach(p => set.add(new Date(p.date).getFullYear()));
    return Array.from(set).sort((a, b) => b - a).map(String);
  }, [payments, currentYear]);

  const planFor = (school: School): PlanInfo => {
    const stored = plans[school.id];
    if (stored) {
      // backfill termFees if older record only had annualFee
      const termFees = stored.termFees ?? splitToTerms(stored.annualFee || 0);
      return { ...stored, termFees, annualFee: stored.annualFee || sumTerms(termFees) };
    }
    const planKey = (school.subscription_plan || 'basic').toLowerCase();
    const annual = DEFAULT_PLAN_FEE[planKey] ?? 12000;
    return { plan: planKey, annualFee: annual, termFees: splitToTerms(annual) };
  };

  const feesForYear = (info: PlanInfo, yr: string | number): { termFees: TermFees; annualFee: number } => {
    const t = info.yearOverrides?.[String(yr)] ?? info.termFees;
    return { termFees: t, annualFee: sumTerms(t) };
  };

  const rows = useMemo(() => {
    return schools.map(s => {
      const info = planFor(s);
      const { annualFee } = feesForYear(info, year);
      const yearPayments = payments.filter(
        p => p.schoolId === s.id && new Date(p.date).getFullYear() === Number(year),
      );
      const amountPaid = yearPayments.reduce((sum, p) => sum + p.amount, 0);
      const balance = Math.max(annualFee - amountPaid, 0);
      const status: 'Paid' | 'Partial' | 'Unpaid' =
        amountPaid >= annualFee && annualFee > 0 ? 'Paid' : amountPaid > 0 ? 'Partial' : 'Unpaid';
      const last = yearPayments.sort((a, b) => b.date.localeCompare(a.date))[0];
      const nextDue = last ? new Date(new Date(last.date).getTime() + 365 * 86400000).toISOString().slice(0, 10) : `${year}-12-31`;
      return { school: s, info, annualFee, amountPaid, balance, status, lastPayment: last?.date || null, nextDue };
    });
  }, [schools, payments, plans, year]);

  const totals = useMemo(() => {
    const yearly = payments
      .filter(p => new Date(p.date).getFullYear() === Number(year))
      .reduce((s, p) => s + p.amount, 0);
    const thisMonth = new Date();
    const monthly = payments
      .filter(p => {
        const d = new Date(p.date);
        return d.getFullYear() === thisMonth.getFullYear() && d.getMonth() === thisMonth.getMonth();
      })
      .reduce((s, p) => s + p.amount, 0);
    const pending = rows.reduce((s, r) => s + r.balance, 0);
    const active = rows.filter(r => r.status !== 'Unpaid').length;
    return { yearly, monthly, pending, active };
  }, [payments, rows, year]);

  const openRecord = (school: School) => {
    setActiveSchool(school);
    const info = planFor(school);
    const { termFees } = feesForYear(info, year);
    setPayTerm('1');
    setPayAmount(String(termFees.term1 || ''));
    setPayDate(new Date().toISOString().slice(0, 10));
    setOpenPay(true);
  };

  const onPayTermChange = (v: string) => {
    setPayTerm(v);
    if (!activeSchool) return;
    const info = planFor(activeSchool);
    const { termFees } = feesForYear(info, new Date(payDate).getFullYear());
    const map: Record<string, number> = {
      '1': termFees.term1, '2': termFees.term2, '3': termFees.term3,
      'annual': sumTerms(termFees),
    };
    if (map[v] !== undefined) setPayAmount(String(map[v] || ''));
  };

  const savePayment = async () => {
    if (!activeSchool) return;
    const amt = Number(payAmount);
    if (!amt || amt <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    const newPayment: Payment = {
      id: crypto.randomUUID(),
      schoolId: activeSchool.id,
      amount: amt,
      date: payDate,
      createdAt: new Date().toISOString(),
    };

    const info = planFor(activeSchool);
    const yearOfPayment = new Date(payDate).getFullYear();
    const { annualFee } = feesForYear(info, yearOfPayment);
    const paidThisYear =
      payments
        .filter(p => p.schoolId === activeSchool.id && new Date(p.date).getFullYear() === yearOfPayment)
        .reduce((s, p) => s + p.amount, 0) + amt;
    const balanceAfter = Math.max(annualFee - paidThisYear, 0);
    const receiptNumber = `PT-${yearOfPayment}-${Date.now().toString().slice(-6)}`;

    const planLabel = payTerm === 'annual'
      ? `${info.plan} (Annual)`
      : `${info.plan} (Term ${payTerm})`;

    const receiptData: SubscriptionReceiptData = {
      receiptNumber,
      date: payDate,
      schoolName: activeSchool.school_name,
      schoolCode: activeSchool.school_code || null,
      plan: planLabel,
      annualFee,
      amountPaid: amt,
      balanceAfter,
      year: yearOfPayment,
      issuedBy: profile?.full_name || user?.email || 'Super Admin',
    };

    setPendingPayment(newPayment);
    setPreviewData(receiptData);
    setOpenPay(false);
    setOpenPreview(true);
  };

  const buildReceiptMessage = (d: SubscriptionReceiptData) =>
    `PerformTrack — Official Payment Receipt\n\n` +
    `Receipt #: ${d.receiptNumber}\n` +
    `Date: ${d.date}\n` +
    `School: ${d.schoolName}${d.schoolCode ? ' (' + d.schoolCode + ')' : ''}\n` +
    `Plan: ${String(d.plan).toUpperCase()}\n` +
    `Billing year: ${d.year}\n` +
    `Annual fee: ${fmtKES(d.annualFee)}\n` +
    `Amount received: ${fmtKES(d.amountPaid)}\n` +
    `Outstanding balance: ${fmtKES(d.balanceAfter)}\n\n` +
    `Issued by: ${d.issuedBy}\n` +
    `(PDF receipt attached separately.)`;

  const sendToAdmin = (d: SubscriptionReceiptData, school: School | null) => {
    const phone = school?.contact_phone || '';
    const email = school?.contact_email || '';
    const msg = buildReceiptMessage(d);
    const wa = phone ? buildWaMeLink(phone, msg) : null;
    if (wa) {
      window.open(wa, '_blank', 'noopener,noreferrer');
    } else if (phone) {
      toast.error('School contact phone is invalid for WhatsApp');
    } else {
      toast.message('No school contact phone on file — skipped WhatsApp');
    }
    if (email) {
      const subject = encodeURIComponent(`PerformTrack Receipt ${d.receiptNumber} — ${d.schoolName}`);
      const body = encodeURIComponent(msg);
      // open in new tab so we don't navigate away from the dashboard
      window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
    } else {
      toast.message('No school contact email on file — skipped email');
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
      toast.success(`Payment of ${fmtKES(previewData.amountPaid)} recorded`);
      toast.error('Could not generate receipt PDF');
    }
    // Auto-deliver to school admin via WhatsApp + email
    sendToAdmin(previewData, school);
    setOpenPreview(false);
    setPendingPayment(null);
    setPreviewData(null);
  };

  const cancelPreview = () => {
    setOpenPreview(false);
    setPendingPayment(null);
    setPreviewData(null);
    setOpenPay(true);
  };

  const openEditPlan = (school: School) => {
    const info = planFor(school);
    setPlanSchool(school);
    setPlanName(info.plan);
    setPlanYearScope('default');
    setTerm1(String(info.termFees.term1));
    setTerm2(String(info.termFees.term2));
    setTerm3(String(info.termFees.term3));
    setOpenPlan(true);
  };

  const onPlanYearScopeChange = (v: string) => {
    setPlanYearScope(v);
    if (!planSchool) return;
    const info = planFor(planSchool);
    const t = v === 'default' ? info.termFees : (info.yearOverrides?.[v] ?? info.termFees);
    setTerm1(String(t.term1));
    setTerm2(String(t.term2));
    setTerm3(String(t.term3));
  };

  const onPlanNameChange = (v: string) => {
    setPlanName(v);
    if (DEFAULT_PLAN_FEE[v] !== undefined) {
      const t = splitToTerms(DEFAULT_PLAN_FEE[v]);
      setTerm1(String(t.term1));
      setTerm2(String(t.term2));
      setTerm3(String(t.term3));
    }
  };

  const savePlan = () => {
    if (!planSchool) return;
    const t1 = Number(term1), t2 = Number(term2), t3 = Number(term3);
    if ([t1, t2, t3].some(n => Number.isNaN(n) || n < 0)) {
      toast.error('Enter valid term fees (zero or positive numbers)');
      return;
    }
    const newTerms: TermFees = { term1: t1, term2: t2, term3: t3 };
    setPlans(prev => {
      const existing = prev[planSchool.id];
      const base: PlanInfo = existing
        ? { ...existing, termFees: existing.termFees ?? splitToTerms(existing.annualFee || 0) }
        : { plan: planName, annualFee: 0, termFees: { term1: 0, term2: 0, term3: 0 } };
      let next: PlanInfo;
      if (planYearScope === 'default') {
        next = { ...base, plan: planName, termFees: newTerms, annualFee: sumTerms(newTerms) };
      } else {
        const overrides = { ...(base.yearOverrides || {}), [planYearScope]: newTerms };
        next = { ...base, plan: planName, yearOverrides: overrides };
      }
      return { ...prev, [planSchool.id]: next };
    });
    toast.success(planYearScope === 'default' ? 'Default term fees saved' : `Fees for ${planYearScope} saved`);
    setOpenPlan(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg md:text-xl font-display font-bold text-foreground">Revenue & Subscriptions</h2>
          <p className="text-xs text-muted-foreground">Set per-school term/year fees · auto-receipt to school admin via WhatsApp + email</p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="year-filter" className="text-xs">Year</Label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger id="year-filter" className="h-8 w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Revenue summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Total Revenue ({year})</CardTitle>
            <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-success" />
            </div>
          </CardHeader>
          <CardContent><p className="text-xl sm:text-2xl font-display font-bold">{fmtKES(totals.yearly)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Monthly Revenue</CardTitle>
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent><p className="text-xl sm:text-2xl font-display font-bold">{fmtKES(totals.monthly)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Pending Payments</CardTitle>
            <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center">
              <Clock className="h-4 w-4 text-warning" />
            </div>
          </CardHeader>
          <CardContent><p className="text-xl sm:text-2xl font-display font-bold">{fmtKES(totals.pending)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Active Subscriptions</CardTitle>
            <div className="w-9 h-9 rounded-lg bg-info/10 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4 text-info" />
            </div>
          </CardHeader>
          <CardContent><p className="text-xl sm:text-2xl font-display font-bold">{totals.active}</p></CardContent>
        </Card>
      </div>

      {/* Subscriptions table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-display font-semibold">Subscription Tracker</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>School</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="text-right">Annual Fee</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Payment</TableHead>
                <TableHead>Next Due</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-6">No schools yet</TableCell>
                </TableRow>
              )}
              {rows.map(({ school, info, annualFee, amountPaid, balance, status, lastPayment, nextDue }) => (
                <TableRow key={school.id}>
                  <TableCell className="font-medium">{school.school_name}</TableCell>
                  <TableCell>
                    <button
                      className="capitalize underline-offset-2 hover:underline text-primary text-sm"
                      onClick={() => openEditPlan(school)}
                    >
                      {info.plan}
                    </button>
                  </TableCell>
                  <TableCell className="text-right">{fmtKES(annualFee)}</TableCell>
                  <TableCell className="text-right">{fmtKES(amountPaid)}</TableCell>
                  <TableCell className="text-right">{fmtKES(balance)}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        status === 'Paid' ? 'border-success/40 text-success bg-success/10' :
                        status === 'Partial' ? 'border-warning/40 text-warning bg-warning/10' :
                        'border-destructive/40 text-destructive bg-destructive/10'
                      }
                    >
                      {status}
                    </Badge>
                  </TableCell>
                  <TableCell>{lastPayment || '—'}</TableCell>
                  <TableCell>{nextDue}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => openRecord(school)}>Record Payment</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Record payment modal */}
      <Dialog open={openPay} onOpenChange={setOpenPay}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>{activeSchool?.school_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="pay-term">Payment for</Label>
              <Select value={payTerm} onValueChange={onPayTermChange}>
                <SelectTrigger id="pay-term"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Term 1</SelectItem>
                  <SelectItem value="2">Term 2</SelectItem>
                  <SelectItem value="3">Term 3</SelectItem>
                  <SelectItem value="annual">Whole Year</SelectItem>
                  <SelectItem value="custom">Custom amount</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="pay-amount">Amount (KES)</Label>
              <Input id="pay-amount" type="number" min="1" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="e.g. 12000" />
            </div>
            <div>
              <Label htmlFor="pay-date">Date</Label>
              <Input id="pay-date" type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenPay(false)}>Cancel</Button>
            <Button onClick={savePayment}>Save Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit plan modal */}
      <Dialog open={openPlan} onOpenChange={setOpenPlan}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Plan</DialogTitle>
            <DialogDescription>{planSchool?.school_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="plan-name">Plan</Label>
              <Select value={planName} onValueChange={onPlanNameChange}>
                <SelectTrigger id="plan-name"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(DEFAULT_PLAN_FEE).map(p => (
                    <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="plan-year-scope">Apply fees to</Label>
              <Select value={planYearScope} onValueChange={onPlanYearScopeChange}>
                <SelectTrigger id="plan-year-scope"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default (all years)</SelectItem>
                  {yearOptions.map(y => (
                    <SelectItem key={y} value={y}>Override for {y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">
                Set per-year overrides when a school's pricing changes between years.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label htmlFor="term-1" className="text-xs">Term 1 (KES)</Label>
                <Input id="term-1" type="number" min="0" value={term1} onChange={e => setTerm1(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="term-2" className="text-xs">Term 2 (KES)</Label>
                <Input id="term-2" type="number" min="0" value={term2} onChange={e => setTerm2(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="term-3" className="text-xs">Term 3 (KES)</Label>
                <Input id="term-3" type="number" min="0" value={term3} onChange={e => setTerm3(e.target.value)} />
              </div>
            </div>
            <div className="rounded-md bg-muted/40 px-3 py-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Annual fee (sum of terms)</span>
              <span className="text-sm font-semibold">
                {fmtKES((Number(term1) || 0) + (Number(term2) || 0) + (Number(term3) || 0))}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenPlan(false)}>Cancel</Button>
            <Button onClick={savePlan}>Save Plan</Button>
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
            <DialogDescription>
              Review the receipt details before downloading
            </DialogDescription>
          </DialogHeader>
          {previewData && (
            <div className="space-y-4">
              {/* Receipt card preview */}
              <div className="rounded-lg border border-border overflow-hidden bg-card">
                {/* Header band */}
                <div className="bg-primary px-4 py-3 flex items-center gap-3">
                  <img src={logoUrl} alt="PerformTrack" className="h-8 w-8 object-contain" />
                  <div>
                    <p className="text-white font-bold text-sm">PerformTrack</p>
                    <p className="text-white/80 text-[10px]">Official Subscription Receipt</p>
                  </div>
                </div>
                {/* Body */}
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
                    <span className="text-xs text-muted-foreground">Annual Fee</span>
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
              <ArrowLeft className="h-4 w-4 mr-1" />
              Edit
            </Button>
            <Button onClick={confirmAndDownload} className="w-full sm:w-auto">
              <Download className="h-4 w-4 mr-1" />
              Confirm & Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
