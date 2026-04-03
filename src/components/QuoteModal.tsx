"use client";

import { useState, useEffect } from "react";
import jsPDF, { GState } from "jspdf";
import { SketchfabCameraApi } from "@/utils/sketchfab-camera";
import { Option, CategoryWithOptions, Project } from "@/types/database";
import { supabase } from "@/lib/supabase";

interface BuilderBranding {
  company_name: string;
  logo_url: string | null;
  accent_color: string | null;
  contact_email: string | null;
  phone: string | null;
  billing_address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}

interface LotInfo {
  lotId: string;
  lotNumber: string;
  communitySlug: string;
  communityName: string;
}

interface QuoteModalProps {
  project: Project;
  categories: CategoryWithOptions[];
  selectedOptions: Record<string, Option>;
  totalPrice: number;
  /** Raw screenshot data-URL taken before the modal opened. */
  screenshot: string | null;
  /** Kept for compatibility — modal no longer calls takeScreenShot itself. */
  apiRef: React.RefObject<SketchfabCameraApi | null>;
  onClose: () => void;
  /** Optional builder branding for PDF and UI */
  builder?: BuilderBranding | null;
  /** Lot context when buyer arrived from a community map */
  lotInfo?: LotInfo | null;
}

interface LeadForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

type Step = "rendering" | "preview" | "form" | "generating" | "done" | "error";

