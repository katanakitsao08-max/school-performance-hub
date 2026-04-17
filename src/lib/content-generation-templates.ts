// KLB/KICD-aligned CBC Scheme of Work + Lesson Plan generator
import type { StrandEntry } from '@/data/cbc-curriculum';

export interface SchemeRow {
  week: number | string;
  lesson: number | string;
  strand: string;
  subStrand: string;
  slo: string;             // formatted as "By the end of the lesson... a)... b)... c)..."
  experiences: string;     // Learning Experiences
  inquiry: string;         // Key Inquiry Question(s)
  resources: string;
  assessment: string;
  remarks: string;
  isBreak?: boolean;
}

export interface LessonPlanData {
  school: string;
  teacher: string;
  grade: string;
  subject: string;
  term: string;
  strand: string;
  subStrand: string;
  slo: string;
  date: string;
  duration: string;
  introduction: string;
  development: string[];
  learnerActivities: string[];
  teacherActivities: string[];
  resources: string[];
  assessment: string;
  coreCompetencies: string[];
  values: string[];
  reflection: string;
}

// ---------------- Content banks ----------------
const EXPERIENCE_BANK: Record<string, string[]> = {
  default: [
    'In groups, learners discuss {sub_strand} using guiding questions',
    'In pairs, learners explore {sub_strand} through practical tasks',
    'Individually, learners practise {sub_strand} using worked examples',
    'Learners watch a short demonstration and respond to questions',
    'Learners use digital devices/charts to research {sub_strand}',
    'Learners role-play scenarios linked to {sub_strand}',
    'Learners brainstorm and share findings on {sub_strand}',
    'Learners create simple models/illustrations of {sub_strand}',
  ],
  Mathematics: [
    'In groups, learners use manipulatives to model {sub_strand}',
    'Learners solve real-life problems involving {sub_strand}',
    'Learners draw and interpret diagrams related to {sub_strand}',
    'Learners play number games to consolidate {sub_strand}',
    'Learners record findings on {sub_strand} in their exercise books',
  ],
  English: [
    'Learners read a passage on {sub_strand} and answer questions',
    'In pairs, learners role-play short dialogues on {sub_strand}',
    'Learners write short paragraphs applying {sub_strand}',
    'Learners listen to a recording and discuss {sub_strand}',
    'Learners use a dictionary to build vocabulary linked to {sub_strand}',
  ],
  Science: [
    'Learners carry out a simple experiment on {sub_strand}',
    'Learners observe and record findings on {sub_strand}',
    'Learners use charts/models to explain {sub_strand}',
    'Learners discuss real-life applications of {sub_strand}',
  ],
};

const INQUIRY_BANK: Record<string, string[]> = {
  default: [
    'Why is {sub_strand} important in our daily lives?',
    'How can we apply {sub_strand} at home and in school?',
    'What happens when we ignore {sub_strand}?',
    'How does {sub_strand} help us solve problems around us?',
  ],
  Mathematics: [
    'How do we use {sub_strand} in everyday life?',
    'Why is accuracy important when working with {sub_strand}?',
    'Where else can we apply {sub_strand}?',
  ],
  English: [
    'How does {sub_strand} help us communicate effectively?',
    'Why is {sub_strand} important in language learning?',
  ],
  Science: [
    'How does {sub_strand} occur in nature?',
    'Why should we care about {sub_strand} in our environment?',
  ],
};

const RESOURCE_BANK: Record<string, string[]> = {
  default: ['Course book pg ___', 'Charts', 'Realia', 'Flash cards', 'Manila paper'],
  Mathematics: ['Course book pg ___', 'Number cards', 'Counters', 'Geometric shapes', 'Manila paper'],
  English: ['Course book pg ___', 'Storybooks', 'Dictionaries', 'Charts', 'Pictures'],
  Science: ['Course book pg ___', 'Charts', 'Lab apparatus', 'Specimens', 'Digital devices'],
  'Language Activities': ['Picture cards', 'Storybooks', 'Charts', 'Crayons', 'Realia'],
  'Mathematical Activities': ['Counters', 'Number cards', 'Shape cut-outs', 'Beads', 'Charts'],
};

