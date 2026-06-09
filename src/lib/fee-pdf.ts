import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export interface FeeBreakdownItem {
  feeType: string;
  charged: number;
  paid: number;
}

export interface FeeReceiptData {
  receiptNumber: string;
  date: string;
  learnerName: string;
  admissionNumber: string;
  grade: string;
  stream: string;
  feeType: string;
  amountPaid: number;
  paymentMethod: string;
  mpesaReference?: string | null;
  description?: string | null;
  termBalance: number; // remaining balance for term/year
  totalBalance: number; // overall outstanding balance
  receivedBy: string;
  schoolName: string;
  schoolAddress?: string;
  schoolPhone?: string;
  schoolEmail?: string;
  schoolMotto?: string;
  logoBase64?: string | null;
  term?: number;
  year?: number;
  // Consolidated breakdown of all fee components for the term
  breakdown?: FeeBreakdownItem[];
  termCharged?: number;
  termPaid?: number;
}

export interface FeeStatementRow {
  date: string;
  description: string;
  charged: number;
  paid: number;
  balance: number;
  receipt?: string | null;
}

export interface FeeStatementData {
  learnerName: string;
  admissionNumber: string;
  grade: string;
  stream: string;
  rows: FeeStatementRow[];
  totalCharged: number;
  totalPaid: number;
  outstanding: number;
  generatedAt: string;
  schoolName: string;
  schoolAddress?: string;
  schoolPhone?: string;
  schoolEmail?: string;
  logoBase64?: string | null;
}

