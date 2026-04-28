// Extract structured CBC curriculum data from a KICD PDF using Lovable AI.
// Accepts either raw `pdfText` or a base64-encoded `pdfBase64` (server-side parsed via unpdf).
// Superadmin-only.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.12.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are an expert KICD (Kenya Institute of Curriculum Development) CBC curriculum analyst.
You will be given the raw text of an official KICD curriculum design document.
Extract the curriculum into a strict JSON structure.

Rules:
- Identify ONE grade (e.g. "Grade 3"), ONE subject (e.g. "Mathematics").
- Detect the document's coverage: "year" if it covers the WHOLE YEAR (all three terms),
  or "term" if it covers a single term (1, 2, or 3).
- If coverage = "year", set "term" to 0 and, for EACH sub-strand, set its "term_hint"
  to 1, 2 or 3 if the document indicates which term it belongs to. If unclear, leave term_hint as 0.
- If coverage = "term", set "term" to that term number and leave every sub-strand's "term_hint" as 0.
- Group content by Strand → Sub-strand.
- For every sub-strand, capture: lesson_allocation (integer, default 1 if unclear),
  specific learning outcomes (slos), suggested learning experiences (activities),
  assessment_methods, inquiry_questions, resources, core competencies, values, pcis (Pertinent and Contemporary Issues).
- Detect the official "lessons_per_week" allocation (an integer, e.g. 5 for Mathematics).
  Look for phrases like "5 lessons per week", "Time allocation: 5 lessons", "weekly lessons: 5",
  the time allocation table at the start of the design, or a "Suggested Time" column.
  If you cannot find it explicitly, infer from the total lesson_allocation across the year
  divided by 39 weeks. If still unclear, set lessons_per_week to 0.
- Use the document's exact wording. Do not invent content. If a field is missing leave it as an empty array.
- Return ONLY through the provided tool call.`;

function base64ToUint8Array(b64: string): Uint8Array {
  // Strip data-URL prefix if present
  const cleaned = b64.includes(",") ? b64.split(",")[1] : b64;
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function parsePdfToText(pdfBytes: Uint8Array): Promise<string> {
  const pdf = await getDocumentProxy(pdfBytes);
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : String(text ?? "");
}

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
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;
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
    const { pdfText, pdfBase64, hintGrade, hintSubject, hintTerm, hintCoverage } = body ?? {};

    let workingText: string = typeof pdfText === "string" ? pdfText : "";

    // Server-side PDF parsing path
    if (pdfBase64 && typeof pdfBase64 === "string") {
      try {
        const bytes = base64ToUint8Array(pdfBase64);
        if (bytes.byteLength > 25 * 1024 * 1024) {
          return new Response(
            JSON.stringify({ error: "PDF too large (max 25 MB)" }),
            { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        workingText = await parsePdfToText(bytes);
      } catch (parseErr) {
        console.error("PDF parse error:", parseErr);
        return new Response(
          JSON.stringify({ error: "Could not read this PDF. It may be a scanned image (try a text-based PDF) or corrupted." }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    if (!workingText || workingText.trim().length < 50) {
      return new Response(
        JSON.stringify({ error: "Need at least 50 characters of PDF text. Provide pdfBase64 (uploaded file) or pdfText." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Cap at 30k chars — KICD designs rarely exceed this and smaller payloads = much faster AI response
    const trimmedText = workingText.length > 30_000 ? workingText.slice(0, 30_000) : workingText;

    const userMessage = `${
      hintGrade ? `Hint - Grade: ${hintGrade}\n` : ""
    }${hintSubject ? `Hint - Subject: ${hintSubject}\n` : ""}${
      hintTerm ? `Hint - Term: ${hintTerm}\n` : ""
    }${hintCoverage ? `Hint - Coverage: ${hintCoverage} (the user says this document covers ${hintCoverage === 'year' ? 'the WHOLE year' : 'a single term'})\n` : ""}\nKICD Curriculum Document Text:\n---\n${trimmedText}\n---`;

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
                  coverage: { type: "string", enum: ["year", "term"] },
                  term: { type: "integer", description: "0 if coverage=year, else 1|2|3" },
                  lessons_per_week: {
                    type: "integer",
                    description: "Official KICD lessons-per-week allocation for this subject at this grade. 0 if not detected.",
                  },
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
                              term_hint: { type: "integer", description: "1|2|3 when coverage=year and the document says which term, else 0" },
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
                required: ["grade", "subject", "coverage", "term", "strands"],
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

    return new Response(
      JSON.stringify({ design: parsed, charsParsed: workingText.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("extract-curriculum-pdf error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
