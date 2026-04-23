// Auto-derive short subject codes + teacher initials for ASc-style summary timetable.

const SUBJECT_CODE_MAP: Record<string, string> = {
  'mathematics': 'MATH',
  'mathematical activities': 'MATH',
  'math': 'MATH',
  'english': 'ENG',
  'english language activities': 'ENG',
  'kiswahili': 'KISW',
  'kiswahili / kenya sign language': 'KISW',
  'kiswahili language activities / kenya sign language activities': 'KISW',
  'kiswahili language activities': 'KISW',
  'indigenous language activities': 'IND',
  'science & technology': 'I/SCIE',
  'science and technology': 'I/SCIE',
  'integrated science': 'I/SCIE',
  'science': 'SCI',
  'social studies': 'SST',
  'religious education': 'RE',
  'religious education activities': 'RE',
  'cre': 'CRE',
  'ire': 'IRE',
  'hre': 'HRE',
  'agriculture and nutrition': 'AGRI/NUT',
  'agriculture': 'AGRI',
  'creative arts': 'CA',
  'creative arts and sports': 'CA/SPT',
  'creative activities': 'CA',
  'psychomotor and creative activities': 'PSY/CA',
  'environmental activities': 'ENV',
  'pre-technical studies': 'PRE-TEC',
  'physical and health education': 'PHE',
  'physical education': 'PE',
  'computer studies': 'COMP',
  'home science': 'H/SCI',
  'business studies': 'BUS',
  'life skills': 'LSE',
};

/** Make a short subject code (e.g. "Mathematics" → "MATH"). */
export function shortSubjectCode(name?: string | null): string {
  if (!name) return '';
  const n = name.trim().toLowerCase();
  if (SUBJECT_CODE_MAP[n]) return SUBJECT_CODE_MAP[n];
  // Fallback: take first letter of each significant word, max 6 chars
  const words = name
    .replace(/[\(\)\/&]/g, ' ')
    .split(/\s+/)
    .filter(w => w && !['and', 'of', 'the', 'a'].includes(w.toLowerCase()));
  if (words.length === 1) return words[0].slice(0, 5).toUpperCase();
  return words.map(w => w[0]).join('').slice(0, 5).toUpperCase();
}

/** Make teacher initials/last name (e.g. "John Mwangi" → "MWANGI"). */
export function teacherShort(name?: string | null): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  // Use the longest name part (typically the surname) – up to 7 chars
  const longest = parts.reduce((a, b) => (b.length > a.length ? b : a));
  return longest.slice(0, 7).toUpperCase();
}
