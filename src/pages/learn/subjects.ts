// Subject catalog for Independent Learner portal.
// Filtered by grade tier: KPSEA (PP1–Grade 6) vs KJSEA (Grade 7–9).

export type SubjectSlug =
  | "mathematics" | "english" | "kiswahili" | "integrated-science"
  | "social-studies" | "creative-arts" | "religious-education"
  | "physical-health-education" | "pre-technical-studies" | "agriculture";

export type Subject = {
  slug: SubjectSlug;
  name: string;
  description: string;
  icon: string;          // emoji for lightweight rendering
  colorVar: string;      // tailwind class for accent background
  textVar: string;       // tailwind class for accent text
  progress: number;      // mock %
};

const ALL: Record<SubjectSlug, Subject> = {
  "mathematics": { slug: "mathematics", name: "Mathematics", description: "Numbers, patterns, algebra, measurement, data and probability.", icon: "🧮", colorVar: "bg-blue-100", textVar: "text-blue-600", progress: 75 },
  "english": { slug: "english", name: "English", description: "Reading, writing, grammar, listening, speaking and literature.", icon: "📖", colorVar: "bg-emerald-100", textVar: "text-emerald-600", progress: 60 },
  "kiswahili": { slug: "kiswahili", name: "Kiswahili", description: "Kusoma, kuandika, sarufi, kusikiliza, kuzungumza na fasihi.", icon: "💬", colorVar: "bg-amber-100", textVar: "text-amber-600", progress: 65 },
  "integrated-science": { slug: "integrated-science", name: "Integrated Science", description: "Living things, materials, energy, earth and space, health.", icon: "🧪", colorVar: "bg-violet-100", textVar: "text-violet-600", progress: 55 },
  "social-studies": { slug: "social-studies", name: "Social Studies", description: "History, citizenship, geography, economics and culture.", icon: "🌍", colorVar: "bg-orange-100", textVar: "text-orange-600", progress: 50 },
  "creative-arts": { slug: "creative-arts", name: "Creative Arts", description: "Art, music, drama, movement and digital creativity.", icon: "🎨", colorVar: "bg-teal-100", textVar: "text-teal-600", progress: 40 },
  "religious-education": { slug: "religious-education", name: "Religious Education", description: "Values, beliefs, worship and moral development.", icon: "✝️", colorVar: "bg-pink-100", textVar: "text-pink-600", progress: 45 },
  "physical-health-education": { slug: "physical-health-education", name: "Physical & Health Education", description: "Movement, games, safety, health and well-being.", icon: "🏃", colorVar: "bg-sky-100", textVar: "text-sky-600", progress: 35 },
  "pre-technical-studies": { slug: "pre-technical-studies", name: "Pre-Technical Studies", description: "Drawing, materials, communication and digital technology.", icon: "🛠️", colorVar: "bg-stone-100", textVar: "text-stone-700", progress: 20 },
  "agriculture": { slug: "agriculture", name: "Agriculture", description: "Crops, soils, livestock and farm enterprise.", icon: "🌱", colorVar: "bg-lime-100", textVar: "text-lime-700", progress: 25 },
};

/** Pull integer grade level from strings like "Grade 5", "PP2", "7". */
function gradeLevel(grade: string): number {
  if (!grade) return 1;
  const m = grade.match(/(\d+)/);
  if (m) return parseInt(m[1], 10);
  if (/PP/i.test(grade)) return 0;
  return 1;
}

export function getSubjectsForGrade(grade: string): Subject[] {
  const lvl = gradeLevel(grade);
  // KPSEA (PP1–Grade 6)
  const kpsea: SubjectSlug[] = [
    "mathematics", "english", "kiswahili", "integrated-science",
    "social-studies", "creative-arts", "religious-education", "physical-health-education",
  ];
  // KJSEA (Grade 7–9)
  const kjsea: SubjectSlug[] = [
    "mathematics", "english", "kiswahili", "integrated-science",
    "social-studies", "creative-arts", "pre-technical-studies",
    "agriculture", "physical-health-education", "religious-education",
  ];
  const list = lvl >= 7 ? kjsea : kpsea;
  return list.map(s => ALL[s]);
}

export function getSubject(slug: string): Subject | undefined {
  return (ALL as Record<string, Subject>)[slug];
}
