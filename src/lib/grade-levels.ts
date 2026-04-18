export type SchoolLevel = 'ecde' | 'primary' | 'junior';

export const LEVEL_LABELS: Record<SchoolLevel, string> = {
  ecde: 'ECDE',
  primary: 'Primary',
  junior: 'Junior School',
};

export const LEVEL_ORDER: SchoolLevel[] = ['ecde', 'primary', 'junior'];

/** Auto-derive the school level from a grade label (e.g. "PP1", "1", "7"). */
export function getGradeLevel(grade: string): SchoolLevel {
  const g = grade.trim().toUpperCase();
  if (g.startsWith('PP') || g.startsWith('ECDE') || g === 'BABY' || g === 'NURSERY') return 'ecde';
  const n = parseInt(g, 10);
  if (!isNaN(n)) {
    if (n >= 1 && n <= 6) return 'primary';
    if (n >= 7 && n <= 9) return 'junior';
  }
  return 'primary';
}

export function groupGradesByLevel(grades: string[]): Record<SchoolLevel, string[]> {
  const out: Record<SchoolLevel, string[]> = { ecde: [], primary: [], junior: [] };
  grades.forEach(g => out[getGradeLevel(g)].push(g));
  return out;
}
