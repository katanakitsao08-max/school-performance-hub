import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Pencil, Check, X, Clock, CheckCircle2 } from 'lucide-react';
import { getGradeForLevel, type AnyGrade } from '@/lib/cbc-utils';

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

export default function MarksEntryBySubject({
  subjects, editableSubjectIds, learners, selectedGrade, scores, existingScores, onScoreChange,
}: Props) {
  const editableSubjects = useMemo(
    () => subjects.filter(s => editableSubjectIds.has(s.id)),
    [subjects, editableSubjectIds],
  );
  const [subjectId, setSubjectId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [minScore, setMinScore] = useState<string>('');
  const [maxScore, setMaxScore] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState<string>('');

  // Default subject
  if (!subjectId && editableSubjects.length > 0) {
    // Use setState in render-safe way via microtask
    setTimeout(() => setSubjectId(editableSubjects[0].id), 0);
  }

  const subject = editableSubjects.find(s => s.id === subjectId);

  // Build per-learner row data for this subject (from current `scores` state, which mirrors DB)
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
    // Subject ranks (only for entered scores; tie-friendly dense rank)
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

  const matchesSearch = (l: Learner) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (l.full_name || '').toLowerCase().includes(q) || (l.admission_number || '').toLowerCase().includes(q);
  };

  const pending = rows.filter(r => r.score === null && matchesSearch(r.learner));
  const completed = rows.filter(r => {
    if (r.score === null) return false;
    if (!matchesSearch(r.learner)) return false;
    const lo = minScore !== '' ? Number(minScore) : -Infinity;
    const hi = maxScore !== '' ? Number(maxScore) : Infinity;
    return r.score >= lo && r.score <= hi;
  });

  if (editableSubjects.length === 0) {
    return (
      <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
        No subjects available to edit for the selected class.
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Subject picker + filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Subject</Label>
          <Select value={subjectId} onValueChange={setSubjectId}>
            <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="Pick subject" /></SelectTrigger>
            <SelectContent>
              {editableSubjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name} (/{s.max_score})</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Search learner</Label>
          <Input
            placeholder="Name or admission no."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9 w-[220px]"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Score range (Completed)</Label>
          <div className="flex items-center gap-1">
            <Input type="number" placeholder="Min" value={minScore} onChange={e => setMinScore(e.target.value)} className="h-9 w-[80px]" />
            <span className="text-muted-foreground text-xs">to</span>
            <Input type="number" placeholder="Max" value={maxScore} onChange={e => setMaxScore(e.target.value)} className="h-9 w-[80px]" />
          </div>
        </div>
      </div>

      <Tabs defaultValue="pending" className="space-y-3">
        <TabsList>
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="h-3.5 w-3.5 text-amber-600" /> Pending
            <Badge className="ml-1 bg-amber-100 text-amber-800 border-amber-300" variant="outline">{pending.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Completed
            <Badge className="ml-1 bg-emerald-100 text-emerald-800 border-emerald-300" variant="outline">{completed.length}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* PENDING */}
        <TabsContent value="pending">
          <Card><CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-amber-50/60 dark:bg-amber-950/20">
                  <TableHead className="w-[40px] text-xs">#</TableHead>
                  <TableHead className="text-xs">Admission</TableHead>
                  <TableHead className="text-xs">Learner</TableHead>
                  <TableHead className="text-xs text-center">Status</TableHead>
                  <TableHead className="text-xs text-center w-[140px]">Enter Score {subject && `(/${subject.max_score})`}</TableHead>
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
                        className="h-8 w-[90px] mx-auto text-center text-xs"
                        onChange={e => subject && onScoreChange(r.learner.id, subject.id, e.target.value)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {pending.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-10 text-sm">
                    🎉 No pending learners — every learner has a score for this subject.
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent></Card>
          <p className="text-[11px] text-muted-foreground mt-2">
            Scores save automatically as you type. Learners move to Completed instantly.
          </p>
        </TabsContent>

        {/* COMPLETED */}
        <TabsContent value="completed">
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
                {completed.map((r, i) => {
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
                            <Button size="icon" variant="ghost" className="h-7 w-7"
                              onClick={() => {
                                if (subject) onScoreChange(r.learner.id, subject.id, draftValue);
                                setEditingId(null);
                              }}><Check className="h-4 w-4 text-emerald-600" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7"
                              onClick={() => setEditingId(null)}><X className="h-4 w-4" /></Button>
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
                {completed.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10 text-sm">
                    No completed scores match your filters.
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
