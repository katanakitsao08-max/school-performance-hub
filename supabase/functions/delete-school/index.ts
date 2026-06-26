// Super-admin only: soft-delete a school, block its accounts, and preserve audit history.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify caller via anon client + their JWT
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: uerr } = await userClient.auth.getUser();
    if (uerr || !user) {
      return new Response(JSON.stringify({ error: 'invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roleRow } = await admin
      .from('user_roles').select('role').eq('user_id', user.id).eq('role', 'super_admin').maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: 'forbidden — super_admin only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { school_id } = await req.json();
    if (!school_id || typeof school_id !== 'string') {
      return new Response(JSON.stringify({ error: 'school_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: schoolBefore, error: schoolLookupErr } = await admin
      .from('schools')
      .select('*')
      .eq('id', school_id)
      .maybeSingle();
    if (schoolLookupErr || !schoolBefore) {
      return new Response(JSON.stringify({ error: schoolLookupErr?.message || 'school not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const nowIso = new Date().toISOString();

    const { error: schoolErr } = await admin.from('schools').update({
      subscription_status: 'deleted',
      deleted_at: schoolBefore.deleted_at || nowIso,
      deleted_by: schoolBefore.deleted_by || user.id,
      updated_at: nowIso,
    }).eq('id', school_id);
    if (schoolErr) {
      return new Response(JSON.stringify({ error: schoolErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { count: disabledUsers } = await admin
      .from('profiles')
      .update({ school_access_status: 'disabled', disabled_at: nowIso, updated_at: nowIso }, { count: 'exact' })
      .eq('school_id', school_id);

    const { count: endedSessions } = await admin
      .from('user_sessions')
      .update({ session_status: 'offline', logout_time: nowIso, updated_at: nowIso }, { count: 'exact' })
      .eq('school_id', school_id)
      .is('logout_time', null);

    await admin.from('audit_logs').insert({
      school_id,
      user_id: user.id,
      user_name: user.email || 'super_admin',
      role: 'super_admin',
      action: 'delete',
      module: 'school',
      record_type: 'school',
      record_id: school_id,
      before_state: schoolBefore,
      after_state: { status: 'deleted', disabled_users: disabledUsers ?? 0, ended_sessions: endedSessions ?? 0 },
      affected_count: disabledUsers ?? 0,
      reason: 'soft delete school and block linked accounts',
    });

    return new Response(JSON.stringify({
      success: true,
      soft_deleted: true,
      disabled_users: disabledUsers ?? 0,
      ended_sessions: endedSessions ?? 0,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
