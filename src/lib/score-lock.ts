// Mirror of public.is_score_locked SQL helper.
// Server-side RLS already enforces this; UI uses it to disable controls.
export const LOCK_DAYS = 21;

export type LockableScore = {
  status?: string | null;
  submitted_at?: string | null;
};

export function isScoreLocked(row?: LockableScore | null): boolean {
  if (!row) return false;
  if (row.status === 'unlocked') return false;
  if (row.status === 'locked') return true;
  if (!row.submitted_at) return false;
  const submitted = new Date(row.submitted_at).getTime();
  const cutoff = Date.now() - LOCK_DAYS * 24 * 60 * 60 * 1000;
  return submitted < cutoff;
}

export function daysUntilLock(row?: LockableScore | null): number | null {
  if (!row?.submitted_at) return null;
  if (row.status === 'locked') return 0;
  if (row.status === 'unlocked') return LOCK_DAYS;
  const submitted = new Date(row.submitted_at).getTime();
  const elapsedDays = (Date.now() - submitted) / (24 * 60 * 60 * 1000);
  return Math.max(0, Math.ceil(LOCK_DAYS - elapsedDays));
}
