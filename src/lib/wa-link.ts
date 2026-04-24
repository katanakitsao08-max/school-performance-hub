// Utilities for click-to-send wa.me links.
// Uses the admin's currently-active WhatsApp account to deliver messages —
// no API tokens, no QR sessions, zero ban risk.

export function normalizeWhatsAppPhone(raw: string): string | null {
  if (!raw) return null;
  let p = raw.trim().replace(/[\s\-()+]/g, '');
  if (p.startsWith('07') || p.startsWith('01')) p = '254' + p.slice(1);
  else if (p.startsWith('7') && p.length === 9) p = '254' + p;
  // strip any leading + that survived (we already removed it above) and validate
  if (!/^\d{10,15}$/.test(p)) return null;
  return p;
}

/** Build a wa.me URL that opens the recipient's chat with a prefilled message. */
export function buildWaMeLink(recipientPhone: string, message: string): string | null {
  const num = normalizeWhatsAppPhone(recipientPhone);
  if (!num) return null;
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}
