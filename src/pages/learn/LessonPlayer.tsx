import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ArrowLeft, BookOpen, ListChecks, Sparkles, Send, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getSubject, type SubjectSlug } from "./subjects";
import { getLesson, shuffleQuiz, type QuizQ } from "./content";

type ChatMsg = { role: "user" | "assistant"; content: string };

export default function LessonPlayer() {
  const { slug = "", lessonId = "" } = useParams();
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();
  const [grade, setGrade] = useState("");
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const startedAt = useRef<number>(Date.now());

  const subject = getSubject(slug);
  const lesson = subject ? getLesson(slug as SubjectSlug, lessonId) : undefined;

  useEffect(() => {
    if (loading) return;
    if (!user || role !== "independent_learner") { navigate("/learn/login", { replace: true }); return; }
    (async () => {
      const [{ data: l }, { data: p }] = await Promise.all([
        supabase.from("independent_learners").select("grade").eq("user_id", user.id).maybeSingle(),
        supabase.from("learner_lesson_progress").select("status")
          .eq("user_id", user.id).eq("subject_slug", slug).eq("lesson_id", lessonId).maybeSingle(),
      ]);
      if (l) setGrade(l.grade);
      if (p?.status === "completed") setCompleted(true);
    })();
  }, [loading, user, role, slug, lessonId, navigate]);

  async function markComplete(quizScore?: number, quizTotal?: number) {
    if (!user) return;
    setSaving(true);
    const seconds = Math.floor((Date.now() - startedAt.current) / 1000);
    const { error } = await supabase.from("learner_lesson_progress").upsert({
      user_id: user.id,
      subject_slug: slug,
      lesson_id: lessonId,
      status: "completed",
      quiz_score: quizScore ?? null,
      quiz_total: quizTotal ?? null,
      seconds_spent: seconds,
    }, { onConflict: "user_id,subject_slug,lesson_id" });
    setSaving(false);
    if (error) { toast.error("Could not save progress"); return; }
    setCompleted(true);
    toast.success("Lesson completed! 🎉");
  }

  if (!subject || !lesson) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card><CardContent className="py-10 text-center space-y-3">
          <p className="font-semibold">Lesson not found.</p>
          <Button onClick={() => navigate(`/learn/subject/${slug}`)}>Back to Subject</Button>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(140_30%_97%)] pb-20">
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3 max-w-5xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/learn/subject/${slug}`)} aria-label="Back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className={`w-9 h-9 rounded-full ${subject.colorVar} ${subject.textVar} flex items-center justify-center text-lg`}>
            {subject.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{subject.name} · {lesson.strand}</p>
            <p className="font-semibold leading-tight truncate">{lesson.title}</p>
          </div>
          {completed && <Badge className="bg-primary text-primary-foreground"><CheckCircle2 className="w-3 h-3 mr-1" />Done</Badge>}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5 grid lg:grid-cols-[1fr_360px] gap-5">
        <div className="space-y-4 min-w-0">
          <Tabs defaultValue="notes">
            <TabsList className="w-full grid grid-cols-3 bg-white border">
              <TabsTrigger value="notes"><BookOpen className="w-4 h-4 mr-1.5" />Notes</TabsTrigger>
              <TabsTrigger value="quiz"><ListChecks className="w-4 h-4 mr-1.5" />Quiz</TabsTrigger>
              <TabsTrigger value="tutor" className="lg:hidden"><Sparkles className="w-4 h-4 mr-1.5" />Tutor</TabsTrigger>
            </TabsList>

            <TabsContent value="notes" className="mt-4">
              <Card><CardContent className="p-5 space-y-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{lesson.duration} · {grade || "CBC"}</p>
                  <h1 className="text-xl font-bold">{lesson.title}</h1>
                  <p className="text-sm text-muted-foreground">{lesson.summary}</p>
                </div>
                <div className="prose prose-sm max-w-none text-foreground/90 whitespace-pre-wrap">
                  {lesson.notes}
                </div>
                {lesson.examples && lesson.examples.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm">Examples</h3>
                    <ul className="space-y-1">
                      {lesson.examples.map((ex, i) => (
                        <li key={i} className="text-sm bg-muted/50 rounded-md px-3 py-2 font-mono">{ex}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {!completed && (
                  <Button onClick={() => markComplete()} disabled={saving} className="w-full sm:w-auto">
                    {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                    Mark notes as read
                  </Button>
                )}
              </CardContent></Card>
            </TabsContent>

            <TabsContent value="quiz" className="mt-4">
              <Quiz lesson={lesson} onComplete={markComplete} alreadyDone={completed} />
            </TabsContent>

            <TabsContent value="tutor" className="mt-4 lg:hidden">
              <TutorPanel lesson={lesson} subject={subject.name} grade={grade} />
            </TabsContent>
          </Tabs>
        </div>

        <aside className="hidden lg:block">
          <TutorPanel lesson={lesson} subject={subject.name} grade={grade} sticky />
        </aside>
      </main>
    </div>
  );
}

function Quiz({ lesson, onComplete, alreadyDone }: {
  lesson: ReturnType<typeof getLesson> & {};
  onComplete: (score: number, total: number) => void;
  alreadyDone: boolean;
}) {
  // Shuffle questions + options once per attempt; reshuffle when user retries.
  const [attempt, setAttempt] = useState(0);
  const quiz: QuizQ[] = useMemo(
    () => shuffleQuiz(lesson!.quiz),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lesson, attempt]
  );
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const total = quiz.length;
  const score = useMemo(
    () => quiz.reduce((s, q, i) => s + (answers[i] === q.correct ? 1 : 0), 0),
    [answers, quiz]
  );

  function submit() {
    if (Object.keys(answers).length < total) {
      toast.error("Answer every question first");
      return;
    }
    setSubmitted(true);
    onComplete(score, total);
  }

  function retry() {
    setAnswers({});
    setSubmitted(false);
    setAttempt(a => a + 1);
  }

  return (
    <Card><CardContent className="p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">Quick Quiz</h2>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">Shuffled</Badge>
          {submitted && <Badge variant="outline">{score} / {total}</Badge>}
        </div>
      </div>
      {quiz.map((q, qi) => (
        <div key={qi} className="space-y-2">
          <p className="font-medium text-sm">{qi + 1}. {q.q}</p>
          <div className="grid gap-1.5">
            {q.options.map((opt, oi) => {
              const picked = answers[qi] === oi;
              const isCorrect = submitted && oi === q.correct;
              const isWrong = submitted && picked && oi !== q.correct;
              return (
                <button key={oi}
                  disabled={submitted}
                  onClick={() => setAnswers(a => ({ ...a, [qi]: oi }))}
                  className={`text-left text-sm border rounded-md px-3 py-2 transition ${
                    isCorrect ? "border-primary bg-primary/10 text-primary font-medium"
                    : isWrong ? "border-destructive bg-destructive/10 text-destructive"
                    : picked ? "border-primary/60 bg-primary/5"
                    : "hover:border-primary/40"
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
          {submitted && q.explain && <p className="text-xs text-muted-foreground italic">{q.explain}</p>}
        </div>
      ))}
      {!submitted ? (
        <Button onClick={submit} className="w-full">Submit Quiz</Button>
      ) : (
        <div className="text-center space-y-2">
          <p className="text-sm">
            {score === total ? "Perfect! 🌟" : score >= total * 0.6 ? "Great work! Keep going." : "Review the notes and try again — you've got this."}
          </p>
          {!alreadyDone && <p className="text-xs text-muted-foreground">Lesson marked as completed.</p>}
          <Button variant="outline" size="sm" onClick={retry}>Try fresh questions</Button>
        </div>
      )}
    </CardContent></Card>
  );
}

