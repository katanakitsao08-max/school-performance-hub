import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { TimetableSlot } from './timetable-engine';

interface PdfOpts {
  schoolName: string;
  title: string;
  subtitle?: string;
  days: string[];
  periodsPerDay: number;
  breakPeriod?: number;
  breakPeriods?: number[];
  grid: TimetableSlot[][];
  showTeacher?: boolean;
  showClass?: boolean;
  preparedBy?: string;
}

// Build column header definitions with BREAK columns labeled clearly.
function buildPeriodHeaders(periodsPerDay: number, breaks: Set<number>) {
  const headers: { label: string; isBreak: boolean; periodNum?: number }[] = [];
  let visiblePeriod = 0;
  for (let p = 1; p <= periodsPerDay; p++) {
    if (breaks.has(p)) {
      headers.push({ label: 'BREAK', isBreak: true });
    } else {
      visiblePeriod += 1;
      headers.push({ label: String(visiblePeriod), isBreak: false, periodNum: visiblePeriod });
    }
  }
  return headers;
}

export function exportTimetablePdf(opts: PdfOpts) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // ── Header band ───────────────────────────────────────────────────────────
  doc.setFillColor(20, 90, 50); // brand green
  doc.rect(0, 0, pageW, 18, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(opts.schoolName.toUpperCase(), pageW / 2, 8, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(opts.title, pageW / 2, 14, { align: 'center' });

  if (opts.subtitle) {
    doc.setTextColor(0);
    doc.setFontSize(9);
    doc.text(opts.subtitle, pageW / 2, 23, { align: 'center' });
  }

  // ── Build table ──────────────────────────────────────────────────────────
  const breaksSet = new Set<number>([
    ...(opts.breakPeriod ? [opts.breakPeriod] : []),
    ...(opts.breakPeriods || []),
  ]);
  const periodHeaders = buildPeriodHeaders(opts.periodsPerDay, breaksSet);

  // Two header rows: top label + period number row (mimicking ASc style)
  const head: any[] = [
    [
      { content: 'Day', rowSpan: 1, styles: { fillColor: [20, 90, 50], textColor: 255, halign: 'center', valign: 'middle', fontStyle: 'bold' } },
      ...periodHeaders.map(h =>
        h.isBreak
          ? { content: 'BREAK', styles: { fillColor: [60, 60, 60], textColor: 255, halign: 'center', valign: 'middle', fontStyle: 'bold' } }
          : { content: `P${h.periodNum}`, styles: { fillColor: [20, 90, 50], textColor: 255, halign: 'center', valign: 'middle', fontStyle: 'bold' } },
      ),
    ],
  ];

  const body = opts.days.map((day, di) => {
    const row: any[] = [
      { content: day, styles: { fillColor: [232, 245, 233], textColor: 20, fontStyle: 'bold', halign: 'center', valign: 'middle' } },
    ];
    for (let p = 0; p < opts.periodsPerDay; p++) {
      const slot = opts.grid[di]?.[p];
      if (slot?.isBreak) {
        row.push({ content: 'BREAK', styles: { fillColor: [240, 240, 240], textColor: 90, halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 7 } });
      } else if (slot?.isLocked) {
        row.push({ content: (slot.lockedLabel || 'LOCKED').toUpperCase(), styles: { fillColor: [255, 243, 224], textColor: 120, halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 7 } });
      } else if (slot?.learningAreaName) {
        // Two-line cell: SUBJECT (bold) on top, teacher beneath
        const subject = slot.learningAreaName.toUpperCase();
        const teacher = opts.showTeacher && slot.teacherName ? slot.teacherName : '';
        const text = teacher ? `${subject}\n${teacher}` : subject;
        row.push({
          content: text,
          styles: { halign: 'center', valign: 'middle', fontSize: 7, textColor: 0 },
        });
      } else {
        row.push({ content: '', styles: { fillColor: [255, 255, 255] } });
      }
    }
    return row;
  });

  // Compute column widths: Day col fixed, the rest split evenly
  const dayColW = 22;
  const remainingW = pageW - 20 - dayColW; // 10mm margin each side
  const periodColW = remainingW / opts.periodsPerDay;
  const columnStyles: Record<number, any> = {
    0: { cellWidth: dayColW, fontStyle: 'bold' },
  };
  for (let i = 0; i < opts.periodsPerDay; i++) {
    const isBreakCol = periodHeaders[i].isBreak;
    columnStyles[i + 1] = {
      cellWidth: isBreakCol ? Math.max(10, periodColW * 0.55) : periodColW,
    };
  }

  autoTable(doc, {
    startY: opts.subtitle ? 28 : 22,
    head,
    body,
    theme: 'grid',
    margin: { left: 10, right: 10 },
    styles: {
      fontSize: 7,
      cellPadding: { top: 1.8, right: 1, bottom: 1.8, left: 1 },
      halign: 'center',
      valign: 'middle',
      textColor: 0,
      lineColor: [120, 120, 120],
      lineWidth: 0.2,
      minCellHeight: 14,
    },
    headStyles: {
      fillColor: [20, 90, 50],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8,
      lineColor: [255, 255, 255],
      lineWidth: 0.3,
    },
    columnStyles,
    didParseCell: (data) => {
      // Subject line (first line) bold
      if (data.section === 'body' && data.column.index > 0 && typeof data.cell.raw === 'object') {
        const raw: any = data.cell.raw;
        if (raw?.content && typeof raw.content === 'string' && raw.content.includes('\n')) {
          // jsPDF-autotable doesn't support per-line styles directly; we emulate via fontStyle on whole cell
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  // ── Footer ───────────────────────────────────────────────────────────────
  const finalY = (doc as any).lastAutoTable.finalY || pageH - 20;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(110);
  const leftFooter = opts.preparedBy
    ? `Prepared by: ${opts.preparedBy} (Administrator)  ·  ${new Date().toLocaleDateString()}`
    : `Generated ${new Date().toLocaleDateString()}`;
  doc.text(
    leftFooter,
    10,
    Math.min(finalY + 6, pageH - 8),
  );
  doc.text('PerformTrack Timetable', pageW - 10, Math.min(finalY + 6, pageH - 8), { align: 'right' });

  doc.save(`${opts.title.replace(/\s+/g, '_')}.pdf`);
}
