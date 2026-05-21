// Lightweight CBC content library for the Independent Learner portal.
// Each subject has 4–6 lessons grouped by strand, with notes and a short quiz.
// Lessons are tier-aware: "kpsea" (PP1–G6) or "kjsea" (G7–9) or "all".

import type { SubjectSlug } from "./subjects";

export type Tier = "kpsea" | "kjsea" | "all";

export type QuizQ = { q: string; options: string[]; correct: number; explain?: string };

export type Lesson = {
  id: string;
  title: string;
  strand: string;
  duration: string;          // human label e.g. "8 min"
  tier: Tier;
  summary: string;           // 1–2 sentence intro shown on lesson card
  notes: string;             // markdown-ish body (plain text + bullets, rendered as prose)
  examples?: string[];       // worked examples / illustrations
  quiz: QuizQ[];
};

const MATHEMATICS: Lesson[] = [
  {
    id: "m-place-value", title: "Place Value up to 10,000", strand: "Numbers", duration: "8 min", tier: "kpsea",
    summary: "Every digit in a whole number has a place: ones, tens, hundreds and thousands.",
    notes: "In the number 3,482 the 3 is 3 thousands, the 4 is 4 hundreds, the 8 is 8 tens and the 2 is 2 ones. Bigger place values are written on the left. Use a place-value chart whenever you are unsure.",
    examples: ["3,482 = 3,000 + 400 + 80 + 2", "Compare 1,205 and 1,250 — the tens digit decides (0 vs 5), so 1,250 is bigger."],
    quiz: [
      { q: "What is the value of 6 in 4,632?", options: ["6", "60", "600", "6,000"], correct: 2 },
      { q: "Which number is greatest?", options: ["2,109", "2,091", "2,019", "2,190"], correct: 3 },
      { q: "3,000 + 400 + 80 + 2 = ?", options: ["3,482", "3,428", "3,824", "3,842"], correct: 0 },
    ],
  },
  {
    id: "m-addsub", title: "Addition & Subtraction with Regrouping", strand: "Numbers", duration: "10 min", tier: "kpsea",
    summary: "Add and subtract multi-digit numbers by lining up place values and carrying or borrowing.",
    notes: "Line up the ones under the ones, tens under the tens. When a column adds to 10 or more, carry the ten to the next column. For subtraction, if the top digit is smaller, borrow 1 from the next column.",
    examples: ["247 + 158 = 405", "503 − 276 = 227"],
    quiz: [
      { q: "256 + 178 = ?", options: ["324", "434", "424", "344"], correct: 1 },
      { q: "600 − 245 = ?", options: ["355", "365", "455", "345"], correct: 0 },
    ],
  },
  {
    id: "m-fractions", title: "Fractions: Halves, Quarters & Thirds", strand: "Numbers", duration: "9 min", tier: "kpsea",
    summary: "A fraction shows equal parts of a whole. The bottom number names the parts.",
    notes: "1/2 means one out of two equal parts. 1/4 means one out of four. The bigger the bottom (denominator), the smaller each piece. Equivalent fractions share the same value, e.g. 2/4 = 1/2.",
    quiz: [
      { q: "Which is bigger?", options: ["1/2", "1/3", "1/4", "1/5"], correct: 0 },
      { q: "2/4 is equal to:", options: ["1/3", "1/2", "2/3", "3/4"], correct: 1 },
    ],
  },
  {
    id: "m-measurement", title: "Measuring Length (cm and m)", strand: "Measurement", duration: "11 min", tier: "kpsea",
    summary: "Use rulers and metre rules to measure length. 100 cm make 1 metre.",
    notes: "Short objects (a pencil) are measured in centimetres (cm). Long objects (a classroom) are measured in metres (m). Convert by remembering 1 m = 100 cm.",
    quiz: [
      { q: "3 m is how many cm?", options: ["30", "300", "3,000", "33"], correct: 1 },
      { q: "Best unit for a textbook?", options: ["km", "m", "cm", "mm"], correct: 2 },
    ],
  },
  {
    id: "m-algebra-jss", title: "Linear Equations", strand: "Algebra", duration: "12 min", tier: "kjsea",
    summary: "Solve equations like 2x + 5 = 15 by doing the same thing to both sides.",
    notes: "Goal: get the variable alone. Subtract or add to undo addition; divide or multiply to undo multiplication. Always do the same operation on both sides of the = sign.",
    examples: ["2x + 5 = 15 → 2x = 10 → x = 5"],
    quiz: [
      { q: "Solve: 3x − 4 = 11", options: ["x = 3", "x = 5", "x = 7", "x = 15"], correct: 1 },
      { q: "Solve: x/2 = 6", options: ["x = 3", "x = 8", "x = 12", "x = 4"], correct: 2 },
    ],
  },
  {
    id: "m-geometry-jss", title: "Pythagoras' Theorem", strand: "Geometry", duration: "10 min", tier: "kjsea",
    summary: "In a right-angled triangle, a² + b² = c² where c is the longest side (hypotenuse).",
    notes: "Identify the right angle. The hypotenuse is opposite the right angle. Square the two shorter sides, add them, then take the square root for the hypotenuse.",
    examples: ["3, 4, ? → 9 + 16 = 25 → hypotenuse = 5"],
    quiz: [
      { q: "Sides 6 and 8 — what is the hypotenuse?", options: ["10", "12", "14", "9"], correct: 0 },
    ],
  },
];

