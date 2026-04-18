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

/** Find the ACTIVE curriculum design for a given grade/subject/term. */
export async function findActiveCurriculumDesign(
  grade: string,
  subject: string,
  term: string | number,
): Promise<DbCurriculumDesign | null> {
  const termInt = termToInt(term);

  const { data: design, error } = await supabase
    .from("curriculum_designs")
    .select("id, grade, subject, term, version, title")
    .eq("grade", grade)
    .ilike("subject", subject)
    .eq("term", termInt)
    .eq("status", "active")
    .order("version", { ascending: false })
    .maybeSingle();

  if (error || !design) return null;

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
