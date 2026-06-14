// Deterministic CBC / KICD-grounded lesson-notes builder.
// NO external AI is called. Output mirrors the shape the UI expects so
// `NotesGenerator.tsx` and the bulk PDF flow keep working unchanged.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const upper = (s: string) => (s || '').toUpperCase();
const uniq = <T,>(a: T[]) => Array.from(new Set(a));
const take = <T,>(a: T[] | undefined, n: number, fallback: T[] = []) =>
  (a && a.length ? a : fallback).slice(0, n);

function objectivesFromSlos(slos: string[] | undefined, topic: string): string[] {
  const base = (slos && slos.length ? slos : [
    `understand the meaning and importance of ${topic}`,
    `identify key features of ${topic}`,
    `apply ${topic} in real life situations`,
    `demonstrate the values learned from ${topic}`,
  ]).slice(0, 5);
  return base.map((s) => {
    const cleaned = s.replace(/^the learner should be able to\s*/i, '').trim();
    return `By the end of the lesson, the learner should be able to ${cleaned.replace(/\.$/, '')}.`;
  });
}

function buildVocabulary(topic: string, strand?: string): { term: string; meaning: string }[] {
  const t = topic.toLowerCase();
  return [
    { term: cap(topic), meaning: `the main idea studied in this lesson under ${strand || 'this strand'}.` },
    { term: 'Strand', meaning: 'a broad area of learning in the CBC syllabus.' },
    { term: 'Sub-strand', meaning: 'a smaller, specific topic inside a strand.' },
    { term: 'Competency', meaning: 'the ability to use knowledge and skills in real life.' },
    { term: 'Activity', meaning: 'a task the learner does to practise what is being learned.' },
    { term: 'Resource', meaning: `a material used during the lesson to learn about ${t}.` },
    { term: 'Value', meaning: 'a good attitude or behaviour developed during learning.' },
    { term: 'Assessment', meaning: 'how the teacher checks that learning has happened.' },
  ];
}

function buildIntroduction(grade: string, subject: string, topic: string, kicd?: KicdContext | null): string {
  const inq = kicd?.inquiryQuestions?.[0];
  const hook = inq ? ` Have you ever wondered: ${inq}?` : '';
  return `Karibu (welcome) to today's ${subject} lesson for ${grade}. In this lesson we are going to learn about ${topic}.${hook} Together we shall explore what it means, look at clear examples from our day-to-day life in Kenya, and practise using it through fun activities. By the end you will be able to explain ${topic} in your own words and use it confidently.`;
}

function tickLines(items: string[]): string {
  return items.map((i) => `✓ ${i}`).join('\n');
}
function dashLines(items: string[]): string {
  return items.map((i) => `- ${i}`).join('\n');
}

