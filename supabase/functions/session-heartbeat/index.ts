import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

function parseUA(ua: string) {
  const isMobile = /mobile/i.test(ua);
  const isTablet = /tablet|ipad/i.test(ua);
  const device = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';
  let browser = 'Other';
  if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) browser = 'Chrome';
  else if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) browser = 'Safari';
  else if (/firefox\//i.test(ua)) browser = 'Firefox';
  else if (/opera|opr\//i.test(ua)) browser = 'Opera';
  return { device, browser };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claimsData.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const sessionToken: string | undefined = body.session_token;
    const event: 'heartbeat' | 'login' | 'logout' = body.event ?? 'heartbeat';

    // Lookup profile + role
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const [{ data: prof }, { data: rrow }] = await Promise.all([
      admin.from('profiles').select('school_id, school_access_status').eq('user_id', userId).maybeSingle(),
      admin.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
    ]);

    const role = rrow?.role ?? null;
    let blocked = false;
    if (role !== 'super_admin' && role !== 'independent_learner') {
      if (!prof || prof.school_access_status !== 'active' || !prof.school_id) {
        blocked = true;
      } else {
        const { data: school } = await admin
          .from('schools')
          .select('subscription_status, deleted_at')
          .eq('id', prof.school_id)
          .maybeSingle();
        blocked = !school || !!school.deleted_at || ['deleted', 'disabled', 'suspended'].includes(school.subscription_status || '');
      }
    }

    const ua = req.headers.get('user-agent') ?? '';
    const { device, browser } = parseUA(ua);
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      req.headers.get('cf-connecting-ip') ||
      null;

    const nowIso = new Date().toISOString();

    if (blocked) {
      if (prof) {
        await admin.from('profiles').update({
          school_access_status: 'disabled',
          disabled_at: nowIso,
        }).eq('user_id', userId);
      }

      await admin.auth.admin.updateUserById(userId, { ban_duration: '876000h' }).catch(() => null);
      await admin.auth.admin.signOut(token).catch(() => null);

      if (sessionToken) {
        await admin.from('user_sessions').update({
          logout_time: nowIso,
          session_status: 'offline',
          last_activity: nowIso,
        }).eq('session_token', sessionToken).eq('user_id', userId);
      }

      await admin.from('audit_logs').insert({
        school_id: prof?.school_id ?? null,
        user_id: userId,
        user_name: 'system',
        role: role ?? 'unknown',
        action: 'block',
        module: 'authentication',
        record_type: 'session',
        affected_count: 1,
        reason: 'blocked deleted-school or orphaned account during session heartbeat',
        device_info: ua.slice(0, 500),
        ip_address: ip,
      });

      return new Response(JSON.stringify({
        ok: false,
        blocked: true,
        error: 'Access denied. Your school account is no longer active.',
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (event === 'logout' && sessionToken) {
      await admin.from('user_sessions').update({
        logout_time: nowIso,
        session_status: 'offline',
        last_activity: nowIso,
      }).eq('session_token', sessionToken).eq('user_id', userId);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Upsert session
    if (sessionToken) {
      const { data: existing } = await admin.from('user_sessions')
        .select('id').eq('session_token', sessionToken).maybeSingle();
      if (existing) {
        await admin.from('user_sessions').update({
          last_activity: nowIso,
          session_status: 'active',
          school_id: prof?.school_id ?? null,
          role,
          ip_address: ip,
          device, browser,
          user_agent: ua.slice(0, 500),
        }).eq('id', existing.id);
      } else {
        await admin.from('user_sessions').insert({
          user_id: userId,
          school_id: prof?.school_id ?? null,
          role,
          login_time: nowIso,
          last_activity: nowIso,
          session_status: 'active',
          session_token: sessionToken,
          device, browser,
          ip_address: ip,
          user_agent: ua.slice(0, 500),
        });

        if (event === 'login') {
          await admin.from('login_events').insert({
            user_id: userId,
            school_id: prof?.school_id ?? null,
            email_attempt: claimsData.claims.email ?? null,
            success: true,
            ip_address: ip, user_agent: ua.slice(0, 500),
            device, browser,
          });
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, as_of: nowIso }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
