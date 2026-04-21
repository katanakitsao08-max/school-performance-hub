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
  isLocked?: boolean;
  lockedLabel?: string;
}

export interface ClassKey {
  grade: string;
  stream: string;
}

export interface LockedSlot {
  classKey: string;        // `${grade}|${stream}` or '*' for all classes
  day: string;             // e.g. 'Monday' or '*' for every day
  period: number;          // 1-indexed
  label: string;           // e.g. 'Assembly', 'Pastoral'
}

export interface GenerateOptions {
  classes: ClassKey[];
  days: string[];
  periodsPerDay: number;
  breakPeriod?: number;            // legacy: single break
  breakPeriods?: number[];         // NEW: multiple breaks (1-indexed)
  lockedSlots?: LockedSlot[];      // NEW: fixed periods (assembly etc.)
  requirementsByClass: Record<string, SubjectRequirement[]>;
  assignments: TeacherAssignmentRow[];
}

export interface GenerationResult {
  grids: Record<string, TimetableSlot[][]>;
  teacherGrids: Record<string, { teacherName: string; grid: TimetableSlot[][]; lessonCount: number }>;
  conflicts: string[];
  unfilled: string[];
}

const classKey = (g: string, s: string) => `${g}|${s}`;

export function generateTimetable(opts: GenerateOptions): GenerationResult {
  const { classes, days, periodsPerDay, requirementsByClass, assignments } = opts;

  // Merge legacy single + new array
  const breaks = new Set<number>();
  if (opts.breakPeriod) breaks.add(opts.breakPeriod);
  (opts.breakPeriods || []).forEach(b => breaks.add(b));

  const grids: Record<string, TimetableSlot[][]> = {};
  const teacherBusy: Record<string, Set<string>> = {};
  const teacherLoad: Record<string, number> = {};
  const conflicts: string[] = [];
  const unfilled: string[] = [];

  // init empty grids — apply breaks + locked slots
  for (const c of classes) {
    const k = classKey(c.grade, c.stream);
    grids[k] = days.map((d) =>
      Array.from({ length: periodsPerDay }, (_, p) => ({
        day: d,
        period: p + 1,
        isBreak: breaks.has(p + 1),
      })),
    );
  }

  // Apply locked slots
  (opts.lockedSlots || []).forEach(lock => {
    const targetClasses = lock.classKey === '*'
      ? Object.keys(grids)
      : [lock.classKey].filter(k => grids[k]);
    targetClasses.forEach(ck => {
      days.forEach((d, di) => {
        if (lock.day !== '*' && lock.day !== d) return;
        const slot = grids[ck][di][lock.period - 1];
        if (!slot) return;
        grids[ck][di][lock.period - 1] = {
          ...slot,
          isLocked: true,
          lockedLabel: lock.label,
          learningAreaName: lock.label,
        };
      });
    });
  });

  // teacher pool lookup
  const teacherPool: Record<string, TeacherAssignmentRow[]> = {};
  for (const a of assignments) {
    const k = `${classKey(a.grade, a.stream)}::${a.learning_area_id}`;
    if (!teacherPool[k]) teacherPool[k] = [];
    teacherPool[k].push(a);
  }

  // flat lessons list
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

  lessonsToPlace.sort((a, b) => b.req.lessonsPerWeek - a.req.lessonsPerWeek);

  for (const lesson of lessonsToPlace) {
    const grid = grids[lesson.classKey];
    const pool = teacherPool[`${lesson.classKey}::${lesson.req.learningAreaId}`] || [];

    if (pool.length === 0) {
      unfilled.push(`${lesson.classKey} — ${lesson.req.learningAreaName}: no teacher assigned`);
      continue;
    }

    let placed = false;
    const candidates: { d: number; p: number; score: number }[] = [];
    for (let d = 0; d < days.length; d++) {
      for (let p = 0; p < periodsPerDay; p++) {
        const slot = grid[d][p];
        if (slot.isBreak || slot.isLocked || slot.learningAreaId) continue;
        const sameDay = grid[d].some((s) => s.learningAreaId === lesson.req.learningAreaId);
        candidates.push({ d, p, score: sameDay ? 1 : 0 });
      }
    }
    candidates.sort((a, b) => a.score - b.score);

    for (const c of candidates) {
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
  const teacherGrids: Record<string, { teacherName: string; grid: TimetableSlot[][]; lessonCount: number }> = {};
  for (const k of Object.keys(grids)) {
    const [grade, stream] = k.split('|');
    grids[k].forEach((row, di) => {
      row.forEach((cell, pi) => {
        if (!cell.teacherId) return;
        if (!teacherGrids[cell.teacherId]) {
          teacherGrids[cell.teacherId] = {
            teacherName: cell.teacherName || 'Teacher',
            lessonCount: 0,
            grid: days.map((d) =>
              Array.from({ length: periodsPerDay }, (_, p) => ({
                day: d,
                period: p + 1,
                isBreak: breaks.has(p + 1),
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
        teacherGrids[cell.teacherId].lessonCount += 1;
      });
    });
  }

  return { grids, teacherGrids, conflicts, unfilled };
}

export function generateActivationKey(): string {
  const seg = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `TT-${seg()}-${seg()}-${seg()}`;
}
