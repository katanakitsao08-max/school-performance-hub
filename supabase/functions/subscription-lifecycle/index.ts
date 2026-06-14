// Cron-invoked: runs daily.
// - 7d before expiry: notify school admins (in-app)
// - 3d before expiry: notify school admins
// - Expiry day: status -> 'expired' (grace begins)
// - +7d after expiry: status -> 'suspended'
// - +30d after expiry: status -> 'disabled'
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const now = new Date();
    const day = 86400000;
    const result = { reminders: 0, expired: 0, suspended: 0, disabled: 0 };

    const { data: schools } = await admin.from('schools').select('id, school_name, subscription_status, plan_expires_at');
    if (!schools) return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    for (const s of schools as any[]) {
      if (!s.plan_expires_at) continue;
      const expiry = new Date(s.plan_expires_at).getTime();
      const daysToExpiry = Math.round((expiry - now.getTime()) / day);

      // reminders (only if still active/trial)
      if (['active','trial'].includes(s.subscription_status) && (daysToExpiry === 7 || daysToExpiry === 3)) {
        const { data: admins } = await admin.from('profiles').select('user_id')
          .eq('school_id', s.id);
        const { data: roles } = await admin.from('user_roles').select('user_id').in('role', ['admin','headteacher']);
        const adminIds = new Set((roles || []).map((r: any) => r.user_id));
        const targets = (admins || []).filter((p: any) => adminIds.has(p.user_id));
        if (targets.length) {
          await admin.from('notifications').insert(targets.map((p: any) => ({
            user_id: p.user_id, school_id: s.id,
            title: `Subscription expires in ${daysToExpiry} days`,
            message: `Renew now to avoid service interruption for ${s.school_name}.`,
            type: 'warning', metadata: { days: daysToExpiry, expiry: s.plan_expires_at },
          })));
          result.reminders += targets.length;
        }
      }

      // status transitions
      if (['active','trial'].includes(s.subscription_status) && daysToExpiry <= 0) {
        await admin.from('schools').update({ subscription_status: 'expired', subscription_grace_until: new Date(expiry + 7 * day).toISOString() }).eq('id', s.id);
        result.expired++;
      } else if (s.subscription_status === 'expired' && daysToExpiry <= -7) {
        await admin.from('schools').update({ subscription_status: 'suspended' }).eq('id', s.id);
        result.suspended++;
      } else if (s.subscription_status === 'suspended' && daysToExpiry <= -30) {
        await admin.from('schools').update({ subscription_status: 'disabled' }).eq('id', s.id);
        result.disabled++;
      }
    }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Lifecycle failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
