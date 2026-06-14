import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, TrendingUp, AlertTriangle, CheckCircle, Calendar, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { isCharge, isCollectionReceiptRow, isPaymentLedger } from '@/lib/fee-row-utils';

interface Props { schoolId: string; year: number; term: number; }

const fmt = (n: number) => `KES ${Number(n || 0).toLocaleString()}`;

export default function FinanceDashboardTab({ schoolId, year, term }: Props) {
  const { data: records = [] } = useQuery({
    queryKey: ['fin-dash-records', schoolId, year],
    queryFn: async () => {
      const { data } = await supabase.from('fee_records').select('*, learners!fee_records_learner_id_fkey(grade, stream)')
        .eq('school_id', schoolId).eq('year', year).is('voided_at', null);
      return data || [];
    },
    enabled: !!schoolId,
  });

  const { data: smsToday = 0 } = useQuery({
    queryKey: ['fin-sms-today', schoolId],
    queryFn: async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const { count } = await supabase.from('sms_logs').select('*', { count: 'exact', head: true })
        .eq('school_id', schoolId).gte('created_at', start.toISOString());
      return count || 0;
    },
    enabled: !!schoolId,
  });

  const stats = useMemo(() => {
    const live = records as any[];
    const chargeRows = live.filter(isCharge);
    const paymentRows = live.filter(isPaymentLedger);
    const totalCharged = chargeRows.reduce((s, r) => s + Number(r.amount_charged), 0);
    const totalPaid = chargeRows.reduce((s, r) => s + Number(r.amount_paid), 0);
    const balance = totalCharged - totalPaid;
    const collectionRate = totalCharged > 0 ? Math.round((totalPaid / totalCharged) * 100) : 0;

    const byLearner = new Map<string, number>();
    chargeRows.forEach(r => byLearner.set(r.learner_id, (byLearner.get(r.learner_id) || 0) + Number(r.amount_charged) - Number(r.amount_paid)));
    const defaulters = Array.from(byLearner.values()).filter(v => v > 0).length;

    const now = new Date();
    const startToday = new Date(now); startToday.setHours(0, 0, 0, 0);
    const startWeek = new Date(now); startWeek.setDate(now.getDate() - 7);
    const startMonth = new Date(now); startMonth.setDate(now.getDate() - 30);
    // Use payment ledger rows (or legacy combined rows with both charge+paid+payment_date) as the canonical "collection" source
    const collections = live.filter(r => Number(r.amount_paid) > 0 && isCollectionReceiptRow(r));
    const sumIf = (since: Date) => collections.filter(r => new Date(r.payment_date || r.created_at) >= since).reduce((s, r) => s + Number(r.amount_paid), 0);

    // Monthly collection trend (this year) — Collected from collections only, Charged from charges only
    const monthly = Array.from({ length: 12 }, (_, i) => ({ month: new Date(year, i, 1).toLocaleString('en-US', { month: 'short' }), Collected: 0, Charged: 0 }));
    collections.forEach(r => {
      const dt = new Date(r.payment_date || r.created_at);
      if (dt.getFullYear() === year) monthly[dt.getMonth()].Collected += Number(r.amount_paid);
    });
    chargeRows.forEach(r => {
      const dt = new Date(r.created_at);
      if (dt.getFullYear() === year) monthly[dt.getMonth()].Charged += Number(r.amount_charged);
    });

    // By grade
    const gradeMap = new Map<string, { Charged: number; Collected: number; Outstanding: number }>();
    chargeRows.forEach(r => {
      const g = `G${r.learners?.grade || '?'}`;
      const cur = gradeMap.get(g) || { Charged: 0, Collected: 0, Outstanding: 0 };
      cur.Charged += Number(r.amount_charged);
      cur.Collected += Number(r.amount_paid);
      cur.Outstanding = cur.Charged - cur.Collected;
      gradeMap.set(g, cur);
    });
    const byGrade = Array.from(gradeMap.entries()).map(([grade, v]) => ({ grade, ...v })).sort((a, b) => a.grade.localeCompare(b.grade));

    return {
      totalCharged, totalPaid, balance, collectionRate, defaulters,
      today: sumIf(startToday), week: sumIf(startWeek), month: sumIf(startMonth),
      monthly, byGrade,
    };
  }, [records, year]);

  const KPIs = [
    { label: 'Total Charged', value: fmt(stats.totalCharged), icon: Wallet, color: 'text-foreground' },
    { label: 'Total Collected', value: fmt(stats.totalPaid), icon: TrendingUp, color: 'text-success' },
    { label: 'Outstanding', value: fmt(stats.balance), icon: AlertTriangle, color: 'text-destructive' },
    { label: 'Collection Rate', value: `${stats.collectionRate}%`, icon: CheckCircle, color: 'text-primary' },
    { label: 'Defaulters', value: stats.defaulters, icon: AlertTriangle, color: 'text-warning' },
    { label: 'Today', value: fmt(stats.today), icon: Calendar, color: 'text-foreground' },
    { label: 'This Week', value: fmt(stats.week), icon: Calendar, color: 'text-foreground' },
    { label: 'SMS Today', value: smsToday, icon: MessageSquare, color: 'text-primary' },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {KPIs.map(k => (
          <Card key={k.label}><CardContent className="p-3 text-center">
            <k.icon className={cn('h-4 w-4 mx-auto mb-1', k.color)} />
            <p className={cn('text-base md:text-lg font-bold', k.color)}>{k.value}</p>
            <p className="text-[10px] text-muted-foreground">{k.label}</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Collection Trend — {year}</CardTitle></CardHeader>
          <CardContent style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.monthly}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="month" fontSize={10} />
                <YAxis fontSize={10} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => fmt(v as number)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="Collected" stroke="hsl(142 64% 28%)" strokeWidth={2} />
                <Line type="monotone" dataKey="Charged" stroke="hsl(220 70% 50%)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Outstanding by Class</CardTitle></CardHeader>
          <CardContent style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.byGrade}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="grade" fontSize={10} />
                <YAxis fontSize={10} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => fmt(v as number)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Collected" fill="hsl(142 64% 28%)" />
                <Bar dataKey="Outstanding" fill="hsl(0 84% 60%)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
