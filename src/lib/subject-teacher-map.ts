// Subject Teacher Mapping helper.
// Builds a quick-lookup map from (grade, stream, learning_area_id) -> teacher full name,
// using teacher_assignments + profiles. Used by consolidated reports (Phase 2)
// and the new analytics screens.

export interface TeacherAssignmentRow {
  teacher_id: string;
  grade: string;
  stream: string | null;
  learning_area_id: string;
}

export interface ProfileRow {
  user_id: string;
  full_name: string;
}

export function buildSubjectTeacherMap(
  assignments: TeacherAssignmentRow[],
  profiles: ProfileRow[],
): Map<string, string> {
  const nameById = new Map(profiles.map(p => [p.user_id, p.full_name] as const));
  const map = new Map<string, string>();
  for (const a of assignments) {
    const key = `${a.grade}|${a.stream ?? ''}|${a.learning_area_id}`;
    const name = nameById.get(a.teacher_id);
    if (name) map.set(key, name);
  }
  return map;
}

export function getSubjectTeacherName(
  map: Map<string, string>,
  grade: string,
  stream: string,
  learningAreaId: string,
): string {
  return (
    map.get(`${grade}|${stream}|${learningAreaId}`) ||
    map.get(`${grade}|${''}|${learningAreaId}`) ||
    '—'
  );
}

export function getTeacherInitialsFromName(name: string): string {
  if (!name || name === '—') return '';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');
}
