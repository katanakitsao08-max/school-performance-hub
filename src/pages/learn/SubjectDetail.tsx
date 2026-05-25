import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, PlayCircle, FileText, ListChecks, CheckCircle2, Clock } from "lucide-react";
import { getSubject, type SubjectSlug } from "./subjects";
import { getLessonsForSubject, groupByStrand, type Lesson } from "./content";

export default function SubjectDetail() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();
  const [grade, setGrade] = useState("");
  const [done, setDone] = useState<Set<string>>(new Set());
  const subject = getSubject(slug);

  useEffect(() => {
    if (loading) return;
    if (!user || role !== "independent_learner") { navigate("/learn/login", { replace: true }); return; }
    (async () => {
      const [{ data: l }, { data: p }] = await Promise.all([
        supabase.from("independent_learners").select("grade").eq("user_id", user.id).maybeSingle(),
        supabase.from("learner_lesson_progress").select("lesson_id, status")
          .eq("user_id", user.id).eq("subject_slug", slug).eq("status", "completed"),
      ]);
      if (l) setGrade(l.grade);
      if (p) setDone(new Set(p.map(x => x.lesson_id)));
    })();
  }, [loading, user, role, slug, navigate]);

  if (!subject) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card><CardContent className="py-10 text-center space-y-3">
          <p className="font-semibold">Subject not found.</p>
          <Button onClick={() => navigate("/learn")}>Back to Portal</Button>
        </CardContent></Card>
      </div>
    );
  }

  const lessons = grade ? getLessonsForSubject(slug as SubjectSlug, grade) : [];
  const completedCount = lessons.filter(l => done.has(l.id)).length;
  const pct = lessons.length ? Math.round((completedCount / lessons.length) * 100) : 0;
  const grouped = groupByStrand(lessons);

  return (
    <div className="min-h-screen bg-[hsl(140_30%_97%)] pb-20">
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3 max-w-5xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate("/learn")} aria-label="Back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className={`w-9 h-9 rounded-full ${subject.colorVar} ${subject.textVar} flex items-center justify-center text-lg`}>
            {subject.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold leading-tight truncate">{subject.name}</p>
            <p className="text-[11px] text-muted-foreground">{grade || "CBC"}</p>
          </div>
          <Badge variant="outline" className="text-xs">{pct}%</Badge>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5 space-y-5">
        <Card className={`border-0 ${subject.colorVar}`}>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className={`w-12 h-12 rounded-xl bg-white/70 ${subject.textVar} flex items-center justify-center text-2xl shrink-0`}>
                {subject.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className={`text-xl font-bold ${subject.textVar}`}>{subject.name}</h1>
                <p className="text-sm text-foreground/80">{subject.description}</p>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-foreground/70">{completedCount} of {lessons.length} lessons completed</span>
                <span className="font-semibold">{pct}%</span>
              </div>
              <Progress value={pct} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="lessons">
          <TabsList className="w-full grid grid-cols-3 bg-white border">
            <TabsTrigger value="lessons"><PlayCircle className="w-4 h-4 mr-1.5" />Lessons</TabsTrigger>
            <TabsTrigger value="strands"><FileText className="w-4 h-4 mr-1.5" />By Strand</TabsTrigger>
            <TabsTrigger value="overview"><ListChecks className="w-4 h-4 mr-1.5" />Overview</TabsTrigger>
          </TabsList>

          <TabsContent value="lessons" className="mt-4 space-y-1.5">
            {lessons.length === 0 && <EmptyContent name={subject.name} />}
            {lessons.map(l => <LessonRow key={l.id} lesson={l} slug={slug} done={done.has(l.id)} accent={subject.textVar} />)}
          </TabsContent>

          <TabsContent value="strands" className="mt-4 space-y-4">
            {lessons.length === 0 && <EmptyContent name={subject.name} />}
            {Object.entries(grouped).map(([strand, items]) => (
              <div key={strand} className="space-y-2">
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{strand}</h3>
                <div className="space-y-1.5">
                  {items.map(l => <LessonRow key={l.id} lesson={l} slug={slug} done={done.has(l.id)} accent={subject.textVar} />)}
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="overview" className="mt-4">
            <Card><CardContent className="p-5 text-sm space-y-2">
              <p><span className="font-semibold">Tier:</span> {grade?.match(/\d+/) && parseInt(grade.match(/\d+/)![0]) >= 7 ? "KJSEA (Junior Secondary)" : "KPSEA (Primary)"}</p>
              <p><span className="font-semibold">Strands:</span> {Object.keys(grouped).join(", ") || "—"}</p>
              <p><span className="font-semibold">Total lessons:</span> {lessons.length}</p>
              <p className="text-muted-foreground text-xs pt-2">
                Every lesson includes notes, an AI tutor and a short quiz aligned to the CBC.
              </p>
            </CardContent></Card>
          </TabsContent>
        </Tabs>

        <div className="text-center">
          <Link to="/learn" className="text-xs text-muted-foreground hover:text-primary">← Back to all subjects</Link>
        </div>
      </main>
    </div>
  );
}

function LessonRow({ lesson, slug, done, accent }: {
  lesson: Lesson; slug: string; done: boolean; accent: string;
}) {
  return (
    <Link to={`/learn/subject/${slug}/lesson/${lesson.id}`}
      className="block bg-white rounded-lg border p-3 hover:border-primary/40 hover:shadow-sm transition"
    >
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
          done ? "bg-primary/10 text-primary" : `bg-muted ${accent}`
        }`}>
          {done ? <CheckCircle2 className="w-5 h-5" /> : <PlayCircle className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm leading-tight">{lesson.title}</p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5 flex-wrap">
            <Clock className="w-3 h-3" /> {lesson.duration} · {lesson.strand}
            <span className="inline-flex items-center gap-0.5 ml-1">
              <ListChecks className="w-3 h-3" /> {lesson.quiz.length} {lesson.quiz.length === 1 ? "question" : "questions"}
            </span>
            {done && <span className="ml-1 text-primary font-medium">· Completed</span>}
          </p>
        </div>
      </div>
    </Link>
  );
}

function EmptyContent({ name }: { name: string }) {
  return (
    <Card><CardContent className="py-10 text-center space-y-2">
      <p className="font-semibold">More {name} lessons coming soon</p>
      <p className="text-xs text-muted-foreground max-w-sm mx-auto">
        We're publishing new CBC-aligned lessons every week.
      </p>
    </CardContent></Card>
  );
}
