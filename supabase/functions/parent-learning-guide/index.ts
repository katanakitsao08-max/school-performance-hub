// Deterministic CBC learning engine for the Parent Portal.
// NO AI / NO Lovable credits. Generates assessments, mini-lessons and KPSEA/KJSEA
// revision tests locally from grade/subject/level using small per-subject banks.

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
}

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

/* ---------- Seeded RNG so same request returns same content ---------- */
function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(rng: () => number, arr: T[]) => arr[Math.floor(rng() * arr.length)];
const shuffle = <T,>(rng: () => number, arr: T[]) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/* ---------- CBC strand hints per subject ---------- */
const STRANDS: Record<string, string[]> = {
  mathematics: ['Numbers', 'Measurement', 'Geometry', 'Data Handling', 'Algebra'],
  english: ['Listening & Speaking', 'Reading', 'Writing', 'Grammar in Use'],
  kiswahili: ['Kusikiliza na Kuzungumza', 'Kusoma', 'Kuandika', 'Sarufi'],
  science: ['Living things and their environment', 'Force and Energy', 'Matter', 'Environment', 'Human body'],
  'integrated science': ['Living things and their environment', 'Force and Energy', 'Matter', 'Environment'],
  'social studies': ['Natural and Built Environments', 'People and Population', 'Culture and Heritage', 'Citizenship', 'Resources and Economic Activities'],
  'religious education': ['Creation', 'The Bible/Quran', 'Christian / Muslim values', 'The Church / Ummah'],
  cre: ['Creation', 'The Bible', 'Life of Jesus', 'Christian values'],
  ire: ['Quran', 'Hadith', 'Pillars of Islam', 'Muslim values'],
  'creative arts': ['Performing Arts', 'Visual Arts'],
  'agriculture and nutrition': ['Crop Production', 'Animal Production', 'Nutrition'],
  'pre-technical studies': ['Foundations of Pre-Technical Studies', 'Materials for Production', 'Tools and Production'],
};
function strandsFor(subject: string): string[] {
  const k = subject.toLowerCase().trim();
  if (STRANDS[k]) return STRANDS[k];
  for (const key of Object.keys(STRANDS)) if (k.includes(key) || key.includes(k)) return STRANDS[key];
  return ['Foundations', 'Core Concepts', 'Application', 'Values'];
}

const KENYAN_CONTEXTS = ['Nairobi', 'Mombasa', 'Kisumu', 'Eldoret', 'Nakuru', 'Kakamega', 'Garissa', 'Meru'];
const NAMES = ['Wanjiru', 'Otieno', 'Kamau', 'Achieng', 'Mwangi', 'Aisha', 'Kipchoge', 'Naliaka', 'Salim', 'Nyambura'];
const ITEMS = ['mangoes', 'oranges', 'pencils', 'maandazi', 'sweets', 'books', 'eggs', 'bananas'];

/* ---------- Math question generator ---------- */
function mathQ(rng: () => number, level: number, difficulty: number) {
  const scale = Math.max(1, level + difficulty);
  const range = Math.min(9999, Math.pow(10, Math.min(4, Math.ceil(scale / 1.5))));
  const a = Math.floor(rng() * range) + 1;
  const b = Math.floor(rng() * range) + 1;
  const ops: Array<'+' | '-' | '×' | '÷'> = level <= 2 ? ['+', '-'] : level <= 5 ? ['+', '-', '×'] : ['+', '-', '×', '÷'];
  const op = pick(rng, ops);
  let q = '', ans = 0;
  const name = pick(rng, NAMES);
  const place = pick(rng, KENYAN_CONTEXTS);
  const item = pick(rng, ITEMS);
  if (op === '+') { ans = a + b; q = `${name} from ${place} has ${a} ${item}. A friend gives her ${b} more. How many ${item} does she now have?`; }
  else if (op === '-') {
    const big = Math.max(a, b), small = Math.min(a, b);
    ans = big - small;
    q = `A shop in ${place} had ${big} ${item}. ${small} were sold. How many ${item} remain?`;
  } else if (op === '×') {
    const m = Math.min(12, b);
    ans = a * m;
    q = `One packet has ${a} ${item}. How many ${item} are there in ${m} packets?`;
  } else {
    const div = (Math.floor(rng() * 9) + 2);
    ans = a * div;
    q = `${name} shares ${ans} ${item} equally among ${div} children. How many does each get?`;
    return formatMcq(rng, q, a, [a + 1, a - 1, a * 2].filter(x => x !== a && x > 0));
  }
  const distractors = [ans + 1, Math.max(0, ans - 1), Math.max(0, ans + 10), Math.max(0, ans - 10)]
    .filter(x => x !== ans);
  return formatMcq(rng, q, ans, distractors);
}
function formatMcq(rng: () => number, question: string, answer: number | string, distractors: (number | string)[]) {
  const opts = shuffle(rng, [answer, ...distractors.slice(0, 3)]).map(String);
  const answerIndex = opts.indexOf(String(answer));
  return { question, options: opts, answerIndex };
}

