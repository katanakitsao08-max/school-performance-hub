// Shared WhatsApp utilities — variable rendering, branding enforcement, AT delivery.

export interface RenderedTemplate {
  body: string;
  missing: string[]; // var keys that were required but absent
}

/** Replace {{1}}, {{2}}, {{school_name}}, etc. */
export function renderTemplate(
  bodyText: string,
  variables: Record<string, string | number | undefined | null>,
  required: string[],
): RenderedTemplate {
  const missing: string[] = [];
  for (const key of required) {
    const v = variables[key];
    if (v === undefined || v === null || String(v).trim() === '') missing.push(key);
  }
  const out = bodyText.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const v = variables[key];
    return v === undefined || v === null ? '' : String(v);
  });
  return { body: out, missing };
}

/** Append "- [School Name]" if not already present anywhere in the body. */
export function enforceSchoolBranding(body: string, schoolName: string): string {
  if (!schoolName) return body;
  const needle = schoolName.trim().toLowerCase();
  if (!needle) return body;
  if (body.toLowerCase().includes(needle)) return body;
  return `${body.trimEnd()}\n\n- ${schoolName}`;
}

/** +254XXXXXXXXX or null. Accepts 07.., 01.., 254.., +254.. */
export function normalizePhoneKE(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let p = raw.trim().replace(/[\s\-()]/g, '');
  if (p.startsWith('07') || p.startsWith('01')) p = '+254' + p.slice(1);
  else if (p.startsWith('254')) p = '+' + p;
  else if (!p.startsWith('+')) return null;
  if (!/^\+\d{10,15}$/.test(p)) return null;
  return p;
}

export interface SendResult {
  ok: boolean;
  channel: 'whatsapp' | 'sms';
  providerId: string | null;
  error: string | null;
}

/** Try WhatsApp via Africa's Talking, fall back to SMS on any failure. */
export async function sendWhatsAppWithSmsFallback(opts: {
  apiKey: string;
  username: string;
  to: string;
  message: string;
}): Promise<SendResult> {
  // 1. WhatsApp attempt (Premium endpoint — fails on sandbox)
  let waError: string | null = null;
  try {
    const res = await fetch('https://content.africastalking.com/whatsapp/message/send', {
      method: 'POST',
      headers: {
        apiKey: opts.apiKey,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: opts.username,
        waNumber: opts.to,
        body: { text: opts.message },
      }),
    });
    const text = await res.text();
    if (res.ok) {
      let json: any = null;
      try { json = JSON.parse(text); } catch { /* ignore */ }
      return { ok: true, channel: 'whatsapp', providerId: json?.id ?? null, error: null };
    }
    waError = `whatsapp ${res.status}: ${text.slice(0, 160)}`;
  } catch (e: any) {
    waError = `whatsapp error: ${e?.message ?? String(e)}`;
  }

  // 2. SMS fallback
  try {
    const res = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: {
        apiKey: opts.apiKey,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ username: opts.username, to: opts.to, message: opts.message }).toString(),
    });
    const text = await res.text();
    let json: any = null;
    try { json = JSON.parse(text); } catch { /* ignore */ }
    if (!res.ok) {
      return { ok: false, channel: 'sms', providerId: null, error: `WA(${waError}); sms ${res.status}` };
    }
    const recip = json?.SMSMessageData?.Recipients?.[0];
    if (recip?.status === 'Success') {
      return { ok: true, channel: 'sms', providerId: recip.messageId ?? null, error: null };
    }
    return { ok: false, channel: 'sms', providerId: null, error: `WA(${waError}); sms ${recip?.status ?? 'unknown'}` };
  } catch (e: any) {
    return { ok: false, channel: 'sms', providerId: null, error: `WA(${waError}); sms error: ${e?.message ?? e}` };
  }
}
