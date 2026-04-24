import jsPDF from "jspdf";

interface YardSignOptions {
  url: string;
  qrDataUrl: string;        // pre-rendered QR as data URL (PNG)
  label: string;            // e.g. "Lot 42 — Maple Reserve"
  sublabel?: string;        // e.g. "3 bed · 2 bath · 2,100 sq ft"
  logoUrl?: string | null;
  accentColor?: string | null;
  builderName?: string | null;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

export async function generateYardSign(opts: YardSignOptions): Promise<Blob> {
  // 18" × 24" at 72 DPI internal unit = mm
  const W = 457.2;  // 18 inches in mm
  const H = 609.6;  // 24 inches in mm

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: [W, H] });

  const accent = opts.accentColor ?? "#2563eb";
  const [ar, ag, ab] = hexToRgb(accent);

  // ── Background ─────────────────────────────────────────────────────────────
  doc.setFillColor(8, 10, 20);
  doc.rect(0, 0, W, H, "F");

  // ── Top accent bar ─────────────────────────────────────────────────────────
  doc.setFillColor(ar, ag, ab);
  doc.rect(0, 0, W, 18, "F");

  // ── Builder logo or name in top bar ───────────────────────────────────────
  if (opts.logoUrl) {
    try {
      const resp = await fetch(opts.logoUrl);
      const blob = await resp.blob();
      const dataUrl = await new Promise<string>((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result as string);
        reader.onerror = rej;
        reader.readAsDataURL(blob);
      });
      // fit logo in top bar — max 80mm wide × 12mm tall
      doc.addImage(dataUrl, "PNG", W / 2 - 40, 3, 80, 12, undefined, "FAST");
    } catch {
      // fallback to text
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(opts.builderName ?? "ProPlan Studio", W / 2, 12, { align: "center" });
    }
  } else {
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(opts.builderName ?? "ProPlan Studio", W / 2, 12, { align: "center" });
  }

  // ── Main label ─────────────────────────────────────────────────────────────
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(48);
  doc.setFont("helvetica", "bold");
  const labelLines = doc.splitTextToSize(opts.label, W - 40) as string[];
  doc.text(labelLines, W / 2, 60, { align: "center" });

  // ── Sublabel ───────────────────────────────────────────────────────────────
  if (opts.sublabel) {
    doc.setFontSize(22);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(255, 255, 255, 0.6);
    // jsPDF doesn't support rgba text, use near-white gray
    doc.setTextColor(160, 170, 190);
    doc.text(opts.sublabel, W / 2, 88, { align: "center" });
  }

  // ── QR code ────────────────────────────────────────────────────────────────
  const qrSize = 280;  // mm
  const qrX = (W - qrSize) / 2;
  const qrY = 110;

  // White rounded background for QR
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 10, 10, "F");

  doc.addImage(opts.qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);

  // ── "Scan to explore" CTA ─────────────────────────────────────────────────
  const ctaY = qrY + qrSize + 28;
  doc.setFillColor(ar, ag, ab);
  doc.roundedRect(W / 2 - 90, ctaY - 12, 180, 28, 6, 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("SCAN TO EXPLORE", W / 2, ctaY + 5, { align: "center" });

  // ── URL below CTA ─────────────────────────────────────────────────────────
  doc.setFontSize(13);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 115, 140);
  const shortUrl = opts.url.replace(/^https?:\/\//, "");
  doc.text(shortUrl, W / 2, ctaY + 28, { align: "center" });

  // ── Bottom line ────────────────────────────────────────────────────────────
  doc.setFillColor(ar, ag, ab);
  doc.rect(0, H - 10, W, 10, "F");

  return doc.output("blob");
}
