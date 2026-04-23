import type { TimetableSlot } from '@/lib/timetable-engine';
import { shortSubjectCode, teacherShort } from '@/lib/timetable-abbrev';

interface ClassRow {
  grade: string;
  stream: string;
  grid: TimetableSlot[][];
}

interface Props {
  schoolName: string;
  days: string[];
  periodsPerDay: number;
  breakPeriods?: number[];
  breakLabels?: string[];
  classes: ClassRow[];
}

/**
 * On-screen ASc-style summary of all classes — rows = classes, all 5 days side-by-side.
 * Each cell shows SUBJECT CODE on top + teacher surname beneath. Breaks render as
 * narrow vertical separator columns with rotated labels.
 */
export function SummaryAllClassesView({
  schoolName, days, periodsPerDay, classes,
  breakPeriods = [], breakLabels,
}: Props) {
  const breaks = [...breakPeriods].sort((a, b) => a - b);
  const labels = breakLabels && breakLabels.length > 0
    ? breakLabels
    : breaks.map((_, i) =>
        breaks.length === 1 ? 'BREAK'
        : i === 0 ? 'SHORT BREAK'
        : i === breaks.length - 1 ? 'LUNCH'
        : 'LONG BREAK',
      );
  const breakLabelByPeriod = new Map<number, string>();
  breaks.forEach((p, i) => breakLabelByPeriod.set(p, labels[i] || 'BREAK'));

  type ColDef = { kind: 'period' | 'break'; period: number; breakLabel?: string };
  const colsPerDay: ColDef[] = [];
  for (let p = 1; p <= periodsPerDay; p++) {
    if (breakLabelByPeriod.has(p)) {
      colsPerDay.push({ kind: 'break', period: p, breakLabel: breakLabelByPeriod.get(p) });
    } else {
      colsPerDay.push({ kind: 'period', period: p });
    }
  }

  return (
    <div className="overflow-x-auto border rounded-md bg-card">
      <div className="text-center py-3 px-2 border-b">
        <div className="text-xl font-bold tracking-wide uppercase">{schoolName}</div>
        <div className="text-xs text-muted-foreground italic">Summary timetable of all classes</div>
      </div>
      <table className="border-collapse text-[10px] min-w-max">
        <thead>
          <tr>
            <th rowSpan={2} className="border border-foreground/40 px-2 py-1 font-bold bg-muted text-center align-middle min-w-[42px]">
              Class
            </th>
            {days.map(d => (
              <th key={d} colSpan={colsPerDay.length} className="border border-foreground/40 px-2 py-1 font-bold text-center bg-muted">
                {d}
              </th>
            ))}
          </tr>
          <tr>
            {days.flatMap((_d, di) => {
              let visible = 0;
              return colsPerDay.map((c, ci) => {
                if (c.kind === 'period') {
                  visible += 1;
                  return (
                    <th key={`${di}-${ci}`} className="border border-foreground/40 px-1 py-0.5 font-semibold text-center bg-muted/60 min-w-[34px]">
                      {visible}
                    </th>
                  );
                }
                return (
                  <th
                    key={`${di}-${ci}`}
                    className="border border-foreground/40 bg-muted/40 align-middle text-center font-semibold"
                    style={{ width: 14, minWidth: 14, maxWidth: 14 }}
                  >
                    <div
                      className="text-[8px] whitespace-nowrap"
                      style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', padding: '4px 0' }}
                    >
                      {c.breakLabel}
                    </div>
                  </th>
                );
              });
            })}
          </tr>
        </thead>
        <tbody>
          {classes.map(c => (
            <tr key={`${c.grade}-${c.stream}`}>
              <td className="border border-foreground/40 px-2 py-1 font-bold text-center bg-muted/40 whitespace-nowrap">
                {c.grade}{c.stream ? ` ${c.stream}` : ''}
              </td>
              {days.flatMap((_d, di) =>
                colsPerDay.map((col, ci) => {
                  if (col.kind === 'break') {
                    return <td key={`${di}-${ci}`} className="border border-foreground/40 bg-muted/30" />;
                  }
                  const slot = c.grid[di]?.[col.period - 1];
                  if (!slot || (!slot.learningAreaName && !slot.isLocked)) {
                    return <td key={`${di}-${ci}`} className="border border-foreground/40" />;
                  }
                  if (slot.isLocked) {
                    return (
                      <td key={`${di}-${ci}`} className="border border-foreground/40 text-center bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 font-semibold text-[8px] px-0.5">
                        {(slot.lockedLabel || 'LOCKED').toUpperCase()}
                      </td>
                    );
                  }
                  const code = shortSubjectCode(slot.learningAreaName);
                  const teacher = teacherShort(slot.teacherName);
                  return (
                    <td key={`${di}-${ci}`} className="border border-foreground/40 text-center px-0.5 py-0.5 align-middle leading-tight">
                      <div className="font-bold text-[9px]">{code}</div>
                      {teacher && <div className="text-[7px] text-muted-foreground">{teacher}</div>}
                    </td>
                  );
                }),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
