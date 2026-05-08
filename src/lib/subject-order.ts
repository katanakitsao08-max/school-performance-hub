// Canonical subject ordering per level + merge groups for combined-assessment scenarios.

const PRIMARY_ORDER = [
  'ENGLISH',
  'KISWAHILI',
  'MATHEMATICS',
  'SCIENCE',
  'SCIENCE AND TECHNOLOGY',
  'AGRICULTURE',
  'SOCIAL STUDIES',
  'RELIGIOUS EDUCATION',
  'CRE',
  'IRE',
  'CREATIVE ART',
  'CREATIVE ARTS',
];

const JSS_ORDER = [
  'ENGLISH',
  'KISWAHILI',
  'MATHEMATICS',
  'INTEGRATED SCIENCE',
  'AGRICULTURE',
  'PRE-TECHNICAL STUDIES',
  'PRE TECHNICAL STUDIES',
  'PRETECHNICAL',
  'SOCIAL STUDIES',
  'RELIGIOUS EDUCATION',
  'CRE',
  'IRE',
  'CREATIVE ART',
  'CREATIVE ARTS',
];

const norm = (s: string) => (s || '').trim().toUpperCase();

export function isJss(grade: string): boolean {
  const n = parseInt(grade, 10);
  return n >= 7 && n <= 9;
}

export function sortSubjectsByOrder<T extends { name: string }>(items: T[], grade: string): T[] {
  const order = isJss(grade) ? JSS_ORDER : PRIMARY_ORDER;
  const idx = (n: string) => {
    const i = order.indexOf(norm(n));
    return i === -1 ? 999 : i;
  };
  return [...items].sort((a, b) => {
    const ai = idx(a.name); const bi = idx(b.name);
    if (ai !== bi) return ai - bi;
    return (a.name || '').localeCompare(b.name || '');
  });
}

// Pairs that can be merged into a single combined column for entry/reporting.
export const MERGE_PAIRS: Array<{ label: string; members: string[] }> = [
  { label: 'SOCIAL STUDIES & RELIGIOUS EDUCATION', members: ['SOCIAL STUDIES', 'RELIGIOUS EDUCATION', 'CRE', 'IRE'] },
  { label: 'SCIENCE & AGRICULTURE', members: ['SCIENCE', 'SCIENCE AND TECHNOLOGY', 'INTEGRATED SCIENCE', 'AGRICULTURE'] },
];

export type SubjectColumn<T extends { id: string; name: string; max_score: number }> =
  | { kind: 'single'; subject: T }
  | { kind: 'merged'; label: string; members: T[]; max_score: number };

export function buildSubjectColumns<T extends { id: string; name: string; max_score: number }>(
  subjects: T[],
  grade: string,
  mergeOn: boolean,
): SubjectColumn<T>[] {
  const sorted = sortSubjectsByOrder(subjects, grade);
  if (!mergeOn) return sorted.map(s => ({ kind: 'single' as const, subject: s }));

  const used = new Set<string>();
  const cols: SubjectColumn<T>[] = [];
  for (const s of sorted) {
    if (used.has(s.id)) continue;
    const pair = MERGE_PAIRS.find(p => p.members.includes(norm(s.name)));
    if (pair) {
      const members = sorted.filter(x => pair.members.includes(norm(x.name)));
      if (members.length > 1) {
        members.forEach(m => used.add(m.id));
        cols.push({ kind: 'merged', label: pair.label, members, max_score: members[0].max_score });
        continue;
      }
    }
    used.add(s.id);
    cols.push({ kind: 'single', subject: s });
  }
  return cols;
}
