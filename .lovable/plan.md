# Reporting System Overhaul — Phase 1 + SMS + Excel

Aligns PerformTrack reports with the new standard: admin-controlled subject merging, one calculation engine, and consistent output across screen, PDF, Excel, and SMS. Analytics/Dashboard/AI stay on the existing path for now and will be migrated in a later phase.

## 1. Database (migration, requires your approval)

Two new tables scoped by school + grade:

- `merged_subjects` — `id`, `school_id`, `grade`, `name` (e.g. "SCIENCES"), `code` (e.g. "SCI"), `max_score` (default 100), `is_active`, `created_by`, `created_at`, `updated_at`. Unique on (`school_id`, `grade`, lower(`name`)).
- `merged_subject_items` — `id`, `merged_subject_id`, `learning_area_id`. Unique on (`merged_subject_id`, `learning_area_id`) and unique on (`school_id`, `grade`, `learning_area_id`) via trigger so a subject can only sit in one merge per grade.

RLS: read allowed to any authenticated user in the school; write restricted to `admin` / `super_admin` for that school. Full GRANTs to `authenticated` and `service_role`.

No changes to `scores`, `learners`, `learning_areas`, or grading tables — existing data is preserved.

## 2. Centralized reporting engine

New module `src/lib/reporting/engine.ts` exposes a single `computeClassReport({ schoolId, grade, stream|streams, term, year, assessment })` that returns:

- Filter context (school, grade, streams, term, year, assessment, generatedAt)
- Per-learner rows: subject scores (raw + merged), total, mean, grade, rank
- Class stats: mean score, mean grade, learner count, highest, lowest, grade distribution
- Subject stats: subject means and rankings
- Applied merges (name, code, components, max_score)

Rules baked in:
- Filters strictly by `school_id`, `grade`, `stream` (multi), `term`, `year`, `assessment_type`, `is_active` learners.
- Merged score = sum of component raw scores, rescaled to merged `max_score` (skipping components a learner has no score for, rescaling the denominator accordingly). Component subjects are hidden wherever a merged subject covers them.
- Excludes learners with zero non-zero scores in the assessment (matches current behaviour).
- Assessment type comes from the engine input, never hardcoded.

All existing per-file calculation helpers in Class Reports, PDF, Excel, and SMS builders will be replaced by calls to this engine.

## 3. Admin — Subject Merge Management

New page `src/pages/SubjectMergesPage.tsx` (route `/subject-merges`, sidebar entry under Settings, admin-only). Features:

- Grade selector (from `useSchoolGrades`) + list of merged subjects for that grade.
- Create / edit / delete / enable-disable a merge with name, code, max_score, and multi-select of learning areas for that grade.
- Prevents selecting a subject already used by another merge in the same grade.
- Uses `useQuery`/`useMutation`, toasts on success/error.

## 4. Remove automatic merging

- Delete `src/lib/merge-state.ts` and all `getMergePref` / `setMergePref` / `merge_combined` toggle usages in Marks Entry, Reports, and PDF builders.
- Remove any heuristic auto-merge logic in report builders and SMS builder.
- Replace with the engine's admin-driven merge list.

## 5. Wire-up

- **Class Reports page** (`ReportsPage.tsx` + report components): render from engine output. Header shows school, year, term, assessment type label, grade, stream(s), generated date.
- **Report PDF** (`src/lib/report-card-pdf.ts`, class report PDF paths): accept the engine's report object directly; no re-computation. Header matches on-screen exactly.
- **Excel export**: same engine object → workbook; headers include assessment type.
- **SMS builder** (`src/lib/whatsapp-templates.ts` and SMS/WhatsApp send flows for report summaries): iterate engine subject rows (already merged) so output shows `SCIENCES 71` instead of `BIO 70 / AGR 72`.
- **Validation**: engine throws typed errors ("no assessment marks found", "no active learners in class", "invalid merge configuration") surfaced as toasts in the UI and error PDFs are not generated.

Individual student report cards, Analytics dashboards, AI insights, and Grade Analysis stay on their current calculation paths in this phase; they'll be migrated to the engine in a follow-up so this change stays reviewable.

## 6. Out of scope (deferred to next phase)

- Migrating Analytics, Smart Dashboard, AI Insights, Grade Analysis, and Performance Tracking to the engine.
- Report caching layer.
- Per-term merge scoping (current scope: per school + per grade).

## Technical details

- Files added: `supabase/migrations/<ts>_merged_subjects.sql`, `src/lib/reporting/engine.ts`, `src/lib/reporting/types.ts`, `src/pages/SubjectMergesPage.tsx`, `src/hooks/use-merged-subjects.ts`.
- Files edited: `src/App.tsx` (route), `src/components/AppSidebar.tsx` (nav), `src/pages/ReportsPage.tsx`, `src/components/reports/*`, `src/lib/report-card-pdf.ts`, `src/lib/whatsapp-templates.ts`, Excel export util, Marks Entry pages (remove merge toggle), plus deletion of `src/lib/merge-state.ts`.
- Types regenerate after migration approval; engine and admin page implementation land in the same turn as the wire-up so the app compiles end-to-end.
- No changes to `scores` schema; merged views are computed on read.
