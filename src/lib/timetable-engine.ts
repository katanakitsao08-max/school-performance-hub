// ASC-style timetable auto-scheduling engine
// Teachers are NEVER assigned directly — they are derived from teacher_assignments
// (subject + grade + stream). Engine balances workload and detects conflicts.

export interface SubjectRequirement {
  learningAreaId: string;
  learningAreaName: string;
  lessonsPerWeek: number;
}

export interface TeacherAssignmentRow {
  teacher_id: string;
  teacher_name: string;
  learning_area_id: string;
  grade: string;
  stream: string;
}

export interface TimetableSlot {
  day: string;
  period: number;
  learningAreaId?: string;
  learningAreaName?: string;
  teacherId?: string;
  teacherName?: string;
  isBreak?: boolean;
}

export interface ClassKey {
  grade: string;
  stream: string;
}

export interface GenerateOptions {
  classes: ClassKey[];                     // classes to schedule
  days: string[];                          // e.g. Mon-Fri
  periodsPerDay: number;                   // total period columns
  breakPeriod?: number;                    // 1-indexed period that is the break
  requirementsByClass: Record<string, SubjectRequirement[]>; // key = `${grade}|${stream}`
  assignments: TeacherAssignmentRow[];     // teacher pool from teacher_assignments
}

export interface GenerationResult {
  // class key -> 2D grid [day][period]
  grids: Record<string, TimetableSlot[][]>;
  // teacher_id -> 2D grid [day][period]
  teacherGrids: Record<string, { teacherName: string; grid: TimetableSlot[][] }>;
  conflicts: string[];
  unfilled: string[];
}

const classKey = (g: string, s: string) => `${g}|${s}`;

export function generateTimetable(opts: GenerateOptions): GenerationResult {
  const { classes, days, periodsPerDay, breakPeriod, requirementsByClass, assignments } = opts;

  const grids: Record<string, TimetableSlot[][]> = {};
  const teacherBusy: Record<string, Set<string>> = {}; // teacherId -> Set("day:period")
  const teacherLoad: Record<string, number> = {};
  const conflicts: string[] = [];
  const unfilled: string[] = [];

  // init empty grids with break column
  for (const c of classes) {
    const k = classKey(c.grade, c.stream);
    grids[k] = days.map((d) =>
      Array.from({ length: periodsPerDay }, (_, p) => ({
        day: d,
        period: p + 1,
        isBreak: breakPeriod ? p + 1 === breakPeriod : false,
      })),
    );
  }

  // Build assignment lookup: classKey + learningAreaId -> teacher pool
  const teacherPool: Record<string, TeacherAssignmentRow[]> = {};
  for (const a of assignments) {
    const k = `${classKey(a.grade, a.stream)}::${a.learning_area_id}`;
    if (!teacherPool[k]) teacherPool[k] = [];
    teacherPool[k].push(a);
  }

  // Build flat list of lessons to place per class (subject repeated lessonsPerWeek times)
  type Lesson = { classKey: string; req: SubjectRequirement };
  const lessonsToPlace: Lesson[] = [];
  for (const c of classes) {
    const k = classKey(c.grade, c.stream);
    const reqs = requirementsByClass[k] || [];
    for (const r of reqs) {
      for (let i = 0; i < r.lessonsPerWeek; i++) {
        lessonsToPlace.push({ classKey: k, req: r });
      }
    }
  }

  // Sort: subjects with more lessons first (harder to place)
  lessonsToPlace.sort((a, b) => b.req.lessonsPerWeek - a.req.lessonsPerWeek);

  // Place each lesson
  for (const lesson of lessonsToPlace) {
    const grid = grids[lesson.classKey];
    const pool = teacherPool[`${lesson.classKey}::${lesson.req.learningAreaId}`] || [];

    if (pool.length === 0) {
      unfilled.push(`${lesson.classKey} — ${lesson.req.learningAreaName}: no teacher assigned`);
      continue;
    }

    // Try every (day, period) — prefer slots not already used by same subject same day
    let placed = false;
    const candidates: { d: number; p: number; score: number }[] = [];
    for (let d = 0; d < days.length; d++) {
      for (let p = 0; p < periodsPerDay; p++) {
        const slot = grid[d][p];
        if (slot.isBreak || slot.learningAreaId) continue;
        // avoid same subject twice on same day
        const sameDay = grid[d].some((s) => s.learningAreaId === lesson.req.learningAreaId);
        candidates.push({ d, p, score: sameDay ? 1 : 0 });
      }
    }
    candidates.sort((a, b) => a.score - b.score);

    for (const c of candidates) {
      // pick least-loaded teacher who is free at this slot
      const sortedPool = [...pool].sort(
        (x, y) => (teacherLoad[x.teacher_id] || 0) - (teacherLoad[y.teacher_id] || 0),
      );
      const slotKey = `${days[c.d]}:${c.p + 1}`;
      const teacher = sortedPool.find((t) => !(teacherBusy[t.teacher_id]?.has(slotKey)));
      if (!teacher) continue;

      grid[c.d][c.p] = {
        day: days[c.d],
        period: c.p + 1,
        learningAreaId: lesson.req.learningAreaId,
        learningAreaName: lesson.req.learningAreaName,
        teacherId: teacher.teacher_id,
        teacherName: teacher.teacher_name,
      };
      if (!teacherBusy[teacher.teacher_id]) teacherBusy[teacher.teacher_id] = new Set();
      teacherBusy[teacher.teacher_id].add(slotKey);
      teacherLoad[teacher.teacher_id] = (teacherLoad[teacher.teacher_id] || 0) + 1;
      placed = true;
      break;
    }

    if (!placed) {
      unfilled.push(`${lesson.classKey} — ${lesson.req.learningAreaName}: no free slot/teacher`);
    }
  }

  // Build per-teacher grids
  const teacherGrids: Record<string, { teacherName: string; grid: TimetableSlot[][] }> = {};
  for (const k of Object.keys(grids)) {
    const [grade, stream] = k.split('|');
    grids[k].forEach((row, di) => {
      row.forEach((cell, pi) => {
        if (!cell.teacherId) return;
        if (!teacherGrids[cell.teacherId]) {
          teacherGrids[cell.teacherId] = {
            teacherName: cell.teacherName || 'Teacher',
            grid: days.map((d) =>
              Array.from({ length: periodsPerDay }, (_, p) => ({
                day: d,
                period: p + 1,
                isBreak: breakPeriod ? p + 1 === breakPeriod : false,
              })),
            ),
          };
        }
        const tcell = teacherGrids[cell.teacherId].grid[di][pi];
        if (tcell.learningAreaId) {
          conflicts.push(
            `Teacher ${cell.teacherName} double-booked at ${days[di]} P${pi + 1}`,
          );
        }
        teacherGrids[cell.teacherId].grid[di][pi] = {
          ...tcell,
          learningAreaId: cell.learningAreaId,
          learningAreaName: `${cell.learningAreaName} (${grade} ${stream})`,
          teacherId: cell.teacherId,
          teacherName: cell.teacherName,
        };
      });
    });
  }

  return { grids, teacherGrids, conflicts, unfilled };
}

export function generateActivationKey(): string {
  const seg = () =>
    Math.random().toString(36).slice(2, 6).toUpperCase();
  return `TT-${seg()}-${seg()}-${seg()}`;
}
