import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Target, Sparkles, LifeBuoy, Rocket, ArrowRight, CheckCircle2, Calendar, Trophy,
} from "lucide-react";
import { getLessonsForSubject, type Lesson } from "./content";
import type { Subject, SubjectSlug } from "./subjects";

type SubjectStat = { done: number; seconds: number };

type Bucket = {
  subject: Subject;
  lesson: Lesson;
};

type Props = {
  subjects: Subject[];
  grade: string;
  perSubject: Record<string, SubjectStat>;
  completedIds: Record<string, Set<string>>; // slug -> set of completed lesson ids
};

const WEEKLY_GOAL_LESSONS = 5;
const WEEKLY_GOAL_MINUTES = 60;

function isoWeek(d = new Date()) {
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const diff = target.getTime() - firstThursday.getTime();
  return 1 + Math.round(diff / 604800000);
}

export default function LearningPath({ subjects, grade, perSubject, completedIds }: Props) {
  // Build per-subject lesson lists once
  const perSubjLessons = subjects.map(s => ({
    subject: s,
    lessons: getLessonsForSubject(s.slug as SubjectSlug, grade),
    done: completedIds[s.slug] || new Set<string>(),
  }));

  // ---------- Weekly goal progress ----------
  const lessonsThisWeek = subjects.reduce((sum, s) => sum + (perSubject[s.slug]?.done || 0), 0);
  const minutesThisWeek = Math.round(
    subjects.reduce((sum, s) => sum + (perSubject[s.slug]?.seconds || 0), 0) / 60
  );
  const lessonPct = Math.min(100, Math.round((lessonsThisWeek / WEEKLY_GOAL_LESSONS) * 100));
  const minutesPct = Math.min(100, Math.round((minutesThisWeek / WEEKLY_GOAL_MINUTES) * 100));

  // ---------- Recommendations: next lesson in each subject the learner has touched least ----------
  const recommendations: Bucket[] = perSubjLessons
    .map(({ subject, lessons, done }) => {
      const next = lessons.find(l => !done.has(l.id));
      return next ? { subject, lesson: next, ratio: done.size / Math.max(lessons.length, 1) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a!.ratio - b!.ratio)
    .slice(0, 4) as Bucket[];

  // ---------- Remedial: subjects with <40% progress, surface their first lesson again ----------
  const remedial: Bucket[] = perSubjLessons
    .filter(({ lessons, done }) => lessons.length > 0 && done.size / lessons.length < 0.4)
    .slice(0, 3)
    .map(({ subject, lessons, done }) => {
      // Prefer first incomplete; otherwise the first lesson for review.
      const target = lessons.find(l => !done.has(l.id)) || lessons[0];
      return { subject, lesson: target };
    });

  // ---------- Extension: subjects with >=80% progress, suggest the last/most advanced lesson ----------
  const extension: Bucket[] = perSubjLessons
    .filter(({ lessons, done }) => lessons.length > 0 && done.size / lessons.length >= 0.8)
    .slice(0, 3)
    .map(({ subject, lessons }) => ({ subject, lesson: lessons[lessons.length - 1] }));

  return (
    <div className="space-y-5">
      {/* Weekly goals */}
      <Card className="border-primary/15 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                <Target className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold leading-tight">This Week's Goals</h2>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Week {isoWeek()} · resets every Monday
                </p>
              </div>
            </div>
            {lessonPct >= 100 && minutesPct >= 100 && (
              <Badge className="bg-green-600 hover:bg-green-600 gap-1">
                <Trophy className="w-3 h-3" /> Achieved
              </Badge>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <GoalBar
              label="Lessons completed"
              value={lessonsThisWeek}
              target={WEEKLY_GOAL_LESSONS}
              pct={lessonPct}
              unit="lessons"
            />
            <GoalBar
              label="Time learning"
              value={minutesThisWeek}
              target={WEEKLY_GOAL_MINUTES}
              pct={minutesPct}
              unit="min"
            />
          </div>
        </CardContent>
      </Card>

      {/* Recommended next */}
      <Section
        icon={<Sparkles className="w-4 h-4" />}
        accent="text-primary bg-primary/10"
        title="Recommended for You"
        subtitle="Pick up the next lesson in subjects you've explored the least."
        empty="Great job — you're up to date on every subject! Try an extension task below."
        items={recommendations}
        cta="Start lesson"
      />

      {/* Remedial */}
      <Section
        icon={<LifeBuoy className="w-4 h-4" />}
        accent="text-amber-700 bg-amber-100"
        title="Needs Practice"
        subtitle="Subjects below 40% — let's strengthen the basics."
        empty="No weak spots right now. Keep going!"
        items={remedial}
        cta="Practice now"
      />

      {/* Extension */}
      <Section
        icon={<Rocket className="w-4 h-4" />}
        accent="text-violet-700 bg-violet-100"
        title="Stretch Yourself"
        subtitle="Mastering a subject? Try these advanced challenges."
        empty="Complete more lessons to unlock advanced challenges."
        items={extension}
        cta="Take the challenge"
      />
    </div>
  );
}

function GoalBar({ label, value, target, pct, unit }: {
  label: string; value: number; target: number; pct: number; unit: string;
}) {
  const reached = pct >= 100;
  return (
    <div className="bg-white rounded-lg p-3 space-y-2 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {reached && <CheckCircle2 className="w-4 h-4 text-green-600" />}
      </div>
      <div className="flex items-baseline gap-1.5">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">/ {target} {unit}</p>
      </div>
      <Progress value={pct} className="h-1.5" />
    </div>
  );
}

function Section({ icon, accent, title, subtitle, empty, items, cta }: {
  icon: React.ReactNode; accent: string; title: string; subtitle: string; empty: string;
  items: Bucket[]; cta: string;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-md flex items-center justify-center ${accent}`}>{icon}</div>
        <div>
          <h3 className="font-bold text-sm leading-tight">{title}</h3>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {items.length === 0 ? (
        <Card><CardContent className="py-6 text-center text-xs text-muted-foreground">{empty}</CardContent></Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-2.5">
          {items.map(({ subject, lesson }) => (
            <Link key={`${subject.slug}-${lesson.id}`} to={`/learn/subject/${subject.slug}/lesson/${lesson.id}`}>
              <Card className="hover:shadow-md transition-shadow h-full">
                <CardContent className="p-3 flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg ${subject.colorVar} ${subject.textVar} flex items-center justify-center text-lg shrink-0`}>
                    {subject.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{subject.name}</p>
                    <p className="font-semibold text-sm leading-tight truncate">{lesson.title}</p>
                    <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{lesson.strand} · {lesson.duration}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="shrink-0" aria-label={cta}>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
