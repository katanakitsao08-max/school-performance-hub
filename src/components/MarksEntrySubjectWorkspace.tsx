import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Pencil, Check, X, Eye, BookOpen } from 'lucide-react';
import { getGradeForLevel, isKJSEAGradeLevel, type AnyGrade } from '@/lib/cbc-utils';

interface Subject { id: string; name: string; max_score: number }
interface Learner { id: string; full_name: string; admission_number?: string | null }

interface Props {
  subjects: Subject[];
  editableSubjectIds: Set<string>;
  learners: Learner[];
  selectedGrade: string;
  scores: Record<string, Record<string, string>>;
  existingScores: any[];
  onScoreChange: (learnerId: string, subjectId: string, value: string) => void;
}

const gradeBadge = (g: AnyGrade | '-') => {
  if (g === '-') return null;
  const map: Record<string, string> = {
    EE: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    ME: 'bg-blue-100 text-blue-800 border-blue-300',
    AE: 'bg-amber-100 text-amber-800 border-amber-300',
    BE: 'bg-red-100 text-red-800 border-red-300',
    EE1: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    EE2: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    ME1: 'bg-blue-100 text-blue-800 border-blue-300',
    ME2: 'bg-blue-100 text-blue-800 border-blue-300',
    AE1: 'bg-amber-100 text-amber-800 border-amber-300',
    AE2: 'bg-amber-100 text-amber-800 border-amber-300',
    BE1: 'bg-red-100 text-red-800 border-red-300',
    BE2: 'bg-red-100 text-red-800 border-red-300',
  };
  return <Badge variant="outline" className={`${map[g] || ''} border font-semibold`}>{g}</Badge>;
};

