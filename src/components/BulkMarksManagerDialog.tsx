import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Download, RotateCcw, Trash2, Undo2, History, Loader2, ListChecks } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { isScoreLocked } from '@/lib/score-lock';

interface Learner { id: string; full_name: string; admission_number?: string | null }
interface Subject { id: string; name: string; max_score: number }

interface Props {
  schoolId: string;
  grade: string;
  stream: string;
  term: number;
  year: number;
  assessment: string;
  learners: Learner[];
  subjects: Subject[];
  existingScores: any[];
  editableSubjectIds: Set<string>;
}

export default function BulkMarksManagerDialog(props: Props) {
  const { role } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'manage' | 'restore'>('manage');

  // Subject scope for selection (default: all editable)
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typedConfirm, setTypedConfirm] = useState('');
  const [reason, setReason] = useState('');

  const isPrivileged = role === 'admin' || role === 'super_admin';
  const canRestore = isPrivileged;

  const scoresInScope = useMemo(() => {
    return props.existingScores.filter((s: any) => {
      if (subjectFilter !== 'all' && s.learning_area_id !== subjectFilter) return false;
      if (!props.editableSubjectIds.has(s.learning_area_id) && !isPrivileged) return false;
      return true;
    });
  }, [props.existingScores, subjectFilter, props.editableSubjectIds, isPrivileged]);

  const learnerById = useMemo(() => {
    const m = new Map(props.learners.map(l => [l.id, l]));
    return m;
  }, [props.learners]);
  const subjectById = useMemo(() => {
    const m = new Map(props.subjects.map(s => [s.id, s]));
    return m;
  }, [props.subjects]);

  const allSelected = scoresInScope.length > 0 && scoresInScope.every((s: any) => selected.has(s.id));
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(scoresInScope.map((s: any) => s.id)));
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  // Impact: distinct learners + subjects affected
  const impact = useMemo(() => {
    const ids = Array.from(selected);
    const rows = props.existingScores.filter((s: any) => selected.has(s.id));
    const learners = new Set(rows.map((r: any) => r.learner_id));
    const subjects = new Set(rows.map((r: any) => r.learning_area_id));
    const lockedCount = rows.filter((r: any) => isScoreLocked(r) && !isPrivileged).length;
    return { count: ids.length, learners: learners.size, subjects: subjects.size, lockedCount };
  }, [selected, props.existingScores, isPrivileged]);

  const exportCsv = () => {
    const rows = props.existingScores.filter((s: any) => selected.has(s.id));
    if (rows.length === 0) return;
    const header = ['admission_no', 'learner', 'subject', 'term', 'year', 'assessment', 'score'];
    const lines = rows.map((r: any) => {
      const l = learnerById.get(r.learner_id);
      const sub = subjectById.get(r.learning_area_id);
      return [l?.admission_number || '', l?.full_name || '', sub?.name || '', r.term, r.year, r.assessment_type, r.score].join(',');
    });
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `marks-backup-${props.grade}-${props.stream}-T${props.term}-${props.year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected);
      const { data, error } = await supabase.rpc('bulk_soft_delete_scores', {
        _score_ids: ids,
        _reason: reason || null,
      });
      if (error) throw error;
      return data?.[0] as { deleted_count: number; skipped_count: number; skipped_reasons: any };
    },
    onSuccess: (r) => {
      toast({
        title: 'Changes saved successfully',
        description: `Deleted ${r.deleted_count} score(s)${r.skipped_count ? `, skipped ${r.skipped_count}` : ''}. Completion status, grades, rankings, reports and analytics have been updated.`,
      });
      setSelected(new Set());
      setConfirmOpen(false);
      setTypedConfirm('');
      setReason('');
      qc.invalidateQueries({ queryKey: ['scores'] });
      qc.invalidateQueries({ queryKey: ['score-audit'] });
    },
    onError: (e: any) => toast({ title: 'Delete failed', description: e.message, variant: 'destructive' }),
  });

  const undoMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('undo_last_score_upload', { _minutes: 30 });
      if (error) throw error;
      return data?.[0] as { deleted_count: number };
    },
    onSuccess: (r) => {
      toast({ title: 'Undo complete', description: `Reverted ${r.deleted_count} recent score(s) from the last 30 minutes.` });
      qc.invalidateQueries({ queryKey: ['scores'] });
      qc.invalidateQueries({ queryKey: ['score-audit'] });
    },
    onError: (e: any) => toast({ title: 'Undo failed', description: e.message, variant: 'destructive' }),
  });

  // Restore tab — list recent delete audit entries
  const { data: auditEntries = [], refetch: refetchAudit } = useQuery({
    queryKey: ['score-audit', props.schoolId, 'delete-30d'],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase.from('score_audit_log')
        .select('*')
        .eq('school_id', props.schoolId)
        .eq('action', 'delete')
        .eq('score_table', 'scores')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(200);
      return data || [];
    },
    enabled: open && canRestore && tab === 'restore',
  });

  const [restoreSel, setRestoreSel] = useState<Set<string>>(new Set());
  const restoreMutation = useMutation({
    mutationFn: async () => {
      const ids = Array.from(restoreSel);
      const { data, error } = await supabase.rpc('restore_soft_deleted_scores', { _audit_ids: ids });
      if (error) throw error;
      return data?.[0] as { restored_count: number; skipped_count: number; skipped_reasons: any };
    },
    onSuccess: (r) => {
      toast({
        title: 'Restore complete',
        description: `Restored ${r.restored_count} score(s)${r.skipped_count ? `, ${r.skipped_count} skipped (newer score exists)` : ''}.`,
      });
      setRestoreSel(new Set());
      refetchAudit();
      qc.invalidateQueries({ queryKey: ['scores'] });
    },
    onError: (e: any) => toast({ title: 'Restore failed', description: e.message, variant: 'destructive' }),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <ListChecks className="h-4 w-4" /> Bulk Manage
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Bulk Marks Management</DialogTitle>
            <DialogDescription>
              {props.grade} {props.stream} • Term {props.term}/{props.year} • {props.assessment.replace('_', ' ')}
            </DialogDescription>
          </DialogHeader>

          <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="flex-1 flex flex-col overflow-hidden">
            <TabsList>
              <TabsTrigger value="manage">Manage Scores</TabsTrigger>
              <TabsTrigger value="restore" disabled={!canRestore}>
                <History className="h-3.5 w-3.5 mr-1" /> Restore {canRestore ? '' : '(Admin only)'}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="manage" className="flex-1 overflow-hidden flex flex-col gap-3">
              {/* Filters + actions */}
              <div className="flex flex-wrap gap-2 items-center">
                <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                  <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Subjects</SelectItem>
                    {props.subjects.filter(s => isPrivileged || props.editableSubjectIds.has(s.id)).map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button variant="outline" size="sm" onClick={() => undoMutation.mutate()} disabled={undoMutation.isPending} className="gap-1.5">
                  {undoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
                  Undo Last Upload (30 min)
                </Button>

                <div className="flex-1" />

                <Button variant="outline" size="sm" onClick={exportCsv} disabled={selected.size === 0} className="gap-1.5">
                  <Download className="h-4 w-4" /> Export Selected
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={selected.size === 0}
                  onClick={() => setConfirmOpen(true)}
                  className="gap-1.5"
                >
                  <Trash2 className="h-4 w-4" /> Delete Selected ({selected.size})
                </Button>
              </div>

              {/* Score list */}
              <div className="flex-1 overflow-auto border rounded-md">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                      </TableHead>
                      <TableHead>Learner</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead className="text-right">Score</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scoresInScope.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No scores in current scope.</TableCell></TableRow>
                    ) : scoresInScope.map((s: any) => {
                      const learner = learnerById.get(s.learner_id);
                      const sub = subjectById.get(s.learning_area_id);
                      const locked = isScoreLocked(s);
                      return (
                        <TableRow key={s.id} className={selected.has(s.id) ? 'bg-muted/40' : ''}>
                          <TableCell><Checkbox checked={selected.has(s.id)} onCheckedChange={() => toggleOne(s.id)} /></TableCell>
                          <TableCell className="font-medium">
                            {learner?.full_name || '—'}
                            {learner?.admission_number && <span className="text-xs text-muted-foreground ml-1">({learner.admission_number})</span>}
                          </TableCell>
                          <TableCell>{sub?.name || '—'}</TableCell>
                          <TableCell className="text-right tabular-nums">{s.score}</TableCell>
                          <TableCell>
                            {locked
                              ? <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300">Locked</Badge>
                              : <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300">Editable</Badge>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="restore" className="flex-1 overflow-hidden flex flex-col gap-3">
              <Alert>
                <History className="h-4 w-4" />
                <AlertDescription>Restore scores deleted within the last 30 days. Entries that conflict with newer scores will be skipped automatically.</AlertDescription>
              </Alert>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  disabled={restoreSel.size === 0 || restoreMutation.isPending}
                  onClick={() => restoreMutation.mutate()}
                  className="gap-1.5"
                >
                  {restoreMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                  Restore Selected ({restoreSel.size})
                </Button>
              </div>
              <div className="flex-1 overflow-auto border rounded-md">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead>Deleted At</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Term / Year</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditEntries.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nothing to restore.</TableCell></TableRow>
                    ) : auditEntries.map((a: any) => {
                      const prev = a.previous_value || {};
                      return (
                        <TableRow key={a.id}>
                          <TableCell>
                            <Checkbox
                              checked={restoreSel.has(a.id)}
                              onCheckedChange={() => {
                                const n = new Set(restoreSel);
                                n.has(a.id) ? n.delete(a.id) : n.add(a.id);
                                setRestoreSel(n);
                              }}
                            />
                          </TableCell>
                          <TableCell className="text-xs">{new Date(a.created_at).toLocaleString()}</TableCell>
                          <TableCell className="tabular-nums">{prev.score ?? '—'}</TableCell>
                          <TableCell>T{prev.term}/{prev.year} • {prev.assessment_type}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{a.reason || '—'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog with impact analysis */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Delete {impact.count} score(s)?
            </DialogTitle>
            <DialogDescription>
              This action will:
            </DialogDescription>
          </DialogHeader>
          <ul className="text-sm space-y-1 ml-2">
            <li>✓ Remove {impact.count} selected score(s) from {impact.learners} learner(s) across {impact.subjects} subject(s)</li>
            <li>✓ Recalculate grades, rankings & subject means</li>
            <li>✓ Update learner completion status (Completed → Pending where applicable)</li>
            <li>✓ Refresh reports & analytics dashboards</li>
            <li>✓ Update teacher progress indicators</li>
            {impact.lockedCount > 0 && (
              <li className="text-amber-700">⚠ {impact.lockedCount} score(s) are locked and will be skipped (admin unlock required).</li>
            )}
          </ul>
          <div className="space-y-2">
            <Label htmlFor="reason">Reason (optional, recorded in audit log)</Label>
            <Input id="reason" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. duplicate entry, wrong assessment" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Type <span className="font-mono font-bold">DELETE</span> to continue</Label>
            <Input id="confirm" value={typedConfirm} onChange={e => setTypedConfirm(e.target.value)} autoComplete="off" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmOpen(false); setTypedConfirm(''); }}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={typedConfirm !== 'DELETE' || deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
              className="gap-1.5"
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
