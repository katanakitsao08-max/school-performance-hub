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

// Convert HTML (or plain text) to structured lines for jsPDF.
// Handles text nodes, <br>, block elements, and falls back to plain text when no HTML tags exist.
function htmlToBlocks(html: string): Array<{ text: string; bold?: boolean; size?: number; spaceAfter?: number }> {
  const blocks: Array<{ text: string; bold?: boolean; size?: number; spaceAfter?: number }> = [];
  const raw = (html || "").trim();
  if (!raw) return blocks;

  // Plain-text fallback (no tags at all)
  if (!/<[a-z][\s\S]*>/i.test(raw)) {
    raw.split(/\r?\n/).forEach(line => {
      blocks.push({ text: line, size: 11, spaceAfter: 3 });
    });
    return blocks;
  }

  const div = document.createElement("div");
  div.innerHTML = raw;

  const BLOCK_TAGS = new Set(["p", "div", "section", "article", "header", "footer", "li", "h1", "h2", "h3", "h4", "blockquote"]);
  const flushInline = (buf: { text: string }) => {
    const t = buf.text.replace(/\s+/g, " ").trim();
    if (t) blocks.push({ text: t, size: 11, spaceAfter: 3 });
    buf.text = "";
  };

  const walk = (node: Node, buf: { text: string }) => {
    node.childNodes.forEach((n) => {
      if (n.nodeType === 3) {
        buf.text += (n.textContent || "");
        return;
      }
      if (n.nodeType !== 1) return;
      const el = n as HTMLElement;
      const tag = el.tagName.toLowerCase();
      if (tag === "br") { flushInline(buf); return; }
      const txt = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (tag === "h1" || tag === "h2") { flushInline(buf); if (txt) blocks.push({ text: txt, bold: true, size: 14, spaceAfter: 5 }); return; }
      if (tag === "h3" || tag === "h4") { flushInline(buf); if (txt) blocks.push({ text: txt, bold: true, size: 12, spaceAfter: 4 }); return; }
      if (tag === "li") { flushInline(buf); if (txt) blocks.push({ text: "• " + txt, size: 11, spaceAfter: 2 }); return; }
      if (tag === "strong" || tag === "b") { buf.text += " " + txt + " "; return; }
      if (BLOCK_TAGS.has(tag)) {
        flushInline(buf);
        const inner = { text: "" };
        walk(el, inner);
        flushInline(inner);
        return;
      }
      walk(el, buf);
    });
  };
  const buf = { text: "" };
  walk(div, buf);
  flushInline(buf);
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