export default function MarksEntrySubjectWorkspace({
  subjects, editableSubjectIds, learners, selectedGrade, scores, existingScores, onScoreChange,
}: Props) {
  const editableSubjects = useMemo(
    () => subjects.filter(s => editableSubjectIds.has(s.id)),
    [subjects, editableSubjectIds],
  );
  const [subjectId, setSubjectId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [completedSearch, setCompletedSearch] = useState('');
  const [minScore, setMinScore] = useState('');
  const [maxScore, setMaxScore] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState('');
  const [completedOpen, setCompletedOpen] = useState(false);
  const [localValues, setLocalValues] = useState<Record<string, string>>({}); // for pending inputs (UX only)

  useEffect(() => {
    if (editableSubjects.length === 0) { setSubjectId(''); return; }
    if (!editableSubjects.some(s => s.id === subjectId)) setSubjectId(editableSubjects[0].id);
  }, [editableSubjects, subjectId]);

  // Clear local pending values when subject changes
  useEffect(() => { setLocalValues({}); }, [subjectId]);

  const subject = editableSubjects.find(s => s.id === subjectId);

  const rows = useMemo(() => {
    if (!subject) return [];
    const meta = new Map<string, any>();
    existingScores.forEach((s: any) => {
      if (s.learning_area_id === subject.id) meta.set(s.learner_id, s);
    });
    const items = learners.map(l => {
      const raw = scores[l.id]?.[subject.id];
      const numeric = raw && !isNaN(Number(raw)) && Number(raw) > 0 ? Number(raw) : null;
      const m = meta.get(l.id);
      return {
        learner: l,
        score: numeric,
        updatedAt: m?.updated_at || m?.submitted_at || null,
      };
    });
    const sorted = [...items].filter(r => r.score !== null).sort((a, b) => (b.score! - a.score!));
    const rankMap = new Map<string, number>();
    let rank = 0, prev = -1;
    sorted.forEach((r, i) => {
      if (r.score !== prev) { rank = i + 1; prev = r.score!; }
      rankMap.set(r.learner.id, rank);
    });
    return items.map(r => ({
      ...r,
      grade: r.score !== null ? getGradeForLevel(r.score, subject.max_score, selectedGrade) : '-' as const,
      rank: rankMap.get(r.learner.id) ?? null,
    }));
  }, [subject, learners, scores, existingScores, selectedGrade]);

  const matchesSearch = (l: Learner, q: string) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return (l.full_name || '').toLowerCase().includes(s) || (l.admission_number || '').toLowerCase().includes(s);
  };

  const pending = rows.filter(r => r.score === null && matchesSearch(r.learner, search));
  const completed = rows.filter(r => r.score !== null);
  const completedFiltered = completed.filter(r => {
    if (!matchesSearch(r.learner, completedSearch)) return false;
    const lo = minScore !== '' ? Number(minScore) : -Infinity;
    const hi = maxScore !== '' ? Number(maxScore) : Infinity;
    return r.score! >= lo && r.score! <= hi;
  });

  // Dashboard stats
  const dash = useMemo(() => {
    const total = rows.length;
    const c = completed.length;
    const p = total - c;
    const pct = total === 0 ? 0 : Math.round((c / total) * 100);
    const mean = c === 0 ? 0 : completed.reduce((s, r) => s + (r.score || 0), 0) / c;
    const isKJSEA = isKJSEAGradeLevel(selectedGrade);
    const grades = completed.map(r => r.grade as string);
    const ee = grades.filter(g => isKJSEA ? (g === 'EE1' || g === 'EE2') : g === 'EE').length;
    const me = grades.filter(g => isKJSEA ? (g === 'ME1' || g === 'ME2') : g === 'ME').length;
    const ae = grades.filter(g => isKJSEA ? (g === 'AE1' || g === 'AE2') : g === 'AE').length;
    const be = grades.filter(g => isKJSEA ? (g === 'BE1' || g === 'BE2') : g === 'BE').length;
    return { total, completed: c, pending: p, pct, mean, ee, me, ae, be };
  }, [rows, completed, selectedGrade]);

  if (editableSubjects.length === 0) {
    return (
      <Card><CardContent className="p-10 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
        <BookOpen className="h-8 w-8 opacity-40" />
        No subjects available to edit for the selected class.
      </CardContent></Card>
    );
  }

  const saveDraftEdit = () => {
    if (editingId && subject) onScoreChange(editingId, subject.id, draftValue);
    setEditingId(null);
  };

  const handlePendingInput = (learnerId: string, value: string) => {
    setLocalValues(prev => ({ ...prev, [learnerId]: value }));
    if (subject) onScoreChange(learnerId, subject.id, value);
  };

  return (
    <div className="space-y-4">
      {/* Subject picker + search + view completed */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Subject</Label>
          <Select value={subjectId} onValueChange={setSubjectId}>
            <SelectTrigger className="w-[220px] h-9"><SelectValue placeholder="Pick subject" /></SelectTrigger>
            <SelectContent>
              {editableSubjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name} (/{s.max_score})</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 flex-1 min-w-[200px]">
          <Label className="text-xs">Search learner</Label>
          <Input
            placeholder="Name or admission no."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9"
          />
        </div>
        <Dialog open={completedOpen} onOpenChange={setCompletedOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1.5">
              <Eye className="h-4 w-4" /> View Completed Scores
              <Badge variant="secondary" className="ml-1">{completed.length}</Badge>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Completed Scores {subject && <span className="text-muted-foreground font-normal">— {subject.name}</span>}
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-wrap items-end gap-2 mb-3">
              <Input
                placeholder="Search…"
                value={completedSearch}
                onChange={e => setCompletedSearch(e.target.value)}
                className="h-9 max-w-[240px]"
              />
              <div className="flex items-center gap-1">
                <Input type="number" placeholder="Min" value={minScore} onChange={e => setMinScore(e.target.value)} className="h-9 w-[80px]" />
                <span className="text-xs text-muted-foreground">to</span>
                <Input type="number" placeholder="Max" value={maxScore} onChange={e => setMaxScore(e.target.value)} className="h-9 w-[80px]" />
              </div>
            </div>
            <Card><CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-emerald-50/60 dark:bg-emerald-950/20">
                    <TableHead className="w-[40px] text-xs">#</TableHead>
                    <TableHead className="text-xs">Admission</TableHead>
                    <TableHead className="text-xs">Learner</TableHead>
                    <TableHead className="text-xs text-center">Score</TableHead>
                    <TableHead className="text-xs text-center">Grade</TableHead>
                    <TableHead className="text-xs text-center">Rank</TableHead>
                    <TableHead className="text-xs">Updated</TableHead>
                    <TableHead className="text-xs text-center w-[110px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completedFiltered.map((r, i) => {
                    const isEditing = editingId === r.learner.id;
                    return (
                      <TableRow key={r.learner.id} className="hover:bg-muted/30">
                        <TableCell className="text-xs text-muted-foreground p-2">{i + 1}</TableCell>
                        <TableCell className="text-xs font-mono p-2">{r.learner.admission_number || '—'}</TableCell>
                        <TableCell className="text-xs font-medium p-2">{r.learner.full_name}</TableCell>
                        <TableCell className="text-center p-2">
                          {isEditing ? (
                            <Input
                              type="number"
                              min={0}
                              max={subject?.max_score}
                              value={draftValue}
                              onChange={e => setDraftValue(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') saveDraftEdit(); if (e.key === 'Escape') setEditingId(null); }}
                              className="h-8 w-[80px] mx-auto text-center text-xs"
                              autoFocus
                            />
                          ) : (
                            <span className="font-bold text-sm">{r.score}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center p-2">{gradeBadge(r.grade as AnyGrade | '-')}</TableCell>
                        <TableCell className="text-center p-2 text-xs font-semibold">{r.rank ?? '—'}</TableCell>
                        <TableCell className="text-xs text-muted-foreground p-2">
                          {r.updatedAt ? new Date(r.updatedAt).toLocaleString() : '—'}
                        </TableCell>
                        <TableCell className="text-center p-2">
                          {isEditing ? (
                            <div className="flex justify-center gap-1">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveDraftEdit}>
                                <Check className="h-4 w-4 text-emerald-600" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                              onClick={() => { setEditingId(r.learner.id); setDraftValue(String(r.score ?? '')); }}>
                              <Pencil className="h-3 w-3" /> Edit
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {completedFiltered.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10 text-sm">
                      No completed scores match your filters.
                    </TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent></Card>
            <p className="text-[11px] text-muted-foreground mt-2">
              Editing a score updates grades, ranks, means and all reports automatically. No duplicate records are created.
            </p>
          </DialogContent>
        </Dialog>
      </div>

      {/* Dashboard cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
        <Card><CardContent className="p-2 md:p-3 text-center">
          <p className="text-lg font-bold">{dash.total}</p>
          <p className="text-[10px] text-muted-foreground">Learners</p>
        </CardContent></Card>
        <Card className="border-amber-200 dark:border-amber-800"><CardContent className="p-2 md:p-3 text-center">
          <p className="text-lg font-bold text-amber-700 dark:text-amber-400">{dash.pending}</p>
          <p className="text-[10px] text-muted-foreground">Pending</p>
        </CardContent></Card>
        <Card className="border-emerald-200 dark:border-emerald-800"><CardContent className="p-2 md:p-3 text-center">
          <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{dash.completed}</p>
          <p className="text-[10px] text-muted-foreground">Completed</p>
        </CardContent></Card>
        <Card><CardContent className="p-2 md:p-3 text-center">
          <p className="text-lg font-bold text-primary">{dash.mean ? dash.mean.toFixed(1) : '—'}</p>
          <p className="text-[10px] text-muted-foreground">Mean</p>
        </CardContent></Card>
        <Card className="border-emerald-200 dark:border-emerald-800"><CardContent className="p-2 md:p-3 text-center">
          <p className="text-lg font-bold">{dash.ee}</p>
          <p className="text-[10px] text-muted-foreground">EE</p>
        </CardContent></Card>
        <Card className="border-blue-200 dark:border-blue-800"><CardContent className="p-2 md:p-3 text-center">
          <p className="text-lg font-bold">{dash.me}</p>
          <p className="text-[10px] text-muted-foreground">ME</p>
        </CardContent></Card>
        <Card className="border-amber-200 dark:border-amber-800"><CardContent className="p-2 md:p-3 text-center">
          <p className="text-lg font-bold">{dash.ae}</p>
          <p className="text-[10px] text-muted-foreground">AE</p>
        </CardContent></Card>
        <Card className="border-red-200 dark:border-red-800"><CardContent className="p-2 md:p-3 text-center">
          <p className="text-lg font-bold">{dash.be}</p>
          <p className="text-[10px] text-muted-foreground">BE</p>
        </CardContent></Card>
      </div>

      {/* Progress bar */}
      <Card><CardContent className="p-3 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium">
            {dash.completed} / {dash.total} Learners Assessed
          </span>
          <span className="text-muted-foreground">{dash.pct}%</span>
        </div>
        <Progress value={dash.pct} className="h-2" />
      </CardContent></Card>

      {/* Pending entry table — the single score-entry surface */}
      <Card><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-amber-50/60 dark:bg-amber-950/20">
              <TableHead className="w-[40px] text-xs">#</TableHead>
              <TableHead className="text-xs">Admission</TableHead>
              <TableHead className="text-xs">Learner</TableHead>
              <TableHead className="text-xs text-center">Status</TableHead>
              <TableHead className="text-xs text-center w-[160px]">
                Enter Score {subject && <span className="text-muted-foreground font-normal">(/{subject.max_score})</span>}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pending.map((r, i) => (
              <TableRow key={r.learner.id} className="hover:bg-muted/30">
                <TableCell className="text-xs text-muted-foreground p-2">{i + 1}</TableCell>
                <TableCell className="text-xs font-mono p-2">{r.learner.admission_number || '—'}</TableCell>
                <TableCell className="text-xs font-medium p-2">{r.learner.full_name}</TableCell>
                <TableCell className="text-center p-2">
                  <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]">Pending</Badge>
                </TableCell>
                <TableCell className="text-center p-2">
                  <Input
                    type="number"
                    min={0}
                    max={subject?.max_score}
                    placeholder="—"
                    inputMode="numeric"
                    value={localValues[r.learner.id] ?? ''}
                    onChange={e => handlePendingInput(r.learner.id, e.target.value)}
                    className="h-8 w-[100px] mx-auto text-center text-xs"
                  />
                </TableCell>
              </TableRow>
            ))}
            {pending.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-10 text-sm">
                🎉 All learners assessed for this subject. Use <strong>View Completed Scores</strong> to review or edit.
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent></Card>
      <p className="text-[11px] text-muted-foreground">
        Scores auto-save as you type. Once saved, the learner moves to Completed and disappears from this list — grades, ranks, means and reports update instantly.
      </p>
    </div>
  );
}