const ENGLISH: Lesson[] = [
  {
    id: "e-nouns", title: "Common & Proper Nouns", strand: "Grammar", duration: "7 min", tier: "kpsea",
    summary: "A noun names a person, place, animal or thing.",
    notes: "Common nouns name general things (girl, city, dog). Proper nouns name specific ones and always start with a capital letter (Amina, Nairobi, Simba).",
    quiz: [
      { q: "Pick the proper noun:", options: ["river", "Nile", "water", "fish"], correct: 1 },
      { q: "Which is a common noun?", options: ["Kenya", "Mary", "teacher", "Mombasa"], correct: 2 },
    ],
  },
  {
    id: "e-tenses", title: "Simple Past Tense", strand: "Grammar", duration: "9 min", tier: "kpsea",
    summary: "Use the past tense to talk about actions that already happened.",
    notes: "Most regular verbs add -ed (walk → walked). Many common verbs are irregular (go → went, eat → ate, see → saw). Memorise the most common irregulars.",
    quiz: [
      { q: "Past of 'run'?", options: ["runned", "ran", "runned", "running"], correct: 1 },
      { q: "She ___ to school yesterday.", options: ["walk", "walks", "walked", "walking"], correct: 2 },
    ],
  },
  {
    id: "e-comp", title: "Reading Comprehension", strand: "Reading", duration: "12 min", tier: "all",
    summary: "Read carefully, then answer questions using evidence from the text.",
    notes: "Read the whole passage once. Skim again to find key words. Underline names, dates and numbers. Answer in full sentences whenever possible.",
    quiz: [
      { q: "What should you do FIRST?", options: ["Answer", "Read fully", "Guess", "Skip"], correct: 1 },
    ],
  },
  {
    id: "e-essay-jss", title: "Writing a 5-Paragraph Essay", strand: "Writing", duration: "14 min", tier: "kjsea",
    summary: "Plan, draft and revise a clear essay with introduction, body and conclusion.",
    notes: "Paragraph 1: introduce the topic and state your main idea (thesis). Paragraphs 2–4: one supporting idea each, with examples. Paragraph 5: restate the main idea and close.",
    quiz: [
      { q: "How many body paragraphs?", options: ["1", "2", "3", "5"], correct: 2 },
    ],
  },
];