function buildMainContent(grade: string, subject: string, topic: string, kicd?: KicdContext | null, difficulty: 'basic' | 'standard' | 'advanced' = 'standard'): string {
  const strand = kicd?.strand || subject;
  const subStrand = kicd?.subStrand || topic;
  const slos = kicd?.slos || [];
  const activities = kicd?.activities || [];
  const resources = kicd?.resources || [];
  const values = kicd?.values || [];
  const competencies = kicd?.competencies || [];
  const pcis = kicd?.pcis || [];

  const intensifier = difficulty === 'advanced'
    ? 'We shall go a step deeper and look at how this connects to harder, real-world problems.'
    : difficulty === 'basic'
    ? 'We will keep things simple and use small, easy examples first.'
    : 'We shall move at a steady pace, with everyday examples you can relate to.';

  const meaning =
`${upper(subStrand)}

Introduction to ${subStrand}
${subStrand} — is an important sub-strand under the ${strand} strand of ${subject}. ${intensifier}

Key ideas
${tickLines([
  `${subStrand} helps us understand part of our world.`,
  `It is studied as part of the ${strand} strand.`,
  `It connects to other topics already covered in ${grade}.`,
  `It is useful in our daily life at home and in school.`,
])}`;

  const characteristics =
`CHARACTERISTICS OF ${upper(subStrand)}

Main features
${tickLines((slos.length ? slos : [
  `it has clear ideas that can be explained`,
  `it can be observed or practised`,
  `it follows a step-by-step pattern`,
  `it links knowledge with skills and values`,
]).slice(0, 6).map(s => s.replace(/\.$/, '')))}`;

  const importance =
`IMPORTANCE OF ${upper(subStrand)}

Why we learn it
${tickLines([
  `It builds knowledge and skills needed in ${subject}.`,
  `It develops the core competencies of communication, critical thinking and problem solving.`,
  `It links learning to real-life experiences in Kenya.`,
  `It prepares us for the next grade and for assessments such as KPSEA/KJSEA.`,
])}`;

  const activitiesBlock =
`CLASSROOM ACTIVITIES

What we shall do in class
${dashLines((activities.length ? activities : [
  `Listen as the teacher introduces ${subStrand} using simple examples.`,
  `Discuss in pairs what you already know about ${subStrand}.`,
  `Carry out a short practical task with locally available materials.`,
  `Share findings with the rest of the class.`,
  `Write a short summary in your exercise book.`,
]).slice(0, 8))}`;

  const safety = /chemistry|electric|fire|sharp|tool|machine|acid|poison|drug|disease/i.test(`${subject} ${subStrand}`)
    ? `\n\nSafety precautions
${dashLines([
  'Wear protective clothing where necessary.',
  'Listen carefully to instructions before starting.',
  'Wash your hands after the activity.',
  'Report any problem to the teacher immediately.',
])}`
    : '';

  const resourcesBlock = resources.length
    ? `\n\nRESOURCES WE SHALL USE
${tickLines(resources.slice(0, 8))}`
    : '';

  const valuesBlock = (values.length || competencies.length)
    ? `\n\nVALUES AND COMPETENCIES
${tickLines([
  ...competencies.slice(0, 4).map(c => `Competency: ${c}`),
  ...values.slice(0, 4).map(v => `Value: ${v}`),
])}`
    : '';

  const pciBlock = pcis.length
    ? `\n\nPERTINENT & CONTEMPORARY ISSUES (PCIs)
${tickLines(pcis.slice(0, 6))}`
    : '';

  const closing =
`MAKING SENSE OF ${upper(subStrand)}

Putting it together
${subStrand} is not just something we read in a book. We see it around us — at home in ${['Nairobi', 'Mombasa', 'Kisumu', 'Eldoret', 'Nakuru'][topic.length % 5]}, on the way to school, in the matatu, at the shop and on the farm. When we learn it well, we are able to use it to make better choices and to help others.

Quick recap
${tickLines([
  `${subStrand} is part of the ${strand} strand.`,
  `We learn it through listening, doing and sharing.`,
  `It helps us in school and in real life.`,
  `It nurtures values such as responsibility, respect and unity.`,
])}`;

  return [meaning, characteristics, importance, activitiesBlock + safety, resourcesBlock + valuesBlock + pciBlock, closing]
    .filter(Boolean).join('\n\n');
}

function buildWorkedExamples(subject: string, topic: string, difficulty: string): string[] {
  const isMath = /math/i.test(subject);
  if (isMath) {
    const a = difficulty === 'advanced' ? 248 : difficulty === 'basic' ? 12 : 45;
    const b = difficulty === 'advanced' ? 137 : difficulty === 'basic' ? 7 : 28;
    return [
      `Worked Example 1 — Adding numbers.\nStep 1: Write the numbers in columns. ${a} + ${b}.\nStep 2: Add the ones: ${a % 10} + ${b % 10} = ${(a % 10) + (b % 10)}.\nStep 3: Add the tens (and carry if needed).\nStep 4: Final answer: ${a + b}.`,
      `Worked Example 2 — Subtraction.\nStep 1: ${a} − ${b}.\nStep 2: Subtract ones, regrouping if needed.\nStep 3: Subtract tens.\nStep 4: Final answer: ${a - b}.`,
      `Worked Example 3 — Word problem.\nStep 1: Read carefully: A shopkeeper had ${a} mangoes and sold ${b}. How many remain?\nStep 2: Identify operation: subtraction.\nStep 3: Calculate: ${a} − ${b} = ${a - b}.\nStep 4: Answer: ${a - b} mangoes.`,
    ];
  }
  return [
    `Worked Example 1 — Explanation.\nStep 1: Read the question about ${topic}.\nStep 2: Identify the key word(s).\nStep 3: Use the definition learned to answer.\nStep 4: Write the answer in a full sentence.`,
    `Worked Example 2 — Observation.\nStep 1: Look around the classroom or compound for an example of ${topic}.\nStep 2: Name what you see.\nStep 3: Explain why it is an example.\nStep 4: Share with your partner.`,
    `Worked Example 3 — Application.\nStep 1: Think of how ${topic} is used at home.\nStep 2: Write down two ways.\nStep 3: Explain each one in one sentence.\nStep 4: Compare with a classmate.`,
  ];
}