const fmtKES = (n: number) => `KES ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function header(doc: jsPDF, school: { name: string; address?: string; phone?: string; email?: string; motto?: string; logo?: string | null }) {
  if (school.logo) {
    try { doc.addImage(school.logo, 'PNG', 14, 10, 22, 22); } catch {}
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(26, 92, 46);
  doc.text(school.name, 40, 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  if (school.motto) doc.text(school.motto, 40, 21);
  const line2 = [school.address, school.phone, school.email].filter(Boolean).join(' • ');
  if (line2) doc.text(line2, 40, 26);
  doc.setDrawColor(26, 92, 46);
  doc.setLineWidth(0.6);
  doc.line(14, 34, 196, 34);
}

export function generateFeeReceiptPDF(data: FeeReceiptData) {
  const doc = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait' }); // A5 receipt
  const W = doc.internal.pageSize.getWidth();
  header(doc, {
    name: data.schoolName, address: data.schoolAddress, phone: data.schoolPhone,
    email: data.schoolEmail, motto: data.schoolMotto, logo: data.logoBase64,
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  doc.text('OFFICIAL FEE RECEIPT', W / 2, 42, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Receipt #: ${data.receiptNumber}`, 14, 50);
  doc.text(`Date: ${data.date}`, W - 14, 50, { align: 'right' });

  autoTable(doc, {
    startY: 54,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1.5 },
    body: [
      ['Received from:', `${data.learnerName} (${data.admissionNumber})`],
      ['Class:', `Grade ${data.grade} ${data.stream}`],
      ['Fee item:', data.feeType.toUpperCase()],
      ['Payment method:', data.paymentMethod.toUpperCase() + (data.mpesaReference ? ` — Ref ${data.mpesaReference}` : '')],
      ...(data.description ? [['Description:', data.description]] : []),
    ],
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 35 } },
  });

  const y = (doc as any).lastAutoTable.finalY + 4;
  doc.setFillColor(240, 248, 240);
  doc.rect(14, y, W - 28, 16, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(26, 92, 46);
  doc.text('AMOUNT RECEIVED', 18, y + 6);
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(fmtKES(data.amountPaid), W - 18, y + 11, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text(`Term balance after this payment: ${fmtKES(data.termBalance)}`, 14, y + 24);
  doc.text(`Overall outstanding balance: ${fmtKES(data.totalBalance)}`, 14, y + 30);

  // Footer
  const footY = doc.internal.pageSize.getHeight() - 20;
  doc.setDrawColor(180, 180, 180);
  doc.line(14, footY, W - 14, footY);
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(`Received by: ${data.receivedBy}`, 14, footY + 5);
  doc.text('This is a computer-generated receipt.', W - 14, footY + 5, { align: 'right' });
  doc.text(`Signature: __________________________`, 14, footY + 11);

  doc.save(`Receipt-${data.receiptNumber}.pdf`);
}

export function generateFeeStatementPDF(data: FeeStatementData) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const W = doc.internal.pageSize.getWidth();
  header(doc, {
    name: data.schoolName, address: data.schoolAddress, phone: data.schoolPhone, email: data.schoolEmail, logo: data.logoBase64,
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('STATEMENT OF ACCOUNT', W / 2, 42, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Learner: ${data.learnerName}  (${data.admissionNumber})`, 14, 50);
  doc.text(`Class: Grade ${data.grade} ${data.stream}`, 14, 55);
  doc.text(`Generated: ${data.generatedAt}`, W - 14, 50, { align: 'right' });

  autoTable(doc, {
    startY: 60,
    head: [['Date', 'Description', 'Charged (KES)', 'Paid (KES)', 'Balance (KES)', 'Receipt']],
    body: data.rows.map(r => [
      r.date,
      r.description,
      r.charged ? r.charged.toLocaleString() : '-',
      r.paid ? r.paid.toLocaleString() : '-',
      r.balance.toLocaleString(),
      r.receipt || '-',
    ]),
    headStyles: { fillColor: [26, 92, 46], textColor: 255, fontSize: 9 },
    styles: { fontSize: 8.5 },
    columnStyles: {
      2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right', fontStyle: 'bold' },
    },
  });

  const y = (doc as any).lastAutoTable.finalY + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`Total Charged: ${fmtKES(data.totalCharged)}`, 14, y);
  doc.text(`Total Paid: ${fmtKES(data.totalPaid)}`, 14, y + 6);
  doc.setTextColor(data.outstanding > 0 ? 200 : 26, data.outstanding > 0 ? 30 : 92, data.outstanding > 0 ? 30 : 46);
  doc.text(`Outstanding Balance: ${fmtKES(data.outstanding)}`, 14, y + 12);

  doc.save(`Statement-${data.admissionNumber}.pdf`);
}

export interface CollectionReportRow {
  date: string;
  receipt: string;
  learner: string;
  admission: string;
  grade: string;
  stream: string;
  feeType: string;
  method: string;
  reference: string;
  amount: number;
}

export function generateCollectionReportPDF(opts: {
  rows: CollectionReportRow[];
  title: string;
  periodLabel: string;
  schoolName: string;
  schoolAddress?: string;
  schoolPhone?: string;
  schoolEmail?: string;
  logoBase64?: string | null;
  totals: { byMethod: Record<string, number>; byType: Record<string, number>; grandTotal: number };
}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const W = doc.internal.pageSize.getWidth();
  header(doc, {
    name: opts.schoolName, address: opts.schoolAddress, phone: opts.schoolPhone, email: opts.schoolEmail, logo: opts.logoBase64,
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(opts.title, W / 2, 42, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(opts.periodLabel, W / 2, 47, { align: 'center' });

  autoTable(doc, {
    startY: 52,
    head: [['Date', 'Receipt', 'Learner', 'Adm #', 'Grade', 'Type', 'Method', 'Ref', 'Amount (KES)']],
    body: opts.rows.map(r => [r.date, r.receipt, r.learner, r.admission, `${r.grade} ${r.stream}`, r.feeType, r.method, r.reference, r.amount.toLocaleString()]),
    headStyles: { fillColor: [26, 92, 46], textColor: 255, fontSize: 9 },
    styles: { fontSize: 8 },
    columnStyles: { 8: { halign: 'right', fontStyle: 'bold' } },
  });

  let y = (doc as any).lastAutoTable.finalY + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Summary', 14, y); y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('By Method:', 14, y);
  Object.entries(opts.totals.byMethod).forEach(([k, v], i) => {
    doc.text(`${k.toUpperCase()}: ${fmtKES(v)}`, 40 + (i % 4) * 60, y + Math.floor(i / 4) * 5);
  });
  y += Math.ceil(Object.keys(opts.totals.byMethod).length / 4) * 5 + 4;
  doc.text('By Fee Type:', 14, y);
  Object.entries(opts.totals.byType).forEach(([k, v], i) => {
    doc.text(`${k.toUpperCase()}: ${fmtKES(v)}`, 40 + (i % 4) * 60, y + Math.floor(i / 4) * 5);
  });
  y += Math.ceil(Object.keys(opts.totals.byType).length / 4) * 5 + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(26, 92, 46);
  doc.text(`GRAND TOTAL: ${fmtKES(opts.totals.grandTotal)}`, 14, y);

  doc.save(`${opts.title.replace(/\s+/g, '-')}.pdf`);
}

export function exportCollectionReportXLSX(rows: CollectionReportRow[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(rows.map(r => ({
    Date: r.date, Receipt: r.receipt, Learner: r.learner, 'Adm #': r.admission,
    Grade: r.grade, Stream: r.stream, 'Fee Type': r.feeType, Method: r.method, Reference: r.reference, 'Amount (KES)': r.amount,
  })));
  const total = rows.reduce((s, r) => s + r.amount, 0);
  XLSX.utils.sheet_add_aoa(ws, [['', '', '', '', '', '', '', 'TOTAL', total]], { origin: -1 });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Collections');
  XLSX.writeFile(wb, filename);
}
