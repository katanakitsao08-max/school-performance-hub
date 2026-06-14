// Helpers for fee_records aggregation.
//
// A "payment ledger" row is one inserted by RecordPaymentTab to record a cash
// receipt; the FIFO allocator already incremented amount_paid on each charge
// it was allocated to, so the payment row itself MUST NOT be summed into
// charged/paid totals — that double-counts the payment.
//
// Detection: explicit transaction_type='payment' (new rows), OR the legacy
// shape where amount_charged=0 and amount_paid>0.

export const isPaymentLedger = (r: any): boolean =>
  r?.transaction_type === 'payment'
  || (Number(r?.amount_charged ?? 0) === 0 && Number(r?.amount_paid ?? 0) > 0);

export const isCharge = (r: any): boolean => !isPaymentLedger(r);

export const chargeRowsOnly = (rows: any[] = []): any[] => rows.filter(isCharge);

export const chargeTotals = (rows: any[] = []) => {
  const charges = chargeRowsOnly(rows).filter((r: any) => !r?.voided_at);
  const charged = charges.reduce((sum, r) => sum + Number(r?.amount_charged ?? 0), 0);
  const paid = charges.reduce((sum, r) => sum + Number(r?.amount_paid ?? 0), 0);
  return { charged, paid, balance: charged - paid };
};

export const isCollectionReceiptRow = (r: any): boolean =>
  isPaymentLedger(r)
  || (isCharge(r) && Number(r?.amount_paid ?? 0) > 0 && !!r?.receipt_number);