function TutorPanel({ lesson, subject, grade, sticky }: {
  lesson: NonNullable<ReturnType<typeof getLesson>>;
  subject: string; grade: string; sticky?: boolean;
}) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    { role: "assistant", content: `Hi! I'm your AI tutor. Ask me anything about "${lesson.title}".` },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs]);

  async function send() {
    const q = input.trim();
    if (!q || busy) return;
    setInput("");
    setMsgs(m => [...m, { role: "user", content: q }, { role: "assistant", content: "" }]);
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/learn-ai-tutor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token ?? ""}`,
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          question: q, subject, lessonTitle: lesson.title, notes: lesson.notes, grade,
        }),
      });
      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "AI request failed");
      }
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) {
              setMsgs(m => {
                const copy = [...m];
                copy[copy.length - 1] = { role: "assistant", content: copy[copy.length - 1].content + delta };
                return copy;
              });
            }
          } catch { /* ignore */ }
        }
      }
    } catch (e: any) {
      setMsgs(m => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: "Sorry, I couldn't answer that. " + (e?.message || "") };
        return copy;
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={sticky ? "sticky top-20" : ""}>
      <CardContent className="p-0 flex flex-col h-[520px]">
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <p className="font-semibold text-sm">AI Tutor</p>
          <Badge variant="outline" className="ml-auto text-[10px]">Beta</Badge>
        </div>
        <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
              }`}>
                {m.content || (busy && i === msgs.length - 1 ? <span className="inline-flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:0.3s]" />
                </span> : null)}
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="border-t p-3 flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question…"
            disabled={busy}
          />
          <Button type="submit" size="icon" disabled={busy || !input.trim()}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
