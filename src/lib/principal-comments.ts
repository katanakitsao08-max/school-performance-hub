// Rule-based principal comments. No AI.
// Bands are stored per school in `principal_comment_bands` and are fully editable
// by the school admin in Settings → Report Comments.
//
// If a school has no custom bands yet, we fall back to the system defaults below.

export type PrincipalCommentBand = {
  id?: string;
  min_score: number; // inclusive
  max_score: number; // inclusive
  comment: string;
  sort_order?: number;
};

export const DEFAULT_PRINCIPAL_COMMENT_BANDS: PrincipalCommentBand[] = [
  { min_score: 80, max_score: 100, comment: "Excellent performance. Keep up the good work.", sort_order: 1 },
  { min_score: 65, max_score: 79,  comment: "Very good progress. Maintain consistency.",      sort_order: 2 },
  { min_score: 50, max_score: 64,  comment: "Good effort. More focus is needed.",             sort_order: 3 },
  { min_score: 40, max_score: 49,  comment: "Fair performance. Improvement required.",         sort_order: 4 },
  { min_score: 0,  max_score: 39,  comment: "Needs academic support and improvement.",         sort_order: 5 },
];

/**
 * Pick the comment whose band contains `meanPct`.
 * `meanPct` is expected to be a percentage (0–100).
 * Returns "" only if no bands exist at all.
 */
export function getPrincipalComment(
  meanPct: number,
  bands: PrincipalCommentBand[] = DEFAULT_PRINCIPAL_COMMENT_BANDS,
): string {
  if (!bands || bands.length === 0) return "";
  const score = Number.isFinite(meanPct) ? Math.max(0, Math.min(100, meanPct)) : 0;
  // Try inclusive match first
  const hit = bands.find(b => score >= b.min_score && score <= b.max_score);
  if (hit) return hit.comment || "";
  // Fallback: lowest band
  const sorted = [...bands].sort((a, b) => a.min_score - b.min_score);
  return sorted[0]?.comment || "";
}
