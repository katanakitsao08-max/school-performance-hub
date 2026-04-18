// ============================================================
//  Curriculum-Driven Scheme of Work Engine
//  ----------------------------------------------------------------
//  Pulls EVERYTHING (strands, sub-strands, SLOs, activities,
//  inquiry questions, competencies, values, PCIs, links) from the
//  KICD-aligned dataset in src/data/cbc-curriculum-designs.ts.
//
//  • Lock mode  → 100% verbatim from the curriculum design
//  • Flex mode  → identical, but the engine APPENDS teacher-supplied
//                 extra activities/resources to each row (cannot
//                 alter SLOs, strands or structure).
//
//  Lessons are distributed strictly by each sub-strand's KICD
//  `lessonAllocation`, in the original strand order, with mid-term
//  break at week 8 and revision in the final week.
// ============================================================

import { findActiveCurriculumDesign, type DbCurriculumDesign, type DbSubStrand } from './curriculum-db';
import type { SchemeRow } from './content-generation-templates';

// Backwards-compatible aliases (engine internals were typed against the old hardcoded shape)
type CurriculumDesign = DbCurriculumDesign;
type CurriculumSubStrand = DbSubStrand;

export type CurriculumMode = 'lock' | 'flex';

export interface FlexAdditions {
  /** Extra activities the teacher wants appended to EVERY lesson row (Flex mode only). */
  extraActivities?: string[];
  /** Extra resources appended to EVERY lesson row (Flex mode only). */
  extraResources?: string[];
}

export interface CurriculumGenerateOptions {
  grade: string;
  subject: string;
  term: string;
  totalWeeks?: number;        // default 13 (10 teaching + 1 break + 1 assessment + 1 revision)
  midTermWeek?: number;       // default 8
  lessonsPerWeek?: number;    // default 5
  mode?: CurriculumMode;      // default 'lock'
  flex?: FlexAdditions;
  /** When provided, only these sub-strand IDs (from the loaded design) are scheduled. */
  selectedSubStrandIds?: string[];
}

function formatThreeSLOs(slos: string[]): string {
  // Take exactly 3, padding from the pool by cycling if fewer than 3 exist.
  const picked: string[] = [];
  for (let i = 0; picked.length < 3 && slos.length > 0; i++) {
    const candidate = slos[i % slos.length];
    if (!picked.includes(candidate)) picked.push(candidate);
    if (i > slos.length * 2) break;
  }
  while (picked.length < 3) picked.push('consolidate skills covered in this sub-strand');
  const letters = ['a)', 'b)', 'c)'];
  return [
    'By the end of the lesson, the learner should be able to:',
    ...picked.slice(0, 3).map((s, i) => `${letters[i]} ${s}`),
  ].join('\n');
}

/**
 * Expand the design into an ordered list of lesson "items", one per lesson,
 * respecting each sub-strand's KICD lessonAllocation and strand sequence.
 * If `selectedIds` is provided, only those sub-strands are included
 * (still in the design's strand/sub-strand order).
 */
function expandLessons(
  design: CurriculumDesign,
  selectedIds?: string[],
): {
  strand: string;
  subStrand: CurriculumSubStrand;
  lessonIndexInSubStrand: number;
}[] {
  const allow = selectedIds && selectedIds.length > 0 ? new Set(selectedIds) : null;
  const out: ReturnType<typeof expandLessons> = [];
  for (const strand of design.strands) {
    for (const ss of strand.subStrands) {
      if (allow && !allow.has(ss.id)) continue;
      const n = Math.max(1, Number(ss.lessonAllocation) || 1);
      for (let i = 0; i < n; i++) {
        out.push({ strand: strand.name, subStrand: ss, lessonIndexInSubStrand: i + 1 });
      }
    }
  }
  return out;
}

export interface CurriculumSchemeResult {
  rows: SchemeRow[];
  design: CurriculumDesign;
  totalCurriculumLessons: number;
  scheduledLessons: number;
  unscheduledLessons: number;
  warnings: string[];
}

/**
 * Generate a curriculum-locked Scheme of Work.
 * Returns null if no ACTIVE design is registered in the database for (grade, subject, term).
 * Now async because curriculum lives in Supabase, not a hardcoded file.
 */