const ASSESSMENT_BANK = [
  'Oral questions',
  'Written exercise',
  'Observation',
  'Checklist',
  'Portfolio',
  'Peer assessment',
  'Practical activity',
];

const CORE_COMPETENCIES = [
  'Communication and collaboration',
  'Critical thinking and problem solving',
  'Creativity and imagination',
  'Citizenship',
  'Digital literacy',
  'Learning to learn',
  'Self-efficacy',
];

const VALUES = ['Respect', 'Responsibility', 'Love', 'Unity', 'Peace', 'Integrity', 'Patriotism', 'Social justice'];

// ---------------- Helpers ----------------
function pickRandom<T>(arr: T[], count: number): T[] {
  if (arr.length === 0) return [];
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, arr.length));
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] || key);
}

function getSubjectCategory(subject: string): string {
  if (subject.includes('Math')) return 'Mathematics';
  if (subject.includes('English') || subject.includes('Language')) return 'English';
  if (subject.includes('Science')) return 'Science';
  return 'default';
}

// Build EXACTLY 3 SLOs from a sub-strand's SLO list. If fewer exist, synthesise complementary ones.
function buildThreeSLOs(subStrand: string, baseSlos: string[]): string[] {
  const cleaned = baseSlos.map(s => s.replace(/^By the end.*?to:?\s*/i, '').trim()).filter(Boolean);
  const result: string[] = [];
  // Take up to 2 from dataset
  for (let i = 0; i < Math.min(2, cleaned.length); i++) result.push(cleaned[i]);
  // Synthesise the remainder
  const fallbacks = [
    `identify key concepts in ${subStrand}`,
    `apply ${subStrand} in real-life situations`,
    `appreciate the importance of ${subStrand} in daily life`,
    `discuss the relevance of ${subStrand}`,
    `demonstrate skills related to ${subStrand}`,
  ];
  let fi = 0;
  while (result.length < 3) {
    const candidate = fallbacks[fi++ % fallbacks.length];
    if (!result.includes(candidate)) result.push(candidate);
  }
  return result.slice(0, 3);
}

function formatSLOBlock(threeSlos: string[]): string {
  const letters = ['a)', 'b)', 'c)'];
  return [
    'By the end of the lesson, the learner should be able to:',
    ...threeSlos.map((s, i) => `${letters[i]} ${s}`),
  ].join('\n');
}

