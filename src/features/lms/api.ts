// Shared LMS helpers — used by both Super Admin authoring and the learner shell.
import { supabase } from "@/integrations/supabase/client";

export type LmsLearnerKind = "school" | "independent";

export type Course = {
  id: string; title: string; slug: string;
  subject_slug: string | null; grade: string | null; level: string | null;
  summary: string | null; cover_url: string | null; instructor_name: string | null;
  pass_percent: number; sort_order: number; is_published: boolean;
};
export type Module = {
  id: string; course_id: string; title: string; summary: string | null;
  sort_order: number; is_published: boolean;
};
export type Lesson = {
  id: string; module_id: string; title: string;
  kind: "video" | "notes" | "reading" | "live" | "quiz";
  video_url: string | null; notes_md: string | null; attachment_url: string | null;
  duration_min: number; sort_order: number; is_published: boolean; is_free: boolean;
};
export type Quiz = {
  id: string; course_id: string | null; lesson_id: string | null;
  title: string; pass_percent: number; time_limit_min: number | null; sort_order: number;
};
export type QuizQuestion = {
  id: string; quiz_id: string; prompt: string;
  question_type: "mcq" | "multi_select" | "true_false" | "short_answer";
  options: Array<{ id: string; text: string }>;
  correct_answers: string[];
  explanation: string | null; marks: number; sort_order: number;
};
export type Assignment = {
  id: string; course_id: string; module_id: string | null;
  title: string; instructions_md: string | null; attachment_url: string | null;
  due_at: string | null; max_marks: number; allow_late: boolean;
};
export type LiveSession = {
  id: string; course_id: string; title: string;
  starts_at: string; duration_min: number;
  meeting_url: string | null; host_name: string | null; recording_url: string | null;
};

export function toEmbedUrl(url: string | null): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com") && u.searchParams.get("v"))
      return `https://www.youtube.com/embed/${u.searchParams.get("v")}`;
    if (u.hostname === "youtu.be")
      return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    if (u.hostname.includes("vimeo.com"))
      return `https://player.vimeo.com/video/${u.pathname.replace(/\//g, "")}`;
  } catch { /* ignore */ }
  return url;
}

export function markQuestion(q: QuizQuestion, given: string[]) {
  const correct = new Set(q.correct_answers.map(s => String(s).trim().toLowerCase()));
  const givenSet = new Set(given.map(s => String(s).trim().toLowerCase()));
  let ok = false;
  if (q.question_type === "short_answer") {
    ok = given[0] != null && correct.has(String(given[0]).trim().toLowerCase());
  } else {
    ok = correct.size === givenSet.size && Array.from(correct).every(v => givenSet.has(v));
  }
  return { correct: ok, marks_earned: ok ? q.marks : 0, marks_total: q.marks };
}

export async function markLessonComplete(learnerRef: string, lessonId: string, seconds = 0) {
  await (supabase as any).from("lms_lesson_progress").upsert({
    learner_ref: learnerRef,
    lesson_id: lessonId,
    status: "completed",
    seconds_watched: seconds,
    completed_at: new Date().toISOString(),
  }, { onConflict: "learner_ref,lesson_id" });
}

export async function recordQuizAttempt(opts: {
  learnerRef: string; quizId: string; scorePercent: number; passed: boolean;
  answers: any; durationSeconds: number;
}) {
  await (supabase as any).from("lms_quiz_attempts").insert({
    learner_ref: opts.learnerRef,
    quiz_id: opts.quizId,
    score_percent: opts.scorePercent,
    passed: opts.passed,
    answers: opts.answers,
    duration_seconds: opts.durationSeconds,
  });
}

export function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

/**
 * Badge auto-award engine.
 * Each badge.rule_json supports:
 *   { type: "lessons_completed", count: N }
 *   { type: "quizzes_passed",    count: N }
 *   { type: "perfect_quiz" }                       // any 100% attempt
 *   { type: "course_completed",  course_id?: id }  // certificate issued
 *   { type: "streak_days",       count: N }        // consecutive completion days
 */
export async function evaluateAndAwardBadges(learnerRef: string): Promise<string[]> {
  if (!learnerRef) return [];
  const [badgesRes, ownedRes, lessonsRes, attemptsRes, certsRes] = await Promise.all([
    (supabase as any).from("lms_badges").select("*"),
    (supabase as any).from("lms_learner_badges").select("badge_id").eq("learner_ref", learnerRef),
    (supabase as any).from("lms_lesson_progress").select("lesson_id, status, completed_at").eq("learner_ref", learnerRef),
    (supabase as any).from("lms_quiz_attempts").select("quiz_id, passed, score_percent, created_at").eq("learner_ref", learnerRef),
    (supabase as any).from("lms_certificates").select("course_id").eq("learner_ref", learnerRef),
  ]);
  const badges = (badgesRes.data || []) as Array<{ id: string; rule_json: any; name: string }>;
  const owned = new Set((ownedRes.data || []).map((b: any) => b.badge_id));
  const lessons = (lessonsRes.data || []).filter((l: any) => l.status === "completed");
  const attempts = (attemptsRes.data || []) as Array<any>;
  const certs = (certsRes.data || []) as Array<any>;

  const lessonsDone = lessons.length;
  const passed = attempts.filter(a => a.passed).length;
  const hasPerfect = attempts.some(a => Number(a.score_percent) >= 100);

  // streak: distinct YYYY-MM-DD completion days, longest consecutive run
  const days = (Array.from(new Set(lessons.map((l: any) => (l.completed_at || "").slice(0, 10)).filter(Boolean))) as string[]).sort();
  let bestStreak = 0, cur = 0, prev: number | null = null;
  for (const d of days) {
    const t = new Date(d).getTime();
    if (prev != null && (t - prev) === 86400000) cur += 1; else cur = 1;
    bestStreak = Math.max(bestStreak, cur);
    prev = t;
  }

  const newlyAwarded: string[] = [];
  for (const b of badges) {
    if (owned.has(b.id)) continue;
    const r = b.rule_json || {};
    let qualifies = false;
    switch (r.type) {
      case "lessons_completed": qualifies = lessonsDone >= Number(r.count || 1); break;
      case "quizzes_passed":    qualifies = passed >= Number(r.count || 1); break;
      case "perfect_quiz":      qualifies = hasPerfect; break;
      case "course_completed":  qualifies = r.course_id ? certs.some((c: any) => c.course_id === r.course_id) : certs.length > 0; break;
      case "streak_days":       qualifies = bestStreak >= Number(r.count || 3); break;
    }
    if (qualifies) {
      const { error } = await (supabase as any).from("lms_learner_badges")
        .insert({ learner_ref: learnerRef, badge_id: b.id });
      if (!error) newlyAwarded.push(b.name);
    }
  }
  return newlyAwarded;
}

