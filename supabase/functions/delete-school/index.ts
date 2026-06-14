// Super-admin only: cascade-delete a school and all its tenant data.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

// Tables that reference a school_id and should be purged before deleting the
// school row. Order matters where there are dependent rows between tables.
const SCHOOL_SCOPED_TABLES = [
  'subscription_payments',
  'school_billing',
  'strand_scores',
  'scores',
  'teacher_scores',
  'attendance',
  'teacher_attendance',
  'fee_audit_log',
  'fee_records',
  'fee_structures',
  'sms_logs',
  'whatsapp_queue',
  'whatsapp_schedules',
  'whatsapp_templates',
  'whatsapp_settings',
  'school_sms_credits',
  'notifications',
  'user_activity_log',
  'report_delivery_log',
  'report_share_links',
  'parent_portal_links',
  'parent_learners',
  'promotion_log',
  'principal_comment_bands',
  'teacher_assignments',
  'class_teachers',
  'teacher_learners',
  'teacher_subjects',
  'teacher_classes',
  'teacher_registrations',
  'learner_face_descriptors',
  'learners',
  'learning_areas',
  'strands',
  'sub_strands',
  'streams',
  'school_settings',
  'documents',
  'document_templates',
  'timetable_activation_keys',
  'timetable_class_lessons',
  'timetable_settings',
  'timetables',
  'grade_subject_lessons',
];

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

    // 1) Delete tenant-scoped rows (silently ignore missing tables)
    const purged: Record<string, number | string> = {};
    for (const table of SCHOOL_SCOPED_TABLES) {
      try {
        const { error, count } = await admin
          .from(table).delete({ count: 'exact' }).eq('school_id', school_id);
        purged[table] = error ? `err:${error.message}` : (count ?? 0);
      } catch (e) {
        purged[table] = `exc:${String(e)}`;
      }
    }

    // 2) Detach user profiles from school (keep users so super_admin can reuse them)
    await admin.from('profiles').update({ school_id: null }).eq('school_id', school_id);

    // 3) Finally delete the school row
    const { error: schoolErr } = await admin.from('schools').delete().eq('id', school_id);
    if (schoolErr) {
      return new Response(JSON.stringify({ error: schoolErr.message, purged }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, purged }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
