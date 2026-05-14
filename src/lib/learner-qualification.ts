/**
 * Strict qualification rule for learner inclusion in reports & analytics.
 *
 * A learner is QUALIFIED only when every subject assigned to their class has
 * a valid, non-zero score entered. Missing / null / empty / zero entries
 * disqualify the learner — they must be excluded from:
 *   - Final report generation
 *   - Subject means
 *   - Class / stream means
 *   - Rankings & positions
 *   - Performance analytics
 *   - Grade distribution
 *
 * Use across the system to keep displayed reports and computed analytics
 * perfectly consistent.
 */

export interface QualifiableSubject {
  id: string;
  // Optional: only used when a learner-level scores map is supplied
}

export interface SubjectScoreCell {
  id: string;
  score: number | null | undefined | string;
}

/** Pure check: every subject has a positive numeric score. */
export function hasValidScore(score: unknown): boolean {
  if (score === null || score === undefined || score === '') return false;
  const n = Number(score);
  return Number.isFinite(n) && n > 0;
}

/**
 * Generic learner qualification: every subject in `subjects` must have a
 * matching score (>0) in the learner's `subjectData` array.
 */
export function isLearnerQualified(
  subjectData: SubjectScoreCell[] | undefined,
  subjects: { id: string }[],
): boolean {
  if (!subjectData || subjects.length === 0) return false;
  return subjects.every(sub => {
    const cell = subjectData.find(d => d.id === sub.id);
    return cell ? hasValidScore(cell.score) : false;
  });
}

/** Lookup-map variant: every subject id must resolve to a valid score. */
export function isLearnerQualifiedByMap(
  scoresById: Record<string, number | null | undefined>,
  subjectIds: string[],
): boolean {
  if (subjectIds.length === 0) return false;
  return subjectIds.every(id => hasValidScore(scoresById[id]));
}

/** Build a per-learner missing-subjects diagnostic for the "Incomplete Results" panel. */
export function describeMissing<T extends { id: string; full_name?: string; subjectData?: SubjectScoreCell[] }>(
  learner: T,
  subjects: { id: string; name: string }[],
): { id: string; name: string; missingSubjects: string[]; missingCount: number } {
  const missing = subjects
    .filter(sub => {
      const cell = learner.subjectData?.find(d => d.id === sub.id);
      return !cell || !hasValidScore(cell.score);
    })
    .map(s => s.name);
  return {
    id: learner.id,
    name: learner.full_name || '',
    missingSubjects: missing,
    missingCount: missing.length,
  };
}
