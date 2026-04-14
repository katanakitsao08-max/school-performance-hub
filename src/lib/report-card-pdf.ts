import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getGradeLabel, type AnyGrade } from './cbc-utils';
import QRCode from 'qrcode';

export interface StrandReportData {
  strandName: string;
  score: number;
  maxScore: number;
  competencyLevel: string;
  teacherComment: string;
}

export interface ReportCardData {
  learner: {
    id: string;
    full_name: string;
    admission_number: string;
    grade: string;
    stream: string;
    gender: string;
  };
  subjectData: {
    name: string;
    score: number;
    maxScore: number;
    grade: string;
    teacherInitials: string;
    teacherName: string;
    comment: string;
    strands?: StrandReportData[];
  }[];
  total: number;
  maxTotal: number;
  mean: number;
  overallGrade: string;
  rank: number;
  streamRank: number;
  totalInClass: number;
  totalInStream: number;
  totalPoints: number;
  selectedTerm: number;
  selectedYear: number;
  assessmentLabel: string;
  classTeacherComment: string;
  principalComment: string;
  schoolSettings: Record<string, string>;
  logoBase64: string | null;
  classAvgPerSubject: Record<string, number>;
  termHistory?: { term: string; mean: number }[];
  appUrl: string;
}

function loadImageAsBase64(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    if (!url) { resolve(null); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

async function generateQRCodeBase64(text: string): Promise<string | null> {
  try {
    return await QRCode.toDataURL(text, { width: 80, margin: 1, color: { dark: '#000000', light: '#ffffff' } });
  } catch { return null; }
}

export async function generatePremiumReportCard(data: ReportCardData): Promise<jsPDF> {
  const doc = new jsPDF({ format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const mx = 10;
  const cw = pw - mx * 2;
  const cx = pw / 2;

  const ss = data.schoolSettings;
  const schoolName = ss['school_name'] || 'SCHOOL';
  const schoolMotto = ss['school_motto'] || '';
  const schoolAddress = ss['school_address'] || '';
  const schoolPhone = ss['school_phone'] || '';
  const schoolEmail = ss['school_email'] || '';
  const closingDate = ss['closing_date'] || '';
  const openingDate = ss['opening_date'] || '';

  const primary: [number, number, number] = [41, 128, 185];
  const dark: [number, number, number] = [44, 62, 80];

  let y = 4;

  // ── TOP BAND ──
  doc.setFillColor(...primary);
  doc.rect(0, 0, pw, 3, 'F');
  y = 6;

  // Logo + School Name on same line
  if (data.logoBase64) {
    const logoSize = 14;
    doc.addImage(data.logoBase64, 'PNG', mx, y - 2, logoSize, logoSize);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...dark);
    doc.text(schoolName.toUpperCase(), mx + logoSize + 4, y + 4);
    if (schoolMotto) {
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 100, 100);
      doc.text(`"${schoolMotto}"`, mx + logoSize + 4, y + 9);
    }
    const contactParts = [schoolAddress, schoolPhone, schoolEmail].filter(Boolean);
    if (contactParts.length) {
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 120, 120);
      doc.text(contactParts.join(' • '), mx + logoSize + 4, y + 13);
    }
    y += logoSize + 1;
  } else {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...dark);
    doc.text(schoolName.toUpperCase(), cx, y + 4, { align: 'center' });
    y += 6;
    if (schoolMotto) {
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 100, 100);
      doc.text(`"${schoolMotto}"`, cx, y, { align: 'center' });
      y += 3;
    }
    const contactParts = [schoolAddress, schoolPhone, schoolEmail].filter(Boolean);
    if (contactParts.length) {
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 120, 120);
      doc.text(contactParts.join(' • '), cx, y, { align: 'center' });
      y += 3;
    }
  }

  // Divider
  doc.setDrawColor(...primary);
  doc.setLineWidth(0.6);
  doc.line(mx, y, pw - mx, y);
  y += 3;

  // ── REPORT TITLE + STUDENT INFO (compact single row) ──
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primary);
  doc.text('ACADEMIC PERFORMANCE REPORT', mx, y + 1);

  // Right-aligned term/year
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Term ${data.selectedTerm} (${data.assessmentLabel}) • ${data.selectedYear}`, pw - mx, y + 1, { align: 'right' });
  y += 4;

  // Student info - compact 2 rows
  const col1 = mx + 2;
  const col2 = mx + cw * 0.35;
  const col3 = mx + cw * 0.65;

  const infoItem = (label: string, value: string, x: number, yp: number) => {
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`${label}:`, x, yp);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...dark);
    doc.text(value, x + doc.getTextWidth(`${label}: `) + 0.5, yp);
  };

  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.2);
  doc.roundedRect(mx, y - 2, cw, 12, 1, 1, 'S');

  infoItem('Name', data.learner.full_name, col1, y + 2);
  infoItem('Adm No', data.learner.admission_number, col2, y + 2);
  infoItem('Gender', data.learner.gender, col3, y + 2);
  infoItem('Class', `Grade ${data.learner.grade} ${data.learner.stream}`, col1, y + 7);

  y += 13;

  // ── SUBJECT TABLE ──
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...dark);
  doc.text('SUBJECT PERFORMANCE', mx, y);
  y += 2;

  const subjectHeaders = ['#', 'Subject', 'Score', 'Max', '%', 'Grade', 'Avg', 'Teacher', 'Remark'];
  const subjectBody = data.subjectData.map((s, i) => {
    const pct = s.maxScore > 0 ? ((s.score / s.maxScore) * 100).toFixed(0) : '0';
    const classAvg = data.classAvgPerSubject[s.name] !== undefined ? data.classAvgPerSubject[s.name].toFixed(0) : '-';
    return [
      `${i + 1}`,
      s.name,
      `${s.score}`,
      `${s.maxScore}`,
      `${pct}%`,
      s.grade !== '-' ? s.grade : '-',
      classAvg,
      s.teacherName ? s.teacherName.split(' ').map(n => n[0]).join('').toUpperCase() : (s.teacherInitials || '-'),
      s.grade !== '-' ? getGradeLabel(s.grade as AnyGrade).split(' ')[0] : '-',
    ];
  });

  autoTable(doc, {
    head: [subjectHeaders],
    body: subjectBody,
    startY: y,
    styles: { fontSize: 6.5, cellPadding: 1.2 },
    headStyles: { fillColor: primary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 6.5 },
    alternateRowStyles: { fillColor: [248, 249, 250] },
    columnStyles: {
      0: { cellWidth: 6 },
      1: { cellWidth: 28 },
      2: { cellWidth: 12, halign: 'center' },
      3: { cellWidth: 10, halign: 'center' },
      4: { cellWidth: 10, halign: 'center' },
      5: { cellWidth: 10, halign: 'center' },
      6: { cellWidth: 10, halign: 'center' },
      7: { cellWidth: 14, halign: 'center' },
    },
    margin: { left: mx, right: mx },
  });

  y = (doc as any).lastAutoTable.finalY + 3;

  // ── STRAND BREAKDOWN (if any subject has strands) ──
  const subjectsWithStrands = data.subjectData.filter(s => s.strands && s.strands.length > 0);
  if (subjectsWithStrands.length > 0) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...dark);
    doc.text('STRAND PERFORMANCE', mx, y);
    y += 2;

    const strandHeaders = ['Subject', 'Strand', 'Score', '/Max', 'Level', 'Comment'];
    const strandBody: string[][] = [];
    subjectsWithStrands.forEach(sub => {
      sub.strands!.forEach((st, i) => {
        strandBody.push([
          i === 0 ? sub.name : '',
          st.strandName,
          `${st.score}`,
          `${st.maxScore}`,
          st.competencyLevel,
          (st.teacherComment || '-').substring(0, 40),
        ]);
      });
    });

    autoTable(doc, {
      head: [strandHeaders],
      body: strandBody,
      startY: y,
      styles: { fontSize: 5.5, cellPadding: 1 },
      headStyles: { fillColor: [39, 174, 96] as any, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 5.5 },
      alternateRowStyles: { fillColor: [248, 249, 250] },
      columnStyles: {
        0: { cellWidth: 25, fontStyle: 'bold' },
        1: { cellWidth: 30 },
        2: { cellWidth: 12, halign: 'center' },
        3: { cellWidth: 12, halign: 'center' },
        4: { cellWidth: 12, halign: 'center' },
      },
      margin: { left: mx, right: mx },
    });

    y = (doc as any).lastAutoTable.finalY + 3;
  }

  const cardH = 12;
  const summaryItems = [
    { label: 'Total', value: `${data.total}/${data.maxTotal}`, color: primary },
    { label: 'Mean', value: `${data.mean.toFixed(1)}%`, color: [39, 174, 96] as [number, number, number] },
    { label: 'Stream Pos', value: `${data.streamRank}/${data.totalInStream}`, color: [142, 68, 173] as [number, number, number] },
    { label: 'Overall Pos', value: `${data.rank}/${data.totalInClass}`, color: [230, 126, 34] as [number, number, number] },
  ];

  summaryItems.forEach((item, i) => {
    const cardX = mx + i * (cardW + 3);
    doc.setFillColor(...item.color);
    doc.roundedRect(cardX, y, cardW, cardH, 1.5, 1.5, 'F');
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(255, 255, 255);
    doc.text(item.label, cardX + cardW / 2, y + 4, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(item.value, cardX + cardW / 2, y + 10, { align: 'center' });
  });

  y += cardH + 2;

  // Additional stats inline
  const gradeInfo = data.overallGrade !== '-' ? `${data.overallGrade} (${getGradeLabel(data.overallGrade as AnyGrade)})` : '-';
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(mx, y, cw, 8, 1, 1, 'F');
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  const statsText = `Overall Grade: ${gradeInfo}  |  Total Points: ${data.totalPoints}  |  Mean Grade: ${data.overallGrade}`;
  doc.text(statsText, cx, y + 5, { align: 'center' });
  y += 11;

  // ── PERFORMANCE GRAPH (compact) ──
  if (data.subjectData.length > 0) {
    const graphH = 30;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...dark);
    doc.text('STUDENT vs CLASS AVERAGE', mx, y);

    // Term trend on the right side if available
    const hasTermHistory = data.termHistory && data.termHistory.length > 1;
    const graphW = hasTermHistory ? cw * 0.58 : cw - 5;
    const graphX = mx + 2;
    y += 3;

    const barAreaW = graphW - 15;
    const barCount = data.subjectData.length;
    const groupW = barAreaW / barCount;
    const barW = Math.min(groupW * 0.35, 8);

    // Y-axis
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.15);
    doc.line(graphX + 10, y, graphX + 10, y + graphH);
    doc.line(graphX + 10, y + graphH, graphX + 10 + barAreaW, y + graphH);

    for (let pct = 0; pct <= 100; pct += 50) {
      const ly = y + graphH - (graphH * pct / 100);
      doc.setFontSize(4);
      doc.setTextColor(150, 150, 150);
      doc.text(`${pct}`, graphX + 8, ly + 1, { align: 'right' });
      doc.setDrawColor(240, 240, 240);
      doc.line(graphX + 10, ly, graphX + 10 + barAreaW, ly);
    }

    data.subjectData.forEach((s, i) => {
      const bx = graphX + 10 + i * groupW + groupW / 2;
      const studentPct = s.maxScore > 0 ? (s.score / s.maxScore) * 100 : 0;
      const classAvg = data.classAvgPerSubject[s.name] || 0;
      const classPct = s.maxScore > 0 ? (classAvg / s.maxScore) * 100 : 0;

      const sh = graphH * studentPct / 100;
      doc.setFillColor(...primary);
      doc.rect(bx - barW - 0.3, y + graphH - sh, barW, sh, 'F');

      const ch = graphH * classPct / 100;
      doc.setFillColor(230, 126, 34);
      doc.rect(bx + 0.3, y + graphH - ch, barW, ch, 'F');

      doc.setFontSize(3.5);
      doc.setTextColor(...dark);
      const shortName = s.name.length > 6 ? s.name.substring(0, 5) + '..' : s.name;
      doc.text(shortName, bx, y + graphH + 3, { align: 'center' });
    });

    // Legend
    doc.setFillColor(...primary);
    doc.rect(graphX + 10, y + graphH + 5, 3, 2, 'F');
    doc.setFontSize(4.5);
    doc.setTextColor(...dark);
    doc.text('Student', graphX + 14, y + graphH + 6.5);
    doc.setFillColor(230, 126, 34);
    doc.rect(graphX + 30, y + graphH + 5, 3, 2, 'F');
    doc.text('Class Avg', graphX + 34, y + graphH + 6.5);

    // ── TERM TREND (side-by-side with bar chart) ──
    if (hasTermHistory) {
      const tgX = mx + cw * 0.62;
      const tgW = cw * 0.36;
      const tgH = graphH;
      const tgY = y;

      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...dark);
      doc.text('PERFORMANCE TREND', tgX, tgY - 3);

      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.15);
      doc.line(tgX + 8, tgY, tgX + 8, tgY + tgH);
      doc.line(tgX + 8, tgY + tgH, tgX + 8 + tgW - 10, tgY + tgH);

      for (let pct = 0; pct <= 100; pct += 50) {
        const ly = tgY + tgH - (tgH * pct / 100);
        doc.setFontSize(4);
        doc.setTextColor(150, 150, 150);
        doc.text(`${pct}`, tgX + 6, ly + 1, { align: 'right' });
      }

      const pts = data.termHistory!;
      const stepX = (tgW - 12) / (pts.length - 1 || 1);

      doc.setDrawColor(...primary);
      doc.setLineWidth(0.5);
      for (let i = 1; i < pts.length; i++) {
        const x1 = tgX + 8 + (i - 1) * stepX;
        const y1 = tgY + tgH - (tgH * pts[i - 1].mean / 100);
        const x2 = tgX + 8 + i * stepX;
        const y2 = tgY + tgH - (tgH * pts[i].mean / 100);
        doc.line(x1, y1, x2, y2);
      }

      pts.forEach((p, i) => {
        const px = tgX + 8 + i * stepX;
        const py = tgY + tgH - (tgH * p.mean / 100);
        doc.setFillColor(...primary);
        doc.circle(px, py, 1, 'F');
        doc.setFontSize(5);
        doc.setTextColor(...dark);
        doc.text(`${p.mean.toFixed(0)}%`, px, py - 2, { align: 'center' });
        doc.setFontSize(4);
        doc.setTextColor(120, 120, 120);
        doc.text(p.term, px, tgY + tgH + 3, { align: 'center' });
      });
    }

    y += graphH + 10;
  }

  // ── REMARKS (compact) ──
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...dark);
  doc.text('REMARKS & SIGNATURES', mx, y);
  y += 3;

  // Class Teacher
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.roundedRect(mx, y, cw, 14, 1, 1, 'S');
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primary);
  doc.text("Class Teacher:", mx + 2, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...dark);
  const ctText = data.classTeacherComment || '___________________________________';
  const ctLines = doc.splitTextToSize(ctText, cw - 8);
  doc.text(ctLines.slice(0, 2), mx + 2, y + 8);
  doc.setFontSize(5.5);
  doc.setTextColor(150, 150, 150);
  doc.text('Sign: _____________  Date: _____________', mx + 2, y + 12);
  y += 16;

  // Principal
  doc.roundedRect(mx, y, cw, 14, 1, 1, 'S');
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primary);
  doc.text("Principal:", mx + 2, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...dark);
  const prText = data.principalComment || '___________________________________';
  const prLines = doc.splitTextToSize(prText, cw - 8);
  doc.text(prLines.slice(0, 2), mx + 2, y + 8);
  doc.setFontSize(5.5);
  doc.setTextColor(150, 150, 150);
  doc.text('Sign: _____________  Date: _____________  Stamp:', mx + 2, y + 12);
  y += 16;

  // ── CALENDAR + QR (compact inline) ──
  if (closingDate || openingDate || data.appUrl) {
    const calH = 14;
    doc.setFillColor(248, 249, 250);
    doc.roundedRect(mx, y, cw, calH, 1, 1, 'F');

    if (closingDate || openingDate) {
      doc.setFontSize(6);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...dark);
      doc.text('SCHOOL CALENDAR', mx + 3, y + 4);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.5);
      if (closingDate) doc.text(`Closing: ${closingDate}`, mx + 3, y + 8);
      if (openingDate) doc.text(`Opening: ${openingDate}`, mx + 3, y + 12);
    }

    if (data.appUrl) {
      const qrUrl = `${data.appUrl}/parent-dashboard?learner=${data.learner.id}`;
      const qrBase64 = await generateQRCodeBase64(qrUrl);
      if (qrBase64) {
        const qrSize = 12;
        doc.addImage(qrBase64, 'PNG', pw - mx - qrSize - 1, y + 1, qrSize, qrSize);
        doc.setFontSize(4);
        doc.setTextColor(120, 120, 120);
        doc.text('Scan for portal', pw - mx - qrSize / 2 - 1, y + calH - 0.5, { align: 'center' });
      }
    }

    y += calH + 2;
  }

  // ── FOOTER ──
  doc.setFillColor(...primary);
  doc.rect(0, ph - 5, pw, 5, 'F');
  doc.setFontSize(4.5);
  doc.setTextColor(255, 255, 255);
  doc.text('Generated by PerformTrack — CBC Smart School Management System', cx, ph - 1.5, { align: 'center' });

  return doc;
}