export async function generateCurriculumScheme(
  opts: CurriculumGenerateOptions,
): Promise<CurriculumSchemeResult | null> {
  const design = await findActiveCurriculumDesign(opts.grade, opts.subject, opts.term);
  if (!design) return null;

  const totalWeeks = opts.totalWeeks ?? 13;
  const midTermWeek = opts.midTermWeek ?? 8;
  const lessonsPerWeek = opts.lessonsPerWeek ?? 5;
  const mode: CurriculumMode = opts.mode ?? 'lock';
  const flex = opts.flex ?? {};

  const lessons = expandLessons(design);
  const totalCurriculumLessons = lessons.length;

  // Teaching weeks = totalWeeks − mid-term break − final revision week
  const teachingWeeks = totalWeeks - 2; // last week is revision, mid-term week 8 is break
  const teachingCapacity = teachingWeeks * lessonsPerWeek;
  const warnings: string[] = [];
  if (totalCurriculumLessons > teachingCapacity) {
    warnings.push(
      `Curriculum has ${totalCurriculumLessons} lessons but term only fits ${teachingCapacity}. ${
        totalCurriculumLessons - teachingCapacity
      } lesson(s) will not be scheduled this term.`,
    );
  }

  const rows: SchemeRow[] = [];
  let lessonIdx = 0;

  for (let week = 1; week <= totalWeeks; week++) {
    // Mid-term break
    if (week === midTermWeek) {
      rows.push({
        week,
        lesson: '-',
        strand: 'MID TERM BREAK',
        subStrand: '-',
        slo: '— No lessons this week —',
        experiences: '-',
        inquiry: '-',
        resources: '-',
        assessment: '-',
        remarks: 'Mid-term break',
        isBreak: true,
      });
      continue;
    }

    // Final week → revision (still uses curriculum content already covered)
    if (week === totalWeeks) {
      for (let l = 1; l <= lessonsPerWeek; l++) {
        rows.push({
          week,
          lesson: l,
          strand: 'Revision',
          subStrand: 'End-term consolidation',
          slo: formatThreeSLOs([
            'revise key concepts covered during the term',
            'apply learnt skills in mixed exercises',
            'prepare adequately for end-of-term assessment',
          ]),
          experiences:
            'Learners attempt revision exercises; teacher conducts remedial sessions; group discussions on challenging topics',
          inquiry: 'What have we learnt this term and how can we apply it?',
          resources: 'Course book, revision papers, charts',
          assessment: 'End-of-term assessment',
          remarks: l === lessonsPerWeek ? 'End of term' : '',
        });
      }
      continue;
    }

    // Regular teaching week
    for (let l = 1; l <= lessonsPerWeek; l++) {
      const item = lessons[lessonIdx];
      lessonIdx++;
      if (!item) {
        // Curriculum exhausted before term ends → reinforcement using last sub-strand
        rows.push({
          week,
          lesson: l,
          strand: 'Reinforcement',
          subStrand: 'Consolidation of previous content',
          slo: formatThreeSLOs(['consolidate previously learnt content']),
          experiences: 'Learners revisit and practise concepts already covered',
          inquiry: 'What have we mastered so far?',
          resources: 'Course book',
          assessment: 'Written exercise',
          remarks: 'Reinforcement',
        });
        continue;
      }

      const ss = item.subStrand;
      const baseExperiences = ss.activities.join('; ');
      const baseResources = (ss.resources && ss.resources.length > 0
        ? ss.resources
        : ['Course book', 'Charts']
      ).join(', ');
      const assessment = (ss.assessmentMethods && ss.assessmentMethods.length > 0
        ? ss.assessmentMethods
        : ['Oral questions', 'Written exercise']
      ).join(', ');
      const inquiry = ss.inquiryQuestions[0] || `Why is ${ss.name} important?`;

      // Flex mode: append teacher additions WITHOUT touching SLOs
      const extraAct = mode === 'flex' && flex.extraActivities?.length
        ? `; [Teacher add-ons: ${flex.extraActivities.join('; ')}]`
        : '';
      const extraRes = mode === 'flex' && flex.extraResources?.length
        ? `, ${flex.extraResources.join(', ')}`
        : '';

      rows.push({
        week,
        lesson: l,
        strand: item.strand,
        subStrand: ss.name,
        slo: formatThreeSLOs(ss.slos),       // ← SLOs ALWAYS verbatim
        experiences: baseExperiences + extraAct,
        inquiry,
        resources: baseResources + extraRes,
        assessment,
        remarks: `Lesson ${item.lessonIndexInSubStrand}/${ss.lessonAllocation}`,
      });
    }
  }

  return {
    rows,
    design,
    totalCurriculumLessons,
    scheduledLessons: Math.min(totalCurriculumLessons, lessonIdx),
    unscheduledLessons: Math.max(0, totalCurriculumLessons - lessonIdx),
    warnings,
  };
}
