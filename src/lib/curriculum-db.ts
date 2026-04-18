// DB-first curriculum loader — replaces hardcoded src/data/cbc-curriculum-designs.ts
// Falls back gracefully when no active curriculum exists (engine then enters Flex mode).

import { supabase } from "@/integrations/supabase/client";

export interface DbSubStrand {
  id: string;
  name: string;
  lessonAllocation: number;
  slos: string[];
  activities: string[];
  assessmentMethods: string[];
  inquiryQuestions: string[];
  resources: string[];
  competencies: string[];
  values: string[];
  pcis: string[];
}
export interface DbStrand {
  id: string;
  name: string;
  subStrands: DbSubStrand[];
}
export interface DbCurriculumDesign {
  id: string;
  grade: string;
  subject: string;
  term: number;
  version: number;
  title: string | null;
  strands: DbStrand[];
}

function termToInt(t: string | number): number {
  if (typeof t === "number") return t;
  const m = String(t).match(/\d+/);
  return m ? parseInt(m[0], 10) : 1;
}

/**
 * Build the list of grade labels that should match a teacher's selection.
 * KICD designs are often saved at a band level ("Junior Secondary",
 * "Pre-Primary", "Upper Primary") while teachers pick a specific grade
 * ("Grade 7"). We match either the exact grade or its parent band.
 */
function gradeCandidates(grade: string): string[] {
  const g = grade.trim();
  const out = new Set<string>([g]);
  const lower = g.toLowerCase();
  const num = parseInt((lower.match(/\d+/) ?? [""])[0], 10);

  if (lower.startsWith("pp") || lower.includes("pre-primary") || lower.includes("pre primary")) {
    out.add("Pre-Primary");
    out.add("Pre Primary");
  }
  if (!Number.isNaN(num)) {
    if (num >= 1 && num <= 3) {
      out.add("Lower Primary");
    } else if (num >= 4 && num <= 6) {
      out.add("Upper Primary");
    } else if (num >= 7 && num <= 9) {
      out.add("Junior Secondary");
      out.add("Junior School");
    } else if (num >= 10 && num <= 12) {
      out.add("Senior Secondary");
      out.add("Senior School");
    }
  }
  return Array.from(out);
}

/** Normalize a subject name so "Creative Arts Activities" ≈ "Creative Activities" ≈ "creative-arts". */
function normalizeSubject(s: string): string {
  return s
    .toLowerCase()
    .replace(/\bactivities\b/g, "")
    .replace(/\band\b/g, "")
    .replace(/\bthe\b/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

/** Find the ACTIVE curriculum design for a given grade/subject/term. */
export async function findActiveCurriculumDesign(
  grade: string,
  subject: string,
  term: string | number,
): Promise<DbCurriculumDesign | null> {
  const termInt = termToInt(term);
  const grades = gradeCandidates(grade);

  // Pull all active designs for this grade-band & term, then match subject by
  // normalized name (so "Creative Activities" matches "Creative Arts Activities", etc.).
  const { data: candidates, error } = await supabase
    .from("curriculum_designs")
    .select("id, grade, subject, term, version, title")
    .in("grade", grades)
    .eq("term", termInt)
    .eq("status", "active")
    .order("version", { ascending: false });

  if (error || !candidates?.length) return null;

  const wanted = normalizeSubject(subject);
  let design = candidates.find((d) => normalizeSubject(d.subject) === wanted);
  if (!design) {
    // Loose fallback: substring either direction
    design = candidates.find((d) => {
      const n = normalizeSubject(d.subject);
      return n.includes(wanted) || wanted.includes(n);
    });
  }
  if (!design) return null;

  const { data: strands } = await supabase
    .from("curriculum_strands")
    .select("id, name, sort_order")
    .eq("design_id", design.id)
    .order("sort_order");

  if (!strands?.length) {
    return { ...design, strands: [] };
  }

  const strandIds = strands.map((s) => s.id);
  const { data: subs } = await supabase
    .from("curriculum_sub_strands")
    .select("*")
    .in("strand_id", strandIds)
    .order("sort_order");

  const strandsOut: DbStrand[] = strands.map((s) => ({
    id: s.id,
    name: s.name,
    subStrands: (subs ?? [])
      .filter((ss: any) => ss.strand_id === s.id)
      .map((ss: any) => ({
        id: ss.id,
        name: ss.name,
        lessonAllocation: ss.lesson_allocation ?? 1,
        slos: ss.slos ?? [],
        activities: ss.activities ?? [],
        assessmentMethods: ss.assessment_methods ?? [],
        inquiryQuestions: ss.inquiry_questions ?? [],
        resources: ss.resources ?? [],
        competencies: ss.competencies ?? [],
        values: ss.values ?? [],
        pcis: ss.pcis ?? [],
      })),
  }));

  return { ...design, strands: strandsOut };
}

/** Lightweight existence check used by UI badges ("KICD design loaded"). */
export async function hasActiveCurriculumDesign(
  grade: string,
  subject: string,
  term: string | number,
): Promise<boolean> {
  const termInt = termToInt(term);
  const grades = gradeCandidates(grade);
  const { data } = await supabase
    .from("curriculum_designs")
    .select("id")
    .in("grade", grades)
    .ilike("subject", subject)
    .eq("term", termInt)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  return !!data;
}
