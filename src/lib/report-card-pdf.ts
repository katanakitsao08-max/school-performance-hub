import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getGrade, getGradeLabel, type CBCGrade } from './cbc-utils';
import QRCode from 'qrcode';

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
    return await QRCode.toDataURL(text, { width: 100, margin: 1, color: { dark: '#000000', light: '#ffffff' } });
  } catch { return null; }
}

export async function generatePremiumReportCard(data: ReportCardData): Promise<jsPDF> {
  const doc = new jsPDF({ format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const mx = 14; // margin x
  const cw = pw - mx * 2; // content width
  const cx = pw / 2;

  const ss = data.schoolSettings;
  const schoolName = ss['school_name'] || 'SCHOOL';
  const schoolMotto = ss['school_motto'] || '';
  const schoolAddress = ss['school_address'] || '';
  const schoolPhone = ss['school_phone'] || '';
  const schoolEmail = ss['school_email'] || '';
  const closingDate = ss['closing_date'] || '';
  const openingDate = ss['opening_date'] || '';

  // ─── COLORS ───
  const primary: [number, number, number] = [41, 128, 185]; // blue
  const dark: [number, number, number] = [44, 62, 80];
  const light: [number, number, number] = [236, 240, 241];

  let y = 10;

  // ═══════════════════════════════════════════════
  //  HEADER BAND
  // ═══════════════════════════════════════════════
  doc.setFillColor(...primary);
  doc.rect(0, 0, pw, 4, 'F');

  // Logo
  if (data.logoBase64) {
    const logoSize = 20;
    doc.addImage(data.logoBase64, 'PNG', cx - logoSize / 2, y, logoSize, logoSize);
    y += logoSize + 3;
  } else {
    y += 5;
  }

  // School Name
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...dark);
  doc.text(schoolName.toUpperCase(), cx, y, { align: 'center' });
  y += 6;

  if (schoolMotto) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 100, 100);
    doc.text(`"${schoolMotto}"`, cx, y, { align: 'center' });
    y += 5;
  }

  // Contact line
  const contactParts = [schoolAddress, schoolPhone, schoolEmail].filter(Boolean);
  if (contactParts.length) {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text(contactParts.join(' • '), cx, y, { align: 'center' });
    y += 4;
  }

  // Divider
  doc.setDrawColor(...primary);
  doc.setLineWidth(0.8);
  doc.line(mx, y, pw - mx, y);
  y += 2;
  doc.setLineWidth(0.3);
  doc.line(mx, y, pw - mx, y);
  y += 6;

  // ═══════════════════════════════════════════════
  //  REPORT TITLE
  // ═══════════════════════════════════════════════
  doc.setFillColor(...light);
  doc.roundedRect(mx, y - 3, cw, 10, 2, 2, 'F');
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...dark);
  doc.text('ACADEMIC PERFORMANCE REPORT', cx, y + 4, { align: 'center' });
  y += 14;

  // ═══════════════════════════════════════════════
  //  STUDENT INFO CARD
  // ═══════════════════════════════════════════════
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.roundedRect(mx, y - 3, cw, 28, 2, 2, 'S');

  const col1 = mx + 4;
  const col2 = mx + cw / 2;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);

  const infoRow = (label: string, value: string, x: number, yp: number) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`${label}:`, x, yp);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...dark);
    doc.text(value, x + doc.getTextWidth(`${label}: `) + 1, yp);
  };

  infoRow('Student Name', data.learner.full_name, col1, y + 2);
  infoRow('Admission No', data.learner.admission_number, col2, y + 2);
  infoRow('Class', `Grade ${data.learner.grade} ${data.learner.stream}`, col1, y + 9);
  infoRow('Gender', data.learner.gender, col2, y + 9);
  infoRow('Term', `${data.selectedTerm} (${data.assessmentLabel})`, col1, y + 16);
  infoRow('Year', `${data.selectedYear}`, col2, y + 16);

  y += 30;

  // ═══════════════════════════════════════════════
  //  SUBJECT PERFORMANCE TABLE
  // ═══════════════════════════════════════════════
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...dark);
  doc.text('SUBJECT PERFORMANCE', mx, y);
  y += 3;

  const subjectHeaders = ['#', 'Subject', 'Score', 'Max', '%', 'Grade', 'Class Avg', 'Teacher', 'Comment'];
  const subjectBody = data.subjectData.map((s, i) => {
    const pct = s.maxScore > 0 ? ((s.score / s.maxScore) * 100).toFixed(0) : '0';
    const classAvg = data.classAvgPerSubject[s.name] !== undefined ? data.classAvgPerSubject[s.name].toFixed(1) : '-';
    return [
      `${i + 1}`,
      s.name,
      `${s.score}`,
      `${s.maxScore}`,
      `${pct}%`,
      s.grade !== '-' ? `${s.grade} (${getGradeLabel(s.grade as CBCGrade)})` : '-',
      classAvg,
      s.teacherName || s.teacherInitials || '-',
      s.grade !== '-' ? getGradeLabel(s.grade as CBCGrade).split(' ')[0] : '-',
    ];
  });

  autoTable(doc, {
    head: [subjectHeaders],
    body: subjectBody,
    startY: y,
    styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: primary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: [248, 249, 250] },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 30 },
      4: { halign: 'center' },
      5: { cellWidth: 32 },
      6: { halign: 'center', cellWidth: 16 },
    },
    margin: { left: mx, right: mx },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // ═══════════════════════════════════════════════
  //  PERFORMANCE SUMMARY CARDS
  // ═══════════════════════════════════════════════
  const cardW = (cw - 12) / 4;
  const cardH = 18;
  const summaryItems = [
    { label: 'Total Marks', value: `${data.total}/${data.maxTotal}` },
    { label: 'Mean Score', value: `${data.mean.toFixed(1)}%` },
    { label: 'Stream Position', value: `${data.streamRank}/${data.totalInStream}` },
    { label: 'Overall Position', value: `${data.rank}/${data.totalInClass}` },
  ];

  summaryItems.forEach((item, i) => {
    const cardX = mx + i * (cardW + 4);
    doc.setFillColor(...(i === 0 ? primary : i === 1 ? [39, 174, 96] as [number, number, number] : i === 2 ? [142, 68, 173] as [number, number, number] : [230, 126, 34] as [number, number, number]));
    doc.roundedRect(cardX, y, cardW, cardH, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(255, 255, 255);
    doc.text(item.label, cardX + cardW / 2, y + 5, { align: 'center' });
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(item.value, cardX + cardW / 2, y + 13, { align: 'center' });
  });

  y += cardH + 4;

  // Additional stats row
  const statsRow2 = [
    { label: 'Overall Grade', value: data.overallGrade !== '-' ? `${data.overallGrade} (${getGradeLabel(data.overallGrade as CBCGrade)})` : '-' },
    { label: 'Total Points', value: `${data.totalPoints}` },
    { label: 'Mean Grade', value: data.overallGrade },
  ];
  
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(mx, y, cw, 12, 2, 2, 'F');
  const statW = cw / 3;
  statsRow2.forEach((item, i) => {
    const sx = mx + i * statW + statW / 2;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text(item.label, sx, y + 4, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...dark);
    doc.text(item.value, sx, y + 9, { align: 'center' });
  });

  y += 16;

  // ═══════════════════════════════════════════════
  //  PERFORMANCE GRAPH (Student vs Class Average)
  // ═══════════════════════════════════════════════
  if (data.subjectData.length > 0) {
    // Check if we need a new page
    if (y + 60 > ph - 30) { doc.addPage(); y = 15; }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...dark);
    doc.text('PERFORMANCE COMPARISON: Student vs Class Average', mx, y);
    y += 5;

    const graphX = mx + 5;
    const graphW = cw - 10;
    const graphH = 45;
    const barAreaW = graphW - 20;
    const barCount = data.subjectData.length;
    const groupW = barAreaW / barCount;
    const barW = Math.min(groupW * 0.35, 12);

    // Y-axis
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(graphX + 15, y, graphX + 15, y + graphH);
    doc.line(graphX + 15, y + graphH, graphX + 15 + barAreaW, y + graphH);

    // Y-axis labels
    for (let pct = 0; pct <= 100; pct += 25) {
      const ly = y + graphH - (graphH * pct / 100);
      doc.setFontSize(5);
      doc.setTextColor(150, 150, 150);
      doc.text(`${pct}`, graphX + 12, ly + 1.5, { align: 'right' });
      doc.setDrawColor(240, 240, 240);
      doc.line(graphX + 15, ly, graphX + 15 + barAreaW, ly);
    }

    data.subjectData.forEach((s, i) => {
      const bx = graphX + 15 + i * groupW + groupW / 2;
      const studentPct = s.maxScore > 0 ? (s.score / s.maxScore) * 100 : 0;
      const classAvg = data.classAvgPerSubject[s.name] || 0;
      const classPct = s.maxScore > 0 ? (classAvg / s.maxScore) * 100 : 0;

      // Student bar
      const sh = graphH * studentPct / 100;
      doc.setFillColor(...primary);
      doc.rect(bx - barW - 0.5, y + graphH - sh, barW, sh, 'F');

      // Class avg bar
      const ch = graphH * classPct / 100;
      doc.setFillColor(230, 126, 34);
      doc.rect(bx + 0.5, y + graphH - ch, barW, ch, 'F');

      // Subject label
      doc.setFontSize(4.5);
      doc.setTextColor(...dark);
      const shortName = s.name.length > 8 ? s.name.substring(0, 7) + '..' : s.name;
      doc.text(shortName, bx, y + graphH + 4, { align: 'center' });
    });

    // Legend
    const legY = y + graphH + 8;
    doc.setFillColor(...primary);
    doc.rect(cx - 30, legY, 4, 3, 'F');
    doc.setFontSize(6);
    doc.setTextColor(...dark);
    doc.text('Student', cx - 25, legY + 2.5);
    doc.setFillColor(230, 126, 34);
    doc.rect(cx + 5, legY, 4, 3, 'F');
    doc.text('Class Avg', cx + 10, legY + 2.5);

    y += graphH + 15;
  }

  // ═══════════════════════════════════════════════
  //  TERM TREND GRAPH
  // ═══════════════════════════════════════════════
  if (data.termHistory && data.termHistory.length > 1) {
    if (y + 50 > ph - 30) { doc.addPage(); y = 15; }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...dark);
    doc.text('PERFORMANCE TREND OVER TIME', mx, y);
    y += 5;

    const tgX = mx + 20;
    const tgW = cw - 40;
    const tgH = 35;

    // Axes
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(tgX, y, tgX, y + tgH);
    doc.line(tgX, y + tgH, tgX + tgW, y + tgH);

    // Y labels
    for (let pct = 0; pct <= 100; pct += 25) {
      const ly = y + tgH - (tgH * pct / 100);
      doc.setFontSize(5);
      doc.setTextColor(150, 150, 150);
      doc.text(`${pct}`, tgX - 3, ly + 1.5, { align: 'right' });
      doc.setDrawColor(245, 245, 245);
      doc.line(tgX, ly, tgX + tgW, ly);
    }

    const pts = data.termHistory;
    const stepX = tgW / (pts.length - 1 || 1);

    // Line
    doc.setDrawColor(...primary);
    doc.setLineWidth(0.6);
    for (let i = 1; i < pts.length; i++) {
      const x1 = tgX + (i - 1) * stepX;
      const y1 = y + tgH - (tgH * pts[i - 1].mean / 100);
      const x2 = tgX + i * stepX;
      const y2 = y + tgH - (tgH * pts[i].mean / 100);
      doc.line(x1, y1, x2, y2);
    }

    // Points + labels
    pts.forEach((p, i) => {
      const px = tgX + i * stepX;
      const py = y + tgH - (tgH * p.mean / 100);
      doc.setFillColor(...primary);
      doc.circle(px, py, 1.5, 'F');
      doc.setFontSize(6);
      doc.setTextColor(...dark);
      doc.text(`${p.mean.toFixed(0)}%`, px, py - 3, { align: 'center' });
      doc.setFontSize(5.5);
      doc.setTextColor(120, 120, 120);
      doc.text(p.term, px, y + tgH + 4, { align: 'center' });
    });

    y += tgH + 10;
  }

  // ═══════════════════════════════════════════════
  //  REMARKS SECTION
  // ═══════════════════════════════════════════════
  if (y + 50 > ph - 30) { doc.addPage(); y = 15; }

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...dark);
  doc.text('REMARKS & SIGNATURES', mx, y);
  y += 5;

  // Class Teacher Remarks
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.roundedRect(mx, y, cw, 20, 2, 2, 'S');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primary);
  doc.text("Class Teacher's Remarks:", mx + 3, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...dark);
  const ctLines = doc.splitTextToSize(data.classTeacherComment || '___________________________________', cw - 10);
  doc.text(ctLines, mx + 3, y + 10);

  doc.setFontSize(6.5);
  doc.setTextColor(150, 150, 150);
  doc.text('Sign: _______________  Date: _______________', mx + 3, y + 17);
  y += 24;

  // Principal Remarks
  doc.roundedRect(mx, y, cw, 20, 2, 2, 'S');
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primary);
  doc.text("Principal's Remarks:", mx + 3, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...dark);
  const prLines = doc.splitTextToSize(data.principalComment || '___________________________________', cw - 10);
  doc.text(prLines, mx + 3, y + 10);

  doc.setFontSize(6.5);
  doc.setTextColor(150, 150, 150);
  doc.text('Sign: _______________  Date: _______________  School Stamp:', mx + 3, y + 17);
  y += 24;

  // ═══════════════════════════════════════════════
  //  SCHOOL CALENDAR + QR CODE
  // ═══════════════════════════════════════════════
  if (closingDate || openingDate || data.appUrl) {
    if (y + 30 > ph - 10) { doc.addPage(); y = 15; }

    const calQrH = 22;
    doc.setFillColor(248, 249, 250);
    doc.roundedRect(mx, y, cw, calQrH, 2, 2, 'F');

    // Calendar section
    if (closingDate || openingDate) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...dark);
      doc.text('SCHOOL CALENDAR', mx + 4, y + 6);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      if (closingDate) doc.text(`Closing Date: ${closingDate}`, mx + 4, y + 12);
      if (openingDate) doc.text(`Opening Date: ${openingDate}`, mx + 4, y + 17);
    }

    // QR Code
    if (data.appUrl) {
      const qrUrl = `${data.appUrl}/parent-dashboard?learner=${data.learner.id}`;
      const qrBase64 = await generateQRCodeBase64(qrUrl);
      if (qrBase64) {
        const qrSize = 18;
        doc.addImage(qrBase64, 'PNG', pw - mx - qrSize - 2, y + 2, qrSize, qrSize);
        doc.setFontSize(5);
        doc.setTextColor(120, 120, 120);
        doc.text('Scan for online portal', pw - mx - qrSize / 2 - 2, y + calQrH - 1, { align: 'center' });
      }
    }

    y += calQrH + 4;
  }

  // ═══════════════════════════════════════════════
  //  FOOTER
  // ═══════════════════════════════════════════════
  doc.setFillColor(...primary);
  doc.rect(0, ph - 6, pw, 6, 'F');
  doc.setFontSize(5.5);
  doc.setTextColor(255, 255, 255);
  doc.text('Generated by PerformTrack — CBC Smart School Management System', cx, ph - 2, { align: 'center' });

  return doc;
}