function buildActivities(activities: string[] | undefined, topic: string): string[] {
  if (activities && activities.length) return activities.slice(0, 5);
  return [
    `Class discussion: in pairs, share what you already know about ${topic}.`,
    `Group work: list 5 examples of ${topic} from your locality.`,
    `Practical activity: draw or model one example of ${topic} using locally available materials.`,
    `Gallery walk: display your work and learn from other groups.`,
    `Reflection: write 2 sentences about what you learned today.`,
  ];
}

function buildSummary(topic: string, slos: string[] | undefined): string[] {
  const base = (slos && slos.length ? slos.slice(0, 6) : [
    `${topic} is an important sub-strand we have learned.`,
    `We can identify and explain ${topic} in our own words.`,
    `${topic} is found in our day-to-day life.`,
    `Activities help us understand ${topic} better.`,
    `Values learned: respect, responsibility and unity.`,
    `We shall use ${topic} in school and at home.`,
  ]).map(s => s.replace(/^the learner should be able to\s*/i, '').replace(/\.$/, ''));
  return base.map(cap);
}

function buildAssessmentQuestions(topic: string, subject: string, slos: string[] | undefined): { question: string; answer: string }[] {
  const qa: { question: string; answer: string }[] = [];
  qa.push({ question: `What is ${topic}?`, answer: `${cap(topic)} is the sub-strand we studied today; it refers to the key ideas explained in the lesson.` });
  qa.push({ question: `State two characteristics of ${topic}.`, answer: `Any two correct features mentioned during the lesson.` });
  qa.push({ question: `Give two ways ${topic} is useful in real life.`, answer: `Any two real-life uses (e.g. at home, in school, in the community).` });
  qa.push({ question: `Mention one value developed when learning ${topic}.`, answer: `Examples: responsibility, respect, unity, hard work.` });
  qa.push({ question: `Name one resource we can use to learn ${topic}.`, answer: `Examples: text book, real objects, charts, the environment.` });
  qa.push({ question: `Describe one activity you would do to teach a friend about ${topic}.`, answer: `Any clear, age-appropriate activity (discussion, demonstration, role-play, drawing).` });
  qa.push({ question: `How is ${topic} connected to ${subject}?`, answer: `It is one of the sub-strands of ${subject} that builds the learner's knowledge and skills.` });
  qa.push({ question: `Give one example of ${topic} from your locality.`, answer: `Any correct, locally relevant example.` });
  (slos || []).slice(0, 3).forEach((s, i) => {
    qa.push({
      question: `In your own words, explain how you will ${s.replace(/^the learner should be able to\s*/i, '').replace(/\.$/, '')}.`,
      answer: `Learner gives a clear explanation showing they can ${s.replace(/^the learner should be able to\s*/i, '').replace(/\.$/, '')}.`,
    });
  });
  while (qa.length < 8) {
    qa.push({ question: `Write one sentence about ${topic}.`, answer: `Any correct sentence describing ${topic}.` });
  }
  return qa.slice(0, 12);
}

function buildHomeRevision(topic: string): string[] {
  return [
    `Read your notes on ${topic} again and underline the key words.`,
    `Find two real examples of ${topic} at home and write them down.`,
    `Teach a younger sibling or parent what you learned today.`,
    `Draw a simple picture or chart about ${topic}.`,
    `Answer the assessment questions in your exercise book.`,
  ];
}

function buildTeacherTips(topic: string): string[] {
  return [
    `Start with a brief story or question to capture attention before introducing ${topic}.`,
    `Use locally available materials so every learner can take part.`,
    `Give learners chance to talk in pairs before answering the whole class.`,
    `Pay extra attention to slow learners and pair them with stronger peers.`,
    `End the lesson with a quick recap and a short individual check.`,
  ];
}

function buildCompetencies(comp: string[] | undefined): string[] {
  if (comp && comp.length) return comp.slice(0, 6);
  return [
    'Communication and collaboration',
    'Critical thinking and problem solving',
    'Creativity and imagination',
    'Citizenship',
    'Learning to learn',
    'Self-efficacy',
  ];
}

function buildResources(res: string[] | undefined, subject: string): string[] {
  if (res && res.length) return res.slice(0, 8);
  return [
    `KICD-approved ${subject} Learner's Book`,
    `${subject} Teacher's Guide`,
    'Charts and pictures from the classroom',
    'Locally available real objects',
    'Exercise book and pencils',
  ];
}

