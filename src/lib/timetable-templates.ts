// CBC-aligned timetable templates. Applied with one click in the setup panel.
export type BreakType = 'short' | 'long' | 'lunch';
export interface BreakSlot { slot: number; type: BreakType; label: string }
export interface SchedulingRules {
  reserveGames: boolean;
  allowDoubleLessons: boolean;
  preventSameSubjectConsecutive: boolean;
  limitTeacherLoadPerDay: number; // 0 = no cap
  spreadPracticals: boolean;
  lockAssemblies: boolean;
  respectTeacherAvailability: boolean;
}
export interface TimetableTemplate {
  id: string;
  name: string;
  description: string;
  startTime: string;            // HH:MM
  lessonDurationMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  lunchMin: number;
  periodsPerDay: number;
  breaks: BreakSlot[];          // slot index is 1-based
  rules: SchedulingRules;
}

const defaultRules: SchedulingRules = {
  reserveGames: true,
  allowDoubleLessons: true,
  preventSameSubjectConsecutive: false,
  limitTeacherLoadPerDay: 0,
  spreadPracticals: true,
  lockAssemblies: false,
  respectTeacherAvailability: true,
};

export const TIMETABLE_TEMPLATES: TimetableTemplate[] = [
  {
    id: 'cbc-lower',
    name: 'CBC Lower Primary',
    description: 'Grades 1–3 · 9 slots · early dismissal after lunch',
    startTime: '08:00',
    lessonDurationMin: 30,
    shortBreakMin: 15,
    longBreakMin: 20,
    lunchMin: 40,
    periodsPerDay: 9,
    breaks: [
      { slot: 3, type: 'short', label: 'SHORT BREAK' },
      { slot: 6, type: 'long',  label: 'LONG BREAK' },
      { slot: 9, type: 'lunch', label: 'LUNCH' },
    ],
    rules: { ...defaultRules, reserveGames: false },
  },
  {
    id: 'cbc-upper',
    name: 'CBC Upper Primary',
    description: 'Grades 4–6 · 11 slots · games last two periods',
    startTime: '07:45',
    lessonDurationMin: 35,
    shortBreakMin: 20,
    longBreakMin: 20,
    lunchMin: 40,
    periodsPerDay: 11,
    breaks: [
      { slot: 3, type: 'short', label: 'SHORT BREAK' },
      { slot: 6, type: 'long',  label: 'LONG BREAK' },
      { slot: 9, type: 'lunch', label: 'LUNCH' },
    ],
    rules: { ...defaultRules },
  },
  {
    id: 'cbc-junior',
    name: 'Junior School',
    description: 'Grades 7–9 · 11 slots · longer lessons',
    startTime: '07:30',
    lessonDurationMin: 40,
    shortBreakMin: 20,
    longBreakMin: 20,
    lunchMin: 45,
    periodsPerDay: 11,
    breaks: [
      { slot: 3, type: 'short', label: 'SHORT BREAK' },
      { slot: 6, type: 'long',  label: 'LONG BREAK' },
      { slot: 9, type: 'lunch', label: 'LUNCH' },
    ],
    rules: { ...defaultRules, preventSameSubjectConsecutive: true },
  },
];

export const DEFAULT_RULES = defaultRules;

// Pure helper — computes per-slot start/end based on the visual config.
export function computePeriodTimes(opts: {
  startTime: string;
  periodsPerDay: number;
  lessonDurationMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  lunchMin: number;
  breaks: BreakSlot[];
}): Array<{ start: string; end: string }> {
  const [h, m] = (opts.startTime || '07:30').split(':').map(Number);
  let cur = (isNaN(h) ? 7 : h) * 60 + (isNaN(m) ? 30 : m);
  const fmt = (mins: number) => {
    const hh = Math.floor(mins / 60) % 24;
    const mm = mins % 60;
    return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
  };
  const breakBySlot = new Map(opts.breaks.map(b => [b.slot, b]));
  const out: Array<{ start: string; end: string }> = [];
  for (let s = 1; s <= opts.periodsPerDay; s++) {
    const br = breakBySlot.get(s);
    let dur = opts.lessonDurationMin;
    if (br) {
      dur = br.type === 'lunch' ? opts.lunchMin
          : br.type === 'long' ? opts.longBreakMin
          : opts.shortBreakMin;
    }
    const start = cur;
    const end = cur + dur;
    out.push({ start: fmt(start), end: fmt(end) });
    cur = end;
  }
  return out;
}
