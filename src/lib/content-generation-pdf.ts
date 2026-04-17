import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { SchemeRow, LessonPlanData } from '@/lib/content-generation-templates';

const BRAND: [number, number, number] = [34, 120, 60];
const BRAND_LIGHT: [number, number, number] = [230, 245, 235];

export function downloadSchemeOfWorkPdf(
  rows: SchemeRow[],
  grade: string,
  subject: string,
  term: string,
  school: string,
  teacher: string
) {
  const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const mx = 12;
  const cw = pw - mx * 2;

  // Header
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, pw, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(school.toUpperCase(), pw / 2, 10, { align: 'center' });
  doc.setFontSize(10);
  doc.text(`SCHEME OF WORK — ${grade} | ${subject} | ${term}`, pw / 2, 17, { align: 'center' });

  doc.setTextColor(60, 60, 60);
  doc.setFontSize(9);
  doc.text(`Teacher: ${teacher}`, mx, 30);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, pw - mx, 30, { align: 'right' });

  autoTable(doc, {
    startY: 35,
    margin: { left: mx, right: mx },
    tableWidth: cw,
    head: [['Wk', 'Lsn', 'Strand', 'Sub-Strand', 'Specific Learning Outcomes', 'Learning Experiences', 'Key Inquiry Question(s)', 'Resources', 'Assessment', 'Remarks']],
    body: rows.map(r => [
      String(r.week), String(r.lesson), r.strand, r.subStrand, r.slo, r.experiences, r.inquiry, r.resources, r.assessment, r.remarks
    ]),
    styles: { fontSize: 7, cellPadding: 2, lineWidth: 0.2, lineColor: [200, 200, 200], valign: 'top' },
    headStyles: { fillColor: BRAND, fontSize: 7, cellPadding: 2.5, fontStyle: 'bold', textColor: [255, 255, 255], halign: 'center' },
    alternateRowStyles: { fillColor: BRAND_LIGHT },
    didParseCell: (data) => {
      const row = rows[data.row.index];
      if (row?.isBreak && data.section === 'body') {
        data.cell.styles.fillColor = [255, 243, 205];
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.halign = 'center';
      }
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 8, halign: 'center' },
      2: { cellWidth: 24 },
      3: { cellWidth: 26 },
      4: { cellWidth: 50 },
      5: { cellWidth: 45 },
      6: { cellWidth: 32 },
      7: { cellWidth: 28 },
      8: { cellWidth: 24 },
      9: { cellWidth: 18 },
    },
    didDrawPage: () => {
      doc.setFillColor(...BRAND);
      doc.rect(0, ph - 8, pw, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.text('PerformTrack — CBC Scheme of Work', pw / 2, ph - 3, { align: 'center' });
    },
  });

  doc.save(`Scheme_of_Work_${grade}_${subject}_${term.replace(/\s/g, '_')}.pdf`);
}

export function downloadLessonPlanPdf(plan: LessonPlanData) {
  const doc = new jsPDF({ format: 'a4' });
  const pw = 210;
  const mx = 15;
  const cw = pw - mx * 2;
  let y = 0;

  // Header
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, pw, 24, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(plan.school.toUpperCase(), pw / 2, 10, { align: 'center' });
  doc.setFontSize(12);
  doc.text('LESSON PLAN', pw / 2, 18, { align: 'center' });
  y = 30;

  // Meta info table
  autoTable(doc, {
    startY: y,
    margin: { left: mx, right: mx },
    tableWidth: cw,
    body: [
      ['Teacher:', plan.teacher, 'Grade:', plan.grade],
      ['Subject:', plan.subject, 'Term:', plan.term],
      ['Date:', plan.date, 'Duration:', plan.duration],
      ['Strand:', plan.strand, 'Sub-Strand:', plan.subStrand],
      ['SLO:', { content: plan.slo, colSpan: 3 }],
    ],
    styles: { fontSize: 9, cellPadding: 3, lineWidth: 0.2, lineColor: [200, 200, 200] },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 30, fillColor: BRAND_LIGHT },
      2: { fontStyle: 'bold', cellWidth: 30, fillColor: BRAND_LIGHT },
    },
    theme: 'grid',
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  const addSection = (title: string, content: string | string[]) => {
    if (y > 265) { doc.addPage(); y = 15; }
    doc.setFillColor(...BRAND);
    doc.rect(mx, y, cw, 7, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(title, mx + 3, y + 5);
    y += 10;

    doc.setTextColor(40, 40, 40);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    if (typeof content === 'string') {
      const lines = doc.splitTextToSize(content, cw - 6);
      if (y + lines.length * 4.5 > 280) { doc.addPage(); y = 15; }
      doc.text(lines, mx + 3, y);
      y += lines.length * 4.5 + 4;
    } else {
      for (const item of content) {
        if (y > 275) { doc.addPage(); y = 15; }
        const lines = doc.splitTextToSize(`• ${item}`, cw - 10);
        doc.text(lines, mx + 6, y);
        y += lines.length * 4.5;
      }
      y += 3;
    }
  };

  addSection('INTRODUCTION', plan.introduction);
  addSection('LESSON DEVELOPMENT', plan.development);
  addSection('LEARNER ACTIVITIES', plan.learnerActivities);
  addSection('TEACHER ACTIVITIES', plan.teacherActivities);
  addSection('RESOURCES', plan.resources);
  addSection('ASSESSMENT', plan.assessment);
  addSection('CORE COMPETENCIES', plan.coreCompetencies);
  addSection('VALUES', plan.values);
  addSection('REFLECTION', plan.reflection);

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const ph = doc.internal.pageSize.getHeight();
    doc.setFillColor(...BRAND);
    doc.rect(0, ph - 8, pw, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.text('PerformTrack — CBC Lesson Plan', pw / 2, ph - 3, { align: 'center' });
  }

  doc.save(`Lesson_Plan_${plan.grade}_${plan.subject}_${plan.strand.replace(/\s/g, '_')}.pdf`);
}