/* ---------- Generic per-subject bank fallback ---------- */
const BANKS: Record<string, Array<{ q: string; a: string; d: string[] }>> = {
  english: [
    { q: 'Which word is a noun?', a: 'school', d: ['quickly', 'run', 'happy'] },
    { q: 'Pick the correct sentence.', a: 'She is going to school.', d: ['She going school.', 'She to school going.', 'Going she school.'] },
    { q: 'What is the plural of "child"?', a: 'children', d: ['childs', 'childes', 'childies'] },
    { q: 'Choose the antonym of "happy".', a: 'sad', d: ['joyful', 'cheerful', 'glad'] },
    { q: 'Which is a verb?', a: 'jump', d: ['table', 'red', 'tall'] },
  ],
  kiswahili: [
    { q: 'Tafsiri: "school"', a: 'shule', d: ['nyumba', 'duka', 'soko'] },
    { q: 'Wingi wa "mtoto" ni?', a: 'watoto', d: ['mtotoo', 'matoto', 'mitoto'] },
    { q: 'Kinyume cha "kubwa" ni?', a: 'ndogo', d: ['kubwa', 'refu', 'fupi'] },
    { q: 'Chagua sentensi sahihi.', a: 'Mama anapika chakula.', d: ['Chakula mama anapika.', 'Anapika mama chakula.', 'Mama chakula anapika.'] },
  ],
  science: [
    { q: 'Which of these is a living thing?', a: 'a tree', d: ['a stone', 'a chair', 'water'] },
    { q: 'How many legs does an insect have?', a: '6', d: ['4', '8', '2'] },
    { q: 'Plants make food using sunlight in a process called?', a: 'photosynthesis', d: ['digestion', 'respiration', 'evaporation'] },
    { q: 'Which is a source of energy at home?', a: 'electricity', d: ['paper', 'plastic', 'soil'] },
    { q: 'What do we use to measure temperature?', a: 'thermometer', d: ['ruler', 'beaker', 'balance'] },
  ],
  'social studies': [
    { q: 'What is the capital city of Kenya?', a: 'Nairobi', d: ['Mombasa', 'Kisumu', 'Nakuru'] },
    { q: 'Which is the largest lake in Kenya?', a: 'Lake Victoria', d: ['Lake Naivasha', 'Lake Turkana', 'Lake Baringo'] },
    { q: 'The mountain found in Kenya is?', a: 'Mt Kenya', d: ['Mt Kilimanjaro', 'Mt Elgon only', 'Mt Meru'] },
    { q: 'Which ocean borders Kenya?', a: 'Indian Ocean', d: ['Atlantic Ocean', 'Pacific Ocean', 'Arctic Ocean'] },
  ],
  cre: [
    { q: 'Who created the world according to the Bible?', a: 'God', d: ['Adam', 'Moses', 'Noah'] },
    { q: 'How many days did God take to create the world?', a: '6', d: ['7', '5', '3'] },
    { q: 'Who was swallowed by a big fish?', a: 'Jonah', d: ['Moses', 'David', 'Paul'] },
  ],
  ire: [
    { q: 'How many pillars of Islam are there?', a: '5', d: ['4', '6', '7'] },
    { q: 'The holy book of Muslims is?', a: 'Quran', d: ['Bible', 'Torah', 'Vedas'] },
    { q: 'Salah is performed how many times a day?', a: '5', d: ['3', '4', '6'] },
  ],
};
function bankFor(subject: string) {
  const k = subject.toLowerCase().trim();
  for (const key of Object.keys(BANKS)) if (k.includes(key) || key.includes(k)) return BANKS[key];
  return BANKS.english;
}

function genericQ(rng: () => number, subject: string, difficulty: number) {
  const bank = bankFor(subject);
  const item = bank[Math.floor(rng() * bank.length)];
  return formatMcq(rng, item.q, item.a, item.d);
}

