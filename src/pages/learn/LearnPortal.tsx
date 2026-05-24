import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Sparkles, LogOut, BookOpen, Flame, GraduationCap, Clock, Award,
  ArrowRight, CheckCircle2, Menu,
} from "lucide-react";
import { getSubjectsForGrade } from "./subjects";
import { getLessonsForSubject } from "./content";
import ProgressCharts, { buildProgressRows } from "./ProgressCharts";
import LearningPath from "./LearningPath";

export default function LearnPortal() {
  const navigate = useNavigate();
  const { user, role, loading, signOut } = useAuth();
  const [learnerName, setLearnerName] = useState("");
  const [grade, setGrade] = useState("");
  const [code, setCode] = useState("");
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [perSubject, setPerSubject] = useState<Record<string, { done: number; seconds: number }>>({});
  const [completedIds, setCompletedIds] = useState<Record<string, Set<string>>>({});
  const [totals, setTotals] = useState({ completed: 0, minutes: 0 });

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/learn/login", { replace: true }); return; }
    if (role !== "independent_learner") { navigate("/", { replace: true }); return; }
    (async () => {
      await supabase.rpc("expire_old_independent_subscriptions");
      const [{ data: l }, { data: s }, { data: prog }] = await Promise.all([
        supabase.from("independent_learners").select("full_name, grade, learner_code").eq("user_id", user.id).maybeSingle(),
        supabase.from("independent_subscriptions").select("status, expires_at").eq("user_id", user.id).order("submitted_at", { ascending: false }).limit(1),
        supabase.from("learner_lesson_progress").select("subject_slug, lesson_id, status, seconds_spent").eq("user_id", user.id),
      ]);
      if (l) { setLearnerName(l.full_name); setGrade(l.grade); setCode(l.learner_code); }
      const top = s?.[0];
      const active = !!(top && top.status === "active" && (!top.expires_at || new Date(top.expires_at) > new Date()));
      if (!active) {
        navigate(top?.status === "pending" ? "/learn/pending" : "/learn/subscribe", { replace: true });
        return;
      }
      setExpiresAt(top!.expires_at);
      const counts: Record<string, number> = {};
      const bySubject: Record<string, { done: number; seconds: number }> = {};
      const ids: Record<string, Set<string>> = {};
      let completed = 0, seconds = 0;
      for (const p of prog || []) {
        seconds += p.seconds_spent || 0;
        const slot = (bySubject[p.subject_slug] ||= { done: 0, seconds: 0 });
        slot.seconds += p.seconds_spent || 0;
        if (p.status === "completed") {
          completed++;
          slot.done++;
          counts[p.subject_slug] = (counts[p.subject_slug] || 0) + 1;
          (ids[p.subject_slug] ||= new Set()).add(p.lesson_id);
        }
      }
      setProgress(counts);
      setPerSubject(bySubject);
      setCompletedIds(ids);
      setTotals({ completed, minutes: Math.round(seconds / 60) });
      setReady(true);
    })();
  }, [loading, user, role, navigate]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const subjects = getSubjectsForGrade(grade);
  const firstName = learnerName.split(/\s+/)[0] || "Learner";

  return (
    <div className="min-h-screen bg-[hsl(140_30%_97%)]">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3 max-w-6xl mx-auto">
          <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
            {firstName.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight truncate">{learnerName} <span className="text-muted-foreground font-normal">· {grade}</span></p>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Learning Portal</p>
          </div>
          <Badge variant="outline" className="text-xs font-mono">{code}</Badge>
          <Button variant="ghost" size="icon" onClick={() => signOut().then(() => navigate("/learn/login"))} aria-label="Sign out">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-5 space-y-5 pb-24">
        <Tabs defaultValue="overview" className="space-y-5">
          <TabsList className="w-full justify-start overflow-x-auto bg-transparent border-b rounded-none h-auto p-0">
            {[
              { v: "overview", l: "Overview" },
              { v: "subjects", l: "Subjects" },
              { v: "progress", l: "My Progress" },
              { v: "library", l: "My Library" },
              { v: "live", l: "Live Classes" },
            ].map(t => (
              <TabsTrigger
                key={t.v}
                value={t.v}
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-3"
              >
                {t.l}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="space-y-5 mt-0">
            {/* Welcome card */}
            <Card className="border-primary/15 bg-gradient-to-br from-primary/5 to-primary/10">
              <CardContent className="p-5 flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-1">
                  <h1 className="text-xl md:text-2xl font-bold mb-1">
                    Welcome back, {firstName.toUpperCase()} <span className="inline-block">👋</span>
                  </h1>
                  <p className="text-sm text-muted-foreground max-w-lg">
                    Continue your learning journey with our rich, interactive and curriculum-aligned content designed for the CBC curriculum.
                  </p>
                </div>
                <div className="bg-white rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm">
                  <Flame className="w-7 h-7 text-orange-500" />
                  <div>
                    <p className="text-[11px] uppercase text-muted-foreground tracking-wider">Learning Streak</p>
                    <p className="text-lg font-bold">7 days</p>
                  </div>
                </div>
              </CardContent>
              <CardContent className="px-5 pb-5 pt-0 grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatTile icon={<GraduationCap className="w-4 h-4" />} label="Subjects" value={subjects.length.toString()} />
                <StatTile icon={<CheckCircle2 className="w-4 h-4" />} label="Lessons Completed" value={totals.completed.toString()} />
                <StatTile icon={<Clock className="w-4 h-4" />} label="Time Learned" value={`${Math.floor(totals.minutes / 60)}h ${totals.minutes % 60}m`} />
                <StatTile icon={<Award className="w-4 h-4" />} label="Badges Earned" value={Math.floor(totals.completed / 5).toString()} />
              </CardContent>
            </Card>

            {/* Continue Learning */}
            <section>
              <div className="flex items-end justify-between mb-3">
                <div>
                  <h2 className="text-lg font-bold">Continue Learning</h2>
                  <p className="text-xs text-muted-foreground">Pick up where you left off in any subject.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {subjects.map(s => (
                  <SubjectCard key={s.slug} subject={s} done={progress[s.slug] || 0} total={getLessonsForSubject(s.slug, grade).length} />
                ))}
              </div>
            </section>

            {/* CBC strip */}
            <Card className="border-primary/15">
              <CardContent className="p-4 flex flex-wrap items-center gap-x-5 gap-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <p className="font-semibold text-sm">CBC Curriculum Aligned</p>
                </div>
                <p className="text-xs text-muted-foreground flex-1 min-w-[200px]">
                  All learning content is based on the Competency-Based Curriculum (CBC) by KICD.
                </p>
              </CardContent>
            </Card>

            {expiresAt && (
              <p className="text-xs text-center text-muted-foreground">
                Subscription valid until <span className="font-semibold text-foreground">{new Date(expiresAt).toLocaleDateString()}</span>
              </p>
            )}
          </TabsContent>

          {/* SUBJECTS */}
          <TabsContent value="subjects" className="mt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {subjects.map(s => <SubjectCard key={s.slug} subject={s} done={progress[s.slug] || 0} total={getLessonsForSubject(s.slug, grade).length} />)}
            </div>
          </TabsContent>

          <TabsContent value="progress" className="mt-0">
            <ProgressCharts rows={buildProgressRows(subjects, grade, perSubject)} />
          </TabsContent>
          <TabsContent value="library" className="mt-0">
            <EmptyState icon={<BookOpen className="w-10 h-10" />} title="My Library" body="Saved notes, downloads and bookmarks will appear here." />
          </TabsContent>
          <TabsContent value="live" className="mt-0">
            <EmptyState icon={<Menu className="w-10 h-10" />} title="Live Classes" body="Live class schedule will appear here once available." />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg px-3 py-2.5 flex items-center gap-2.5 shadow-sm">
      <div className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground leading-tight">{label}</p>
        <p className="text-sm font-bold leading-tight">{value}</p>
      </div>
    </div>
  );
}

function SubjectCard({ subject, done, total }: {
  subject: ReturnType<typeof getSubjectsForGrade>[number];
  done: number; total: number;
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <Link to={`/learn/subject/${subject.slug}`} className="block group">
      <Card className="h-full hover:shadow-md transition-shadow border-border">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className={`w-11 h-11 rounded-full ${subject.colorVar} ${subject.textVar} flex items-center justify-center text-xl shrink-0`}>
              {subject.icon}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className={`font-bold ${subject.textVar} leading-tight`}>{subject.name}</h3>
              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{subject.description}</p>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>{done} / {total} lessons</span>
              <span>{pct}%</span>
            </div>
            <Progress value={pct} className="h-1.5" />
          </div>
          <Button variant="outline" size="sm" className="w-full group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-colors">
            {done === 0 ? "Start Learning" : done >= total ? "Review" : "Continue Learning"} <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </CardContent>
      </Card>
    </Link>
  );
}

function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center space-y-2">
        <div className="text-primary/40 inline-flex">{icon}</div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground max-w-xs mx-auto">{body}</p>
      </CardContent>
    </Card>
  );
}
