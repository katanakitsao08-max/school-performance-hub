import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sparkles, BookOpen, Loader2, GraduationCap, Brain, Trophy,
  Star, CheckCircle2, XCircle, ArrowRight, RotateCcw, Award, Target, PartyPopper,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useLearningPathAccess } from '@/hooks/use-learning-path-access';
import LearningPathPaywall from './LearningPathPaywall';

interface Props {
  child: { id: string; full_name: string; grade: string; stream: string; gender: string; school_id?: string | null };
}

/* ---------- Types from edge function ---------- */
interface AssessmentQ {
  id: string; difficulty: number; strand: string;
  question: string; options: string[]; answerIndex: number; explanation: string;
}
interface Assessment {
  title: string; instructions: string; questions: AssessmentQ[];
}
interface Exercise {
  id: string; difficulty: number; type: 'mcq' | 'input';
  question: string; options?: string[]; answer: string; answerIndex?: number;
  hint: string; explanation: string;
}
interface Lesson {
  title: string; strand: string; subStrand: string; level: number;
  story: string; learningGoals: string[];
  vocabulary: { term: string; meaning: string }[];
  lessonSteps: { title: string; explanation: string; example: string }[];
  workedExample: { problem: string; steps: string[]; answer: string };
  exercises: Exercise[];
  realWorldChallenge: string; xpReward: number; badge: string;
  imageQueries?: string[];
  videoQuery?: string;
}
interface RevisionTest {
  title: string; instructions: string; examType: 'KPSEA' | 'KJSEA';
  questions: AssessmentQ[];
}

const unsplashUrl = (q: string) =>
  `https://source.unsplash.com/featured/600x320/?${encodeURIComponent(q + ',kenya,africa,school,children')}`;
