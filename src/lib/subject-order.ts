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

export type SubjectColumn<T extends { id: string; name: string; max_score: number }> =
  | { kind: 'single'; subject: T }
  | { kind: 'merged'; label: string; code?: string; members: T[]; max_score: number };

/**
 * Admin-defined merge (from the merged_subjects table) used to build columns.
 * Auto-merge heuristics were removed — only admin-configured merges apply.
 */
export interface AdminMergeInput {
  name: string;
  code?: string;
  max_score: number;
  member_ids: string[];
}

export function buildSubjectColumns<T extends { id: string; name: string; max_score: number }>(
  subjects: T[],
  grade: string,
  adminMerges: AdminMergeInput[] = [],
): SubjectColumn<T>[] {
  const sorted = sortSubjectsByOrder(subjects, grade);
  if (!adminMerges || adminMerges.length === 0) {
    return sorted.map(s => ({ kind: 'single' as const, subject: s }));
  }

  const byId = new Map(sorted.map(s => [s.id, s]));
  // Assign each subject id to at most one merge (first-wins).
  const claimed = new Map<string, number>();
  adminMerges.forEach((m, i) => {
    m.member_ids.forEach(id => {
      if (!claimed.has(id) && byId.has(id)) claimed.set(id, i);
    });
  });

  const emittedMerge = new Set<number>();
  const cols: SubjectColumn<T>[] = [];
  for (const s of sorted) {
    const mi = claimed.get(s.id);
    if (mi === undefined) {
      cols.push({ kind: 'single', subject: s });
      continue;
    }
    if (emittedMerge.has(mi)) continue;
    emittedMerge.add(mi);
    const merge = adminMerges[mi];
    const members = merge.member_ids.map(id => byId.get(id)).filter(Boolean) as T[];
    if (members.length < 2) {
      // Under-configured merge — fall back to individual columns.
      members.forEach(m => cols.push({ kind: 'single', subject: m }));
    } else {
      cols.push({
        kind: 'merged',
        label: merge.name,
        code: merge.code,
        members,
        max_score: Number(merge.max_score) || members[0].max_score,
      });
    }
  }
  return cols;
}

