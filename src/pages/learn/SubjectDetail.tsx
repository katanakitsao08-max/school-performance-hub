import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, PlayCircle, FileText, ListChecks, CheckCircle2, Lock, Clock } from "lucide-react";
import { getSubject } from "./subjects";

type Lesson = {
  id: string;
  title: string;
  strand: string;
  duration: string;
  status: "completed" | "in_progress" | "locked" | "available";
};

// Mock lesson list for Mathematics (KPSEA-aligned strands). For other subjects
// we show a placeholder until content is authored.
const MATH_LESSONS: Lesson[] = [
  { id: "m1", title: "Place Value up to 10,000", strand: "Numbers", duration: "8 min", status: "completed" },
  { id: "m2", title: "Addition with Regrouping", strand: "Numbers", duration: "10 min", status: "completed" },
  { id: "m3", title: "Subtraction Strategies", strand: "Numbers", duration: "10 min", status: "in_progress" },
  { id: "m4", title: "Multiplication Tables 2–5", strand: "Numbers", duration: "12 min", status: "available" },
  { id: "m5", title: "Fractions: Halves & Quarters", strand: "Numbers", duration: "9 min", status: "available" },
  { id: "m6", title: "Measuring Length (cm, m)", strand: "Measurement", duration: "11 min", status: "available" },
  { id: "m7", title: "Reading Time on a Clock", strand: "Measurement", duration: "8 min", status: "locked" },
  { id: "m8", title: "Shapes: Squares & Rectangles", strand: "Geometry", duration: "9 min", status: "locked" },
  { id: "m9", title: "Pictographs & Bar Graphs", strand: "Data Handling", duration: "10 min", status: "locked" },
  { id: "m10", title: "Patterns & Sequences", strand: "Algebra", duration: "9 min", status: "locked" },
];

export default function SubjectDetail() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();
  const [grade, setGrade] = useState("");
  const subject = getSubject(slug);

  useEffect(() => {
    if (loading) return;
    if (!user || role !== "independent_learner") { navigate("/learn/login", { replace: true }); return; }
    supabase.from("independent_learners").select("grade").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (data) setGrade(data.grade); });
  }, [loading, user, role, navigate]);

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

  const isMath = slug === "mathematics";
  const lessons: Lesson[] = isMath ? MATH_LESSONS : [];
  const completed = lessons.filter(l => l.status === "completed").length;
  const totalDone = lessons.length || 1;

  return (
    <div className="min-h-screen bg-[hsl(140_30%_97%)] pb-20">
      {/* Header */}
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
          <Badge variant="outline" className="text-xs">{subject.progress}%</Badge>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5 space-y-5">
        {/* Hero */}
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
                <span className="text-foreground/70">Overall progress</span>
                <span className="font-semibold">{subject.progress}%</span>
              </div>
              <Progress value={subject.progress} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="lessons">
          <TabsList className="w-full grid grid-cols-3 bg-white border">
            <TabsTrigger value="lessons"><PlayCircle className="w-4 h-4 mr-1.5" />Lessons</TabsTrigger>
            <TabsTrigger value="notes"><FileText className="w-4 h-4 mr-1.5" />Notes</TabsTrigger>
            <TabsTrigger value="quiz"><ListChecks className="w-4 h-4 mr-1.5" />Quiz</TabsTrigger>
          </TabsList>

          <TabsContent value="lessons" className="mt-4 space-y-3">
            {!isMath && <ComingSoon subject={subject.name} kind="Lessons" />}
            {isMath && (
              <>
                <p className="text-xs text-muted-foreground">
                  {completed} of {totalDone} lessons completed
                </p>
                {Object.entries(groupBy(lessons, l => l.strand)).map(([strand, items]) => (
                  <div key={strand} className="space-y-2">
                    <h3 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{strand}</h3>
                    <div className="space-y-1.5">
                      {items.map(l => <LessonRow key={l.id} lesson={l} accent={subject.textVar} />)}
                    </div>
                  </div>
                ))}
              </>
            )}
          </TabsContent>

          <TabsContent value="notes" className="mt-4">
            {!isMath ? <ComingSoon subject={subject.name} kind="Notes" /> : (
              <Card><CardContent className="p-5 prose prose-sm max-w-none">
                <h3 className="font-bold">Sample Note: Place Value up to 10,000</h3>
                <p className="text-sm text-foreground/80">
                  Every digit in a number has a place: ones, tens, hundreds and thousands.
                  In the number <strong>3,482</strong>, the <strong>3</strong> means 3 thousands,
                  the <strong>4</strong> means 4 hundreds, the <strong>8</strong> means 8 tens, and
                  the <strong>2</strong> means 2 ones.
                </p>
                <h4 className="font-semibold mt-3">Try this</h4>
                <ul className="text-sm">
                  <li>Write the place value of 7 in 5,742.</li>
                  <li>Compare 1,205 and 1,250 — which is bigger?</li>
                </ul>
              </CardContent></Card>
            )}
          </TabsContent>

          <TabsContent value="quiz" className="mt-4">
            {!isMath ? <ComingSoon subject={subject.name} kind="Quizzes" /> : (
              <Card><CardContent className="p-5 space-y-4">
                <h3 className="font-bold">Quick Quiz: Place Value</h3>
                <QuizQuestion
                  q="What is the value of 6 in 4,632?"
                  options={["6", "60", "600", "6,000"]}
                  correct={2}
                />
                <QuizQuestion
                  q="Which number is greater?"
                  options={["2,109", "2,091", "2,019", "2,190"]}
                  correct={3}
                />
                <p className="text-xs text-muted-foreground">More quizzes unlock as you complete lessons.</p>
              </CardContent></Card>
            )}
          </TabsContent>
        </Tabs>

        <div className="text-center">
          <Link to="/learn" className="text-xs text-muted-foreground hover:text-primary">
            ← Back to all subjects
          </Link>
        </div>
      </main>
    </div>
  );
}

