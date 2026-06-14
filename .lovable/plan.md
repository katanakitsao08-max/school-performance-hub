
# School Subscription Billing & Collection Module

A self-contained billing module for **school subscriptions only**. Does **not** touch learner fees or `fee_records`. Replaces ad-hoc plan-assignment with a real billing engine: plans → subscriptions → payments (M-Pesa STK or Manual) → auto-activation → access control.

> Inherits the Daraja STK Push work already planned in `.lovable/plan.md`. The shortcode you specified (**3506931**) and the new env var **`M_PESA_CALLBACK_URL`** are wired in here. Learner-side STK (LP parent / independent) stays as planned earlier and shares the same `_shared/mpesa.ts` engine.

---

## 1. Secrets (one-time, user supplies)

- `MPESA_CONSUMER_KEY`
- `MPESA_CONSUMER_SECRET`
- `MPESA_PASSKEY`
- `MPESA_SHORTCODE` (default `3506931`)
- `MPESA_ENV` (`sandbox` | `production`)
- `MPESA_CALLBACK_URL` (optional; defaults to the deployed `mpesa-stk-callback` function URL)

## 2. Database (one migration)

New tables — all RLS-protected, all with grants and `updated_at` triggers:

```text
billing_plans
  id, name (Starter|Professional|Enterprise|Custom), tier,
  monthly_price, term_price, annual_price, custom_price nullable,
  features jsonb, is_active, sort_order

school_subscriptions
  id, school_id (fk schools), plan_id (fk billing_plans),
  billing_cycle ('monthly'|'term'|'annual'|'custom'),
  amount, start_date, end_date,
  status ('active'|'pending_payment'|'trial'|'suspended'|'expired'),
  grace_days int default 7,
  created_by, notes

billing_payments
  id, school_id, subscription_id nullable,
  method ('mpesa_stk'|'bank'|'eft'|'cash'|'mobile_money'|'cheque'),
  amount, reference, receipt_number, payment_date,
  status ('pending'|'submitted'|'approved'|'rejected'|'failed'),
  -- mpesa specific
  mpesa_checkout_request_id unique, mpesa_merchant_request_id,
  mpesa_phone, mpesa_result_code, mpesa_result_desc, mpesa_raw jsonb,
  -- manual specific
  proof_url, notes,
  approved_by, approved_at, rejected_reason,
  created_by

billing_invoices
  id, school_id, subscription_id, payment_id nullable,
  invoice_number unique, amount, issued_at, due_at,
  status ('draft'|'issued'|'paid'|'void'), pdf_url nullable

billing_audit_log
  id, actor_user_id, school_id, action, target_table, target_id, metadata jsonb, created_at
```

Adds to `schools` (only if missing): `plan_expires_at` already exists; reuse it. Add `subscription_grace_until` for grace-period gating.

Helper SQL functions (security definer):
- `activate_school_subscription(_payment_id uuid)` — flips payment→approved, creates/extends `school_subscriptions` row, sets `schools.plan_id` + `plan_expires_at`, creates `billing_invoices` row, logs audit.
- `is_school_billing_active(_school_id uuid) returns boolean` — true when status active OR within grace window.

RLS:
- `billing_plans` — `select` to authenticated.
- `school_subscriptions`, `billing_payments`, `billing_invoices` — school admins/headteachers can `select` own school; super_admin all; service_role all. Insert: school admin can create `pending`/`submitted` rows for own school; super_admin any. Update/delete: super_admin only.
- `billing_audit_log` — super_admin select only; service_role insert.

Seeds: 3 default plans (Starter / Professional / Enterprise) with sample monthly/term/annual prices and feature flags mirroring existing `subscription_plans.features` shape so `usePlanFeatures()` keeps working unchanged.

## 3. Edge functions

Shared: `supabase/functions/_shared/mpesa.ts` — `getAccessToken()` (50 min cache), `stkPush()`, `normalizeMsisdn()`. Reads `MPESA_CALLBACK_URL` first, falls back to project URL.

- `billing-stk-initiate` (auth required) — school admin or super_admin. Validates plan + cycle, writes `billing_payments` row status `pending` + method `mpesa_stk`, calls Daraja STK, returns `checkout_request_id`.
- `mpesa-stk-callback` (public, `verify_jwt = false`) — single callback for both learner-side and school-side. Looks up payment by `mpesa_checkout_request_id`, marks success/failed, on success calls `activate_school_subscription` or learner-side activation depending on `purpose`.
- `billing-stk-status` (auth) — client polls by `checkout_request_id`.
- `billing-manual-submit` (auth) — school admin uploads proof to `billing-proofs` storage bucket, creates `billing_payments` row status `submitted`.
- `billing-manual-approve` (auth, super_admin only) — calls `activate_school_subscription`.
- `billing-manual-reject` (auth, super_admin only) — sets status `rejected` + reason, logs audit, notifies school.
- `billing-notify` (internal) — sends SMS via existing `send-sms-v2` and email via existing notifications path on activation / expiry warning.
- `subscription-expiry-sweep` (scheduled daily via pg_cron) — sets `expired` once past `end_date + grace_days`; sends T-7 / T-3 / T-0 reminders; reuses `renewal-reminders` pattern.

