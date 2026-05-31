// Shared helpers for the CBC Continuous Learning Platform.
// Competency levels, mastery rollup, badge evaluation, content fetchers.

import { supabase } from "@/integrations/supabase/client";

export type CbcCompetencyLevel = "emerging" | "approaching" | "meeting" | "exceeding";

export const COMPETENCY_LABEL: Record<CbcCompetencyLevel, string> = {
  emerging: "Emerging",
  approaching: "Approaching Expectation",
  meeting: "Meeting Expectation",
  exceeding: "Exceeding Expectation",
};

export const COMPETENCY_SHORT: Record<CbcCompetencyLevel, string> = {
  emerging: "EM",
  approaching: "AE",
  meeting: "ME",
  exceeding: "EE",
};

export const COMPETENCY_COLOR: Record<CbcCompetencyLevel, string> = {
  emerging:     "bg-rose-100 text-rose-700 border-rose-200",
  approaching:  "bg-amber-100 text-amber-700 border-amber-200",
  meeting:      "bg-emerald-100 text-emerald-700 border-emerald-200",
  exceeding:    "bg-violet-100 text-violet-700 border-violet-200",
};

/** Map a percent (0-100) to a CBC competency level. */
export function competencyFromPercent(pct: number): CbcCompetencyLevel {
  if (pct >= 80) return "exceeding";
  if (pct >= 60) return "meeting";
  if (pct >= 40) return "approaching";
  return "emerging";
}

export type LearningQuestionType = "mcq" | "multi_select" | "true_false" | "short_answer";
export type AssessmentKind = "topic_quiz" | "subject_assessment" | "kpsea_mock" | "kjsea_mock";

export const ASSESSMENT_KIND_LABEL: Record<AssessmentKind, string> = {
  topic_quiz: "Topic Quiz",
  subject_assessment: "Subject Assessment",
  kpsea_mock: "KPSEA Mock",
  kjsea_mock: "KJSEA Mock",
};

/** Subject slug catalog kept in sync with src/pages/learn/subjects.ts */
export const SUBJECT_OPTIONS: { slug: string; name: string; icon: string }[] = [
  { slug: "mathematics", name: "Mathematics", icon: "🧮" },
  { slug: "english", name: "English", icon: "📖" },
  { slug: "kiswahili", name: "Kiswahili", icon: "💬" },
  { slug: "integrated-science", name: "Integrated Science", icon: "🧪" },
  { slug: "social-studies", name: "Social Studies", icon: "🌍" },
  { slug: "creative-arts", name: "Creative Arts", icon: "🎨" },
  { slug: "religious-education", name: "Religious Education", icon: "✝️" },
  { slug: "physical-health-education", name: "Physical & Health Education", icon: "🏃" },
  { slug: "pre-technical-studies", name: "Pre-Technical Studies", icon: "🛠️" },
  { slug: "agriculture", name: "Agriculture", icon: "🌱" },
];

export const GRADE_OPTIONS = [
  "PP1","PP2","Grade 1","Grade 2","Grade 3","Grade 4","Grade 5","Grade 6",
  "Grade 7","Grade 8","Grade 9",
];

export function gradeNumber(grade: string): number {
  const m = (grade || "").match(/(\d+)/);
  if (m) return parseInt(m[1], 10);
  return 0;
}

export function tierForGrade(grade: string): "KPSEA" | "KJSEA" {
  return gradeNumber(grade) >= 7 ? "KJSEA" : "KPSEA";
}

/** Convert a YouTube URL to its embeddable form. Leaves other URLs untouched. */
export function toEmbedUrl(url: string): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) {
      return `https://www.youtube.com/embed/${u.searchParams.get("v")}`;
    }
    if (u.hostname === "youtu.be") {
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    }
    if (u.hostname.includes("vimeo.com")) {
      return `https://player.vimeo.com/video/${u.pathname.replace(/\//g, "")}`;
    }
  } catch { /* not a parseable URL */ }
  return url;
}

// ---------- Database types ----------

