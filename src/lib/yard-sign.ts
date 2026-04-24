import jsPDF from "jspdf";

interface YardSignOptions {
  url: string;
  qrDataUrl: string;           // pre-rendered QR as data URL (PNG) — should be black for print
  label: string;
  sublabel?: string;
  logoUrl?: string | null;
  accentColor?: string | null;
  builderName?: string | null;
  thumbnailUrl?: string | null; // house render for left panel
}

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    return new Promise<string>((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result as string);
      reader.onerror = rej;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function getImageAspect(dataUrl: string): Promise<number> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth / img.naturalHeight);
    img.onerror = () => resolve(16 / 9);
    img.src = dataUrl;
  });
}

function drawPhone(doc: jsPDF, x: number, y: number, w: number, h: number) {
  const r = w * 0.18;
  doc.setDrawColor(0, 0, 0);
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(w * 0.09);
  doc.roundedRect(x, y, w, h, r, r, "S");
  doc.setFillColor(0, 0, 0);
  // top notch
  doc.roundedRect(x + w * 0.28, y + h * 0.06, w * 0.44, h * 0.038, 0.6, 0.6, "F");
  // home button ring
  doc.setLineWidth(w * 0.07);
  doc.circle(x + w / 2, y + h * 0.88, w * 0.1, "S");
}

export async function generateYardSign(opts: YardSignOptions): Promise<Blob> {
  // 24" × 18" landscape
  const W = 609.6; // 24"
  const H = 457.2; // 18"

  const doc = new jsPDF({ unit: "mm", format: [W, H] });

  // Layout constants
  const SPLIT  = W * 0.545;  // ≈ 332mm — left/right divider
  const rW     = W - SPLIT;  // ≈ 278mm — right panel width
  const PAD    = 19;          // horizontal padding inside right panel
  const CX     = SPLIT + rW / 2; // horizontal center of right panel

  // ── White base ────────────────────────────────────────────────────────────────
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, W, H, "F");

  // ── Left panel: house render ──────────────────────────────────────────────────
  if (opts.thumbnailUrl) {
    const houseData = await toDataUrl(opts.thumbnailUrl);
    if (houseData) {
      const aspect = await getImageAspect(houseData);
      // Cover-scale: fill the full panel height, center horizontally
      const dH = H;
      const dW = H * aspect;
      const dX = (SPLIT - dW) / 2;
      doc.addImage(houseData, "JPEG", dX, 0, dW, dH, undefined, "FAST");
    }
  }

  // Right panel white background (covers any image overflow)
  doc.setFillColor(255, 255, 255);
  doc.rect(SPLIT, 0, rW, H, "F");

  // Subtle left border
  doc.setDrawColor(225, 225, 225);
  doc.setLineWidth(0.4);
  doc.line(SPLIT, 0, SPLIT, H);

  // ── QR code ───────────────────────────────────────────────────────────────────
  const qrSize = Math.min(rW - PAD * 2, H * 0.41); // ≈ 187mm
  const qrX    = SPLIT + (rW - qrSize) / 2;
  const qrY    = 20;

  // White frame around QR
  doc.setFillColor(255, 255, 255);
  doc.rect(qrX - 2, qrY - 2, qrSize + 4, qrSize + 4, "F");
  doc.addImage(opts.qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);

  // ── Text block ────────────────────────────────────────────────────────────────
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");

  const tY = qrY + qrSize + 16; // top of text zone
  const bY = H - 16;            // bottom (above branding)
  const tH = bY - tY;           // total height available for text + branding

  // Four text lines with relative proportions
  // Heights as fraction of available text zone (after reserving ~18mm for branding)
  const zone = tH - 22; // reserve for branding row

  // Compute font sizes so lines fill the zone proportionally
  // Weight ratios: 1.0 / 0.78 / 0.93 / 1.18 (SCAN TO / C&P / THIS HOME / INSTANTLY)
  // Line heights (including leading) in ratio: 1.0 / 0.78 / 0.93 / 1.18 → sum = 3.89
  // Each "unit" = zone / 3.89
  const unit  = zone / 3.89;
  const fs1   = Math.round((unit * 1.00 / 25.4) * 72 * 0.7);
  const fs2   = Math.round((unit * 0.78 / 25.4) * 72 * 0.7);
  const fs3   = Math.round((unit * 0.93 / 25.4) * 72 * 0.7);
  const fs4   = Math.round((unit * 1.18 / 25.4) * 72 * 0.7);

  const toMm = (pt: number) => (pt / 72) * 25.4;

  // Baseline positions
  const y1 = tY + toMm(fs1);
  const y2 = y1 + toMm(fs1) * 0.35 + toMm(fs2);
  const y3 = y2 + toMm(fs2) * 0.35 + toMm(fs3);
  const y4 = y3 + toMm(fs3) * 0.35 + toMm(fs4);

  // Line 1: "SCAN TO"
  doc.setFontSize(fs1);
  doc.text("SCAN TO", CX, y1, { align: "center" });

  // Line 2: "CUSTOMIZE & PRICE"
  doc.setFontSize(fs2);
  doc.text("CUSTOMIZE & PRICE", CX, y2, { align: "center" });

  // Line 3: "THIS HOME" + phone icon
  doc.setFontSize(fs3);
  const tw3    = doc.getTextWidth("THIS HOME");
  const ph3    = toMm(fs3) * 0.72;
  const pw3    = ph3 * 0.57;
  const row3W  = tw3 + 4 + pw3;
  const row3X  = CX - row3W / 2;
  doc.text("THIS HOME", row3X, y3);
  drawPhone(doc, row3X + tw3 + 4, y3 - toMm(fs3) * 0.82, pw3, ph3);

  // Line 4: "INSTANTLY" + phone icon
  doc.setFontSize(fs4);
  const tw4   = doc.getTextWidth("INSTANTLY");
  const ph4   = toMm(fs4) * 0.72;
  const pw4   = ph4 * 0.57;
  const row4W = tw4 + 4 + pw4;
  const row4X = CX - row4W / 2;
  doc.text("INSTANTLY", row4X, y4);
  drawPhone(doc, row4X + tw4 + 4, y4 - toMm(fs4) * 0.82, pw4, ph4);

  // ── Branding row ─────────────────────────────────────────────────────────────
  const brandY = H - 8;
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(130, 130, 130);

  const divider = "  |  ";
  const suffix  = "CURB CAPTURE";

  if (opts.logoUrl) {
    const logoData = await toDataUrl(opts.logoUrl);
    if (logoData) {
      const logoH = 9;
      const aspect = await getImageAspect(logoData);
      const logoW = logoH * aspect;
      const divW  = doc.getTextWidth(divider);
      const sufW  = doc.getTextWidth(suffix);
      const totalW = logoW + divW + sufW;
      const startX = CX - totalW / 2;
      doc.addImage(logoData, "PNG", startX, brandY - logoH + 1.5, logoW, logoH, undefined, "FAST");
      doc.text(divider + suffix, startX + logoW, brandY);
    } else {
      const name = opts.builderName ?? "ProPlan Studio";
      doc.text(`${name}${divider}${suffix}`, CX, brandY, { align: "center" });
    }
  } else {
    const name = opts.builderName ?? "ProPlan Studio";
    doc.text(`${name}${divider}${suffix}`, CX, brandY, { align: "center" });
  }

  return doc.output("blob");
}
