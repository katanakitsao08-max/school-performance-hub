# Teacher-First Registration System

A modular extension that lets individual teachers self-register and manage a class **before** their school formally onboards PerformTrack. Built as a new layer — existing admin/teacher/parent/independent-learner flows, grading, reports and dashboards stay untouched.

## 1. Database (new tables only, no edits to existing ones)

New migration adds:

- `pending_schools` — `id`, `school_name`, `county`, `normalized_name` (unique), `onboarding_status` (`pending` | `linked`), `linked_school_id` (nullable → `schools.id`), `created_at`.
- `teacher_registrations` — `id`, `user_id` (auth.users), `full_name`, `email`, `phone`, `tsc_number`, `school_name_raw`, `pending_school_id`, `county`, `class_name`, `stream`, `approval_status` (`pending` | `approved` | `rejected` | `suspended`), `rejection_reason`, `approved_by`, `approved_at`, `linked_school_id` (nullable), `created_at`, `updated_at`.
- `teacher_classes` — `id`, `teacher_user_id`, `pending_school_id`, `class_name`, `stream`, `linked_school_id` (nullable), `created_at`.
- `teacher_learners` — `id`, `class_id` → `teacher_classes`, `teacher_user_id`, `full_name`, `admission_number`, `gender`, `parent_name`, `parent_phone`, `is_active`, `migrated_learner_id` (nullable → `learners.id` after school link), `created_at`, `updated_at`.

A new enum `teacher_registration_status` is added. A new role value `pending_teacher` is added to `app_role` (existing roles untouched). Only this role is granted in self-signup; on approval the user is upgraded to the regular `teacher` role used by the existing app.

### RLS
- `teacher_registrations`: user can `select`/`insert` own row; `super_admin` full access.
- `teacher_classes` / `teacher_learners`: `teacher_user_id = auth.uid()` for full CRUD; `super_admin` full access. After linking, the school admin of `linked_school_id` can read via existing `get_user_school_id()` helper.
- `pending_schools`: any authenticated user can `select`/`insert` (dedup by normalized name via unique index); `super_admin` updates.

### Trigger / function
- `link_teacher_to_school(_pending_school_id, _school_id)` (SECURITY DEFINER, super_admin only): sets `pending_schools.linked_school_id`, updates affected `teacher_registrations.linked_school_id`, and on next teacher login the app offers to migrate `teacher_learners` → `learners` (insert with `school_id`, fill `migrated_learner_id`). No existing learner rows are touched.

## 2. Edge functions (new)

- `teacher-register` — validates payload, creates auth user, inserts profile + `teacher_registrations` row with status `pending`, assigns `pending_teacher` role, dedupes/creates `pending_schools`.
- `teacher-approve` — super_admin only. Sets status, on `approved` swaps role `pending_teacher` → `teacher`, sets `profiles.school_id = NULL` (still standalone) and ensures a `teacher_classes` row exists.
- `teacher-migrate-class` — when a `pending_school` is linked, copies `teacher_learners` into `learners` under the real school and stamps `migrated_learner_id`. Idempotent.

## 3. Frontend (new routes, no changes to existing pages)

```text
/teacher/signup     → TeacherSignup.tsx
/teacher/pending    → TeacherPending.tsx (waiting screen)
/teacher            → TeacherStandaloneDashboard.tsx
  ├─ /teacher/learners
  ├─ /teacher/attendance
  ├─ /teacher/marks
  └─ /teacher/reports
/super-admin/teacher-approvals → TeacherApprovalsPage.tsx
```

- New `ProtectedRoute` variant `allowedRoles={['pending_teacher','teacher_standalone']}` — reuses existing `AuthContext`.
- `SmartRedirect` extended: if role is `pending_teacher` → `/teacher/pending`; if approved standalone teacher with no `school_id` → `/teacher`.
- Existing school-bound teachers (have `school_id`) continue to land on `/teacher-dashboard` exactly as today.

### Signup form
Fields per spec, Zod validation, password + confirm, county dropdown, class/stream inputs. PerformTrack green primary, mobile-first, framer-motion fade-in. Adds a "Register as Teacher" link on `/login` (small, non-intrusive).

### Waiting page
Shows status pill, school name, support phone/email from `school_settings` global fallback.

### Standalone teacher dashboard
Reuses existing UI primitives (Card, Table, etc.). Tabs for Learners / Attendance / Marks / Reports, all reading/writing the new `teacher_*` tables only. "Pending School Onboarding" badge until linked.

### Super-admin approvals
Table with search/filter by status/county, Approve / Reject / Suspend buttons calling `teacher-approve`. Linked into existing `SuperAdminDashboard` sidebar.

## 4. School-linking flow

In existing `ManageSchoolsPage`, add a "Link pending teachers" action per school that lists `pending_schools` with similar name and calls `link_teacher_to_school`. Teachers then see a one-click "Migrate my class into <School>" banner that calls `teacher-migrate-class`.

## 5. Guarantees

- No edits to: `learners`, `scores`, `attendance`, `fee_*`, `reports*`, `whatsapp_*`, `sms*`, `curriculum_*`, existing pages, existing edge functions, grading or PDF logic.
- Only additive migration; no `DROP`, no column changes on existing tables.
- New role gated behind new routes; existing role checks unaffected.

## 6. Build order

1. Migration (tables, enum value, RLS, helper functions).
2. Edge functions `teacher-register`, `teacher-approve`, `teacher-migrate-class`.
3. Frontend: signup → pending → standalone dashboard (learners + attendance + marks + reports).
4. Super-admin approvals page + link-to-school action.
5. Login page "Register as Teacher" entry point + `SmartRedirect` update.
