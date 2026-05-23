// Helpers for choosing between a learner's preferred (parent_phone) and
// secondary (parent_phone_2) contact number for SMS delivery.

export type PhoneSource = 'preferred' | 'secondary';

export function isValidKePhone(raw?: string | null): boolean {
  if (!raw) return false;
  const p = String(raw).trim().replace(/\D/g, '');
  if (!p) return false;
  // Accept 2547XXXXXXXX / 2541XXXXXXXX (12 digits) or 07X / 01X (10 digits) or 7X/1X (9 digits)
  if (/^254[71]\d{8}$/.test(p)) return true;
  if (/^0[71]\d{8}$/.test(p)) return true;
  if (/^[71]\d{8}$/.test(p)) return true;
  return false;
}

export function pickParentPhone(
  preferred?: string | null,
  secondary?: string | null,
): { phone: string | null; source: PhoneSource | null } {
  if (isValidKePhone(preferred)) return { phone: preferred!.trim(), source: 'preferred' };
  if (isValidKePhone(secondary)) return { phone: secondary!.trim(), source: 'secondary' };
  return { phone: null, source: null };
}
