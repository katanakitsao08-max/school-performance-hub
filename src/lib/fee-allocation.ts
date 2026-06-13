// FIFO automatic payment allocator.
// Given outstanding charges (oldest first) and a payment amount,
// returns an allocation plan: [{ charge_id, amount }, ...] plus any leftover
// (advance/credit) amount.

export interface OutstandingCharge {
  id: string;
  fee_type: string;
  amount_charged: number;
  amount_paid: number;
  created_at: string;
}

export interface AllocationEntry {
  charge_id: string;
  fee_type: string;
  amount: number;
  new_amount_paid: number;
}

export interface AllocationPlan {
  entries: AllocationEntry[];
  remaining: number; // unallocated (advance / credit)
}

export function allocateFIFO(
  charges: OutstandingCharge[],
  payment: number,
): AllocationPlan {
  const sorted = [...charges].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const entries: AllocationEntry[] = [];
  let left = Math.max(0, payment);

  for (const c of sorted) {
    if (left <= 0) break;
    const bal = Math.max(0, Number(c.amount_charged) - Number(c.amount_paid));
    if (bal <= 0) continue;
    const take = Math.min(bal, left);
    entries.push({
      charge_id: c.id,
      fee_type: c.fee_type,
      amount: take,
      new_amount_paid: Number(c.amount_paid) + take,
    });
    left -= take;
  }
  return { entries, remaining: left };
}

export function allocateManual(
  charges: OutstandingCharge[],
  manual: Record<string, number>,
): AllocationPlan {
  const entries: AllocationEntry[] = [];
  let total = 0;
  for (const c of charges) {
    const amt = Number(manual[c.id] || 0);
    if (amt <= 0) continue;
    const bal = Math.max(0, Number(c.amount_charged) - Number(c.amount_paid));
    const take = Math.min(amt, bal);
    if (take <= 0) continue;
    entries.push({
      charge_id: c.id,
      fee_type: c.fee_type,
      amount: take,
      new_amount_paid: Number(c.amount_paid) + take,
    });
    total += take;
  }
  return { entries, remaining: 0 };
}
