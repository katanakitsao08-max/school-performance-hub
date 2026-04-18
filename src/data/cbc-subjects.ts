// Official KICD CBC learning areas + lessons-per-week per grade band.
// Used by Content Generation so teachers always see every CBC subject for a grade,
// regardless of what their school has configured locally in `learning_areas`.

import { getGradeLevel } from '@/lib/grade-levels';

export type CbcBand = 'pre-primary' | 'lower-primary' | 'upper-primary' | 'junior-secondary';

// Pre-Primary (PP1 / PP2)
const PRE_PRIMARY_ALLOCATION: Record<string, number> = {
  'Language Activities': 5,
  'Mathematical Activities': 5,
  'Environmental Activities': 5,
  'Psychomotor and Creative Activities': 8,
  'Religious Education Activities': 1,
};
const PRE_PRIMARY: string[] = Object.keys(PRE_PRIMARY_ALLOCATION);

// Lower Primary (Grades 1–3)
const LOWER_PRIMARY_ALLOCATION: Record<string, number> = {
  'Indigenous Language Activities': 2,
  'Kiswahili Language Activities / Kenya Sign Language Activities': 4,
  'English Language Activities': 5,
  'Mathematical Activities': 5,
  'Religious Education Activities': 3,
  'Environmental Activities': 4,
  'Creative Activities': 7,
};
const LOWER_PRIMARY: string[] = Object.keys(LOWER_PRIMARY_ALLOCATION);

// Upper Primary (Grades 4–6)
const UPPER_PRIMARY_ALLOCATION: Record<string, number> = {
  'English': 5,
  'Kiswahili / Kenya Sign Language': 4,
  'Mathematics': 5,
  'Religious Education': 3,
  'Science & Technology': 4,
  'Agriculture and Nutrition': 4,
  'Social Studies': 3,
  'Creative Arts': 6,
};
const UPPER_PRIMARY: string[] = Object.keys(UPPER_PRIMARY_ALLOCATION);

// Junior School (Grades 7–9)
const JUNIOR_SECONDARY_ALLOCATION: Record<string, number> = {
  'English': 5,
  'Kiswahili / Kenya Sign Language': 4,
  'Mathematics': 5,
  'Religious Education': 4,
  'Social Studies': 4,
  'Integrated Science': 5,
  'Pre-Technical Studies': 4,
  'Agriculture and Nutrition': 4,
  'Creative Arts and Sports': 5,
};
const JUNIOR_SECONDARY: string[] = Object.keys(JUNIOR_SECONDARY_ALLOCATION);

export function getCbcBand(grade: string): CbcBand {
  const g = grade.trim().toLowerCase();
  if (g.startsWith('pp') || g.includes('pre')) return 'pre-primary';
  const n = parseInt(g.replace(/[^\d]/g, ''), 10);
  if (!Number.isNaN(n)) {
    if (n >= 1 && n <= 3) return 'lower-primary';
    if (n >= 4 && n <= 6) return 'upper-primary';
    if (n >= 7 && n <= 9) return 'junior-secondary';
  }
  const lvl = getGradeLevel(grade);
  if (lvl === 'ecde') return 'pre-primary';
  if (lvl === 'junior') return 'junior-secondary';
  return 'lower-primary';
}

export function getCbcSubjectsForGrade(grade: string): string[] {
  switch (getCbcBand(grade)) {
    case 'pre-primary': return PRE_PRIMARY;
    case 'lower-primary': return LOWER_PRIMARY;
    case 'upper-primary': return UPPER_PRIMARY;
    case 'junior-secondary': return JUNIOR_SECONDARY;
  }
}

/** Returns the official KICD lessons-per-week for a (grade, subject), or null if unspecified. */
export function getOfficialLessonsPerWeek(grade: string, subject: string): number | null {
  switch (getCbcBand(grade)) {
    case 'pre-primary': return PRE_PRIMARY_ALLOCATION[subject] ?? null;
    case 'lower-primary': return LOWER_PRIMARY_ALLOCATION[subject] ?? null;
    case 'upper-primary': return UPPER_PRIMARY_ALLOCATION[subject] ?? null;
    case 'junior-secondary': return JUNIOR_SECONDARY_ALLOCATION[subject] ?? null;
  }
}
