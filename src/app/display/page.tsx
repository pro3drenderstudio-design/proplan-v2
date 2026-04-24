"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";

// Sales center tablet mode — full-screen QR code display
// Usage: /display?url=https://...&label=Lot+42&accent=%232563eb&logo=https://...
export default function DisplayPage() {
  const params      = useSearchParams();
  const url         = params.get("url") ?? "";
  const label       = params.get("label") ?? "Scan to Configure";
  const accent      = params.get("accent") ?? "#2563eb";
  const logoUrl     = params.get("logo") ?? "";
  const builderName = params.get("builder") ?? "";

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [clock, setClock] = useState("");

  // Generate QR with accent color dots
  useEffect(() => {
    if (!url) return;
    const h = accent.replace("#", "");
    const full = h.length === 3 ? h.split("").map((c: string) => c + c).join("") : h;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    const darkHex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;

    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 600;
    QRCode.toCanvas(canvas, url, {
      width: 600,
      margin: 2,
      color: { dark: darkHex + "ff", light: "#ffffffff" },
      errorCorrectionLevel: "H",
    }).then(() => {
      if (logoUrl) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const ctx = canvas.getContext("2d")!;
          const logoSize = 600 * 0.18;
          const x = (600 - logoSize) / 2;
          const y = (600 - logoSize) / 2;
          const pad = logoSize * 0.15;
          ctx.beginPath();
          ctx.arc(300, 300, logoSize / 2 + pad, 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff";
          ctx.fill();
          ctx.drawImage(img, x, y, logoSize, logoSize);
          setQrDataUrl(canvas.toDataURL("image/png"));
        };
        img.onerror = () => setQrDataUrl(canvas.toDataURL("image/png"));
        img.src = logoUrl;
      } else {
        setQrDataUrl(canvas.toDataURL("image/png"));
      }
    });
  }, [url, accent, logoUrl]);

  // Live clock
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    tick();
    const t = setInterval(tick, 10000);
    return () => clearInterval(t);
  }, []);

  if (!url) {
    return (
      <div className="min-h-screen bg-[#08080f] flex items-center justify-center text-white/30 text-sm">
        No URL provided. Add <code className="mx-1 px-1.5 py-0.5 bg-white/8 rounded text-white/50">?url=…</code> to the address bar.
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-8 py-12 overflow-hidden"
      style={{ background: "#08080f" }}
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 h-1.5" style={{ background: accent }} />

      {/* Clock + builder name top */}
      <div className="absolute top-5 left-0 right-0 flex items-center justify-between px-8">
        <div className="flex items-center gap-3">
          {logoUrl && (
            <img src={logoUrl} alt={builderName} className="h-8 object-contain" />
          )}
          {builderName && !logoUrl && (
            <span className="text-sm font-semibold text-white/50">{builderName}</span>
          )}
        </div>
        <span className="text-sm font-mono text-white/20">{clock}</span>
      </div>

      {/* Main content */}
      <div className="flex flex-col items-center gap-8 max-w-lg w-full">
        {/* Label */}
        <div className="text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: accent }}>
            Interactive Configurator
          </p>
          <h1 className="text-3xl font-bold text-white leading-tight">{label}</h1>
        </div>

        {/* QR Code */}
        <div className="rounded-3xl bg-white p-5 shadow-2xl" style={{ boxShadow: `0 0 80px ${accent}33` }}>
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR Code" className="w-72 h-72 block" />
          ) : (
            <div className="w-72 h-72 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-black/15 border-t-black/50 rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* CTA */}
        <div className="text-center">
          <p className="text-lg font-semibold text-white/70 mb-2">Point your camera here</p>
          <p className="text-sm text-white/30">Customize colors, finishes &amp; options — then request a quote instantly</p>
        </div>

        {/* URL hint */}
        <p className="text-[11px] font-mono text-white/15">{url.replace(/^https?:\/\//, "").split("?")[0]}</p>
      </div>

      {/* Bottom bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: accent, opacity: 0.4 }} />
    </div>
  );
}
