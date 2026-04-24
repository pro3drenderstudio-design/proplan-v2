"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import QRCode from "qrcode";
import JSZip from "jszip";
import { generateYardSign } from "@/lib/yard-sign";

export interface QRLot {
  id: string;
  lot_number: string;
  url: string;
  sublabel?: string;
  thumbnailUrl?: string | null;
}

interface QRModalProps {
  url: string;
  label: string;
  sublabel?: string;
  builderLogo?: string | null;
  accentColor?: string | null;
  builderName?: string | null;
  thumbnailUrl?: string | null;
  curbCaptureUrl?: string | null; // homepage URL for branding QR on yard sign
  lots?: QRLot[];
  onClose: () => void;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = (hex ?? "#2563eb").replace("#", "");
  const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

async function buildQRDataUrl(
  url: string,
  accentColor: string | null | undefined,
  logoUrl: string | null | undefined,
  size = 512
): Promise<string> {
  const accent = accentColor ?? "#2563eb";
  const [dr, dg, db] = hexToRgb(accent);

  // Generate base QR to canvas
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  await QRCode.toCanvas(canvas, url, {
    width: size,
    margin: 2,
    color: { dark: `#${dr.toString(16).padStart(2, "0")}${dg.toString(16).padStart(2, "0")}${db.toString(16).padStart(2, "0")}ff`, light: "#ffffffff" },
    errorCorrectionLevel: "H",
  });

  // Overlay builder logo in center if provided
  if (logoUrl) {
    await new Promise<void>(resolve => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const ctx = canvas.getContext("2d")!;
        const maxSize = size * 0.2;
        const pad = maxSize * 0.14;

        // Preserve aspect ratio
        const aspect = img.naturalWidth / img.naturalHeight;
        const logoW = aspect >= 1 ? maxSize : maxSize * aspect;
        const logoH = aspect >= 1 ? maxSize / aspect : maxSize;
        const logoX = (size - logoW) / 2;
        const logoY = (size - logoH) / 2;

        // White circle sized to the largest dimension
        const circleR = Math.max(logoW, logoH) / 2 + pad;
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, circleR, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();

        ctx.drawImage(img, logoX, logoY, logoW, logoH);
        resolve();
      };
      img.onerror = () => resolve();
      img.src = logoUrl;
    });
  }

  return canvas.toDataURL("image/png");
}

