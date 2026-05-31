import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { LearnerTopicMastery, LearningTopic, LearningVideo, LearningNote, LearningQuestion, LearningAssessment } from "@/lib/learning-cms";

export type SubjectMasterySummary = {
  subject_slug: string;
  mastery_percent: number;
  competency_level: "emerging" | "approaching" | "meeting" | "exceeding";
  topics_count: number;
  videos_count: number;
  notes_count: number;
  questions_count: number;
  assessments_completed: number;
  time_spent_seconds: number;
};

/** Loads all topics for a grade, plus counts of videos/notes/questions per subject,
 *  plus the learner's mastery rows. Returns one summary row per subject_slug found. */
export function useLearnerMastery(userId: string | undefined, grade: string | undefined) {
  return useQuery({
    queryKey: ["learner-mastery", userId, grade],
    enabled: !!userId && !!grade,
    queryFn: async (): Promise<{
      summaries: SubjectMasterySummary[];
      topics: LearningTopic[];
      mastery: LearnerTopicMastery[];
    }> => {
      const [topicsRes, masteryRes] = await Promise.all([
        supabase.from("learning_topics").select("*").eq("grade", grade).eq("is_active", true),
        supabase.from("learner_topic_mastery").select("*").eq("user_id", userId).eq("grade", grade),
      ]);

      const topics = (topicsRes.data || []) as LearningTopic[];
      const mastery = (masteryRes.data || []) as LearnerTopicMastery[];

      const topicIds = topics.map(t => t.id);
      const [videosRes, notesRes, questionsRes, attemptsRes] = topicIds.length
        ? await Promise.all([
            supabase.from("learning_videos").select("id, topic_id").in("topic_id", topicIds).eq("is_active", true),
            supabase.from("learning_notes").select("id, topic_id").in("topic_id", topicIds).eq("is_active", true),
            supabase.from("learning_questions").select("id, topic_id").in("topic_id", topicIds).eq("is_active", true),
            supabase.from("learning_attempts").select("id, topic_id, assessment_id, subject_slug").eq("user_id", userId).eq("grade", grade),
          ])
        : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

      const videos = videosRes.data || [];
      const notes = notesRes.data || [];
      const questions = questionsRes.data || [];
      const attempts = attemptsRes.data || [];

      const bySubject = new Map<string, SubjectMasterySummary>();
      for (const t of topics) {
        const ex = bySubject.get(t.subject_slug) || {
          subject_slug: t.subject_slug,
          mastery_percent: 0, competency_level: "emerging" as const,
          topics_count: 0, videos_count: 0, notes_count: 0, questions_count: 0,
          assessments_completed: 0, time_spent_seconds: 0,
        };
        ex.topics_count += 1;
        bySubject.set(t.subject_slug, ex);
      }
      const topicSubject = new Map(topics.map(t => [t.id, t.subject_slug] as const));
      for (const v of videos) {
        const s = topicSubject.get(v.topic_id as string); if (!s) continue;
        const ex = bySubject.get(s)!; ex.videos_count += 1;
      }
      for (const n of notes) {
        const s = topicSubject.get(n.topic_id as string); if (!s) continue;
        const ex = bySubject.get(s)!; ex.notes_count += 1;
      }
      for (const q of questions) {
        const s = topicSubject.get(q.topic_id as string); if (!s) continue;
        const ex = bySubject.get(s)!; ex.questions_count += 1;
      }
      // Aggregate mastery and time
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
        sum.mastery_percent = arr.length ? Math.round((arr.reduce((a,b)=>a+b,0)/arr.length) * 100)/100 : 0;
        sum.competency_level = sum.mastery_percent >= 80 ? "exceeding"
          : sum.mastery_percent >= 60 ? "meeting"
          : sum.mastery_percent >= 40 ? "approaching" : "emerging";
        sum.time_spent_seconds = timeBySubject.get(slug) || 0;
      }
      for (const a of attempts) {
        const s = a.subject_slug as string | null;
        if (s && bySubject.has(s)) bySubject.get(s)!.assessments_completed += 1;
      }

      return {
        summaries: Array.from(bySubject.values()).sort((a,b)=>a.subject_slug.localeCompare(b.subject_slug)),
        topics, mastery,
      };
    },
  });
}