`supabase/config.toml`: add `[functions.mpesa-stk-callback] verify_jwt = false`.

## 4. Storage

New private bucket `billing-proofs` with RLS:
- school admin can `insert`/`select` own school's prefix `{school_id}/...`
- super_admin can `select` all.

## 5. Frontend

### School-side
- `src/pages/SchoolBillingPage.tsx` — visible to admin/headteacher under `/billing`:
  - Current subscription card (plan, cycle, expiry, status, grace countdown).
  - Plan picker → cycle picker → amount.
  - **Pay with M-Pesa** flow: phone input + STK button → polling modal ("Check your phone, enter PIN…") up to 90 s → success toast + refetch.
  - **Manual payment** dialog: method, amount, reference, payment date, notes, proof upload → submitted state with "Pending Verification" badge.
  - Invoice list + download PDF.
  - Payment history table.

### Super Admin
- `src/pages/SuperAdminBillingPage.tsx` under `/admin/billing`:
  - KPI cards: Total Revenue, Active Schools, Pending Approvals, Expired, M-Pesa Collections, Manual Collections, Monthly Revenue.
  - Tabs: **Subscriptions** (search, suspend, extend, change plan), **Pending Approvals** (review manual proofs, approve/reject), **Payments** (filter by method/date), **Plans** (CRUD `billing_plans`), **Analytics** (Recharts: revenue trend, method split, plan distribution), **Audit Log**.
  - CSV export for payments and subscriptions.

### Shared
- `src/hooks/use-billing.ts` — current subscription, plans, payments, invoices.
- `src/hooks/use-stk-push.ts` — initiate + poll (shared with learner flows).
- `src/components/billing/PlanCard.tsx`, `StkPushDialog.tsx`, `ManualPaymentDialog.tsx`, `ApprovalDrawer.tsx`.
- Invoice PDF: extend `src/lib/subscription-receipt-pdf.ts` → `billing-invoice-pdf.ts`.

### Access control (frozen account)
- Extend `AuthContext.isSchoolFrozen` to also become true past `plan_expires_at + grace_days`.
- New `<BillingGate>` wrapper on protected routes shows full-screen banner: "Subscription expired. Renew to continue using PerformTrack." with a single CTA to `/billing`. Super admin bypasses.

## 6. Notifications

- On payment success or approval: SMS via `send-sms-v2` + WhatsApp via `whatsapp-send` to school admin phone, plus in-app `notifications` row.
- T-7, T-3, T-0, T+grace expiry reminders (handled by `subscription-expiry-sweep`).
- Email path uses existing notifications scaffolding (no new SMTP work in this scope).

## 7. Cron (via supabase--insert, not migration)

- Daily 02:00 Africa/Nairobi: `subscription-expiry-sweep`.
- Daily 08:00 Africa/Nairobi: renewal reminders (shared with LP).

## Technical notes

- Idempotency: `mpesa_checkout_request_id` UNIQUE; callback is no-op when row is already terminal.
- Duplicate prevention on manual: unique partial index on (`school_id`, `reference`, `method`) where reference is not null.
- All admin-only mutations also enforced in edge functions via `has_role(uid,'super_admin')` re-check (defense in depth).
- Audit log written for: plan change, manual approve/reject, suspension, extension, invoice generation.
- Sandbox: shortcode 174379 + test MSISDN 254708374149 if `MPESA_ENV=sandbox`; otherwise uses `MPESA_SHORTCODE=3506931`.

## Out of scope (explicitly)
- Learner fee collection (`fee_records`) — untouched.
- Refunds / partial credits.
- Recurring auto-debit (Daraja STK is one-shot; renewal is reminder + tap-to-pay).
- Multi-currency.

---

**Before I build, one quick confirmation:**
You already started providing M-Pesa credentials in chat earlier (please rotate them in the Daraja portal — anything pasted in chat is no longer safe). After rotation I'll open the secure form so you can enter all 6 secrets at once.

Should I proceed in **sandbox** mode first (shortcode 174379) so you can test the full flow end-to-end before flipping `MPESA_ENV=production` with shortcode 3506931? Reply "go sandbox" or "go production" and I'll start the migration immediately.
