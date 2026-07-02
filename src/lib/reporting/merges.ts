// Admin-controlled subject merging — single source of truth used by
// Class Reports, PDF, Excel, and SMS builders. Auto-merge heuristics are gone;
// only admin-defined merges (stored in the merged_subjects table) apply.

export interface AdminMerge {
  id: string;
  school_id: string;
  grade: string;
  name: string;
  code: string;
  max_score: number;
  member_ids: string[]; // learning_area ids
}

/**
 * Merged score formula (per learner):
 *   score = sum(component_scores) / sum(component_max_scores) * merged_max
 * Components with no score (or score <= 0) are skipped, and the denominator
 * rescales accordingly. Returns 0 when the learner has no component scores.
 */
export function computeMergedScore(
  memberScores: { score: number; max: number }[],
  mergedMax: number,
): number {
  const items = memberScores.filter(m => m && Number(m.score) > 0 && Number(m.max) > 0);
  if (!items.length) return 0;
  const sum = items.reduce((a, b) => a + Number(b.score), 0);
  const maxSum = items.reduce((a, b) => a + Number(b.max), 0);
  return maxSum > 0 ? (sum / maxSum) * Number(mergedMax || 100) : 0;
}

/** Subject IDs consumed by any active merge for the given grade. */
export function coveredMemberIds(merges: AdminMerge[]): Set<string> {
  const s = new Set<string>();
  merges.forEach(m => m.member_ids.forEach(id => s.add(id)));
  return s;
}
