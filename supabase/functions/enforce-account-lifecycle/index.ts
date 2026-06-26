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
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roleRow } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'super_admin')
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: 'forbidden — super_admin only' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profiles, error } = await admin
      .from('profiles')
      .select('user_id, school_id, school_access_status, user_roles!inner(role), schools(subscription_status, deleted_at)')
      .not('user_roles.role', 'in', '(super_admin,independent_learner)');
    if (error) throw error;

    const blocked = (profiles || []).filter((p: any) => {
      const school = Array.isArray(p.schools) ? p.schools[0] : p.schools;
      return p.school_access_status !== 'active'
        || !p.school_id
        || !school
        || !!school.deleted_at
        || ['deleted', 'disabled', 'suspended'].includes(school.subscription_status || '');
    });

    const nowIso = new Date().toISOString();
    const userIds = Array.from(new Set(blocked.map((p: any) => p.user_id).filter(Boolean)));

    let disabledProfiles = 0;
    let endedSessions = 0;
    let bannedUsers = 0;

    if (userIds.length) {
      const { count } = await admin
        .from('profiles')
        .update({ school_access_status: 'disabled', disabled_at: nowIso, updated_at: nowIso }, { count: 'exact' })
        .in('user_id', userIds);
      disabledProfiles = count ?? 0;

      const { count: sessionsCount } = await admin
        .from('user_sessions')
        .update({ session_status: 'offline', logout_time: nowIso, updated_at: nowIso }, { count: 'exact' })
        .in('user_id', userIds)
        .is('logout_time', null);
      endedSessions = sessionsCount ?? 0;

      for (const userId of userIds) {
        const { error: banErr } = await admin.auth.admin.updateUserById(userId, { ban_duration: '876000h' });
        if (!banErr) bannedUsers += 1;
      }

      await admin.from('audit_logs').insert({
        school_id: null,
        user_id: user.id,
        user_name: user.email || 'super_admin',
        role: 'super_admin',
        action: 'enforce',
        module: 'account_lifecycle',
        record_type: 'profiles',
        affected_count: userIds.length,
        after_state: { disabled_profiles: disabledProfiles, ended_sessions: endedSessions, banned_auth_users: bannedUsers },
        reason: 'retroactive deleted-school and orphaned-account enforcement',
      });
    }

    return new Response(JSON.stringify({ success: true, disabled_profiles: disabledProfiles, ended_sessions: endedSessions, banned_auth_users: bannedUsers }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});