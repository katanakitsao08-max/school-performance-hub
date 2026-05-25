// ASC-style timetable auto-scheduling engine
// Teachers are NEVER assigned directly — they are derived from teacher_assignments
// (subject + grade + stream). Engine balances workload and detects conflicts.

export interface SubjectRequirement {
  learningAreaId: string;
  learningAreaName: string;
  lessonsPerWeek: number;
  /** Periods per lesson (1 = single, 2 = double, etc.). Default 1. */
  length?: number;
  /** Optional teacher override (overrides teacher_assignments pool). */
  preferredTeacherId?: string;
  /** Optional classroom label (rendered in cell). */
  classroom?: string;
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

export interface TeacherUnavailable {
  teacher_id: string;
  day: string;             // 'Monday' or '*' for every day
  period: number;          // 1-indexed
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
  // Advanced rules (all optional / additive)
  maxLessonsPerDayPerSubject?: number;     // cap same-subject lessons in a day per class
  allowDoubleLessons?: boolean;            // allow back-to-back same subject
  teacherUnavailable?: TeacherUnavailable[]; // per-teacher blackout slots
  /** Per-class hard cap on the highest slot number a teaching lesson may occupy (1-indexed). */
  maxPeriodByClass?: Record<string, number>;
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

  // Track how many times a subject has started at each period (per class) to rotate start times
  // Key: `${classKey}::${learningAreaId}::${period}` => count
  const subjectPeriodUse: Record<string, number> = {};
  // Also track which days a subject has been placed in (per class) to spread across week
  const subjectDayUse: Record<string, Set<number>> = {};

