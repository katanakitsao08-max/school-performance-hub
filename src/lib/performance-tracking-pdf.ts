import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TERMS, ASSESSMENT_TYPES, ASSESSMENT_TYPE_LABELS, getGradeForLevel } from './cbc-utils';

interface PerformanceRow {
  full_name: string;
  grandTotal: number;
  average: number;
  rank: number;
  termData: Record<string, Record<string, { mean: number; total: number; count: number }>>;
}

const fmtMeanWithGrade = (mean: number, grade: string) => {
  if (!mean || mean <= 0) return '-';
  const g = getGradeForLevel(mean, 100, grade);
  return `${mean.toFixed(1)} (${g})`;
};

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

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 148, 14, { align: 'center' });
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(subtitle, 148, 22, { align: 'center' });

  const headers = ['#', 'Learner'];
  TERMS.forEach(term => {
    ASSESSMENT_TYPES.forEach(at => {
      headers.push(`T${term} ${ASSESSMENT_TYPE_LABELS[at]}`);
    });
  });
  headers.push('Total', 'Avg', 'Grade', 'Rank');

  const body = performanceData.map((l, idx) => {
    const row: string[] = [String(idx + 1), l.full_name];
    TERMS.forEach(term => {
      ASSESSMENT_TYPES.forEach(at => {
        const d = l.termData[`T${term}`]?.[at];
        row.push(d && d.mean > 0 ? fmtMeanWithGrade(d.mean, grade) : '-');
      });
    });
    row.push(l.grandTotal > 0 ? l.grandTotal.toFixed(1) : '-');
    row.push(l.average > 0 ? l.average.toFixed(1) : '-');
    row.push(l.average > 0 ? String(getGradeForLevel(l.average, 100, grade)) : '-');
    row.push(l.average > 0 ? String(l.rank) : '-');
    return row;
  });

  // Class average row (with overall grade)
  const avgRow: string[] = ['', 'CLASS AVERAGE'];
  TERMS.forEach(term => {
    ASSESSMENT_TYPES.forEach(at => {
      const v = classAverages[`T${term}`]?.[at];
      avgRow.push(v && v > 0 ? fmtMeanWithGrade(v, grade) : '-');
    });
  });
  // overall mean of all assessment averages
  const allAvgs: number[] = [];
  TERMS.forEach(t => ASSESSMENT_TYPES.forEach(at => {
    const v = classAverages[`T${t}`]?.[at]; if (v && v > 0) allAvgs.push(v);
  }));
  const overall = allAvgs.length ? allAvgs.reduce((a, b) => a + b, 0) / allAvgs.length : 0;
  avgRow.push('-', overall > 0 ? overall.toFixed(1) : '-', overall > 0 ? String(getGradeForLevel(overall, 100, grade)) : '-', '-');
  body.push(avgRow);

  autoTable(doc, {
    startY: 28,
    head: [headers],
    body,
    styles: { fontSize: 10, cellPadding: 2.5 },
    headStyles: { fillColor: [34, 120, 60], textColor: 255, fontSize: 10, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 42 } },
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

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 148, 14, { align: 'center' });
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(subtitle, 148, 22, { align: 'center' });

  const headers = ['Subject'];
  TERMS.forEach(term => {
    ASSESSMENT_TYPES.forEach(at => {
      headers.push(`T${term} ${ASSESSMENT_TYPE_LABELS[at]}`);
    });
  });
  headers.push('Subject Avg', 'Grade');

  const body: string[][] = subjects.map(sub => {
    const row: string[] = [sub.name];
    const subjScores: number[] = [];
    TERMS.forEach(term => {
      ASSESSMENT_TYPES.forEach(at => {
        const sc = allScores.find(
          (s: any) =>
            s.learner_id === learnerId &&
            s.learning_area_id === sub.id &&
            s.term === term &&
            (s.assessment_type || 'end_term') === at,
        );
        if (sc?.score) {
          const n = Number(sc.score);
          row.push(`${n} (${getGradeForLevel(n, sub.max_score, grade)})`);
          subjScores.push(n);
        } else {
          row.push('-');
        }
      });
    });
    const avg = subjScores.length ? subjScores.reduce((a, b) => a + b, 0) / subjScores.length : 0;
    row.push(avg > 0 ? avg.toFixed(1) : '-');
    row.push(avg > 0 ? String(getGradeForLevel(avg, sub.max_score, grade)) : '-');
    return row;
  });

  // Total row
  const totalRow: string[] = ['TOTAL'];
  TERMS.forEach(term => {
    ASSESSMENT_TYPES.forEach(at => {
      const total = subjects.reduce((sum, sub) => {
        const sc = allScores.find(
          (s: any) => s.learner_id === learnerId && s.learning_area_id === sub.id && s.term === term && (s.assessment_type || 'end_term') === at,
        );
        return sum + (sc?.score || 0);
      }, 0);
      totalRow.push(total > 0 ? String(total) : '-');
    });
  });
  totalRow.push('-', '-');
  body.push(totalRow);

  // Average row with grade
  const avgRow: string[] = ['AVERAGE'];
  let overallSum = 0, overallCount = 0;
  TERMS.forEach(term => {
    ASSESSMENT_TYPES.forEach(at => {
      let total = 0, count = 0;
      subjects.forEach(sub => {
        const sc = allScores.find(
          (s: any) => s.learner_id === learnerId && s.learning_area_id === sub.id && s.term === term && (s.assessment_type || 'end_term') === at,
        );
        if (sc?.score) { total += Number(sc.score); count++; }
      });
      const avg = count > 0 ? total / count : 0;
      avgRow.push(avg > 0 ? fmtMeanWithGrade(avg, grade) : '-');
      if (avg > 0) { overallSum += avg; overallCount++; }
    });
  });
  const overall = overallCount ? overallSum / overallCount : 0;
  avgRow.push(overall > 0 ? overall.toFixed(1) : '-', overall > 0 ? String(getGradeForLevel(overall, 100, grade)) : '-');
  body.push(avgRow);

  autoTable(doc, {
    startY: 28,
    head: [headers],
    body,
    styles: { fontSize: 10, cellPadding: 2.5 },
    headStyles: { fillColor: [34, 120, 60], textColor: 255, fontSize: 10, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 42 } },
    didParseCell: (data) => {
      if (data.row.index >= body.length - 2 && data.section === 'body') {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [230, 240, 230];
      }
    },
  });

  doc.save(`Performance_${learnerName.replace(/\s+/g, '_')}_${year}.pdf`);
}