function gradeBand(grade: string): { band: 'lower' | 'upper' | 'junior' | 'senior'; minWords: number } {
  const g = (grade || '').toUpperCase();
  if (g.startsWith('PP') || g.includes('PRE')) return { band: 'lower', minWords: 1000 };
  const n = parseInt(g.replace(/[^\d]/g, ''), 10);
  if (!isNaN(n)) {
    if (n <= 3) return { band: 'lower', minWords: 1000 };
    if (n <= 6) return { band: 'upper', minWords: 1500 };
    if (n <= 9) return { band: 'junior', minWords: 2000 };
    return { band: 'senior', minWords: 2500 };
  }
  return { band: 'upper', minWords: 1500 };
}

function buildDeterministicNotes(grade: string, subject: string, topic: string, kicd: KicdContext | null | undefined, difficulty: 'basic' | 'standard' | 'advanced', title: string) {
  return {
    title,
    objectives: objectivesFromSlos(kicd?.slos, topic),
    keyVocabulary: buildVocabulary(topic, kicd?.strand),
    introduction: buildIntroduction(grade, subject, topic, kicd),
    mainContent: buildMainContent(grade, subject, topic, kicd, difficulty),
    workedExamples: buildWorkedExamples(subject, topic, difficulty),
    classActivities: buildActivities(kicd?.activities, topic),
    revisionSummary: buildSummary(topic, kicd?.slos),
    assessmentQuestions: buildAssessmentQuestions(topic, subject, kicd?.slos),
    homeRevisionTasks: buildHomeRevision(topic),
    teacherTips: buildTeacherTips(topic),
    competenciesDeveloped: buildCompetencies(kicd?.competencies),
    resources: buildResources(kicd?.resources, subject),
  };
}

