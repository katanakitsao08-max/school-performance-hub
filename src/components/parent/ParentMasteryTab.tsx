// Parent view of a child's CBC mastery dashboard (read-only).
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import MasteryDashboard from "@/pages/learn/MasteryDashboard";
import type { SubjectMasterySummary } from "@/hooks/use-learner-mastery";
import type { LearningTopic, LearnerTopicMastery } from "@/lib/learning-cms";
import { Flame, Trophy } from "lucide-react";

interface Props {
  child: { id: string; full_name: string; grade: string; user_id?: string | null };
}

/** Parent-facing summary of the child's CBC continuous-learning progress.
 *  The child needs a learner-portal account (user_id) for attempts/mastery to exist. */
export default function ParentMasteryTab({ child }: Props) {
  const [summaries, setSummaries] = useState<SubjectMasterySummary[]>([]);
  const [streak, setStreak] = useState<{ current: number; longest: number } | null>(null);
  const [badgesCount, setBadgesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasAccount, setHasAccount] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      // Resolve the child's portal user_id (if any) — independent_learners or learners.user_id.
      let portalUserId: string | null = (child as any).user_id || null;
      if (!portalUserId) {
        const { data } = await supabase.from("independent_learners").select("user_id").eq("id", child.id).maybeSingle();
        portalUserId = data?.user_id || null;
      }
      setHasAccount(!!portalUserId);

      const [topicsRes, masteryRes, streakRes, badgesRes, videosRes, notesRes, questionsRes, attemptsRes] = await Promise.all([
        supabase.from("learning_topics").select("*").eq("grade", child.grade).eq("is_active", true),
        portalUserId
          ? supabase.from("learner_topic_mastery").select("*").eq("user_id", portalUserId).eq("grade", child.grade)
          : Promise.resolve({ data: [] as LearnerTopicMastery[] }),
        portalUserId ? supabase.from("learner_streaks").select("*").eq("user_id", portalUserId).maybeSingle() : Promise.resolve({ data: null }),
        portalUserId ? supabase.from("learner_badges").select("id").eq("user_id", portalUserId) : Promise.resolve({ data: [] }),
        Promise.resolve({ data: [] }), Promise.resolve({ data: [] }), Promise.resolve({ data: [] }),
        portalUserId ? supabase.from("learning_attempts").select("id, subject_slug").eq("user_id", portalUserId).eq("grade", child.grade) : Promise.resolve({ data: [] }),
      ]);

      const topics = (topicsRes.data || []) as LearningTopic[];
      const mastery = (masteryRes.data || []) as LearnerTopicMastery[];
      const topicIds = topics.map(t => t.id);

      const [vRes, nRes, qRes] = topicIds.length ? await Promise.all([
        supabase.from("learning_videos").select("id, topic_id").in("topic_id", topicIds).eq("is_active", true),
        supabase.from("learning_notes").select("id, topic_id").in("topic_id", topicIds).eq("is_active", true),
        supabase.from("learning_questions").select("id, topic_id").in("topic_id", topicIds).eq("is_active", true),
      ]) : [{ data: [] }, { data: [] }, { data: [] }];

      const bySubject = new Map<string, SubjectMasterySummary>();
      for (const t of topics) {
        const ex = bySubject.get(t.subject_slug) || {
          subject_slug: t.subject_slug, mastery_percent: 0,
          competency_level: "emerging" as const,
          topics_count: 0, videos_count: 0, notes_count: 0, questions_count: 0,
          assessments_completed: 0, time_spent_seconds: 0,
        };
        ex.topics_count += 1; bySubject.set(t.subject_slug, ex);
      }
      const topicSubject = new Map(topics.map(t => [t.id, t.subject_slug] as const));
      (vRes.data || []).forEach((v: any) => { const s = topicSubject.get(v.topic_id); if (s) bySubject.get(s)!.videos_count++; });
      (nRes.data || []).forEach((n: any) => { const s = topicSubject.get(n.topic_id); if (s) bySubject.get(s)!.notes_count++; });
      (qRes.data || []).forEach((q: any) => { const s = topicSubject.get(q.topic_id); if (s) bySubject.get(s)!.questions_count++; });
      const masteryBySubject = new Map<string, number[]>();
      const timeBySubject = new Map<string, number>();
      for (const m of mastery) {
        const arr = masteryBySubject.get(m.subject_slug) || [];
        arr.push(Number(m.mastery_percent) || 0);
        masteryBySubject.set(m.subject_slug, arr);
        timeBySubject.set(m.subject_slug, (timeBySubject.get(m.subject_slug) || 0) + (m.time_spent_seconds || 0));
      }
      for (const [slug, sum] of bySubject) {
        const arr = masteryBySubject.get(slug) || [];
        sum.mastery_percent = arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100 : 0;
        sum.competency_level = sum.mastery_percent >= 80 ? "exceeding"
          : sum.mastery_percent >= 60 ? "meeting"
          : sum.mastery_percent >= 40 ? "approaching" : "emerging";
        sum.time_spent_seconds = timeBySubject.get(slug) || 0;
      }
      for (const a of attemptsRes.data || []) {
        const s = (a as any).subject_slug as string | null;
        if (s && bySubject.has(s)) bySubject.get(s)!.assessments_completed++;
      }

      setSummaries(Array.from(bySubject.values()));
      setStreak(streakRes.data ? { current: (streakRes.data as any).current_streak || 0, longest: (streakRes.data as any).longest_streak || 0 } : null);
      setBadgesCount((badgesRes.data || []).length);
      setLoading(false);
    })();
  }, [child.id, child.grade]);

  return (
    <div className="space-y-4">
      <Card className="border-primary/15 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="p-4 grid grid-cols-3 gap-3">
          <Tile label="Subjects with content" value={summaries.length.toString()} />
          <Tile label="Learning streak" value={streak ? `${streak.current} day${streak.current === 1 ? "" : "s"}` : "—"} icon={<Flame className="w-4 h-4 text-orange-500" />} />
          <Tile label="Badges earned" value={badgesCount.toString()} icon={<Trophy className="w-4 h-4 text-amber-500" />} />
        </CardContent>
      </Card>

      {!hasAccount && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-3 text-xs text-amber-900">
            Your child doesn't have a Learning Portal account linked yet, so individual mastery and streaks won't appear here. Available CBC content for {child.grade} is still listed below.
          </CardContent>
        </Card>
      )}

      <MasteryDashboard grade={child.grade} summaries={summaries} loading={loading} basePath="/learn" />
    </div>
  );
}

function Tile({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg px-3 py-2 flex items-center gap-2 shadow-sm">
      {icon && <div>{icon}</div>}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground leading-tight">{label}</p>
        <p className="text-sm font-bold leading-tight">{value}</p>
      </div>
    </div>
  );
}
