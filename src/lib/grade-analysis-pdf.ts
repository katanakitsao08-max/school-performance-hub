import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SUB_LEVELS, type GradeAnalysisReport } from './cbc-analysis-utils';

export interface GradeAnalysisPdfMeta {
  schoolName: string;
  schoolLogoUrl?: string;
  grade: string;
  streamLabel: string;
  term: number;
  year: number;
  assessmentLabel: string;
  generatedAt?: Date;
}

const loadImageAsBase64 = (url: string): Promise<string | null> =>
  new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);
      try { resolve(canvas.toDataURL('image/png')); } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });

export async function generateGradeAnalysisPDF(
  analysis: GradeAnalysisReport,
  meta: GradeAnalysisPdfMeta,
  opts: { autoSave?: boolean; filename?: string } = {},
): Promise<jsPDF> {
  // A4 portrait for standard report format
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  let y = margin;

  // ============= HEADER =============
  const logo = meta.schoolLogoUrl ? await loadImageAsBase64(meta.schoolLogoUrl) : null;
  if (logo) {
    try { doc.addImage(logo, 'PNG', margin, y, 18, 18); } catch { /* ignore */ }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(meta.schoolName.toUpperCase(), pageW / 2, y + 6, { align: 'center' });

  doc.setFontSize(11);
  doc.text('GRADE ANALYSIS REPORT', pageW / 2, y + 12, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    `Grade ${meta.grade} • ${meta.streamLabel} • ${meta.assessmentLabel} • Term ${meta.term} • ${meta.year}`,
    pageW / 2, y + 17, { align: 'center' },
  );
  doc.setFontSize(8);
  const dateStr = (meta.generatedAt || new Date()).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  doc.text(`Generated: ${dateStr}`, pageW - margin, y + 6, { align: 'right' });

  y += 22;
  doc.setDrawColor(180);
  doc.line(margin, y, pageW - margin, y);
  y += 4;

  // ============= LEARNER SUMMARY =============
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const summary = [
    `Total Learners: ${analysis.totalEntries}`,
    `Male: ${analysis.totalM}`,
    `Female: ${analysis.totalF}`,
    `Stream(s): ${meta.streamLabel}`,
  ];
  doc.text(summary.join('   |   '), margin, y);
  y += 5;

  // ============= SUBJECT TABLE =============
  const subHeaders = SUB_LEVELS.flatMap(lv => [`${lv} M`, `${lv} F`]);
  const headers = ['SUBJECT', 'M', 'F', ...subHeaders, 'T.PT', 'AV.PT', 'MEAN'];

  const body = analysis.subjects.map(sa => [
    sa.subjectName,
    sa.entryM, sa.entryF,
    ...SUB_LEVELS.flatMap(lv => [sa.genderDistribution[lv].M, sa.genderDistribution[lv].F]),
    sa.totalPoints,
    sa.meanGradePoint,
    sa.meanGradeLabel,
  ]);

  if (analysis.subjects.length > 0) {
    body.push([
      'OVERALL',
      analysis.totalM, analysis.totalF,
      ...SUB_LEVELS.flatMap(lv => [analysis.overallGenderDistribution[lv].M, analysis.overallGenderDistribution[lv].F]),
      analysis.overallTotalPoints,
      analysis.overallMean,
      analysis.overallMeanLabel,
    ]);
  }

  autoTable(doc, {
    head: [headers],
    body: body.length > 0 ? body : [['No data available', '', '', ...SUB_LEVELS.flatMap(() => ['', '']), '', '', '']],
    startY: y,
    margin: { left: margin, right: margin },
    styles: { fontSize: 7, halign: 'center', cellPadding: 1.2, lineColor: [200, 200, 200], lineWidth: 0.1 },
    headStyles: { fillColor: [22, 101, 52], textColor: 255, halign: 'center', fontSize: 7, fontStyle: 'bold' },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold', cellWidth: 25 } },
    didParseCell: (data) => {
      if (data.row.index === body.length - 1 && body.length > 0 && analysis.subjects.length > 0) {
        data.cell.styles.fillColor = [240, 240, 240];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  y = (doc as any).lastAutoTable?.finalY ?? y + 30;
  y += 5;

  // ============= CLASS ANALYSIS + AI INSIGHTS (stacked for portrait) =============
  const colW = pageW - margin * 2;
  const boxTop = y;

  // Class Analysis
  doc.setFillColor(248, 250, 248);
  doc.rect(margin, boxTop, colW, 35, 'F');
  doc.setDrawColor(22, 101, 52);
  doc.setLineWidth(0.3);
  doc.rect(margin, boxTop, colW, 35);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(22, 101, 52);
  doc.text('CLASS ANALYSIS', margin + 2, boxTop + 5);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const classLines = [
    `Highest Band: ${analysis.insights.highestBand}`,
    `Class Mean: ${analysis.overallMean} (${analysis.overallMeanLabel})`,
    `Average Score: ${analysis.overallAverage}`,
    `Gender Comparison: ${analysis.insights.genderNote}`,
    `Overall: ${analysis.insights.overallComment}`,
  ];
  classLines.forEach((t, i) => doc.text(doc.splitTextToSize(t, colW - 4), margin + 2, boxTop + 10 + i * 5));

  // AI Insights
  const aiTop = boxTop + 38;
  doc.setFillColor(252, 248, 240);
  doc.rect(margin, aiTop, colW, 35, 'F');
  doc.setDrawColor(180, 120, 30);
  doc.rect(margin, aiTop, colW, 35);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(180, 120, 30);
  doc.text('INSIGHTS & RECOMMENDATIONS', margin + 2, aiTop + 5);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const aiLines = [
    `Best Subject: ${analysis.insights.bestSubject}`,
    `Weakest Subject: ${analysis.insights.weakestSubject}`,
    `Performance Level: ${analysis.insights.overallComment}`,
    `Recommendation: ${analysis.insights.recommendation}`,
  ];
  let ay = aiTop + 10;
  aiLines.forEach((t) => {
    const wrapped = doc.splitTextToSize(t, colW - 4);
    doc.text(wrapped, margin + 2, ay);
    ay += wrapped.length * 4;
  });

  // ============= FOOTER (signatures) =============
  const footerY = pageH - 25;
  doc.setDrawColor(120);
  doc.setLineWidth(0.2);
  const sigW = (pageW - margin * 2 - 20) / 3;
  ['Class Teacher', 'Headteacher', 'School Stamp'].forEach((label, i) => {
    const x = margin + i * (sigW + 10);
    doc.line(x, footerY, x + sigW, footerY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(label, x + sigW / 2, footerY + 4, { align: 'center' });
    doc.setFontSize(6);
    doc.setTextColor(120);
    doc.text('Signature & Date', x + sigW / 2, footerY + 8, { align: 'center' });
    doc.setTextColor(0);
  });

  doc.setFontSize(6);
  doc.setTextColor(150);
  doc.text(`PerformTrack • Generated ${new Date().toLocaleString()}`, pageW / 2, pageH - 4, { align: 'center' });
  doc.setTextColor(0);

  if (opts.autoSave !== false) {
    const fname = opts.filename || `GradeAnalysis_G${meta.grade}_${meta.streamLabel}_T${meta.term}_${meta.year}.pdf`;
    doc.save(fname);
  }
  return doc;
}
