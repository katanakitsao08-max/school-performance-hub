import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wallet, CreditCard, ArrowDownCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';

interface Props {
  child: { id: string; full_name: string };
}

export default function ParentFeesTab({ child }: Props) {
  const { data: feeRecords = [] } = useQuery({
    queryKey: ['parent-fees', child.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('fee_records')
        .select('*')
        .eq('learner_id', child.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const summary = useMemo(() => {
    const totalCharged = feeRecords.reduce((s, r) => s + Number(r.amount_charged), 0);
    const totalPaid = feeRecords.reduce((s, r) => s + Number(r.amount_paid), 0);
    const balance = totalCharged - totalPaid;
    return { totalCharged, totalPaid, balance };
  }, [feeRecords]);

  const payments = useMemo(() => {
    return feeRecords.filter(r => Number(r.amount_paid) > 0);
  }, [feeRecords]);

  const formatAmount = (n: number) => `KES ${n.toLocaleString()}`;

  return (
    <div className="space-y-4">
      {/* Balance Summary */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="shadow-card">
          <CardContent className="p-3 text-center">
            <p className="text-lg font-display font-bold text-foreground">{formatAmount(summary.totalCharged)}</p>
            <p className="text-[10px] text-muted-foreground">Total Fees</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-3 text-center">
            <p className="text-lg font-display font-bold text-success">{formatAmount(summary.totalPaid)}</p>
            <p className="text-[10px] text-muted-foreground">Paid</p>
          </CardContent>
        </Card>
        <Card className="shadow-card border-destructive/20">
          <CardContent className="p-3 text-center">
            <p className={cn("text-lg font-display font-bold", summary.balance > 0 ? "text-destructive" : "text-success")}>
              {formatAmount(summary.balance)}
            </p>
            <p className="text-[10px] text-muted-foreground">Balance</p>
          </CardContent>
        </Card>
      </div>

      {/* Fee Breakdown by type */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-display font-bold flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" /> Fee Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {feeRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No fee records found.</p>
          ) : (
            (() => {
              const byType: Record<string, { charged: number; paid: number }> = {};
              feeRecords.forEach(r => {
                const t = r.fee_type;
                if (!byType[t]) byType[t] = { charged: 0, paid: 0 };
                byType[t].charged += Number(r.amount_charged);
                byType[t].paid += Number(r.amount_paid);
              });
              return Object.entries(byType).map(([type, vals]) => (
                <div key={type} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50">
                  <span className="text-xs font-medium capitalize">{type}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{formatAmount(vals.charged)}</span>
                    <Badge variant="outline" className={cn("text-[10px]",
                      vals.charged - vals.paid > 0 ? "border-destructive/30 text-destructive" : "border-success/30 text-success"
                    )}>
                      {vals.charged - vals.paid > 0 ? `Bal: ${formatAmount(vals.charged - vals.paid)}` : 'Paid'}
                    </Badge>
                  </div>
                </div>
              ));
            })()
          )}
        </CardContent>
      </Card>

      {/* Payment History */}
      {payments.length > 0 && (
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-display font-bold flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-success" /> Payment History
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {payments.slice(0, 20).map(p => (
              <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50">
                <div>
                  <p className="text-xs font-medium capitalize">{p.fee_type}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {p.payment_date ? new Date(p.payment_date).toLocaleDateString() : '-'} · {p.payment_method}
                    {p.mpesa_reference ? ` · ${p.mpesa_reference}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <ArrowDownCircle className="h-3 w-3 text-success" />
                  <span className="text-xs font-bold text-success">{formatAmount(Number(p.amount_paid))}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
