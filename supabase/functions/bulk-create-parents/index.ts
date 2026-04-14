import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { learners, school_id } = await req.json();

    if (!Array.isArray(learners) || learners.length === 0) {
      throw new Error('No learners provided');
    }
    if (!school_id) throw new Error('school_id is required');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get existing parent_learners to skip already-linked learners
    const { data: existingLinks } = await supabaseAdmin
      .from('parent_learners')
      .select('learner_id')
      .eq('school_id', school_id);
    const linkedLearnerIds = new Set((existingLinks || []).map(l => l.learner_id));

    const results: { admNo: string; name: string; password: string; status: string; error?: string }[] = [];

    for (const learner of learners) {
      const { id, admission_number, full_name, parent_name } = learner;

      // Skip already linked
      if (linkedLearnerIds.has(id)) {
        results.push({ admNo: admission_number, name: full_name, password: '', status: 'skipped', error: 'Already has parent account' });
        continue;
      }

      const names = full_name.trim().split(/\s+/);
      const longestName = names.reduce((a: string, b: string) => b.length > a.length ? b : a, names[0]);
      const password = longestName.length >= 6 ? longestName : longestName.padEnd(6, '0');
        continue;
      }

      const email = `${admission_number.toLowerCase().replace(/\s+/g, '')}@school.local`;
      const displayName = parent_name || full_name + ' Parent';

      try {
        // Create user
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: password,
          email_confirm: true,
          user_metadata: { full_name: displayName },
        });

        if (authError) {
          if (authError.message?.includes('already been registered')) {
            // Find existing user and link
            const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
            const existingUser = listData?.users?.find(u => u.email === email);
            if (existingUser) {
              // Assign role if missing
              await supabaseAdmin.from('user_roles').upsert(
                { user_id: existingUser.id, role: 'parent' },
                { onConflict: 'user_id,role' }
              );
              // Link
              const { error: linkErr } = await supabaseAdmin.from('parent_learners').insert({
                parent_user_id: existingUser.id,
                learner_id: id,
                school_id,
                relationship: 'parent',
              });
              if (linkErr && !linkErr.message?.includes('duplicate')) {
                results.push({ admNo: admission_number, name: full_name, password: password, status: 'failed', error: linkErr.message });
              } else {
                results.push({ admNo: admission_number, name: full_name, password: password, status: 'linked' });
              }
            } else {
              results.push({ admNo: admission_number, name: full_name, password: password, status: 'failed', error: 'User exists but not found' });
            }
            continue;
          }
          results.push({ admNo: admission_number, name: full_name, password: password, status: 'failed', error: authError.message });
          continue;
        }

        // Assign parent role
        await supabaseAdmin.from('user_roles').insert({ user_id: authData.user.id, role: 'parent' });

        // Update profile with school_id
        await supabaseAdmin.from('profiles').update({ school_id }).eq('user_id', authData.user.id);

        // Link parent to learner
        await supabaseAdmin.from('parent_learners').insert({
          parent_user_id: authData.user.id,
          learner_id: id,
          school_id,
          relationship: 'parent',
        });

        results.push({ admNo: admission_number, name: full_name, password: password, status: 'created' });
      } catch (err: any) {
        results.push({ admNo: admission_number, name: full_name, password: password, status: 'failed', error: err.message });
      }
    }

    const created = results.filter(r => r.status === 'created').length;
    const linked = results.filter(r => r.status === 'linked').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const failed = results.filter(r => r.status === 'failed').length;

    return new Response(JSON.stringify({
      success: true,
      summary: { created, linked, skipped, failed, total: results.length },
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
