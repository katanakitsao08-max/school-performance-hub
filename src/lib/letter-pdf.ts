import jsPDF from "jspdf";

export type Letterhead = {
  schoolName?: string;
  motto?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  logoUrl?: string;
  signatureUrl?: string;
  stampUrl?: string;
};

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// Convert HTML to plain structured lines for jsPDF
function htmlToBlocks(html: string): Array<{ text: string; bold?: boolean; size?: number; spaceAfter?: number }> {
  const div = document.createElement("div");
  div.innerHTML = html;
  const blocks: Array<{ text: string; bold?: boolean; size?: number; spaceAfter?: number }> = [];
  const walk = (node: Node) => {
    node.childNodes.forEach((n) => {
      if (n.nodeType === 1) {
        const el = n as HTMLElement;
        const tag = el.tagName.toLowerCase();
        const txt = el.textContent?.trim() || "";
        if (!txt && tag !== "br") return;
        if (tag === "h2") blocks.push({ text: txt, bold: true, size: 14, spaceAfter: 4 });
        else if (tag === "h3") blocks.push({ text: txt, bold: true, size: 12, spaceAfter: 3 });
        else if (tag === "li") blocks.push({ text: "• " + txt, size: 11, spaceAfter: 2 });
        else if (tag === "p") blocks.push({ text: txt, size: 11, spaceAfter: 4 });
        else if (tag === "br") blocks.push({ text: "", size: 11, spaceAfter: 2 });
        else if (["ul", "ol", "div", "section"].includes(tag)) walk(el);
        else blocks.push({ text: txt, size: 11, spaceAfter: 2 });
      }
    });
  };
  walk(div);
  return blocks;
}

export async function exportLetterPDF(
  html: string,
  letterhead: Letterhead,
  meta: { title: string; date?: string },
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 18;
  const marginTop = 18;
  const marginBottom = 25;
  let y = marginTop;

  // Letterhead
  const logoData = letterhead.logoUrl ? await fetchAsDataUrl(letterhead.logoUrl) : null;
  if (logoData) {
    try { doc.addImage(logoData, "PNG", marginX, y, 22, 22); } catch { /* ignore */ }
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(20, 90, 50);
  doc.text(letterhead.schoolName || "School", pageW / 2, y + 6, { align: "center" });
  if (letterhead.motto) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text(`"${letterhead.motto}"`, pageW / 2, y + 11, { align: "center" });
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60);
  const contactLine = [letterhead.address, letterhead.phone, letterhead.email, letterhead.website]
    .filter(Boolean).join(" • ");
  if (contactLine) doc.text(contactLine, pageW / 2, y + 16, { align: "center" });

  y += 26;
  doc.setDrawColor(20, 90, 50);
  doc.setLineWidth(0.6);
  doc.line(marginX, y, pageW - marginX, y);
  y += 8;

  // Date
  doc.setTextColor(0);
  doc.setFontSize(10);
  doc.text(meta.date || new Date().toLocaleDateString(), pageW - marginX, y, { align: "right" });
  y += 8;

  // Body
  const blocks = htmlToBlocks(html);
  for (const b of blocks) {
    doc.setFont("helvetica", b.bold ? "bold" : "normal");
    doc.setFontSize(b.size || 11);
    const lines = doc.splitTextToSize(b.text || " ", pageW - marginX * 2);
    for (const ln of lines) {
      if (y > pageH - marginBottom) { doc.addPage(); y = marginTop; }
      doc.text(ln, marginX, y);
      y += (b.size || 11) * 0.45 + 1.5;
    }
    y += b.spaceAfter || 2;
  }

  // Signature & stamp
  y += 8;
  if (y > pageH - 40) { doc.addPage(); y = marginTop; }
  const sigData = letterhead.signatureUrl ? await fetchAsDataUrl(letterhead.signatureUrl) : null;
  const stampData = letterhead.stampUrl ? await fetchAsDataUrl(letterhead.stampUrl) : null;
  if (sigData) { try { doc.addImage(sigData, "PNG", marginX, y, 40, 18); } catch { /* ignore */ } }
  if (stampData) { try { doc.addImage(stampData, "PNG", pageW - marginX - 30, y - 2, 28, 28); } catch { /* ignore */ } }
  y += 20;
  doc.setDrawColor(120);
  doc.setLineWidth(0.2);
  doc.line(marginX, y, marginX + 60, y);
  doc.setFontSize(9);
  doc.setTextColor(60);
  doc.text("Signature / Stamp", marginX, y + 4);

  doc.save(`${meta.title.replace(/[^\w\-]+/g, "_")}.pdf`);
}