const KISWAHILI: Lesson[] = [
  {
    id: "k-salamu", title: "Salamu na Maamkizi", strand: "Kuzungumza", duration: "6 min", tier: "kpsea",
    summary: "Salamu hutumika kuanzisha mazungumzo kwa heshima.",
    notes: "'Habari za asubuhi' hutumika asubuhi. 'Habari za mchana' hutumika mchana. Jibu la kawaida ni 'nzuri' au 'salama'.",
    quiz: [
      { q: "Jibu la 'Habari yako?'", options: ["Karibu", "Nzuri", "Asante", "Kwaheri"], correct: 1 },
    ],
  },
  {
    id: "k-ngeli", title: "Ngeli ya A-WA", strand: "Sarufi", duration: "10 min", tier: "kpsea",
    summary: "Nomino zinazoteuliwa na 'a' (umoja) na 'wa' (wingi) huitwa ngeli ya A-WA.",
    notes: "Mfano: mtoto a-nacheza, watoto wa-nacheza. Karibu nomino za viumbe hai huingia katika ngeli hii.",
    quiz: [
      { q: "'Walimu ___ fundisha.'", options: ["a", "wa", "i", "li"], correct: 1 },
    ],
  },
  {
    id: "k-insha-jss", title: "Insha ya Maelezo", strand: "Kuandika", duration: "12 min", tier: "kjsea",
    summary: "Insha ya maelezo huelezea jambo, mtu au mahali kwa undani.",
    notes: "Anza na utangulizi mfupi. Endelea na aya za mwili zenye hoja moja kila moja. Maliza na hitimisho linaloweka muhtasari.",
    quiz: [
      { q: "Insha bora ina aya ngapi za mwili?", options: ["1", "2-3", "5", "10"], correct: 1 },
    ],
  },
];

const SCIENCE: Lesson[] = [
  {
    id: "s-states", title: "States of Matter", strand: "Materials", duration: "8 min", tier: "kpsea",
    summary: "Matter exists as solid, liquid or gas depending on how its particles move.",
    notes: "Solids have a fixed shape and volume. Liquids take the shape of their container but keep volume. Gases spread to fill any container. Heating can change one state into another.",
    quiz: [
      { q: "Water vapour is a:", options: ["Solid", "Liquid", "Gas", "Plasma"], correct: 2 },
      { q: "Ice melts to form:", options: ["Gas", "Liquid", "Solid", "Vapour"], correct: 1 },
    ],
  },
  {
    id: "s-plants", title: "Parts of a Plant", strand: "Living Things", duration: "9 min", tier: "kpsea",
    summary: "Roots, stem, leaves, flowers and fruits each have a job.",
    notes: "Roots anchor the plant and absorb water. The stem holds the plant up and carries water. Leaves make food using sunlight (photosynthesis). Flowers help the plant reproduce. Fruits carry seeds.",
    quiz: [
      { q: "Where is food made?", options: ["Roots", "Stem", "Leaves", "Flowers"], correct: 2 },
    ],
  },
  {
    id: "s-energy-jss", title: "Forms of Energy", strand: "Energy", duration: "10 min", tier: "kjsea",
    summary: "Energy comes in many forms: heat, light, sound, electrical, chemical, kinetic, potential.",
    notes: "Energy is the ability to do work. It can change from one form to another but is never created or destroyed (conservation of energy). A torch turns chemical energy in a battery into light and heat.",
    quiz: [
      { q: "A moving car has mostly:", options: ["Chemical energy", "Kinetic energy", "Sound energy", "Light energy"], correct: 1 },
    ],
  },
];

const SOCIAL: Lesson[] = [
  {
    id: "ss-citizen", title: "Being a Good Citizen", strand: "Citizenship", duration: "7 min", tier: "kpsea",
    summary: "A good citizen follows rules, respects others and takes care of property.",
    notes: "Rights come with responsibilities. We have the right to education, but we must attend school and behave well. We respect leaders and serve our community.",
    quiz: [
      { q: "A right of a child is:", options: ["Skipping school", "Education", "Stealing", "Fighting"], correct: 1 },
    ],
  },
  {
    id: "ss-map", title: "Reading Simple Maps", strand: "Geography", duration: "9 min", tier: "kpsea",
    summary: "Maps show places from above. They use symbols, a key and compass directions.",
    notes: "North is usually at the top. The key (legend) tells you what each symbol means. Distance is shown using the scale.",
    quiz: [
      { q: "North is usually at the:", options: ["Top", "Bottom", "Left", "Right"], correct: 0 },
    ],
  },
];

