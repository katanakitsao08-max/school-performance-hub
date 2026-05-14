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
  'INTERGRATED SCIENCE',
  'AGRICULTURE',
  'AGRICULUTRE',
  'PRE-TECHNICAL STUDIES',
  'PRE TECHNICAL STUDIES',
  'PRETECHNICAL',
  'PRETECHINICAL',
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

// Lower-primary (Grade 1-3) only: merge Religious + Environmental + Creative Activities.
export const LOWER_PRIMARY_MERGE_PAIRS: Array<{ label: string; members: string[] }> = [
  {
    label: 'RELIGIOUS + ENVIRONMENTAL + CREATIVE ACTIVITIES',
    members: [
      'RELIGIOUS EDUCATION ACTIVITIES',
      'CHRISTIAN RELIGIOUS EDUCATION ACTIVITIES',
      'ISLAMIC RELIGIOUS EDUCATION ACTIVITIES',
      'CRE ACTIVITIES',
      'IRE ACTIVITIES',
      'ENVIRONMENTAL ACTIVITIES',
      'CREATIVE ACTIVITIES',
      'CREATIVE ARTS ACTIVITIES',
      'PSYCHOMOTOR AND CREATIVE ACTIVITIES',
    ],
  },
];

export function isLowerPrimary(grade: string): boolean {
  const n = parseInt(grade, 10);
  return n >= 1 && n <= 3;
}

export function getMergePairsForGrade(grade: string) {
  if (isLowerPrimary(grade)) return LOWER_PRIMARY_MERGE_PAIRS;
  return MERGE_PAIRS;
}

export type SubjectColumn<T extends { id: string; name: string; max_score: number }> =
  | { kind: 'single'; subject: T }
  | { kind: 'merged'; label: string; members: T[]; max_score: number };

// Strip noise so "Religious Education" matches "RELIGIOUS EDUCATION ACTIVITIES"
const canon = (s: string) =>
  norm(s)
    .replace(/\bACTIVITIES\b/g, '')
    .replace(/\bAND\b/g, '&')
    .replace(/[^A-Z&]+/g, ' ')
    .trim();

const memberMatches = (subjectName: string, memberCanonical: string) => {
  const a = canon(subjectName);
  const b = memberCanonical;
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
};

export function buildSubjectColumns<T extends { id: string; name: string; max_score: number }>(
  subjects: T[],
  grade: string,
  mergeOn: boolean,
): SubjectColumn<T>[] {
  const sorted = sortSubjectsByOrder(subjects, grade);
  if (!mergeOn) return sorted.map(s => ({ kind: 'single' as const, subject: s }));

  const pairs = getMergePairsForGrade(grade).map(p => ({
    ...p,
    canonMembers: p.members.map(canon),
  }));
  const used = new Set<string>();
  const cols: SubjectColumn<T>[] = [];
  for (const s of sorted) {
    if (used.has(s.id)) continue;
    const pair = pairs.find(p => p.canonMembers.some(cm => memberMatches(s.name, cm)));
    if (pair) {
      const members = sorted.filter(x => pair.canonMembers.some(cm => memberMatches(x.name, cm)));
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

