import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
Deno.serve(async () => {
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const uid = "1323ce56-c96e-4cbf-b34a-ec8593368a3f";
  const { error } = await sb.auth.admin.updateUserById(uid, { password: "Chris@2015" });
  return new Response(JSON.stringify({ ok: !error, error: error?.message }), { headers: { "Content-Type": "application/json" } });
});
