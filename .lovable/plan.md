## Goal
Evolve the current Learning Path into a Full LMS — Courses → Modules → Lessons (video/notes/quiz) → Assignments → Live Sessions → Gradebook → Discussions → Certificates — with one shared catalog managed by Super Admin and consumed by two front-ends (parent portal child view and `/learn` independent portal), still paywalled per learner.

## Data model (new tables in `public`, all RLS-on, all GRANTed)
- `lms_courses` — id, title, slug, subject_slug, grade, level (KPSEA/KJSEA), summary, cover_url, sort_order, is_published, created_by(super_admin).
- `lms_modules` — id, course_id, title, sort_order, is_published.
- `lms_lessons` — id, module_id, title, kind (video|notes|reading|live), video_url, notes_md, attachment_url, duration_min, sort_order, is_published.
- `lms_quizzes` — id, lesson_id (nullable for module quiz), title, pass_percent, time_limit_min.
- `lms_quiz_questions` — id, quiz_id, prompt, type, options jsonb, correct_answers text[], marks, sort_order.
- `lms_assignments` — id, course_id, module_id (nullable), title, instructions_md, attachment_url, due_at, max_marks, allow_late.
- `lms_assignment_submissions` — id, assignment_id, learner_ref (uuid: learners.id or independent_learners.id), submitted_at, file_url, text_answer, score, feedback, graded_at, graded_by.
- `lms_live_sessions` — id, course_id, title, starts_at, duration_min, meeting_url, host_name, recording_url.
- `lms_live_attendance` — id, session_id, learner_ref, joined_at, left_at.
- `lms_discussion_threads` — id, lesson_id, author_ref, title, body, created_at.
- `lms_discussion_replies` — id, thread_id, author_ref, body, created_at.
- `lms_lesson_progress` — id, learner_ref, lesson_id, status (started|completed), seconds_watched, completed_at. Unique (learner_ref, lesson_id).
- `lms_quiz_attempts` — id, learner_ref, quiz_id, score_percent, passed, answers jsonb, created_at.
- `lms_badges` — id, code, name, description, icon, rule_json.
- `lms_learner_badges` — id, learner_ref, badge_id, awarded_at. Unique.
- `lms_certificates` — id, learner_ref, course_id, issued_at, certificate_no, pdf_url. Issued automatically when course completion = 100% and average quiz score ≥ course.pass_percent.

`learner_ref` is just a uuid — we resolve which table at the application layer (school learner via `learners.id`, independent via `independent_learners.id`). RLS uses two helper SQL functions:
- `lms_is_school_learner_of(_ref)` — true when current user is parent of `_ref` via `parent_learners`.
- `lms_is_independent_owner(_ref)` — true when `independent_learners.user_id = auth.uid()`.

## Paywall (unchanged surface, extended logic)
- Reuse `learning_path_entitlements` for school learners (`has_active_learning_path(learner_id)`) and `independent_subscriptions` for independent learners (`has_active_independent_subscription(user_id)`).
- Gate all `lms_*` read RLS on either having an active entitlement, being Super Admin, or being the lesson's content author preview.
- Free preview: every course's first lesson and first quiz remain readable without entitlement (boolean `is_free` on `lms_lessons`).

## Super Admin (single global catalog)
New page `/superadmin/lms` with tabs:
1. Courses (CRUD + publish toggle + cover upload).
2. Curriculum builder per course: drag-ordered modules → lessons; inline editor for video URL, notes (markdown), attachments.
3. Quizzes & question bank (per lesson or module final quiz).
4. Assignments (instructions + due date + max marks).
5. Live sessions (title, datetime, Zoom/Meet URL).
6. Badges & certificate template editor (logo, signature, default text).
7. Analytics: enrollments, completion %, top courses.

Storage: reuse `school-branding` bucket for cover images and a new public `lms-assets` bucket for attachments/notes images.