  for (const lesson of lessonsToPlace) {
    const grid = grids[lesson.classKey];
    const fullPool = teacherPool[`${lesson.classKey}::${lesson.req.learningAreaId}`] || [];
    // If a preferred teacher override is set on the requirement, restrict pool to that teacher.
    const pool = lesson.req.preferredTeacherId
      ? fullPool.filter(t => t.teacher_id === lesson.req.preferredTeacherId)
      : fullPool;
    const lessonLen = Math.max(1, lesson.req.length || 1);
    const maxPeriodCap = opts.maxPeriodByClass?.[lesson.classKey] ?? periodsPerDay;

    if (pool.length === 0) {
      unfilled.push(`${lesson.classKey} — ${lesson.req.learningAreaName}: no teacher assigned`);
      continue;
    }

    const subjKey = `${lesson.classKey}::${lesson.req.learningAreaId}`;
    if (!subjectDayUse[subjKey]) subjectDayUse[subjKey] = new Set();

    let placed = false;
    const candidates: { d: number; p: number; score: number }[] = [];
    for (let d = 0; d < days.length; d++) {
      // Enforce max lessons per day per subject (per class)
      if (opts.maxLessonsPerDayPerSubject && opts.maxLessonsPerDayPerSubject > 0) {
        const sameSubjCount = grid[d].filter(s => s.learningAreaId === lesson.req.learningAreaId).length;
        if (sameSubjCount >= opts.maxLessonsPerDayPerSubject) continue;
      }
      for (let p = 0; p + lessonLen <= periodsPerDay; p++) {
        // Hard cap: lesson must finish at or before maxPeriodCap (1-indexed slot number)
        if (p + lessonLen > maxPeriodCap) break;
        // All `lessonLen` consecutive slots must be free, non-break, non-locked
        let ok = true;
        for (let k = 0; k < lessonLen; k++) {
          const slot = grid[d][p + k];
          if (slot.isBreak || slot.isLocked || slot.learningAreaId) { ok = false; break; }
        }
        if (!ok) continue;
        // Block back-to-back same subject if double lessons disabled (only for length=1)
        if (lessonLen === 1 && opts.allowDoubleLessons === false) {
          const prev = p > 0 ? grid[d][p - 1] : null;
          const next = p < periodsPerDay - 1 ? grid[d][p + 1] : null;
          if (prev?.learningAreaId === lesson.req.learningAreaId) continue;
          if (next?.learningAreaId === lesson.req.learningAreaId) continue;
        }
        const sameDay = grid[d].some((s) => s.learningAreaId === lesson.req.learningAreaId);
        const periodUseCount = subjectPeriodUse[`${subjKey}::${p}`] || 0;
        const dayAlreadyUsed = subjectDayUse[subjKey].has(d);
        const score =
          (sameDay ? 100 : 0) +
          (dayAlreadyUsed ? 50 : 0) +
          periodUseCount * 10 +
          Math.random() * 0.5;
        candidates.push({ d, p, score });
      }
    }
    candidates.sort((a, b) => a.score - b.score);

    // Pre-compute teacher unavailability set
    const unavailableSet = new Set<string>();
    (opts.teacherUnavailable || []).forEach(u => {
      const dayList = u.day === '*' ? days : [u.day];
      dayList.forEach(d => unavailableSet.add(`${u.teacher_id}::${d}:${u.period}`));
    });

    for (const c of candidates) {
      const sortedPool = [...pool].sort(
        (x, y) => (teacherLoad[x.teacher_id] || 0) - (teacherLoad[y.teacher_id] || 0),
      );
      // Teacher must be free for ALL `lessonLen` consecutive slots
      const teacher = sortedPool.find((t) => {
        for (let k = 0; k < lessonLen; k++) {
          const sk = `${days[c.d]}:${c.p + 1 + k}`;
          if (teacherBusy[t.teacher_id]?.has(sk)) return false;
          if (unavailableSet.has(`${t.teacher_id}::${sk}`)) return false;
        }
        return true;
      });
      if (!teacher) continue;

      for (let k = 0; k < lessonLen; k++) {
        const periodNo = c.p + 1 + k;
        grid[c.d][c.p + k] = {
          day: days[c.d],
          period: periodNo,
          learningAreaId: lesson.req.learningAreaId,
          learningAreaName: lesson.req.classroom
            ? `${lesson.req.learningAreaName} [${lesson.req.classroom}]`
            : lesson.req.learningAreaName,
          teacherId: teacher.teacher_id,
          teacherName: teacher.teacher_name,
        };
        const slotKey = `${days[c.d]}:${periodNo}`;
        if (!teacherBusy[teacher.teacher_id]) teacherBusy[teacher.teacher_id] = new Set();
        teacherBusy[teacher.teacher_id].add(slotKey);
        teacherLoad[teacher.teacher_id] = (teacherLoad[teacher.teacher_id] || 0) + 1;
      }
      subjectPeriodUse[`${subjKey}::${c.p}`] = (subjectPeriodUse[`${subjKey}::${c.p}`] || 0) + 1;
      subjectDayUse[subjKey].add(c.d);
      placed = true;
      break;
    }

    if (!placed) {
      unfilled.push(`${lesson.classKey} — ${lesson.req.learningAreaName}: no free slot/teacher`);
    }
  }

