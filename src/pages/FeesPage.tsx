import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Wallet, TrendingUp, AlertTriangle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState, useMemo } from 'react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const FEE_TYPES = ['tuition', 'transport', 'lunch', 'boarding', 'activity', 'uniform', 'books', 'other'];
const PAYMENT_METHODS = ['cash', 'mpesa', 'bank', 'cheque'];

export default function FeesPage() {
  const { user, schoolId } = useAuth();
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();

  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedTerm, setSelectedTerm] = useState('1');
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [formLearnerId, setFormLearnerId] = useState('');
  const [formFeeType, setFormFeeType] = useState('tuition');
  const [formCharged, setFormCharged] = useState('');
  const [formPaid, setFormPaid] = useState('');
  const [formMethod, setFormMethod] = useState('cash');
  const [formMpesaRef, setFormMpesaRef] = useState('');
  const [formDescription, setFormDescription] = useState('');

  const { data: learners = [] } = useQuery({
    queryKey: ['fee-learners', schoolId, selectedGrade],
    queryFn: async () => {
      let q = supabase.from('learners').select('*').eq('school_id', schoolId!).eq('is_active', true);
      if (selectedGrade) q = q.eq('grade', selectedGrade);
      const { data } = await q.order('full_name');
      return data || [];
    },
    enabled: !!schoolId,
  });

  const { data: feeRecords = [] } = useQuery({
    queryKey: ['fee-records', schoolId, selectedTerm, selectedYear, selectedGrade],
    queryFn: async () => {
      let q = supabase.from('fee_records').select('*, learners!fee_records_learner_id_fkey(full_name, admission_number, grade, stream)')
        .eq('school_id', schoolId!)
        .eq('term', Number(selectedTerm))
        .eq('year', Number(selectedYear));
      const { data } = await q.order('created_at', { ascending: false });
      // Filter by grade client-side if needed
      if (selectedGrade) {
        return (data || []).filter(r => (r as any).learners?.grade === selectedGrade);
      }
      return data || [];
    },
    enabled: !!schoolId,
  });

  const summary = useMemo(() => {
    const totalCharged = feeRecords.reduce((s, r) => s + Number(r.amount_charged), 0);
    const totalPaid = feeRecords.reduce((s, r) => s + Number(r.amount_paid), 0);
    const balance = totalCharged - totalPaid;
    const defaulters = new Set<string>();
    const byLearner: Record<string, { charged: number; paid: number }> = {};
    feeRecords.forEach(r => {
      if (!byLearner[r.learner_id]) byLearner[r.learner_id] = { charged: 0, paid: 0 };
      byLearner[r.learner_id].charged += Number(r.amount_charged);
      byLearner[r.learner_id].paid += Number(r.amount_paid);
    });
    Object.entries(byLearner).forEach(([id, v]) => { if (v.charged - v.paid > 0) defaulters.add(id); });
    return { totalCharged, totalPaid, balance, defaulters: defaulters.size };
  }, [feeRecords]);

  const addFeeMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('fee_records').insert({
        learner_id: formLearnerId,
        school_id: schoolId!,
        term: Number(selectedTerm),
        year: Number(selectedYear),
        fee_type: formFeeType,
        amount_charged: Number(formCharged) || 0,
        amount_paid: Number(formPaid) || 0,
        payment_date: Number(formPaid) > 0 ? new Date().toISOString().split('T')[0] : null,
        payment_method: formMethod,
        mpesa_reference: formMpesaRef || null,
        description: formDescription || null,
        recorded_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fee-records'] });
      toast({ title: 'Fee record added' });
      setDialogOpen(false);
      setFormCharged(''); setFormPaid(''); setFormMpesaRef(''); setFormDescription('');
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const filteredRecords = useMemo(() => {
    if (!search) return feeRecords;
    const s = search.toLowerCase();
    return feeRecords.filter(r => {
      const name = (r as any).learners?.full_name || '';
      const adm = (r as any).learners?.admission_number || '';
      return name.toLowerCase().includes(s) || adm.toLowerCase().includes(s);
    });
  }, [feeRecords, search]);

  const fmt = (n: number) => `KES ${n.toLocaleString()}`;

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-display font-bold">Fee Management</h1>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> Add Record</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Add Fee Record</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Select value={formLearnerId} onValueChange={setFormLearnerId}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select Learner" /></SelectTrigger>
                  <SelectContent>
                    {learners.map(l => (
                      <SelectItem key={l.id} value={l.id}>{l.full_name} ({l.admission_number})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={formFeeType} onValueChange={setFormFeeType}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FEE_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" placeholder="Amount Charged" value={formCharged} onChange={e => setFormCharged(e.target.value)} className="h-9 text-xs" />
                  <Input type="number" placeholder="Amount Paid" value={formPaid} onChange={e => setFormPaid(e.target.value)} className="h-9 text-xs" />
                </div>
                <Select value={formMethod} onValueChange={setFormMethod}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}
                  </SelectContent>
                </Select>
                {formMethod === 'mpesa' && (
                  <Input placeholder="M-Pesa Reference" value={formMpesaRef} onChange={e => setFormMpesaRef(e.target.value)} className="h-9 text-xs" />
                )}
                <Input placeholder="Description (optional)" value={formDescription} onChange={e => setFormDescription(e.target.value)} className="h-9 text-xs" />
                <Button onClick={() => addFeeMutation.mutate()} disabled={!formLearnerId || addFeeMutation.isPending} className="w-full">
                  {addFeeMutation.isPending ? 'Saving...' : 'Save Record'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-4 gap-2">
          <Select value={selectedGrade} onValueChange={setSelectedGrade}>
            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="All Grades" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Grades</SelectItem>
              {['1','2','3','4','5','6','7','8','9'].map(g => <SelectItem key={g} value={g}>Grade {g}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedTerm} onValueChange={setSelectedTerm}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[1,2,3].map(t => <SelectItem key={t} value={String(t)}>Term {t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[currentYear, currentYear-1].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-7 h-9 text-xs" />
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Total Fees', value: fmt(summary.totalCharged), icon: Wallet, color: 'text-foreground' },
            { label: 'Collected', value: fmt(summary.totalPaid), icon: TrendingUp, color: 'text-success' },
            { label: 'Balance', value: fmt(summary.balance), icon: Wallet, color: 'text-destructive' },
            { label: 'Defaulters', value: summary.defaulters, icon: AlertTriangle, color: 'text-warning' },
          ].map(c => (
            <Card key={c.label} className="shadow-card">
              <CardContent className="p-3 text-center">
                <c.icon className={cn("h-4 w-4 mx-auto mb-1", c.color)} />
                <p className={cn("text-sm font-bold", c.color)}>{c.value}</p>
                <p className="text-[10px] text-muted-foreground">{c.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Records Table */}
        <Card className="shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Learner</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs text-right">Charged</TableHead>
                  <TableHead className="text-xs text-right">Paid</TableHead>
                  <TableHead className="text-xs text-right">Balance</TableHead>
                  <TableHead className="text-xs">Method</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No records</TableCell></TableRow>
                ) : filteredRecords.map(r => {
                  const bal = Number(r.amount_charged) - Number(r.amount_paid);
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs font-medium">
                        {(r as any).learners?.full_name || '-'}
                        <br /><span className="text-muted-foreground">{(r as any).learners?.admission_number}</span>
                      </TableCell>
                      <TableCell className="text-xs capitalize">{r.fee_type}</TableCell>
                      <TableCell className="text-xs text-right">{Number(r.amount_charged).toLocaleString()}</TableCell>
                      <TableCell className="text-xs text-right text-success">{Number(r.amount_paid).toLocaleString()}</TableCell>
                      <TableCell className={cn("text-xs text-right font-bold", bal > 0 ? "text-destructive" : "text-success")}>
                        {bal.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs capitalize">
                        {r.payment_method}
                        {r.mpesa_reference && <span className="text-muted-foreground ml-1">({r.mpesa_reference})</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
