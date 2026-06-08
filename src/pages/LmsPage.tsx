import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen, GraduationCap, ArrowLeft, CheckCircle2, Lock, Play, FileText,
  Award, Calendar, MessageSquare, ClipboardList, Trophy, ExternalLink, Loader2,
} from "lucide-react";
import {
  Course, Module, Lesson, Quiz, QuizQuestion, Assignment, LiveSession,
  toEmbedUrl, markQuestion, markLessonComplete, recordQuizAttempt, LmsLearnerKind,
  evaluateAndAwardBadges,
} from "@/features/lms/api";
import { downloadCertificatePdf } from "@/lib/lms-certificate-pdf";
import { Download } from "lucide-react";

/** Resolve learner_ref + kind for the current user. Parent reads ?child=. */
function useLearnerRef(): { ref: string | null; kind: LmsLearnerKind | null; loading: boolean; gradeHint?: string | null; name?: string | null } {
  const { user, role } = useAuth();
  const [params] = useSearchParams();
  const childId = params.get("child");

  const { data, isLoading } = useQuery({
    queryKey: ["lms-learner-ref", user?.id, role, childId],
    queryFn: async () => {
      if (!user) return { ref: null, kind: null, gradeHint: null, name: null };
      if (role === "independent_learner") {
        const { data: il } = await supabase.from("independent_learners")
          .select("id, grade, full_name").eq("user_id", user.id).maybeSingle();
        return { ref: il?.id ?? null, kind: "independent" as const, gradeHint: il?.grade ?? null, name: il?.full_name ?? null };
      }
      if (role === "parent") {
        if (!childId) return { ref: null, kind: "school" as const, gradeHint: null, name: null };
        const { data: l } = await supabase.from("learners")
          .select("id, grade, full_name").eq("id", childId).maybeSingle();
        return { ref: l?.id ?? null, kind: "school" as const, gradeHint: l?.grade ?? null, name: l?.full_name ?? null };
      }
      return { ref: null, kind: null, gradeHint: null, name: null };
    },
    enabled: !!user,
  });

  return { ref: data?.ref ?? null, kind: data?.kind ?? null, loading: isLoading, gradeHint: data?.gradeHint, name: data?.name };
}

