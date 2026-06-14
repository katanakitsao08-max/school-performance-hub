// Public school self-registration submission
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const b = await req.json();
    const required = ['school_name','admin_full_name','admin_phone','admin_email'];
    for (const k of required) {
      if (!b?.[k] || String(b[k]).trim().length < 2) {
        return new Response(JSON.stringify({ error: `Missing or invalid ${k}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }
    if (!b.terms_accepted) {
      return new Response(JSON.stringify({ error: 'Terms must be accepted' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data, error } = await admin.from('school_signups').insert({
      school_name: String(b.school_name).trim().slice(0, 200),
      school_type: String(b.school_type || 'primary').slice(0, 50),
      county: String(b.county || '').slice(0, 100),
      admin_full_name: String(b.admin_full_name).trim().slice(0, 120),
      admin_phone: String(b.admin_phone).trim().slice(0, 30),
      admin_email: String(b.admin_email).trim().toLowerCase().slice(0, 200),
      learners_count: Number(b.learners_count || 0),
      selected_plan_id: b.selected_plan_id || null,
      terms_accepted: true,
      status: 'pending',
    }).select('id').single();
    if (error) throw error;

    // Notify all super admins
    try {
      const { data: sas } = await admin.from('user_roles').select('user_id').eq('role','super_admin');
      if (sas?.length) {
        await admin.from('notifications').insert(sas.map((s: any) => ({
          user_id: s.user_id,
          school_id: null,
          title: 'New School Sign-up',
          message: `${b.school_name} (${b.admin_full_name}) submitted a registration.`,
          type: 'info',
          metadata: { signup_id: data.id },
        })));
      }
    } catch {}

    return new Response(JSON.stringify({ ok: true, id: data.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || 'Submit failed' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