const CREATIVE: Lesson[] = [
  {
    id: "ca-colour", title: "Primary & Secondary Colours", strand: "Visual Art", duration: "7 min", tier: "all",
    summary: "Primary colours mix to make secondary colours.",
    notes: "Primary: red, blue, yellow. Secondary: red+yellow=orange, blue+yellow=green, red+blue=purple.",
    quiz: [
      { q: "Blue + yellow = ?", options: ["Orange", "Green", "Purple", "Brown"], correct: 1 },
    ],
  },
];

const RELIGIOUS: Lesson[] = [
  {
    id: "re-values", title: "Honesty & Responsibility", strand: "Values", duration: "6 min", tier: "all",
    summary: "Living truthfully and doing what is right.",
    notes: "Honesty means telling the truth even when it is hard. Responsibility means doing your duties (homework, chores) without being told.",
    quiz: [
      { q: "Honesty means:", options: ["Telling lies", "Telling the truth", "Keeping secrets", "Cheating"], correct: 1 },
    ],
  },
];

const PHE: Lesson[] = [
  {
    id: "phe-warmup", title: "Warm-up Routine", strand: "Movement", duration: "6 min", tier: "all",
    summary: "Warming up prepares the body for activity and prevents injury.",
    notes: "Start with light jogging, then stretch the major muscles (legs, arms, back). Spend at least 5 minutes warming up before any sport.",
    quiz: [
      { q: "Why do we warm up?", options: ["Show off", "Prevent injury", "Waste time", "Get tired"], correct: 1 },
    ],
  },
];

const PRETECH: Lesson[] = [
  {
    id: "pt-drawing", title: "Technical Drawing Basics", strand: "Communication", duration: "10 min", tier: "kjsea",
    summary: "Use accurate lines, scales and labels to communicate technical ideas.",
    notes: "Always use a sharp pencil and a ruler. Lines should be clean and consistent. Label all measurements clearly. Use a scale (e.g. 1:10) when the object is too big for the page.",
    quiz: [
      { q: "Scale 1:10 means:", options: ["10× bigger", "10× smaller", "Same size", "Random"], correct: 1 },
    ],
  },
];

const AGRI: Lesson[] = [
  {
    id: "ag-soil", title: "Types of Soil", strand: "Soils", duration: "9 min", tier: "kjsea",
    summary: "Common soils are sandy, clay and loam. Loam is best for most crops.",
    notes: "Sandy soil drains quickly and holds few nutrients. Clay soil holds water but can become waterlogged. Loam is a balanced mix and supports most crops well.",
    quiz: [
      { q: "Best soil for most crops:", options: ["Sandy", "Clay", "Loam", "Rocky"], correct: 2 },
    ],
  },
];

const LESSONS: Record<SubjectSlug, Lesson[]> = {
  "mathematics": MATHEMATICS,
  "english": ENGLISH,
  "kiswahili": KISWAHILI,
  "integrated-science": SCIENCE,
  "social-studies": SOCIAL,
  "creative-arts": CREATIVE,
  "religious-education": RELIGIOUS,
  "physical-health-education": PHE,
  "pre-technical-studies": PRETECH,
  "agriculture": AGRI,
};

function tier(grade: string): "kpsea" | "kjsea" {
  const m = grade?.match(/(\d+)/);
  const n = m ? parseInt(m[1], 10) : 1;
  return n >= 7 ? "kjsea" : "kpsea";
}

export function getLessonsForSubject(slug: SubjectSlug, grade: string): Lesson[] {
  const t = tier(grade);
  const all = LESSONS[slug] || [];
  const matched = all.filter(l => l.tier === "all" || l.tier === t);
  // Safety net: if no lessons match this tier, surface every lesson so the subject is never empty.
  return matched.length > 0 ? matched : all;
}

export function getLesson(slug: SubjectSlug, id: string): Lesson | undefined {
  return (LESSONS[slug] || []).find(l => l.id === id);
}

export function groupByStrand(lessons: Lesson[]): Record<string, Lesson[]> {
  return lessons.reduce((acc, l) => {
    (acc[l.strand] ||= []).push(l);
    return acc;
  }, {} as Record<string, Lesson[]>);
}