function makeQuestion(rng: () => number, subject: string, level: number, difficulty: number, strand: string) {
  const isMath = /math/i.test(subject);
  const built = isMath ? mathQ(rng, level, difficulty) : genericQ(rng, subject, difficulty);
  return {
    id: `q${Math.floor(rng() * 100000)}`,
    difficulty,
    strand,
    question: built.question,
    options: built.options,
    answerIndex: built.answerIndex,
    explanation: isMath
      ? `Work through it step by step and check by reversing the operation. The correct answer is "${built.options[built.answerIndex]}".`
      : `The correct answer is "${built.options[built.answerIndex]}". Review the key facts on this strand to remember it.`,
  };
}

/* ---------- Builders ---------- */
function buildAssessment(req: Req) {
  const strands = strandsFor(req.subject);
  const seed = hash(`${req.learnerName}|${req.grade}|${req.subject}|assessment|${Date.now() >> 16}`);
  const rng = mulberry32(seed);
  const level = parseInt(String(req.grade).replace(/\D/g, ''), 10) || 4;
  const difficulties = [1, 2, 3, 3, 4];
  const questions = difficulties.map((d, i) => makeQuestion(rng, req.subject, level, d, strands[i % strands.length]));
  return {
    title: `Placement Quiz — ${req.subject}`,
    instructions: `Hi ${req.learnerName}! Answer these 5 fun questions so we can find the perfect level for you.`,
    questions,
  };
}

function buildLesson(req: Req) {
  const strands = strandsFor(req.subject);
  const seed = hash(`${req.learnerName}|${req.grade}|${req.subject}|lesson|${req.level}|${req.topic ?? ''}|${(req.previousTopics || []).join(',')}`);
  const rng = mulberry32(seed);
  const level = req.level ?? (parseInt(String(req.grade).replace(/\D/g, ''), 10) || 4);
  const strand = pick(rng, strands);
  const previous = new Set(req.previousTopics || []);
  let subStrand = req.topic || `${strand} — Lesson ${(req.previousTopics?.length || 0) + 1}`;
  let attempt = 0;
  while (previous.has(subStrand) && attempt < 5) { subStrand = `${strand} — Lesson ${(req.previousTopics?.length || 0) + 1 + attempt}`; attempt++; }

  const exercises = [1, 2, 3, 4, 5].map((d) => {
    const q = makeQuestion(rng, req.subject, level, d, strand);
    return {
      id: `e${d}`,
      difficulty: d,
      type: 'mcq' as const,
      question: q.question,
      options: q.options,
      answer: q.options[q.answerIndex],
      answerIndex: q.answerIndex,
      hint: `Re-read the question carefully and think about ${strand.toLowerCase()}.`,
      explanation: q.explanation,
    };
  });

  const example = makeQuestion(rng, req.subject, level, 2, strand);
  return {
    title: `${subStrand} — A fun lesson for ${req.learnerName}`,
    strand,
    subStrand,
    level,
    story: `Karibu ${req.learnerName}! Today Mr Kitsao the Teacher takes you on a short adventure in ${pick(rng, KENYAN_CONTEXTS)} to learn about ${subStrand}.`,
    learningGoals: [
      `I can explain what ${subStrand} means.`,
      `I can use ${subStrand} to solve simple problems.`,
      `I can give one real-life example of ${subStrand} from my home.`,
    ],
    vocabulary: [
      { term: subStrand, meaning: `the main idea we are learning today under ${strand}.` },
      { term: 'Strand', meaning: 'a big area of learning in the CBC.' },
      { term: 'Practice', meaning: 'doing something many times to become better at it.' },
    ],
    lessonSteps: [
      { title: 'Warm up', explanation: `We start with a quick chat about ${subStrand} and what you already know.`, example: 'Tell Mr Kitsao one thing you have seen today.' },
      { title: 'Learn it', explanation: `Now we look at what ${subStrand} really is and how it works.`, example: `Example from ${pick(rng, KENYAN_CONTEXTS)}: ${example.question}` },
      { title: 'Try it', explanation: 'Practise using what you have just learned.', example: 'Try one easy question on your own.' },
    ],
    workedExample: {
      problem: example.question,
      steps: ['Read the question slowly.', 'Pick out the key information.', 'Choose the right method.', 'Work it out step by step.'],
      answer: example.options[example.answerIndex],
    },
    exercises,
    imageQueries: [`kenyan children ${strand.toLowerCase()}`, `${req.subject} classroom kenya`, `cbc ${subStrand.toLowerCase()}`],
    videoQuery: `CBC ${req.grade} ${req.subject} ${subStrand} Kenya`,
    realWorldChallenge: `At home tonight, find one example of ${subStrand} and tell your parent about it.`,
    xpReward: 50,
    badge: pick(rng, ['Number Ninja', 'Word Wizard', 'Science Star', 'Curiosity Champ', 'Learning Lion']),
  };
}

