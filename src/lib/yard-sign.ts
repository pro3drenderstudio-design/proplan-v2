import jsPDF from "jspdf";
import QRCode from "qrcode";

interface YardSignOptions {
  url: string;
  qrDataUrl: string;
  label: string;
  sublabel?: string;
  logoUrl?: string | null;
  accentColor?: string | null;
  builderName?: string | null;
  thumbnailUrl?: string | null;
  curbCaptureUrl?: string | null;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = (hex ?? "#2563eb").replace("#", "");
  const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

// Fetch image via same-origin proxy, convert to JPEG data URL.
// Blob URLs are same-origin so canvas.toDataURL() never throws a security error.
async function toDataUrl(url: string): Promise<string | null> {
  try {
    const proxyUrl = url.startsWith("/")
      ? url
      : `/api/proxy-image?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise<string | null>((resolve) => {
      const objUrl = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(objUrl);
        try {
          const canvas = document.createElement("canvas");
          canvas.width  = img.naturalWidth  || 800;
          canvas.height = img.naturalHeight || 600;
          const ctx = canvas.getContext("2d");
          if (!ctx) { resolve(null); return; }
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/jpeg", 0.92));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => { URL.revokeObjectURL(objUrl); resolve(null); };
      img.src = objUrl;
    });
  } catch {
    return null;
  }
}

// Like toDataUrl but preserves PNG transparency (no JPEG conversion via canvas).
async function toDataUrlPng(url: string): Promise<string | null> {
  try {
    const proxyUrl = url.startsWith("/")
      ? url
      : `/api/proxy-image?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
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

export async function generateYardSign(opts: YardSignOptions): Promise<Blob> {
  // 24" × 18" landscape + 0.125" (3.175 mm) bleed each side
  const BLEED = 3.175;
  const W  = 609.6;
  const H  = 457.2;
  const TW = W + BLEED * 2;
  const TH = H + BLEED * 2;
  const OX = BLEED;
  const OY = BLEED;
  const toMm = (pt: number) => (pt / 72) * 25.4;

  const doc = new jsPDF({ unit: "mm", format: [TW, TH], orientation: "landscape" });

  const accent = opts.accentColor ?? "#2563eb";
  const [ar, ag, ab] = hexToRgb(accent);

  // ── Panel geometry ─────────────────────────────────────────────────────────
  const LEFT_FRAC = 0.565;
  const STRIPE_W  = 5;
  const LEFT_W    = W * LEFT_FRAC;
  const SPLIT_X   = OX + LEFT_W;
  const RIGHT_X   = SPLIT_X + STRIPE_W;
  const RIGHT_W   = W - LEFT_W - STRIPE_W;
  const CX        = RIGHT_X + RIGHT_W / 2;
  const PAD       = 14;
  const cW        = RIGHT_W - PAD * 2;

  // ── White base ─────────────────────────────────────────────────────────────
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, TW, TH, "F");

  // ── Full-bleed background image ────────────────────────────────────────────
  let thumbnailLoaded = false;
  if (opts.thumbnailUrl) {
    const houseData = await toDataUrl(opts.thumbnailUrl);
    if (houseData) {
      thumbnailLoaded = true;
      const aspect = await getImageAspect(houseData);
      // Cover the entire sign
      let iW = TH * aspect;
      let iH = TH;
      if (iW < TW) { iW = TW; iH = TW / aspect; }
      const ix = (TW - iW) / 2;
      const iy = (TH - iH) / 2;
      doc.addImage(houseData, "JPEG", ix, iy, iW, iH, undefined, "FAST");
    }
  }

  // Fallback: accent-color panel when no thumbnail
  if (!thumbnailLoaded) {
    doc.setFillColor(ar, ag, ab);
    doc.rect(0, 0, TW, TH, "F");
    doc.setGState(doc.GState({ opacity: 0.22 }));
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, TW, TH * 0.5, "F");
    doc.setGState(doc.GState({ opacity: 1 }));
  }

  // ── Accent stripe ──────────────────────────────────────────────────────────
  doc.setFillColor(ar, ag, ab);
  doc.rect(SPLIT_X, 0, STRIPE_W, TH, "F");

  // ── Right panel: frosted glass (semi-transparent white over the photo) ─────
  doc.setGState(doc.GState({ opacity: 0.75 }));
  doc.setFillColor(250, 250, 252);
  doc.rect(RIGHT_X, 0, RIGHT_W + BLEED, TH, "F");
  doc.setGState(doc.GState({ opacity: 1 }));

  // ── QR code ────────────────────────────────────────────────────────────────
  const qrTop  = OY + 16;
  const qrSize = Math.min(cW - 4, H * 0.41);
  const qrX    = CX - qrSize / 2;
  const qrPad  = 4.5;

  // Blurred drop shadow — multiple passes at increasing spread + low opacity
  doc.setFillColor(0, 0, 0);
  for (let s = 7; s >= 1; s--) {
    doc.setGState(doc.GState({ opacity: 0.022 }));
    doc.roundedRect(
      qrX - qrPad - s * 0.4 + 4,
      qrTop - qrPad - s * 0.4 + 4,
      qrSize + qrPad * 2 + s * 0.8,
      qrSize + qrPad * 2 + s * 0.8,
      2.5 + s * 0.3, 2.5 + s * 0.3, "F"
    );
  }
  doc.setGState(doc.GState({ opacity: 1 }));

  // QR card — light gray background, accent top bar
  doc.setFillColor(248, 248, 250);
  doc.roundedRect(qrX - qrPad, qrTop - qrPad, qrSize + qrPad * 2, qrSize + qrPad * 2, 2.5, 2.5, "F");
  doc.setFillColor(ar, ag, ab);
  doc.roundedRect(qrX - qrPad, qrTop - qrPad, qrSize + qrPad * 2, 2.8, 1.5, 1.5, "F");
  doc.setFillColor(248, 248, 250);
  doc.rect(qrX - qrPad, qrTop - qrPad + 1.4, qrSize + qrPad * 2, 1.4, "F");

  doc.addImage(opts.qrDataUrl, "PNG", qrX, qrTop, qrSize, qrSize);

  // ── CTA text ───────────────────────────────────────────────────────────────
  const BRAND_H   = 32;
  const textStart = qrTop + qrSize + qrPad + 12;
  const textEnd   = OY + H - BRAND_H - 4;
  const zone      = textEnd - textStart;

  const scanFontSize = Math.min(Math.round((zone * 0.14 / 25.4) * 72), 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(scanFontSize);
  doc.setTextColor(ar, ag, ab);
  doc.text("SCAN TO", CX, textStart + toMm(scanFontSize), { align: "center" });

  const scanRuleY = textStart + toMm(scanFontSize) + 3.5;
  doc.setDrawColor(ar, ag, ab);
  doc.setLineWidth(0.8);
  doc.line(CX - 20, scanRuleY, CX + 20, scanRuleY);

  const lineZone = textEnd - scanRuleY - 6;
  const unitH = lineZone / 4.10;
  const fs1 = Math.round((unitH * 1.00 / 25.4) * 72 * 0.68);
  const fs2 = Math.round((unitH * 0.88 / 25.4) * 72 * 0.68);
  const fs3 = Math.round((unitH * 1.00 / 25.4) * 72 * 0.68);
  const fs4 = Math.round((unitH * 1.22 / 25.4) * 72 * 0.68);
  const LEAD = 0.20;

  let cy = scanRuleY + 6 + toMm(fs1);

  doc.setFontSize(fs1);
  doc.setTextColor(20, 20, 28);
  doc.setDrawColor(20, 20, 28);
  doc.setLineWidth(0.14);
  doc.text("CUSTOMIZE", CX, cy, { align: "center", renderingMode: "fillThenStroke" });

  cy += toMm(fs1) * LEAD + toMm(fs2);
  doc.setFontSize(fs2);
  doc.setTextColor(ar, ag, ab);
  doc.setLineWidth(0);
  doc.text("& PRICE", CX, cy, { align: "center" });

  cy += toMm(fs2) * LEAD + toMm(fs3);
  doc.setFontSize(fs3);
  doc.setTextColor(20, 20, 28);
  doc.text("THIS HOME", CX, cy, { align: "center" });

  cy += toMm(fs3) * LEAD + toMm(fs4);
  doc.setFontSize(fs4);
  doc.setTextColor(ar, ag, ab);
  doc.setDrawColor(ar, ag, ab);
  doc.setLineWidth(0.14);
  doc.text("INSTANTLY", CX, cy, { align: "center", renderingMode: "fillThenStroke" });
  doc.setLineWidth(0);

  // ── Branding section ───────────────────────────────────────────────────────
  const brandTop = OY + H - BRAND_H;

  doc.setDrawColor(210, 210, 218);
  doc.setLineWidth(0.3);
  doc.line(RIGHT_X + PAD, brandTop, RIGHT_X + PAD + cW, brandTop);

  // Branding QR
  const brandQrSize = 24;
  let brandQrDataUrl: string | null = null;
  const brandingUrl = opts.curbCaptureUrl ?? "https://proplanstudio.com";
  try {
    brandQrDataUrl = await QRCode.toDataURL(brandingUrl, {
      width: 160, margin: 0,
      color: { dark: "#14141cff", light: "#ffffffff" },
      errorCorrectionLevel: "M",
    });
  } catch { /* skip */ }

  // ProPlan Studio logo — use PNG-preserving fetch to keep transparent background
  const proplanLogoData = await toDataUrlPng("/logo_dark.png");

  // Layout: logo + text on left, QR on right
  const brandMidY    = brandTop + BRAND_H / 2;
  const brandQrX     = RIGHT_X + PAD + cW - brandQrSize;
  const brandQrY     = brandTop + (BRAND_H - brandQrSize) / 2;
  const textAreaMaxW = cW - brandQrSize - 6;

  if (proplanLogoData) {
    const logoH  = 8;
    const logoAspect = await getImageAspect(proplanLogoData);
    const logoW  = Math.min(logoH * logoAspect, textAreaMaxW * 0.7);
    const logoX  = RIGHT_X + PAD;
    const logoY  = brandTop + 5;
    doc.addImage(proplanLogoData, "PNG", logoX, logoY, logoW, logoH, undefined, "FAST");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 115);
    doc.text("Powered by ProPlan Studio", RIGHT_X + PAD, brandMidY + 9, { align: "left" });
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(25, 25, 35);
    doc.text("CURB CAPTURE TECHNOLOGY", RIGHT_X + PAD, brandMidY - 2, { align: "left" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 100, 115);
    doc.text("Powered by ProPlan Studio", RIGHT_X + PAD, brandMidY + 7, { align: "left" });
  }

  if (brandQrDataUrl) {
    doc.addImage(brandQrDataUrl, "PNG", brandQrX, brandQrY, brandQrSize, brandQrSize);
  }

  // ── Crop / trim marks ──────────────────────────────────────────────────────
  const G = 1.5;
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.2);
  doc.line(0, OY, OX - G, OY);
  doc.line(OX, 0, OX, OY - G);
  doc.line(OX + W + G, OY, TW, OY);
  doc.line(OX + W, 0, OX + W, OY - G);
  doc.line(0, OY + H, OX - G, OY + H);
  doc.line(OX, OY + H + G, OX, TH);
  doc.line(OX + W + G, OY + H, TW, OY + H);
  doc.line(OX + W, OY + H + G, OX + W, TH);

  return doc.output("blob");
}