const youtubeSearchUrl = (q: string) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(q + ' Kenya CBC')}`;

interface SubjectProgress {
  level: number;
  xp: number;
  streak: number;
  badges: string[];
  lessonsCompleted: number;
  topicsCovered: string[];
  lastPlayed?: string;
}

const TUTOR_NAME = 'Mr Kitsao the Teacher';

/* ---------- Local cache fallback ---------- */
const storeKey = (childId: string, subjectId: string) => `lp:${childId}:${subjectId}`;
const readLocalProgress = (childId: string, subjectId: string): SubjectProgress | null => {
  try { const v = localStorage.getItem(storeKey(childId, subjectId)); return v ? JSON.parse(v) : null; } catch { return null; }
};
const writeLocalProgress = (childId: string, subjectId: string, p: SubjectProgress) => {
  try { localStorage.setItem(storeKey(childId, subjectId), JSON.stringify(p)); } catch { /* ignore */ }
};

/* ---------- DB sync ---------- */
async function loadProgress(childId: string, subjectId: string): Promise<SubjectProgress | null> {
  try {
    const { data } = await (supabase as any)
      .from('learning_progress')
      .select('level, xp, streak, badges, lessons_completed, topics_covered, last_played')
      .eq('learner_id', childId).eq('subject_id', subjectId).maybeSingle();
    if (data) return {
      level: data.level, xp: data.xp, streak: data.streak,
      badges: data.badges ?? [], lessonsCompleted: data.lessons_completed,
      topicsCovered: data.topics_covered ?? [], lastPlayed: data.last_played,
    };
  } catch { /* fall through */ }
  return readLocalProgress(childId, subjectId);
}
async function saveProgress(childId: string, subjectId: string, subjectName: string, p: SubjectProgress) {
  writeLocalProgress(childId, subjectId, p);
  try {
    await (supabase as any).from('learning_progress').upsert({
      learner_id: childId, subject_id: subjectId, subject_name: subjectName,
      level: p.level, xp: p.xp, streak: p.streak, badges: p.badges,
      lessons_completed: p.lessonsCompleted, topics_covered: p.topicsCovered,
      last_played: p.lastPlayed ?? new Date().toISOString(),
    }, { onConflict: 'learner_id,subject_id' });
  } catch (e) { console.warn('progress save failed', e); }
}
async function saveResponse(row: {
  learner_id: string; subject_id: string; subject_name: string;
  source: 'assessment' | 'exercise';
  question: string; selected_answer: string | null; correct_answer: string | null;
  is_correct: boolean; difficulty: number | null; strand: string | null;
  explanation: string | null; level_at_time: number | null;
}) {
  try { await (supabase as any).from('learning_responses').insert(row); }
  catch (e) { console.warn('response save failed', e); }
}
async function loadRecentResponses(childId: string, subjectId: string) {
  try {
    const { data } = await (supabase as any)
      .from('learning_responses')
      .select('source, question, is_correct, difficulty, strand, explanation, created_at')
      .eq('learner_id', childId).eq('subject_id', subjectId)
      .order('created_at', { ascending: false }).limit(15);
    return data ?? [];
  } catch { return []; }
}

const bandColor = (avg: number | null) => {
  if (avg == null) return 'bg-muted text-muted-foreground border-muted';
  if (avg >= 75) return 'bg-success/10 text-success border-success/20';
  if (avg >= 50) return 'bg-info/10 text-info border-info/20';
  if (avg >= 30) return 'bg-warning/10 text-warning border-warning/20';
  return 'bg-destructive/10 text-destructive border-destructive/20';
};
const bandLabel = (avg: number | null) => {
  if (avg == null) return 'No marks yet';
  if (avg >= 75) return 'Exceeding';
  if (avg >= 50) return 'Meeting';
  if (avg >= 30) return 'Approaching';
  return 'Below';
};

export default function ParentLearningPathTab({ child }: Props) {
  const { toast } = useToast();
  const { hasAccess, activeEntitlement, isLoading: accessLoading, refetch: refetchAccess } = useLearningPathAccess(child.id);

  const { data: areas = [] } = useQuery({
    queryKey: ['parent-lp-areas', child.grade, child.id],
    queryFn: async () => {
      const { data } = await supabase.from('learning_areas')
        .select('id, name, grade').eq('grade', child.grade).eq('is_active', true);
      return data || [];
    },
    enabled: hasAccess,
  });

  const { data: scores = [] } = useQuery({
    queryKey: ['parent-lp-scores', child.id],
    queryFn: async () => {
      const { data } = await supabase.from('scores')
        .select('learning_area_id, score').eq('learner_id', child.id);
      return data || [];
    },
    enabled: hasAccess,
  });

  // progress per subject (DB-backed)
  const [progressBySubject, setProgressBySubject] = useState<Record<string, SubjectProgress | null>>({});
  useEffect(() => {
    if (!areas.length) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        areas.map(async a => [a.id, await loadProgress(child.id, a.id)] as const)
      );
      if (!cancelled) setProgressBySubject(Object.fromEntries(entries));
    })();
    return () => { cancelled = true; };
  }, [areas, child.id]);

  const subjectStats = useMemo(() => {
    const map = new Map<string, number[]>();
    scores.forEach((s: any) => {
      if (!map.has(s.learning_area_id)) map.set(s.learning_area_id, []);
      map.get(s.learning_area_id)!.push(Number(s.score));
    });
    return areas.map(a => {
      const list = map.get(a.id) || [];
      const avg = list.length ? Math.round(list.reduce((x, y) => x + y, 0) / list.length) : null;
      return { id: a.id, name: a.name, avg, progress: progressBySubject[a.id] ?? null };
    }).sort((a, b) => (a.avg ?? 999) - (b.avg ?? 999));
  }, [areas, scores, progressBySubject]);

  // ---------- Adventure dialog state ----------
  const [open, setOpen] = useState(false);
  const [activeSubject, setActiveSubject] = useState<{ id: string; name: string; avg: number | null } | null>(null);
  const [stage, setStage] = useState<'intro' | 'assessment' | 'lesson' | 'celebrate' | 'revision' | 'revision-done'>('intro');
  const [progress, setProgress] = useState<SubjectProgress | null>(null);

  const [loading, setLoading] = useState(false);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [assessIdx, setAssessIdx] = useState(0);
  const [assessAnswers, setAssessAnswers] = useState<number[]>([]);
  const [assessSelected, setAssessSelected] = useState<number | null>(null);
  const [assessShowFeedback, setAssessShowFeedback] = useState(false);

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [lessonPhase, setLessonPhase] = useState<'story' | 'lesson' | 'worked' | 'exercises'>('story');
  const [exIdx, setExIdx] = useState(0);
  const [exSelected, setExSelected] = useState<string | null>(null);
  const [exShowFeedback, setExShowFeedback] = useState(false);
  const [exCorrect, setExCorrect] = useState(0);
  const [showHint, setShowHint] = useState(false);

  // Revision test state (KPSEA / KJSEA)
  const [revision, setRevision] = useState<RevisionTest | null>(null);
  const [revIdx, setRevIdx] = useState(0);
  const [revAnswers, setRevAnswers] = useState<number[]>([]);
  const [revSelected, setRevSelected] = useState<number | null>(null);
  const [revShowFeedback, setRevShowFeedback] = useState(false);

  const gradeNum = parseInt(String(child.grade).replace(/\D/g, ''), 10);
  const examType: 'KPSEA' | 'KJSEA' | null =
    gradeNum === 6 ? 'KPSEA' : gradeNum === 9 ? 'KJSEA' : null;

  // Auto-close adventure & re-check access when entitlement expires.
  useEffect(() => {
    if (!activeEntitlement?.expires_at) return;
    const ms = new Date(activeEntitlement.expires_at).getTime() - Date.now();
    if (ms <= 0) return;
    const t = setTimeout(() => {
      setOpen(false);
      refetchAccess();
      toast({
        title: 'Learning Path expired',
        description: 'Your weekly access has ended. Renew with KES 50 to continue.',
      });
    }, Math.min(ms, 2_147_483_000));
    return () => clearTimeout(t);
  }, [activeEntitlement?.expires_at, refetchAccess, toast]);

  // Safety: if access is revoked while dialog is open, close it.
  useEffect(() => {
    if (!accessLoading && !hasAccess && open) setOpen(false);
  }, [hasAccess, accessLoading, open]);

  const startAdventure = async (s: { id: string; name: string; avg: number | null }) => {
    setActiveSubject(s);
    const p = await loadProgress(child.id, s.id);
    setProgress(p);
    setAssessment(null); setAssessIdx(0); setAssessAnswers([]); setAssessSelected(null); setAssessShowFeedback(false);
    setLesson(null); setLessonPhase('story'); setExIdx(0); setExSelected(null); setExShowFeedback(false); setExCorrect(0); setShowHint(false);
    setOpen(true);
    if (p) { setStage('lesson'); loadLesson(s, p); }
    else setStage('intro');
  };

  /* ---------- API calls ---------- */
  const callFn = async (mode: string, extra: Record<string, any> = {}) => {
    const subj = activeSubject ?? extra._subject;
    const { data, error } = await supabase.functions.invoke('parent-learning-guide', {
      body: {
        learnerName: child.full_name,
        grade: child.grade,
        subject: subj?.name ?? extra.subjectName,
        averageScore: subj?.avg ?? null,
        mode,
        ...extra,
      },
    });
    if (error) throw error;
    return data;
  };

  const startAssessment = async () => {
    if (!activeSubject) return;
    setLoading(true); setStage('assessment');
    try {
      const res = await callFn('assessment');
      const a = (res as any)?.data as Assessment;
      if (!a?.questions?.length) throw new Error('No questions returned');
      setAssessment(a);
      setAssessIdx(0); setAssessAnswers([]); setAssessSelected(null); setAssessShowFeedback(false);
    } catch (e: any) {
      toast({ title: 'Could not start placement quiz', description: e.message, variant: 'destructive' });
      setStage('intro');
    } finally { setLoading(false); }
  };

  const loadLesson = async (
    subj: { id: string; name: string; avg: number | null } | null = activeSubject,
    p: SubjectProgress | null = progress,
  ) => {
    if (!subj) return;
    setLoading(true); setStage('lesson');
    setLesson(null); setLessonPhase('story'); setExIdx(0); setExSelected(null); setExShowFeedback(false); setExCorrect(0); setShowHint(false);
    try {
      const recent = await loadRecentResponses(child.id, subj.id);
      const res = await callFn('lesson', {
        _subject: subj,
        level: p?.level ?? Math.max(1, parseInt(String(child.grade).replace(/\D/g, ''), 10) || 4),
        previousTopics: (p?.topicsCovered ?? []).slice(-8),
        recentResponses: recent,
      });
      const l = (res as any)?.data as Lesson;
      if (!l?.exercises?.length) throw new Error('No lesson returned');
      setLesson(l);
    } catch (e: any) {
      toast({ title: 'Could not load lesson', description: e.message, variant: 'destructive' });
    } finally { setLoading(false); }
  };

  /* ---------- Revision (KPSEA / KJSEA) flow ---------- */
  const startRevision = async (s: { id: string; name: string; avg: number | null }) => {
    if (!examType) return;
    setActiveSubject(s);
    setRevision(null); setRevIdx(0); setRevAnswers([]); setRevSelected(null); setRevShowFeedback(false);
    setOpen(true); setStage('revision'); setLoading(true);
    try {
      const res = await callFn('revision', { _subject: s, examType });
      const r = (res as any)?.data as RevisionTest;
      if (!r?.questions?.length) throw new Error('No questions returned');
      setRevision(r);
    } catch (e: any) {
      toast({ title: 'Could not load revision test', description: e.message, variant: 'destructive' });
      setOpen(false);
    } finally { setLoading(false); }
  };

  const submitRevisionAnswer = async () => {
    if (revSelected == null || !revision || !activeSubject) return;
    setRevShowFeedback(true);
    const q = revision.questions[revIdx];
    const isCorrect = revSelected === q.answerIndex;
    await saveResponse({
      learner_id: child.id, subject_id: activeSubject.id, subject_name: activeSubject.name,
      source: 'assessment', question: q.question,
      selected_answer: q.options[revSelected] ?? null,
      correct_answer: q.options[q.answerIndex] ?? null,
      is_correct: isCorrect, difficulty: q.difficulty ?? null,
      strand: q.strand ?? null, explanation: q.explanation ?? null,
      level_at_time: progress?.level ?? gradeNum,
    });
  };
  const nextRevisionQ = () => {
    if (!revision) return;
    const newAns = [...revAnswers, revSelected!];
    setRevAnswers(newAns); setRevSelected(null); setRevShowFeedback(false);
    if (revIdx + 1 >= revision.questions.length) setStage('revision-done');
    else setRevIdx(revIdx + 1);
  };

  /* ---------- Assessment flow ---------- */
  const submitAssessmentAnswer = async () => {
    if (assessSelected == null || !assessment || !activeSubject) return;
    setAssessShowFeedback(true);
    const q = assessment.questions[assessIdx];
    const isCorrect = assessSelected === q.answerIndex;
    // persist this single response (await so it's in DB before next lesson loads)
    await saveResponse({
      learner_id: child.id,
      subject_id: activeSubject.id,
      subject_name: activeSubject.name,
      source: 'assessment',
      question: q.question,
      selected_answer: q.options[assessSelected] ?? null,
      correct_answer: q.options[q.answerIndex] ?? null,
      is_correct: isCorrect,
      difficulty: q.difficulty ?? null,
      strand: q.strand ?? null,
      explanation: q.explanation ?? null,
      level_at_time: progress?.level ?? null,
    });
  };

  const nextAssessmentQ = async () => {
    if (!assessment || !activeSubject) return;
    const newAns = [...assessAnswers, assessSelected!];
    setAssessAnswers(newAns);
    setAssessSelected(null);
    setAssessShowFeedback(false);
    if (assessIdx + 1 >= assessment.questions.length) {
      // adaptive placement based on difficulty-weighted correctness
      const totalWeight = assessment.questions.reduce((a, q) => a + (q.difficulty || 1), 0);
      const earnedWeight = assessment.questions.reduce(
        (a, q, i) => a + ((newAns[i] === q.answerIndex ? (q.difficulty || 1) : 0)), 0,
      );
      const ratio = earnedWeight / Math.max(totalWeight, 1);
      const baseGrade = Math.max(1, parseInt(String(child.grade).replace(/\D/g, ''), 10) || 4);
      const delta = ratio >= 0.85 ? 1 : ratio >= 0.6 ? 0 : ratio >= 0.4 ? -1 : -2;
      const placedLevel = Math.min(9, Math.max(1, baseGrade + delta));
      const correct = assessment.questions.reduce((acc, q, i) => acc + (newAns[i] === q.answerIndex ? 1 : 0), 0);
      const newProg: SubjectProgress = {
        level: placedLevel, xp: 20, streak: 1, badges: ['Pathfinder'],
        lessonsCompleted: 0, topicsCovered: [], lastPlayed: new Date().toISOString(),
      };
      await saveProgress(child.id, activeSubject.id, activeSubject.name, newProg);
      setProgress(newProg);
      setProgressBySubject(prev => ({ ...prev, [activeSubject.id]: newProg }));
      toast({
        title: `Placed at Level ${placedLevel}!`,
        description: `${correct}/${assessment.questions.length} correct. Earned 20 XP and the Pathfinder badge.`,
      });
      loadLesson(activeSubject, newProg);
    } else {
      setAssessIdx(assessIdx + 1);
    }
  };

  /* ---------- Exercise flow ---------- */
  const currentExercise = lesson?.exercises[exIdx];
  const isExerciseCorrect = () => {
    if (!currentExercise || exSelected == null) return false;
    return currentExercise.type === 'mcq'
      ? exSelected === (currentExercise.options?.[currentExercise.answerIndex ?? -1] ?? '')
      : exSelected.trim().toLowerCase() === String(currentExercise.answer).trim().toLowerCase();
  };
  const checkExercise = async () => {
    if (!currentExercise || exSelected == null || !activeSubject || !lesson) return;
    setExShowFeedback(true);
    const correct = isExerciseCorrect();
    if (correct) setExCorrect(c => c + 1);
    await saveResponse({
      learner_id: child.id,
      subject_id: activeSubject.id,
      subject_name: activeSubject.name,
      source: 'exercise',
      question: currentExercise.question,
      selected_answer: exSelected,
      correct_answer: currentExercise.type === 'mcq'
        ? (currentExercise.options?.[currentExercise.answerIndex ?? -1] ?? null)
        : currentExercise.answer,
      is_correct: correct,
      difficulty: currentExercise.difficulty ?? null,
      strand: lesson.strand ?? null,
      explanation: currentExercise.explanation ?? null,
      level_at_time: lesson.level ?? null,
    });
  };
  const nextExercise = async () => {
    if (!lesson || !activeSubject) return;
    setExSelected(null); setExShowFeedback(false); setShowHint(false);
    if (exIdx + 1 >= lesson.exercises.length) {
      const earned = Math.round((lesson.xpReward ?? 50) * (exCorrect / lesson.exercises.length || 0.2));
      const newProg: SubjectProgress = {
        level: progress?.level ?? lesson.level,
        xp: (progress?.xp ?? 0) + earned,
        streak: (progress?.streak ?? 0) + 1,
        badges: Array.from(new Set([...(progress?.badges ?? []), lesson.badge])),
        lessonsCompleted: (progress?.lessonsCompleted ?? 0) + 1,
        topicsCovered: [...(progress?.topicsCovered ?? []), `${lesson.strand}: ${lesson.subStrand}`],
        lastPlayed: new Date().toISOString(),
      };
      if (exCorrect >= 4) newProg.level = Math.min(9, newProg.level + 1);
      else if (exCorrect <= 1) newProg.level = Math.max(1, newProg.level - 1);
      await saveProgress(child.id, activeSubject.id, activeSubject.name, newProg);
      setProgress(newProg);
      setProgressBySubject(prev => ({ ...prev, [activeSubject.id]: newProg }));
      setStage('celebrate');
    } else {
      setExIdx(exIdx + 1);
    }
  };

  /* ---------- Sticky footer action button ---------- */
  const FooterAction = () => {
    if (loading) return null;
    if (stage === 'intro') {
      return <Button size="lg" className="w-full" onClick={startAssessment}>
        <Brain className="h-4 w-4 mr-2" /> Start Brain Quiz
      </Button>;
    }
    if (stage === 'assessment' && assessment) {
      return !assessShowFeedback
        ? <Button className="w-full" size="lg" onClick={submitAssessmentAnswer} disabled={assessSelected == null}>Check Answer</Button>
        : <Button className="w-full" size="lg" onClick={nextAssessmentQ}>
            {assessIdx + 1 >= assessment.questions.length ? 'See My Level' : 'Next Question'}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>;
    }
    if (stage === 'lesson' && lesson) {
      if (lessonPhase === 'story') return <Button className="w-full" size="lg" onClick={() => setLessonPhase('lesson')}>Let's go! <ArrowRight className="h-4 w-4 ml-1" /></Button>;
      if (lessonPhase === 'lesson') return <Button className="w-full" size="lg" onClick={() => setLessonPhase('worked')}>Show me an example <ArrowRight className="h-4 w-4 ml-1" /></Button>;
      if (lessonPhase === 'worked') return <Button className="w-full" size="lg" onClick={() => setLessonPhase('exercises')}>I'm ready to try! <Target className="h-4 w-4 ml-1" /></Button>;
      if (lessonPhase === 'exercises' && currentExercise) {
        return !exShowFeedback
          ? <Button className="w-full" size="lg" onClick={checkExercise} disabled={exSelected == null || exSelected === ''}>Check</Button>
          : <Button className="w-full" size="lg" onClick={nextExercise}>
              {exIdx + 1 >= lesson.exercises.length ? 'Finish Lesson 🏆' : 'Next Exercise'}
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>;
      }
    }
    if (stage === 'celebrate') {
      return <div className="flex gap-2 w-full">
        <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Done</Button>
        <Button className="flex-1" onClick={() => loadLesson()}><RotateCcw className="h-4 w-4 mr-1" /> Next Lesson</Button>
      </div>;
    }
    if (stage === 'revision' && revision) {
      return !revShowFeedback
        ? <Button className="w-full" size="lg" onClick={submitRevisionAnswer} disabled={revSelected == null}>Check Answer</Button>
        : <Button className="w-full" size="lg" onClick={nextRevisionQ}>
            {revIdx + 1 >= revision.questions.length ? 'See My Score' : 'Next Question'}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>;
    }
    if (stage === 'revision-done') {
      return <Button className="w-full" size="lg" onClick={() => setOpen(false)}>Done</Button>;
    }
    return null;
  };

  const HeaderBar = () => (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-3 border border-primary/15">
      <div className="flex items-center gap-2">
        <div className="h-9 w-9 rounded-full bg-primary/15 grid place-items-center text-primary">
          <Brain className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{TUTOR_NAME}</div>
          <div className="text-sm font-semibold">{activeSubject?.name}</div>
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs">
        <span className="flex items-center gap-1"><Trophy className="h-3.5 w-3.5 text-warning" /> Lv {progress?.level ?? '—'}</span>
        <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 text-amber-500" /> {progress?.xp ?? 0} XP</span>
        <span className="flex items-center gap-1"><Award className="h-3.5 w-3.5 text-primary" /> {progress?.badges?.length ?? 0}</span>
      </div>
    </div>
  );

  if (accessLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!hasAccess) return <LearningPathPaywall child={child} />;

  return (
    <div className="space-y-4">
      <Card className="shadow-card border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            CBC Learning Adventure for {child.full_name.split(' ')[0]}
          </CardTitle>
          <CardDescription className="text-xs">
            Tap a subject. {TUTOR_NAME} will first check {child.full_name.split(' ')[0]}'s level
            with a quick fun quiz, then unlock interactive Kenya CBC lessons with games,
            exercises and rewards.
          </CardDescription>
        </CardHeader>
      </Card>

      {activeEntitlement?.expires_at && (
        <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-foreground/80 flex items-center justify-between">
          <span>⏳ Access active until <strong>{new Date(activeEntitlement.expires_at).toLocaleString()}</strong>. Auto-closes on expiry.</span>
        </div>
      )}

      {subjectStats.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          No learning areas found for Grade {child.grade} yet.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {subjectStats.map(s => (
            <Card key={s.id} className="shadow-card hover:shadow-md transition-shadow overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{s.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.avg != null ? `Class avg: ${s.avg}%` : 'No marks yet'}
                      {s.progress && ` · Lv ${s.progress.level} · ${s.progress.xp} XP`}
                    </div>
                  </div>
                  <Badge className={cn('text-[10px] shrink-0', bandColor(s.avg))}>{bandLabel(s.avg)}</Badge>
                </div>
                {s.progress && (
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Trophy className="h-3 w-3 text-warning" /> {s.progress.lessonsCompleted} lessons
                    <span className="mx-1">·</span>
                    <Star className="h-3 w-3 text-amber-500" /> {s.progress.streak} streak
                    {s.progress.badges.length > 0 && (<><span className="mx-1">·</span><Award className="h-3 w-3 text-primary" /> {s.progress.badges.length}</>)}
                  </div>
                )}
                <Button size="sm" className="w-full" onClick={() => startAdventure(s)}>
                  {s.progress ? <><BookOpen className="h-3.5 w-3.5 mr-1" /> Continue Adventure</> : <><Brain className="h-3.5 w-3.5 mr-1" /> Start with Placement Quiz</>}
                </Button>
                {examType && (
                  <Button size="sm" variant="outline" className="w-full" onClick={() => startRevision(s)}>
                    <GraduationCap className="h-3.5 w-3.5 mr-1" /> {examType} Revision Test
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-5 pt-5 pb-2 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              {activeSubject?.name} · Learning Adventure
            </DialogTitle>
            <DialogDescription className="text-xs">
              Personalised for {child.full_name} — Grade {child.grade}, Kenya CBC (KICD).
            </DialogDescription>
          </DialogHeader>

          <div className="px-5 pt-1 shrink-0"><HeaderBar /></div>

          <ScrollArea className="flex-1 min-h-0 px-5 py-3">
            {loading && (
              <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> {TUTOR_NAME.split(' ')[0]} {TUTOR_NAME.split(' ')[1]} is preparing something fun…
              </div>
            )}

            {/* INTRO */}
            {!loading && stage === 'intro' && (
              <div className="space-y-4 text-center py-4">
                <div className="mx-auto h-16 w-16 rounded-full bg-primary/15 grid place-items-center">
                  <Brain className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-lg font-display font-bold">Hi {child.full_name.split(' ')[0]}! 👋</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  I'm <strong>{TUTOR_NAME}</strong>. Let's play a quick <strong>5-question brain quiz</strong> grounded in
                  the Kenya CBC for Grade {child.grade}. It helps me find your perfect level —
                  not too easy, not too hard.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted-foreground">
                  <Badge variant="secondary"><Target className="h-3 w-3 mr-1" /> 5 Questions</Badge>
                  <Badge variant="secondary"><Star className="h-3 w-3 mr-1" /> +20 XP</Badge>
                  <Badge variant="secondary"><Award className="h-3 w-3 mr-1" /> Pathfinder Badge</Badge>
                </div>
              </div>
            )}

            {/* ASSESSMENT */}
            {!loading && stage === 'assessment' && assessment && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">Question {assessIdx + 1} of {assessment.questions.length}</span>
                  <span className="text-muted-foreground">{assessment.questions[assessIdx].strand}</span>
                </div>
                <Progress value={((assessIdx + (assessShowFeedback ? 1 : 0)) / assessment.questions.length) * 100} className="h-2" />
                <Card className="border-primary/20">
                  <CardContent className="p-4 space-y-3">
                    <p className="text-sm font-medium leading-relaxed">{assessment.questions[assessIdx].question}</p>
                    <div className="grid gap-2">
                      {assessment.questions[assessIdx].options.map((opt, i) => {
                        const correct = i === assessment.questions[assessIdx].answerIndex;
                        const picked = assessSelected === i;
                        return (
                          <Button
                            key={i}
                            variant={picked ? 'default' : 'outline'}
                            size="sm"
                            className={cn('justify-start h-auto py-2 text-left whitespace-normal',
                              assessShowFeedback && correct && 'border-success bg-success/10 text-success hover:bg-success/10',
                              assessShowFeedback && picked && !correct && 'border-destructive bg-destructive/10 text-destructive hover:bg-destructive/10')}
                            disabled={assessShowFeedback}
                            onClick={() => setAssessSelected(i)}>
                            <span className="font-bold mr-2">{String.fromCharCode(65 + i)}.</span>
                            <span className="flex-1">{opt}</span>
                            {assessShowFeedback && correct && <CheckCircle2 className="h-4 w-4 ml-2" />}
                            {assessShowFeedback && picked && !correct && <XCircle className="h-4 w-4 ml-2" />}
                          </Button>
                        );
                      })}
                    </div>
                    {assessShowFeedback && (
                      <div className="text-xs rounded-md bg-muted p-3 leading-relaxed">
                        💡 {assessment.questions[assessIdx].explanation}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* LESSON */}
            {!loading && stage === 'lesson' && lesson && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-display font-bold">{lesson.title}</h3>
                  <p className="text-xs text-muted-foreground">CBC Strand: {lesson.strand} · {lesson.subStrand} · Level {lesson.level}</p>
                </div>

                {lessonPhase === 'story' && (
                  <Card className="bg-gradient-to-br from-amber-50 to-transparent dark:from-amber-950/20 border-amber-200/50">
                    <CardContent className="p-4 space-y-3">
                      <Badge variant="secondary" className="text-[10px]">📖 Today's Story</Badge>
                      {lesson.imageQueries && lesson.imageQueries.length > 0 && (
                        <div className="grid grid-cols-2 gap-2">
                          {lesson.imageQueries.slice(0, 2).map((q, i) => (
                            <img key={i} src={unsplashUrl(q)} alt={q}
                              loading="lazy"
                              className="w-full h-28 object-cover rounded-md border border-amber-200/40"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                          ))}
                        </div>
                      )}
                      <p className="text-sm leading-relaxed">{lesson.story}</p>
                      <div className="space-y-1 pt-2">
                        <div className="text-xs font-semibold uppercase text-muted-foreground">By the end you can…</div>
                        <ul className="text-sm space-y-1">
                          {lesson.learningGoals.map((g, i) => (
                            <li key={i} className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />{g}</li>
                          ))}
                        </ul>
                      </div>
                      {lesson.videoQuery && (
                        <a href={youtubeSearchUrl(lesson.videoQuery)} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-xs font-medium text-primary hover:underline pt-1">
                          🎥 Watch a Kenyan video about this
                        </a>
                      )}
                    </CardContent>
                  </Card>
                )}

                {lessonPhase === 'lesson' && (
                  <Card>
                    <CardContent className="p-4 space-y-4">
                      <Badge variant="secondary" className="text-[10px]">🧠 Key Words</Badge>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {lesson.vocabulary.map((v, i) => (
                          <div key={i} className="rounded-md border bg-muted/30 p-2 text-xs">
                            <span className="font-semibold text-primary">{v.term}</span> — {v.meaning}
                          </div>
                        ))}
                      </div>
                      <div className="space-y-3 pt-2">
                        {lesson.lessonSteps.map((s, i) => (
                          <div key={i} className="rounded-lg border p-3 bg-card">
                            <div className="text-sm font-semibold flex items-center gap-2">
                              <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground grid place-items-center text-xs">{i + 1}</span>
                              {s.title}
                            </div>
                            <p className="text-sm mt-1 leading-relaxed">{s.explanation}</p>
                            {s.example && <p className="text-xs mt-1 italic text-muted-foreground">e.g. {s.example}</p>}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {lessonPhase === 'worked' && (
                  <Card className="border-info/30">
                    <CardContent className="p-4 space-y-3">
                      <Badge variant="secondary" className="text-[10px]">✏️ Worked Example</Badge>
                      <p className="text-sm font-medium">{lesson.workedExample.problem}</p>
                      <ol className="text-sm space-y-1 list-decimal pl-5">
                        {lesson.workedExample.steps.map((s, i) => <li key={i}>{s}</li>)}
                      </ol>
                      <div className="rounded-md bg-success/10 border border-success/20 text-success p-2 text-sm font-semibold">
                        ✅ Answer: {lesson.workedExample.answer}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {lessonPhase === 'exercises' && currentExercise && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">Exercise {exIdx + 1} of {lesson.exercises.length}</span>
                      <span className="flex items-center gap-1"><Star className="h-3 w-3 text-amber-500" /> {exCorrect} correct</span>
                    </div>
                    <Progress value={((exIdx + (exShowFeedback ? 1 : 0)) / lesson.exercises.length) * 100} className="h-2" />
                    <Card className="border-primary/30">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-[10px]">Difficulty {currentExercise.difficulty}/5</Badge>
                          <Button size="sm" variant="ghost" className="h-7 text-xs"
                            onClick={() => setShowHint(true)} disabled={showHint || exShowFeedback}>
                            💡 Hint
                          </Button>
                        </div>
                        <p className="text-sm font-medium">{currentExercise.question}</p>
                        {showHint && !exShowFeedback && (
                          <div className="text-xs rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 p-2">
                            🤫 {currentExercise.hint}
                          </div>
                        )}
                        {currentExercise.type === 'mcq' && currentExercise.options ? (
                          <div className="grid gap-2">
                            {currentExercise.options.map((opt, i) => {
                              const correctOpt = currentExercise.options![currentExercise.answerIndex ?? -1];
                              const isCorrect = opt === correctOpt;
                              const picked = exSelected === opt;
                              return (
                                <Button
                                  key={i}
                                  variant={picked ? 'default' : 'outline'}
                                  size="sm"
                                  className={cn('justify-start h-auto py-2 text-left whitespace-normal',
                                    exShowFeedback && isCorrect && 'border-success bg-success/10 text-success hover:bg-success/10',
                                    exShowFeedback && picked && !isCorrect && 'border-destructive bg-destructive/10 text-destructive hover:bg-destructive/10')}
                                  disabled={exShowFeedback}
                                  onClick={() => setExSelected(opt)}>
                                  <span className="font-bold mr-2">{String.fromCharCode(65 + i)}.</span>
                                  <span className="flex-1">{opt}</span>
                                </Button>
                              );
                            })}
                          </div>
                        ) : (
                          <Input
                            placeholder="Type your answer…"
                            value={exSelected ?? ''}
                            disabled={exShowFeedback}
                            onChange={e => setExSelected(e.target.value)}
                          />
                        )}
                        {exShowFeedback && (
                          <div className={cn('text-sm rounded-md p-3 leading-relaxed border',
                            isExerciseCorrect()
                              ? 'bg-success/10 border-success/20 text-success'
                              : 'bg-destructive/10 border-destructive/20 text-destructive')}>
                            {isExerciseCorrect() ? '🎉 Correct! ' : `❌ Not quite. Answer: ${currentExercise.answer}. `}
                            {currentExercise.explanation}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            )}

            {/* CELEBRATE */}
            {!loading && stage === 'celebrate' && lesson && (
              <div className="space-y-4 text-center py-4">
                <div className="mx-auto h-20 w-20 rounded-full bg-warning/15 grid place-items-center">
                  <PartyPopper className="h-10 w-10 text-warning" />
                </div>
                <h3 className="text-xl font-display font-bold">Lesson Complete!</h3>
                <p className="text-sm text-muted-foreground">
                  You scored <strong>{exCorrect} / {lesson.exercises.length}</strong> in <em>{lesson.subStrand}</em>.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Badge className="bg-warning/15 text-warning border-warning/30"><Star className="h-3 w-3 mr-1" /> +{Math.round((lesson.xpReward ?? 50) * (exCorrect / lesson.exercises.length || 0.2))} XP</Badge>
                  <Badge className="bg-primary/15 text-primary border-primary/30"><Award className="h-3 w-3 mr-1" /> {lesson.badge}</Badge>
                  <Badge variant="secondary">Level {progress?.level}</Badge>
                </div>
                <Card className="text-left">
                  <CardContent className="p-4 space-y-2">
                    <Badge variant="secondary" className="text-[10px]">🌍 Real-World Challenge</Badge>
                    <p className="text-sm">{lesson.realWorldChallenge}</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* REVISION (KPSEA / KJSEA) */}
            {!loading && stage === 'revision' && revision && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{revision.examType} · Q{revIdx + 1} of {revision.questions.length}</span>
                  <span className="text-muted-foreground">{revision.questions[revIdx].strand}</span>
                </div>
                <Progress value={((revIdx + (revShowFeedback ? 1 : 0)) / revision.questions.length) * 100} className="h-2" />
                <Card className="border-primary/20">
                  <CardContent className="p-4 space-y-3">
                    <p className="text-sm font-medium leading-relaxed">{revision.questions[revIdx].question}</p>
                    <div className="grid gap-2">
                      {revision.questions[revIdx].options.map((opt, i) => {
                        const correct = i === revision.questions[revIdx].answerIndex;
                        const picked = revSelected === i;
                        return (
                          <Button key={i}
                            variant={picked ? 'default' : 'outline'} size="sm"
                            className={cn('justify-start h-auto py-2 text-left whitespace-normal',
                              revShowFeedback && correct && 'border-success bg-success/10 text-success hover:bg-success/10',
                              revShowFeedback && picked && !correct && 'border-destructive bg-destructive/10 text-destructive hover:bg-destructive/10')}
                            disabled={revShowFeedback}
                            onClick={() => setRevSelected(i)}>
                            <span className="font-bold mr-2">{String.fromCharCode(65 + i)}.</span>
                            <span className="flex-1">{opt}</span>
                            {revShowFeedback && correct && <CheckCircle2 className="h-4 w-4 ml-2" />}
                            {revShowFeedback && picked && !correct && <XCircle className="h-4 w-4 ml-2" />}
                          </Button>
                        );
                      })}
                    </div>
                    {revShowFeedback && (
                      <div className="text-xs rounded-md bg-muted p-3 leading-relaxed">
                        💡 {revision.questions[revIdx].explanation}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {!loading && stage === 'revision-done' && revision && (
              <div className="space-y-4 text-center py-4">
                <div className="mx-auto h-20 w-20 rounded-full bg-primary/15 grid place-items-center">
                  <GraduationCap className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-xl font-display font-bold">{revision.examType} Revision Complete</h3>
                {(() => {
                  const correct = revision.questions.reduce((a, q, i) => a + (revAnswers[i] === q.answerIndex ? 1 : 0), 0);
                  const pct = Math.round((correct / revision.questions.length) * 100);
                  return (
                    <>
                      <p className="text-sm text-muted-foreground">
                        Score: <strong>{correct} / {revision.questions.length}</strong> ({pct}%)
                      </p>
                      <Badge className={cn(bandColor(pct))}>{bandLabel(pct)}</Badge>
                    </>
                  );
                })()}
              </div>
            )}
          </ScrollArea>

          {/* Sticky footer — always visible action button */}
          <div className="border-t bg-background px-5 py-3 shrink-0">
            <FooterAction />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
