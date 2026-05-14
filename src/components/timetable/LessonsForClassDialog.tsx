import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Pencil, Trash2, Plus, Copy, X } from 'lucide-react';

export interface ClassLessonRow {
  id?: string;
  learning_area_id: string;
  learning_area_name?: string;
  teacher_id?: string | null;
  teacher_name?: string;
  count: number;
  length: number;
  classroom?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  schoolId: string;
  grade: string;
  stream: string;
  /** All classes (grade/stream pairs) to support "Copy to" */
  allClasses: { grade: string; stream: string }[];
  onSaved?: () => void;
}

export function LessonsForClassDialog({ open, onOpenChange, schoolId, grade, stream, allClasses, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<ClassLessonRow[]>([]);
  const [areas, setAreas] = useState<{ id: string; name: string }[]>([]);
  const [teachers, setTeachers] = useState<{ id: string; name: string; learning_area_id: string }[]>([]);
  const [editing, setEditing] = useState<ClassLessonRow | null>(null);
  const [copyTargets, setCopyTargets] = useState<string[]>([]);
  const [showCopyTo, setShowCopyTo] = useState(false);

  useEffect(() => {
    if (!open || !schoolId || !grade) return;
    (async () => {
      setLoading(true);
      const [{ data: la }, { data: ttcl }, { data: ta }] = await Promise.all([
        supabase.from('learning_areas')
          .select('id, name')
          .eq('school_id', schoolId).eq('grade', grade).eq('is_active', true)
          .order('name'),
        supabase.from('timetable_class_lessons')
          .select('*')
          .eq('school_id', schoolId).eq('grade', grade).eq('stream', stream),
        supabase.from('teacher_assignments')
          .select('teacher_id, learning_area_id')
          .eq('school_id', schoolId).eq('grade', grade).eq('stream', stream),
      ]);
      const areaList = (la || []) as { id: string; name: string }[];
      setAreas(areaList);

      // Resolve teacher names
      const tIds = Array.from(new Set(((ta as any) || []).map((r: any) => r.teacher_id as string))) as string[];
      const nameMap: Record<string, string> = {};
      if (tIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles').select('user_id, full_name').in('user_id', tIds);
        (profs || []).forEach((p: any) => { nameMap[p.user_id] = p.full_name; });
      }
      const tList = ((ta as any) || []).map((r: any) => ({
        id: r.teacher_id, name: nameMap[r.teacher_id] || 'Teacher',
        learning_area_id: r.learning_area_id,
      }));
      setTeachers(tList);

      const areaName = (id: string) => areaList.find(a => a.id === id)?.name || '—';
      const tname = (tid?: string | null) => tList.find(t => t.id === tid)?.name;
      setRows(((ttcl as any) || []).map((r: any) => ({
        id: r.id,
        learning_area_id: r.learning_area_id,
        learning_area_name: areaName(r.learning_area_id),
        teacher_id: r.teacher_id,
        teacher_name: tname(r.teacher_id),
        count: r.count,
        length: r.length,
        classroom: r.classroom,
      })));
      setLoading(false);
    })();
  }, [open, schoolId, grade, stream]);

  const teachersForArea = (areaId: string) => teachers.filter(t => t.learning_area_id === areaId);

  const startNew = () => setEditing({
    learning_area_id: '', count: 1, length: 1, teacher_id: null, classroom: '',
  });

  const startEdit = (r: ClassLessonRow) => setEditing({ ...r });

  const remove = async (r: ClassLessonRow) => {
    if (!r.id) { setRows(rs => rs.filter(x => x !== r)); return; }
    if (!confirm(`Remove ${r.learning_area_name}?`)) return;
    const { error } = await supabase.from('timetable_class_lessons').delete().eq('id', r.id);
    if (error) return toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    setRows(rs => rs.filter(x => x.id !== r.id));
    toast({ title: 'Lesson removed' });
    onSaved?.();
  };

  const saveEditing = async () => {
    if (!editing) return;
    if (!editing.learning_area_id) return toast({ title: 'Pick a subject', variant: 'destructive' });
    if (editing.count < 1) return toast({ title: 'Count must be ≥ 1', variant: 'destructive' });
    if (editing.length < 1) return toast({ title: 'Length must be ≥ 1', variant: 'destructive' });

    const payload = {
      school_id: schoolId,
      grade,
      stream,
      learning_area_id: editing.learning_area_id,
      teacher_id: editing.teacher_id || null,
      count: editing.count,
      length: editing.length,
      classroom: editing.classroom || null,
    };
    const { error } = editing.id
      ? await supabase.from('timetable_class_lessons').update(payload).eq('id', editing.id)
      : await supabase.from('timetable_class_lessons').upsert(payload, { onConflict: 'school_id,grade,stream,learning_area_id' });
    if (error) return toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    toast({ title: 'Saved' });
    setEditing(null);
    // Reload
    const { data: ttcl } = await supabase.from('timetable_class_lessons').select('*')
      .eq('school_id', schoolId).eq('grade', grade).eq('stream', stream);
    const areaName = (id: string) => areas.find(a => a.id === id)?.name || '—';
    const tname = (tid?: string | null) => teachers.find(t => t.id === tid)?.name;
    setRows(((ttcl as any) || []).map((r: any) => ({
      id: r.id, learning_area_id: r.learning_area_id, learning_area_name: areaName(r.learning_area_id),
      teacher_id: r.teacher_id, teacher_name: tname(r.teacher_id), count: r.count, length: r.length, classroom: r.classroom,
    })));
    onSaved?.();
  };

  const addAllDefaults = async () => {
    const missing = areas.filter(a => !rows.some(r => r.learning_area_id === a.id));
    if (missing.length === 0) return toast({ title: 'All subjects already added' });
    const payload = missing.map(a => ({
      school_id: schoolId, grade, stream,
      learning_area_id: a.id, count: 5, length: 1, teacher_id: null,
    }));
    const { error } = await supabase.from('timetable_class_lessons').upsert(payload, { onConflict: 'school_id,grade,stream,learning_area_id' });
    if (error) return toast({ title: 'Failed', description: error.message, variant: 'destructive' });
    toast({ title: `Added ${missing.length} subjects` });
    setRows(rs => [...rs, ...missing.map(a => ({
      learning_area_id: a.id, learning_area_name: a.name, count: 5, length: 1,
    }))]);
    onSaved?.();
  };

  const copyToClasses = async () => {
    if (copyTargets.length === 0) return toast({ title: 'Pick at least one class', variant: 'destructive' });
    if (rows.length === 0) return toast({ title: 'Nothing to copy', variant: 'destructive' });
    let total = 0;
    for (const target of copyTargets) {
      const [tg, ts] = target.split('|');
      // Need to map subjects to target grade's learning_areas (by name).
      const { data: tla } = await supabase.from('learning_areas')
        .select('id, name').eq('school_id', schoolId).eq('grade', tg).eq('is_active', true);
      const tAreas = (tla || []) as { id: string; name: string }[];
      const payload = rows
        .map(r => {
          const targetArea = tAreas.find(a => a.name.toLowerCase() === (r.learning_area_name || '').toLowerCase());
          if (!targetArea) return null;
          return {
            school_id: schoolId, grade: tg, stream: ts,
            learning_area_id: targetArea.id,
            count: r.count, length: r.length,
            teacher_id: r.teacher_id || null,
            classroom: r.classroom || null,
          };
        })
        .filter(Boolean) as any[];
      if (payload.length === 0) continue;
      const { error } = await supabase.from('timetable_class_lessons')
        .upsert(payload, { onConflict: 'school_id,grade,stream,learning_area_id' });
      if (!error) total += payload.length;
    }
    toast({ title: `Copied ${total} lesson rows to ${copyTargets.length} class(es)` });
    setShowCopyTo(false);
    setCopyTargets([]);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Lessons for class — {grade} {stream}</DialogTitle>
          <DialogDescription>Define which subjects this class takes, the teacher, how many per week (Count), and how long each lesson runs (Length: 1 = single, 2 = double).</DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
        ) : (
          <>
            <div className="overflow-x-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2">Subject</th>
                    <th className="text-left p-2">Teacher</th>
                    <th className="text-center p-2">Count</th>
                    <th className="text-center p-2">Length</th>
                    <th className="text-left p-2">Classroom</th>
                    <th className="text-right p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No lessons defined yet.</td></tr>
                  )}
                  {rows.map((r, i) => (
                    <tr key={r.id || i} className="border-t">
                      <td className="p-2 font-medium">{r.learning_area_name}</td>
                      <td className="p-2 text-muted-foreground">{r.teacher_name || <span className="italic">auto (assignments)</span>}</td>
                      <td className="p-2 text-center">{r.count}</td>
                      <td className="p-2 text-center">
                        {r.length > 1 ? <Badge variant="secondary">{r.length}× double</Badge> : r.length}
                      </td>
                      <td className="p-2">{r.classroom || '—'}</td>
                      <td className="p-2 text-right space-x-1">
                        <Button size="sm" variant="ghost" onClick={() => startEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(r)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              <Button size="sm" onClick={startNew}><Plus className="h-4 w-4 mr-1" /> New lesson</Button>
              <Button size="sm" variant="outline" onClick={addAllDefaults}>
                <Plus className="h-4 w-4 mr-1" /> Add all subjects (5/wk)
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowCopyTo(s => !s)} disabled={rows.length === 0}>
                <Copy className="h-4 w-4 mr-1" /> Copy to…
              </Button>
            </div>

            {showCopyTo && (
              <div className="mt-3 border rounded-md p-3 space-y-2 bg-muted/30">
                <Label className="text-xs">Copy these lessons to other classes (subjects matched by name):</Label>
                <div className="flex flex-wrap gap-1.5">
                  {allClasses.filter(c => !(c.grade === grade && c.stream === stream)).map(c => {
                    const key = `${c.grade}|${c.stream}`;
                    const on = copyTargets.includes(key);
                    return (
                      <button
                        key={key}
                        onClick={() => setCopyTargets(t => on ? t.filter(x => x !== key) : [...t, key])}
                        className={`px-2 py-1 rounded text-xs border ${on ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'}`}
                      >
                        {c.grade} {c.stream}
                      </button>
                    );
                  })}
                  {allClasses.length <= 1 && <span className="text-xs text-muted-foreground">No other classes available.</span>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={copyToClasses}>Copy now</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setShowCopyTo(false); setCopyTargets([]); }}>Cancel</Button>
                </div>
              </div>
            )}

            {editing && (
              <div className="mt-4 border rounded-md p-3 space-y-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">{editing.id ? 'Edit lesson' : 'New lesson'}</h4>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}><X className="h-4 w-4" /></Button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label className="text-xs">Subject</Label>
                    <Select value={editing.learning_area_id} onValueChange={v => setEditing(s => s ? { ...s, learning_area_id: v, teacher_id: null } : s)}>
                      <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                      <SelectContent>
                        {areas.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Teacher (optional override)</Label>
                    <Select
                      value={editing.teacher_id || '_auto'}
                      onValueChange={v => setEditing(s => s ? { ...s, teacher_id: v === '_auto' ? null : v } : s)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_auto">Auto (use assignments)</SelectItem>
                        {teachersForArea(editing.learning_area_id).map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Count (lessons per week)</Label>
                    <Input type="number" min={1} max={20} value={editing.count}
                      onChange={e => setEditing(s => s ? { ...s, count: Math.max(1, Number(e.target.value) || 1) } : s)} />
                  </div>
                  <div>
                    <Label className="text-xs">Length (periods per lesson)</Label>
                    <Input type="number" min={1} max={4} value={editing.length}
                      onChange={e => setEditing(s => s ? { ...s, length: Math.max(1, Number(e.target.value) || 1) } : s)} />
                  </div>
                  <div className="md:col-span-2">
                    <Label className="text-xs">Classroom (optional)</Label>
                    <Input value={editing.classroom || ''}
                      onChange={e => setEditing(s => s ? { ...s, classroom: e.target.value } : s)}
                      placeholder="e.g. Lab 1, Hall" />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
                  <Button size="sm" onClick={saveEditing}>{editing.id ? 'Update' : 'Add'}</Button>
                </div>
              </div>
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
