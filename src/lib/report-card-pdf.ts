import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getGradeLabel, getGradeColor, isKJSEAGradeLevel, type AnyGrade } from './cbc-utils';
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
    photoBase64?: string | null;
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
  gradeDistribution?: { grade: string; count: number }[];
  appUrl: string;
}

async function generateQRCodeBase64(text: string): Promise<string | null> {
  try {
    return await QRCode.toDataURL(text, { width: 80, margin: 1, color: { dark: '#000000', light: '#ffffff' } });
  } catch { return null; }
}

// Color palette
const BRAND: [number, number, number] = [34, 104, 63]; // Dark professional green
const BRAND_LIGHT: [number, number, number] = [39, 174, 96]; // Accent green
const DARK: [number, number, number] = [33, 37, 41];
const MID: [number, number, number] = [108, 117, 125];
const LIGHT_BG: [number, number, number] = [248, 249, 250];
const WHITE: [number, number, number] = [255, 255, 255];

// Grade colors for distribution chart
function gradeBarColor(grade: string): [number, number, number] {
  if (grade.startsWith('EE')) return [39, 174, 96];
  if (grade.startsWith('ME')) return [41, 128, 185];
  if (grade.startsWith('AE')) return [243, 156, 18];
  return [231, 76, 60];
}

export async function generatePremiumReportCard(data: ReportCardData): Promise<jsPDF> {
  const doc = new jsPDF({ format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const mx = 8;
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
  const isKJSEA = isKJSEAGradeLevel(data.learner.grade);

  let y = 0;

  // ═══════════════════════════════════════════════════
  // ── HEADER BAND ──
  // ═══════════════════════════════════════════════════
  const headerH = 22;
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, pw, headerH, 'F');

  // Logo
  const logoSize = 14;
  const logoX = mx + 2;
  const logoY = (headerH - logoSize) / 2;
  if (data.logoBase64) {
    doc.addImage(data.logoBase64, 'PNG', logoX, logoY, logoSize, logoSize);
  } else {
    // Placeholder circle
    doc.setFillColor(255, 255, 255);
    doc.circle(logoX + logoSize / 2, headerH / 2, logoSize / 2 - 1, 'F');
  }

  // School name
  const textX = logoX + logoSize + 4;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...WHITE);
  doc.text(schoolName.toUpperCase(), textX, 9);
  if (schoolMotto) {
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(220, 230, 220);
    doc.text(`"${schoolMotto}"`, textX, 13.5);
  }
  const contactParts = [schoolAddress, schoolPhone, schoolEmail].filter(Boolean);
  if (contactParts.length) {
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(200, 215, 200);
    doc.text(contactParts.join(' | '), textX, 17.5);
  }

  // Report title badge (right side)
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...WHITE);
  doc.text('ACADEMIC REPORT CARD', pw - mx - 2, 9, { align: 'right' });
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 215, 200);
  doc.text(`Term ${data.selectedTerm} • ${data.assessmentLabel} • ${data.selectedYear}`, pw - mx - 2, 14, { align: 'right' });

  y = headerH + 3;

  // ═══════════════════════════════════════════════════
  // ── STUDENT INFO CARD ──
  // ═══════════════════════════════════════════════════
  const infoH = 18;
  doc.setFillColor(...LIGHT_BG);
  doc.roundedRect(mx, y, cw, infoH, 2, 2, 'F');
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.2);
  doc.roundedRect(mx, y, cw, infoH, 2, 2, 'S');

  // Student photo
  const photoSize = 14;
  const photoX = mx + 3;
  const photoY = y + (infoH - photoSize) / 2;
  if (data.learner.photoBase64) {
    doc.addImage(data.learner.photoBase64, 'JPEG', photoX, photoY, photoSize, photoSize);
  } else {
    doc.setFillColor(220, 225, 230);
    doc.roundedRect(photoX, photoY, photoSize, photoSize, 1.5, 1.5, 'F');
    doc.setFontSize(16);
    doc.setTextColor(160, 170, 180);
    const initials = data.learner.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    doc.text(initials, photoX + photoSize / 2, photoY + photoSize / 2 + 2.5, { align: 'center' });
  }

  // Info fields
  const infoStartX = photoX + photoSize + 5;
  const col2X = mx + cw * 0.45;
  const col3X = mx + cw * 0.72;

  const infoField = (label: string, value: string, x: number, iy: number) => {
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MID);
    doc.text(label.toUpperCase(), x, iy);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text(value, x, iy + 4);
  };

  const row1Y = y + 5;
  const row2Y = y + 13;
  infoField('Student Name', data.learner.full_name, infoStartX, row1Y);
  infoField('Adm No.', data.learner.admission_number, col2X, row1Y);
  infoField('Gender', data.learner.gender, col3X, row1Y);
  infoField('Class', `Grade ${data.learner.grade} ${data.learner.stream}`, infoStartX, row2Y);
  infoField('Stream Pos.', `${data.streamRank} of ${data.totalInStream}`, col2X, row2Y);
  infoField('Overall Pos.', `${data.rank} of ${data.totalInClass}`, col3X, row2Y);

  y += infoH + 3;

  // ═══════════════════════════════════════════════════
  // ── SUBJECT PERFORMANCE TABLE ──
  // ═══════════════════════════════════════════════════
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BRAND);
  doc.text('SUBJECT PERFORMANCE', mx, y + 1);
  y += 3;

  const subjectHeaders = ['#', 'Learning Area', 'Score', 'Out Of', '%', 'Grade', 'Points', 'Class Avg', 'Teacher', 'Remark'];
  const subjectBody = data.subjectData.map((s, i) => {
    const pct = s.maxScore > 0 ? ((s.score / s.maxScore) * 100).toFixed(0) : '0';
    const classAvg = data.classAvgPerSubject[s.name] !== undefined ? data.classAvgPerSubject[s.name].toFixed(0) : '-';
    const points = s.grade !== '-' ? String(gradePoints(s.grade as AnyGrade, isKJSEA)) : '-';
    return [
      `${i + 1}`,
      s.name,
      `${s.score}`,
      `${s.maxScore}`,
      `${pct}%`,
      s.grade !== '-' ? s.grade : '-',
      points,
      classAvg,
      s.teacherName ? s.teacherName.split(' ').map(n => n[0]).join('').toUpperCase() : (s.teacherInitials || '-'),
      s.grade !== '-' ? getGradeLabel(s.grade as AnyGrade).split(' ')[0] : '-',
    ];
  });

  autoTable(doc, {
    head: [subjectHeaders],
    body: subjectBody,
    startY: y,
    styles: { fontSize: 6, cellPadding: 1.2, lineColor: [220, 220, 220], lineWidth: 0.1 },
    headStyles: { fillColor: BRAND, textColor: WHITE, fontStyle: 'bold', fontSize: 6 },
    alternateRowStyles: { fillColor: LIGHT_BG },
    columnStyles: {
      0: { cellWidth: 5, halign: 'center' },
      1: { cellWidth: 28 },
      2: { cellWidth: 10, halign: 'center' },
      3: { cellWidth: 10, halign: 'center' },
      4: { cellWidth: 9, halign: 'center' },
      5: { cellWidth: 10, halign: 'center' },
      6: { cellWidth: 10, halign: 'center' },
      7: { cellWidth: 14, halign: 'center' },
      8: { cellWidth: 14, halign: 'center' },
    },
    margin: { left: mx, right: mx },
    didParseCell: (hookData) => {
      // Color-code grade column
      if (hookData.section === 'body' && hookData.column.index === 5) {
        const g = hookData.cell.raw as string;
        if (g.startsWith('EE')) hookData.cell.styles.textColor = [39, 174, 96];
        else if (g.startsWith('ME')) hookData.cell.styles.textColor = [41, 128, 185];
        else if (g.startsWith('AE')) hookData.cell.styles.textColor = [243, 156, 18];
        else if (g.startsWith('BE')) hookData.cell.styles.textColor = [231, 76, 60];
      }
    },
  });

  y = (doc as any).lastAutoTable.finalY + 2;

  // ── STRAND BREAKDOWN ──
  const subjectsWithStrands = data.subjectData.filter(s => s.strands && s.strands.length > 0);
  if (subjectsWithStrands.length > 0) {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BRAND);
    doc.text('STRAND PERFORMANCE', mx, y + 1);
    y += 3;

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
          (st.teacherComment || '-').substring(0, 35),
        ]);
      });
    });

    autoTable(doc, {
      head: [strandHeaders],
      body: strandBody,
      startY: y,
      styles: { fontSize: 5.5, cellPadding: 1, lineColor: [220, 220, 220], lineWidth: 0.1 },
      headStyles: { fillColor: BRAND_LIGHT as any, textColor: WHITE, fontStyle: 'bold', fontSize: 5.5 },
      alternateRowStyles: { fillColor: LIGHT_BG },
      columnStyles: {
        0: { cellWidth: 22, fontStyle: 'bold' },
        1: { cellWidth: 28 },
        2: { cellWidth: 10, halign: 'center' },
        3: { cellWidth: 10, halign: 'center' },
        4: { cellWidth: 12, halign: 'center' },
      },
      margin: { left: mx, right: mx },
    });

    y = (doc as any).lastAutoTable.finalY + 2;
  }

  // ═══════════════════════════════════════════════════
  // ── SUMMARY CARDS ROW ──
  // ═══════════════════════════════════════════════════
  const cardCount = 5;
  const cardGap = 2;
  const cardW = (cw - (cardCount - 1) * cardGap) / cardCount;
  const cardH = 13;

  const summaryCards = [
    { label: 'TOTAL', value: `${data.total}/${data.maxTotal}`, color: BRAND },
    { label: 'MEAN', value: `${data.mean.toFixed(1)}%`, color: BRAND_LIGHT },
    { label: 'GRADE', value: data.overallGrade, color: [41, 128, 185] as [number, number, number] },
    { label: 'POINTS', value: `${data.totalPoints}`, color: [142, 68, 173] as [number, number, number] },
    { label: 'RANK', value: `${data.rank}/${data.totalInClass}`, color: [230, 126, 34] as [number, number, number] },
  ];

  summaryCards.forEach((card, i) => {
    const cardX = mx + i * (cardW + cardGap);
    doc.setFillColor(...card.color);
    doc.roundedRect(cardX, y, cardW, cardH, 1.5, 1.5, 'F');
    doc.setFontSize(5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(220, 230, 240);
    doc.text(card.label, cardX + cardW / 2, y + 4.5, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...WHITE);
    doc.text(card.value, cardX + cardW / 2, y + 10.5, { align: 'center' });
  });

  y += cardH + 3;

  // ═══════════════════════════════════════════════════
  // ── PERFORMANCE GRAPH + GRADE DISTRIBUTION (side-by-side) ──
  // ═══════════════════════════════════════════════════
  const graphSectionH = 32;
  const hasTermHistory = data.termHistory && data.termHistory.length > 1;
  const hasDist = data.gradeDistribution && data.gradeDistribution.some(d => d.count > 0);

  if (data.subjectData.length > 0) {
    // Left: Subject bar chart
    const leftW = hasDist ? cw * 0.55 : (hasTermHistory ? cw * 0.58 : cw - 4);
    const graphX = mx + 2;

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BRAND);
    doc.text('SUBJECT PERFORMANCE GRAPH', graphX, y);

    // Right title
    if (hasDist) {
      doc.text('GRADE DISTRIBUTION', mx + cw * 0.58, y);
    } else if (hasTermHistory) {
      doc.text('PERFORMANCE TREND', mx + cw * 0.62, y);
    }
    y += 3;

    const barAreaW = leftW - 15;
    const barCount = data.subjectData.length;
    const groupW = barAreaW / barCount;
    const barW = Math.min(groupW * 0.35, 7);
    const graphH = graphSectionH - 6;

    // Y-axis
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.1);
    doc.line(graphX + 10, y, graphX + 10, y + graphH);
    doc.line(graphX + 10, y + graphH, graphX + 10 + barAreaW, y + graphH);

    for (let pct = 0; pct <= 100; pct += 25) {
      const ly = y + graphH - (graphH * pct / 100);
      doc.setFontSize(3.5);
      doc.setTextColor(160, 160, 160);
      doc.text(`${pct}`, graphX + 8, ly + 1, { align: 'right' });
      if (pct > 0) {
        doc.setDrawColor(242, 242, 242);
        doc.line(graphX + 10, ly, graphX + 10 + barAreaW, ly);
      }
    }

    data.subjectData.forEach((s, i) => {
      const bx = graphX + 10 + i * groupW + groupW / 2;
      const studentPct = s.maxScore > 0 ? (s.score / s.maxScore) * 100 : 0;
      const classAvg = data.classAvgPerSubject[s.name] || 0;
      const classPct = s.maxScore > 0 ? (classAvg / s.maxScore) * 100 : 0;

      // Student bar
      const sh = graphH * studentPct / 100;
      doc.setFillColor(...BRAND);
      doc.rect(bx - barW - 0.3, y + graphH - sh, barW, sh, 'F');

      // Class avg bar
      const ch = graphH * classPct / 100;
      doc.setFillColor(230, 126, 34);
      doc.rect(bx + 0.3, y + graphH - ch, barW, ch, 'F');

      // Label
      doc.setFontSize(3);
      doc.setTextColor(...DARK);
      const shortName = s.name.length > 5 ? s.name.substring(0, 4) + '..' : s.name;
      doc.text(shortName, bx, y + graphH + 3, { align: 'center' });
    });

    // Legend
    doc.setFillColor(...BRAND);
    doc.rect(graphX + 10, y + graphH + 5, 3, 1.5, 'F');
    doc.setFontSize(4);
    doc.setTextColor(...DARK);
    doc.text('Student', graphX + 14, y + graphH + 6.3);
    doc.setFillColor(230, 126, 34);
    doc.rect(graphX + 28, y + graphH + 5, 3, 1.5, 'F');
    doc.text('Class Avg', graphX + 32, y + graphH + 6.3);

    // ── RIGHT PANEL: Grade Distribution or Term Trend ──
    if (hasDist && data.gradeDistribution) {
      const distX = mx + cw * 0.58;
      const distW = cw * 0.40;
      const distH = graphH;
      const distData = data.gradeDistribution.filter(d => d.count > 0);
      const maxCount = Math.max(...distData.map(d => d.count), 1);

      distData.forEach((d, i) => {
        const rowY = y + i * (distH / distData.length);
        const rowH = distH / distData.length - 1;
        const bw = (d.count / maxCount) * (distW - 25);

        // Label
        doc.setFontSize(5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...DARK);
        doc.text(d.grade, distX + 2, rowY + rowH / 2 + 1.5);

        // Bar
        const barColor = gradeBarColor(d.grade);
        doc.setFillColor(...barColor);
        doc.roundedRect(distX + 12, rowY + 1, Math.max(bw, 1), rowH - 1, 0.5, 0.5, 'F');

        // Count
        doc.setFontSize(4.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...barColor);
        doc.text(`${d.count}`, distX + 12 + Math.max(bw, 1) + 2, rowY + rowH / 2 + 1.5);
      });
    } else if (hasTermHistory) {
      const tgX = mx + cw * 0.62;
      const tgW = cw * 0.36;
      const tgH = graphH;

      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.1);
      doc.line(tgX + 8, y, tgX + 8, y + tgH);
      doc.line(tgX + 8, y + tgH, tgX + 8 + tgW - 10, y + tgH);

      for (let pct = 0; pct <= 100; pct += 50) {
        const ly = y + tgH - (tgH * pct / 100);
        doc.setFontSize(3.5);
        doc.setTextColor(160, 160, 160);
        doc.text(`${pct}`, tgX + 6, ly + 1, { align: 'right' });
      }

      const pts = data.termHistory!;
      const stepX = (tgW - 12) / (pts.length - 1 || 1);

      doc.setDrawColor(...BRAND_LIGHT);
      doc.setLineWidth(0.5);
      for (let i = 1; i < pts.length; i++) {
        const x1 = tgX + 8 + (i - 1) * stepX;
        const y1 = y + tgH - (tgH * pts[i - 1].mean / 100);
        const x2 = tgX + 8 + i * stepX;
        const y2 = y + tgH - (tgH * pts[i].mean / 100);
        doc.line(x1, y1, x2, y2);
      }

      pts.forEach((p, i) => {
        const px = tgX + 8 + i * stepX;
        const py = y + tgH - (tgH * p.mean / 100);
        doc.setFillColor(...BRAND_LIGHT);
        doc.circle(px, py, 1, 'F');
        doc.setFontSize(4.5);
        doc.setTextColor(...DARK);
        doc.text(`${p.mean.toFixed(0)}%`, px, py - 2, { align: 'center' });
        doc.setFontSize(3.5);
        doc.setTextColor(140, 140, 140);
        doc.text(p.term, px, y + tgH + 3, { align: 'center' });
      });
    }

    y += graphSectionH + 2;
  }

  // ═══════════════════════════════════════════════════
  // ── REMARKS SECTION ──
  // ═══════════════════════════════════════════════════
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BRAND);
  doc.text('REMARKS & COMMENTS', mx, y);
  y += 3;

  // Class Teacher
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.roundedRect(mx, y, cw, 14, 1, 1, 'S');
  doc.setFillColor(...BRAND);
  doc.roundedRect(mx, y, 22, 5, 1, 1, 'F');
  doc.setFontSize(5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...WHITE);
  doc.text('CLASS TEACHER', mx + 11, y + 3.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...DARK);
  const ctText = data.classTeacherComment || '___________________________________________';
  const ctLines = doc.splitTextToSize(ctText, cw - 6);
  doc.text(ctLines.slice(0, 2), mx + 3, y + 8);
  doc.setFontSize(5);
  doc.setTextColor(...MID);
  doc.text('Sign: ______________  Date: ______________', mx + 3, y + 12.5);
  y += 16;

  // Principal
  doc.roundedRect(mx, y, cw, 14, 1, 1, 'S');
  doc.setFillColor(142, 68, 173);
  doc.roundedRect(mx, y, 18, 5, 1, 1, 'F');
  doc.setFontSize(5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...WHITE);
  doc.text('PRINCIPAL', mx + 9, y + 3.5, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(...DARK);
  const prText = data.principalComment || '___________________________________________';
  const prLines = doc.splitTextToSize(prText, cw - 6);
  doc.text(prLines.slice(0, 2), mx + 3, y + 8);
  doc.setFontSize(5);
  doc.setTextColor(...MID);
  doc.text('Sign: ______________  Date: ______________  Stamp:', mx + 3, y + 12.5);
  y += 16;

  // ═══════════════════════════════════════════════════
  // ── CALENDAR + QR FOOTER ──
  // ═══════════════════════════════════════════════════
  if (closingDate || openingDate || data.appUrl) {
    const calH = 12;
    doc.setFillColor(...LIGHT_BG);
    doc.roundedRect(mx, y, cw, calH, 1, 1, 'F');

    if (closingDate || openingDate) {
      doc.setFontSize(5.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...DARK);
      doc.text('SCHOOL CALENDAR', mx + 3, y + 4);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5);
      doc.setTextColor(...MID);
      if (closingDate) doc.text(`Closing: ${closingDate}`, mx + 3, y + 7.5);
      if (openingDate) doc.text(`Opening: ${openingDate}`, mx + 3, y + 10.5);
    }

    if (data.appUrl) {
      const qrUrl = `${data.appUrl}/parent-dashboard?learner=${data.learner.id}`;
      const qrBase64 = await generateQRCodeBase64(qrUrl);
      if (qrBase64) {
        const qrSize = 10;
        doc.addImage(qrBase64, 'PNG', pw - mx - qrSize - 1, y + 1, qrSize, qrSize);
        doc.setFontSize(3.5);
        doc.setTextColor(140, 140, 140);
        doc.text('Parent Portal', pw - mx - qrSize / 2 - 1, y + calH - 0.5, { align: 'center' });
      }
    }

    y += calH + 1;
  }

  // ── FOOTER BAND ──
  doc.setFillColor(...BRAND);
  doc.rect(0, ph - 5, pw, 5, 'F');
  doc.setFontSize(4);
  doc.setTextColor(200, 215, 200);
  doc.text('Generated by PerformTrack — CBC Smart School Management System', cx, ph - 1.5, { align: 'center' });

  return doc;
}

// Helper: get grade points for the correct scale
function gradePoints(grade: AnyGrade, isKJSEA: boolean): number {
  const kjseaPts: Record<string, number> = { EE1: 8, EE2: 7, ME1: 6, ME2: 5, AE1: 4, AE2: 3, BE1: 2, BE2: 1 };
  const kpseaPts: Record<string, number> = { EE: 4, ME: 3, AE: 2, BE: 1 };
  if (isKJSEA && kjseaPts[grade]) return kjseaPts[grade];
  if (!isKJSEA && kpseaPts[grade]) return kpseaPts[grade];
  return kjseaPts[grade] || kpseaPts[grade] || 0;
}
