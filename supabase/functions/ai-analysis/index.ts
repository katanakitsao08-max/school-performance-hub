import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { studentData, schoolName } = await req.json();
    
    if (!studentData || !Array.isArray(studentData)) {
      return new Response(JSON.stringify({ error: "studentData array is required" }), {
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

    const systemPrompt = `You are an expert school performance analyst for Kenyan CBC schools. Analyze student performance data and provide actionable insights.

Your response must be valid JSON with this structure:
{
  "overallAssessment": "Brief paragraph on school performance",
  "predictions": [
    { "studentName": "...", "currentAvg": 55, "predictedTrend": "improving|declining|stable", "confidence": "high|medium|low", "reason": "..." }
  ],
  "strugglingLearners": [
    { "studentName": "...", "grade": "...", "weakSubjects": ["..."], "interventions": ["..."] }
  ],
  "subjectInsights": [
    { "subject": "...", "status": "strong|average|weak", "recommendation": "..." }
  ],
  "actionItems": ["..."]
}

Be specific, practical, and focused on CBC curriculum. Limit predictions to top 10 most important students. Keep interventions actionable for teachers.`;

    const userPrompt = `Analyze this school performance data for ${schoolName || 'the school'}:

${JSON.stringify(studentData.slice(0, 50), null, 2)}

Total students: ${studentData.length}

Provide performance predictions, identify struggling learners, suggest interventions, and give subject-level insights.`;

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
              name: "provide_analysis",
              description: "Provide structured school performance analysis",
              parameters: {
                type: "object",
                properties: {
                  overallAssessment: { type: "string" },
                  predictions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        studentName: { type: "string" },
                        currentAvg: { type: "number" },
                        predictedTrend: { type: "string", enum: ["improving", "declining", "stable"] },
                        confidence: { type: "string", enum: ["high", "medium", "low"] },
                        reason: { type: "string" },
                      },
                      required: ["studentName", "currentAvg", "predictedTrend", "confidence", "reason"],
                    },
                  },
                  strugglingLearners: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        studentName: { type: "string" },
                        grade: { type: "string" },
                        weakSubjects: { type: "array", items: { type: "string" } },
                        interventions: { type: "array", items: { type: "string" } },
                      },
                      required: ["studentName", "grade", "weakSubjects", "interventions"],
                    },
                  },
                  subjectInsights: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        subject: { type: "string" },
                        status: { type: "string", enum: ["strong", "average", "weak"] },
                        recommendation: { type: "string" },
                      },
                      required: ["subject", "status", "recommendation"],
                    },
                  },
                  actionItems: { type: "array", items: { type: "string" } },
                },
                required: ["overallAssessment", "predictions", "strugglingLearners", "subjectInsights", "actionItems"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "provide_analysis" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "AI rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in workspace settings." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await response.json();
    let analysis;
    
    try {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        analysis = typeof toolCall.function.arguments === 'string' 
          ? JSON.parse(toolCall.function.arguments) 
          : toolCall.function.arguments;
      } else {
        // Fallback: try to parse from content
        const content = aiData.choices?.[0]?.message?.content || '';
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { overallAssessment: content, predictions: [], strugglingLearners: [], subjectInsights: [], actionItems: [] };
      }
    } catch (parseErr) {
      console.error("Parse error:", parseErr);
      analysis = {
        overallAssessment: "Analysis completed but response format was unexpected.",
        predictions: [],
        strugglingLearners: [],
        subjectInsights: [],
        actionItems: ["Please try running the analysis again."],
      };
    }

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-analysis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
