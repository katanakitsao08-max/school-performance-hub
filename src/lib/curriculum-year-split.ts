// Splits a whole-year extracted KICD design into 3 per-term designs.
// Used by the Super Admin curriculum manager when an uploaded PDF covers
// the full year (coverage='year', term=0).
//
// Strategy:
//   1. If the AI tagged sub-strands with `term_hint` (1|2|3), honour it.
//   2. Untagged sub-strands are filled in document order into T1 → T2 → T3
//      by lesson capacity: T1=14*lpw, T2=13*lpw, T3=12*lpw.
//   3. If no sensible lpw available, fall back to even sub-strand count.

import { getOfficialLessonsPerWeek } from "@/data/cbc-subjects";

export interface SubStrandIn {
  name: string;
  term_hint?: number; // 1|2|3 or 0/undefined for "auto"
  lesson_allocation?: number;
  slos?: string[];
  activities?: string[];
  assessment_methods?: string[];
  inquiry_questions?: string[];
  resources?: string[];
  competencies?: string[];
  values?: string[];
  pcis?: string[];
}
export interface StrandIn {
  name: string;
  sub_strands: SubStrandIn[];
}
export interface YearDesignIn {
  grade: string;
  subject: string;
  coverage?: "year" | "term";
  term: number; // 0 = year
  title?: string;
  strands: StrandIn[];
}

export interface SubStrandWithTerm extends SubStrandIn {
  term_hint: 1 | 2 | 3;
  /** Stable ID for drag-between-terms in the review UI. */
  __key: string;
}
export interface StrandWithTerms {
  name: string;
  sub_strands: SubStrandWithTerm[];
}
export interface YearReview {
  grade: string;
  subject: string;
  title?: string;
  strands: StrandWithTerms[];
}

export interface PerTermDesign {
  grade: string;
  subject: string;
  term: 1 | 2 | 3;
  title?: string;
  strands: { name: string; sub_strands: SubStrandIn[] }[];
}

const TERM_WEEKS: Record<1 | 2 | 3, number> = { 1: 14, 2: 13, 3: 12 };

/**
 * Take a whole-year design and assign every sub-strand to a term.
 * Honours `term_hint` first; fills the rest by lesson allocation capacity.
 */
export function planYearReview(input: YearDesignIn): YearReview {
  const lpw = getOfficialLessonsPerWeek(input.grade, input.subject) ?? 5;
  const capacity: Record<1 | 2 | 3, number> = {
    1: TERM_WEEKS[1] * lpw,
    2: TERM_WEEKS[2] * lpw,
    3: TERM_WEEKS[3] * lpw,
  };
  const used: Record<1 | 2 | 3, number> = { 1: 0, 2: 0, 3: 0 };

  // Pass 1: honour explicit hints
  const flat: { strandIdx: number; ssIdx: number; ss: SubStrandIn }[] = [];
  input.strands.forEach((s, si) =>
    s.sub_strands.forEach((ss, ssi) => flat.push({ strandIdx: si, ssIdx: ssi, ss })),
  );

  const assigned = new Map<string, 1 | 2 | 3>();
  flat.forEach(({ strandIdx, ssIdx, ss }) => {
    const key = `${strandIdx}:${ssIdx}`;
    const hint = ss.term_hint;
    if (hint === 1 || hint === 2 || hint === 3) {
      assigned.set(key, hint);
      used[hint] += Math.max(1, ss.lesson_allocation ?? 1);
    }
  });

  // Pass 2: fill the rest in order, choosing the term with the most remaining
  // capacity (so T1 fills first, but won't overflow if a later term has room).
  flat.forEach(({ strandIdx, ssIdx, ss }) => {
    const key = `${strandIdx}:${ssIdx}`;
    if (assigned.has(key)) return;
    const lessons = Math.max(1, ss.lesson_allocation ?? 1);
    let target: 1 | 2 | 3 = 1;
    let bestSlack = capacity[1] - used[1];
    for (const t of [2, 3] as const) {
      const slack = capacity[t] - used[t];
      if (slack > bestSlack) { bestSlack = slack; target = t; }
    }
    assigned.set(key, target);
    used[target] += lessons;
  });

  const strands: StrandWithTerms[] = input.strands.map((s, si) => ({
    name: s.name,
    sub_strands: s.sub_strands.map((ss, ssi) => ({
      ...ss,
      term_hint: assigned.get(`${si}:${ssi}`) ?? 1,
      __key: `${si}:${ssi}`,
    })),
  }));

  return { grade: input.grade, subject: input.subject, title: input.title, strands };
}

/** Convert the (possibly user-edited) review board into 3 per-term designs. */
export function reviewToPerTermDesigns(review: YearReview): PerTermDesign[] {
  const out: PerTermDesign[] = [1, 2, 3].map((t) => ({
    grade: review.grade,
    subject: review.subject,
    term: t as 1 | 2 | 3,
    title: review.title ? `${review.title} — Term ${t}` : undefined,
    strands: [],
  }));

  for (const strand of review.strands) {
    for (const t of [1, 2, 3] as const) {
      const subs = strand.sub_strands
        .filter((ss) => ss.term_hint === t)
        .map(({ __key, term_hint, ...rest }) => rest);
      if (subs.length === 0) continue;
      const target = out[t - 1];
      target.strands.push({ name: strand.name, sub_strands: subs });
    }
  }
  // Drop empty terms (no sub-strands assigned)
  return out.filter((d) => d.strands.length > 0);
}
