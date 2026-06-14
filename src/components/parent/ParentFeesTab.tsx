import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wallet, CreditCard, ArrowDownCircle, FileDown, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMemo } from 'react';
import { generateFeeStatementPDF } from '@/lib/fee-pdf';
import { toast } from '@/hooks/use-toast';
import { chargeTotals, isCharge, isCollectionReceiptRow, isPaymentLedger } from '@/lib/fee-row-utils';

interface Props {
  child: { id: string; full_name: string };
}

export default function ParentFeesTab({ child }: Props) {
  const { data: feeRecords = [] } = useQuery({
    queryKey: ['parent-fees', child.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('fee_records')
        .select('*, learners!fee_records_learner_id_fkey(full_name, admission_number, grade, stream, school_id)')
        .eq('learner_id', child.id)
        .is('voided_at', null)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const learnerInfo = (feeRecords[0] as any)?.learners;
  const schoolId = learnerInfo?.school_id;

  const { data: schoolMeta } = useQuery({
    queryKey: ['parent-fees-school', schoolId],
    queryFn: async () => {
      if (!schoolId) return null;
      const { data: settings } = await supabase.from('school_settings').select('key,value').eq('school_id', schoolId);
      const { data: school } = await supabase.from('schools').select('school_name,contact_phone').eq('id', schoolId).maybeSingle();
      const m: Record<string, string> = {};
      (settings || []).forEach((r: any) => { m[r.key] = r.value; });
      return {
        name: m.school_name || school?.school_name || 'School',
        address: m.school_address, phone: m.school_phone || school?.contact_phone, email: m.school_email,
        logo: m.school_logo_url || null, paybill: m.mpesa_paybill, account: m.mpesa_account,
      };
    },
    enabled: !!schoolId,
  });

  const summary = useMemo(() => {
    const totals = chargeTotals(feeRecords as any[]);
    return { totalCharged: totals.charged, totalPaid: totals.paid, balance: totals.balance };
  }, [feeRecords]);

  const chargeRows = useMemo(() => (feeRecords as any[]).filter(isCharge), [feeRecords]);
  const payments = useMemo(() => (feeRecords as any[]).filter(r => Number(r.amount_paid) > 0 && isCollectionReceiptRow(r)), [feeRecords]);

  const formatAmount = (n: number) => `KES ${n.toLocaleString()}`;

  const downloadStatement = () => {
    if (!learnerInfo) return;
    const sorted = [...feeRecords].reverse();
    const hasPaymentLedgerRows = sorted.some(isPaymentLedger);
    let running = 0;
    const rows = sorted.map((r: any) => {
      const charged = isPaymentLedger(r) ? 0 : Number(r.amount_charged);
      const paid = isPaymentLedger(r) || !hasPaymentLedgerRows || r.receipt_number ? Number(r.amount_paid) : 0;
      running += charged - paid;
      return {
        date: new Date(r.payment_date || r.created_at).toLocaleDateString(),
        description: isPaymentLedger(r)
          ? `Payment ${r.payment_method?.toUpperCase() || ''}${r.receipt_number ? ' · ' + r.receipt_number : ''}`
          : `T${r.term}/${r.year} ${r.fee_type}${r.description ? ' — ' + r.description : ''}`,
        charged, paid, balance: running, receipt: r.receipt_number,
      };
    });
    generateFeeStatementPDF({
      learnerName: learnerInfo.full_name, admissionNumber: learnerInfo.admission_number,
      grade: learnerInfo.grade, stream: learnerInfo.stream,
      rows, totalCharged: summary.totalCharged, totalPaid: summary.totalPaid, outstanding: summary.balance,
      generatedAt: new Date().toLocaleString(),
      schoolName: schoolMeta?.name || 'School',
      schoolAddress: schoolMeta?.address, schoolPhone: schoolMeta?.phone, schoolEmail: schoolMeta?.email,
      logoBase64: schoolMeta?.logo,
    });
  };

  const showPayInstructions = () => {
    const lines = [
      `M-Pesa Payment Instructions for ${child.full_name}:`,
      schoolMeta?.paybill ? `Paybill: ${schoolMeta.paybill}` : 'Paybill: (Contact school)',
      schoolMeta?.account ? `Account: ${schoolMeta.account} / ${learnerInfo?.admission_number || ''}` : `Account: ${learnerInfo?.admission_number || 'Admission #'}`,
      `Amount: ${formatAmount(summary.balance)}`,
      `After payment, share the M-Pesa SMS with the school office.`,
    ];
    toast({ title: 'How to Pay', description: lines.join('\n') });
  };

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      {summary.balance > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" variant="outline" onClick={downloadStatement} className="text-xs"><FileDown className="h-3.5 w-3.5 mr-1" />Statement</Button>
          <Button size="sm" onClick={showPayInstructions} className="text-xs"><Smartphone className="h-3.5 w-3.5 mr-1" />Pay via M-Pesa</Button>
        </div>
      )}
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
          {chargeRows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No fee records found.</p>
          ) : (
            (() => {
              const byType: Record<string, { charged: number; paid: number }> = {};
              chargeRows.forEach(r => {
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