## Learner front-ends (shared component, two entry points)
A new `src/features/lms/` folder with reusable components used by both:
- Parent portal: replace `ParentLearningPathTab.tsx` content with `<LmsLearnerShell learnerRef={child.id} kind="school" />`.
- Independent portal: rewrite `LearnPortal.tsx` to use `<LmsLearnerShell learnerRef={independent.id} kind="independent" />`.

`LmsLearnerShell` routes:
- `/lms` Course catalog (filter by subject/grade/level, "enrolled" vs "browse").
- `/lms/course/:slug` Course overview, syllabus, progress bar, "Continue" CTA, instructor card, certificate badge when 100%.
- `/lms/lesson/:id` Player: video (YouTube/Vimeo via existing `toEmbedUrl`), notes (markdown), quiz runner reusing `markQuestion()`, "Mark complete" → writes `lms_lesson_progress` and bumps streak.
- `/lms/assignments` Assignment list + submit flow (file upload to `lms-assets`, score view).
- `/lms/live` Upcoming + past live sessions with "Join" (opens meeting_url, marks attendance) and "Watch recording".
- `/lms/discussion/:lessonId` Threads + replies.
- `/lms/progress` Gradebook (per course completion, quiz averages), badges shelf, certificates download.

Paywall integration: existing `LearningPathPaywall.tsx` wraps the shell; free lessons render through.

## Edge function additions
- `lms-issue-certificate` — verifies completion, generates PDF via `jsPDF` reusing brand-aware template, uploads to `lms-assets`, inserts `lms_certificates` row.
- `lms-evaluate-badges` — runs the badge rule set after each quiz/lesson completion.

## Notifications
- Trigger on `lms_assignments` insert → in-app `notifications` for enrolled learners' parents (school) or learner (independent).
- Trigger on `lms_live_sessions` insert → same.
- Cron-style edge call (existing scheduler) for assignment due-soon reminders (24h before).

## Technical details
- All `lms_*` tables follow the GRANT-then-RLS contract (`GRANT SELECT, INSERT, UPDATE, DELETE ON public.<table> TO authenticated; GRANT ALL ... TO service_role;`).
- RLS for catalog tables (`lms_courses`, `lms_modules`, `lms_lessons`, `lms_quizzes`, `lms_quiz_questions`, `lms_assignments`, `lms_live_sessions`, `lms_badges`): SELECT to `authenticated` always; INSERT/UPDATE/DELETE only `has_role(auth.uid(), 'super_admin')`.
- RLS for learner-owned tables (`lms_lesson_progress`, `lms_quiz_attempts`, `lms_assignment_submissions`, `lms_live_attendance`, `lms_learner_badges`, `lms_certificates`, `lms_discussion_*`): user must own the `learner_ref` via helper functions OR be super_admin.
- Reuse existing competency rollup (`competencyFromPercent`) for grade letters in the gradebook.
- Mobile-first; FAB on lesson player for "Mark complete".
- Offline: lesson notes cached via existing `localStorage` queue pattern (read-only when offline).

## Build order (each step is a separate batch/migration)
1. Migration: new `lms_*` tables, helper functions, GRANTs, RLS policies, storage bucket `lms-assets`.
2. Super Admin catalog UI: `/superadmin/lms` with Courses + Modules + Lessons CRUD (covers ~60% of authoring needs).
3. Quizzes + assignments CRUD + question bank.
4. Live sessions + badges + certificate template config.
5. Shared `LmsLearnerShell` + catalog + course detail + lesson player (video/notes/quiz/mark complete).
6. Assignment submission + live session join/attendance.
7. Discussions + gradebook + badges shelf + certificate generation edge function.
8. Notifications triggers + due-soon reminders + analytics for Super Admin.

Existing pages kept until the new shell is wired, then `ParentLearningPathTab.tsx` and `LearnPortal.tsx` are swapped to delegate to the shell.

## Out of scope (call out)
- No per-school course authoring (only Super Admin curates; teachers can be added later).
- No payment changes — paywall amounts and M-Pesa flow stay as-is.
- No native mobile app — PWA only.

Confirm to proceed and I'll start with step 1 (the migration).