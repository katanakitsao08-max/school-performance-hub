import * as XLSX from 'xlsx';
import type { TimetableSlot } from './timetable-engine';

interface ExcelOpts {
  schoolName: string;
  title: string;
  days: string[];
  periodsPerDay: number;
  breakPeriods?: number[];
  grid: TimetableSlot[][];
  showTeacher?: boolean;
}

/** Build a single sheet array-of-arrays for one timetable. */
function buildSheet(opts: ExcelOpts): any[][] {
  const breaks = new Set(opts.breakPeriods || []);
  const titleRow = [`${opts.schoolName.toUpperCase()} — ${opts.title}`];
  const headerRow: string[] = ['Day'];
  for (let p = 1; p <= opts.periodsPerDay; p++) {
    headerRow.push(breaks.has(p) ? 'BREAK' : `P${p}`);
  }
  const body = opts.days.map((d, di) => {
    const row: string[] = [d];
    for (let p = 0; p < opts.periodsPerDay; p++) {
      const cell = opts.grid[di]?.[p];
      if (cell?.isBreak) row.push('BREAK');
      else if (cell?.isLocked) row.push(cell.lockedLabel || 'LOCKED');
      else if (cell?.learningAreaName) {
        const subject = cell.learningAreaName;
        const teacher = opts.showTeacher && cell.teacherName ? ` (${cell.teacherName})` : '';
        row.push(`${subject}${teacher}`);
      } else row.push('');
    }
    return row;
  });
  return [titleRow, [], headerRow, ...body];
}

export function exportTimetableExcel(opts: ExcelOpts) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(buildSheet(opts));
  ws['!cols'] = [{ wch: 12 }, ...Array(opts.periodsPerDay).fill({ wch: 22 })];
  XLSX.utils.book_append_sheet(wb, ws, 'Timetable');
  XLSX.writeFile(wb, `${opts.title.replace(/\s+/g, '_')}.xlsx`);
}

/** Multi-sheet export (one tab per class). */
export function exportTimetableExcelMulti(
  schoolName: string,
  workbookTitle: string,
  sheets: Array<{ name: string; opts: Omit<ExcelOpts, 'schoolName'> }>,
) {
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, opts }) => {
    const ws = XLSX.utils.aoa_to_sheet(buildSheet({ ...opts, schoolName }));
    ws['!cols'] = [{ wch: 12 }, ...Array(opts.periodsPerDay).fill({ wch: 22 })];
    XLSX.utils.book_append_sheet(wb, ws, name.substring(0, 31));
  });
  XLSX.writeFile(wb, `${workbookTitle.replace(/\s+/g, '_')}.xlsx`);
}
