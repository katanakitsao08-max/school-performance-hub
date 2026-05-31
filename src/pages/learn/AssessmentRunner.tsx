// Timed assessment with auto-marking and CBC competency assignment.
// Handles both single-topic practice (?practice topic) and stored assessments.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Clock, CheckCircle2, XCircle, Award, Download } from "lucide-react";
import {
  markAttempt, recomputeTopicMastery, bumpStreak, evaluateBadgesAfterAttempt,
  COMPETENCY_LABEL, COMPETENCY_COLOR,
  type LearningQuestion, type LearningAssessment, type LearningTopic, type GivenAnswer,
} from "@/lib/learning-cms";
import { downloadCertificatePdf } from "@/lib/certificate-pdf";

type Mode =
  | { kind: "assessment"; assessment: LearningAssessment }
  | { kind: "practice"; topic: LearningTopic };

export default function AssessmentRunner({ practice = false }: { practice?: boolean }) {
  const { id = "", topicId = "" } = useParams();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [mode, setMode] = useState<Mode | null>(null);
  const [questions, setQuestions] = useState<LearningQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [submittedResult, setSubmittedResult] = useState<ReturnType<typeof markAttempt> | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const startedAt = useRef<number>(Date.now());

  // Load assessment or practice topic + its questions.
  useEffect(() => {
    (async () => {
      if (practice) {
        const [t, q] = await Promise.all([
          supabase.from("learning_topics").select("*").eq("id", topicId).maybeSingle(),
          supabase.from("learning_questions").select("*").eq("topic_id", topicId).eq("is_active", true),
        ]);
        if (!t.data) return;
        setMode({ kind: "practice", topic: t.data as LearningTopic });
        setQuestions((q.data || []) as LearningQuestion[]);
      } else {
        const a = await supabase.from("learning_assessments").select("*").eq("id", id).maybeSingle();
        if (!a.data) return;
        const assessment = a.data as LearningAssessment;
        setMode({ kind: "assessment", assessment });
        const ids = assessment.question_ids || [];
        if (ids.length) {
          const q = await supabase.from("learning_questions").select("*").in("id", ids);
          // Preserve admin-chosen order:
          const byId = new Map(((q.data || []) as LearningQuestion[]).map(x => [x.id, x]));
          setQuestions(ids.map(qid => byId.get(qid)).filter(Boolean) as LearningQuestion[]);
        }
        setSecondsLeft(assessment.duration_minutes * 60);
      }
    })();
  }, [id, topicId, practice]);

  // Countdown timer for stored assessments.
  useEffect(() => {
    if (secondsLeft === null) return;
    if (submittedResult) return;
    const t = setInterval(() => {
      setSecondsLeft(s => {
        if (s === null) return s;
        if (s <= 1) { clearInterval(t); submit(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft !== null, submittedResult]);

  const totalMarks = useMemo(() => questions.reduce((s, q) => s + (q.marks || 1), 0), [questions]);

  if (!mode || (questions.length === 0 && !submittedResult)) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" /></div>;
  }

  const title = mode.kind === "assessment" ? mode.assessment.title : `Practice: ${mode.topic.title}`;
  const subjectSlug = mode.kind === "assessment" ? (mode.assessment.subject_slug || "") : mode.topic.subject_slug;
  const grade = mode.kind === "assessment" ? mode.assessment.grade : mode.topic.grade;
  const passPct = mode.kind === "assessment" ? mode.assessment.pass_percent : 50;

  const submit = async () => {
    if (submittedResult) return;
    const given: GivenAnswer[] = questions.map(q => ({ question_id: q.id, given: answers[q.id] || [] }));
    const result = markAttempt(questions, given);
    setSubmittedResult(result);

    if (!user) return;
    const duration = Math.round((Date.now() - startedAt.current) / 1000);
    const passed = result.score_percent >= passPct;

    // Persist attempt
    const { data: ins } = await supabase.from("learning_attempts").insert({
      user_id: user.id,
      assessment_id: mode.kind === "assessment" ? mode.assessment.id : null,
      topic_id: mode.kind === "practice" ? mode.topic.id : null,
      subject_slug: subjectSlug || null,
      grade,
      submitted_at: new Date().toISOString(),
      duration_seconds: duration,
      total_marks: result.total_marks,
      earned_marks: result.earned_marks,
      score_percent: result.score_percent,
      competency_level: result.competency_level,
      answers: result.answers as any,
      passed,
    }).select("id").maybeSingle();

    // Roll up mastery on the practice topic (or each topic in the assessment).
    if (mode.kind === "practice") {
      await recomputeTopicMastery({
        user_id: user.id, topic_id: mode.topic.id,
        subject_slug: subjectSlug, grade, add_seconds: duration,
      });
    } else {
      // For multi-topic assessments, roll up per topic from question.topic_id.
      const byTopic = new Map<string, { marks: number; earned: number }>();
      for (const q of questions) {
        const m = result.answers.find(x => x.question_id === q.id);
        const row = byTopic.get(q.topic_id) || { marks: 0, earned: 0 };
        row.marks += q.marks || 1;
        row.earned += m?.marks_earned || 0;
        byTopic.set(q.topic_id, row);
      }
      for (const [tid, row] of byTopic) {
        if (row.marks <= 0) continue;
        // Find subject for this topic
        const { data: tRow } = await supabase.from("learning_topics").select("subject_slug, grade").eq("id", tid).maybeSingle();
        if (!tRow) continue;
        // Insert a synthetic per-topic attempt then recompute mastery
        const pct = Math.round((row.earned / row.marks) * 100);
        await supabase.from("learning_attempts").insert({
          user_id: user.id, topic_id: tid, subject_slug: tRow.subject_slug, grade: tRow.grade,
          submitted_at: new Date().toISOString(), duration_seconds: 0,
          total_marks: row.marks, earned_marks: row.earned,
          score_percent: pct,
          competency_level: pct >= 80 ? "exceeding" : pct >= 60 ? "meeting" : pct >= 40 ? "approaching" : "emerging",
          answers: [], passed: pct >= 50,
        });
        await recomputeTopicMastery({
          user_id: user.id, topic_id: tid,
          subject_slug: tRow.subject_slug, grade: tRow.grade, add_seconds: 0,
        });
      }
    }

    await bumpStreak(user.id);
    await evaluateBadgesAfterAttempt(user.id);

    toast({
      title: passed ? "Well done!" : "Attempt recorded",
      description: `You scored ${result.score_percent.toFixed(1)}% — ${COMPETENCY_LABEL[result.competency_level]}.`,
    });
  };

  if (submittedResult) {
    return <ResultsView
      title={title}
      result={submittedResult}
      passPct={passPct}
      questions={questions}
      learnerName={profile?.full_name || "Learner"}
      grade={grade}
      onAgain={() => { setSubmittedResult(null); setAnswers({}); setSecondsLeft(mode.kind === "assessment" ? mode.assessment.duration_minutes * 60 : null); startedAt.current = Date.now(); }}
    />;
  }

  return (
    <div className="min-h-screen bg-[hsl(140_30%_97%)] pb-24">
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3 max-w-3xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4" /></Button>
          <div className="flex-1 min-w-0">
            <p className="font-semibold leading-tight truncate">{title}</p>
            <p className="text-[11px] text-muted-foreground">{questions.length} questions · {totalMarks} marks · pass {passPct}%</p>
          </div>
          {secondsLeft !== null && (
            <Badge variant={secondsLeft < 60 ? "destructive" : "outline"} className="font-mono">
              <Clock className="w-3 h-3 mr-1" /> {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
            </Badge>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        {questions.map((q, idx) => (
          <Card key={q.id}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start gap-2">
                <span className="font-bold text-primary">{idx + 1}.</span>
                <p className="font-medium flex-1">{q.prompt}</p>
                <Badge variant="outline" className="text-[10px]">{q.marks} mk</Badge>
              </div>
              <QuestionInput q={q} value={answers[q.id] || []} onChange={v => setAnswers(a => ({ ...a, [q.id]: v }))} />
            </CardContent>
          </Card>
        ))}
        <Button size="lg" className="w-full" onClick={submit}>Submit & Auto-mark</Button>
      </main>
    </div>
  );
}

function QuestionInput({ q, value, onChange }: { q: LearningQuestion; value: string[]; onChange: (v: string[]) => void }) {
  if (q.question_type === "short_answer") {
    return <Input value={value[0] || ""} onChange={e => onChange([e.target.value])} placeholder="Type your answer" />;
  }
  const opts = q.question_type === "true_false"
    ? [{ id: "true", text: "True" }, { id: "false", text: "False" }]
    : (q.options as Array<{ id: string; text: string }>);
  const multi = q.question_type === "multi_select";
  return (
    <div className="space-y-1.5">
      {opts.map(o => {
        const checked = value.includes(o.id);
        return (
          <label key={o.id} className={`flex items-center gap-2 p-2 rounded border cursor-pointer ${checked ? "bg-primary/5 border-primary" : "border-border hover:bg-muted/50"}`}>
            <input
              type={multi ? "checkbox" : "radio"}
              name={`q-${q.id}`}
              checked={checked}
              onChange={() => onChange(multi ? (checked ? value.filter(x => x !== o.id) : [...value, o.id]) : [o.id])}
            />
            <span className="text-sm">{o.text}</span>
          </label>
        );
      })}
    </div>
  );
}

function ResultsView({ title, result, passPct, questions, learnerName, grade, onAgain }: {
  title: string;
  result: ReturnType<typeof markAttempt>;
  passPct: number;
  questions: LearningQuestion[];
  learnerName: string;
  grade: string;
  onAgain: () => void;
}) {
  const passed = result.score_percent >= passPct;
  const navigate = useNavigate();
  const byId = new Map(questions.map(q => [q.id, q] as const));
  return (
    <div className="min-h-screen bg-[hsl(140_30%_97%)] pb-20">
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3 max-w-3xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate("/learn")}><ArrowLeft className="w-4 h-4" /></Button>
          <p className="font-semibold truncate">Results — {title}</p>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        <Card className={passed ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}>
          <CardContent className="p-5 space-y-3 text-center">
            <Award className={`w-10 h-10 mx-auto ${passed ? "text-emerald-600" : "text-amber-600"}`} />
            <p className="text-3xl font-bold">{result.score_percent.toFixed(1)}%</p>
            <p className="text-sm">{result.earned_marks} of {result.total_marks} marks</p>
            <Badge variant="outline" className={COMPETENCY_COLOR[result.competency_level]}>
              {COMPETENCY_LABEL[result.competency_level]}
            </Badge>
            <Progress value={result.score_percent} className="h-2" />
            <div className="flex flex-wrap gap-2 justify-center pt-1">
              <Button variant="outline" onClick={onAgain}>Try again</Button>
              {(result.competency_level === "meeting" || result.competency_level === "exceeding") && (
                <Button onClick={() => downloadCertificatePdf({
                  learnerName, grade, title,
                  competency: COMPETENCY_LABEL[result.competency_level],
                  scorePercent: result.score_percent,
                })}>
                  <Download className="w-4 h-4 mr-1" /> Download certificate
                </Button>
              )}
              <Button variant="ghost" asChild><Link to="/learn">Back to portal</Link></Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-2">
          <h2 className="font-semibold">Review</h2>
          {result.answers.map((a, idx) => {
            const q = byId.get(a.question_id);
            if (!q) return null;
            return (
              <Card key={a.question_id}>
                <CardContent className="p-3 space-y-1">
                  <div className="flex items-start gap-2">
                    {a.correct ? <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5" /> : <XCircle className="w-4 h-4 text-rose-600 mt-0.5" />}
                    <p className="text-sm flex-1"><span className="font-semibold">{idx + 1}.</span> {q.prompt}</p>
                    <Badge variant="outline" className="text-[10px]">{a.marks_earned}/{a.marks_total}</Badge>
                  </div>
                  {q.explanation && <p className="text-xs text-muted-foreground pl-6">{q.explanation}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
