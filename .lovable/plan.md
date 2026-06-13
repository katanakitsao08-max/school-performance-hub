# Fees Module Enhancement Plan

This is a large upgrade scoped strictly to the Fees Module. No other modules are touched. The existing `fee_records` and `fee_structures` tables remain the source of truth — we add minimal columns and new UI on top, so existing data continues to work.

## 1. Database (small additive migration only)

Add to `public.fee_records` (all nullable, backward compatible):
- `transaction_type text default 'charge'` — `charge | payment | adjustment | discount | waiver | refund`
- `allocation_parent_id uuid` — links a payment row to the charge row it cleared (for auto-allocation history)
- `allocation_mode text` — `auto | manual`

Add `public.fee_audit_log` (id, school_id, actor_user_id, action, entity_type, entity_id, before jsonb, after jsonb, created_at) with RLS scoped to school admins.

Receipt numbering already uses `generate_receipt_number` → format `RCP-YYYY-00001`. We'll keep that; UI label shows the same.

No destructive changes. All current pages keep working.

## 2. New page structure (under existing `/fees`)

Replace the current flat list with a tabbed layout inside `FeesPage.tsx`:

```text
Fees
├─ Accounts        ← one row per learner (consolidated)
├─ Record Payment  ← search learner, allocate, receipt
├─ Fee Structures  ← CRUD by grade/stream/term/year (already partly exists)
├─ Defaulters
├─ Reports         ← collection/daily/defaulters/statements (PDF/XLSX/CSV)
└─ Dashboard       ← finance KPIs + charts
```

### Accounts tab
- One card/row per active learner with: name, adm #, grade/stream, parent name, phone, alt phone, email, total charged, total paid, balance, status badge (Fully Paid / Partial / Unpaid).
- Click → drawer with: fee items table (Item · Charged · Paid · Balance), ledger (Date · Description · Debit · Credit · Running Balance), quick actions (Record Payment, Statement PDF, Send SMS).

### Record Payment
- Search learner → shows outstanding balances per item.
- Enter amount, method (Cash / M-Pesa / Bank / Cheque), reference, date.
- Toggle Auto vs Manual allocation. Auto = FIFO across outstanding items (oldest first); Manual = per-item amount inputs.
- On submit: insert payment row(s), update charges' `amount_paid`, generate receipt, optional auto-SMS confirmation.

### Defaulters
- Filter by grade/stream/min balance. Bulk-select → Send Reminder SMS. Export CSV/XLSX.

### Finance Dashboard
- KPIs: Total Charged, Collected, Outstanding, Collection Rate, # Defaulters, Today/Week/Month payments, SMS sent today.
- Recharts: revenue line, collection trend, outstanding by class.

## 3. Receipts & statements (extend existing `fee-pdf.ts`)
- Receipt already includes school logo/name, receipt #, date, learner, class, method, breakdown, balance. Add: Payment Allocation Details section (which items this payment cleared and by how much). Actions: View / Download / Print / WhatsApp share link.
- Statement already exists; add ledger column ordering and a Share button.

## 4. SMS (uses existing `send-sms-v2` edge function + per-school provider)
Three new templates resolved against the school's registered name:
- Payment Confirmation (auto on payment, toggleable per school)
- Fee Reminder (manual + bulk)
- Full Clearance (auto when balance hits 0)

Bulk SMS Center is reached from Defaulters and from Accounts (multi-select). All sends go through existing SMS credit system and logs to `sms_logs`.

## 5. M-Pesa readiness
Payment form already accepts `mpesa_reference`. We store transaction code, amount, date, payer phone (new optional column on the payment insert — reuse `mpesa_reference` + add `payer_phone` text in metadata-style by reusing an existing field; no schema bloat). Hook point for future Daraja callback already exists via the M-Pesa memory.

## 6. Audit logs
Every create/edit/payment/reversal/receipt-print/SMS call writes to `fee_audit_log` via a small `logFeeAction()` helper (mirrors existing `activity-log.ts`).

## 7. Files touched

New:
- `supabase/migrations/<ts>_fees_module_upgrade.sql` — additive columns + audit table + grants/RLS
- `src/pages/fees/AccountsTab.tsx`
- `src/pages/fees/RecordPaymentTab.tsx`
- `src/pages/fees/DefaultersTab.tsx`
- `src/pages/fees/FinanceDashboardTab.tsx`
- `src/pages/fees/FeeReportsTab.tsx`
- `src/components/fees/LearnerAccountDrawer.tsx`
- `src/components/fees/AllocationEditor.tsx`
- `src/lib/fee-allocation.ts` (FIFO auto-allocator, pure fn + tests)
- `src/lib/fee-audit.ts`

Edited:
- `src/pages/FeesPage.tsx` — convert to tabbed shell, keep current Fee Structures editor intact as one tab
- `src/lib/fee-pdf.ts` — add allocation details section on receipt + Share helper

Not touched: Reports, Parent portal, Grades, Streams, Classes, Marks, etc.

## 8. Rollout order
1. Migration (additive, safe).
2. Accounts tab + drawer (read-only first).
3. Record Payment with auto-allocation + receipt + audit + SMS confirmation.
4. Defaulters + Bulk SMS.
5. Finance Dashboard + Reports exports.

## Confirmation needed
- Proceed with the additive migration above (no breaking changes)?
- Keep `RCP-YYYY-00001` receipt format (matches existing `generate_receipt_number`) instead of `RCPT-2025-000001`?
- Auto-send Payment Confirmation SMS by default, with a per-school toggle in Settings?
