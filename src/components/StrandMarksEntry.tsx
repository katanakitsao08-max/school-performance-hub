import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Save, CheckCircle2, Layers } from 'lucide-react';
import { getGradeForLevel, type AnyGrade } from '@/lib/cbc-utils';

interface Props {
  schoolId: string;
  selectedGrade: string;
  selectedStream: string;
  selectedTerm: number;
  selectedYear: number;
  selectedAssessment: string;
  learners: any[];
  isPrivileged: boolean;
  editableSubjectIds: Set<string>;
}

interface StrandScore {
  strand_id: string;
  score: string;
  max_score: number;
  teacher_comment: string;
}

export default function StrandMarksEntry({
  schoolId, selectedGrade, selectedStream, selectedTerm, selectedYear,
  selectedAssessment, learners, isPrivileged, editableSubjectIds,
}: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [strandScores, setStrandScores] = useState<Record<string, Record<string, StrandScore>>>({});
  const [hasUnsaved, setHasUnsaved] = useState(false);
  const [expandedLearner, setExpandedLearner] = useState<string | null>(null);

  // Fetch subjects
  const { data: subjects = [] } = useQuery({
    queryKey: ['learning-areas-strand', selectedGrade, schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('learning_areas').select('*')
        .eq('grade', selectedGrade).eq('is_active', true).eq('school_id', schoolId).order('name');
      return data || [];
    },
    enabled: !!selectedGrade && !!schoolId,
  });

  // Filter to editable subjects
  const visibleSubjects = useMemo(() => {
    if (isPrivileged) return subjects;
    return subjects.filter(s => editableSubjectIds.has(s.id));
  }, [subjects, isPrivileged, editableSubjectIds]);

  useEffect(() => {
    if (visibleSubjects.length > 0 && !selectedSubjectId) setSelectedSubjectId(visibleSubjects[0].id);
  }, [visibleSubjects]);

  // Fetch strands for selected subject
  const { data: strands = [] } = useQuery({
    queryKey: ['strands-entry', selectedSubjectId, schoolId],
    queryFn: async () => {
      const { data } = await supabase.from('strands').select('*')
        .eq('learning_area_id', selectedSubjectId).eq('school_id', schoolId).order('sort_order');
      return data || [];
    },
    enabled: !!selectedSubjectId && !!schoolId,
  });

  // Fetch existing strand scores
  const { data: existingStrandScores = [] } = useQuery({
    queryKey: ['strand-scores', selectedSubjectId, selectedTerm, selectedYear, selectedAssessment, learners.map(l => l.id).join(',')],
    queryFn: async () => {
      const learnerIds = learners.map(l => l.id);
      if (!learnerIds.length || !strands.length) return [];
      const { data } = await supabase.from('strand_scores').select('*')
        .in('learner_id', learnerIds)
        .in('strand_id', strands.map(s => s.id))
        .eq('term', selectedTerm).eq('year', selectedYear)
        .eq('assessment_type', selectedAssessment);
      return data || [];
    },
    enabled: learners.length > 0 && strands.length > 0,
  });

  // Initialize scores from existing data
  useEffect(() => {
    const map: Record<string, Record<string, StrandScore>> = {};
    existingStrandScores.forEach((s: any) => {
      if (!map[s.learner_id]) map[s.learner_id] = {};
      map[s.learner_id][s.strand_id] = {
        strand_id: s.strand_id,
        score: String(s.score),
        max_score: s.max_score,
        teacher_comment: s.teacher_comment || '',
      };
    });
    setStrandScores(map);
    setHasUnsaved(false);
  }, [existingStrandScores]);

  const handleScoreChange = useCallback((learnerId: string, strandId: string, value: string) => {
    setStrandScores(prev => ({
      ...prev,
      [learnerId]: {
        ...(prev[learnerId] || {}),
        [strandId]: {
          ...(prev[learnerId]?.[strandId] || { strand_id: strandId, max_score: 100, teacher_comment: '' }),
          score: value,
        },
      },
    }));
    setHasUnsaved(true);
  }, []);

  const handleCommentChange = useCallback((learnerId: string, strandId: string, comment: string) => {
    setStrandScores(prev => ({
      ...prev,
      [learnerId]: {
        ...(prev[learnerId] || {}),
        [strandId]: {
          ...(prev[learnerId]?.[strandId] || { strand_id: strandId, max_score: 100, score: '' }),
          teacher_comment: comment,
        },
      },
    }));
    setHasUnsaved(true);
  }, []);

  // Auto-calculate competency level
  const getCompetencyLevel = (score: number, maxScore: number): string => {
    return getGradeForLevel(score, maxScore, selectedGrade);
  };

  // Calculate overall subject grade from strand scores
  const getOverallSubjectGrade = (learnerId: string): { totalScore: number; totalMax: number; grade: AnyGrade | '-' } => {
    const learnerStrands = strandScores[learnerId] || {};
    let totalScore = 0, totalMax = 0, count = 0;
    strands.forEach(strand => {
      const ss = learnerStrands[strand.id];
      if (ss && ss.score && !isNaN(Number(ss.score))) {
        totalScore += Number(ss.score);
        totalMax += ss.max_score || 100;
        count++;
      }
    });
    if (count === 0) return { totalScore: 0, totalMax: 0, grade: '-' };
    const grade = getGradeForLevel(totalScore, totalMax, selectedGrade);
    return { totalScore, totalMax, grade };
  };

  // Save
  const saveMutation = useMutation({
    mutationFn: async () => {
      const upserts: any[] = [];
      Object.entries(strandScores).forEach(([learnerId, strandMap]) => {
        Object.entries(strandMap).forEach(([strandId, ss]) => {
          if (ss.score && !isNaN(Number(ss.score))) {
            upserts.push({
              learner_id: learnerId,
              strand_id: strandId,
              score: Number(ss.score),
              max_score: ss.max_score || 100,
              competency_level: getCompetencyLevel(Number(ss.score), ss.max_score || 100),
              teacher_comment: ss.teacher_comment || null,
              term: selectedTerm,
              year: selectedYear,
              assessment_type: selectedAssessment,
              school_id: schoolId,
            });
          }
        });
      });
      if (upserts.length === 0) throw new Error('No scores to save');
      const { error } = await supabase.from('strand_scores').upsert(upserts, {
        onConflict: 'learner_id,strand_id,term,year,assessment_type',
      });
      if (error) throw error;

      // Also auto-update the main scores table with calculated subject totals
      const subjectUpserts: any[] = [];
      learners.forEach(l => {
        const { totalScore, totalMax, grade } = getOverallSubjectGrade(l.id);
        if (grade !== '-' && selectedSubjectId) {
          const sub = subjects.find(s => s.id === selectedSubjectId);
          // Scale to subject max_score
          const scaledScore = sub ? Math.round((totalScore / totalMax) * sub.max_score) : totalScore;
          subjectUpserts.push({
            learner_id: l.id,
            learning_area_id: selectedSubjectId,
            score: scaledScore,
            term: selectedTerm,
            year: selectedYear,
            assessment_type: selectedAssessment,
            school_id: schoolId,
          });
        }
      });
      if (subjectUpserts.length > 0) {
        await supabase.from('scores').upsert(subjectUpserts, {
          onConflict: 'learner_id,learning_area_id,term,year,assessment_type',
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strand-scores'] });
      queryClient.invalidateQueries({ queryKey: ['scores'] });
      setHasUnsaved(false);
      toast({ title: 'Strand scores saved & subject grades auto-calculated!' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  if (strands.length === 0 && selectedSubjectId) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Layers className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No strands configured for this subject</p>
          <p className="text-xs mt-1">Go to Strands page to add strands for this subject first.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Subject selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
          <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="Select subject" /></SelectTrigger>
          <SelectContent>
            {visibleSubjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Badge variant="outline" className="text-xs">{strands.length} strands</Badge>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !hasUnsaved}
          size="sm" className="gap-1.5 ml-auto"
        >
          {saveMutation.isPending ? 'Saving...' : hasUnsaved ? <><Save className="h-4 w-4" /> Save</> : <><CheckCircle2 className="h-4 w-4" /> Saved</>}
        </Button>
      </div>

      {/* Grid: Learners × Strands */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="sticky left-0 bg-muted/50 z-10 text-xs w-[40px]">#</TableHead>
                <TableHead className="sticky left-[40px] bg-muted/50 z-10 min-w-[130px] text-xs">Learner</TableHead>
                {strands.map(st => (
                  <TableHead key={st.id} className="text-center min-w-[80px] text-xs">
                    <div className="font-semibold truncate max-w-[90px]" title={st.name}>{st.name}</div>
                    <div className="text-[9px] text-muted-foreground font-normal">/100</div>
                  </TableHead>
                ))}
                <TableHead className="text-center bg-muted font-bold text-xs">Subject Grade</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {learners.map((learner, idx) => {
                const { totalScore, totalMax, grade } = getOverallSubjectGrade(learner.id);
                const isExpanded = expandedLearner === learner.id;
                return (
                  <>
                    <TableRow key={learner.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => setExpandedLearner(isExpanded ? null : learner.id)}>
                      <TableCell className="sticky left-0 bg-card z-10 text-xs p-1">{idx + 1}</TableCell>
                      <TableCell className="sticky left-[40px] bg-card z-10 text-xs font-medium p-1 truncate max-w-[130px]">{learner.full_name}</TableCell>
                      {strands.map(st => {
                        const val = strandScores[learner.id]?.[st.id]?.score || '';
                        const numVal = Number(val);
                        const pct = val && !isNaN(numVal) ? numVal : null;
                        let inputBorder = '';
                        if (pct !== null) {
                          if (pct >= 75) inputBorder = 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20';
                          else if (pct >= 50) inputBorder = 'border-blue-400 bg-blue-50/50 dark:bg-blue-950/20';
                          else if (pct >= 25) inputBorder = 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/20';
                          else inputBorder = 'border-red-400 bg-red-50/50 dark:bg-red-950/20';
                        }
                        return (
                          <TableCell key={st.id} className="p-0.5" onClick={e => e.stopPropagation()}>
                            <Input
                              type="number" min={0} max={100}
                              value={val}
                              onChange={e => handleScoreChange(learner.id, st.id, e.target.value)}
                              className={`w-[65px] text-center mx-auto h-8 text-xs ${inputBorder}`}
                              inputMode="numeric"
                            />
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center p-1">
                        {grade !== '-' ? (
                          <Badge className="font-semibold" variant="outline">{grade}</Badge>
                        ) : '-'}
                      </TableCell>
                    </TableRow>
                    {/* Expanded row for teacher comments per strand */}
                    {isExpanded && (
                      <TableRow key={`${learner.id}-comments`}>
                        <TableCell colSpan={strands.length + 3} className="bg-muted/10 p-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {strands.map(st => (
                              <div key={st.id} className="space-y-1">
                                <label className="text-[10px] font-medium text-muted-foreground">{st.name} — Comment</label>
                                <Textarea
                                  rows={2}
                                  placeholder={`Comment for ${st.name}...`}
                                  value={strandScores[learner.id]?.[st.id]?.teacher_comment || ''}
                                  onChange={e => handleCommentChange(learner.id, st.id, e.target.value)}
                                  className="text-xs min-h-[40px]"
                                />
                              </div>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                );
              })}
              {learners.length === 0 && (
                <TableRow>
                  <TableCell colSpan={strands.length + 3} className="text-center py-8 text-muted-foreground">No learners found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Mobile save */}
      {hasUnsaved && (
        <div className="fixed bottom-20 left-0 right-0 p-3 md:hidden z-50">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full shadow-lg" size="lg">
            <Save className="mr-2 h-4 w-4" /> Save Strand Scores
          </Button>
        </div>
      )}
    </div>
  );
}
