import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Public function (no JWT). Returns the data needed to render a single report card
// only when given a valid, unexpired token.
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    if (!token || token.length < 16) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid token' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: link } = await supabase
      .from('report_share_links')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (!link) {
      return new Response(JSON.stringify({ success: false, error: 'Link not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (new Date(link.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ success: false, error: 'This link has expired' }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch learner + school + scores + subjects
    const [{ data: learner }, { data: schoolSettings }, { data: schoolRecord }] = await Promise.all([
      supabase.from('learners').select('id, full_name, admission_number, grade, stream, gender, school_id')
        .eq('id', link.learner_id).maybeSingle(),
      supabase.from('school_settings').select('key, value').eq('school_id', link.school_id),
      supabase.from('schools').select('school_name').eq('id', link.school_id).maybeSingle(),
    ]);
    if (!learner) {
      return new Response(JSON.stringify({ success: false, error: 'Learner not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const settingsMap: Record<string, string> = {};
    (schoolSettings || []).forEach((r: any) => { settingsMap[r.key] = r.value; });
    if (!settingsMap.school_name && schoolRecord?.school_name) {
      settingsMap.school_name = schoolRecord.school_name;
    }

    const [{ data: subjects }, { data: scores }, { data: classmates }] = await Promise.all([
      supabase.from('learning_areas').select('*').eq('grade', learner.grade).eq('school_id', link.school_id),
      supabase.from('scores').select('*')
        .eq('learner_id', learner.id).eq('term', link.term)
        .eq('year', link.year).eq('assessment_type', link.assessment_type),
      supabase.from('learners').select('id').eq('grade', learner.grade)
        .eq('school_id', link.school_id).eq('is_active', true),
    ]);

    // Update view counter (fire & forget)
    supabase.from('report_share_links').update({
      view_count: (link.view_count || 0) + 1,
      last_viewed_at: new Date().toISOString(),
    }).eq('id', link.id).then(() => {});

    return new Response(JSON.stringify({
      success: true,
      learner,
      subjects: subjects || [],
      scores: scores || [],
      schoolSettings: settingsMap,
      term: link.term,
      year: link.year,
      assessment_type: link.assessment_type,
      total_in_class: classmates?.length || 0,
      expires_at: link.expires_at,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e.message || String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
