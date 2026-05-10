// Persists per-(school, grade, term, year, assessment) merge preference
// so that subjects merged on Marks Entry automatically appear merged on Reports.

const key = (schoolId: string, grade: string, term: number, year: number, assessment: string) =>
  `merge_combined::${schoolId}::${grade}::${term}::${year}::${assessment}`;

export function getMergePref(schoolId?: string | null, grade?: string, term?: number, year?: number, assessment?: string): boolean {
  if (!schoolId || !grade || !term || !year || !assessment) return false;
  try { return localStorage.getItem(key(schoolId, grade, term, year, assessment)) === '1'; } catch { return false; }
}

export function setMergePref(schoolId: string, grade: string, term: number, year: number, assessment: string, value: boolean) {
  try {
    const k = key(schoolId, grade, term, year, assessment);
    if (value) localStorage.setItem(k, '1');
    else localStorage.removeItem(k);
  } catch {}
}
