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
  mainContentOnly?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as Partial<NotesRequest>;
    const { grade, subject, topic, difficulty, kicd, mainContentOnly } = body;
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

    const system = `You are an expert CBC (Competency-Based Curriculum) teacher in Kenya AND a writer of TEXTBOOK-STYLE revision notes that learners read on their own.

Your output must read like a real Kenyan primary/JSS textbook page — NOT like a summary, NOT like an outline, NOT like an AI answer.

Textbook style rules (MANDATORY for the "mainContent" field):
- Open every major sub-topic with an ALL-CAPS sub-heading on its OWN line (e.g. "LIVING THINGS", "FUNGI", "ANIMALS").
- Under each sub-heading, place a smaller capitalised mini-heading on its own line (e.g. "Plants", "Vertebrates", "Characteristics of mammals").
- The FIRST time a new term is introduced, define it inline using a dash:  "Classification — is the act or the process of dividing plants in groups according to given features."
- Use bullet markers with the ✓ tick character for lists of facts/characteristics/importance:  "✓ They have backbones"
- Use a hyphen "- " for steps, precautions, or numbered-style points.
- Group facts under "Characteristics of …", "Importance of …", "Safety precautions when handling …", "Functions of …", "Care for …" sub-blocks where it fits the topic.
- Use short, declarative sentences a Grade-level learner can read aloud.
- Include local Kenyan examples (maize, ugali, matatu, shillings, Nairobi, Mombasa) where natural.
- Separate every sub-block with a blank line ("\\n\\n").
- DO NOT compress everything into one prose paragraph. The page must visibly look like a textbook with many headings and tick-bulleted lists.

Output ONLY valid JSON matching the requested schema. No markdown fences, no commentary, no AI mentions.`;

    const user = `Generate CBC-aligned, KICD-grounded TEXTBOOK-STYLE LESSON + REVISION notes for:
- Class: ${grade}
- Subject: ${subject}
- Topic / Sub-Strand: ${topic}
- Difficulty: ${difficulty}

${kicdBlock}

Return JSON with this EXACT shape (all fields required, arrays must not be empty):
{
  "title": string,                                  // friendly topic title (e.g. "GRADE 5 — SCIENCE AND TECHNOLOGY — LIVING THINGS")
  "objectives": string[],                           // 3-5 CBC competency-based, each starts with "By the end of the lesson, the learner should be able to..."
  "keyVocabulary": { "term": string, "meaning": string }[],  // 6-12 key words with one-line learner-friendly meanings
  "introduction": string,                           // 3-5 sentences hooking the learner; weave in a Key Inquiry Question if available
  "mainContent": string,                            // FULL TEXTBOOK PAGE. MUST contain at least 4 ALL-CAPS sub-headings, multiple capitalised mini-headings, inline term-dash definitions, and ✓-bulleted lists. 600-1200 words. Use \\n for line breaks and \\n\\n between sub-blocks.
  "workedExamples": string[],                       // 3-5 fully worked examples written step-by-step ("Step 1: ...", "Step 2: ...")
  "classActivities": string[],                      // 3-5 hands-on, group or individual activities (CBC inquiry/practical)
  "revisionSummary": string[],                      // 6-10 short bullet takeaways the learner can memorise
  "assessmentQuestions": { "question": string, "answer": string }[],  // 8-12 questions of mixed type
  "homeRevisionTasks": string[],                    // 3-5 things the learner can do at home alone
  "teacherTips": string[],                          // 3-5 practical classroom delivery & differentiation tips
  "competenciesDeveloped": string[],                // 3-6 CBC core competencies/values
  "resources": string[]                             // 3-8 concrete, low-cost resources
}

EXAMPLE of the EXPECTED textbook style for "mainContent" (match the FORMAT, not the content):

LIVING THINGS

Plants

Classification of plants — Plants are living things.
Classification — is the act or the process of dividing plants in groups, according to the given features.

In Grade 5, plants are grouped into two categories which include:
✓ Flowering plants — these are plants that produce flowers, for example maize, pawpaw and beans.
✓ Non-flowering plants — these are plants that do not produce flowers, for example mosses, ferns and algae.

Safety precautions when handling harmful plants
Precautions — are measures taken in advance to prevent harm to the learners when carrying out different activities. They include:
- Wearing protective clothes
- Washing hands after handling plants
- Not eating, tasting or smelling poisonous plants

Importance of flowering plants
Flowering plants are very useful.
✓ They give food
✓ They give shelter
✓ They give medicine
✓ They add beauty to the environment

FUNGI
✓ They are neither plants nor animals
✓ They grow on dead and decaying matter and obtain their food from them
✓ They include bread mould, yeast and mushroom

Difficulty depth:
- basic     → very simple vocabulary, smaller numbers, more scaffolding.
- standard  → grade-level pace; balanced reasoning; standard CBC depth.
- advanced  → extension content, higher-order questions, light enrichment.

CRITICAL:
- Stay 100% within the KICD scope above when provided.
- The "mainContent" MUST visibly look like a textbook page with multiple ALL-CAPS sections, mini-headings, dash-definitions and ✓ bullet lists. A flat prose paragraph is REJECTED.
- Do NOT include disclaimers, AI mentions, or apologies. JSON only.`;

    const mainOnlyUser = `Generate ONLY a textbook-style "mainContent" page (no objectives, no introduction, no questions, no activities) for:
- Class: ${grade}
- Subject: ${subject}
- Topic / Sub-Strand: ${topic}
- Difficulty: ${difficulty}

${kicdBlock}

Return JSON:
{
  "title": string,            // friendly heading e.g. "${topic.toUpperCase()}"
  "mainContent": string       // FULL textbook page, 600-1200 words, multiple ALL-CAPS sub-headings, mini-headings, dash-definitions, ✓ bullet lists. Use \\n and \\n\\n for layout.
}

CRITICAL: Output JSON only. mainContent must visibly look like a textbook page.`;

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'system', content: system }, { role: 'user', content: mainContentOnly ? mainOnlyUser : user }],
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