function buildRevision(req: Req) {
  const exam = req.examType || (String(req.grade).includes('6') ? 'KPSEA' : 'KJSEA');
  const examGrade = exam === 'KPSEA' ? 6 : 9;
  const strands = strandsFor(req.subject);
  const seed = hash(`${req.learnerName}|${req.subject}|revision|${exam}|${Date.now() >> 18}`);
  const rng = mulberry32(seed);
  const diffs = [2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4];
  const questions = diffs.map((d, i) => makeQuestion(rng, req.subject, examGrade, d, strands[i % strands.length]));
  return {
    title: `${exam} Revision: ${req.subject}`,
    instructions: `Answer ALL 12 questions. Choose the best option (A–D) and mark in your booklet.`,
    examType: exam,
    questions,
  };
}

function buildInterventions(req: Req): string {
  const perf = req.averageScore != null ? `${req.learnerName} averages ${req.averageScore}% in ${req.subject}.` : `${req.learnerName}'s ${req.subject} performance is mixed.`;
  const weak = req.weakStrands?.length ? `Focus areas: ${req.weakStrands.join(', ')}.` : '';
  return `## Quick Diagnosis
${perf} ${weak}

## Suggested Interventions (Home)
- Set a short daily study time (20–30 minutes) for ${req.subject}.
- Use real-life examples from home and the market to teach key ideas.
- Praise effort, not just marks.

## Practice Activities
- Solve 3 questions a day from the ${req.subject} CBC book.
- Discuss one new word every evening.
- Once a week, do a short test together and mark it.

## Recommended Resources (KICD-aligned)
- KICD-approved ${req.subject} Learner's Book for ${req.grade}.
- KICD Teacher's Guide for ${req.subject}.
- Past KPSEA/KJSEA papers from the school library.

## When to Seek Extra Help
- If marks drop two terms in a row.
- If the learner refuses or avoids ${req.subject}.
- If they cannot do work one grade below their level.`;
}

function buildTutor(req: Req): string {
  const topic = req.topic || `${req.subject} foundations`;
  return `## Learning Goals (I can ...)
- I can explain ${topic} in my own words.
- I can give 2 real-life examples of ${topic}.
- I can solve simple ${req.subject} problems on ${topic}.

## Key Vocabulary
- ${topic}: the main idea we are learning.
- Practice: doing something many times to become better.
- Example: a real-life case that shows the idea.

## Lesson (Step-by-Step)
1. Start with what you already know about ${topic}.
2. Listen as Mr Kitsao explains the idea in simple Kenyan examples.
3. Look at a worked example and follow each step.
4. Try one easy question on your own.
5. Discuss the answer with a parent.

## Worked Examples
- Example 1: a simple, clear case of ${topic} from home.
- Example 2: a slightly harder case from school.

## Try It Yourself (with Answers)
1. Q: Give one example of ${topic}.  A: any correct example.
2. Q: Why is ${topic} useful?  A: it helps us in real life.
3. Q: Name one place we see ${topic}.  A: any real-life location.

## Mini Project
Make a small chart or drawing showing 3 examples of ${topic} and stick it on the wall.

## Recap
${topic} is part of ${req.subject}. We use it every day at home and in school.`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as Partial<Req>;
    const { learnerName, grade, subject, mode } = body;
    if (!learnerName || !grade || !subject || !mode) return json({ error: 'Missing fields' }, 400);

    const full = body as Req;

    if (mode === 'assessment') return json({ data: buildAssessment(full) });
    if (mode === 'lesson') return json({ data: buildLesson(full) });
    if (mode === 'revision') return json({ data: buildRevision(full) });
    if (mode === 'interventions') return json({ content: buildInterventions(full) });
    return json({ content: buildTutor(full) });
  } catch (e: any) {
    return json({ error: e?.message || 'Unknown error' }, 500);
  }
});
