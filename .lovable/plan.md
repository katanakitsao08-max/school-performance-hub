# Build Plan

## 1. SMS — collapse to a single global provider

**Remove (UI & data):**
- `SchoolSmsConfigCard.tsx` — drop entirely. Schools no longer configure their own provider/endpoint/API key/sender ID/template.
- Per-school config row in Settings page.
- `school_sms_config` table (DB) — drop. Migrate any active row into the existing `global_sms_config` (super admin reviews).

**Keep & simplify:**
- `global_sms_config` (Super Admin only) — single source of truth for endpoint, API key, sender, body template.
- `school_sms_credits` — still per-school: `balance`, `used`, `enabled`. Super Admin allocates / toggles.
- `sms_logs` — still per-school for monitoring.
- `send-sms-v2` edge function — rewrite to always read `global_sms_config`, deduct from caller school's `school_sms_credits`, log per school. Hard-block if `enabled=false` or `balance < count`.

**Super Admin UI (`SuperAdminSmsSection.tsx`):**
- Top card: edit the single global provider (endpoint, API key, sender ID, body template, partner ID) — fields previously in the school card.
- Existing per-school table: allocate credits, enable/disable, view sent/failed/last sent.

## 2. Fix "invalid credentials" after Super Admin creates a school admin

Investigate `create-user` edge function + login flow. Likely root causes:
- Username passed contains spaces/case mix → stored email differs from what admin shares.
- `email_confirm: true` works, but maybe `user_metadata.full_name` collides with later profile upsert; or `username@school.local` synthetic email isn't what the create dialog displays.
- Display the **exact** synthetic email + password in a one-time credential modal after creation, with copy buttons, and normalize username (lowercase, strip spaces) on both create and login sides.

Patches:
- `create-user/index.ts`: normalize username, return `{ login_email, password }`.
- Frontend create-user dialog: show credentials modal with the same normalized values, copy-to-clipboard.
- `Login.tsx`: lowercase + trim username before mapping to `@school.local`.

## 3. Class Teacher Portal (full)

New route `/class-teacher` (auto-redirect for users in `class_teachers` table, when not also a subject teacher with assignments elsewhere). Tabs:

**A. My Class — Roster & Attendance**
- Lists learners in teacher's `grade + stream`.
- Daily attendance grid (present/absent/late) with one-tap bulk mark.
- Weekly attendance % per learner; flag <70%.

**B. Marks & Reports**
- Read-only marks matrix across all learning areas for the class (Opener/Mid/End-Term).
- Generate individual report cards (reuses `report-card-pdf.ts`).
- Batch ZIP export for whole class (reuses `jszip` flow).

**C. Parent Communication**
- Per-learner row → "Message Parent" → choose template (Attendance Alert, Fee Reminder if balance, Custom) → send via:
  - SMS (uses rebuilt global SMS, deducts from school credits)
  - WhatsApp wa.me deep link (no credits)
- Bulk send to all parents in class.

**RLS additions:**
- `class_teachers` already has `Teacher view own class_teacher`. Add helper `get_user_class_assignments()` and policies allowing class teacher SELECT on `learners`, `attendance`, `scores`, `fee_records` for their `(grade, stream)` even without being subject teacher.

## Technical notes

- New file: `src/pages/ClassTeacherPortal.tsx` with three tabs.
- New hook: `useClassTeacherAssignment()` → returns first row from `class_teachers` for current user.
- New migration: drop `school_sms_config`, add `get_user_class_assignments()` SECURITY DEFINER fn, RLS policies.
- Reuse existing components: `BiometricAttendance` block, report PDF helpers, `WhatsAppSendDialog`.
- Update `App.tsx` routing + `AppSidebar` to surface "My Class" entry when `class_teachers` row exists.

## Out of scope (this pass)
- Discipline / class notes module (can ship next).
- Migrating existing per-school SMS API keys (super admin pastes once into global config).

Approve to start building. I'll ship in one pass, in this order: migration → SMS rewrite → login fix → class teacher portal.