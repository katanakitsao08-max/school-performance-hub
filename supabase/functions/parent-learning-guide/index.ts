// Parent-facing AI tutor: returns interventions and a teaching guide
// for a learner in a specific subject, grounded in their performance.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Req {
  learnerName: string;
  grade: string;
  subject: string;
  averageScore?: number | null;     // 0-100
  weakStrands?: string[];           // optional list of strands they scored low on
  mode: 'interventions' | 'tutor';
  topic?: string;                   // optional sub-topic for tutor mode
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as Partial<Req>;
    const { learnerName, grade, subject, averageScore, weakStrands, mode, topic } = body;
    if (!learnerName || !grade || !subject || !mode) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'AI service not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const perf = averageScore != null
      ? `${learnerName} currently averages ${averageScore}% in ${subject}.`
      : `${learnerName}'s recent performance in ${subject} is mixed.`;
    const weak = weakStrands?.length ? `Weak strands: ${weakStrands.join(', ')}.` : '';

    const prompt = mode === 'interventions'
      ? `You are a CBC (Kenya) education coach speaking directly to a parent.
Learner: ${learnerName}, Grade ${grade}.
Subject: ${subject}.
${perf} ${weak}

Produce a concise, parent-friendly improvement plan in Markdown with these sections:
## Quick Diagnosis
2-3 sentences on what the score suggests.
## Suggested Interventions (Home)
5 bullet, practical things the parent can do this week.
## Practice Activities
5 short activities the learner can do (10-20 min each), with ages-appropriate examples.
## Recommended Resources
3-5 free resources (KICD-aligned where possible) with short notes.
## When to Seek Extra Help
1-2 sentences with a clear trigger.
Keep it warm, encouraging and specific. No disclaimers. No mention of AI.`
      : `You are a friendly CBC tutor for a Grade ${grade} learner in Kenya.
Subject: ${subject}${topic ? ` — Topic: ${topic}` : ''}.
${perf} ${weak}

Write a step-by-step TEACHING GUIDE the learner can read alone (or with a parent) and learn from. Use Markdown:
## Learning Goals
3 clear "I can..." statements.
## Key Vocabulary
5-8 terms with simple definitions.
## Lesson (Step-by-Step)
Number each step. Use short paragraphs, examples and small diagrams in plain text where useful.
## Worked Examples
2-3 fully worked examples.
## Try It Yourself
5 practice questions (mixed difficulty) followed by an "Answers" sub-section.
## Mini Project / Real-Life Application
1 short hands-on activity.
## Recap
3 bullets summarising the lesson.
Tone: encouraging, age-appropriate for Grade ${grade}. No mention of AI.`;

    const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are PerformTrack Tutor, a CBC-aligned learning coach.' },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!r.ok) {
      const t = await r.text();
      return new Response(JSON.stringify({ error: 'AI request failed', detail: t }), {
        status: r.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const data = await r.json();
    const content = data?.choices?.[0]?.message?.content || '';
    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message || 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
