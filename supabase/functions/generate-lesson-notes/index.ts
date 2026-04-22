import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

interface NotesRequest {
  grade: string;
  subject: string;
  topic: string;
  difficulty: 'basic' | 'standard' | 'advanced';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as Partial<NotesRequest>;
    const { grade, subject, topic, difficulty } = body;
    if (!grade || !subject || !topic || !difficulty) {
      return new Response(JSON.stringify({ error: 'Missing required fields: grade, subject, topic, difficulty' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'AI service not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const system = `You are an expert CBC (Competency-Based Curriculum) teacher in Kenya. Generate clear, age-appropriate lesson notes that strictly follow CBC principles. Output ONLY valid JSON matching the requested schema. Use simple Kenyan English suitable for the grade level.`;

    const user = `Generate CBC-aligned lesson notes for:
- Class: ${grade}
- Subject: ${subject}
- Topic: ${topic}
- Difficulty: ${difficulty}

Return JSON with this exact shape:
{
  "title": string,
  "objectives": string[] (3-5 CBC competency-based objectives, each starting with "By the end of the lesson, the learner should be able to..."),
  "introduction": string (2-4 sentences engaging the learner),
  "mainContent": string (clear explanation, 4-8 short paragraphs),
  "workedExamples": string[] (2-4 examples with step-by-step reasoning),
  "classActivities": string[] (3-5 hands-on, group or individual activities),
  "assessmentQuestions": string[] (at least 5 questions of mixed type),
  "teacherTips": string[] (3-5 practical classroom tips)
}

Adjust depth for difficulty: basic = foundational vocabulary & simple steps, standard = balanced, advanced = deeper reasoning and extension tasks.`;

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiRes.ok) {
      const text = await aiRes.text();
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add funds to continue.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: `AI gateway error: ${text}` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await aiRes.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      return new Response(JSON.stringify({ error: 'AI returned invalid JSON', raw: content }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, notes: parsed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
