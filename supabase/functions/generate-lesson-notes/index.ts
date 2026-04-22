import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

interface KicdContext {
  strand?: string;
  subStrand?: string;
  slos?: string[];
  activities?: string[];
  assessmentMethods?: string[];
  inquiryQuestions?: string[];
  resources?: string[];
  competencies?: string[];
  values?: string[];
  pcis?: string[];
  designTitle?: string | null;
}

interface NotesRequest {
  grade: string;
  subject: string;
  topic: string;
  difficulty: 'basic' | 'standard' | 'advanced';
  kicd?: KicdContext | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as Partial<NotesRequest>;
    const { grade, subject, topic, difficulty, kicd } = body;
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

    const hasKicd = !!(kicd && (kicd.slos?.length || kicd.subStrand || kicd.strand));

    const kicdBlock = hasKicd ? `
GROUND THESE NOTES STRICTLY IN THE LOADED KICD CURRICULUM DESIGN. Treat the items below as the source of truth — do NOT invent objectives or skills outside this scope.

Design title: ${kicd?.designTitle ?? 'KICD Design'}
Strand: ${kicd?.strand ?? '—'}
Sub-Strand: ${kicd?.subStrand ?? topic}

Specific Learning Outcomes (SLOs) — base your Learning Objectives on these, rephrased in learner-friendly form:
${(kicd?.slos ?? []).map((s, i) => `${i + 1}. ${s}`).join('\n') || '(none provided)'}

Suggested Learning Activities (use & expand):
${(kicd?.activities ?? []).map((s) => `- ${s}`).join('\n') || '(none)'}

Assessment Methods (use to design Assessment Questions):
${(kicd?.assessmentMethods ?? []).map((s) => `- ${s}`).join('\n') || '(none)'}

Key Inquiry Questions (weave into Introduction & Discussion):
${(kicd?.inquiryQuestions ?? []).map((s) => `- ${s}`).join('\n') || '(none)'}

Suggested Resources:
${(kicd?.resources ?? []).map((s) => `- ${s}`).join('\n') || '(none)'}

Core Competencies to develop: ${(kicd?.competencies ?? []).join(', ') || '—'}
Values to nurture: ${(kicd?.values ?? []).join(', ') || '—'}
Pertinent & Contemporary Issues (PCIs): ${(kicd?.pcis ?? []).join(', ') || '—'}
` : `
NOTE: No KICD design was loaded for this combination. Fall back to the official KICD CBC design document for ${grade} ${subject} (${topic}) and stay faithful to its scope and sequence.
`;

    const system = `You are an expert CBC (Competency-Based Curriculum) teacher in Kenya AND a writer of revision notes that learners read on their own.
Your output must serve TWO audiences at once:
  1) The teacher — to deliver the lesson.
  2) The learner — as clear, friendly REVISION notes they can re-read at home.

Always:
- Use simple, age-appropriate Kenyan English for the stated grade.
- Define every new term in plain words the first time it appears.
- Use short paragraphs, bullet points, mini-headings ("In short:", "Remember:", "Try this:"), and worked examples with steps.
- Include locally relevant Kenyan examples (shillings, matatus, ugali, market scenarios, Nairobi/Mombasa/Kisumu, etc.) where it helps.
- Reinforce CBC core competencies and values naturally.
- Output ONLY valid JSON matching the requested schema. No markdown fences, no commentary.`;

    const user = `Generate CBC-aligned, KICD-grounded LESSON + REVISION notes for:
- Class: ${grade}
- Subject: ${subject}
- Topic / Sub-Strand: ${topic}
- Difficulty: ${difficulty}

${kicdBlock}

Return JSON with this EXACT shape (all fields required, arrays must not be empty):
{
  "title": string,                                  // friendly topic title for learners
  "objectives": string[],                           // 3-5 CBC competency-based, each starts with "By the end of the lesson, the learner should be able to..." — derived from SLOs above when provided
  "keyVocabulary": { "term": string, "meaning": string }[],  // 5-10 key words, each with a one-line learner-friendly meaning
  "introduction": string,                           // 3-5 sentences hooking the learner; weave in a Key Inquiry Question if available
  "mainContent": string,                            // 6-12 short paragraphs. Use "\\n\\n" between paragraphs. May include mini-headings on their own line ending with ":"
  "workedExamples": string[],                       // 3-5 fully worked examples written step-by-step ("Step 1: ...", "Step 2: ..."). Show reasoning, not just the answer.
  "classActivities": string[],                      // 3-5 hands-on, group or individual activities (CBC inquiry/practical style)
  "revisionSummary": string[],                      // 5-8 short bullet takeaways the learner can memorise
  "assessmentQuestions": { "question": string, "answer": string }[],  // 6-10 questions of mixed type (recall, application, higher-order). Provide a clear, concise answer for each.
  "homeRevisionTasks": string[],                    // 3-5 things the learner can do at home alone (no teacher needed)
  "teacherTips": string[],                          // 3-5 practical classroom delivery & differentiation tips
  "competenciesDeveloped": string[],                // 3-6 CBC core competencies/values this lesson develops
  "resources": string[]                             // 3-8 concrete, low-cost resources (chalkboard, charts, real objects, locally available)
}

Difficulty depth:
- basic     → very simple vocabulary, smaller numbers, lots of pictures-in-words, slow pace, more scaffolding.
- standard  → grade-level pace; balanced reasoning; standard CBC depth.
- advanced  → extension content, higher-order questions, light enrichment beyond grade level (still within the strand).

CRITICAL:
- Stay 100% within the KICD scope above when provided.
- Make the notes feel like a friendly textbook page a learner WANTS to read.
- Do NOT include any disclaimers, AI mentions, or apologies. JSON only.`;

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

    return new Response(JSON.stringify({ success: true, notes: parsed, groundedInKicd: hasKicd }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