export type LearningTopic = {
  id: string; school_id: string | null;
  subject_slug: string; grade: string;
  strand: string | null; sub_strand: string | null;
  title: string; description: string | null;
  sort_order: number; is_active: boolean;
};

export type LearningVideo = {
  id: string; topic_id: string; school_id: string | null;
  title: string; description: string | null;
  video_url: string; duration_seconds: number | null;
  thumbnail_url: string | null; sort_order: number; is_active: boolean;
};

export type LearningNote = {
  id: string; topic_id: string; school_id: string | null;
  title: string; content_md: string;
  attachment_url: string | null; sort_order: number; is_active: boolean;
};

export type LearningQuestion = {
  id: string; topic_id: string; school_id: string | null;
  question_type: LearningQuestionType;
  prompt: string;
  options: Array<{ id: string; text: string }>;
  correct_answers: string[];
  explanation: string | null;
  difficulty: number; marks: number; is_active: boolean;
};

export type LearningAssessment = {
  id: string; school_id: string | null;
  kind: AssessmentKind; title: string; description: string | null;
  subject_slug: string | null; grade: string;
  duration_minutes: number; pass_percent: number;
  question_ids: string[]; is_active: boolean;
};

export type LearnerTopicMastery = {
  id: string; user_id: string; topic_id: string;
  subject_slug: string; grade: string;
  mastery_percent: number;
  competency_level: CbcCompetencyLevel;
  attempts_count: number; time_spent_seconds: number;
  last_attempt_at: string | null;
};

// ---------- Auto-marking ----------

export type GivenAnswer = {
  question_id: string;
  given: string[]; // option ids picked (or [string] for short_answer)
};

export type MarkedAnswer = GivenAnswer & {
  correct: boolean;
  marks_earned: number;
  marks_total: number;
};

export function markQuestion(q: LearningQuestion, given: string[]): MarkedAnswer {
  const correctSet = new Set((q.correct_answers || []).map(s => String(s).trim().toLowerCase()));
  const givenSet = new Set((given || []).map(s => String(s).trim().toLowerCase()));

  let correct = false;
  if (q.question_type === "short_answer") {
    const g = (given[0] || "").trim().toLowerCase();
    correct = !!g && correctSet.has(g);
  } else {
    correct = correctSet.size === givenSet.size &&
      Array.from(correctSet).every(v => givenSet.has(v));
  }
  return {
    question_id: q.id,
    given,
    correct,
    marks_earned: correct ? (q.marks || 1) : 0,
    marks_total: q.marks || 1,
  };
}

export function markAttempt(questions: LearningQuestion[], answers: GivenAnswer[]) {
  const byId = new Map(questions.map(q => [q.id, q] as const));
  const marked: MarkedAnswer[] = answers.map(a => {
    const q = byId.get(a.question_id);
    if (!q) return { ...a, correct: false, marks_earned: 0, marks_total: 0 };
    return markQuestion(q, a.given);
  });
  const total = questions.reduce((s, q) => s + (q.marks || 1), 0);
  const earned = marked.reduce((s, m) => s + m.marks_earned, 0);
  const pct = total > 0 ? Math.round((earned / total) * 10000) / 100 : 0;
  return {
    answers: marked,
    earned_marks: earned,
    total_marks: total,
    score_percent: pct,
    competency_level: competencyFromPercent(pct),
  };
}

// ---------- Mastery rollup ----------

/** Recompute a learner's mastery for a topic based on the average of their best
 *  attempts on that topic (last 5 attempts to weight recent practice). */