export default function QRModal({
  url, label, sublabel, builderLogo, accentColor, builderName, thumbnailUrl, curbCaptureUrl, lots, onClose,
}: QRModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [tab, setTab] = useState<"qr" | "yards">("qr");
  const [bulkLoading, setBulkLoading] = useState(false);
  const [yardLoading, setYardLoading] = useState(false);
  const [copyLabel, setCopyLabel] = useState("Copy URL");

  // Generate QR on mount
  useEffect(() => {
    buildQRDataUrl(url, accentColor, builderLogo).then(setQrDataUrl);
  }, [url, accentColor, builderLogo]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  function downloadQR() {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `${label.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-qr.png`;
    a.click();
  }

  async function downloadYardSign() {
    if (!qrDataUrl) return;
    setYardLoading(true);
    try {
      // Generate black QR for print quality
      const printQr = await buildQRDataUrl(url, "#000000", builderLogo);
      const blob = await generateYardSign({
        url,
        qrDataUrl: printQr,
        label,
        sublabel,
        logoUrl: builderLogo,
        accentColor,
        builderName,
        thumbnailUrl,
        curbCaptureUrl,
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${label.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-yard-sign.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setYardLoading(false);
    }
  }

  async function downloadBulkZip() {
    if (!lots?.length) return;
    setBulkLoading(true);
    try {
      const zip = new JSZip();
      const qrFolder = zip.folder("qr-codes")!;
      const yardFolder = zip.folder("yard-signs")!;

      for (const lot of lots) {
        const lotQr = await buildQRDataUrl(lot.url, accentColor, builderLogo);
        const base64 = lotQr.split(",")[1];
        qrFolder.file(`lot-${lot.lot_number.replace(/[^a-z0-9]/gi, "-")}-qr.png`, base64, { base64: true });

        const blackQr = await buildQRDataUrl(lot.url, "#000000", builderLogo);
        const pdfBlob = await generateYardSign({
          url: lot.url,
          qrDataUrl: blackQr,
          label: `Lot ${lot.lot_number}`,
          sublabel: lot.sublabel,
          logoUrl: builderLogo,
          accentColor,
          builderName,
          thumbnailUrl: lot.thumbnailUrl,
          curbCaptureUrl,
        });
        const pdfArrayBuffer = await pdfBlob.arrayBuffer();
        yardFolder.file(`lot-${lot.lot_number.replace(/[^a-z0-9]/gi, "-")}-yard-sign.pdf`, pdfArrayBuffer);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(zipBlob);
      a.download = `${label.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-all-lots-qr.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
    } finally {
      setBulkLoading(false);
    }
  }

  function copyUrl() {
    navigator.clipboard.writeText(url).then(() => {
      setCopyLabel("Copied!");
      setTimeout(() => setCopyLabel("Copy URL"), 2000);
    });
  }

  const accent = accentColor ?? "#2563eb";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative bg-[#111] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl shadow-black/60 overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between p-5 pb-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-0.5">QR Code</p>
            <p className="text-sm font-semibold text-white truncate">{label}</p>
            {sublabel && <p className="text-xs text-white/35 truncate mt-0.5">{sublabel}</p>}
          </div>
          <button
            onClick={onClose}
            className="ml-3 flex-shrink-0 w-7 h-7 rounded-lg bg-white/8 hover:bg-white/14 flex items-center justify-center transition-colors text-white/40 hover:text-white"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs — only show if lots provided */}
        {lots && lots.length > 0 && (
          <div className="flex px-5 gap-1 mb-3">
            {(["qr", "yards"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  tab === t ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"
                }`}
              >
                {t === "qr" ? "QR Code" : `Bulk Export (${lots.length} lots)`}
              </button>
            ))}
          </div>
        )}

        {tab === "qr" && (
          <>
            {/* QR Preview */}
            <div className="flex justify-center px-5 pb-4">
              <div className="rounded-2xl bg-white p-3 shadow-lg shadow-black/40">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR Code" className="w-52 h-52 block" />
                ) : (
                  <div className="w-52 h-52 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                  </div>
                )}
              </div>
            </div>

            {/* URL preview */}
            <div className="mx-5 mb-4 px-3 py-2 bg-white/5 border border-white/8 rounded-xl">
              <p className="text-[10px] text-white/30 mb-0.5">URL</p>
              <p className="text-xs text-white/60 truncate font-mono">{url}</p>
            </div>

            {/* Actions */}
            <div className="px-5 pb-5 space-y-2">
              <button
                onClick={downloadQR}
                disabled={!qrDataUrl}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/8 hover:bg-white/12 border border-white/10 transition-colors disabled:opacity-40"
              >
                <span className="text-sm font-medium text-white">Download QR (PNG)</span>
                <svg className="w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
              <button
                onClick={downloadYardSign}
                disabled={!qrDataUrl || yardLoading}
                style={{ backgroundColor: accent + "22", borderColor: accent + "55" }}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors disabled:opacity-40"
              >
                <span className="text-sm font-medium text-white">
                  {yardLoading ? "Generating…" : "Download Yard Sign (PDF)"}
                </span>
                {yardLoading ? (
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                )}
              </button>
              <button
                onClick={copyUrl}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/4 hover:bg-white/8 border border-white/8 transition-colors"
              >
                <span className="text-sm text-white/60">{copyLabel}</span>
                <svg className="w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </>
        )}

        {tab === "yards" && lots && (
          <div className="px-5 pb-5">
            <p className="text-xs text-white/40 mb-4 leading-relaxed">
              Generate QR codes and 18"×24" yard sign PDFs for all {lots.length} lots — packaged as a single ZIP file ready to send to your printer.
            </p>

            <div className="max-h-48 overflow-y-auto space-y-1.5 mb-4 pr-1">
              {lots.map(lot => (
                <div key={lot.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/4 border border-white/6">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                  <span className="text-xs text-white/60 flex-1 truncate">Lot {lot.lot_number}</span>
                  <span className="text-[10px] text-white/20 font-mono truncate max-w-[100px]">{lot.url.replace(/^https?:\/\/[^/]+/, "")}</span>
                </div>
              ))}
            </div>

            <button
              onClick={downloadBulkZip}
              disabled={bulkLoading}
              style={{ backgroundColor: accent }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-60"
            >
              {bulkLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating ZIP…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download All ({lots.length} lots) as ZIP
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
