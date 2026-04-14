import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { studentName, grade, stream, mean, overallGrade, totalSubjects, rank, totalStudents, subjectData, schoolName } = await req.json();

    if (!studentName || mean === undefined) {
      return new Response(JSON.stringify({ error: "studentName and mean are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are a school principal writing brief, professional remarks on a student's academic report card for a Kenyan CBC school. 
Write exactly 1-2 sentences. Be encouraging yet honest. Reference specific performance patterns when relevant.
Do NOT use quotation marks around your response. Do NOT include greetings or sign-offs.
Keep the tone warm, authoritative, and constructive.`;

    const bestSubject = subjectData?.reduce((best: any, s: any) => (!best || s.score > best.score) ? s : best, null);
    const weakestSubject = subjectData?.reduce((worst: any, s: any) => (!worst || (s.score < worst.score && s.score > 0)) ? s : worst, null);

    const userPrompt = `Write a principal's remark for this student:
- Name: ${studentName}
- Class: Grade ${grade} ${stream}
- Mean Score: ${mean.toFixed(1)}%
- Overall Grade: ${overallGrade}
- Position: ${rank} out of ${totalStudents}
- Number of subjects: ${totalSubjects}
${bestSubject ? `- Best subject: ${bestSubject.name} (${bestSubject.score}/${bestSubject.maxScore})` : ''}
${weakestSubject && weakestSubject.name !== bestSubject?.name ? `- Weakest subject: ${weakestSubject.name} (${weakestSubject.score}/${weakestSubject.maxScore})` : ''}
- School: ${schoolName || 'the school'}`;

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
    const remark = aiData.choices?.[0]?.message?.content?.trim() || "Performance noted. Keep working hard.";

    return new Response(JSON.stringify({ remark }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-principal-remark error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
