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
  grid: TimetableSlot[][];
  showTeacher?: boolean;
  showClass?: boolean;
}

export function exportTimetablePdf(opts: PdfOpts) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(opts.schoolName, pageW / 2, 12, { align: 'center' });
  doc.setFontSize(12);
  doc.text(opts.title, pageW / 2, 18, { align: 'center' });
  if (opts.subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(opts.subtitle, pageW / 2, 24, { align: 'center' });
  }

  const head = [['Day', ...Array.from({ length: opts.periodsPerDay }, (_, i) =>
    opts.breakPeriod === i + 1 ? 'BREAK' : `P${i + 1}`,
  )]];

  const body = opts.days.map((day, di) => {
    const row: any[] = [day];
    for (let p = 0; p < opts.periodsPerDay; p++) {
      const slot = opts.grid[di]?.[p];
      if (slot?.isBreak) {
        row.push({ content: 'BREAK', styles: { fillColor: [230, 230, 230], halign: 'center' } });
      } else if (slot?.learningAreaName) {
        const lines = [slot.learningAreaName];
        if (opts.showTeacher && slot.teacherName) lines.push(slot.teacherName);
        row.push(lines.join('\n'));
      } else {
        row.push('—');
      }
    }
    return row;
  });

  autoTable(doc, {
    startY: 30,
    head,
    body,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 2, halign: 'center', valign: 'middle', textColor: 0 },
    headStyles: { fillColor: [40, 40, 40], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 0: { fontStyle: 'bold', fillColor: [245, 245, 245] } },
  });

  doc.save(`${opts.title.replace(/\s+/g, '_')}.pdf`);
}