export async function recomputeTopicMastery(opts: {
  user_id: string; topic_id: string; subject_slug: string; grade: string;
  add_seconds?: number;
}) {
  const { data } = await supabase
    .from("learning_attempts")
    .select("score_percent, duration_seconds")
    .eq("user_id", opts.user_id)
    .eq("topic_id", opts.topic_id)
    .order("created_at", { ascending: false })
    .limit(5);

  const list = (data || []).map(r => Number(r.score_percent) || 0);
  const avg = list.length
    ? Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 100) / 100
    : 0;
  const level = competencyFromPercent(avg);

  // Read existing for incremental time-spent and attempts_count.
  const { data: existing } = await supabase
    .from("learner_topic_mastery")
    .select("time_spent_seconds, attempts_count")
    .eq("user_id", opts.user_id)
    .eq("topic_id", opts.topic_id)
    .maybeSingle();

  const time = (existing?.time_spent_seconds || 0) + (opts.add_seconds || 0);
  const attempts = (existing?.attempts_count || 0) + 1;

  await supabase.from("learner_topic_mastery").upsert({
    user_id: opts.user_id,
    topic_id: opts.topic_id,
    subject_slug: opts.subject_slug,
    grade: opts.grade,
    mastery_percent: avg,
    competency_level: level,
    attempts_count: attempts,
    time_spent_seconds: time,
    last_attempt_at: new Date().toISOString(),
  }, { onConflict: "user_id,topic_id" });

  return { mastery_percent: avg, competency_level: level };
}

// ---------- Streaks ----------

export async function bumpStreak(userId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase.from("learner_streaks")
    .select("*").eq("user_id", userId).maybeSingle();

  let current = 1;
  let longest = 1;
  if (data) {
    const last = data.last_active_date as string | null;
    if (last === today) {
      current = data.current_streak || 1;
    } else {
      const lastDate = last ? new Date(last) : null;
      const ms = lastDate ? Date.now() - lastDate.getTime() : Infinity;
      current = (lastDate && ms < 1000 * 60 * 60 * 36) ? (data.current_streak || 0) + 1 : 1;
    }
    longest = Math.max(data.longest_streak || 0, current);
  }
  await supabase.from("learner_streaks").upsert({
    user_id: userId,
    current_streak: current,
    longest_streak: longest,
    last_active_date: today,
  }, { onConflict: "user_id" });
  return { current, longest };
}

// ---------- Badges ----------

export async function evaluateBadgesAfterAttempt(userId: string) {
  // Cheap evaluation against existing rule set.
  const [attemptsRes, masteryRes, streakRes, badgesRes, kpseaRes, kjseaRes] = await Promise.all([
    supabase.from("learning_attempts").select("id, assessment_id, passed").eq("user_id", userId),
    supabase.from("learner_topic_mastery").select("competency_level").eq("user_id", userId),
    supabase.from("learner_streaks").select("current_streak, longest_streak").eq("user_id", userId).maybeSingle(),
    supabase.from("learning_badges").select("id, code"),
    supabase.from("learning_attempts").select("id, passed, assessment_id, learning_assessments:assessment_id(kind)")
      .eq("user_id", userId).eq("passed", true),
    Promise.resolve(null),
  ]);

  const attempts = attemptsRes.data || [];
  const mastery = masteryRes.data || [];
  const meeting = mastery.filter(m => m.competency_level === "meeting" || m.competency_level === "exceeding").length;
  const exceeding = mastery.filter(m => m.competency_level === "exceeding").length;
  const streak = streakRes.data?.current_streak || 0;
  const passedAttempts = (kpseaRes.data || []) as any[];
  const passedKpsea = passedAttempts.some(a => a.learning_assessments?.kind === "kpsea_mock");
  const passedKjsea = passedAttempts.some(a => a.learning_assessments?.kind === "kjsea_mock");

  const awards: Record<string, boolean> = {
    first_steps:  attempts.length >= 1,
    streak_3:     streak >= 3,
    streak_7:     streak >= 7,
    meeting_5:    meeting >= 5,
    exceeding_5:  exceeding >= 5,
    kpsea_ready:  passedKpsea,
    kjsea_ready:  passedKjsea,
  };

  const codeToId = new Map((badgesRes.data || []).map(b => [b.code as string, b.id as string] as const));
  const toAward = Object.entries(awards)
    .filter(([_, won]) => won)
    .map(([code]) => codeToId.get(code))
    .filter(Boolean) as string[];

  if (toAward.length) {
    await supabase.from("learner_badges").upsert(
      toAward.map(badge_id => ({ user_id: userId, badge_id })),
      { onConflict: "user_id,badge_id", ignoreDuplicates: true } as any
    );
  }
}
