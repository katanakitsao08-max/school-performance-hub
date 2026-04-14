import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { students, schoolName } = await req.json();

    if (!students || !Array.isArray(students) || students.length === 0) {
      return new Response(JSON.stringify({ error: "students array is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (students.length > 100) {
      return new Response(JSON.stringify({ error: "Maximum 100 students per batch" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const studentSummaries = students.map((s: any, i: number) => {
      const best = s.subjectData?.reduce((b: any, x: any) => (!b || x.score > b.score) ? x : b, null);
      const worst = s.subjectData?.reduce((w: any, x: any) => (!w || (x.score < w.score && x.score > 0)) ? x : w, null);
      return `${i + 1}. ${s.studentName} | Grade ${s.grade} ${s.stream} | Mean: ${s.mean.toFixed(1)}% | Grade: ${s.overallGrade} | Pos: ${s.rank}/${s.totalStudents}${best ? ` | Best: ${best.name}` : ''}${worst && worst.name !== best?.name ? ` | Weak: ${worst.name}` : ''}`;
    }).join('\n');

    const systemPrompt = `You are a school principal writing brief remarks for student report cards at a Kenyan CBC school.
For EACH student numbered below, write exactly 1-2 sentences. Be encouraging yet honest. Reference their specific performance.
Do NOT use quotation marks. Do NOT include greetings or sign-offs. Keep tone warm, authoritative, and constructive.

CRITICAL: Return a valid JSON object with a "remarks" array. Each element must have "index" (0-based) and "remark" (string).
Example: {"remarks":[{"index":0,"remark":"Good progress this term..."},{"index":1,"remark":"Needs to focus more..."}]}`;

    const userPrompt = `Write principal remarks for these ${students.length} students at ${schoolName || 'the school'}:\n\n${studentSummaries}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "provide_remarks",
              description: "Return principal remarks for each student",
              parameters: {
                type: "object",
                properties: {
                  remarks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        index: { type: "number" },
                        remark: { type: "string" },
                      },
                      required: ["index", "remark"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["remarks"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "provide_remarks" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await response.json();
    let parsed: any;

    try {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        parsed = typeof toolCall.function.arguments === 'string'
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function.arguments;
      } else {
        const content = aiData.choices?.[0]?.message?.content || '';
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { remarks: [] };
      }
    } catch {
      parsed = { remarks: [] };
    }

    // Map remarks back by index, with fallback
    const remarksMap: Record<number, string> = {};
    (parsed.remarks || []).forEach((r: any) => {
      remarksMap[r.index] = r.remark;
    });

    const results = students.map((s: any, i: number) => ({
      id: s.id,
      remark: remarksMap[i] || "Performance noted. Keep working hard.",
    }));

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("batch-principal-remarks error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