async function aiGenerate(grade: string, subject: string, topic: string, kicd: KicdContext | null | undefined, difficulty: 'basic' | 'standard' | 'advanced', title: string): Promise<any | null> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) return null;
  const { band, minWords } = gradeBand(grade);

  const subjectGuidance = (() => {
    const s = subject.toLowerCase();
    if (/math/.test(s)) return 'Include 3+ fully worked examples with step-by-step solutions and answers. Include practice questions with answers.';
    if (/science|tech|integrated/.test(s)) return 'Include a simple experiment with materials, procedure, observations, conclusions and SAFETY PRECAUTIONS.';
    if (/social/.test(s)) return 'Include maps/places, historical references and clear Kenyan contexts (counties, cultures, leaders, events).';
    if (/english|language activit/.test(s)) return 'Include grammar examples, a short comprehension passage with questions, and language exercises.';
    if (/kiswahili/.test(s)) return 'Andika sehemu kubwa kwa Kiswahili. Jumuisha msamiati, sentensi za mfano na shughuli za lugha.';
    if (/creative|art|music|sport/.test(s)) return 'Include detailed practical activities and a small project work brief with steps and materials.';
    if (/agric|nutrition/.test(s)) return 'Include practical farming examples from Kenya (crops, livestock, regions) and a hands-on activity.';
    if (/religi|cre|ire|hre/.test(s)) return 'Include scripture/teaching references, moral lessons, values and real-life application.';
    return 'Use clear, age-appropriate explanations with Kenyan examples.';
  })();

  const sys = `You are a senior CBC/KICD curriculum writer producing PRINT-READY lesson notes for Kenyan teachers.
Audience: ${grade} learners. Subject: ${subject}. Topic / Sub-strand: ${topic}.
Difficulty: ${difficulty}. Target band: ${band}. Minimum word count for mainContent: ${minWords} words.
Subject-specific rules: ${subjectGuidance}

Return ONLY a valid JSON object (no prose, no code fences) with EXACTLY this schema:
{
  "title": string,
  "objectives": string[],            // 4-6 "By the end of the lesson..." SLOs
  "keyVocabulary": [{ "term": string, "meaning": string }],  // 6-12 entries
  "introduction": string,            // 120-220 words, warm hook + key inquiry question
  "mainContent": string,             // VERY DETAILED, at least ${minWords} words. Plain text with these UPPERCASE headings on their own lines: STRAND, SUB-STRAND, KEY INQUIRY QUESTION, LESSON OBJECTIVES, KEY CONCEPTS (define, characteristics, importance, uses, examples, non-examples, step-by-step where relevant, diagram descriptions as [Diagram: ...]), REAL-LIFE KENYAN EXAMPLES, DISCUSSION QUESTIONS, GROUP ACTIVITIES, PRACTICAL ACTIVITIES, VALUES, CORE COMPETENCIES, PERTINENT & CONTEMPORARY ISSUES, SUMMARY. Use short paragraphs and bullet lines starting with '- '.
  "workedExamples": string[],        // 3-6 multi-step worked examples (Step 1/2/3)
  "classActivities": string[],       // 5-8 specific classroom activities
  "revisionSummary": string[],       // 6-10 concise bullet recap points
  "assessmentQuestions": [{ "question": string, "answer": string }],  // 8-12 with model answers
  "homeRevisionTasks": string[],     // 4-6 home assignment tasks
  "teacherTips": string[],           // 5-7 teacher notes / tips
  "competenciesDeveloped": string[], // 4-6 CBC core competencies
  "resources": string[]              // 5-8 KICD-aligned resources
}

Hard rules: weave provided KICD context naturally; never use markdown fences; never include keys outside the schema; ensure mainContent reaches the minimum word count; tone is professional yet learner-friendly.`;

  const userPayload = {
    grade, subject, topic, difficulty,
    kicd: kicd || {},
    instructions: `Title to use exactly: "${title}". Produce notes ready to print and teach without editing.`,
  };

  try {
    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: JSON.stringify(userPayload) },
        ],
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) {
      console.error('AI gateway non-ok', res.status, await res.text().catch(() => ''));
      return null;
    }
    const data = await res.json();
    let content = data?.choices?.[0]?.message?.content || '';
    content = content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(content);
    parsed.title = parsed.title || title;
    return parsed;
  } catch (e) {
    console.error('AI generate failed', e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as Partial<NotesRequest>;
    const { grade, subject, topic, difficulty, kicd, mainContentOnly } = body;
    if (!grade || !subject || !topic || !difficulty) {
      return json({ error: 'Missing required fields: grade, subject, topic, difficulty' }, 400);
    }

    const hasKicd = !!(kicd && (kicd.slos?.length || kicd.subStrand || kicd.strand));
    const title = `${upper(grade)} — ${upper(subject)} — ${upper(topic)}`;

    if (mainContentOnly) {
      const ai = await aiGenerate(grade, subject, topic, kicd, difficulty, title);
      const mainContent = ai?.mainContent || buildMainContent(grade, subject, topic, kicd, difficulty);
      return json({ success: true, notes: { title, mainContent }, groundedInKicd: hasKicd, source: ai ? 'ai' : 'template' });
    }

    const ai = await aiGenerate(grade, subject, topic, kicd, difficulty, title);
    const fb = buildDeterministicNotes(grade, subject, topic, kicd, difficulty, title);

    const notes = ai ? {
      title: ai.title || fb.title,
      objectives: Array.isArray(ai.objectives) && ai.objectives.length ? ai.objectives : fb.objectives,
      keyVocabulary: Array.isArray(ai.keyVocabulary) && ai.keyVocabulary.length ? ai.keyVocabulary : fb.keyVocabulary,
      introduction: ai.introduction || fb.introduction,
      mainContent: ai.mainContent || fb.mainContent,
      workedExamples: Array.isArray(ai.workedExamples) && ai.workedExamples.length ? ai.workedExamples : fb.workedExamples,
      classActivities: Array.isArray(ai.classActivities) && ai.classActivities.length ? ai.classActivities : fb.classActivities,
      revisionSummary: Array.isArray(ai.revisionSummary) && ai.revisionSummary.length ? ai.revisionSummary : fb.revisionSummary,
      assessmentQuestions: Array.isArray(ai.assessmentQuestions) && ai.assessmentQuestions.length ? ai.assessmentQuestions : fb.assessmentQuestions,
      homeRevisionTasks: Array.isArray(ai.homeRevisionTasks) && ai.homeRevisionTasks.length ? ai.homeRevisionTasks : fb.homeRevisionTasks,
      teacherTips: Array.isArray(ai.teacherTips) && ai.teacherTips.length ? ai.teacherTips : fb.teacherTips,
      competenciesDeveloped: Array.isArray(ai.competenciesDeveloped) && ai.competenciesDeveloped.length ? ai.competenciesDeveloped : fb.competenciesDeveloped,
      resources: Array.isArray(ai.resources) && ai.resources.length ? ai.resources : fb.resources,
    } : fb;

    return json({ success: true, notes, groundedInKicd: hasKicd, source: ai ? 'ai' : 'template' });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