  // ── Backfill pass: fill any remaining empty teaching slots ───────────────
  // For each empty (non-break, non-locked, empty) cell in every class,
  // try ANY subject from that class's requirements whose teacher is free.
  // This guarantees no gaps while still preventing teacher double-booking.
  const unavailableSetGlobal = new Set<string>();
  (opts.teacherUnavailable || []).forEach(u => {
    const dayList = u.day === '*' ? days : [u.day];
    dayList.forEach(d => unavailableSetGlobal.add(`${u.teacher_id}::${d}:${u.period}`));
  });
  for (const ck of Object.keys(grids)) {
    const grid = grids[ck];
    const reqs = requirementsByClass[ck] || [];
    const maxPeriodCap = opts.maxPeriodByClass?.[ck] ?? periodsPerDay;
    for (let d = 0; d < days.length; d++) {
      for (let p = 0; p < periodsPerDay; p++) {
        if (p + 1 > maxPeriodCap) break;
        const slot = grid[d][p];
        if (slot.isBreak || slot.isLocked || slot.learningAreaId) continue;
        // Find a subject + free teacher
        const shuffled = [...reqs].sort(() => Math.random() - 0.5);
        let filled = false;
        for (const r of shuffled) {
          const fullPool = teacherPool[`${ck}::${r.learningAreaId}`] || [];
          const pool = r.preferredTeacherId
            ? fullPool.filter(t => t.teacher_id === r.preferredTeacherId)
            : fullPool;
          if (pool.length === 0) continue;
          // Avoid back-to-back same subject (visual spread)
          const prev = p > 0 ? grid[d][p - 1] : null;
          const next = p < periodsPerDay - 1 ? grid[d][p + 1] : null;
          if (prev?.learningAreaId === r.learningAreaId || next?.learningAreaId === r.learningAreaId) continue;
          const sortedPool = [...pool].sort(
            (x, y) => (teacherLoad[x.teacher_id] || 0) - (teacherLoad[y.teacher_id] || 0),
          );
          const teacher = sortedPool.find(t => {
            const sk = `${days[d]}:${p + 1}`;
            if (teacherBusy[t.teacher_id]?.has(sk)) return false;
            if (unavailableSetGlobal.has(`${t.teacher_id}::${sk}`)) return false;
            return true;
          });
          if (!teacher) continue;
          grid[d][p] = {
            day: days[d],
            period: p + 1,
            learningAreaId: r.learningAreaId,
            learningAreaName: r.classroom ? `${r.learningAreaName} [${r.classroom}]` : r.learningAreaName,
            teacherId: teacher.teacher_id,
            teacherName: teacher.teacher_name,
          };
          const slotKey = `${days[d]}:${p + 1}`;
          if (!teacherBusy[teacher.teacher_id]) teacherBusy[teacher.teacher_id] = new Set();
          teacherBusy[teacher.teacher_id].add(slotKey);
          teacherLoad[teacher.teacher_id] = (teacherLoad[teacher.teacher_id] || 0) + 1;
          filled = true;
          break;
        }
        // If still empty after trying same-class requirements, allow any subject
        // for which the class has a teacher assignment at all (relaxed: drop back-to-back rule)
        if (!filled) {
          for (const r of shuffled) {
            const fullPool = teacherPool[`${ck}::${r.learningAreaId}`] || [];
            const pool = r.preferredTeacherId
              ? fullPool.filter(t => t.teacher_id === r.preferredTeacherId)
              : fullPool;
            if (pool.length === 0) continue;
            const sortedPool = [...pool].sort(
              (x, y) => (teacherLoad[x.teacher_id] || 0) - (teacherLoad[y.teacher_id] || 0),
            );
            const teacher = sortedPool.find(t => {
              const sk = `${days[d]}:${p + 1}`;
              if (teacherBusy[t.teacher_id]?.has(sk)) return false;
              if (unavailableSetGlobal.has(`${t.teacher_id}::${sk}`)) return false;
              return true;
            });
            if (!teacher) continue;
            grid[d][p] = {
              day: days[d],
              period: p + 1,
              learningAreaId: r.learningAreaId,
              learningAreaName: r.classroom ? `${r.learningAreaName} [${r.classroom}]` : r.learningAreaName,
              teacherId: teacher.teacher_id,
              teacherName: teacher.teacher_name,
            };
            const slotKey = `${days[d]}:${p + 1}`;
            if (!teacherBusy[teacher.teacher_id]) teacherBusy[teacher.teacher_id] = new Set();
            teacherBusy[teacher.teacher_id].add(slotKey);
            teacherLoad[teacher.teacher_id] = (teacherLoad[teacher.teacher_id] || 0) + 1;
            break;
          }
        }
      }
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
