import jsPDF from "jspdf";

export type CertInput = {
  learnerName: string;
  courseTitle: string;
  certificateNo: string;
  issuedAt: string;          // ISO
  instructor?: string | null;
  scorePercent?: number | null;
  brand?: string;            // default "PerformTrack LMS"
};

/** Build a landscape A4 certificate and download it. */
export function downloadCertificatePdf(input: CertInput) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const brand = input.brand || "PerformTrack LMS";

  // Outer frame
  doc.setDrawColor(20, 100, 60);
  doc.setLineWidth(2);
  doc.rect(8, 8, w - 16, h - 16);
  doc.setLineWidth(0.4);
  doc.rect(12, 12, w - 24, h - 24);

  // Brand
  doc.setTextColor(20, 100, 60);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(brand, w / 2, 24, { align: "center" });

  // Title
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(34);
  doc.text("Certificate of Completion", w / 2, 50, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.text("This is proudly presented to", w / 2, 65, { align: "center" });

  // Name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(20, 100, 60);
  doc.text(input.learnerName, w / 2, 85, { align: "center" });
  doc.setDrawColor(180, 180, 180);
  doc.line(w / 2 - 80, 90, w / 2 + 80, 90);

  // Body
  doc.setFont("helvetica", "normal");
  doc.setFontSize(13);
  doc.setTextColor(50, 50, 50);
  doc.text(`for successfully completing the course`, w / 2, 100, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(20, 20, 20);
  doc.text(input.courseTitle, w / 2, 112, { align: "center" });

  if (input.scorePercent != null) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(80, 80, 80);
    doc.text(`Final score: ${input.scorePercent}%`, w / 2, 122, { align: "center" });
  }

  // Footer signatures
  const date = new Date(input.issuedAt).toLocaleDateString();
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  doc.text(`Issued: ${date}`, 30, h - 25);
  doc.text(`Certificate No: ${input.certificateNo}`, 30, h - 20);

  if (input.instructor) {
    doc.text(`Instructor: ${input.instructor}`, w - 30, h - 25, { align: "right" });
  }
  doc.text(`${brand} • performtrack.co.ke`, w - 30, h - 20, { align: "right" });

  const safe = input.learnerName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`certificate-${safe}-${input.certificateNo}.pdf`);
}
