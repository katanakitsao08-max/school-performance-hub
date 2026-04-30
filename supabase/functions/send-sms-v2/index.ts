import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MessageItem {
  phone: string;
  message: string;
}
interface Body {
  school_id: string;
  messages: MessageItem[];
}

function renderTemplate(tpl: any, ctx: { phone: string; message: string; sender_id: string; api_key: string }) {
  const replace = (v: any): any => {
    if (typeof v === "string") {
      return v
        .replaceAll("{{phone}}", ctx.phone)
        .replaceAll("{{message}}", ctx.message)
        .replaceAll("{{sender_id}}", ctx.sender_id)
        .replaceAll("{{api_key}}", ctx.api_key);
    }
    if (Array.isArray(v)) return v.map(replace);
    if (v && typeof v === "object") {
      const o: any = {};
      for (const k of Object.keys(v)) o[k] = replace(v[k]);
      return o;
    }
    return v;
  };
  return replace(tpl || {});
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const token = authHeader.replace("Bearer ", "");

    // ✅ FIXED AUTH METHOD
    const supabase = createClient(SUPABASE_URL, SERVICE);
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser(token);

    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    const body = (await req.json()) as Body;
    if (!body?.school_id || !Array.isArray(body.messages) || body.messages.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE);

    // Authorization
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userId);
    const roleSet = new Set((roles || []).map((r: any) => r.role));
    const isSuper = roleSet.has("super_admin");

    if (!isSuper) {
      if (!roleSet.has("admin")) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: profile } = await admin.from("profiles").select("school_id").eq("user_id", userId).maybeSingle();

      if (!profile || profile.school_id !== body.school_id) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Config resolution
    const { data: schoolCfg } = await admin
      .from("school_sms_config")
      .select("*")
      .eq("school_id", body.school_id)
      .maybeSingle();

    let cfg: any = schoolCfg && schoolCfg.is_active && schoolCfg.endpoint && schoolCfg.api_key ? schoolCfg : null;
    let usedFallback = false;

    if (!cfg) {
      const { data: global } = await admin.from("global_sms_config").select("*").eq("singleton", true).maybeSingle();
      if (!global || !global.is_active || !global.endpoint || !global.api_key) {
        return new Response(JSON.stringify({ error: "No active SMS configuration for this school" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      cfg = global;
      usedFallback = true;
    }

    // Deduct credits
    const need = body.messages.length;
    const { data: deducted, error: dErr } = await admin.rpc("deduct_sms_credits", {
      _school_id: body.school_id,
      _amount: need,
    });

    if (dErr) {
      return new Response(JSON.stringify({ error: "Credit check failed", details: dErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!deducted) {
      return new Response(JSON.stringify({ error: "Insufficient SMS credits" }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const customHeaders = cfg.headers_json || {};
    for (const k of Object.keys(customHeaders)) {
      headers[k] = String(customHeaders[k]).replaceAll("{{api_key}}", cfg.api_key);
    }

    const results: any[] = [];
    let refundCount = 0;

    for (const m of body.messages) {
      try {
        const ctx = {
          phone: m.phone,
          message: m.message,
          sender_id: cfg.sender_id || "",
          api_key: cfg.api_key,
        };

        const rendered = renderTemplate(cfg.body_template || {}, ctx);

        const response = await fetch(cfg.endpoint, {
          method: rendered.method || "POST",
          headers,
          body: JSON.stringify(rendered.body),
        });

        const data = await response.json();

        if (!response.ok) {
          refundCount++;
          results.push({ phone: m.phone, status: "failed", error: data });
        } else {
          results.push({ phone: m.phone, status: "sent", response: data });
        }
      } catch (e: any) {
        refundCount++;
        results.push({ phone: m.phone, status: "failed", error: String(e.message || e) });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: body.messages.length - refundCount,
        failed: refundCount,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