export default function QuoteModal({
  project,
  categories,
  selectedOptions,
  totalPrice,
  screenshot,
  onClose,
  builder,
  lotInfo,
}: QuoteModalProps) {
  const [step, setStep]       = useState<Step>("rendering");
  const [aiRender, setAiRender] = useState<string | null>(null); // base64 PNG
  const [form, setForm]       = useState<LeadForm>({ firstName: "", lastName: "", email: "", phone: "" });
  const [errorMsg, setErrorMsg] = useState("");

  // ── 1. Generate AI render on mount ────────────────────────────────────────
  useEffect(() => {
    async function generate() {
      if (!screenshot) {
        // No screenshot available — skip straight to form
        setStep("form");
        return;
      }

      try {
        // Strip data URI prefix to get raw base64
        const base64 = screenshot.includes(",") ? screenshot.split(",")[1] : screenshot;

        const res = await fetch("/api/generate-render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64 }),
        });

        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Render API ${res.status}: ${body}`);
        }
        const data = await res.json() as { imageBase64: string };
        setAiRender(`data:image/png;base64,${data.imageBase64}`);
        setStep("preview");
      } catch (err) {
        console.error("AI render failed, falling back to form:", err);
        // Graceful fallback — still let user get a quote
        setStep("form");
      }
    }

    generate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  // ── 2. Submit: generate PDF, send email, save lead ────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStep("generating");
    setErrorMsg("");

    try {
      const optionRows = categories
        .map(cat => {
          const opt = selectedOptions[cat.id];
          if (!opt) return null;
          return { category: cat.name, option: opt.friendly_name, price: opt.price_impact ?? 0 };
        })
        .filter(Boolean) as { category: string; option: string; price: number }[];

      const pdfImage = aiRender ?? screenshot;

      // Pre-fetch logo as base64 so jsPDF can embed it (it cannot fetch URLs directly)
      // Also measure natural dimensions to preserve aspect ratio in the PDF.
      let logoBase64: string | null = null;
      let logoNaturalW: number | null = null;
      let logoNaturalH: number | null = null;
      if (builder?.logo_url) {
        try {
          const logoRes = await fetch(builder.logo_url);
          const blob    = await logoRes.blob();
          logoBase64    = await new Promise<string>(res => {
            const reader = new FileReader();
            reader.onload = () => res(reader.result as string);
            reader.readAsDataURL(blob);
          });
          // Measure natural dimensions
          const dims = await new Promise<{ w: number; h: number }>(res => {
            const img = new Image();
            img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
            img.onerror = () => res({ w: 0, h: 0 });
            img.src = logoBase64!;
          });
          if (dims.w > 0 && dims.h > 0) {
            logoNaturalW = dims.w;
            logoNaturalH = dims.h;
          }
        } catch { /* skip logo if fetch fails */ }
      }

      const builderWithLogo = builder && logoBase64
        ? { ...builder, logo_url: logoBase64 }
        : builder;

      const pdfDoc = buildPdf({ project, buyer: form, optionRows, totalPrice, screenshot: pdfImage, builder: builderWithLogo, logoNaturalW, logoNaturalH, lotInfo });

      const pdfBase64 = pdfDoc.output("datauristring");
      const pdfBlob   = pdfDoc.output("blob");

      // Trigger download
      const url = URL.createObjectURL(pdfBlob);
      const a   = document.createElement("a");
      a.href     = url;
      a.download = `${project.name.replace(/\s+/g, "-")}-quote.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      // Send email (fire and forget — don't block on failure)
      fetch("/api/send-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: form.email,
          firstName: form.firstName,
          projectName: project.name,
          pdfBase64: pdfBase64.split(",")[1],
          lotNumber: lotInfo?.lotNumber ?? null,
          communityName: lotInfo?.communityName ?? null,
        }),
      }).catch(err => console.warn("Email send failed:", err));

      // Save lead
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("leads") as any).insert({
        project_id:     project.id,
        first_name:     form.firstName,
        last_name:      form.lastName,
        email:          form.email,
        phone:          form.phone || null,
        configuration:  Object.fromEntries(
          Object.entries(selectedOptions).map(([catId, opt]) => [catId, opt.id])
        ),
        total_value:    totalPrice,
        status:         "new",
        lot_number:     lotInfo?.lotNumber ?? null,
        community_slug: lotInfo?.communitySlug ?? null,
        community_name: lotInfo?.communityName ?? null,
      });

      setStep("done");
    } catch (err) {
      console.error("QuoteModal submit error:", err);
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      setStep("error");
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
      <div
        className="relative w-full shadow-2xl shadow-black/60 overflow-hidden"
        style={{
          maxWidth: step === "preview" ? 860 : 460,
          borderRadius: 20,
          transition: "max-width 0.4s ease",
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.09)",
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white text-lg transition-colors"
          aria-label="Close"
        >
          ×
        </button>

        {/* ── Step: rendering ── */}
        {step === "rendering" && (
          <div className="flex flex-col items-center gap-5 py-16 px-8">
            <div className="relative">
              <div className="w-14 h-14 rounded-full border-2 border-blue-600/30 border-t-blue-600 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-6 h-6 rounded-full border-2 border-white/10 border-t-white/40 animate-spin" style={{ animationDirection: "reverse" }} />
              </div>
            </div>
            <div className="text-center">
              <p className="text-white font-semibold">Generating your render…</p>
              <p className="text-sm text-white/40 mt-1">Our AI is creating a photorealistic view of your home</p>
            </div>
          </div>
        )}

        {/* ── Step: preview ── */}
        {step === "preview" && aiRender && (
          <div>
            {/* Image */}
            <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={aiRender}
                alt="AI architectural render of your configured home"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-4 left-5">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">AI Render</span>
                <p className="text-white font-bold text-lg leading-tight">{project.name}</p>
              </div>
            </div>

            {/* CTA */}
            <div className="px-8 pb-8 pt-5 text-center">
              <p className="text-white/60 text-sm mb-5">
                This is what your configured home could look like. Ready to get your full quote?
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl text-sm text-white/60 transition-colors" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.09)" }}
                >
                  Keep exploring
                </button>
                <button
                  onClick={() => setStep("form")}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm text-white font-semibold transition-colors shadow-lg shadow-blue-600/25"
                >
                  Get my quote →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step: form ── */}
        {step === "form" && (
          <div className="p-8">
            {/* Builder branding header */}
            {builder && (
              <div className="flex items-center mb-6 pb-5 border-b border-white/8">
                {builder.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={builder.logo_url} alt={builder.company_name} className="h-8 max-w-[160px] object-contain" />
                ) : (
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-black"
                    style={{ background: builder.accent_color ?? "#3b82f6" }}
                  >
                    {builder.company_name.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
            )}
            {lotInfo?.lotNumber && (
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-xl mb-5 text-sm"
                style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.25)" }}
              >
                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 shrink-0 text-blue-400">
                  <path fillRule="evenodd" d="M8 1.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9ZM2 6a6 6 0 1 1 10.89 3.477l2.817 2.816a.75.75 0 0 1-1.06 1.061l-2.817-2.817A6 6 0 0 1 2 6Z" clipRule="evenodd" />
                  <path d="M8 3.5a.75.75 0 0 1 .75.75v1.5h1.5a.75.75 0 0 1 0 1.5h-1.5v1.5a.75.75 0 0 1-1.5 0v-1.5h-1.5a.75.75 0 0 1 0-1.5h1.5v-1.5A.75.75 0 0 1 8 3.5Z" />
                </svg>
                <span className="text-blue-300 font-semibold">Lot {lotInfo.lotNumber}</span>
                {lotInfo.communityName && (
                  <>
                    <span className="text-white/20">·</span>
                    <span className="text-white/50">{lotInfo.communityName}</span>
                  </>
                )}
              </div>
            )}
            <h2 className="text-xl font-bold text-white mb-1">Get Your Quote</h2>
            <p className="text-sm text-white/50 mb-6">
              We&apos;ll send your personalised PDF quote to your email.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">First name</label>
                  <input
                    name="firstName" required value={form.firstName} onChange={handleChange}
                    className="w-full bg-white/6 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-blue-600/60 focus:border-blue-600/40 transition-colors"
                    placeholder="Jane"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Last name</label>
                  <input
                    name="lastName" required value={form.lastName} onChange={handleChange}
                    className="w-full bg-white/6 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-blue-600/60 focus:border-blue-600/40 transition-colors"
                    placeholder="Smith"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Email</label>
                <input
                  name="email" type="email" required value={form.email} onChange={handleChange}
                  className="w-full bg-white/6 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-blue-600/60 focus:border-blue-600/40 transition-colors"
                  placeholder="jane@example.com"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">
                  Phone <span className="text-white/30">(optional)</span>
                </label>
                <input
                  name="phone" type="tel" value={form.phone} onChange={handleChange}
                  className="w-full bg-white/6 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-blue-600/60 focus:border-blue-600/40 transition-colors"
                  placeholder="+1 555 000 0000"
                />
              </div>
              <button
                type="submit"
                className="w-full mt-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-blue-600/20"
              >
                Generate &amp; Send Quote
              </button>
            </form>
          </div>
        )}

        {/* ── Step: generating ── */}
        {step === "generating" && (
          <div className="flex flex-col items-center gap-4 py-14 px-8">
            <div className="w-10 h-10 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-sm text-white/60">Building your quote…</p>
          </div>
        )}

        {/* ── Step: done ── */}
        {step === "done" && (
          <div className="flex flex-col items-center gap-4 py-14 px-8 text-center">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center text-2xl text-green-400">✓</div>
            <div>
              <p className="text-white font-semibold">Quote sent!</p>
              <p className="text-sm text-white/50 mt-1">Check your inbox at {form.email}</p>
            </div>
            <button
              onClick={onClose}
              className="mt-2 px-6 py-2 rounded-xl text-sm text-white transition-colors" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.09)" }}
            >
              Close
            </button>
          </div>
        )}

        {/* ── Step: error ── */}
        {step === "error" && (
          <div className="flex flex-col items-center gap-4 py-14 px-8 text-center">
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center text-2xl text-red-400">!</div>
            <div>
              <p className="text-white font-semibold">Something went wrong</p>
              {errorMsg && <p className="text-xs text-white/40 mt-1">{errorMsg}</p>}
            </div>
            <button
              onClick={() => setStep("form")}
              className="mt-2 px-6 py-2 rounded-xl text-sm text-white transition-colors" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.09)" }}
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── PDF builder ───────────────────────────────────────────────────────────────

interface PdfInput {
  project: Project;
  buyer: LeadForm;
  optionRows: { category: string; option: string; price: number }[];
  totalPrice: number;
  screenshot: string | null;
  builder?: BuilderBranding | null;
  logoNaturalW?: number | null;
  logoNaturalH?: number | null;
  lotInfo?: LotInfo | null;
}

function buildPdf({ project, buyer, optionRows, totalPrice, screenshot, builder, logoNaturalW, logoNaturalH, lotInfo }: PdfInput): jsPDF {
  const doc      = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW    = 210;
  const margin   = 15;
  const contentW = pageW - margin * 2;

  // ── Hero image with gradient overlay ────────────────────────────────────────
  const heroH = Math.round(pageW * 9 / 16); // full-bleed 16:9

  if (screenshot) {
    try {
      doc.addImage(screenshot, "JPEG", 0, 0, pageW, heroH);
    } catch {
      try { doc.addImage(screenshot, "PNG", 0, 0, pageW, heroH); } catch { /* skip */ }
    }

    // Simulate gradient: stack semi-transparent dark layers toward the bottom
    const gradH = heroH * 0.6;
    const steps = 10;
    for (let i = 0; i < steps; i++) {
      const layerH = gradH * (steps - i) / steps;
      doc.saveGraphicsState();
      doc.setGState(new GState({ opacity: 0.13 }));
      doc.setFillColor(15, 23, 42);
      doc.rect(0, heroH - layerH, pageW, layerH, "F");
      doc.restoreGraphicsState();
    }
  } else {
    // No image — solid navy header
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, heroH, "F");
  }

  // ── Builder logo (top-right corner of hero) ──────────────────────────────
  if (builder?.logo_url) {
    try {
      const logoW = 36;
      // Preserve aspect ratio: if we have natural dimensions use them, otherwise default to 14mm
      const logoH = (logoNaturalW && logoNaturalH && logoNaturalW > 0)
        ? Math.round((logoNaturalH / logoNaturalW) * logoW * 10) / 10
        : 14;
      doc.addImage(builder.logo_url, "PNG", pageW - margin - logoW, 8, logoW, logoH);
    } catch {
      // Logo load failed — show text fallback
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text(builder.company_name, pageW - margin, 14, { align: "right" });
    }
  } else if (builder) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(builder.company_name, pageW - margin, 14, { align: "right" });
  }

  // Overlay text: label + project name + date
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const textY = heroH - 10;

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(148, 163, 184);
  doc.text("CONFIGURATION QUOTE", margin, textY - 10);

  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(project.name, margin, textY - 2);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(203, 213, 225);
  doc.text(date, pageW - margin, textY - 2, { align: "right" });

  let y = heroH + 10;

  // ── Builder info block ────────────────────────────────────────────────────
  if (builder) {
    const accentHex = /^#[0-9a-fA-F]{6}$/.test(builder.accent_color ?? "") ? builder.accent_color! : "#3B82F6";
    const r = parseInt(accentHex.slice(1, 3), 16);
    const g = parseInt(accentHex.slice(3, 5), 16);
    const b = parseInt(accentHex.slice(5, 7), 16);

    doc.setFillColor(r, g, b);
    doc.setGState(new GState({ opacity: 0.08 }));
    doc.roundedRect(margin, y, contentW, 14, 2, 2, "F");
    doc.setGState(new GState({ opacity: 1 }));

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(r, g, b);
    doc.text(builder.company_name, margin + 3, y + 5.5);

    const contactParts: string[] = [];
    if (builder.contact_email) contactParts.push(builder.contact_email);
    if (builder.phone)         contactParts.push(builder.phone);
    const addrParts: string[] = [];
    if (builder.billing_address) addrParts.push(builder.billing_address);
    if (builder.city)            addrParts.push(builder.city);
    if (builder.state)           addrParts.push(builder.state);
    if (builder.zip)             addrParts.push(builder.zip);
    const builderMeta = [...addrParts, ...contactParts].filter(Boolean).join(" · ");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(builderMeta, margin + 3, y + 10.5);
    y += 20;
  }

  // ── Buyer info ────────────────────────────────────────────────────────────
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Prepared for:  ${buyer.firstName} ${buyer.lastName}  ·  ${buyer.email}${buyer.phone ? `  ·  ${buyer.phone}` : ""}`,
    margin, y
  );
  y += 7;

  if (lotInfo?.lotNumber) {
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    const propertyLine = `Property:  Lot ${lotInfo.lotNumber}${lotInfo.communityName ? `  ·  ${lotInfo.communityName}` : ""}`;
    doc.text(propertyLine, margin, y);
    y += 7;
  }

  // ── Options table ─────────────────────────────────────────────────────────
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, y, contentW, 8, 2, 2, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("Category",     margin + 3,        y + 5.5);
  doc.text("Selection",    margin + 70,        y + 5.5);
  doc.text("Price Impact", pageW - margin - 3, y + 5.5, { align: "right" });
  y += 8;

  const baseRows    = optionRows.filter(r => r.price === 0);
  const upgradeRows = optionRows.filter(r => r.price > 0);

  function drawRows(rows: typeof optionRows, bg1: [number,number,number], bg2: [number,number,number]) {
    rows.forEach((row, i) => {
      const rowH = 7;
      doc.setFillColor(...(i % 2 === 0 ? bg1 : bg2));
      doc.rect(margin, y, contentW, rowH, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);
      doc.text(row.category, margin + 3,  y + 4.8);
      doc.text(row.option,   margin + 70, y + 4.8);
      const priceStr = row.price === 0
        ? "Included"
        : `+${row.price.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}`;
      doc.setTextColor(row.price > 0 ? 37 : 51, row.price > 0 ? 99 : 65, row.price > 0 ? 235 : 85);
      doc.text(priceStr, pageW - margin - 3, y + 4.8, { align: "right" });
      y += rowH;
    });
  }

  drawRows(baseRows, [255,255,255], [248,250,252]);
  if (upgradeRows.length > 0) {
    y += 4;
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("Upgrades", margin, y + 3);
    y += 6;
    drawRows(upgradeRows, [239,246,255], [219,234,254]);
  }

  // ── Total ─────────────────────────────────────────────────────────────────
  y += 6;
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(margin, y, contentW, 12, 2, 2, "F");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("Total Estimate", margin + 4, y + 7.8);
  doc.text(
    totalPrice.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }),
    pageW - margin - 4, y + 7.8, { align: "right" }
  );
  y += 18;

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text(
    "This quote is an estimate based on your selected configuration. Final pricing may vary. Contact your builder for a formal proposal.",
    pageW / 2, y, { align: "center", maxWidth: contentW }
  );

  return doc;
}
