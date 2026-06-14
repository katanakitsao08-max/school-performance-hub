# STK Push + Auto-Renew Reminders

Replace manual M-Pesa code entry with one-tap STK Push for both **Learning Path (parent + independent learner)** and **school subscription plans**, and send automatic 3-day pre-expiry reminders on both channels.

## 1. Daraja secrets & shared engine

Add secrets (one-time, user supplies):
- `MPESA_CONSUMER_KEY`
- `MPESA_CONSUMER_SECRET`
- `MPESA_SHORTCODE` (Paybill/Till — default 174379 sandbox)
- `MPESA_PASSKEY`
- `MPESA_ENV` (`sandbox` | `production`)
- `MPESA_CALLBACK_BASE` (optional override; defaults to project functions URL)

New shared module `supabase/functions/_shared/mpesa.ts`:
- `getAccessToken()` — OAuth, 50min cache
- `stkPush({ phone, amount, accountRef, description, callbackUrl })` — returns `CheckoutRequestID`
- `normalizeMsisdn()` — 07.. / 01.. / 254.. / +254.. → 2547XXXXXXXX

## 2. Database

New migration:

```text
mpesa_transactions
  id, created_at, updated_at
  purpose: 'lp_parent' | 'lp_independent' | 'school_subscription'
  status: 'pending' | 'success' | 'failed' | 'timeout'
  checkout_request_id (unique), merchant_request_id
  phone, amount, account_ref
  mpesa_receipt, result_code, result_desc, raw_callback jsonb
  -- linkage (nullable, only one set)
  learner_id, parent_user_id, independent_user_id, school_id, plan_id, weeks, months
  requested_by uuid

renewal_reminders_log
  id, kind ('lp'|'school_subscription'), target_id, channel ('sms'|'whatsapp'),
  sent_at, days_before
```

RLS: insert/select scoped to owner (parent/independent/school admin); service_role full.

## 3. Edge functions

- `mpesa-stk-initiate` — validates input, writes pending `mpesa_transactions` row, calls Daraja STK Push, returns `checkout_request_id`.
- `mpesa-stk-callback` — public (verify_jwt=false), parses Safaricom callback, marks row success/failed, on success:
  - LP parent → insert `learning_path_entitlements` (active, `expires_at = now + weeks*7d`)
  - LP independent → insert `independent_subscriptions` (active)
  - School subscription → update `schools.plan_id` + `plan_expires_at`, insert `subscription_payments`
- `mpesa-stk-status` — client polls by `checkout_request_id` for UI feedback.
- `renewal-reminders` — scheduled (pg_cron daily): finds entitlements/subscriptions expiring in ~3 days with no reminder logged, sends SMS via `send-sms-v2` + WhatsApp via `whatsapp-send`, logs to `renewal_reminders_log`. Templates seeded: `LP Renewal Reminder`, `School Subscription Renewal`.

## 4. Frontend wiring

- `LearningPathPaywall.tsx` (parent) — replace manual code form with: phone input + weeks + **"Pay KES X with M-Pesa"** button → calls `mpesa-stk-initiate` → shows "Check your phone, enter PIN" → polls `mpesa-stk-status` every 3s up to 90s → success toast and refetch. Keep manual-code fallback collapsed under "Paid manually? Submit code".
- `IndependentSubscribe.tsx` — same STK flow.
- New `src/components/superadmin/SchoolPlanCheckout.tsx` (and hook into existing plan-assignment UI) — school admin picks plan + months → STK Push to school admin phone.
- Shared hook `useStkPush()` to centralize initiate + poll.

## 5. Cron

Insert (via supabase--insert, not migration) a `pg_cron` job calling `renewal-reminders` daily at 08:00 Africa/Nairobi.

## Technical notes

- Callback URL must be HTTPS and publicly reachable — use `https://<project-ref>.supabase.co/functions/v1/mpesa-stk-callback`. Set `verify_jwt = false` for the callback function in `supabase/config.toml`.
- Sandbox testing uses shortcode 174379, passkey from Daraja portal, test MSISDN 254708374149.
- Idempotency: `checkout_request_id` unique; callback handler is no-op if row already terminal.
- Reminder de-dupe via `renewal_reminders_log` unique (kind, target_id, days_before).
- Keep manual M-Pesa code path as fallback for users whose STK times out — no regression for existing pending submissions.

## Out of scope (next iteration)
- C2B Paybill auto-reconciliation
- B2C refunds
- WhatsApp pay-link buttons

---

**Question before I build:** do you have Daraja **production** credentials ready, or should I configure for **sandbox** first so you can test end-to-end? Either way I'll need the 5 secrets listed in section 1.