// CBC-grounded adaptive learning engine for the Parent Portal.
// Modes:
//   - "assessment": 5 IQ/placement questions sized to the learner's grade
//   - "lesson":     a fun, interactive Interactive lesson mini-lesson at the
//                   placed level, with worked example + 5 graded exercises
//   - "interventions": parent-facing improvement plan (kept for back-compat)
//   - "tutor":      legacy long-form guide (kept for back-compat)
//
// All content is grounded in the Kenya Competency Based Curriculum (CBC /
// KICD). Output is strict JSON for "assessment" and "lesson" so the UI can
// render an interactive experience; markdown for the legacy modes.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Req {
  learnerName: string;
  grade: string;
  subject: string;
  averageScore?: number | null;
  weakStrands?: string[];
  mode: 'assessment' | 'lesson' | 'interventions' | 'tutor' | 'revision';
  level?: number;
  topic?: string;
  previousTopics?: string[];
  examType?: 'KPSEA' | 'KJSEA';
  recentResponses?: Array<{
    source: string; question: string; is_correct: boolean;
    difficulty?: number | null; strand?: string | null;
    explanation?: string | null; created_at?: string;
  }>;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function extractJson(text: string): any | null {
  if (!text) return null;
  // Strip ```json fences if present
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fence ? fence[1] : text).trim();
  try { return JSON.parse(raw); } catch { /* fallthrough */ }
  // Try to grab the first {...} block
  const m = raw.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* nope */ } }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as Partial<Req>;
    const {
      learnerName, grade, subject, averageScore, weakStrands,
      mode, level, topic, previousTopics, recentResponses, examType,
    } = body;

    if (!learnerName || !grade || !subject || !mode) {
      return jsonResponse({ error: 'Missing fields' }, 400);
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) return jsonResponse({ error: 'AI service not configured' }, 500);

    const perf = averageScore != null
      ? `${learnerName} currently averages ${averageScore}% in ${subject}.`
      : `${learnerName}'s recent performance in ${subject} is mixed.`;
    const weak = weakStrands?.length ? `Weak strands: ${weakStrands.join(', ')}.` : '';
    const avoid = previousTopics?.length
      ? `Do NOT repeat these topics already covered: ${previousTopics.join('; ')}.`
      : '';

    // Summarise the learner's most recent answered questions so the model can
    // truly adapt: which strands they got right/wrong, average difficulty
    // they manage, and what to reinforce vs stretch.
    let adaptiveBrief = '';
    if (recentResponses?.length) {
      const correct = recentResponses.filter(r => r.is_correct);
      const wrong = recentResponses.filter(r => !r.is_correct);
      const avgDiffCorrect = correct.length
        ? (correct.reduce((a, r) => a + (r.difficulty || 0), 0) / correct.length).toFixed(1) : 'n/a';
      const avgDiffWrong = wrong.length
        ? (wrong.reduce((a, r) => a + (r.difficulty || 0), 0) / wrong.length).toFixed(1) : 'n/a';
      const wrongStrands = Array.from(new Set(wrong.map(r => r.strand).filter(Boolean))).slice(0, 5);
      const recentSamples = recentResponses.slice(0, 6).map(r =>
        `- [${r.is_correct ? '✓' : '✗'} d${r.difficulty ?? '?'}] (${r.strand ?? '—'}) ${String(r.question).slice(0, 120)}`
      ).join('\n');
      adaptiveBrief = `
LEARNER'S RECENT ANSWERS (most recent first — use these to adapt):
${recentSamples}
- Correct: ${correct.length}/${recentResponses.length}
- Avg difficulty handled correctly: ${avgDiffCorrect}/5
- Avg difficulty when wrong: ${avgDiffWrong}/5
- Strands the learner struggled with: ${wrongStrands.join(', ') || 'none clear yet'}

Use this to:
* Reinforce the weak strand(s) above with extra scaffolding.
* Calibrate exercise difficulty around their proven ability (start one notch easier than where they failed, end one notch above where they succeeded).
* Avoid asking near-duplicates of the listed questions.`;
    }


    const cbcGrounding = `
You are a Kenya CBC (Competency Based Curriculum, KICD) tutor. ALL content MUST
be drawn from the official KICD CBC Designs for Grade ${grade} in ${subject}.
Use authentic CBC strand and sub-strand names (e.g. for Mathematics Grade 4:
"Numbers", "Measurement", "Geometry", "Data Handling"; for Integrated Science:
"Living things and their environment", "Force and Energy", etc.). Use Kenyan
context (shillings, ugali, matatu, Nairobi, Mombasa, Lake Victoria, etc.).
Tone: warm, playful, encouraging. Age-appropriate for the
grade. Never mention AI.`;

    let prompt = '';
    let wantsJson = false;

    if (mode === 'assessment') {
      wantsJson = true;
      prompt = `${cbcGrounding}

Create a 5-question PLACEMENT / IQ quiz for ${learnerName} (Grade ${grade}) in
${subject}. Mix difficulties: 1 easy (one grade below), 2 at-grade, 1 slightly
above grade, 1 logic/IQ-style reasoning question grounded in the subject.
Each question should be playful (use emojis sparingly, real-life Kenyan
scenarios, short stories).

Return STRICT JSON only, no prose, no markdown fences. Schema:
{
  "title": "string — short fun title",
  "instructions": "string — 1 sentence to the learner",
  "questions": [
    {
      "id": "q1",
      "difficulty": 1,            // 1=easy .. 5=hardest
      "strand": "string — CBC strand",
      "question": "string",
      "options": ["A","B","C","D"],   // 4 options
      "answerIndex": 0,           // index of correct option
      "explanation": "string — why, in 1-2 friendly sentences"
    }
    // ...5 total, difficulty roughly 1,2,3,3,4
  ]
}`;
    } else if (mode === 'lesson') {
      wantsJson = true;
      const placedLevel = level ?? Math.max(1, parseInt(String(grade).replace(/\D/g, ''), 10) || 4);
      prompt = `${cbcGrounding}

${perf} ${weak}
${adaptiveBrief}
Build an interactive, fun MINI-LESSON for ${learnerName} at LEVEL ${placedLevel}
(treat level as effective grade) in ${subject}. ${avoid}
${topic ? `Focus topic: ${topic}.` : 'Pick ONE specific CBC sub-strand appropriate for the level — prefer one of the weak strands above if any.'}

Interactive lesson:
- bite-sized (5-8 min)
- a friendly teacher voice ("Mr Kitsao the Teacher")
- a tiny story hook with Kenyan context
- 1 worked example with clear steps
- 5 practice exercises of GRADUALLY INCREASING difficulty
- instant feedback explanations
- end with an XP reward and a real-world challenge

Return STRICT JSON only, no prose, no markdown fences. Schema:
{
  "title": "string",
  "strand": "string — CBC strand",
  "subStrand": "string — CBC sub-strand",
  "level": ${placedLevel},
  "story": "string — 2-3 sentence hook with Kenyan context",
  "learningGoals": ["I can ...", "I can ...", "I can ..."],
  "vocabulary": [{"term":"string","meaning":"string"}],   // 4-6 items
  "lessonSteps": [                                      // 4-6 steps
    {"title":"string","explanation":"string","example":"string"}
  ],
  "workedExample": {
    "problem":"string",
    "steps":["step 1","step 2","step 3"],
    "answer":"string"
  },
  "exercises": [                                        // exactly 5
    {
      "id":"e1",
      "difficulty": 1,                                 // 1..5
      "type":"mcq" ,                                   // "mcq" or "input"
      "question":"string",
      "options":["A","B","C","D"],                     // omit for input type
      "answer":"string — exact correct answer (for input) OR option text (for mcq)",
      "answerIndex": 0,                                // for mcq only
      "hint":"string — small nudge",
      "explanation":"string — why, friendly tone"
    }
  ],
  "realWorldChallenge":"string — fun task to do at home today",
  "xpReward": 50,
  "badge":"string — short name e.g. 'Number Ninja'"
}`;
    } else if (mode === 'interventions') {
      prompt = `${cbcGrounding}
${perf} ${weak}
Produce a concise, parent-friendly improvement plan in Markdown:
## Quick Diagnosis
## Suggested Interventions (Home)
## Practice Activities
## Recommended Resources (KICD-aligned)
## When to Seek Extra Help
Warm, specific, no disclaimers, no AI mention.`;
    } else {
      prompt = `${cbcGrounding}
${perf} ${weak}
Write a step-by-step CBC teaching guide in Markdown with:
## Learning Goals (I can ...)
## Key Vocabulary
## Lesson (Step-by-Step)
## Worked Examples
## Try It Yourself (with Answers)
## Mini Project
## Recap`;
    }

    const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are PerformTrack Tutor, a Kenya CBC (KICD) aligned learning coach. Always ground content in the official CBC design for the learner\'s grade and subject. When asked for JSON, return STRICT JSON only.' },
          { role: 'user', content: prompt },
        ],
        ...(wantsJson ? { response_format: { type: 'json_object' } } : {}),
      }),
    });

    if (!r.ok) {
      const t = await r.text();
      return jsonResponse({ error: 'AI request failed', detail: t }, r.status);
    }
    const data = await r.json();
    const content = data?.choices?.[0]?.message?.content || '';

    if (wantsJson) {
      const parsed = extractJson(content);
      if (!parsed) return jsonResponse({ error: 'Bad JSON from model', raw: content }, 502);
      return jsonResponse({ data: parsed });
    }
    return jsonResponse({ content });
  } catch (e: any) {
    return jsonResponse({ error: e.message || 'Unknown error' }, 500);
  }
});
