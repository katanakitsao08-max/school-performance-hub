// New CBC mastery dashboard — replaces the simple "Subject breakdown" lesson-counter view.
// Shows competency mastery %, available videos, notes, question bank size, assessments
// completed, time spent learning, weak-area panel, and a "Continue Learning" CTA per subject.
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Video, FileText, ListChecks, ClipboardList, Clock, ArrowRight, Sparkles,
  AlertTriangle, Trophy,
} from "lucide-react";
import {
  SUBJECT_OPTIONS, COMPETENCY_LABEL, COMPETENCY_COLOR, COMPETENCY_SHORT,
  type CbcCompetencyLevel,
} from "@/lib/learning-cms";
import type { SubjectMasterySummary } from "@/hooks/use-learner-mastery";

type Props = {
  grade: string;
  summaries: SubjectMasterySummary[];
  loading?: boolean;
  basePath?: string; // "/learn" by default; parent dashboard passes something different
};

function fmtTime(sec: number) {
  if (!sec) return "0m";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function MasteryDashboard({ grade, summaries, loading, basePath = "/learn" }: Props) {
  const meta = new Map(SUBJECT_OPTIONS.map(s => [s.slug, s] as const));

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" /></div>;
  }

  if (summaries.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-2">
          <Sparkles className="w-8 h-8 text-primary/40 mx-auto" />
          <p className="font-semibold text-sm">Content coming soon for {grade}</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Your school admin (or PerformTrack) hasn't published CBC topics for this grade yet.
            Once they do, your mastery dashboard will fill in automatically.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Weak-area detection: anything Emerging or Approaching.
  const weak = summaries.filter(s => s.competency_level === "emerging" || s.competency_level === "approaching");

  return (
    <div className="space-y-5">
      {weak.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-sm text-amber-900">Focus areas — practice these to lift your CBC competency</p>
              <p className="text-xs text-amber-800 mt-0.5">
                {weak.map(w => meta.get(w.subject_slug)?.name || w.subject_slug).join(" · ")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="text-lg font-bold">Subject Mastery</h2>
        <p className="text-xs text-muted-foreground">Competency, content, and progress per CBC subject.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {summaries.map(s => {
          const m = meta.get(s.subject_slug) || { name: s.subject_slug, icon: "📚" };
          const level = s.competency_level as CbcCompetencyLevel;
          const pct = Math.round(s.mastery_percent);
          return (
            <Card key={s.subject_slug} className="overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xl shrink-0">
                    {(m as any).icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold leading-tight">{(m as any).name}</p>
                    <Badge variant="outline" className={`mt-1 text-[10px] ${COMPETENCY_COLOR[level]}`}>
                      <Trophy className="w-3 h-3 mr-1" />
                      {COMPETENCY_SHORT[level]} · {COMPETENCY_LABEL[level]}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold leading-none">{pct}%</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Mastery</p>
                  </div>
                </div>

                <Progress value={pct} className="h-1.5" />

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <Stat icon={<Video className="w-3 h-3" />} label="Videos"    value={s.videos_count} />
                  <Stat icon={<FileText className="w-3 h-3" />} label="Notes"  value={s.notes_count} />
                  <Stat icon={<ListChecks className="w-3 h-3" />} label="Q-Bank" value={s.questions_count} />
                  <Stat icon={<ClipboardList className="w-3 h-3" />} label="Done" value={s.assessments_completed} />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Time learning: {fmtTime(s.time_spent_seconds)}
                  </span>
                  <Button asChild size="sm">
                    <Link to={`${basePath}/subject/${s.subject_slug}`}>
                      Continue Learning <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5 bg-muted/40 rounded px-2 py-1">
      <div className="text-primary">{icon}</div>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold ml-auto">{value}</span>
    </div>
  );
}