function LessonRow({ lesson, accent }: { lesson: Lesson; accent: string }) {
  const locked = lesson.status === "locked";
  const done = lesson.status === "completed";
  const inProg = lesson.status === "in_progress";
  return (
    <button
      disabled={locked}
      className={`w-full text-left bg-white rounded-lg border p-3 flex items-center gap-3 transition ${locked ? "opacity-60 cursor-not-allowed" : "hover:border-primary/40 hover:shadow-sm"}`}
    >
      <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
        done ? "bg-primary/10 text-primary" : locked ? "bg-muted text-muted-foreground" : `bg-muted ${accent}`
      }`}>
        {done ? <CheckCircle2 className="w-5 h-5" /> : locked ? <Lock className="w-4 h-4" /> : <PlayCircle className="w-5 h-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm leading-tight truncate">{lesson.title}</p>
        <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
          <Clock className="w-3 h-3" /> {lesson.duration}
          {inProg && <span className="ml-1 text-primary font-medium">· In progress</span>}
          {done && <span className="ml-1 text-primary font-medium">· Completed</span>}
        </p>
      </div>
    </button>
  );
}

function QuizQuestion({ q, options, correct }: { q: string; options: string[]; correct: number }) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div className="space-y-2">
      <p className="font-medium text-sm">{q}</p>
      <div className="grid gap-1.5">
        {options.map((opt, i) => {
          const isPicked = picked === i;
          const isCorrect = picked !== null && i === correct;
          const isWrong = isPicked && i !== correct;
          return (
            <button
              key={i}
              onClick={() => setPicked(i)}
              className={`text-left text-sm border rounded-md px-3 py-2 transition ${
                isCorrect ? "border-primary bg-primary/10 text-primary font-medium"
                : isWrong ? "border-destructive bg-destructive/10 text-destructive"
                : "hover:border-primary/40"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ComingSoon({ subject, kind }: { subject: string; kind: string }) {
  return (
    <Card><CardContent className="py-10 text-center space-y-2">
      <p className="font-semibold">{kind} for {subject} are being prepared</p>
      <p className="text-xs text-muted-foreground max-w-sm mx-auto">
        We're rolling out CBC-aligned {kind.toLowerCase()} subject by subject. Mathematics is live now — more subjects follow soon.
      </p>
    </CardContent></Card>
  );
}

function groupBy<T, K extends string>(arr: T[], key: (t: T) => K): Record<K, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item);
    (acc[k] ||= []).push(item);
    return acc;
  }, {} as Record<K, T[]>);
}
