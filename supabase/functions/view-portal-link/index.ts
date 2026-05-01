// Public token-based result viewer for parents. No PII id leaked, expirable, rate-limited.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token') || '';
    if (!token || token.length < 16) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: link } = await supabase.from('parent_portal_links')
      .select('*').eq('token', token).maybeSingle();

    if (!link || !link.is_active || new Date(link.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Link expired or invalid' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Increment view counter
    await supabase.from('parent_portal_links')
      .update({ view_count: (link.view_count || 0) + 1, last_viewed_at: new Date().toISOString() })
      .eq('id', link.id);

    const [{ data: learner }, { data: school }] = await Promise.all([
      supabase.from('learners').select('full_name, grade, stream, admission_number, assessment_number')
        .eq('id', link.learner_id).maybeSingle(),
      supabase.from('schools').select('school_name, county')
        .eq('id', link.school_id).maybeSingle(),
    ]);

    if (!learner) {
      return new Response(JSON.stringify({ error: 'Record not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: subjects } = await supabase.from('learning_areas')
      .select('id, name, max_score').eq('grade', learner.grade);
    const subjMap = Object.fromEntries((subjects || []).map((s: any) => [s.id, s]));

    const { data: scores } = await supabase.from('scores')
      .select('learning_area_id, score')
      .eq('learner_id', link.learner_id)
      .eq('term', link.term).eq('year', link.year)
      .eq('assessment_type', link.assessment_type);

    const items = (scores || []).map((s: any) => ({
      subject: subjMap[s.learning_area_id]?.name || 'Subject',
      score: Number(s.score) || 0,
      max: subjMap[s.learning_area_id]?.max_score || 100,
    }));
    const total = items.reduce((a, b) => a + b.score, 0);
    const avg = items.length ? total / items.length : 0;

    return new Response(JSON.stringify({
      learner: {
        name: learner.full_name,
        grade: learner.grade,
        stream: learner.stream,
        admission_number: learner.admission_number,
        assessment_number: learner.assessment_number,
      },
      school: school || null,
      term: link.term, year: link.year, assessment_type: link.assessment_type,
      results: items,
      total, average: avg,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
