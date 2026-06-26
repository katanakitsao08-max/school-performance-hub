// Super-admin approves or rejects a school signup.
// On approve: creates the school row + admin user, generates credentials, returns them ONCE.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function tempPassword(len = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghjkmnpqrstuvwxyz';
  let s = ''; for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
function usernameFromName(name: string) {
  return (name || 'admin').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 18) || 'admin';
}
function formatPhone(phone: string): string {
  let p = (phone || '').toString().trim().replace(/\D/g, '');
  if (p.startsWith('254')) return p;
  if (p.startsWith('0')) return '254' + p.slice(1);
  if (p.startsWith('7') || p.startsWith('1')) return '254' + p;
  return p;
}
function isValidPhone(raw?: string | null): boolean {
  if (!raw) return false;
  const p = formatPhone(String(raw));
  return /^254[71]\d{8}$/.test(p);
}
async function sendApprovalSms(admin: any, schoolId: string, phone: string, message: string) {
  try {
    if (!isValidPhone(phone)) return { ok: false, error: 'invalid_phone' };
    const { data: cfg } = await admin.from('global_sms_config').select('*').eq('is_active', true).maybeSingle();
    if (!cfg) return { ok: false, error: 'sms_not_configured' };
    const apiToken: string = (cfg.api_key || Deno.env.get('OTS_API_KEY') || '').trim();
    const senderId: string = ((cfg.sender_id || '').toString().trim() || 'PERFORMTRK').slice(0, 11);
    const endpoint: string = (cfg.endpoint || 'https://sms.ots.co.ke/api/v3/sms/send').trim();
    const msgType: string = (cfg.body_template?.type) || 'plain';
    if (!apiToken) return { ok: false, error: 'no_api_token' };
    const to = formatPhone(phone);
    // Match send-sms-v2 payload shape (single recipient top-level fields)
    const payload = { recipient: to, sender_id: senderId, type: msgType, message };
    let httpOk = false; let data: any = null;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
      });
      httpOk = res.ok;
      try { data = await res.json(); } catch { data = await res.text(); }
    } catch (e: any) { data = String(e?.message || e); }

    // Parse provider response (mirrors send-sms-v2 parseResult)
    let ok = false; let errorText: string | null = null; let messageId: string | null = null;
    if (httpOk) {
      if (typeof data === 'string') { ok = true; }
      else {
        const topStatus = String(data?.status || '').toLowerCase();
        const inner = data?.data || {};
        const innerStatus = String(inner?.status || '').toLowerCase();
        messageId = inner?.queue_uid || inner?.messageid || inner?.message_id || inner?.id || null;
        errorText = data?.message || inner?.message || null;
        if (topStatus === 'success' || ['accepted','queued','sent','submitted','ok','success'].includes(innerStatus) || messageId) ok = true;
        else if (topStatus === 'error' || topStatus === 'failed') ok = false;
        else ok = true; // 2xx with no error indicator
      }
    } else {
      errorText = typeof data === 'string' ? data : (data?.message || JSON.stringify(data));
    }

    await admin.from('sms_logs').insert({
      school_id: schoolId, recipient: to, message, sender_id: senderId,
      provider: 'olympus_teleserve', status: ok ? 'sent' : 'failed',
      provider_message_id: messageId, error: ok ? null : (errorText || `HTTP error`),
      segments: message.length <= 160 ? 1 : Math.ceil(message.length / 153),
      used_global_fallback: true, phone_source: 'direct',
    }).then(() => null, () => null);

    return ok ? { ok: true, messageId } : { ok: false, error: errorText || 'send_failed' };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'send_failed' };
  }
}


serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: { user: caller } } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!caller) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    const { data: role } = await admin.from('user_roles').select('role').eq('user_id', caller.id).maybeSingle();
    if (role?.role !== 'super_admin') return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: corsHeaders });

    const { signup_id, action, reason } = await req.json();
    if (!signup_id || !['approve','reject'].includes(action)) {
      return new Response(JSON.stringify({ error: 'Bad request' }), { status: 400, headers: corsHeaders });
    }

    const { data: signup, error: sErr } = await admin.from('school_signups').select('*').eq('id', signup_id).single();
    if (sErr || !signup) return new Response(JSON.stringify({ error: 'Signup not found' }), { status: 404, headers: corsHeaders });
    if (signup.status !== 'pending') return new Response(JSON.stringify({ error: `Already ${signup.status}` }), { status: 400, headers: corsHeaders });

    if (action === 'reject') {
      await admin.from('school_signups').update({ status: 'rejected', rejection_reason: reason || null, decided_by: caller.id, decided_at: new Date().toISOString() }).eq('id', signup_id);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // APPROVE: create school
    const { data: codeRow } = await admin.rpc('generate_school_code');
    const school_code = codeRow as unknown as string;
    const { data: newSchool, error: schErr } = await admin.from('schools').insert({
      school_name: signup.school_name,
      school_code,
      county: signup.county || '',
      contact_email: signup.admin_email,
      contact_phone: signup.admin_phone,
      subscription_status: 'trial',
      plan_id: signup.selected_plan_id || null,
      plan_expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
    }).select('*').single();
    if (schErr) throw schErr;

    // Create admin user — username@school.local (matches Login.tsx convention)
    const baseUsername = usernameFromName(signup.admin_full_name);
    const domain = `school.local`;
    let username = baseUsername;
    let loginEmail = `${username}@${domain}`;
    // Ensure unique across all auth users (paginate)
    const emailExists = async (target: string): Promise<boolean> => {
      const t = target.toLowerCase();
      for (let page = 1; page <= 20; page++) {
        const { data: listData } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        if (!listData?.users?.length) return false;
        if (listData.users.find(u => (u.email || '').toLowerCase() === t)) return true;
        if (listData.users.length < 1000) return false;
      }
      return false;
    };
    for (let i = 0; i < 8; i++) {
      if (!(await emailExists(loginEmail))) break;
      username = `${baseUsername}${Math.floor(Math.random() * 900 + 100)}`;
      loginEmail = `${username}@${domain}`;
    }
    const password = tempPassword(10);

    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email: loginEmail, password, email_confirm: true,
      user_metadata: { full_name: signup.admin_full_name },
    });
    if (cErr || !created.user) {
      // rollback school
      await admin.from('schools').update({
        subscription_status: 'deleted',
        deleted_at: new Date().toISOString(),
        deleted_by: caller.id,
        updated_at: new Date().toISOString(),
      }).eq('id', newSchool.id);
      throw cErr || new Error('Admin user creation failed');
    }
    const uid = created.user.id;
    // Auto-attach admin signup details to profile (full name, phone as WhatsApp number, school)
    // Admin gets all grades by default so they can manage the whole school
    const defaultGrades = ['1','2','3','4','5','6','7','8','9'];
    await admin.from('profiles').upsert({
      user_id: uid,
      full_name: signup.admin_full_name,
      school_id: newSchool.id,
      whatsapp_number: signup.admin_phone || null,
      assigned_grades: defaultGrades,
      assigned_streams: [],
    }, { onConflict: 'user_id' });
    await admin.from('user_roles').upsert({ user_id: uid, role: 'admin' }, { onConflict: 'user_id,role' });

    await admin.from('school_signups').update({
      status: 'approved',
      decided_by: caller.id,
      decided_at: new Date().toISOString(),
      provisioned_school_id: newSchool.id,
    }).eq('id', signup_id);

    // Verify the new admin can actually sign in with the issued credentials.
    // If sign-in fails, reset the password via service role and use the verified one.
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
    const verifyClient = createClient(Deno.env.get('SUPABASE_URL')!, anonKey);
    let verifiedPassword = password;
    let verified = false;
    try {
      const { error: signInErr } = await verifyClient.auth.signInWithPassword({ email: loginEmail, password });
      if (!signInErr) verified = true;
    } catch { /* fall through to reset */ }
    if (!verified) {
      const fresh = tempPassword(10);
      const { error: updErr } = await admin.auth.admin.updateUserById(uid, { password: fresh, email_confirm: true });
      if (!updErr) {
        try {
          const { error: e2 } = await verifyClient.auth.signInWithPassword({ email: loginEmail, password: fresh });
          if (!e2) { verifiedPassword = fresh; verified = true; }
        } catch { /* ignore */ }
      }
    }
    try { await verifyClient.auth.signOut(); } catch { /* ignore */ }

    // Send SMS with the VERIFIED credentials
    const smsMessage =
      `${signup.school_name} has been approved on PerformTrack!\n` +
      `Username: ${username}\n` +
      `Password: ${verifiedPassword}\n` +
      `School code: ${school_code}\n` +
      `Sign in at: https://performtrack.app/login`;
    const smsResult = await sendApprovalSms(admin, newSchool.id, signup.admin_phone, smsMessage);

    return new Response(JSON.stringify({
      ok: true,
      school: newSchool,
      credentials: { loginEmail, username, password: verifiedPassword, fullName: signup.admin_full_name },
      sign_in_verified: verified,
      sms: smsResult,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Decision failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
