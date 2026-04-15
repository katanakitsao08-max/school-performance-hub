import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TERMS, ASSESSMENT_TYPES, ASSESSMENT_TYPE_LABELS } from './cbc-utils';

interface PerformanceRow {
  full_name: string;
  termData: Record<string, Record<string, { mean: number; total: number; count: number }>>;
}

export function downloadClassPerformancePdf(
  performanceData: PerformanceRow[],
  classAverages: Record<string, Record<string, number>>,
  grade: string,
  stream: string,
  year: number,
  schoolName?: string,
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const title = schoolName || 'School';
  const subtitle = `Class Performance Tracking — Grade ${grade} ${stream}, ${year}`;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 148, 12, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(subtitle, 148, 18, { align: 'center' });

  const headers = ['#', 'Learner'];
  TERMS.forEach(term => {
    ASSESSMENT_TYPES.forEach(at => {
      headers.push(`T${term} ${ASSESSMENT_TYPE_LABELS[at]}`);
    });
  });

  const body = performanceData.map((l, idx) => {
    const row: string[] = [String(idx + 1), l.full_name];
    TERMS.forEach(term => {
      ASSESSMENT_TYPES.forEach(at => {
        const d = l.termData[`T${term}`]?.[at];
        row.push(d && d.mean > 0 ? d.mean.toFixed(1) : '-');
      });
    });
    return row;
  });

  // Class average row
  const avgRow: string[] = ['', 'CLASS AVERAGE'];
  TERMS.forEach(term => {
    ASSESSMENT_TYPES.forEach(at => {
      const v = classAverages[`T${term}`]?.[at];
      avgRow.push(v && v > 0 ? v.toFixed(1) : '-');
    });
  });
  body.push(avgRow);

  autoTable(doc, {
    startY: 22,
    head: [headers],
    body,
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [34, 120, 60], textColor: 255, fontSize: 7 },
    columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 35 } },
    didParseCell: (data) => {
      if (data.row.index === body.length - 1 && data.section === 'body') {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [230, 240, 230];
      }
    },
  });

  doc.save(`Performance_Grade${grade}_${stream}_${year}.pdf`);
}

export function downloadIndividualPerformancePdf(
  learnerName: string,
  subjects: { id: string; name: string; max_score: number }[],
  allScores: any[],
  learnerId: string,
  grade: string,
  year: number,
  schoolName?: string,
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const title = schoolName || 'School';
  const subtitle = `${learnerName} — Performance Tracking ${year}`;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 148, 12, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(subtitle, 148, 18, { align: 'center' });

  const headers = ['Subject'];
  TERMS.forEach(term => {
    ASSESSMENT_TYPES.forEach(at => {
      headers.push(`T${term} ${ASSESSMENT_TYPE_LABELS[at]}`);
    });
  });

  const body = subjects.map(sub => {
    const row: string[] = [sub.name];
    TERMS.forEach(term => {
      ASSESSMENT_TYPES.forEach(at => {
        const sc = allScores.find(
          (s: any) =>
            s.learner_id === learnerId &&
            s.learning_area_id === sub.id &&
            s.term === term &&
            (s.assessment_type || 'end_term') === at,
        );
        row.push(sc?.score ? String(sc.score) : '-');
      });
    });
    return row;
  });

  autoTable(doc, {
    startY: 22,
    head: [headers],
    body,
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [34, 120, 60], textColor: 255, fontSize: 7 },
    columnStyles: { 0: { cellWidth: 35 } },
  });

  doc.save(`Performance_${learnerName.replace(/\s+/g, '_')}_${year}.pdf`);
}
