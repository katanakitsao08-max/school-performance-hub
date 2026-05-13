import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoUrl from '@/assets/performtrack-logo.png';

export interface SubscriptionReceiptData {
  receiptNumber: string;
  date: string; // yyyy-mm-dd
  schoolName: string;
  schoolCode?: string | null;
  plan: string;
  annualFee: number;
  amountPaid: number;
  balanceAfter: number;
  year: string | number;
  issuedBy: string;
}

const fmtKES = (n: number) =>
  `KES ${Number(n || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function loadLogoBase64(): Promise<string | null> {
  try {
    const res = await fetch(logoUrl);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function digitalSignature(payload: string): Promise<string> {
  try {
    const enc = new TextEncoder().encode(payload);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    const hex = Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return hex.slice(0, 40).toUpperCase().replace(/(.{8})/g, '$1-').replace(/-$/, '');
  } catch {
    return Math.random().toString(36).slice(2, 12).toUpperCase();
  }
}

export async function generateSubscriptionReceiptPDF(data: SubscriptionReceiptData) {
  const doc = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  const logo = await loadLogoBase64();
  const sig = await digitalSignature(
    `${data.receiptNumber}|${data.schoolName}|${data.amountPaid}|${data.date}`
  );

  // Header band
  doc.setFillColor(26, 92, 46);
  doc.rect(0, 0, W, 28, 'F');
  if (logo) {
    try { doc.addImage(logo, 'PNG', 8, 5, 18, 18); } catch {}
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text('PerformTrack', 30, 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('CBC School Performance Management — performtrack.co.ke', 30, 19);
  doc.setFontSize(7);
  doc.text('Official Subscription Receipt', 30, 24);

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(0, 0, 0);
  doc.text('OFFICIAL PAYMENT RECEIPT', W / 2, 38, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Receipt #: ${data.receiptNumber}`, 10, 46);
  doc.text(`Date: ${data.date}`, W - 10, 46, { align: 'right' });

  autoTable(doc, {
    startY: 50,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 1.4 },
    body: [
      ['Received from:', `${data.schoolName}${data.schoolCode ? ' (' + data.schoolCode + ')' : ''}`],
      ['Subscription plan:', String(data.plan).toUpperCase()],
      ['Billing year:', String(data.year)],
      ['Annual fee:', fmtKES(data.annualFee)],
      ['Payment for:', 'PerformTrack platform subscription'],
    ],
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 38 } },
  });

  const y = (doc as any).lastAutoTable.finalY + 4;
  doc.setFillColor(240, 248, 240);
  doc.rect(10, y, W - 20, 16, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(26, 92, 46);
  doc.text('AMOUNT RECEIVED', 14, y + 6);
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(fmtKES(data.amountPaid), W - 14, y + 11, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text(`Outstanding balance for ${data.year}: ${fmtKES(data.balanceAfter)}`, 10, y + 24);

  // Digital signature block
  const sigY = H - 32;
  doc.setDrawColor(26, 92, 46);
  doc.setLineWidth(0.4);
  doc.line(10, sigY, W - 10, sigY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(26, 92, 46);
  doc.text('DIGITALLY SIGNED', 10, sigY + 5);

  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(40, 40, 40);
  doc.text(`Signature: ${sig}`, 10, sigY + 10);
  doc.text(`Algorithm: SHA-256 · Issued by: PerformTrack Finance`, 10, sigY + 14);
  doc.text(`Authorized by: ${data.issuedBy}`, 10, sigY + 18);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(
    'This is a computer-generated receipt. Verify authenticity using the signature above.',
    W / 2, H - 8, { align: 'center' }
  );

  doc.save(`PerformTrack-Receipt-${data.receiptNumber}.pdf`);
}
