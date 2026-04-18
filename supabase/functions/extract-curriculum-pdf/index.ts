// Extract structured CBC curriculum data from a KICD PDF using Lovable AI.
// Superadmin-only. Returns a draft JSON the client then writes to curriculum_designs.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are an expert KICD (Kenya Institute of Curriculum Development) CBC curriculum analyst.
You will be given the raw text of an official KICD curriculum design document.
Extract the curriculum into a strict JSON structure.

Rules:
- Identify ONE grade (e.g. "Grade 3"), ONE subject (e.g. "Mathematics"), ONE term (1, 2, or 3).
- Group content by Strand → Sub-strand.
- For every sub-strand, capture: lesson_allocation (integer, default 1 if unclear),
  specific learning outcomes (slos), suggested learning experiences (activities),
  assessment_methods, inquiry_questions, resources, core competencies, values, pcis (Pertinent and Contemporary Issues).
- Use the document's exact wording. Do not invent content. If a field is missing leave it as an empty array.
- Return ONLY through the provided tool call.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify Super Admin
    const userId = claimsData.claims.sub;
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "super_admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden: Super Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { pdfText, hintGrade, hintSubject, hintTerm } = body ?? {};
    if (!pdfText || typeof pdfText !== "string" || pdfText.trim().length < 50) {
      return new Response(
        JSON.stringify({ error: "pdfText is required (>=50 chars of extracted PDF text)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Cap input size to keep token costs reasonable
    const trimmedText = pdfText.length > 60_000 ? pdfText.slice(0, 60_000) : pdfText;

    const userMessage = `${
      hintGrade ? `Hint - Grade: ${hintGrade}\n` : ""
    }${hintSubject ? `Hint - Subject: ${hintSubject}\n` : ""}${
      hintTerm ? `Hint - Term: ${hintTerm}\n` : ""
    }\nKICD Curriculum Document Text:\n---\n${trimmedText}\n---`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "save_curriculum_design",
              description: "Persist the extracted KICD curriculum design.",
              parameters: {
                type: "object",
                properties: {
                  grade: { type: "string" },
                  subject: { type: "string" },
                  term: { type: "integer", enum: [1, 2, 3] },
                  title: { type: "string" },
                  strands: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        sub_strands: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              name: { type: "string" },
                              lesson_allocation: { type: "integer" },
                              slos: { type: "array", items: { type: "string" } },
                              activities: { type: "array", items: { type: "string" } },
                              assessment_methods: { type: "array", items: { type: "string" } },
                              inquiry_questions: { type: "array", items: { type: "string" } },
                              resources: { type: "array", items: { type: "string" } },
                              competencies: { type: "array", items: { type: "string" } },
                              values: { type: "array", items: { type: "string" } },
                              pcis: { type: "array", items: { type: "string" } },
                            },
                            required: ["name", "lesson_allocation", "slos"],
                          },
                        },
                      },
                      required: ["name", "sub_strands"],
                    },
                  },
                },
                required: ["grade", "subject", "term", "strands"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "save_curriculum_design" } },
      }),
    });

    if (aiRes.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiRes.status === 402) {
      return new Response(
        JSON.stringify({ error: "Lovable AI credits exhausted. Add credits in Settings → Workspace → Usage." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiRes.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "AI did not return structured curriculum data" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch {
      return new Response(JSON.stringify({ error: "AI returned invalid JSON" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ design: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-curriculum-pdf error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
