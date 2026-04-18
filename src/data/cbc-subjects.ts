// Official KICD CBC learning areas per grade band.
// Used by Content Generation so teachers always see every CBC subject for a grade,
// regardless of what their school has configured locally in `learning_areas`.

import { getGradeLevel } from '@/lib/grade-levels';

export type CbcBand = 'pre-primary' | 'lower-primary' | 'upper-primary' | 'junior-secondary';

const PRE_PRIMARY: string[] = [
  'Language Activities',
  'Mathematical Activities',
  'Environmental Activities',
  'Psychomotor and Creative Activities',
  'Religious Education Activities',
  'Pastoral Programme of Instruction',
];

const LOWER_PRIMARY: string[] = [
  'Literacy Activities',
  'Kiswahili Language Activities / Kenyan Sign Language',
  'English Language Activities',
  'Indigenous Language Activities',
  'Mathematical Activities',
  'Environmental Activities',
  'Hygiene and Nutrition Activities',
  'Religious Education Activities (CRE/IRE/HRE)',
  'Movement and Creative Activities',
];

const UPPER_PRIMARY: string[] = [
  'English',
  'Kiswahili / Kenyan Sign Language',
  'Mathematics',
  'Home Science',
  'Agriculture',
  'Science and Technology',
  'Creative Arts',
  'Physical and Health Education',
  'Religious Education (CRE/IRE/HRE)',
  'Social Studies',
];

// Official KICD Junior School (Grades 7–9) lesson allocation per week
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

/** Returns the official KICD lessons-per-week for a (grade, subject), or null if not specified. */
export function getOfficialLessonsPerWeek(grade: string, subject: string): number | null {
  if (getCbcBand(grade) === 'junior-secondary') {
    return JUNIOR_SECONDARY_ALLOCATION[subject] ?? null;
  }
  return null;
}

export function getCbcBand(grade: string): CbcBand {
  const g = grade.trim().toLowerCase();
  if (g.startsWith('pp') || g.includes('pre')) return 'pre-primary';
  const n = parseInt(g.replace(/[^\d]/g, ''), 10);
  if (!Number.isNaN(n)) {
    if (n >= 1 && n <= 3) return 'lower-primary';
    if (n >= 4 && n <= 6) return 'upper-primary';
    if (n >= 7 && n <= 9) return 'junior-secondary';
  }
  // Fallback via existing helper
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
