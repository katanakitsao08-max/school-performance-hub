// Generates a CBC Competency Certificate PDF when a learner reaches Meeting/Exceeding
// on a topic or passes a mock exam.
import jsPDF from "jspdf";

export type CertificateInput = {
  learnerName: string;
  grade: string;
  title: string;          // e.g. "Mathematics — Numbers" or "KPSEA Mock Exam"
  competency: string;     // "Meeting Expectation" etc.
  scorePercent?: number;
  issuedAt?: Date;
  issuer?: string;        // school name or "PerformTrack"
};

export function downloadCertificatePdf(input: CertificateInput) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // Background frame
  doc.setFillColor(245, 250, 247);
  doc.rect(0, 0, W, H, "F");
  doc.setDrawColor(34, 113, 71);
  doc.setLineWidth(2);
  doc.rect(8, 8, W - 16, H - 16);
  doc.setLineWidth(0.4);
  doc.rect(12, 12, W - 24, H - 24);

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(34, 113, 71);
  doc.text("CBC COMPETENCY CERTIFICATE", W / 2, 28, { align: "center" });

  doc.setFontSize(28);
  doc.setTextColor(20, 20, 30);
  doc.text("Certificate of Achievement", W / 2, 50, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(80, 80, 90);
  doc.text("This certificate is proudly presented to", W / 2, 64, { align: "center" });

  // Name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(32);
  doc.setTextColor(20, 20, 30);
  doc.text(input.learnerName, W / 2, 84, { align: "center" });
  doc.setLineWidth(0.6);
  doc.setDrawColor(34, 113, 71);
  const nameW = Math.min(180, doc.getTextWidth(input.learnerName) + 20);
  doc.line(W / 2 - nameW / 2, 88, W / 2 + nameW / 2, 88);

  // Body
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(60, 60, 70);
  const body = `For achieving "${input.competency}" in ${input.title} (${input.grade}) on the PerformTrack Continuous Learning Platform.`;
  const lines = doc.splitTextToSize(body, W - 60);
  doc.text(lines, W / 2, 104, { align: "center" });

  if (typeof input.scorePercent === "number") {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(34, 113, 71);
    doc.text(`Score: ${input.scorePercent.toFixed(1)}%`, W / 2, 132, { align: "center" });
  }

  // Footer
  const issued = (input.issuedAt || new Date()).toLocaleDateString();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(110, 110, 120);
  doc.text(`Issued: ${issued}`, 30, H - 22);
  doc.text(`Issued by: ${input.issuer || "PerformTrack"}`, W - 30, H - 22, { align: "right" });

  doc.save(`${input.learnerName.replace(/\s+/g, "_")}_${input.title.replace(/\s+/g, "_")}_certificate.pdf`);
}

export function downloadNotesPdf(opts: {
  title: string; subject?: string; grade?: string; contentMd: string;
}) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const margin = 18;
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(20, 20, 30);
  doc.text(opts.title, margin, y);
  y += 7;
  if (opts.subject || opts.grade) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 110);
    doc.text([opts.subject, opts.grade].filter(Boolean).join(" · "), margin, y);
    y += 6;
  }
  doc.setDrawColor(220, 220, 230);
  doc.line(margin, y, W - margin, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(40, 40, 50);

  // Very light markdown rendering: headings (#, ##), bullets (-, *), blank lines, the rest as paragraphs.
  const lines = opts.contentMd.split(/\r?\n/);
  for (const raw of lines) {
    if (y > 280) { doc.addPage(); y = margin; }
    const line = raw.trimEnd();
    if (!line.trim()) { y += 3; continue; }
    if (/^###\s+/.test(line)) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(11.5);
      doc.text(line.replace(/^###\s+/, ""), margin, y); y += 5.5;
      doc.setFont("helvetica", "normal"); doc.setFontSize(11);
    } else if (/^##\s+/.test(line)) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(13);
      doc.text(line.replace(/^##\s+/, ""), margin, y); y += 6.5;
      doc.setFont("helvetica", "normal"); doc.setFontSize(11);
    } else if (/^#\s+/.test(line)) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(14);
      doc.text(line.replace(/^#\s+/, ""), margin, y); y += 7;
      doc.setFont("helvetica", "normal"); doc.setFontSize(11);
    } else if (/^\s*[-*]\s+/.test(line)) {
      const text = line.replace(/^\s*[-*]\s+/, "");
      const wrapped = doc.splitTextToSize(`• ${text}`, W - margin * 2 - 4);
      doc.text(wrapped, margin + 2, y); y += wrapped.length * 5;
    } else {
      const wrapped = doc.splitTextToSize(line, W - margin * 2);
      doc.text(wrapped, margin, y); y += wrapped.length * 5;
    }
  }

  doc.save(`${opts.title.replace(/\s+/g, "_")}.pdf`);
}
