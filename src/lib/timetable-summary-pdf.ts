import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { TimetableSlot } from './timetable-engine';
import { shortSubjectCode, teacherShort } from './timetable-abbrev';

interface ClassRow {
  grade: string;
  stream: string;
  grid: TimetableSlot[][]; // [day][period]
}

interface SummaryPdfOpts {
  schoolName: string;
  schoolSubtitle?: string;
  days: string[];
  periodsPerDay: number;
  breakPeriods?: number[];
  /** Optional labels for the breaks, in order of breakPeriods (e.g. ["SHORT BREAK","LONG BREAK","LUNCH"]) */
  breakLabels?: string[];
  classes: ClassRow[];
}

/**
 * ASc-style "Summary timetable of all classes" — landscape, one row per class,
 * all 5 days side-by-side, breaks rendered as labelled vertical separator columns.
 * Each cell shows the SUBJECT CODE on top and teacher's surname beneath.
 */
export function exportTimetableSummaryPdf(opts: SummaryPdfOpts) {
  const { schoolName, schoolSubtitle, days, periodsPerDay, classes } = opts;
  const breaks = (opts.breakPeriods || []).slice().sort((a, b) => a - b);
  const breakLabels = opts.breakLabels && opts.breakLabels.length > 0
    ? opts.breakLabels
    : breaks.map((_, i) =>
        breaks.length === 1 ? 'BREAK'
        : i === 0 ? 'SHORT BREAK'
        : i === breaks.length - 1 ? 'LUNCH'
        : 'LONG BREAK',
      );
  const breakLabelByPeriod = new Map<number, string>();
  breaks.forEach((p, i) => breakLabelByPeriod.set(p, breakLabels[i] || 'BREAK'));

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // ── Header ───────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(0);
  doc.text(schoolName.toUpperCase(), pageW / 2, 14, { align: 'center' });
  if (schoolSubtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(schoolSubtitle, pageW / 2, 19, { align: 'center' });
  }
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(10);
  doc.text('Summary timetable of all classes', pageW - 12, 19, { align: 'right' });

  // ── Build header rows ────────────────────────────────────────────────────
  // Row 1: "Class" | DAY (colSpan) | DAY (colSpan) ...
  // Row 2: blank  | period numbers + break labels (rotated)
  // Each non-break period = 1 col; each break = 1 narrow col.
  type ColDef = { kind: 'period' | 'break'; period: number; breakLabel?: string };
  const colsPerDay: ColDef[] = [];
  for (let p = 1; p <= periodsPerDay; p++) {
    if (breakLabelByPeriod.has(p)) {
      colsPerDay.push({ kind: 'break', period: p, breakLabel: breakLabelByPeriod.get(p) });
    } else {
      colsPerDay.push({ kind: 'period', period: p });
    }
  }
  const totalDayCols = colsPerDay.length;

  const headRow1: any[] = [
    { content: 'Class', rowSpan: 2, styles: { fillColor: [255, 255, 255], halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 11 } },
  ];
  days.forEach(d => {
    headRow1.push({
      content: d,
      colSpan: totalDayCols,
      styles: { fillColor: [255, 255, 255], halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 14 },
    });
  });

  const headRow2: any[] = [];
  // Number visible periods sequentially per day (1..n) like ASc
  days.forEach(() => {
    let visiblePeriod = 0;
    colsPerDay.forEach(c => {
      if (c.kind === 'period') {
        visiblePeriod += 1;
        headRow2.push({
          content: String(visiblePeriod),
          styles: { fillColor: [255, 255, 255], halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 11 },
        });
      } else {
        // Rotated break label column
        headRow2.push({
          content: c.breakLabel || 'BREAK',
          styles: {
            fillColor: [255, 255, 255],
            halign: 'center',
            valign: 'middle',
            fontStyle: 'bold',
            fontSize: 7,
            // jsPDF-autotable supports cell rotation via `angle`
            angle: 90,
            textColor: 0,
          },
        });
      }
    });
  });

  // ── Build body ───────────────────────────────────────────────────────────
  const body = classes.map(c => {
    const row: any[] = [
      {
        content: `${c.grade}${c.stream ? ' ' + c.stream : ''}`,
        styles: { fillColor: [245, 245, 245], halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 12 },
      },
    ];
    days.forEach((_d, di) => {
      colsPerDay.forEach(col => {
        if (col.kind === 'break') {
          row.push({
            content: '',
            styles: { fillColor: [240, 240, 240] },
          });
          return;
        }
        const slot = c.grid[di]?.[col.period - 1];
        if (!slot || (!slot.learningAreaName && !slot.isLocked)) {
          row.push({ content: '', styles: { fillColor: [255, 255, 255] } });
          return;
        }
        if (slot.isLocked) {
          row.push({
            content: (slot.lockedLabel || 'LOCKED').toUpperCase(),
            styles: { fillColor: [255, 248, 225], halign: 'center', valign: 'middle', fontSize: 6, fontStyle: 'bold', textColor: 90 },
          });
          return;
        }
        const code = shortSubjectCode(slot.learningAreaName);
        const teacher = teacherShort(slot.teacherName);
        row.push({
          content: teacher ? `${code}\n${teacher}` : code,
          styles: { halign: 'center', valign: 'middle', fontSize: 6.5, textColor: 0, cellPadding: 0.4 },
        });
      });
    });
    return row;
  });

  // ── Column widths ────────────────────────────────────────────────────────
  const margin = 8;
  const classColW = 14;
  const usableW = pageW - margin * 2 - classColW;
  const periodCount = colsPerDay.filter(c => c.kind === 'period').length;
  const breakCount = colsPerDay.filter(c => c.kind === 'break').length;
  const breakColW = 5;
  const periodColW = (usableW - breakColW * breakCount * days.length) / (periodCount * days.length);

  const columnStyles: Record<number, any> = { 0: { cellWidth: classColW } };
  let colIdx = 1;
  days.forEach(() => {
    colsPerDay.forEach(c => {
      columnStyles[colIdx] = {
        cellWidth: c.kind === 'break' ? breakColW : Math.max(periodColW, 7),
      };
      colIdx += 1;
    });
  });

  autoTable(doc, {
    startY: 24,
    head: [headRow1, headRow2],
    body,
    theme: 'grid',
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 6.5,
      cellPadding: 0.6,
      halign: 'center',
      valign: 'middle',
      textColor: 0,
      lineColor: [80, 80, 80],
      lineWidth: 0.15,
      minCellHeight: 12,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: 0,
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
    },
    columnStyles,
  });

  // ── Footer ───────────────────────────────────────────────────────────────
  const finalY = (doc as any).lastAutoTable.finalY || pageH - 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80);
  doc.text(`Timetable generated: ${new Date().toLocaleDateString()}`, margin, Math.min(finalY + 5, pageH - 6));
  doc.text('PerformTrack', pageW - margin, Math.min(finalY + 5, pageH - 6), { align: 'right' });

  doc.save(`${schoolName.replace(/\s+/g, '_')}_Summary_Timetable.pdf`);
}
