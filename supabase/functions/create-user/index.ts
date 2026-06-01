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
    const raw = await req.json();
    const email = String(raw.email || '').trim().toLowerCase();
    const password = String(raw.password || '');
    const full_name = String(raw.full_name || '').trim();
    const role = raw.role;
    const school_id = raw.school_id;


    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // If no school_id passed, try to get it from the caller's profile
    let resolvedSchoolId = school_id || null;
    if (!resolvedSchoolId && role !== 'super_admin') {
      const authHeader = req.headers.get('Authorization');
      if (authHeader) {
        const { data: { user: caller } } = await supabaseAdmin.auth.getUser(
          authHeader.replace('Bearer ', '')
        );
        if (caller) {
          const { data: callerProfile } = await supabaseAdmin
            .from('profiles')
            .select('school_id')
            .eq('user_id', caller.id)
            .single();
          resolvedSchoolId = callerProfile?.school_id || null;
        }
      }
    }

    // Create user – if email already exists, look up the existing user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (authError) {
      if (authError.message?.includes('already been registered')) {
        // Find existing user by email
        const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (listError) throw listError;
        const existingUser = listData.users.find(u => u.email === email);
        if (!existingUser) throw new Error('User exists but could not be found');

        return new Response(JSON.stringify({ 
          success: false, 
          error: `A user with email "${email}" already exists.`,
          existing_user_id: existingUser.id 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw authError;
    }

    // Assign role
    const { error: roleError } = await supabaseAdmin.from('user_roles').insert({
      user_id: authData.user.id,
      role,
    });

    if (roleError) throw roleError;

    // Update profile with school_id and grades for admin
    const profileUpdate: any = { school_id: resolvedSchoolId };
    if (role === 'admin') {
      // Admin gets all grades dynamically - fetch from school settings
      const { data: gradeSetting } = await supabaseAdmin.from('school_settings')
        .select('value').eq('key', 'available_grades').eq('school_id', resolvedSchoolId).maybeSingle();
      let grades = ['1','2','3','4','5','6','7','8','9'];
      if (gradeSetting?.value) {
        try { const parsed = JSON.parse(gradeSetting.value); if (parsed.length > 0) grades = parsed; } catch {}
      }
      profileUpdate.assigned_grades = grades;
      profileUpdate.assigned_streams = [];
    }

    await supabaseAdmin.from('profiles').update(profileUpdate).eq('user_id', authData.user.id);

    return new Response(JSON.stringify({ success: true, user_id: authData.user.id, login_email: email }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
