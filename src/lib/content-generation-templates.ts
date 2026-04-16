// Structured templates for Scheme of Work and Lesson Plan generation
import type { StrandEntry } from '@/data/cbc-curriculum';

export interface SchemeRow {
  week: number;
  strand: string;
  subStrand: string;
  slo: string;
  activities: string;
  resources: string;
  assessment: string;
  remarks: string;
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

const ACTIVITY_TEMPLATES: Record<string, string[]> = {
  default: [
    "Learners discuss {sub_strand} in groups",
    "Learners practice through guided exercises",
    "Learners demonstrate understanding through presentations",
    "Learners complete individual assignments",
    "Learners engage in peer-to-peer learning activities",
    "Learners participate in hands-on activities",
    "Learners use real-life examples to explore concepts",
    "Learners work in pairs to solve problems",
  ],
  Mathematics: [
    "Learners solve problems on {sub_strand} using manipulatives",
    "Learners work in groups to complete mathematical exercises",
    "Learners use number charts and models to explore concepts",
    "Learners apply {sub_strand} in real-life word problems",
    "Learners practice mental arithmetic strategies",
    "Learners create visual representations of mathematical concepts",
  ],
  English: [
    "Learners read passages and identify key information",
    "Learners write compositions related to {sub_strand}",
    "Learners engage in role-play and oral presentations",
    "Learners use dictionaries to build vocabulary",
    "Learners work in groups to discuss texts and share ideas",
    "Learners practice sentence construction exercises",
  ],
  Science: [
    "Learners conduct simple experiments on {sub_strand}",
    "Learners observe and record findings in science journals",
    "Learners discuss scientific phenomena in groups",
    "Learners use models and diagrams to explain concepts",
    "Learners make predictions and test hypotheses",
  ],
};

const RESOURCE_TEMPLATES: Record<string, string[]> = {
  default: ["Textbooks", "Charts", "Flash cards", "Writing materials", "Realia"],
  Mathematics: ["Number charts", "Textbooks", "Calculators", "Geometric models", "Grid paper", "Counters"],
  English: ["Storybooks", "Dictionaries", "Newspapers", "Textbooks", "Writing materials", "Audio recordings"],
  Science: ["Lab equipment", "Specimens", "Charts and models", "Textbooks", "Measuring tools"],
  "Language Activities": ["Picture cards", "Storybooks", "Puppets", "Charts", "Crayons"],
  "Mathematical Activities": ["Counters", "Number cards", "Shapes cutouts", "Beads", "Charts"],
};

const ASSESSMENT_TEMPLATES = [
  "Oral questions on {slo}",
  "Written exercises on {sub_strand}",
  "Group presentations and peer assessment",
  "Individual practice and workbook exercises",
  "Observation of learner participation",
  "Portfolio assessment of completed tasks",
];

const CORE_COMPETENCIES = [
  "Communication and collaboration",
  "Critical thinking and problem solving",
  "Creativity and imagination",
  "Citizenship",
  "Digital literacy",
  "Learning to learn",
  "Self-efficacy",
];

const VALUES = [
  "Respect", "Responsibility", "Love", "Unity", "Peace",
  "Integrity", "Patriotism", "Social justice",
];

function pickRandom<T>(arr: T[], count: number): T[] {
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

export function generateSchemeOfWork(
  grade: string,
  subject: string,
  term: string,
  strands: StrandEntry[]
): SchemeRow[] {
  const rows: SchemeRow[] = [];
  const totalWeeks = 13;
  let week = 1;
  const cat = getSubjectCategory(subject);

  const allItems: { strand: string; subStrand: string; slo: string }[] = [];
  for (const strand of strands) {
    for (const ss of strand.sub_strands) {
      for (const slo of ss.slos) {
        allItems.push({ strand: strand.name, subStrand: ss.name, slo });
      }
    }
  }

  if (allItems.length === 0) return rows;

  // Distribute SLOs across weeks
  const itemsPerWeek = Math.max(1, Math.ceil(allItems.length / totalWeeks));
  let idx = 0;

  while (week <= totalWeeks && idx < allItems.length) {
    const batch = allItems.slice(idx, idx + itemsPerWeek);
    for (const item of batch) {
      const vars = { sub_strand: item.subStrand, slo: item.slo };
      const acts = ACTIVITY_TEMPLATES[cat] || ACTIVITY_TEMPLATES.default;
      const res = RESOURCE_TEMPLATES[cat] || RESOURCE_TEMPLATES.default;
      rows.push({
        week,
        strand: item.strand,
        subStrand: item.subStrand,
        slo: item.slo,
        activities: pickRandom(acts, 2).map(a => fillTemplate(a, vars)).join('; '),
        resources: pickRandom(res, 3).join(', '),
        assessment: fillTemplate(pickRandom(ASSESSMENT_TEMPLATES, 1)[0], vars),
        remarks: '',
      });
    }
    idx += itemsPerWeek;
    week++;
  }

  // Fill remaining weeks
  while (rows.length < totalWeeks) {
    const last = allItems[allItems.length - 1];
    const vars = { sub_strand: last.subStrand, slo: last.slo };
    const acts = ACTIVITY_TEMPLATES[cat] || ACTIVITY_TEMPLATES.default;
    const res = RESOURCE_TEMPLATES[cat] || RESOURCE_TEMPLATES.default;
    rows.push({
      week: rows.length + 1,
      strand: last.strand,
      subStrand: last.subStrand,
      slo: 'Revision and consolidation',
      activities: 'Revision exercises; Remedial and enrichment activities',
      resources: pickRandom(res, 3).join(', '),
      assessment: 'End-of-term assessment',
      remarks: week === totalWeeks ? 'End of term' : '',
    });
  }

  return rows;
}

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
  const acts = ACTIVITY_TEMPLATES[cat] || ACTIVITY_TEMPLATES.default;
  const res = RESOURCE_TEMPLATES[cat] || RESOURCE_TEMPLATES.default;
  const vars = { sub_strand: subStrand, slo };

  return {
    school,
    teacher,
    grade,
    subject,
    term,
    strand,
    subStrand,
    slo,
    date,
    duration,
    introduction: `Begin by reviewing previous knowledge on ${subStrand}. Engage learners through a brief discussion or question-and-answer session to activate prior knowledge. Introduce the topic: "${slo}".`,
    development: [
      `Step 1: Explain the key concepts of ${subStrand} using appropriate examples and visual aids.`,
      `Step 2: Demonstrate the concept through guided practice with the whole class.`,
      `Step 3: Provide learners with practice exercises to apply the concept individually or in pairs.`,
      `Step 4: Allow learners to share their work and discuss different approaches.`,
      `Step 5: Summarize the key points and address any misconceptions.`,
    ],
    learnerActivities: pickRandom(acts, 4).map(a => fillTemplate(a, vars)),
    teacherActivities: [
      `Guide learners through the concept of ${subStrand}`,
      'Monitor group discussions and provide feedback',
      'Facilitate peer learning and collaboration',
      'Assess learner understanding through observation',
      'Provide remedial support to struggling learners',
    ],
    resources: pickRandom(res, 4),
    assessment: `Assess learner understanding of "${slo}" through oral questions, written exercises, and observation of practical activities.`,
    coreCompetencies: pickRandom(CORE_COMPETENCIES, 3),
    values: pickRandom(VALUES, 3),
    reflection: `Reflect on learner achievement of the SLO: "${slo}". Note areas that need reinforcement and plan for remediation or enrichment as needed.`,
  };
}