// ---------------- Scheme of Work (KLB style) ----------------
export function generateSchemeOfWork(
  grade: string,
  subject: string,
  term: string,
  strands: StrandEntry[]
): SchemeRow[] {
  const rows: SchemeRow[] = [];
  const TOTAL_WEEKS = 13;
  const MID_TERM_WEEK = 8;
  const LESSONS_PER_WEEK = 5;
  const cat = getSubjectCategory(subject);

  // Flatten dataset → ordered list of (strand, subStrand)
  const items: { strand: string; subStrand: string; slos: string[] }[] = [];
  for (const strand of strands) {
    for (const ss of strand.sub_strands) {
      items.push({ strand: strand.name, subStrand: ss.name, slos: ss.slos });
    }
  }

  if (items.length === 0) return rows;

  const expBank = EXPERIENCE_BANK[cat] || EXPERIENCE_BANK.default;
  const inqBank = INQUIRY_BANK[cat] || INQUIRY_BANK.default;
  const resBank = RESOURCE_BANK[subject] || RESOURCE_BANK[cat] || RESOURCE_BANK.default;

  let itemIdx = 0;

  for (let week = 1; week <= TOTAL_WEEKS; week++) {
    // Mid-term break row
    if (week === MID_TERM_WEEK) {
      rows.push({
        week,
        lesson: '-',
        strand: 'MID TERM BREAK',
        subStrand: '-',
        slo: '— No lessons this week —',
        experiences: '-',
        inquiry: '-',
        resources: '-',
        assessment: '-',
        remarks: 'Mid-term break',
        isBreak: true,
      });
      continue;
    }

    // Last week → revision
    if (week === TOTAL_WEEKS) {
      for (let l = 1; l <= LESSONS_PER_WEEK; l++) {
        rows.push({
          week,
          lesson: l,
          strand: 'Revision',
          subStrand: 'End-term consolidation',
          slo: formatSLOBlock([
            'revise key concepts covered during the term',
            'apply learnt skills in mixed exercises',
            'prepare adequately for end-of-term assessment',
          ]),
          experiences: 'Learners attempt revision exercises; teacher conducts remedial sessions; group discussions on challenging topics',
          inquiry: 'What have we learnt this term and how can we apply it?',
          resources: pickRandom(resBank, 3).join(', '),
          assessment: 'End-of-term assessment',
          remarks: l === LESSONS_PER_WEEK ? 'End of term' : '',
        });
      }
      continue;
    }

    // Regular teaching week
    for (let l = 1; l <= LESSONS_PER_WEEK; l++) {
      const item = items[itemIdx % items.length];
      itemIdx++;
      const vars = { sub_strand: item.subStrand };
      const threeSlos = buildThreeSLOs(item.subStrand, item.slos);

      rows.push({
        week,
        lesson: l,
        strand: item.strand,
        subStrand: item.subStrand,
        slo: formatSLOBlock(threeSlos),
        experiences: pickRandom(expBank, 2).map(e => fillTemplate(e, vars)).join('; '),
        inquiry: fillTemplate(pickRandom(inqBank, 1)[0] || '', vars),
        resources: pickRandom(resBank, 3).join(', '),
        assessment: pickRandom(ASSESSMENT_BANK, 2).join(', '),
        remarks: '',
      });
    }
  }

  return rows;
}

// ---------------- Lesson Plan (unchanged shape, KLB-aligned content) ----------------
export function generateLessonPlan(
  school: string,
  teacher: string,
  grade: string,
  subject: string,
  term: string,
  strand: string,
  subStrand: string,
  slo: string,
  date: string = new Date().toISOString().split('T')[0],
  duration: string = '40 minutes'
): LessonPlanData {
  const cat = getSubjectCategory(subject);
  const expBank = EXPERIENCE_BANK[cat] || EXPERIENCE_BANK.default;
  const resBank = RESOURCE_BANK[subject] || RESOURCE_BANK[cat] || RESOURCE_BANK.default;
  const vars = { sub_strand: subStrand };

  const threeSlos = buildThreeSLOs(subStrand, [slo]);

  return {
    school,
    teacher,
    grade,
    subject,
    term,
    strand,
    subStrand,
    slo: formatSLOBlock(threeSlos),
    date,
    duration,
    introduction: `Review previous knowledge on ${subStrand} through Q&A. Introduce today's focus and link it to learners' real-life experiences.`,
    development: [
      `Step 1: Explain the key concepts of ${subStrand} using examples and visual aids.`,
      `Step 2: Demonstrate the concept through guided practice with the whole class.`,
      `Step 3: Learners practise in pairs/groups while the teacher monitors and supports.`,
      `Step 4: Learners share their work; teacher addresses misconceptions.`,
      `Step 5: Summarise key points and connect to the next lesson.`,
    ],
    learnerActivities: pickRandom(expBank, 4).map(a => fillTemplate(a, vars)),
    teacherActivities: [
      `Guide learners through the concept of ${subStrand}`,
      'Monitor group discussions and provide feedback',
      'Facilitate peer learning and collaboration',
      'Assess learner understanding through observation',
      'Provide remedial support to struggling learners',
    ],
    resources: pickRandom(resBank, 4),
    assessment: `Assess learner achievement of the SLOs through ${pickRandom(ASSESSMENT_BANK, 2).join(' and ').toLowerCase()}.`,
    coreCompetencies: pickRandom(CORE_COMPETENCIES, 3),
    values: pickRandom(VALUES, 3),
    reflection: `Reflect on learner achievement of the SLOs on "${subStrand}". Note areas for reinforcement and plan remediation/enrichment.`,
  };
}
