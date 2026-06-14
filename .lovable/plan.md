# Performance Auto-Lock (21 Days)

Adds a server-enforced 21-day lock on submitted marks with a School Admin override + audit trail.

## 1. Database (migration)

Extend `public.scores` (and mirror on `public.strand_scores`) with:

- `submitted_at timestamptz` — set on first insert / when teacher saves
- `status text default 'submitted'` — `submitted` | `locked` | `unlocked`
- `locked_at timestamptz`, `locked_by uuid`
- `unlocked_at timestamptz`, `unlocked_by uuid`, `unlock_reason text`
- `edited_at timestamptz`, `edited_by uuid`

New table `public.score_audit_log`:
- `score_id uuid`, `score_table text` (`scores`|`strand_scores`)
- `learner_id`, `learning_area_id`, `school_id`
- `actor_user_id`, `action` (`edit`|`unlock`|`lock`|`delete`)
- `previous_value jsonb`, `new_value jsonb`, `reason text`, `created_at`

Helper SQL function `public.is_score_locked(submitted_at, status) returns boolean`:
returns `status='locked' OR (status<>'unlocked' AND submitted_at < now() - interval '21 days')`.

RLS update on `scores` / `strand_scores`:
- Teacher UPDATE/DELETE policy adds `NOT public.is_score_locked(submitted_at, status)` and `submitted_by = auth.uid()`.
- Admin (`has_role(auth.uid(),'admin')`) keeps full UPDATE/DELETE rights.

Cron (pg_cron + pg_net) every hour calls a tiny edge function `lock-expired-scores` that:
1. Flips `status='locked', locked_at=now()` for rows past 21 days that are still `submitted`.
2. Inserts one grouped notification per (school_id, grade, term) to admins.

Grants: standard `authenticated` + `service_role` on new table.

## 2. Edge functions

- `score-admin-override` (verify_jwt): admin-only. Body: `{ table, score_id, new_value, reason, relock? }`. Validates role, writes audit row, updates score, sets `edited_at/edited_by`, optionally `status='locked'`.
- `lock-expired-scores` (no jwt, cron-invoked): bulk-lock + notify.

## 3. Frontend

- `src/lib/score-lock.ts` — `isLocked(row)` helper mirroring SQL.
- `MarksEntryPage.tsx` / `StrandMarksEntry.tsx`: per-cell disable when locked + 🔒 badge tooltip "Performance Locked (Editable period expired)". Hide bulk-update for teachers when any selected row is locked.
- New `src/components/AdminScoreOverrideDialog.tsx`: Unlock → Reason → Edit → Save (re-lock toggle). Used inline on Marks Entry when `role==='admin'`.
- New `src/pages/ScoreAuditPage.tsx` (admin-only, route `/audit/scores`): table view filterable by learner / subject / date, linked from Performance details and Settings.
- Notification bell already wired — new rows surface automatically.

## 4. Reporting

Analytics queries already read `scores` regardless of status — no change needed. Admin edits write fresh values + `edited_at`, so report recalculation happens on next fetch (React Query invalidation already in place).

## Out of scope

- Migrating historical rows: existing rows get `submitted_at = updated_at`, `status='submitted'` via the migration backfill.
- Bulk uploads keep current behavior but set `submitted_at=now()`.