export default function LmsPage() {
  const navigate = useNavigate();
  const { user, role, loading: authLoading } = useAuth();
  const { ref: learnerRef, kind, loading: refLoading, gradeHint, name: learnerName } = useLearnerRef();
  const [tab, setTab] = useState("catalog");
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);

  if (authLoading || refLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }
  if (!user) { navigate("/login"); return null; }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="container mx-auto px-3 sm:px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back"><ArrowLeft className="h-4 w-4" /></Button>
            <GraduationCap className="h-5 w-5 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="font-display font-bold text-sm leading-tight truncate">PerformTrack LMS</p>
              <p className="text-[10px] text-muted-foreground">Courses · Lessons · Quizzes · Certificates</p>
            </div>
          </div>
          {role === "super_admin" && (
            <Button size="sm" variant="outline" onClick={() => navigate("/super-admin/lms")}>Manage Catalog</Button>
          )}
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 max-w-6xl">
        {activeLessonId ? (
          <LessonView lessonId={activeLessonId} learnerRef={learnerRef} kind={kind} onBack={() => setActiveLessonId(null)} />
        ) : activeCourseId ? (
          <CourseView courseId={activeCourseId} learnerRef={learnerRef} learnerName={learnerName}
            onBack={() => setActiveCourseId(null)}
            onOpenLesson={setActiveLessonId} />

        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full grid grid-cols-5 mb-4 h-auto">
              <TabsTrigger value="catalog" className="text-[11px] sm:text-xs flex flex-col gap-1 py-2"><BookOpen className="h-3.5 w-3.5" />Courses</TabsTrigger>
              <TabsTrigger value="assignments" className="text-[11px] sm:text-xs flex flex-col gap-1 py-2"><ClipboardList className="h-3.5 w-3.5" />Tasks</TabsTrigger>
              <TabsTrigger value="live" className="text-[11px] sm:text-xs flex flex-col gap-1 py-2"><Calendar className="h-3.5 w-3.5" />Live</TabsTrigger>
              <TabsTrigger value="progress" className="text-[11px] sm:text-xs flex flex-col gap-1 py-2"><Trophy className="h-3.5 w-3.5" />Progress</TabsTrigger>
              <TabsTrigger value="discussion" className="text-[11px] sm:text-xs flex flex-col gap-1 py-2"><MessageSquare className="h-3.5 w-3.5" />Forum</TabsTrigger>
            </TabsList>
            <TabsContent value="catalog"><CatalogTab gradeHint={gradeHint} onOpen={setActiveCourseId} /></TabsContent>
            <TabsContent value="assignments"><AssignmentsTab learnerRef={learnerRef} /></TabsContent>
            <TabsContent value="live"><LiveTab learnerRef={learnerRef} /></TabsContent>
            <TabsContent value="progress"><ProgressTab learnerRef={learnerRef} learnerName={learnerName} /></TabsContent>
            <TabsContent value="discussion"><div className="text-center text-sm text-muted-foreground py-8">Open a lesson to join its discussion thread.</div></TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}

/* ----------------------------- Catalog ----------------------------- */
function CatalogTab({ gradeHint, onOpen }: { gradeHint?: string | null; onOpen: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [filterGrade, setFilterGrade] = useState<string>(gradeHint || "all");
  useEffect(() => { if (gradeHint) setFilterGrade(gradeHint); }, [gradeHint]);

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ["lms-courses-public"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("lms_courses").select("*").eq("is_published", true).order("sort_order");
      return (data || []) as Course[];
    },
  });

  const filtered = useMemo(() => courses.filter(c => {
    if (filterGrade !== "all" && c.grade && c.grade !== filterGrade) return false;
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return c.title.toLowerCase().includes(s) || (c.summary || "").toLowerCase().includes(s);
  }), [courses, q, filterGrade]);

  const grades = useMemo(() => {
    const set = new Set<string>();
    courses.forEach(c => c.grade && set.add(c.grade));
    return Array.from(set).sort();
  }, [courses]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        <Input placeholder="Search courses…" value={q} onChange={e => setQ(e.target.value)} className="max-w-xs" />
        <Select value={filterGrade} onValueChange={setFilterGrade}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Grade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All grades</SelectItem>
            {grades.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading courses…</p> :
        filtered.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No courses yet. Check back soon.</CardContent></Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map(c => (
              <Card key={c.id} className="hover:shadow-md transition cursor-pointer" onClick={() => onOpen(c.id)}>
                <div className="h-28 bg-gradient-to-br from-primary/15 to-primary/5 rounded-t-lg flex items-center justify-center overflow-hidden">
                  {c.cover_url ? <img src={c.cover_url} alt={c.title} className="w-full h-full object-cover" />
                    : <BookOpen className="h-10 w-10 text-primary/50" />}
                </div>
                <CardContent className="p-3 space-y-1">
                  <div className="flex items-center gap-1 flex-wrap">
                    {c.grade && <Badge variant="outline" className="text-[10px]">{c.grade}</Badge>}
                    {c.level && c.level !== "ALL" && <Badge variant="outline" className="text-[10px]">{c.level}</Badge>}
                  </div>
                  <p className="font-semibold text-sm leading-tight">{c.title}</p>
                  {c.summary && <p className="text-[11px] text-muted-foreground line-clamp-2">{c.summary}</p>}
                  {c.instructor_name && <p className="text-[10px] text-muted-foreground">by {c.instructor_name}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
    </div>
  );
}

/* ----------------------------- Course view ----------------------------- */
function CourseView({ courseId, learnerRef, learnerName, onBack, onOpenLesson }: {
  courseId: string; learnerRef: string | null; learnerName?: string | null; onBack: () => void; onOpenLesson: (id: string) => void;
}) {
  const { data: course } = useQuery({
    queryKey: ["lms-course", courseId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("lms_courses").select("*").eq("id", courseId).maybeSingle();
      return data as Course | null;
    },
  });
  const { data: modules = [] } = useQuery({
    queryKey: ["lms-modules", courseId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("lms_modules").select("*")
        .eq("course_id", courseId).eq("is_published", true).order("sort_order");
      return (data || []) as Module[];
    },
  });
  const moduleIds = modules.map(m => m.id);
  const { data: lessons = [] } = useQuery({
    queryKey: ["lms-lessons", courseId, moduleIds.join(",")],
    queryFn: async () => {
      if (!moduleIds.length) return [] as Lesson[];
      const { data } = await (supabase as any).from("lms_lessons").select("*")
        .in("module_id", moduleIds).eq("is_published", true).order("sort_order");
      return (data || []) as Lesson[];
    },
    enabled: moduleIds.length > 0,
  });
  const { data: progress = [] } = useQuery({
    queryKey: ["lms-progress", learnerRef, courseId],
    queryFn: async () => {
      if (!learnerRef || !lessons.length) return [];
      const { data } = await (supabase as any).from("lms_lesson_progress").select("lesson_id, status")
        .eq("learner_ref", learnerRef).in("lesson_id", lessons.map(l => l.id));
      return data || [];
    },
    enabled: !!learnerRef && lessons.length > 0,
  });

  const done = new Set(progress.filter((p: any) => p.status === "completed").map((p: any) => p.lesson_id));
  const pct = lessons.length ? Math.round((done.size / lessons.length) * 100) : 0;

  if (!course) return <div className="text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> Back to courses</Button>
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              {course.cover_url ? <img src={course.cover_url} alt="" className="w-full h-full object-cover rounded-lg" /> : <BookOpen className="h-7 w-7 text-primary" />}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-display font-bold text-lg leading-tight">{course.title}</h1>
              {course.instructor_name && <p className="text-xs text-muted-foreground">Instructor: {course.instructor_name}</p>}
              {course.summary && <p className="text-sm text-muted-foreground mt-1">{course.summary}</p>}
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1"><span>Progress</span><span>{done.size} / {lessons.length} lessons</span></div>
            <Progress value={pct} className="h-2" />
          </div>
          {pct === 100 && learnerRef && <CertificateRow courseId={courseId} learnerRef={learnerRef} learnerName={learnerName || "Learner"} courseTitle={course.title} instructor={course.instructor_name} />}
        </CardContent>
      </Card>

      {modules.map(m => {
        const ml = lessons.filter(l => l.module_id === m.id);
        return (
          <Card key={m.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-display">{m.title}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-1">
              {ml.length === 0 && <p className="text-xs text-muted-foreground">No lessons yet.</p>}
              {ml.map(l => {
                const completed = done.has(l.id);
                const locked = false; // paywall handled at parent layer
                return (
                  <button key={l.id} onClick={() => !locked && onOpenLesson(l.id)}
                    className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-muted/60 text-left disabled:opacity-50"
                    disabled={locked}>
                    {completed ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" /> :
                      locked ? <Lock className="h-4 w-4 text-muted-foreground shrink-0" /> :
                      l.kind === "video" ? <Play className="h-4 w-4 text-primary shrink-0" /> :
                      <FileText className="h-4 w-4 text-primary shrink-0" />}
                    <span className="flex-1 text-sm">{l.title}</span>
                    {l.is_free && <Badge variant="outline" className="text-[9px]">free</Badge>}
                    <span className="text-[10px] text-muted-foreground">{l.duration_min || ""}{l.duration_min ? "m" : ""}</span>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function CertificateRow({ courseId, learnerRef, learnerName, courseTitle, instructor }: {
  courseId: string; learnerRef: string; learnerName: string; courseTitle: string; instructor?: string | null;
}) {
  const qc = useQueryClient();
  const { data: cert } = useQuery({
    queryKey: ["lms-cert", learnerRef, courseId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("lms_certificates").select("*")
        .eq("learner_ref", learnerRef).eq("course_id", courseId).maybeSingle();
      return data;
    },
  });
  const { toast } = useToast();
  const download = (c: any) => downloadCertificatePdf({
    learnerName, courseTitle, certificateNo: c.certificate_no,
    issuedAt: c.issued_at || new Date().toISOString(), instructor,
  });
  const issue = async () => {
    const certNo = `LMS-${Date.now().toString(36).toUpperCase()}`;
    const { data, error } = await (supabase as any).from("lms_certificates").insert({
      learner_ref: learnerRef, course_id: courseId, certificate_no: certNo,
    }).select().maybeSingle();
    if (error) { toast({ title: "Certificate failed", description: error.message, variant: "destructive" }); return; }
    await evaluateAndAwardBadges(learnerRef);
    qc.invalidateQueries({ queryKey: ["lms-cert", learnerRef, courseId] });
    qc.invalidateQueries({ queryKey: ["lms-certs-mine", learnerRef] });
    qc.invalidateQueries({ queryKey: ["lms-badges-mine", learnerRef] });
    toast({ title: "Certificate issued", description: certNo });
    if (data) download(data);
  };
  return (
    <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-md p-2 text-sm">
      <Award className="h-4 w-4 text-green-700" />
      <span className="flex-1">Course completed!</span>
      {cert ? (
        <>
          <Badge className="bg-green-600">{cert.certificate_no}</Badge>
          <Button size="sm" variant="outline" onClick={() => download(cert)}><Download className="h-3 w-3 mr-1" />PDF</Button>
        </>
      ) : <Button size="sm" onClick={issue}>Issue certificate</Button>}
    </div>
  );
}

/* ----------------------------- Lesson player ----------------------------- */
function LessonView({ lessonId, learnerRef, kind, onBack }: {
  lessonId: string; learnerRef: string | null; kind: LmsLearnerKind | null; onBack: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: lesson } = useQuery({
    queryKey: ["lms-lesson", lessonId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("lms_lessons").select("*").eq("id", lessonId).maybeSingle();
      return data as Lesson | null;
    },
  });
  const { data: quizzes = [] } = useQuery({
    queryKey: ["lms-lesson-quizzes", lessonId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("lms_quizzes").select("*").eq("lesson_id", lessonId).order("sort_order");
      return (data || []) as Quiz[];
    },
  });

  if (!lesson) return <div className="text-sm text-muted-foreground">Loading lesson…</div>;

  const onComplete = async () => {
    if (!learnerRef) { toast({ title: "Sign in as a learner to track progress", variant: "destructive" }); return; }
    await markLessonComplete(learnerRef, lessonId);
    const awarded = await evaluateAndAwardBadges(learnerRef);
    qc.invalidateQueries({ queryKey: ["lms-progress"] });
    qc.invalidateQueries({ queryKey: ["lms-badges-mine"] });
    if (awarded.length) toast({ title: "🏅 Badge unlocked!", description: awarded.join(", ") });
    else toast({ title: "Marked complete" });
    onBack();
  };

  const embed = toEmbedUrl(lesson.video_url);

  return (
    <div className="space-y-3">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
      <Card>
        <CardContent className="p-4 space-y-3">
          <h1 className="font-display font-bold text-lg">{lesson.title}</h1>
          {embed && (
            <div className="aspect-video bg-black rounded-md overflow-hidden">
              <iframe src={embed} className="w-full h-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen title={lesson.title} />
            </div>
          )}
          {lesson.notes_md && (
            <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm bg-muted/30 rounded-md p-3">
              {lesson.notes_md}
            </div>
          )}
          {lesson.attachment_url && (
            <a href={lesson.attachment_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline inline-flex items-center gap-1">
              <ExternalLink className="h-3 w-3" /> Download attachment
            </a>
          )}
          {learnerRef && <Button onClick={onComplete} className="w-full sm:w-auto"><CheckCircle2 className="h-4 w-4 mr-1" /> Mark complete</Button>}
        </CardContent>
      </Card>

      {quizzes.map(q => <QuizCard key={q.id} quiz={q} learnerRef={learnerRef} />)}

      <DiscussionPanel lessonId={lessonId} />
    </div>
  );
}

/* ----------------------------- Quiz runner ----------------------------- */
function QuizCard({ quiz, learnerRef }: { quiz: Quiz; learnerRef: string | null }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [submitted, setSubmitted] = useState<{ pct: number; passed: boolean } | null>(null);
  const startedAtRef = useState({ t: Date.now() })[0];

  const { data: questions = [] } = useQuery({
    queryKey: ["lms-quiz-questions", quiz.id, open],
    queryFn: async () => {
      const { data } = await (supabase as any).from("lms_quiz_questions").select("*").eq("quiz_id", quiz.id).order("sort_order");
      return (data || []) as QuizQuestion[];
    },
    enabled: open,
  });

  const submit = async () => {
    if (!learnerRef) { toast({ title: "Cannot submit without learner context", variant: "destructive" }); return; }
    let earned = 0, total = 0;
    const breakdown = questions.map(q => {
      const r = markQuestion(q, answers[q.id] || []);
      earned += r.marks_earned; total += r.marks_total;
      return { question_id: q.id, correct: r.correct, given: answers[q.id] || [] };
    });
    const pct = total ? Math.round((earned / total) * 100) : 0;
    const passed = pct >= quiz.pass_percent;
    await recordQuizAttempt({
      learnerRef, quizId: quiz.id, scorePercent: pct, passed, answers: breakdown,
      durationSeconds: Math.round((Date.now() - startedAtRef.t) / 1000),
    });
    const awarded = await evaluateAndAwardBadges(learnerRef);
    if (awarded.length) toast({ title: "🏅 Badge unlocked!", description: awarded.join(", ") });
    setSubmitted({ pct, passed });
  };

  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-primary" />
        <div className="flex-1">
          <p className="text-sm font-medium">{quiz.title}</p>
          <p className="text-[11px] text-muted-foreground">Pass mark: {quiz.pass_percent}%</p>
        </div>
        <Button size="sm" onClick={() => { setOpen(true); setSubmitted(null); setAnswers({}); }}>Take quiz</Button>
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{quiz.title}</DialogTitle></DialogHeader>
          {submitted ? (
            <div className="text-center py-6 space-y-2">
              <div className={`text-4xl font-bold ${submitted.passed ? "text-green-600" : "text-destructive"}`}>{submitted.pct}%</div>
              <p className="text-sm">{submitted.passed ? "Passed!" : "Try again to pass."}</p>
              <Button onClick={() => setOpen(false)}>Close</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((q, idx) => (
                <div key={q.id} className="border rounded-md p-3">
                  <p className="text-sm font-medium mb-2">{idx + 1}. {q.prompt}</p>
                  {q.question_type === "short_answer" ? (
                    <Input value={(answers[q.id]?.[0]) || ""} onChange={e => setAnswers(a => ({ ...a, [q.id]: [e.target.value] }))} placeholder="Your answer" />
                  ) : (
                    <div className="space-y-1">
                      {q.options.map(opt => {
                        const sel = answers[q.id] || [];
                        const checked = sel.includes(opt.id);
                        const multi = q.question_type === "multi_select";
                        return (
                          <label key={opt.id} className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer ${checked ? "border-primary bg-primary/5" : ""}`}>
                            <input type={multi ? "checkbox" : "radio"} checked={checked}
                              onChange={() => setAnswers(a => ({
                                ...a, [q.id]: multi
                                  ? (checked ? sel.filter(x => x !== opt.id) : [...sel, opt.id])
                                  : [opt.id],
                              }))} />
                            <span className="text-sm">{opt.text}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
              {questions.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No questions added yet.</p>}
              {questions.length > 0 && <Button onClick={submit} className="w-full">Submit</Button>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* ----------------------------- Discussion ----------------------------- */
function DiscussionPanel({ lessonId }: { lessonId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const { data: threads = [] } = useQuery({
    queryKey: ["lms-threads", lessonId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("lms_discussion_threads").select("*").eq("lesson_id", lessonId).order("created_at", { ascending: false });
      return data || [];
    },
  });
  const post = async () => {
    if (!user || !title.trim() || !body.trim()) return;
    await (supabase as any).from("lms_discussion_threads").insert({
      lesson_id: lessonId, title, body, author_user_id: user.id, author_name: user.email,
    });
    setTitle(""); setBody("");
    qc.invalidateQueries({ queryKey: ["lms-threads", lessonId] });
  };
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="h-4 w-4" />Discussion</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        <div className="space-y-1">
          <Input placeholder="Question title" value={title} onChange={e => setTitle(e.target.value)} />
          <Textarea placeholder="Ask anything about this lesson…" value={body} onChange={e => setBody(e.target.value)} rows={2} />
          <Button size="sm" onClick={post} disabled={!title.trim() || !body.trim()}>Post</Button>
        </div>
        {threads.map((t: any) => (
          <div key={t.id} className="border rounded-md p-2">
            <p className="text-sm font-medium">{t.title}</p>
            <p className="text-xs text-muted-foreground whitespace-pre-wrap">{t.body}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{t.author_name || "Learner"} · {new Date(t.created_at).toLocaleString()}</p>
          </div>
        ))}
        {threads.length === 0 && <p className="text-xs text-muted-foreground">No discussion yet — start one!</p>}
      </CardContent>
    </Card>
  );
}

/* ----------------------------- Assignments ----------------------------- */
function AssignmentsTab({ learnerRef }: { learnerRef: string | null }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({
    queryKey: ["lms-assignments-all"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("lms_assignments").select("*, lms_courses(title)").order("due_at", { nullsFirst: false });
      return (data || []) as (Assignment & { lms_courses: { title: string } })[];
    },
  });
  const { data: subs = [] } = useQuery({
    queryKey: ["lms-subs", learnerRef],
    queryFn: async () => {
      if (!learnerRef) return [];
      const { data } = await (supabase as any).from("lms_assignment_submissions").select("*").eq("learner_ref", learnerRef);
      return data || [];
    },
    enabled: !!learnerRef,
  });
  const subBy = new Map<string, any>(subs.map((s: any) => [s.assignment_id, s]));

  const submit = async (assignmentId: string, text: string) => {
    if (!learnerRef) return;
    await (supabase as any).from("lms_assignment_submissions").insert({
      assignment_id: assignmentId, learner_ref: learnerRef, text_answer: text,
    });
    toast({ title: "Submitted" });
    qc.invalidateQueries({ queryKey: ["lms-subs"] });
  };

  if (items.length === 0) return <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No assignments yet.</CardContent></Card>;
  return (
    <div className="space-y-3">
      {items.map(a => {
        const sub: any = subBy.get(a.id);

        return (
          <Card key={a.id}>
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-sm">{a.title}</p>
                  <p className="text-[11px] text-muted-foreground">{a.lms_courses?.title} · max {a.max_marks} marks</p>
                </div>
                {a.due_at && <Badge variant="outline" className="text-[10px]">Due {new Date(a.due_at).toLocaleDateString()}</Badge>}
              </div>
              {a.instructions_md && <p className="text-xs whitespace-pre-wrap">{a.instructions_md}</p>}
              {sub ? (
                <div className="bg-muted/50 rounded p-2 text-xs">
                  Submitted {new Date(sub.submitted_at).toLocaleString()}{sub.score != null && <> · Score: <b>{sub.score}</b></>}
                  {sub.feedback && <p className="mt-1">Feedback: {sub.feedback}</p>}
                </div>
              ) : (
                <InlineSubmitter onSubmit={(t) => submit(a.id, t)} disabled={!learnerRef} />
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function InlineSubmitter({ onSubmit, disabled }: { onSubmit: (text: string) => void; disabled?: boolean }) {
  const [t, setT] = useState("");
  return (
    <div className="space-y-1">
      <Textarea rows={3} value={t} onChange={e => setT(e.target.value)} placeholder="Type your answer…" disabled={disabled} />
      <Button size="sm" disabled={!t.trim() || disabled} onClick={() => { onSubmit(t); setT(""); }}>Submit</Button>
    </div>
  );
}

/* ----------------------------- Live ----------------------------- */
function LiveTab({ learnerRef }: { learnerRef: string | null }) {
  const { toast } = useToast();
  const { data: sessions = [] } = useQuery({
    queryKey: ["lms-live"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("lms_live_sessions").select("*, lms_courses(title)").order("starts_at", { ascending: false });
      return data || [];
    },
  });
  const join = async (s: any) => {
    if (learnerRef) {
      await (supabase as any).from("lms_live_attendance").upsert({
        session_id: s.id, learner_ref: learnerRef, joined_at: new Date().toISOString(),
      }, { onConflict: "session_id,learner_ref" });
    }
    if (s.meeting_url) window.open(s.meeting_url, "_blank");
    else toast({ title: "No meeting link yet" });
  };
  if (sessions.length === 0) return <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No live sessions scheduled.</CardContent></Card>;
  return (
    <div className="space-y-3">
      {sessions.map((s: any) => {
        const dt = new Date(s.starts_at);
        const upcoming = dt.getTime() > Date.now();
        return (
          <Card key={s.id}>
            <CardContent className="p-3 flex items-center gap-3">
              <Calendar className="h-5 w-5 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{s.title}</p>
                <p className="text-[11px] text-muted-foreground">{s.lms_courses?.title} · {dt.toLocaleString()} · {s.duration_min}m</p>
              </div>
              {upcoming ? (
                <Button size="sm" onClick={() => join(s)} disabled={!s.meeting_url}>Join</Button>
              ) : s.recording_url ? (
                <a href={s.recording_url} target="_blank" rel="noreferrer"><Button size="sm" variant="outline">Watch</Button></a>
              ) : <Badge variant="outline" className="text-[10px]">Ended</Badge>}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ----------------------------- Progress ----------------------------- */
function ProgressTab({ learnerRef, learnerName }: { learnerRef: string | null; learnerName?: string | null }) {
  const { data: prog = [] } = useQuery({
    queryKey: ["lms-prog-all", learnerRef],
    queryFn: async () => {
      if (!learnerRef) return [];
      const { data } = await (supabase as any).from("lms_lesson_progress").select("*").eq("learner_ref", learnerRef);
      return data || [];
    },
    enabled: !!learnerRef,
  });
  const { data: attempts = [] } = useQuery({
    queryKey: ["lms-attempts-all", learnerRef],
    queryFn: async () => {
      if (!learnerRef) return [];
      const { data } = await (supabase as any).from("lms_quiz_attempts").select("*").eq("learner_ref", learnerRef);
      return data || [];
    },
    enabled: !!learnerRef,
  });
  const { data: badges = [] } = useQuery({
    queryKey: ["lms-badges-mine", learnerRef],
    queryFn: async () => {
      if (!learnerRef) return [];
      const { data } = await (supabase as any).from("lms_learner_badges").select("*, lms_badges(*)").eq("learner_ref", learnerRef);
      return data || [];
    },
    enabled: !!learnerRef,
  });
  const { data: certs = [] } = useQuery({
    queryKey: ["lms-certs-mine", learnerRef],
    queryFn: async () => {
      if (!learnerRef) return [];
      const { data } = await (supabase as any).from("lms_certificates").select("*, lms_courses(title)").eq("learner_ref", learnerRef);
      return data || [];
    },
    enabled: !!learnerRef,
  });
  const completed = prog.filter((p: any) => p.status === "completed").length;
  const quizAvg = attempts.length ? Math.round(attempts.reduce((a: number, b: any) => a + Number(b.score_percent || 0), 0) / attempts.length) : 0;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-primary">{completed}</p><p className="text-[11px] text-muted-foreground">Lessons</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-primary">{attempts.length}</p><p className="text-[11px] text-muted-foreground">Quizzes</p></CardContent></Card>
        <Card><CardContent className="p-3 text-center"><p className="text-2xl font-bold text-primary">{quizAvg}%</p><p className="text-[11px] text-muted-foreground">Avg score</p></CardContent></Card>
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Award className="h-4 w-4" />Badges</CardTitle></CardHeader>
        <CardContent>
          {badges.length === 0 ? <p className="text-xs text-muted-foreground">No badges yet — complete lessons to earn them.</p> :
            <div className="flex gap-2 flex-wrap">{badges.map((b: any) => (
              <Badge key={b.id} variant="outline" className="gap-1 text-xs">{b.lms_badges?.icon} {b.lms_badges?.name}</Badge>
            ))}</div>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Trophy className="h-4 w-4" />Certificates</CardTitle></CardHeader>
        <CardContent>
          {certs.length === 0 ? <p className="text-xs text-muted-foreground">Complete a course to earn a certificate.</p> :
            <ul className="text-sm space-y-1">{certs.map((c: any) => (
              <li key={c.id} className="flex items-center justify-between border rounded p-2">
                <span>{c.lms_courses?.title}</span>
                <Badge>{c.certificate_no}</Badge>
              </li>
            ))}</ul>}
        </CardContent>
      </Card>
    </div>
  );
}
