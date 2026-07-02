import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSchoolGrades } from '@/hooks/use-school-grades';
import { Plus, Pencil, Trash2, Layers } from 'lucide-react';
import { toast } from 'sonner';

interface MergedSubject {
  id: string;
  school_id: string;
  grade: string;
  name: string;
  code: string;
  max_score: number;
  is_active: boolean;
}

interface DraftMerge {
  id?: string;
  name: string;
  code: string;
  max_score: number;
  is_active: boolean;
  member_ids: string[];
}

const EMPTY_DRAFT: DraftMerge = { name: '', code: '', max_score: 100, is_active: true, member_ids: [] };

export default function SubjectMergesPage() {
  const { schoolId } = useAuth();
  const qc = useQueryClient();
  const grades = useSchoolGrades();
  const [grade, setGrade] = useState<string>(grades[0] || '1');
  const [editing, setEditing] = useState<DraftMerge | null>(null);

  const { data: subjects = [] } = useQuery({
    queryKey: ['learning-areas-for-merge', grade, schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('learning_areas').select('id, name, max_score')
        .eq('school_id', schoolId!).eq('grade', grade).eq('is_active', true).order('name');
      return data || [];
    },
    enabled: !!schoolId && !!grade,
  });

  const { data: merges = [] } = useQuery({
    queryKey: ['merged-subjects-admin', schoolId, grade],
    queryFn: async () => {
      const { data: parents } = await (supabase as any).from('merged_subjects')
        .select('id, school_id, grade, name, code, max_score, is_active')
        .eq('school_id', schoolId!).eq('grade', grade).order('name');
      const ids = (parents || []).map((p: any) => p.id);
      const { data: items } = ids.length
        ? await (supabase as any).from('merged_subject_items')
            .select('merged_subject_id, learning_area_id').in('merged_subject_id', ids)
        : { data: [] };
      const byParent = new Map<string, string[]>();
      (items || []).forEach((it: any) => {
        const list = byParent.get(it.merged_subject_id) || [];
        list.push(it.learning_area_id); byParent.set(it.merged_subject_id, list);
      });
      return (parents || []).map((p: any) => ({ ...p, member_ids: byParent.get(p.id) || [] }));
    },
    enabled: !!schoolId && !!grade,
  });

  const subjectMap = useMemo(
    () => Object.fromEntries((subjects as any[]).map(s => [s.id, s])),
    [subjects]
  );

  const usedInOthers = useMemo(() => {
    const set = new Set<string>();
    (merges as any[]).forEach(m => {
      if (m.id !== editing?.id) m.member_ids.forEach((id: string) => set.add(id));
    });
    return set;
  }, [merges, editing?.id]);

  const saveMutation = useMutation({
    mutationFn: async (draft: DraftMerge) => {
      if (!draft.name.trim()) throw new Error('Name is required');
      if (draft.member_ids.length < 2) throw new Error('Select at least 2 subjects');

      let parentId = draft.id;
      if (parentId) {
        const { error } = await (supabase as any).from('merged_subjects')
          .update({ name: draft.name.trim(), code: draft.code.trim() || draft.name.slice(0, 4).toUpperCase(),
                    max_score: draft.max_score, is_active: draft.is_active })
          .eq('id', parentId);
        if (error) throw error;
        await (supabase as any).from('merged_subject_items').delete().eq('merged_subject_id', parentId);
      } else {
        const { data, error } = await (supabase as any).from('merged_subjects').insert({
          school_id: schoolId, grade, name: draft.name.trim(),
          code: draft.code.trim() || draft.name.slice(0, 4).toUpperCase(),
          max_score: draft.max_score, is_active: draft.is_active,
        }).select('id').single();
        if (error) throw error;
        parentId = data.id;
      }
      const rows = draft.member_ids.map(lid => ({ merged_subject_id: parentId, learning_area_id: lid }));
      const { error: itemsErr } = await (supabase as any).from('merged_subject_items').insert(rows);
      if (itemsErr) throw itemsErr;
    },
    onSuccess: () => {
      toast.success('Merged subject saved');
      qc.invalidateQueries({ queryKey: ['merged-subjects-admin'] });
      qc.invalidateQueries({ queryKey: ['merged-subjects'] });
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message || 'Save failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('merged_subjects').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Merged subject deleted');
      qc.invalidateQueries({ queryKey: ['merged-subjects-admin'] });
      qc.invalidateQueries({ queryKey: ['merged-subjects'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase as any).from('merged_subjects').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['merged-subjects-admin'] });
      qc.invalidateQueries({ queryKey: ['merged-subjects'] });
    },
  });

  const toggleMember = (id: string) => {
    if (!editing) return;
    setEditing({
      ...editing,
      member_ids: editing.member_ids.includes(id)
        ? editing.member_ids.filter(x => x !== id)
        : [...editing.member_ids, id],
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <Layers className="h-6 w-6 text-primary" /> Subject Merges
            </h1>
            <p className="text-sm text-muted-foreground">
              Combine subjects (e.g. SCIENCES = Biology + Agriculture) for reports, SMS and exports. Applies to the selected grade only.
            </p>
          </div>
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Grade</Label>
              <Select value={grade} onValueChange={setGrade}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>{grades.map(g => <SelectItem key={g} value={g}>Grade {g}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button onClick={() => setEditing({ ...EMPTY_DRAFT })}>
              <Plus className="h-4 w-4 mr-2" /> New merged subject
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Grade {grade} — {(merges as any[]).length} merged subject{(merges as any[]).length === 1 ? '' : 's'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(merges as any[]).length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No merged subjects yet for this grade. Create one to have it appear across Reports, PDF, Excel and SMS.
              </p>
            )}
            {(merges as any[]).map((m: any) => (
              <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{m.name}</span>
                    <Badge variant="outline" className="text-[10px]">{m.code}</Badge>
                    <Badge variant="secondary" className="text-[10px]">/{m.max_score}</Badge>
                    {!m.is_active && <Badge variant="destructive" className="text-[10px]">Disabled</Badge>}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {m.member_ids.map((id: string) => (
                      <Badge key={id} variant="secondary" className="text-[10px]">
                        {subjectMap[id]?.name || 'Unknown'}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={m.is_active}
                    onCheckedChange={(v) => toggleActiveMutation.mutate({ id: m.id, is_active: v })}
                  />
                  <Button size="sm" variant="ghost" onClick={() => setEditing({
                    id: m.id, name: m.name, code: m.code, max_score: Number(m.max_score),
                    is_active: m.is_active, member_ids: m.member_ids,
                  })}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => {
                    if (confirm(`Delete "${m.name}"?`)) deleteMutation.mutate(m.id);
                  }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing?.id ? 'Edit' : 'New'} merged subject — Grade {grade}</DialogTitle>
            </DialogHeader>
            {editing && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">Name (shown on reports)</Label>
                    <Input value={editing.name} placeholder="SCIENCES"
                      onChange={e => setEditing({ ...editing, name: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Short code (SMS)</Label>
                    <Input value={editing.code} placeholder="SCI"
                      onChange={e => setEditing({ ...editing, code: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Max score</Label>
                    <Input type="number" value={editing.max_score}
                      onChange={e => setEditing({ ...editing, max_score: Number(e.target.value) || 100 })} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Component subjects (pick 2+)</Label>
                  <div className="border rounded-md max-h-64 overflow-y-auto divide-y">
                    {(subjects as any[]).map(s => {
                      const disabled = usedInOthers.has(s.id);
                      const checked = editing.member_ids.includes(s.id);
                      return (
                        <label key={s.id}
                          className={`flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted/40 ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
                          <Checkbox checked={checked} disabled={disabled && !checked}
                            onCheckedChange={() => !disabled && toggleMember(s.id)} />
                          <span className="flex-1">{s.name}</span>
                          {disabled && !checked && <span className="text-[10px] text-muted-foreground">in another merge</span>}
                        </label>
                      );
                    })}
                    {(subjects as any[]).length === 0 && (
                      <p className="p-4 text-xs text-muted-foreground text-center">No subjects configured for this grade.</p>
                    )}
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={editing.is_active}
                    onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                  Active
                </label>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={() => editing && saveMutation.mutate(editing)} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
