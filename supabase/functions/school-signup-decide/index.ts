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

    // Create admin user — username@<school_code lower>.local
    const baseUsername = usernameFromName(signup.admin_full_name);
    const domain = `${school_code.toLowerCase()}.local`;
    let username = baseUsername;
    let loginEmail = `${username}@${domain}`;
    // Ensure unique
    for (let i = 0; i < 5; i++) {
      const { data: ex } = await admin.auth.admin.listUsers();
      if (!ex.users.find(u => u.email === loginEmail)) break;
      username = `${baseUsername}${Math.floor(Math.random() * 90 + 10)}`;
      loginEmail = `${username}@${domain}`;
    }
    const password = tempPassword(10);

    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email: loginEmail, password, email_confirm: true,
      user_metadata: { full_name: signup.admin_full_name },
    });
    if (cErr || !created.user) {
      // rollback school
      await admin.from('schools').delete().eq('id', newSchool.id);
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

    return new Response(JSON.stringify({
      ok: true,
      school: newSchool,
      credentials: { loginEmail, username, password, fullName: signup.admin_full_name },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Decision failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
