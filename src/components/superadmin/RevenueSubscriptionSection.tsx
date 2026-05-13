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
import { DollarSign, TrendingUp, Clock, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { generateSubscriptionReceiptPDF } from '@/lib/subscription-receipt-pdf';
import { useAuth } from '@/contexts/AuthContext';

type School = {
  id: string;
  school_name: string;
  school_code?: string | null;
  subscription_status?: string | null;
  subscription_plan?: string | null;
};

type Payment = {
  id: string;
  schoolId: string;
  amount: number;
  date: string; // ISO yyyy-mm-dd
  createdAt: string;
};

type PlanInfo = {
  plan: string;
  annualFee: number;
};

const STORAGE_PAYMENTS = 'subscriptionPayments';
const STORAGE_PLANS = 'subscriptionPlans';

// Default annual fees by plan name (KES). Editable via plan info modal in future.
const DEFAULT_PLAN_FEE: Record<string, number> = {
  free: 0,
  basic: 12000,
  standard: 24000,
  premium: 48000,
  enterprise: 96000,
};

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
  const [planFee, setPlanFee] = useState('12000');

  useEffect(() => writeJSON(STORAGE_PAYMENTS, payments), [payments]);
  useEffect(() => writeJSON(STORAGE_PLANS, plans), [plans]);

  const yearOptions = useMemo(() => {
    const set = new Set<number>([currentYear, currentYear - 1, currentYear + 1]);
    payments.forEach(p => set.add(new Date(p.date).getFullYear()));
    return Array.from(set).sort((a, b) => b - a).map(String);
  }, [payments, currentYear]);

  const planFor = (school: School): PlanInfo => {
    if (plans[school.id]) return plans[school.id];
    const planKey = (school.subscription_plan || 'basic').toLowerCase();
    return { plan: planKey, annualFee: DEFAULT_PLAN_FEE[planKey] ?? 12000 };
  };

  const rows = useMemo(() => {
    return schools.map(s => {
      const info = planFor(s);
      const yearPayments = payments.filter(
        p => p.schoolId === s.id && new Date(p.date).getFullYear() === Number(year),
      );
      const amountPaid = yearPayments.reduce((sum, p) => sum + p.amount, 0);
      const balance = Math.max(info.annualFee - amountPaid, 0);
      const status: 'Paid' | 'Partial' | 'Unpaid' =
        amountPaid >= info.annualFee && info.annualFee > 0 ? 'Paid' : amountPaid > 0 ? 'Partial' : 'Unpaid';
      const last = yearPayments.sort((a, b) => b.date.localeCompare(a.date))[0];
      const nextDue = last ? new Date(new Date(last.date).getTime() + 365 * 86400000).toISOString().slice(0, 10) : `${year}-12-31`;
      return { school: s, info, amountPaid, balance, status, lastPayment: last?.date || null, nextDue };
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
    setPayAmount('');
    setPayDate(new Date().toISOString().slice(0, 10));
    setOpenPay(true);
  };

  const savePayment = () => {
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
    setPayments(prev => [...prev, newPayment]);
    toast.success(`Payment of ${fmtKES(amt)} recorded for ${activeSchool.school_name}`);
    setOpenPay(false);
  };

  const openEditPlan = (school: School) => {
    const info = planFor(school);
    setPlanSchool(school);
    setPlanName(info.plan);
    setPlanFee(String(info.annualFee));
    setOpenPlan(true);
  };

  const savePlan = () => {
    if (!planSchool) return;
    const fee = Number(planFee);
    if (fee < 0 || Number.isNaN(fee)) {
      toast.error('Enter a valid annual fee');
      return;
    }
    setPlans(prev => ({ ...prev, [planSchool.id]: { plan: planName, annualFee: fee } }));
    toast.success('Plan updated');
    setOpenPlan(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg md:text-xl font-display font-bold text-foreground">Revenue & Subscriptions</h2>
          <p className="text-xs text-muted-foreground">Track plan payments per school (saved locally)</p>
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
              {rows.map(({ school, info, amountPaid, balance, status, lastPayment, nextDue }) => (
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
                  <TableCell className="text-right">{fmtKES(info.annualFee)}</TableCell>
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
              <Select value={planName} onValueChange={(v) => {
                setPlanName(v);
                if (DEFAULT_PLAN_FEE[v] !== undefined) setPlanFee(String(DEFAULT_PLAN_FEE[v]));
              }}>
                <SelectTrigger id="plan-name"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.keys(DEFAULT_PLAN_FEE).map(p => (
                    <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="plan-fee">Annual Fee (KES)</Label>
              <Input id="plan-fee" type="number" min="0" value={planFee} onChange={e => setPlanFee(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenPlan(false)}>Cancel</Button>
            <Button onClick={savePlan}>Save Plan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
