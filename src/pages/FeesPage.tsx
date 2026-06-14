import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus, Search, Wallet, TrendingUp, AlertTriangle, FileDown, Receipt,
  Layers, Users, MessageCircle, FileSpreadsheet, Edit, Trash2, Ban, CheckCircle, Eye
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState, useMemo, Fragment } from 'react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useSchoolGrades } from '@/hooks/use-school-grades';
import {
  generateFeeReceiptPDF, generateFeeStatementPDF, generateCollectionReportPDF,
  exportCollectionReportXLSX, type CollectionReportRow,
} from '@/lib/fee-pdf';
import { buildWaMeLink, normalizeWhatsAppPhone } from '@/lib/wa-link';
import LearnerAccountsTab from '@/components/fees/LearnerAccountsTab';
import RecordPaymentTab from '@/components/fees/RecordPaymentTab';
import FinanceDashboardTab from '@/components/fees/FinanceDashboardTab';
import { BarChart3, CreditCard, UserCheck } from 'lucide-react';
import { z } from 'zod';
import { isCharge, isPaymentLedger } from '@/lib/fee-row-utils';

const FEE_TYPES = ['tuition', 'transport', 'lunch', 'boarding', 'activity', 'uniform', 'books', 'other'];
const PAYMENT_METHODS = ['cash', 'mpesa', 'bank', 'cheque'];

const recordSchema = z.object({
  learner_id: z.string().uuid('Select a learner'),
  fee_type: z.string().min(1),
  amount_charged: z.number().min(0, 'Charged must be ≥ 0').max(10_000_000),
  amount_paid: z.number().min(0, 'Paid must be ≥ 0').max(10_000_000),
  payment_method: z.string().min(1),
  mpesa_reference: z.string().max(50).optional().nullable(),
  description: z.string().max(255).optional().nullable(),
}).refine(v => v.amount_charged > 0 || v.amount_paid > 0, {
  message: 'Enter a charge or a payment',
  path: ['amount_charged'],
});

const structureSchema = z.object({
  grade: z.string().min(1, 'Grade required'),
  fee_type: z.string().min(1),
  amount: z.number().min(0).max(10_000_000),
  description: z.string().max(255).optional().nullable(),
});

const fmt = (n: number) => `KES ${Number(n || 0).toLocaleString()}`;

