// Shared Safaricom Daraja M-Pesa STK Push helper
// Reused by school-side and learner-side STK initiators.

interface TokenCache { token: string; expires: number }
let cache: TokenCache | null = null;

function env(name: string, fallback?: string): string {
  const v = Deno.env.get(name) ?? fallback;
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export function mpesaEnv(): "sandbox" | "production" {
  const e = (Deno.env.get("MPESA_ENV") || "sandbox").toLowerCase();
  return e === "production" ? "production" : "sandbox";
}

export function baseUrl(): string {
  return mpesaEnv() === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";
}

export function shortcode(): string {
  return env("MPESA_SHORTCODE", mpesaEnv() === "sandbox" ? "174379" : undefined);
}

export function passkey(): string { return env("MPESA_PASSKEY"); }

export function normalizeMsisdn(input: string): string {
  let p = (input || "").replace(/\D+/g, "");
  if (p.startsWith("0")) p = "254" + p.slice(1);
  else if (p.startsWith("7") || p.startsWith("1")) p = "254" + p;
  else if (p.startsWith("+254")) p = p.slice(1);
  if (!/^2547\d{8}$/.test(p) && !/^2541\d{8}$/.test(p)) {
    throw new Error("Invalid Kenyan phone number (must be 2547XXXXXXXX or 2541XXXXXXXX)");
  }
  return p;
}

export async function getAccessToken(): Promise<string> {
  if (cache && cache.expires > Date.now() + 30_000) return cache.token;
  const key = env("MPESA_CONSUMER_KEY");
  const secret = env("MPESA_CONSUMER_SECRET");
  const basic = btoa(`${key}:${secret}`);
  const res = await fetch(`${baseUrl()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${basic}` },
  });
  if (!res.ok) throw new Error(`Daraja token failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  cache = { token: json.access_token, expires: Date.now() + 50 * 60_000 };
  return cache.token;
}

function timestamp(): string {
  const d = new Date();
  const p = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export interface StkPushArgs {
  phone: string;
  amount: number;
  accountReference: string;
  description: string;
  callbackUrl?: string;
}

export async function stkPush(args: StkPushArgs) {
  const token = await getAccessToken();
  const ts = timestamp();
  const sc = shortcode();
  const password = btoa(`${sc}${passkey()}${ts}`);
  const callbackUrl = args.callbackUrl
    || Deno.env.get("MPESA_CALLBACK_URL")
    || `${Deno.env.get("SUPABASE_URL")}/functions/v1/mpesa-stk-callback`;
  const body = {
    BusinessShortCode: sc,
    Password: password,
    Timestamp: ts,
    TransactionType: "CustomerPayBillOnline",
    Amount: Math.max(1, Math.round(args.amount)),
    PartyA: normalizeMsisdn(args.phone),
    PartyB: sc,
    PhoneNumber: normalizeMsisdn(args.phone),
    CallBackURL: callbackUrl,
    AccountReference: args.accountReference.slice(0, 12),
    TransactionDesc: args.description.slice(0, 13),
  };
  const res = await fetch(`${baseUrl()}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || json.ResponseCode !== "0") {
    throw new Error(json.errorMessage || json.ResponseDescription || `STK push failed (${res.status})`);
  }
  return {
    CheckoutRequestID: json.CheckoutRequestID as string,
    MerchantRequestID: json.MerchantRequestID as string,
    raw: json,
  };
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