export default function FeesPage() {
  const { user, schoolId } = useAuth();
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();
  const grades = useSchoolGrades();

  const [tab, setTab] = useState('accounts');
  const [paymentLearnerId, setPaymentLearnerId] = useState<string | null>(null);
  const [selectedGrade, setSelectedGrade] = useState('all');
  const [selectedTerm, setSelectedTerm] = useState('1');
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [search, setSearch] = useState('');

  // ---------- School + Learners ----------
  const { data: schoolSettings = {} } = useQuery({
    queryKey: ['fee-school-settings', schoolId],
    queryFn: async () => {
      if (!schoolId) return {};
      const { data } = await supabase.from('school_settings').select('key,value').eq('school_id', schoolId);
      const m: Record<string, string> = {};
      (data || []).forEach((r: any) => { m[r.key] = r.value; });
      return m;
    },
    enabled: !!schoolId,
  });

  const { data: school } = useQuery({
    queryKey: ['fee-school-name', schoolId],
    queryFn: async () => {
      if (!schoolId) return null;
      const { data } = await supabase.from('schools').select('school_name').eq('id', schoolId).maybeSingle();
      return data;
    },
    enabled: !!schoolId,
  });

  const schoolMeta = useMemo(() => ({
    name: schoolSettings.school_name || school?.school_name || 'School',
    motto: schoolSettings.school_motto,
    address: schoolSettings.school_address,
    phone: schoolSettings.school_phone,
    email: schoolSettings.school_email,
    logo: schoolSettings.school_logo_url || null,
  }), [schoolSettings, school]);

  const { data: learners = [] } = useQuery({
    queryKey: ['fee-learners', schoolId, selectedGrade],
    queryFn: async () => {
      let q = supabase.from('learners').select('*').eq('school_id', schoolId!).eq('is_active', true);
      if (selectedGrade !== 'all') q = q.eq('grade', selectedGrade);
      const { data } = await q.order('full_name');
      return data || [];
    },
    enabled: !!schoolId,
  });

  // ---------- Fee records (term-scoped) ----------
  const { data: feeRecords = [] } = useQuery({
    queryKey: ['fee-records', schoolId, selectedTerm, selectedYear, selectedGrade],
    queryFn: async () => {
      const q = supabase.from('fee_records')
        .select('*, learners!fee_records_learner_id_fkey(full_name, admission_number, grade, stream, parent_name, parent_phone)')
        .eq('school_id', schoolId!)
        .eq('term', Number(selectedTerm))
        .eq('year', Number(selectedYear))
        .order('created_at', { ascending: false });
      const { data } = await q;
      const rows = (data || []) as any[];
      return selectedGrade !== 'all' ? rows.filter(r => r.learners?.grade === selectedGrade) : rows;
    },
    enabled: !!schoolId,
  });

  const summary = useMemo(() => {
    const live = feeRecords.filter(r => !r.voided_at);
    const totalCharged = live.reduce((s, r) => s + Number(r.amount_charged), 0);
    const totalPaid = live.reduce((s, r) => s + Number(r.amount_paid), 0);
    const balance = totalCharged - totalPaid;
    const byLearner: Record<string, number> = {};
    live.forEach(r => { byLearner[r.learner_id] = (byLearner[r.learner_id] || 0) + (Number(r.amount_charged) - Number(r.amount_paid)); });
    const defaulters = Object.values(byLearner).filter(v => v > 0).length;
    return { totalCharged, totalPaid, balance, defaulters };
  }, [feeRecords]);

  // ---------- Add/Edit Record ----------
  const [recordDialog, setRecordDialog] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [recordForm, setRecordForm] = useState({
    learner_id: '', fee_type: 'tuition', amount_charged: '', amount_paid: '',
    payment_method: 'cash', mpesa_reference: '', description: '',
  });

  const openNewRecord = () => {
    setEditingRecord(null);
    setRecordForm({ learner_id: '', fee_type: 'tuition', amount_charged: '', amount_paid: '', payment_method: 'cash', mpesa_reference: '', description: '' });
    setRecordDialog(true);
  };
  const openEditRecord = (r: any) => {
    setEditingRecord(r);
    setRecordForm({
      learner_id: r.learner_id, fee_type: r.fee_type,
      amount_charged: String(r.amount_charged), amount_paid: String(r.amount_paid),
      payment_method: r.payment_method || 'cash', mpesa_reference: r.mpesa_reference || '',
      description: r.description || '',
    });
    setRecordDialog(true);
  };

  const upsertRecord = useMutation({
    mutationFn: async () => {
      const parsed = recordSchema.safeParse({
        learner_id: recordForm.learner_id,
        fee_type: recordForm.fee_type,
        amount_charged: Number(recordForm.amount_charged) || 0,
        amount_paid: Number(recordForm.amount_paid) || 0,
        payment_method: recordForm.payment_method,
        mpesa_reference: recordForm.mpesa_reference || null,
        description: recordForm.description || null,
      });
      if (!parsed.success) throw new Error(Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] || 'Invalid input');
      const v = parsed.data;

      // Overpayment guard: total paid (across all live records for this learner)
      // must not exceed total charged unless explicitly confirmed as a credit.
      const { data: ledger } = await supabase.from('fee_records')
        .select('amount_charged, amount_paid, id')
        .eq('learner_id', v.learner_id).is('voided_at', null);
      const otherCharged = (ledger || []).filter((r: any) => r.id !== editingRecord?.id).reduce((s: number, r: any) => s + Number(r.amount_charged), 0);
      const otherPaid = (ledger || []).filter((r: any) => r.id !== editingRecord?.id).reduce((s: number, r: any) => s + Number(r.amount_paid), 0);
      const newTotalCharged = otherCharged + v.amount_charged;
      const newTotalPaid = otherPaid + v.amount_paid;
      if (newTotalPaid > newTotalCharged) {
        const overage = newTotalPaid - newTotalCharged;
        const ok = window.confirm(`This payment exceeds the learner's total charges by KES ${overage.toLocaleString()}. Save as credit/overpayment?`);
        if (!ok) throw new Error('Cancelled — overpayment not confirmed');
      }

      if (editingRecord) {
        const { error } = await supabase.from('fee_records').update({
          fee_type: v.fee_type, amount_charged: v.amount_charged, amount_paid: v.amount_paid,
          payment_method: v.payment_method, mpesa_reference: v.mpesa_reference, description: v.description,
          payment_date: v.amount_paid > 0 ? new Date().toISOString().split('T')[0] : null,
        }).eq('id', editingRecord.id);
        if (error) throw error;
        return { record: editingRecord, isNew: false };
      } else {
        let receiptNumber: string | null = null;
        if (v.amount_paid > 0) {
          const { data: rn } = await supabase.rpc('generate_receipt_number', { _school_id: schoolId! });
          receiptNumber = rn as string;
        }
        const { data: inserted, error } = await supabase.from('fee_records').insert({
          learner_id: v.learner_id, school_id: schoolId!, term: Number(selectedTerm), year: Number(selectedYear),
          fee_type: v.fee_type, amount_charged: v.amount_charged, amount_paid: v.amount_paid,
          payment_date: v.amount_paid > 0 ? new Date().toISOString().split('T')[0] : null,
          payment_method: v.payment_method, mpesa_reference: v.mpesa_reference, description: v.description,
          receipt_number: receiptNumber, recorded_by: user!.id,
        }).select('*, learners!fee_records_learner_id_fkey(full_name, admission_number, grade, stream)').single();
        if (error) throw error;
        return { record: inserted, isNew: true };
      }
    },
    onSuccess: ({ record, isNew }: any) => {
      queryClient.invalidateQueries({ queryKey: ['fee-records'] });
      setRecordDialog(false);
      toast({ title: editingRecord ? 'Record updated' : 'Record added' });
      if (isNew && Number(record.amount_paid) > 0 && record.receipt_number) {
        // Auto-print receipt
        printReceipt(record);
      }
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const voidRecord = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase.from('fee_records').update({
        voided_at: new Date().toISOString(), voided_by: user!.id, void_reason: reason,
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['fee-records'] }); toast({ title: 'Record voided' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteRecord = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fee_records').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['fee-records'] }); toast({ title: 'Record deleted' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // ---------- Receipt printing ----------
  const printReceipt = async (r: any) => {
    if (!r.receipt_number) {
      toast({ title: 'No receipt', description: 'This record has no payment.', variant: 'destructive' });
      return;
    }
    // Compute term + total balance for this learner, plus full breakdown.
    // IMPORTANT: exclude pure payment-ledger rows from charged/paid sums —
    // those rows are receipts; the FIFO allocator already incremented each
    // charge's amount_paid, so summing both double-counts every payment.
    const { data: all } = await supabase.from('fee_records').select('*').eq('learner_id', r.learner_id).is('voided_at', null);
    const allRows = (all || []) as any[];
    const chargeRows = allRows.filter(isCharge);
    const termRows = chargeRows.filter(x => x.term === r.term && x.year === r.year);
    const totalBal = chargeRows.reduce((s, x) => s + (Number(x.amount_charged) - Number(x.amount_paid)), 0);

    // Pull the full fee STRUCTURE so EVERY charged component appears on the
    // receipt — even ones the learner has not paid against yet.
    const learnerGrade = r.learners?.grade;
    const { data: struct } = learnerGrade
      ? await supabase.from('fee_structures').select('fee_type, amount')
          .eq('school_id', schoolId!).eq('grade', learnerGrade)
          .eq('term', r.term).eq('year', r.year)
      : { data: [] as any[] };

    const byType: Record<string, { charged: number; paid: number }> = {};
    (struct || []).forEach((s: any) => {
      const t = String(s.fee_type || 'other');
      if (!byType[t]) byType[t] = { charged: 0, paid: 0 };
      byType[t].charged += Number(s.amount) || 0;
    });
    termRows.forEach(x => {
      const t = String(x.fee_type || 'other');
      if (!byType[t]) byType[t] = { charged: 0, paid: 0 };
      if (!(struct || []).some((s: any) => String(s.fee_type) === t)) {
        byType[t].charged += Number(x.amount_charged) || 0;
      }
      byType[t].paid += Number(x.amount_paid) || 0;
    });
    const breakdown = Object.entries(byType).map(([feeType, v]) => ({ feeType, ...v }));
    const termCharged = breakdown.reduce((s, b) => s + b.charged, 0);
    const termPaid = breakdown.reduce((s, b) => s + b.paid, 0);
    const termBal = termCharged - termPaid;

    generateFeeReceiptPDF({
      receiptNumber: r.receipt_number,
      date: new Date(r.payment_date || r.created_at).toLocaleDateString(),
      learnerName: r.learners?.full_name || '-',
      admissionNumber: r.learners?.admission_number || '-',
      grade: r.learners?.grade || '-',
      stream: r.learners?.stream || '-',
      feeType: r.fee_type,
      amountPaid: Number(r.amount_paid),
      paymentMethod: r.payment_method,
      mpesaReference: r.mpesa_reference,
      description: r.description,
      termBalance: termBal,
      totalBalance: totalBal,
      receivedBy: user?.email || 'Cashier',
      schoolName: schoolMeta.name, schoolAddress: schoolMeta.address, schoolPhone: schoolMeta.phone,
      schoolEmail: schoolMeta.email, schoolMotto: schoolMeta.motto, logoBase64: schoolMeta.logo,
      term: r.term, year: r.year,
      breakdown, termCharged, termPaid,
    });
  };

  // ---------- Statement ----------
  const printStatement = async (learner: any) => {
    const { data: all } = await supabase.from('fee_records').select('*').eq('learner_id', learner.id).order('created_at');
    const live = ((all || []) as any[]).filter(r => !r.voided_at);
    let running = 0;
    const stRows: any[] = [];
    live.forEach(r => {
      if (isPaymentLedger(r)) {
        running -= Number(r.amount_paid);
        stRows.push({
          date: new Date(r.payment_date || r.created_at).toLocaleDateString(),
          description: `Payment ${r.payment_method?.toUpperCase() || ''}${r.receipt_number ? ' · '+r.receipt_number : ''}`,
          charged: 0, paid: Number(r.amount_paid), balance: running, receipt: r.receipt_number,
        });
      } else {
        const charged = Number(r.amount_charged);
        const paid = Number(r.amount_paid);
        running += charged - paid;
        stRows.push({
          date: new Date(r.payment_date || r.created_at).toLocaleDateString(),
          description: `T${r.term}/${r.year} ${r.fee_type}${r.description ? ' — ' + r.description : ''}`,
          charged, paid, balance: running, receipt: r.receipt_number,
        });
      }
    });
    const chargeRows = live.filter(isCharge);
    const totalCharged = chargeRows.reduce((s, r) => s + Number(r.amount_charged), 0);
    const totalPaid = chargeRows.reduce((s, r) => s + Number(r.amount_paid), 0);
    generateFeeStatementPDF({
      learnerName: learner.full_name, admissionNumber: learner.admission_number,
      grade: learner.grade, stream: learner.stream,
      rows: stRows, totalCharged, totalPaid, outstanding: totalCharged - totalPaid,
      generatedAt: new Date().toLocaleString(),
      schoolName: schoolMeta.name, schoolAddress: schoolMeta.address, schoolPhone: schoolMeta.phone,
      schoolEmail: schoolMeta.email, logoBase64: schoolMeta.logo,
    });
  };

  // ---------- Fee Structures ----------
  const [structureDialog, setStructureDialog] = useState(false);
  const [structureForm, setStructureForm] = useState({ grade: '', fee_type: 'tuition', amount: '', description: '' });

  const { data: structures = [] } = useQuery({
    queryKey: ['fee-structures', schoolId, selectedTerm, selectedYear],
    queryFn: async () => {
      const { data } = await supabase.from('fee_structures').select('*')
        .eq('school_id', schoolId!).eq('term', Number(selectedTerm)).eq('year', Number(selectedYear))
        .eq('is_active', true).order('grade').order('fee_type');
      return data || [];
    },
    enabled: !!schoolId,
  });

  const addStructure = useMutation({
    mutationFn: async () => {
      const parsed = structureSchema.safeParse({
        grade: structureForm.grade, fee_type: structureForm.fee_type,
        amount: Number(structureForm.amount) || 0,
        description: structureForm.description || null,
      });
      if (!parsed.success) throw new Error(Object.values(parsed.error.flatten().fieldErrors)[0]?.[0] || 'Invalid');
      const v = parsed.data;
      const { error } = await supabase.from('fee_structures').insert({
        school_id: schoolId!, grade: v.grade, term: Number(selectedTerm), year: Number(selectedYear),
        fee_type: v.fee_type, amount: v.amount, description: v.description, created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fee-structures'] });
      setStructureDialog(false);
      setStructureForm({ grade: '', fee_type: 'tuition', amount: '', description: '' });
      toast({ title: 'Fee structure added' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteStructure = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fee_structures').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['fee-structures'] }); toast({ title: 'Removed' }); },
  });

  // ---------- Bulk Structure (multiple components for a grade) ----------
  const [bulkStructureDialog, setBulkStructureDialog] = useState(false);
  const [bulkStructureGrade, setBulkStructureGrade] = useState('');
  const [bulkComponents, setBulkComponents] = useState<{ fee_type: string; amount: string; description: string }[]>([
    { fee_type: 'tuition', amount: '', description: '' },
  ]);

  const openBulkStructure = () => {
    setBulkStructureGrade('');
    setBulkComponents([{ fee_type: 'tuition', amount: '', description: '' }]);
    setBulkStructureDialog(true);
  };

  const addBulkStructure = useMutation({
    mutationFn: async () => {
      if (!bulkStructureGrade) throw new Error('Select a grade');
      const rows = bulkComponents
        .filter(c => c.fee_type && Number(c.amount) > 0)
        .map(c => ({
          school_id: schoolId!, grade: bulkStructureGrade,
          term: Number(selectedTerm), year: Number(selectedYear),
          fee_type: c.fee_type, amount: Number(c.amount),
          description: c.description || null, created_by: user!.id,
        }));
      if (rows.length === 0) throw new Error('Add at least one component with an amount');
      // Skip duplicates (same grade/term/year/fee_type already exists)
      const existing = new Set(structures.filter((s: any) => s.grade === bulkStructureGrade).map((s: any) => s.fee_type));
      const toInsert = rows.filter(r => !existing.has(r.fee_type));
      if (toInsert.length === 0) throw new Error('All these components already exist for this grade');
      const { error } = await supabase.from('fee_structures').insert(toInsert);
      if (error) throw error;
      return toInsert.length;
    },
    onSuccess: (n: any) => {
      queryClient.invalidateQueries({ queryKey: ['fee-structures'] });
      setBulkStructureDialog(false);
      toast({ title: `Added ${n} fee component${n === 1 ? '' : 's'}` });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // Consolidated structures grouped by grade
  const consolidatedStructures = useMemo(() => {
    const map = new Map<string, { grade: string; total: number; items: any[] }>();
    (structures as any[]).forEach(s => {
      const k = s.grade;
      const cur = map.get(k) || { grade: k, total: 0, items: [] };
      cur.total += Number(s.amount) || 0;
      cur.items.push(s);
      map.set(k, cur);
    });
    return Array.from(map.values()).sort((a, b) => a.grade.localeCompare(b.grade));
  }, [structures]);
  const [expandedGrades, setExpandedGrades] = useState<Set<string>>(new Set());
  const toggleGrade = (g: string) => {
    const n = new Set(expandedGrades);
    n.has(g) ? n.delete(g) : n.add(g);
    setExpandedGrades(n);
  };

  // ---------- Bulk billing ----------
  const [billGrade, setBillGrade] = useState('all');
  const billRun = useMutation({
    mutationFn: async () => {
      // Pull active structures for term/year (optionally filter to one grade)
      let q = supabase.from('fee_structures').select('*')
        .eq('school_id', schoolId!).eq('term', Number(selectedTerm)).eq('year', Number(selectedYear)).eq('is_active', true);
      if (billGrade !== 'all') q = q.eq('grade', billGrade);
      const { data: structs } = await q;
      if (!structs || structs.length === 0) throw new Error('No fee structures defined for this term/year');

      const grades = Array.from(new Set(structs.map((s: any) => s.grade)));
      const { data: lns } = await supabase.from('learners').select('id, grade')
        .eq('school_id', schoolId!).eq('is_active', true).in('grade', grades);
      if (!lns || lns.length === 0) throw new Error('No active learners found for these grades');

      // Existing charges for term: skip if learner already has the same fee_type charged
      const { data: existing } = await supabase.from('fee_records').select('learner_id, fee_type')
        .eq('school_id', schoolId!).eq('term', Number(selectedTerm)).eq('year', Number(selectedYear)).is('voided_at', null);
      const existingKey = new Set((existing || []).map((e: any) => `${e.learner_id}:${e.fee_type}`));

      const inserts: any[] = [];
      for (const ln of lns) {
        const items = structs.filter((s: any) => s.grade === ln.grade);
        for (const it of items) {
          const k = `${ln.id}:${it.fee_type}`;
          if (existingKey.has(k)) continue;
          inserts.push({
            learner_id: ln.id, school_id: schoolId!, term: Number(selectedTerm), year: Number(selectedYear),
            fee_type: it.fee_type, amount_charged: Number(it.amount), amount_paid: 0,
            description: it.description, recorded_by: user!.id, payment_method: 'cash',
          });
        }
      }
      if (inserts.length === 0) return { skipped: true, count: 0 };
      // Chunked insert
      const chunkSize = 500;
      for (let i = 0; i < inserts.length; i += chunkSize) {
        const { error } = await supabase.from('fee_records').insert(inserts.slice(i, i + chunkSize));
        if (error) throw error;
      }
      return { skipped: false, count: inserts.length };
    },
    onSuccess: (r: any) => {
      queryClient.invalidateQueries({ queryKey: ['fee-records'] });
      toast({ title: r.skipped ? 'No new charges (everyone already billed)' : `Billed ${r.count} new charges` });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // ---------- Defaulters ----------
  const defaulters = useMemo(() => {
    const map = new Map<string, { learner: any; charged: number; paid: number; bal: number }>();
    feeRecords.filter(r => !r.voided_at).forEach((r: any) => {
      const k = r.learner_id;
      const cur = map.get(k) || { learner: r.learners, charged: 0, paid: 0, bal: 0 };
      cur.charged += Number(r.amount_charged);
      cur.paid += Number(r.amount_paid);
      cur.bal = cur.charged - cur.paid;
      map.set(k, cur);
    });
    return Array.from(map.values()).filter(v => v.bal > 0).sort((a, b) => b.bal - a.bal);
  }, [feeRecords]);

  const sendDefaulterReminder = (d: any) => {
    const phone = d.learner?.parent_phone;
    if (!phone || !normalizeWhatsAppPhone(phone)) {
      toast({ title: 'No valid phone', description: 'Parent phone is missing or invalid.', variant: 'destructive' });
      return;
    }
    const msg = `Dear ${d.learner.parent_name || 'Parent'},\n\nThis is a reminder that ${d.learner.full_name} (Adm ${d.learner.admission_number}, Grade ${d.learner.grade} ${d.learner.stream}) has an outstanding fee balance of ${fmt(d.bal)} for Term ${selectedTerm}, ${selectedYear}.\n\nKindly clear at your earliest convenience.\n\n- ${schoolMeta.name}`;
    const url = buildWaMeLink(phone, msg);
    if (url) window.open(url, '_blank');
  };

  // ---------- Filtered records ----------
  const filteredRecords = useMemo(() => {
    if (!search) return feeRecords;
    const s = search.toLowerCase();
    return feeRecords.filter((r: any) => {
      const name = r.learners?.full_name || '';
      const adm = r.learners?.admission_number || '';
      return name.toLowerCase().includes(s) || adm.toLowerCase().includes(s) || (r.receipt_number || '').toLowerCase().includes(s);
    });
  }, [feeRecords, search]);

  // ---------- Reports export ----------
  const exportCollections = (kind: 'pdf' | 'xlsx') => {
    const live = feeRecords.filter((r: any) => !r.voided_at && Number(r.amount_paid) > 0);
    if (live.length === 0) { toast({ title: 'No payments to export' }); return; }
    const rows: CollectionReportRow[] = live.map((r: any) => ({
      date: new Date(r.payment_date || r.created_at).toLocaleDateString(),
      receipt: r.receipt_number || '-',
      learner: r.learners?.full_name || '-',
      admission: r.learners?.admission_number || '-',
      grade: r.learners?.grade || '-',
      stream: r.learners?.stream || '',
      feeType: r.fee_type, method: r.payment_method, reference: r.mpesa_reference || '',
      amount: Number(r.amount_paid),
    }));
    const totals = {
      byMethod: {} as Record<string, number>, byType: {} as Record<string, number>, grandTotal: 0,
    };
    rows.forEach(r => {
      totals.byMethod[r.method] = (totals.byMethod[r.method] || 0) + r.amount;
      totals.byType[r.feeType] = (totals.byType[r.feeType] || 0) + r.amount;
      totals.grandTotal += r.amount;
    });
    if (kind === 'pdf') {
      generateCollectionReportPDF({
        rows, totals,
        title: `Fee Collections — Term ${selectedTerm}, ${selectedYear}`,
        periodLabel: selectedGrade !== 'all' ? `Grade ${selectedGrade}` : 'All Grades',
        schoolName: schoolMeta.name, schoolAddress: schoolMeta.address,
        schoolPhone: schoolMeta.phone, schoolEmail: schoolMeta.email, logoBase64: schoolMeta.logo,
      });
    } else {
      exportCollectionReportXLSX(rows, `Collections-T${selectedTerm}-${selectedYear}.xlsx`);
    }
  };

  // ---------- Void dialog ----------
  const [voidTarget, setVoidTarget] = useState<any>(null);
  const [voidReason, setVoidReason] = useState('');

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xl md:text-2xl font-display font-bold">Fee Management</h1>
            <p className="text-xs text-muted-foreground">Structures, billing, payments, receipts and reports</p>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Select value={selectedGrade} onValueChange={setSelectedGrade}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Grades</SelectItem>
              {grades.map(g => <SelectItem key={g} value={g}>Grade {g}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedTerm} onValueChange={setSelectedTerm}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{[1,2,3].map(t => <SelectItem key={t} value={String(t)}>Term {t}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{[currentYear+1, currentYear, currentYear-1, currentYear-2].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search name/adm/receipt..." value={search} onChange={e => setSearch(e.target.value)} className="pl-7 h-9 text-xs" />
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[
            { label: 'Billed', value: fmt(summary.totalCharged), icon: Wallet, color: 'text-foreground' },
            { label: 'Collected', value: fmt(summary.totalPaid), icon: TrendingUp, color: 'text-success' },
            { label: 'Outstanding', value: fmt(summary.balance), icon: Wallet, color: 'text-destructive' },
            { label: 'Defaulters', value: summary.defaulters, icon: AlertTriangle, color: 'text-warning' },
          ].map(c => (
            <Card key={c.label}><CardContent className="p-3 text-center">
              <c.icon className={cn('h-4 w-4 mx-auto mb-1', c.color)} />
              <p className={cn('text-base md:text-lg font-bold', c.color)}>{c.value}</p>
              <p className="text-[10px] text-muted-foreground">{c.label}</p>
            </CardContent></Card>
          ))}
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid grid-cols-4 md:grid-cols-8 w-full h-auto">
            <TabsTrigger value="accounts" className="text-[10px] md:text-xs"><UserCheck className="h-3 w-3 mr-1" />Accounts</TabsTrigger>
            <TabsTrigger value="payment" className="text-[10px] md:text-xs"><CreditCard className="h-3 w-3 mr-1" />Pay</TabsTrigger>
            <TabsTrigger value="dashboard" className="text-[10px] md:text-xs"><BarChart3 className="h-3 w-3 mr-1" />Finance</TabsTrigger>
            <TabsTrigger value="records" className="text-[10px] md:text-xs"><Receipt className="h-3 w-3 mr-1" />Records</TabsTrigger>
            <TabsTrigger value="structures" className="text-[10px] md:text-xs"><Layers className="h-3 w-3 mr-1" />Structures</TabsTrigger>
            <TabsTrigger value="bulk" className="text-[10px] md:text-xs"><Users className="h-3 w-3 mr-1" />Bulk Bill</TabsTrigger>
            <TabsTrigger value="defaulters" className="text-[10px] md:text-xs"><AlertTriangle className="h-3 w-3 mr-1" />Defaulters</TabsTrigger>
            <TabsTrigger value="reports" className="text-[10px] md:text-xs"><FileDown className="h-3 w-3 mr-1" />Reports</TabsTrigger>
          </TabsList>

          {/* ACCOUNTS TAB */}
          <TabsContent value="accounts" className="space-y-3">
            <LearnerAccountsTab
              schoolId={schoolId!}
              selectedGrade={selectedGrade}
              schoolName={schoolMeta.name}
              onRecordPayment={(id) => { setPaymentLearnerId(id); setTab('payment'); }}
              onStatement={printStatement}
            />
          </TabsContent>

          {/* RECORD PAYMENT TAB */}
          <TabsContent value="payment" className="space-y-3">
            <RecordPaymentTab
              schoolId={schoolId!}
              userId={user!.id}
              schoolName={schoolMeta.name}
              preselectLearnerId={paymentLearnerId}
              onAfterPayment={(rec) => printReceipt(rec)}
            />
          </TabsContent>

          {/* FINANCE DASHBOARD TAB */}
          <TabsContent value="dashboard" className="space-y-3">
            <FinanceDashboardTab schoolId={schoolId!} year={Number(selectedYear)} term={Number(selectedTerm)} />
          </TabsContent>

          {/* RECORDS TAB */}
          <TabsContent value="records" className="space-y-3">
            <div className="flex justify-end">
              <Button size="sm" onClick={openNewRecord}><Plus className="h-4 w-4 mr-1" />Add Record</Button>
            </div>
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="text-xs">Learner</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs text-right">Charged</TableHead>
                    <TableHead className="text-xs text-right">Paid</TableHead>
                    <TableHead className="text-xs text-right">Balance</TableHead>
                    <TableHead className="text-xs">Method</TableHead>
                    <TableHead className="text-xs">Receipt</TableHead>
                    <TableHead className="text-xs w-[150px]">Actions</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {filteredRecords.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-8 text-sm text-muted-foreground">No records</TableCell></TableRow>
                    ) : filteredRecords.map((r: any) => {
                      const bal = Number(r.amount_charged) - Number(r.amount_paid);
                      const voided = !!r.voided_at;
                      return (
                        <TableRow key={r.id} className={voided ? 'opacity-50' : ''}>
                          <TableCell className="text-xs font-medium">
                            {r.learners?.full_name || '-'}
                            <br /><span className="text-muted-foreground">{r.learners?.admission_number} · G{r.learners?.grade}{r.learners?.stream}</span>
                          </TableCell>
                          <TableCell className="text-xs capitalize">{r.fee_type}</TableCell>
                          <TableCell className="text-xs text-right">{Number(r.amount_charged).toLocaleString()}</TableCell>
                          <TableCell className="text-xs text-right text-success">{Number(r.amount_paid).toLocaleString()}</TableCell>
                          <TableCell className={cn('text-xs text-right font-bold', bal > 0 ? 'text-destructive' : 'text-success')}>{bal.toLocaleString()}</TableCell>
                          <TableCell className="text-xs capitalize">{r.payment_method}{r.mpesa_reference && <span className="text-muted-foreground ml-1">({r.mpesa_reference})</span>}</TableCell>
                          <TableCell className="text-xs">
                            {voided ? <Badge variant="destructive" className="text-[9px]">VOID</Badge> : (
                              <div className="flex flex-col gap-0.5">
                                <span>{r.receipt_number || '-'}</span>
                                {bal <= 0 ? (
                                  <Badge variant="outline" className="text-[9px] w-fit border-success/40 text-success">Cleared</Badge>
                                ) : Number(r.amount_paid) > 0 ? (
                                  <Badge variant="outline" className="text-[9px] w-fit border-warning/40 text-warning">Partial</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[9px] w-fit border-destructive/40 text-destructive">Pending</Badge>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-0.5">
                              {r.receipt_number && !voided && (
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => printReceipt(r)} title="Print receipt"><Receipt className="h-3.5 w-3.5" /></Button>
                              )}
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditRecord(r)} title="Edit"><Edit className="h-3.5 w-3.5" /></Button>
                              {!voided && (
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setVoidTarget(r); setVoidReason(''); }} title="Void"><Ban className="h-3.5 w-3.5 text-warning" /></Button>
                              )}
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { if (confirm('Permanently delete this record?')) deleteRecord.mutate(r.id); }} title="Delete"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {/* STRUCTURES TAB */}
          <TabsContent value="structures" className="space-y-3">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <p className="text-xs text-muted-foreground">
                Consolidated fee per grade for Term {selectedTerm}, {selectedYear}.
                Each grade's total is the sum of its components. Click a row to view the breakdown.
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setStructureDialog(true)}>
                  <Plus className="h-4 w-4 mr-1" />Add Component
                </Button>
                <Button size="sm" onClick={openBulkStructure}>
                  <Layers className="h-4 w-4 mr-1" />New Fee Structure
                </Button>
              </div>
            </div>
            <Card>
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-xs">Grade</TableHead>
                  <TableHead className="text-xs">Term / Year</TableHead>
                  <TableHead className="text-xs text-right">Components</TableHead>
                  <TableHead className="text-xs text-right">Total Fee</TableHead>
                  <TableHead className="text-xs w-[120px]">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {consolidatedStructures.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-sm text-muted-foreground">No fee structures defined for this term</TableCell></TableRow>
                  ) : consolidatedStructures.map((g) => {
                    const expanded = expandedGrades.has(g.grade);
                    return (
                      <Fragment key={g.grade}>
                        <TableRow className="cursor-pointer hover:bg-muted/40" onClick={() => toggleGrade(g.grade)}>
                          <TableCell className="text-xs font-medium">Grade {g.grade}</TableCell>
                          <TableCell className="text-xs">Term {selectedTerm}, {selectedYear}</TableCell>
                          <TableCell className="text-xs text-right">{g.items.length}</TableCell>
                          <TableCell className="text-xs text-right font-bold text-primary">{fmt(g.total)}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); toggleGrade(g.grade); }}>
                              <Eye className="h-3.5 w-3.5 mr-1" />{expanded ? 'Hide' : 'View Breakdown'}
                            </Button>
                          </TableCell>
                        </TableRow>
                        {expanded && (
                          <TableRow key={`${g.grade}-bd`}>
                            <TableCell colSpan={5} className="bg-muted/30 p-3">
                              <div className="text-[11px] font-semibold text-muted-foreground mb-2">FEE BREAKDOWN — Grade {g.grade}</div>
                              <div className="space-y-1">
                                {g.items.map((s: any) => (
                                  <div key={s.id} className="flex items-center justify-between px-3 py-1.5 bg-background rounded border">
                                    <div className="flex-1">
                                      <span className="text-xs font-medium capitalize">{s.fee_type}</span>
                                      {s.description && <span className="text-[10px] text-muted-foreground ml-2">— {s.description}</span>}
                                    </div>
                                    <span className="text-xs font-semibold">{fmt(Number(s.amount))}</span>
                                    <Button size="icon" variant="ghost" className="h-6 w-6 ml-2" onClick={() => deleteStructure.mutate(s.id)}>
                                      <Trash2 className="h-3 w-3 text-destructive" />
                                    </Button>
                                  </div>
                                ))}
                                <div className="flex items-center justify-between px-3 py-2 bg-primary/10 rounded border border-primary/30 mt-2">
                                  <span className="text-xs font-bold">CONSOLIDATED TOTAL</span>
                                  <span className="text-sm font-bold text-primary">{fmt(g.total)}</span>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>



          {/* BULK BILL TAB */}
          <TabsContent value="bulk" className="space-y-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Bulk Bill — Term {selectedTerm}, {selectedYear}</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  This will charge every active learner in the selected grade(s) using the fee structures defined for this term.
                  Learners already billed for a fee type will be skipped (no duplicates).
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Apply to</Label>
                    <Select value={billGrade} onValueChange={setBillGrade}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All grades with structures</SelectItem>
                        {grades.map(g => <SelectItem key={g} value={g}>Grade {g} only</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="rounded-md bg-muted/50 p-3 text-xs space-y-1">
                  <p className="font-semibold">Active structures: {structures.length}</p>
                  {structures.length === 0 && <p className="text-destructive">Define structures first in the Structures tab.</p>}
                </div>
                <Button onClick={() => billRun.mutate()} disabled={billRun.isPending || structures.length === 0} className="w-full">
                  <CheckCircle className="h-4 w-4 mr-1" /> {billRun.isPending ? 'Billing...' : 'Run Bulk Billing'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* DEFAULTERS TAB */}
          <TabsContent value="defaulters" className="space-y-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Defaulters — Term {selectedTerm}, {selectedYear}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="text-xs">Learner</TableHead>
                    <TableHead className="text-xs">Parent</TableHead>
                    <TableHead className="text-xs text-right">Charged</TableHead>
                    <TableHead className="text-xs text-right">Paid</TableHead>
                    <TableHead className="text-xs text-right">Balance</TableHead>
                    <TableHead className="text-xs w-[160px]">Actions</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {defaulters.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">No defaulters 🎉</TableCell></TableRow>
                    ) : defaulters.map((d, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs font-medium">{d.learner?.full_name}<br /><span className="text-muted-foreground">{d.learner?.admission_number} · G{d.learner?.grade}{d.learner?.stream}</span></TableCell>
                        <TableCell className="text-xs">{d.learner?.parent_name || '-'}<br /><span className="text-muted-foreground">{d.learner?.parent_phone || 'No phone'}</span></TableCell>
                        <TableCell className="text-xs text-right">{d.charged.toLocaleString()}</TableCell>
                        <TableCell className="text-xs text-right text-success">{d.paid.toLocaleString()}</TableCell>
                        <TableCell className="text-xs text-right font-bold text-destructive">{d.bal.toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => sendDefaulterReminder(d)}>
                              <MessageCircle className="h-3 w-3 mr-1" />WhatsApp
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => printStatement(d.learner)} title="Statement"><Eye className="h-3.5 w-3.5" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* REPORTS TAB */}
          <TabsContent value="reports" className="space-y-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Term Collection Report</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground">Cashbook of all payments collected in Term {selectedTerm}, {selectedYear}{selectedGrade !== 'all' ? ` for Grade ${selectedGrade}` : ''}.</p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => exportCollections('pdf')} className="flex-1"><FileDown className="h-4 w-4 mr-1" />Download PDF</Button>
                  <Button size="sm" variant="outline" onClick={() => exportCollections('xlsx')} className="flex-1"><FileSpreadsheet className="h-4 w-4 mr-1" />Download Excel</Button>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Per-Learner Statements</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground">Pick a learner and download their full account statement (all terms).</p>
                <Select onValueChange={(id) => { const l = learners.find((x: any) => x.id === id); if (l) printStatement(l); }}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select learner to download statement..." /></SelectTrigger>
                  <SelectContent>
                    {learners.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.full_name} ({l.admission_number}) · G{l.grade}{l.stream}</SelectItem>)}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* ----- Record dialog ----- */}
        <Dialog open={recordDialog} onOpenChange={setRecordDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editingRecord ? 'Edit Fee Record' : 'Add Fee Record'}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Learner</Label>
                <Select value={recordForm.learner_id} onValueChange={v => setRecordForm(f => ({ ...f, learner_id: v }))} disabled={!!editingRecord}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select learner" /></SelectTrigger>
                  <SelectContent>{learners.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.full_name} ({l.admission_number})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {(() => {
                const selectedLearner: any = learners.find((l: any) => l.id === recordForm.learner_id);
                const learnerGrade = selectedLearner?.grade ? String(selectedLearner.grade) : null;
                const components = (structures as any[]).filter((s: any) =>
                  (!learnerGrade || String(s.grade) === learnerGrade)
                  && (!s.term || Number(s.term) === Number(selectedTerm))
                  && (!s.year || Number(s.year) === Number(selectedYear))
                );
                const pickComponent = (id: string) => {
                  if (id === '__custom__') return;
                  const c = components.find((x: any) => x.id === id);
                  if (!c) return;
                  setRecordForm(f => ({ ...f, fee_type: c.fee_type, amount_charged: String(c.amount), description: f.description || c.description || '' }));
                };
                return (
                  <>
                    {components.length > 0 && (
                      <div>
                        <Label className="text-xs">Fee item (from structure)</Label>
                        <Select onValueChange={pickComponent}>
                          <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={learnerGrade ? `Pick item for Grade ${learnerGrade} · T${selectedTerm}/${selectedYear}` : 'Select learner first'} /></SelectTrigger>
                          <SelectContent>
                            {components.map((c: any) => (
                              <SelectItem key={c.id} value={c.id} className="text-xs">
                                <span className="capitalize">{c.fee_type}</span> — KES {Number(c.amount).toLocaleString()}
                              </SelectItem>
                            ))}
                            <SelectItem value="__custom__" className="text-xs">Custom item…</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Fee type</Label>
                        <Select value={recordForm.fee_type} onValueChange={v => setRecordForm(f => ({ ...f, fee_type: v }))}>
                          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{FEE_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Method</Label>
                        <Select value={recordForm.payment_method} onValueChange={v => setRecordForm(f => ({ ...f, payment_method: v }))}>
                          <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div><Label className="text-xs">Charged (KES)</Label><Input type="number" min="0" value={recordForm.amount_charged} onChange={e => setRecordForm(f => ({ ...f, amount_charged: e.target.value }))} className="h-9 text-xs" /></div>
                      <div><Label className="text-xs">Paid (KES)</Label><Input type="number" min="0" value={recordForm.amount_paid} onChange={e => setRecordForm(f => ({ ...f, amount_paid: e.target.value }))} className="h-9 text-xs" /></div>
                    </div>
                  </>
                );
              })()}
              {recordForm.payment_method === 'mpesa' && (
                <div><Label className="text-xs">M-Pesa Reference</Label><Input maxLength={50} value={recordForm.mpesa_reference} onChange={e => setRecordForm(f => ({ ...f, mpesa_reference: e.target.value }))} className="h-9 text-xs" /></div>
              )}
              <div><Label className="text-xs">Description (optional)</Label><Input maxLength={255} value={recordForm.description} onChange={e => setRecordForm(f => ({ ...f, description: e.target.value }))} className="h-9 text-xs" /></div>
            </div>
            <DialogFooter>
              <Button onClick={() => upsertRecord.mutate()} disabled={upsertRecord.isPending} className="w-full">{upsertRecord.isPending ? 'Saving...' : (editingRecord ? 'Update' : 'Save & Print Receipt')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ----- Structure dialog ----- */}
        <Dialog open={structureDialog} onOpenChange={setStructureDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Add Fee Structure (T{selectedTerm}/{selectedYear})</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Grade</Label>
                <Select value={structureForm.grade} onValueChange={v => setStructureForm(f => ({ ...f, grade: v }))}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Pick grade" /></SelectTrigger>
                  <SelectContent>{grades.map(g => <SelectItem key={g} value={g}>Grade {g}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Fee type</Label>
                  <Select value={structureForm.fee_type} onValueChange={v => setStructureForm(f => ({ ...f, fee_type: v }))}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{FEE_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Amount</Label><Input type="number" min="0" value={structureForm.amount} onChange={e => setStructureForm(f => ({ ...f, amount: e.target.value }))} className="h-9 text-xs" /></div>
              </div>
              <div><Label className="text-xs">Description (optional)</Label><Input maxLength={255} value={structureForm.description} onChange={e => setStructureForm(f => ({ ...f, description: e.target.value }))} className="h-9 text-xs" /></div>
            </div>
            <DialogFooter>
              <Button onClick={() => addStructure.mutate()} disabled={addStructure.isPending || !structureForm.grade} className="w-full">Add</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ----- Bulk Structure dialog (consolidated fee structure) ----- */}
        <Dialog open={bulkStructureDialog} onOpenChange={setBulkStructureDialog}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New Fee Structure — Term {selectedTerm}, {selectedYear}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Grade</Label>
                <Select value={bulkStructureGrade} onValueChange={setBulkStructureGrade}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Pick grade" /></SelectTrigger>
                  <SelectContent>{grades.map(g => <SelectItem key={g} value={g}>Grade {g}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Fee Components</Label>
                {bulkComponents.map((c, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                    <Select value={c.fee_type} onValueChange={v => {
                      const n = [...bulkComponents]; n[idx] = { ...n[idx], fee_type: v }; setBulkComponents(n);
                    }}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{FEE_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input type="number" min="0" placeholder="Amount (KES)" value={c.amount}
                      onChange={e => { const n = [...bulkComponents]; n[idx] = { ...n[idx], amount: e.target.value }; setBulkComponents(n); }}
                      className="h-9 text-xs" />
                    <Button size="icon" variant="ghost" className="h-9 w-9"
                      onClick={() => setBulkComponents(bulkComponents.filter((_, i) => i !== idx))}
                      disabled={bulkComponents.length === 1}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button size="sm" variant="outline" className="w-full"
                  onClick={() => setBulkComponents([...bulkComponents, { fee_type: 'other', amount: '', description: '' }])}>
                  <Plus className="h-3.5 w-3.5 mr-1" />Add Component
                </Button>
              </div>
              <div className="flex items-center justify-between px-3 py-2 bg-primary/10 rounded border border-primary/30">
                <span className="text-xs font-bold">CONSOLIDATED TOTAL</span>
                <span className="text-sm font-bold text-primary">
                  {fmt(bulkComponents.reduce((s, c) => s + (Number(c.amount) || 0), 0))}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Components are stored individually; learners see only the consolidated total. Receipts show the full breakdown.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={() => addBulkStructure.mutate()} disabled={addBulkStructure.isPending || !bulkStructureGrade} className="w-full">
                {addBulkStructure.isPending ? 'Saving...' : 'Save Fee Structure'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>



        {/* ----- Void dialog ----- */}
        <Dialog open={!!voidTarget} onOpenChange={(o) => !o && setVoidTarget(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Void Record</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Voiding keeps an audit trail. The record stays visible but greyed out and is excluded from totals.</p>
              <Textarea placeholder="Reason (required)" value={voidReason} maxLength={255} onChange={e => setVoidReason(e.target.value)} className="text-xs" rows={3} />
            </div>
            <DialogFooter>
              <Button onClick={() => { if (voidTarget && voidReason.trim()) { voidRecord.mutate({ id: voidTarget.id, reason: voidReason.trim() }); setVoidTarget(null); } }} disabled={!voidReason.trim()} variant="destructive" className="w-full">Void Record</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
