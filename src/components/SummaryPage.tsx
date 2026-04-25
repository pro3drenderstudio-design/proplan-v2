"use client";

import { useState, useEffect } from "react";
import jsPDF, { GState } from "jspdf";
import { Option, CategoryWithOptions, Project } from "@/types/database";
import { PHASES, PhaseId } from "@/constants/phases";

// ── Shared types ──────────────────────────────────────────────────────────────

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
  priceModifier?: number;
}

interface LeadForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

type Step = "summary" | "quote" | "generating" | "done" | "error";

// ── Props ─────────────────────────────────────────────────────────────────────

interface SummaryPageProps {
  project: Project;
  categories: CategoryWithOptions[];
  selectedOptions: Record<string, Option>;
  favorites: Set<string>;
  totalPrice: number;
  phaseScreenshots: Partial<Record<PhaseId, string | null>>;
  interior2Screenshot?: string | null;
  builder?: BuilderBranding | null;
  lotInfo?: LotInfo | null;
  onClose: () => void;
  onToggleFavorite?: (optionId: string) => void;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SummaryPage({
  project,
  categories,
  selectedOptions,
  favorites,
  totalPrice,
  phaseScreenshots,
  interior2Screenshot,
  builder,
  lotInfo,
  onClose,
  onToggleFavorite,
}: SummaryPageProps) {
  const [step, setStep]       = useState<Step>("summary");
  const [aiRenders, setAiRenders]     = useState<Partial<Record<PhaseId, string | null>>>({});
  const [aiLoading, setAiLoading]     = useState<Partial<Record<PhaseId, boolean>>>({});
  const [aiRender2, setAiRender2]     = useState<string | null | undefined>(undefined);
  const [aiLoading2, setAiLoading2]   = useState(false);
  const [rendersTriggered, setRendersTriggered] = useState(false);
  const [form, setForm]       = useState<LeadForm>({ firstName: "", lastName: "", email: "", phone: "" });
  const [errorMsg, setErrorMsg]       = useState("");
  const [portalToken, setPortalToken] = useState<string | null>(null);
  const [portalCopied, setPortalCopied] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [activePage, setActivePage]   = useState(0);

  async function renderOne(
    phaseId: PhaseId | "interior2",
    screenshot: string,
    signal: AbortSignal,
  ): Promise<void> {
    if (signal.aborted) return;
    const isExtra = phaseId === "interior2";
    const apiPhase = isExtra ? "interior" : phaseId;

    if (isExtra) setAiLoading2(true);
    else setAiLoading(prev => ({ ...prev, [phaseId]: true }));

    let base64 = screenshot;
    let mimeType = "image/jpeg";
    if (screenshot.includes(",")) {
      const [header, data] = screenshot.split(",");
      base64 = data;
      const mimeMatch = header.match(/data:([^;]+);/);
      if (mimeMatch) mimeType = mimeMatch[1];
    }
    const setResult = (url: string | null) => {
      if (isExtra) setAiRender2(url ?? screenshot);
      else setAiRenders(prev => ({ ...prev, [phaseId]: url ?? screenshot }));
    };

    try {
      const submitRes = await fetch("/api/generate-render", {
        method: "POST", signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType, phase: apiPhase }),
      });
      if (!submitRes.ok) {
        const errText = await submitRes.text().catch(() => submitRes.statusText);
        console.error("[generate-render] HTTP error", submitRes.status, errText);
        throw new Error(`generate-render ${submitRes.status}: ${errText}`);
      }
      const json = await submitRes.json() as { imageBase64?: string; error?: string };
      if (json.error) {
        console.error("[generate-render] API error:", json.error);
        throw new Error(json.error);
      }
      setResult(json.imageBase64 ? `data:image/png;base64,${json.imageBase64}` : null);
    } catch (err) {
      console.error("[generate-render] failed for", phaseId, err);
      if (!signal.aborted) setResult(null);
    } finally {
      if (!signal.aborted) {
        if (isExtra) setAiLoading2(false);
        else setAiLoading(prev => ({ ...prev, [phaseId]: false }));
      }
    }
  }

  function startRenders() {
    if (rendersTriggered) return;
    setRendersTriggered(true);
    const abort = new AbortController();
    (async () => {
      for (const phase of PHASES) {
        const shot = phaseScreenshots[phase.id];
        if (shot) await renderOne(phase.id, shot, abort.signal);
        if (abort.signal.aborted) return;
      }
      if (interior2Screenshot && !abort.signal.aborted) {
        await renderOne("interior2", interior2Screenshot, abort.signal);
      }
    })();
  }

  // Auto-advance the active tab to whichever page is currently rendering.
  // Must live before any early returns (Rules of Hooks).
  // Derive the target page index from raw loading states + props so we don't
  // need brochurePages, which is only computed later in the render.
  const renderingKey = PHASES.map(p => aiLoading[p.id] ? "1" : "0").join("") + (aiLoading2 ? "1" : "0");
  useEffect(() => {
    const loadingPhaseId = PHASES.find(p => !!aiLoading[p.id])?.id ?? (aiLoading2 ? "interior2" : null);
    if (!loadingPhaseId) return;
    // Reconstruct the same page ordering brochurePages uses
    const pageIds = [
      ...PHASES.filter(p => !!phaseScreenshots[p.id]).map(p => p.id),
      ...(interior2Screenshot ? ["interior2"] : []),
    ];
    const idx = pageIds.indexOf(loadingPhaseId);
    if (idx >= 0) setActivePage(idx);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderingKey]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStep("generating");
    setErrorMsg("");

    try {
      const makeRows = (phase: "exterior" | "interior") =>
        categories
          .filter(c => c.phase === phase)
          .map(cat => {
            const opt = selectedOptions[cat.id];
            if (!opt) return null;
            return { category: cat.name, option: opt.friendly_name, price: opt.price_impact ?? 0 };
          })
          .filter(Boolean) as { category: string; option: string; price: number }[];

      const exteriorOptionRows = makeRows("exterior");
      const interiorOptionRows = makeRows("interior");

      const exteriorRender  = aiRenders.exterior ?? phaseScreenshots.exterior ?? null;
      const interiorRender  = aiRenders.interior ?? phaseScreenshots.interior ?? null;
      const interior2Render = aiRender2 ?? interior2Screenshot ?? null;

      let logoBase64: string | null = null;
      let logoNaturalW: number | null = null;
      let logoNaturalH: number | null = null;
      if (builder?.logo_url) {
        try {
          const blob = await fetch(builder.logo_url).then(r => r.blob());
          logoBase64 = await new Promise<string>(res => {
            const reader = new FileReader();
            reader.onload = () => res(reader.result as string);
            reader.readAsDataURL(blob);
          });
          const dims = await new Promise<{ w: number; h: number }>(res => {
            const img = new Image();
            img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
            img.onerror = () => res({ w: 0, h: 0 });
            img.src = logoBase64!;
          });
          if (dims.w > 0) { logoNaturalW = dims.w; logoNaturalH = dims.h; }
        } catch { /* skip */ }
      }

      const builderWithLogo = builder && logoBase64 ? { ...builder, logo_url: logoBase64 } : builder;

      const pdfDoc = buildPdf({
        project, buyer: form,
        exteriorOptionRows, interiorOptionRows,
        totalPrice,
        exteriorRender, interiorRender, interior2Render,
        builder: builderWithLogo,
        logoNaturalW, logoNaturalH, lotInfo,
      });

      const pdfBase64 = pdfDoc.output("datauristring");
      const pdfBlob   = pdfDoc.output("blob");

      const url = URL.createObjectURL(pdfBlob);
      const a   = document.createElement("a");
      a.href     = url;
      a.download = `${project.name.replace(/\s+/g, "-")}-quote.pdf`;
      a.click();
      URL.revokeObjectURL(url);

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

      const configMap = Object.fromEntries(
        Object.entries(selectedOptions).map(([catId, opt]) => [catId, opt.id])
      );

      const leadRes = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id:     project.id,
          first_name:     form.firstName,
          last_name:      form.lastName,
          email:          form.email,
          phone:          form.phone || null,
          configuration:  configMap,
          total_value:    totalPrice,
          lot_number:     lotInfo?.lotNumber     ?? null,
          community_slug: lotInfo?.communitySlug ?? null,
          community_name: lotInfo?.communityName ?? null,
        }),
      });
      const leadData = leadRes.ok ? await leadRes.json() : null;

      const portalRes = await fetch("/api/portal/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id:     project.id,
          lead_id:        leadData?.id ?? null,
          configuration:  configMap,
          total_price:    totalPrice,
          phase_snapshot: "exterior",
          lot_id:         lotInfo?.lotId ?? null,
          thumbnail_url:  exteriorRender,
        }),
      });
      if (portalRes.ok) {
        const { token } = await portalRes.json();
        setPortalToken(token ?? null);
      }

      setStep("done");
    } catch (err) {
      console.error("SummaryPage submit error:", err);
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      setStep("error");
    }
  }

  // ── Step: generating / done / error ──────────────────────────────────────────
  if (step === "generating") {
    return (
      <FullScreenOverlay>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-sm text-white/60">Building your quote…</p>
        </div>
      </FullScreenOverlay>
    );
  }

  if (step === "done") {
    return (
      <FullScreenOverlay>
        <div className="flex flex-col items-center gap-5 text-center max-w-sm">
          <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-7 h-7 text-green-400">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 0 1 0 1.414l-8 8a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 1.414-1.414L8 12.586l7.293-7.293a1 1 0 0 1 1.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-lg">Your quote is on its way!</p>
            <p className="text-sm text-white/45 mt-1">We&apos;ve sent your personalised quote to {form.email}</p>
          </div>
          <div
            className="w-full rounded-2xl px-4 py-3.5 text-left"
            style={{ background: "linear-gradient(135deg, rgba(201,169,110,0.12), rgba(201,169,110,0.06))", border: "1px solid rgba(201,169,110,0.2)" }}
          >
            <p className="text-[11px] font-semibold text-amber-300/80 mb-0.5">What happens next?</p>
            <p className="text-xs text-white/45 leading-relaxed">
              One of our team members will be in touch soon to discuss bringing your home to life. We look forward to helping you build something extraordinary.
            </p>
          </div>
          {portalToken && (
            <div
              className="w-full rounded-xl p-4 text-left"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
            >
              <p className="text-white/45 text-xs mb-2 font-semibold uppercase tracking-wide">Your shareable link</p>
              <div className="flex items-center gap-2">
                <span className="flex-1 text-xs text-white/55 font-mono truncate">
                  {typeof window !== "undefined"
                    ? `${window.location.origin}/portal/${portalToken}`
                    : `/portal/${portalToken}`}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/portal/${portalToken}`);
                    setPortalCopied(true);
                    setTimeout(() => setPortalCopied(false), 2000);
                  }}
                  className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                  style={{ background: "rgba(255,255,255,0.1)", color: portalCopied ? "#4ade80" : "rgba(255,255,255,0.7)" }}
                >
                  {portalCopied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          )}
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl text-sm text-white font-medium transition-colors"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.09)" }}
          >
            Return to configurator
          </button>
        </div>
      </FullScreenOverlay>
    );
  }

  if (step === "error") {
    return (
      <FullScreenOverlay>
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center text-red-400 text-2xl">!</div>
          <div>
            <p className="text-white font-semibold">Something went wrong</p>
            {errorMsg && <p className="text-xs text-white/40 mt-1">{errorMsg}</p>}
          </div>
          <button
            onClick={() => setStep("quote")}
            className="px-6 py-2.5 rounded-xl text-sm text-white transition-colors"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.09)" }}
          >
            Try again
          </button>
        </div>
      </FullScreenOverlay>
    );
  }

  // ── Step: quote form ──────────────────────────────────────────────────────────
  if (step === "quote") {
    return (
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}
      >
        <div
          className="relative w-full shadow-2xl shadow-black/60 overflow-hidden"
          style={{
            maxWidth: 480,
            borderRadius: 20,
            background: "rgba(10,12,20,0.92)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <button
            onClick={() => setStep("summary")}
            className="absolute top-4 left-4 z-10 flex items-center gap-1.5 text-white/40 hover:text-white/70 text-xs transition-colors"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
              <path fillRule="evenodd" d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06l-3.25-3.25a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0z" clipRule="evenodd" />
            </svg>
            Back
          </button>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white/8 hover:bg-white/15 text-white/50 hover:text-white text-lg transition-colors"
            aria-label="Close"
          >
            ×
          </button>

          <div className="p-6 pt-12">
            {/* Builder branding */}
            {builder && (
              <div className="flex items-center mb-5 pb-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                {builder.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={builder.logo_url} alt={builder.company_name} className="h-7 max-w-[140px] object-contain" />
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
                className="flex items-center gap-2 px-3 py-2 rounded-xl mb-4 text-sm"
                style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.22)" }}
              >
                <span className="text-blue-400/80 text-xs">⬡</span>
                <span className="text-blue-300 font-semibold text-sm">Lot {lotInfo.lotNumber}</span>
                {lotInfo.communityName && (
                  <>
                    <span className="text-white/20">·</span>
                    <span className="text-white/50 text-sm">{lotInfo.communityName}</span>
                  </>
                )}
              </div>
            )}

            <h2 className="text-xl font-bold text-white mb-1">Get Your Quote</h2>
            <p className="text-sm text-white/45 mb-6">
              We&apos;ll email your personalised PDF quote immediately.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-white/35 mb-1.5 uppercase tracking-wider">First name</label>
                  <input
                    name="firstName" required value={form.firstName} onChange={handleChange}
                    className="w-full rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder-white/18 focus:outline-none transition-colors"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
                    placeholder="Jane"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-white/35 mb-1.5 uppercase tracking-wider">Last name</label>
                  <input
                    name="lastName" required value={form.lastName} onChange={handleChange}
                    className="w-full rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder-white/18 focus:outline-none transition-colors"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
                    placeholder="Smith"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-white/35 mb-1.5 uppercase tracking-wider">Email</label>
                <input
                  name="email" type="email" required value={form.email} onChange={handleChange}
                  className="w-full rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder-white/18 focus:outline-none transition-colors"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
                  placeholder="jane@example.com"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-white/35 mb-1.5 uppercase tracking-wider">
                  Phone <span className="text-white/25 normal-case font-normal">(optional)</span>
                </label>
                <input
                  name="phone" type="tel" value={form.phone} onChange={handleChange}
                  className="w-full rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder-white/18 focus:outline-none transition-colors"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.09)" }}
                  placeholder="+1 555 000 0000"
                />
              </div>

              {/* Price summary before submit */}
              <div
                className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <span className="text-white/45 text-xs">Total estimate</span>
                <span
                  className="text-white font-bold text-sm"
                  style={{ fontFamily: "var(--font-syne), sans-serif" }}
                >
                  {totalPrice.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
                </span>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl text-white text-sm font-semibold transition-colors shadow-lg"
                style={{ background: "rgba(37,99,235,0.9)", boxShadow: "0 4px 20px rgba(37,99,235,0.3)" }}
              >
                Generate &amp; Send Quote
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ── Step: summary — paginated brochure ───────────────────────────────────────

  const selectedOptionIds = new Set(Object.values(selectedOptions).map(o => o.id));
  const accent = /^#[0-9a-fA-F]{6}$/.test(builder?.accent_color ?? "") ? builder!.accent_color! : "#C9A96E";

  // Build brochure pages: one per phase that has categories or a screenshot
  const brochurePages: { id: string; label: string; cats: typeof categories; render: string | null | undefined; loading: boolean; aiLabel?: string }[] = [];
  for (const phase of PHASES) {
    const phaseCats = categories.filter(c => c.phase?.toLowerCase() === phase.id);
    const visibleCats = phaseCats.filter(cat => {
      if (!cat.show_when || cat.show_when.length === 0) return true;
      return cat.show_when.some(id => selectedOptionIds.has(id));
    });
    if (visibleCats.length > 0 || phaseScreenshots[phase.id]) {
      brochurePages.push({
        id: phase.id,
        label: phase.id === "exterior" ? "Exterior Design" : phase.id === "interior" ? "Interior Spaces" : "Blueprint",
        cats: visibleCats,
        render: aiRenders[phase.id] ?? phaseScreenshots[phase.id],
        loading: !!aiLoading[phase.id],
        aiLabel: phase.id === "exterior" ? "Exterior" : "Interior",
      });
    }
  }
  // Interior Camera 2 page — appended only if a second interior screenshot was captured
  if (interior2Screenshot) {
    const intCats = categories.filter(c => c.phase?.toLowerCase() === "interior").filter(cat => {
      if (!cat.show_when || cat.show_when.length === 0) return true;
      return cat.show_when.some(id => selectedOptionIds.has(id));
    });
    brochurePages.push({
      id: "interior2",
      label: "Interior — View 2",
      cats: intCats,
      render: aiRender2 ?? interior2Screenshot,
      loading: aiLoading2,
      aiLabel: "Interior",
    });
  }

  const pageCount = brochurePages.length;
  const safePage  = Math.min(activePage, Math.max(0, pageCount - 1));
  const anyRendering = brochurePages.some(p => p.loading) || PHASES.some(p => aiLoading[p.id]);

  // Render progress counters for the progress bar
  const totalRenders = PHASES.filter(p => !!phaseScreenshots[p.id]).length + (interior2Screenshot ? 1 : 0);
  const doneRenders = PHASES.filter(p => !!phaseScreenshots[p.id] && aiRenders[p.id] !== undefined).length
    + (interior2Screenshot && aiRender2 !== undefined ? 1 : 0);

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col overflow-hidden"
      style={{ background: "#0b0c0e" }}
    >
      {/* ── Grain texture overlay ── */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E\")",
          opacity: 0.35,
        }}
      />

      {/* ── Top bar ── */}
      <div
        className="relative z-10 flex-shrink-0 flex items-center justify-between px-3 sm:px-6 py-2.5 sm:py-3"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        {/* Left: branding */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {builder?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={builder.logo_url} alt={builder.company_name} className="h-5 sm:h-6 object-contain opacity-80 flex-shrink-0" />
          ) : builder?.company_name ? (
            <span className="text-white/60 text-xs sm:text-sm font-semibold tracking-wide truncate">{builder.company_name}</span>
          ) : null}
          {(builder?.logo_url || builder?.company_name) && (
            <div className="flex-shrink-0" style={{ width: 1, height: 14, background: "rgba(255,255,255,0.1)" }} />
          )}
          <div className="min-w-0">
            <p className="text-[8px] sm:text-[9px] font-semibold text-white/25 uppercase tracking-[0.22em]">Your Configuration</p>
            <p className="text-white/80 font-semibold text-xs sm:text-sm leading-tight tracking-tight truncate">{project.name}</p>
          </div>
        </div>

        {/* Right: lot badge + AI status + close */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {lotInfo?.lotNumber && (
            <div
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ background: `${accent}18`, border: `1px solid ${accent}30`, color: accent }}
            >
              <span style={{ opacity: 0.7 }}>⬡</span>
              Lot {lotInfo.lotNumber}
              {lotInfo.communityName && (
                <span style={{ opacity: 0.55, fontWeight: 400 }}> · {lotInfo.communityName}</span>
              )}
            </div>
          )}
          {anyRendering ? (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full border border-white/20 border-t-white/60 animate-spin" />
              <span className="hidden sm:inline text-[10px] text-white/30 tracking-wide">Enhancing your renders…</span>
            </div>
          ) : !rendersTriggered && (PHASES.some(p => !!phaseScreenshots[p.id]) || !!interior2Screenshot) ? (
            <button
              onClick={startRenders}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:scale-105 active:scale-95"
              style={{ background: `${accent}22`, border: `1px solid ${accent}40`, color: accent }}
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3 flex-shrink-0">
                <path d="M7.657 6.247c.11-.33.576-.33.686 0l.645 1.937a2.89 2.89 0 0 0 1.829 1.828l1.936.645c.33.11.33.576 0 .686l-1.937.645a2.89 2.89 0 0 0-1.828 1.829l-.645 1.936a.361.361 0 0 1-.686 0l-.645-1.937a2.89 2.89 0 0 0-1.828-1.828l-1.937-.645a.361.361 0 0 1 0-.686l1.937-.645a2.89 2.89 0 0 0 1.828-1.828l.645-1.937zM3.794 1.148a.217.217 0 0 1 .412 0l.387 1.162c.173.518.579.924 1.097 1.097l1.162.387a.217.217 0 0 1 0 .412l-1.162.387A1.73 1.73 0 0 0 4.593 5.69l-.387 1.162a.217.217 0 0 1-.412 0L3.407 5.69A1.73 1.73 0 0 0 2.31 4.593l-1.162-.387a.217.217 0 0 1 0-.412l1.162-.387A1.73 1.73 0 0 0 3.407 2.31l.387-1.162zM10.863.099a.145.145 0 0 1 .274 0l.258.774c.115.346.386.617.732.732l.774.258a.145.145 0 0 1 0 .274l-.774.258a1.16 1.16 0 0 0-.732.732l-.258.774a.145.145 0 0 1-.274 0l-.258-.774a1.16 1.16 0 0 0-.732-.732L9.1 2.137a.145.145 0 0 1 0-.274l.774-.258c.346-.115.617-.386.732-.732L10.863.1z"/>
              </svg>
              <span className="hidden sm:inline">AI Renders</span>
              <span className="sm:hidden">AI</span>
            </button>
          ) : null}
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full text-white/30 hover:text-white/70 hover:bg-white/8 transition-colors"
            aria-label="Close"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
              <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Page tab switcher ── */}
      {pageCount > 1 && (
        <div
          className="relative z-10 flex-shrink-0 flex items-stretch gap-0 overflow-x-auto"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(11,12,14,0.95)", scrollbarWidth: "none" }}
        >
          {brochurePages.map((pg, i) => {
            const isActive = i === safePage;
            return (
              <button
                key={pg.id}
                onClick={() => setActivePage(i)}
                className="flex-1 flex-shrink-0 flex flex-col items-center gap-0.5 py-2.5 px-2 sm:px-3 transition-all duration-200 relative"
                style={{
                  background: isActive ? `${accent}10` : "transparent",
                  borderBottom: isActive ? `2px solid ${accent}` : "2px solid transparent",
                  minWidth: 80,
                }}
              >
                <span
                  className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.14em] sm:tracking-[0.18em] transition-colors"
                  style={{ color: isActive ? accent : "rgba(255,255,255,0.3)" }}
                >
                  {pg.label}
                </span>
                {pg.loading && (
                  <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: accent }} />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Render progress bar ── */}
      {anyRendering && (
        <div className="relative z-10 flex-shrink-0 h-px bg-white/5 overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 transition-all duration-1000 ease-out"
            style={{
              width: totalRenders > 0 ? `${Math.max(4, (doneRenders / totalRenders) * 100)}%` : "5%",
              background: `linear-gradient(90deg, ${accent}aa, ${accent})`,
              boxShadow: `0 0 6px ${accent}80`,
            }}
          />
        </div>
      )}

      {/* ── Main brochure area ── */}
      <div className="relative z-10 flex-1 flex overflow-hidden">
        {brochurePages.map((pg, idx) => {
          const isActive = idx === safePage;
          return (
            <div
              key={pg.id}
              className="absolute inset-0 flex flex-col md:flex-row"
              style={{
                transform: `translateX(${(idx - safePage) * 100}%)`,
                transition: "transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)",
                pointerEvents: isActive ? "auto" : "none",
              }}
            >
              {/* Left/right arrows — desktop only */}
              {pageCount > 1 && (
                <button
                  onClick={() => setActivePage(p => Math.max(0, p - 1))}
                  disabled={safePage === 0}
                  className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 items-center justify-center rounded-full transition-all duration-200 disabled:opacity-0"
                  style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.12)", backdropFilter: "blur(8px)" }}
                  aria-label="Previous"
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-white/70">
                    <path fillRule="evenodd" d="M9.78 4.22a.75.75 0 0 1 0 1.06L7.06 8l2.72 2.72a.75.75 0 1 1-1.06 1.06l-3.25-3.25a.75.75 0 0 1 0-1.06l3.25-3.25a.75.75 0 0 1 1.06 0z" clipRule="evenodd" />
                  </svg>
                </button>
              )}

              {/* Render panel: full-width 16:9 on mobile, 58% height-fill on desktop */}
              <div
                className="relative w-full aspect-video flex-shrink-0 overflow-hidden md:w-[58%] md:aspect-auto md:h-full"
              >
                {pg.render ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={pg.render}
                    alt={pg.label}
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{ filter: pg.loading ? "blur(8px) brightness(0.35)" : "none", transition: "filter 0.6s" }}
                  />
                ) : (
                  <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #0e1018 0%, #141820 50%, #0b0d12 100%)" }} />
                )}

                <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to right, transparent 50%, rgba(11,12,14,0.45) 100%)" }} />
                <div className="absolute bottom-0 left-0 right-0 pointer-events-none" style={{ height: "45%", background: "linear-gradient(to top, rgba(11,12,14,0.88) 0%, transparent 100%)" }} />

                {pg.loading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                    <div className="relative w-12 h-12">
                      <div className="absolute inset-0 rounded-full border-2 border-white/8" />
                      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-white/50 animate-spin" />
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <p className="text-white/55 text-[11px] font-light tracking-[0.2em]">Crafting your vision…</p>
                      <p className="text-white/20 text-[9px] tracking-widest uppercase">Painting every detail</p>
                    </div>
                  </div>
                )}

                <div className="absolute bottom-5 left-5">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.22em] mb-0.5" style={{ color: `${accent}cc` }}>
                    {pg.aiLabel ?? pg.label}
                  </p>
                  <p className="text-white/80 text-2xl font-light leading-none tracking-tight">{pg.label}</p>
                </div>

                {pg.render && !pg.loading && (
                  <>
                    {/* AI badge */}
                    <div className="absolute bottom-5 right-5 flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider"
                      style={{ background: "rgba(0,0,0,0.55)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.45)", backdropFilter: "blur(6px)" }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
                      AI Enhanced
                    </div>
                    {/* Expand */}
                    <button onClick={() => setLightboxSrc(pg.render!)}
                      className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-xl text-white/50 hover:text-white/90 transition-colors"
                      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.09)" }}>
                      <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                        <path d="M1.75 1h4.5a.75.75 0 0 1 0 1.5H2.5v3.75a.75.75 0 0 1-1.5 0v-4.5C1 1.336 1.336 1 1.75 1ZM9.75 1h4.5c.414 0 .75.336.75.75v4.5a.75.75 0 0 1-1.5 0V2.5h-3.75a.75.75 0 0 1 0-1.5ZM1 9.75a.75.75 0 0 1 .75-.75h.5a.75.75 0 0 1 0 1.5H2.5v3.25h3.25a.75.75 0 0 1 0 1.5h-4A.75.75 0 0 1 1 14.25v-4.5ZM13.5 10.5h-.25a.75.75 0 0 1 0-1.5h.5c.414 0 .75.336.75.75v4.5a.75.75 0 0 1-.75.75h-4a.75.75 0 0 1 0-1.5H13.5V10.5Z" />
                      </svg>
                    </button>
                  </>
                )}
              </div>

              {/* Options panel: scrollable, takes remaining space */}
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden"
                style={{ borderTop: "1px solid rgba(255,255,255,0.05)", borderLeft: "1px solid rgba(255,255,255,0.05)", background: "linear-gradient(160deg, #0f1014 0%, #0b0c0e 100%)" }}>
                <div className="flex-shrink-0 px-4 sm:px-6 pt-3 sm:pt-5 pb-3 sm:pb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.26em] mb-0.5" style={{ color: `${accent}99` }}>
                    {pg.label} Options
                  </p>
                  <p className="text-white/45 text-xs">Your selected finishes &amp; features</p>
                </div>
                <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-2 sm:py-3" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}>
                  {pg.cats.length === 0 ? (
                    <p className="text-white/20 text-xs mt-4">No options configured for this view.</p>
                  ) : (
                    <div className="space-y-1">
                      {pg.cats.map((cat) => {
                        const opt = selectedOptions[cat.id];
                        if (!opt) return null;
                        const isFav = favorites.has(opt.id);
                        const hasUpgrade = (opt.price_impact ?? 0) > 0;
                        return (
                          <div key={cat.id} className="group flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: "rgba(255,255,255,0.025)" }}>
                            {opt.thumbnail_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={opt.thumbnail_url} alt={opt.friendly_name} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" style={{ border: "1px solid rgba(255,255,255,0.1)" }} />
                            ) : (
                              <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center" style={{ background: `${accent}15`, border: `1px solid ${accent}25` }}>
                                <div className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-[9px] text-white/30 font-medium uppercase tracking-wide truncate">{cat.name}</p>
                              <p className="text-sm text-white/75 font-medium leading-snug truncate">{opt.friendly_name}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-[10px] font-semibold tabular-nums" style={{ color: hasUpgrade ? accent : "rgba(255,255,255,0.2)" }}>
                                {(opt.price_impact ?? 0) === 0 ? "incl." : `+${opt.price_impact!.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}`}
                              </span>
                              {onToggleFavorite && (
                                <button onClick={() => onToggleFavorite(opt.id)} className="opacity-0 group-hover:opacity-100 transition-opacity" title={isFav ? "Remove" : "Save"}>
                                  <svg viewBox="0 0 16 16" className="w-3 h-3" fill={isFav ? "#f59e0b" : "none"} stroke={isFav ? "#f59e0b" : "rgba(255,255,255,0.3)"} strokeWidth={1.5}>
                                    <path strokeLinejoin="round" d="M8 1.5l1.795 3.637 4.012.583-2.904 2.827.685 3.993L8 10.507l-3.588 1.883.685-3.993-2.904-2.827 4.012-.583L8 1.5z" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="h-3" />
                </div>
              </div>

              {/* Right arrow — desktop only */}
              {pageCount > 1 && (
                <button
                  onClick={() => setActivePage(p => Math.min(pageCount - 1, p + 1))}
                  disabled={safePage === pageCount - 1}
                  className="hidden md:flex absolute right-[42%] top-1/2 -translate-y-1/2 z-20 w-9 h-9 items-center justify-center rounded-full transition-all duration-200 disabled:opacity-0"
                  style={{ background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.12)", backdropFilter: "blur(8px)" }}
                  aria-label="Next"
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4 text-white/70">
                    <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Bottom bar: price + AI status + CTA ── */}
      <div
        className="relative z-10 flex-shrink-0 flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 gap-3 sm:gap-4"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)", background: "rgba(11,12,14,0.97)", backdropFilter: "blur(8px)" }}
      >
        <div className="flex-shrink-0 min-w-0">
          <p className="text-[8px] sm:text-[9px] font-semibold text-white/25 uppercase tracking-[0.22em]">Total Estimate</p>
          <p className="text-lg sm:text-xl font-bold text-white leading-tight" style={{ fontFamily: "var(--font-syne), sans-serif", letterSpacing: "-0.02em" }}>
            {totalPrice.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}
          </p>
          {lotInfo?.priceModifier && lotInfo.priceModifier !== 0 && (
            <p className="text-[9px] mt-0.5" style={{ color: `${accent}99` }}>
              incl. {lotInfo.priceModifier > 0 ? "+" : "−"}{Math.abs(lotInfo.priceModifier).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} lot
            </p>
          )}
        </div>

        {/* Rendering progress */}
        {anyRendering && (
          <div className="flex-1 flex flex-col items-center gap-1 justify-center min-w-0 px-2">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full border border-white/20 border-t-white/60 animate-spin flex-shrink-0" />
              <span className="text-[10px] text-white/45 tracking-wide hidden sm:inline">
                Bringing your home to life
              </span>
            </div>
            {totalRenders > 1 && (
              <div className="hidden sm:flex items-center gap-1.5">
                {Array.from({ length: totalRenders }).map((_, i) => (
                  <div
                    key={i}
                    className="h-0.5 rounded-full transition-all duration-700"
                    style={{
                      width: i < doneRenders ? 16 : 8,
                      background: i < doneRenders ? accent : "rgba(255,255,255,0.15)",
                    }}
                  />
                ))}
                <span className="text-[9px] ml-1" style={{ color: "rgba(255,255,255,0.25)" }}>
                  {doneRenders}/{totalRenders}
                </span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={onClose} className="px-3 sm:px-4 py-2 rounded-xl text-[11px] font-semibold uppercase tracking-widest transition-colors"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.45)" }}>
            Edit
          </button>
          <button
            onClick={() => setStep("quote")}
            disabled={anyRendering}
            className="flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-[11px] font-semibold uppercase tracking-widest transition-all disabled:opacity-50"
            style={{ background: anyRendering ? "rgba(255,255,255,0.06)" : `linear-gradient(135deg, ${accent}ee, ${accent}99)`, boxShadow: anyRendering ? "none" : `0 4px 24px ${accent}28`, border: `1px solid ${anyRendering ? "rgba(255,255,255,0.08)" : accent + "40"}`, color: anyRendering ? "rgba(255,255,255,0.3)" : "#0b0c0e" }}
          >
            Get Quote
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
              <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Lightbox ── */}
      {lightboxSrc && <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </div>
  );
}

// ── Lightbox ──────────────────────────────────────────────────────────────────
// Rendered outside the summary scroll container so it can be truly full-screen.
// It appears as a sibling via a portal-like pattern — we just conditionally
// render it at the bottom of SummaryPage's return before the final </div>.

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-8"
      style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors z-10"
        aria-label="Close"
      >
        <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
          <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z" />
        </svg>
      </button>

      {/* Image — click stops propagation so only backdrop click closes */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Full size render"
        className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
        style={{ boxShadow: "0 32px 80px rgba(0,0,0,0.8)" }}
        onClick={e => e.stopPropagation()}
      />
    </div>
  );
}

// ── Utility wrapper ───────────────────────────────────────────────────────────

function FullScreenOverlay({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(5,7,14,0.97)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
    >
      {children}
    </div>
  );
}

// ── PDF builder ───────────────────────────────────────────────────────────────

interface PdfInput {
  project: Project;
  buyer: LeadForm;
  exteriorOptionRows: { category: string; option: string; price: number }[];
  interiorOptionRows: { category: string; option: string; price: number }[];
  totalPrice: number;
  exteriorRender: string | null;
  interiorRender: string | null;
  interior2Render?: string | null;
  builder?: BuilderBranding | null;
  logoNaturalW?: number | null;
  logoNaturalH?: number | null;
  lotInfo?: LotInfo | null;
}

function buildPdf({
  project, buyer,
  exteriorOptionRows, interiorOptionRows,
  totalPrice,
  exteriorRender, interiorRender, interior2Render,
  builder, logoNaturalW, logoNaturalH, lotInfo,
}: PdfInput): jsPDF {
  // Landscape A4: 297 × 210 mm — better proportions for renders
  const doc    = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW  = 297;
  const pageH  = 210;
  const margin = 14;
  const cw     = pageW - margin * 2;
  const date   = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const accentHex = /^#[0-9a-fA-F]{6}$/.test(builder?.accent_color ?? "")
    ? builder!.accent_color! : "#C9A96E";
  const aR = parseInt(accentHex.slice(1, 3), 16);
  const aG = parseInt(accentHex.slice(3, 5), 16);
  const aB = parseInt(accentHex.slice(5, 7), 16);

  // Page count: cover + interior view(s) + options pages + summary
  const hasInterior1 = !!interiorRender;
  const hasInterior2 = !!interior2Render;
  const hasExtOpts   = exteriorOptionRows.length > 0;
  const hasIntOpts   = interiorOptionRows.length > 0;
  const totalPages =
    1 +
    (hasInterior1 ? 1 : 0) +
    (hasInterior2 ? 1 : 0) +
    (hasExtOpts   ? 1 : 0) +
    (hasIntOpts   ? 1 : 0) +
    1; // summary/totals always last
  const priceStr = totalPrice.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  // jsPDF internal scale factor: points per mm
  const k = (doc as any).internal.scaleFactor as number;

  // Set a PDF clipping rectangle so subsequent draws are confined to it.
  // jsPDF uses top-left origin; PDF uses bottom-left — convert here.
  // Must be called between saveGraphicsState() / restoreGraphicsState().
  function setClipRect(x: number, y: number, w: number, h: number) {
    const px = (x * k).toFixed(3);
    const py = ((pageH - y - h) * k).toFixed(3);
    const pw = (w * k).toFixed(3);
    const ph = (h * k).toFixed(3);
    // `re` = rectangle path, `W` = intersect with clipping path, `n` = end path (no paint)
    (doc as any).internal.out(`${px} ${py} ${pw} ${ph} re W n`);
  }

  // Draw an image cover-fitted (fills rect, maintains AR, crops overflow).
  // Caller must call setClipRect first if the overflow must be hidden.
  function imgCoverRaw(src: string, x: number, y: number, w: number, h: number) {
    const p  = doc.getImageProperties(src);
    const sa = p.width / p.height;
    const da = w / h;
    let dw: number, dh: number, dx: number, dy: number;
    if (sa > da) { dh = h; dw = h * sa; dx = x + (w - dw) / 2; dy = y; }
    else         { dw = w; dh = w / sa; dx = x; dy = y + (h - dh) / 2; }
    try { doc.addImage(src, "JPEG", dx, dy, dw, dh, undefined, "FAST"); }
    catch { try { doc.addImage(src, "PNG", dx, dy, dw, dh); } catch { /* skip */ } }
  }

  // Public: cover-fit an image within a clipped region (no bleed, no letterbox).
  function imgCover(src: string, x: number, y: number, w: number, h: number) {
    try {
      doc.saveGraphicsState();
      setClipRect(x, y, w, h);
      imgCoverRaw(src, x, y, w, h);
      doc.restoreGraphicsState();
    } catch {
      try { doc.addImage(src, "JPEG", x, y, w, h, undefined, "FAST"); } catch { /* skip */ }
    }
  }

  // Contain an image (no crop, letter-box with dark bg already drawn behind).
  // Use when container AR ≈ image AR to avoid visible bars; otherwise use imgCover.
  function imgContain(src: string, x: number, y: number, w: number, h: number) {
    try {
      const p  = doc.getImageProperties(src);
      const sa = p.width / p.height;
      const da = w / h;
      let dw: number, dh: number, dx: number, dy: number;
      if (sa > da) { dw = w; dh = w / sa; dx = x; dy = y + (h - dh) / 2; }
      else         { dh = h; dw = h * sa; dx = x + (w - dw) / 2; dy = y; }
      try { doc.addImage(src, "JPEG", dx, dy, dw, dh, undefined, "FAST"); }
      catch { doc.addImage(src, "PNG", dx, dy, dw, dh); }
    } catch {
      try { doc.addImage(src, "JPEG", x, y, w, h, undefined, "FAST"); } catch { /* skip */ }
    }
  }

  // Solid semi-transparent dark scrim overlay (no gradient banding)
  function darkScrim(x: number, y: number, w: number, h: number, opacity = 0.55) {
    doc.saveGraphicsState();
    doc.setGState(new GState({ opacity }));
    doc.setFillColor(6, 8, 14);
    doc.rect(x, y, w, h, "F");
    doc.restoreGraphicsState();
  }

  // Approximate a smooth linear gradient scrim using thin strips.
  // direction: "vertical" (top→bottom) or "horizontal" (left→right)

  // Page footer
  function drawPageFooter(pageNum: number) {
    const fy = pageH - 8;
    doc.saveGraphicsState();
    doc.setGState(new GState({ opacity: 0.1 }));
    doc.setDrawColor(aR, aG, aB); doc.setLineWidth(0.2);
    doc.line(margin, fy, pageW - margin, fy);
    doc.restoreGraphicsState();
    doc.setFont("helvetica", "normal"); doc.setFontSize(5.5);
    doc.setTextColor(70, 85, 118);
    if (builder?.company_name) doc.text(builder.company_name, margin, fy + 5);
    doc.text(`${pageNum} / ${totalPages}`, pageW / 2, fy + 5, { align: "center" });
    doc.text(date, pageW - margin, fy + 5, { align: "right" });
  }

  // Interior/details page header strip
  function drawPageHeader(label: string) {
    doc.setFillColor(8, 10, 18);
    doc.rect(0, 0, pageW, pageH, "F");
    doc.setFillColor(12, 15, 26);
    doc.rect(0, 0, pageW, 14, "F");
    doc.setFillColor(aR, aG, aB);
    doc.rect(0, 0, 3, 14, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(6.5);
    doc.setTextColor(aR, aG, aB);
    doc.text(label, margin, 9);
    doc.setFont("helvetica", "normal"); doc.setFontSize(6.5);
    doc.setTextColor(95, 115, 155);
    doc.text(project.name, pageW - margin, 9, { align: "right" });
    // Builder logo
    if (builder?.logo_url) {
      try {
        const lh = 7; const lmW = 24;
        const lw = (logoNaturalW && logoNaturalH && logoNaturalH > 0)
          ? Math.min(lmW, Math.round((logoNaturalW / logoNaturalH) * lh * 10) / 10) : lmW;
        doc.addImage(builder.logo_url, "PNG", pageW - margin - lw, 3.5, lw, lh);
      } catch { /* skip */ }
    }
    doc.saveGraphicsState();
    doc.setGState(new GState({ opacity: 0.2 }));
    doc.setDrawColor(aR, aG, aB); doc.setLineWidth(0.2);
    doc.line(0, 14, pageW, 14);
    doc.restoreGraphicsState();
  }

  // ── Shared table drawing ──────────────────────────────────────────
  const col2 = margin + 90;
  const col3 = pageW - margin;

  function drawOptionsTable(rows: { category: string; option: string; price: number }[]) {
    // Table header row
    let y = 24;
    doc.setFillColor(16, 20, 34);
    doc.rect(margin, y, cw, 8, "F");
    doc.setFillColor(aR, aG, aB);
    doc.rect(margin, y, 2.5, 8, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(6);
    doc.setTextColor(140, 160, 205);
    doc.text("CATEGORY",  margin + 6, y + 5.5);
    doc.text("SELECTION", col2,       y + 5.5);
    doc.text("PRICE",     col3 - 3,   y + 5.5, { align: "right" });
    y += 8;

    const baseRows    = rows.filter(r => r.price === 0);
    const upgradeRows = rows.filter(r => r.price > 0);

    function drawRows(rws: typeof rows, isUpgrade: boolean) {
      rws.forEach((row, i) => {
        const rowH = 7;
        doc.setFillColor(i % 2 === 0 ? 14 : 18, i % 2 === 0 ? 17 : 22, i % 2 === 0 ? 28 : 35);
        doc.rect(margin, y, cw, rowH, "F");
        doc.setFont("helvetica", "normal"); doc.setFontSize(7);
        doc.setTextColor(155, 172, 212);
        doc.text(doc.splitTextToSize(row.category, 82)[0] as string, margin + 6, y + 4.7);
        doc.text(doc.splitTextToSize(row.option,   110)[0] as string, col2,       y + 4.7);
        if (isUpgrade && row.price > 0) {
          doc.setFont("helvetica", "bold"); doc.setTextColor(aR, aG, aB);
          doc.text(`+${row.price.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}`,
            col3 - 3, y + 4.7, { align: "right" });
        } else {
          doc.setFont("helvetica", "normal"); doc.setTextColor(55, 75, 115);
          doc.text("Included", col3 - 3, y + 4.7, { align: "right" });
        }
        y += rowH;
      });
    }

    drawRows(baseRows, false);

    if (upgradeRows.length > 0) {
      y += 4;
      doc.setFillColor(18, 23, 38);
      doc.rect(margin, y, cw, 7, "F");
      doc.setFillColor(aR, aG, aB);
      doc.rect(margin, y, 2.5, 7, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(6);
      doc.setTextColor(aR, aG, aB);
      doc.text("UPGRADES & PREMIUM OPTIONS", margin + 6, y + 4.8);
      y += 7;
      drawRows(upgradeRows, true);
    }
  }

  // ── Full-bleed image page helper ──────────────────────────────────
  function drawImagePage(src: string, label: string, pageNum: number) {
    doc.addPage();
    const imgAreaH = pageH - 16; // leave room for footer only
    doc.setFillColor(6, 8, 14);
    doc.rect(0, 0, pageW, pageH, "F");
    imgCover(src, 0, 0, pageW, imgAreaH);
    darkScrim(0, imgAreaH - 18, pageW, 18, 0.72);
    doc.setFont("helvetica", "bold"); doc.setFontSize(6);
    doc.setTextColor(aR, aG, aB);
    doc.text(label, margin, imgAreaH - 6);
    // AI Enhanced badge bottom-right
    doc.saveGraphicsState();
    doc.setGState(new GState({ opacity: 0.75 }));
    doc.setFillColor(aR, aG, aB);
    doc.roundedRect(pageW - margin - 24, imgAreaH - 14, 24, 6, 1, 1, "F");
    doc.restoreGraphicsState();
    doc.setFont("helvetica", "bold"); doc.setFontSize(5);
    doc.setTextColor(8, 10, 16);
    doc.text("AI ENHANCED", pageW - margin - 12, imgAreaH - 10, { align: "center" });
    drawPageFooter(pageNum);
  }

  // ══════════════════════════════════════════════════════════════════
  // PAGE 1  —  Cover: full-bleed image + floating top bar + bottom scrim
  // ══════════════════════════════════════════════════════════════════

  // ── Full-bleed image ──────────────────────────────────────────────
  if (exteriorRender) {
    imgCover(exteriorRender, 0, 0, pageW, pageH);
  } else {
    doc.setFillColor(5, 7, 13);
    doc.rect(0, 0, pageW, pageH, "F");
  }

  // ── Logo pill — semi-transparent container floating top-left ─────
  const logoPillX = margin - 3;
  const logoPillY = 5;
  const logoPillH = 18;
  const logoPillW = 64;
  doc.saveGraphicsState();
  doc.setGState(new GState({ opacity: 0.60 }));
  doc.setFillColor(4, 6, 14);
  doc.roundedRect(logoPillX, logoPillY, logoPillW, logoPillH, 2, 2, "F");
  doc.restoreGraphicsState();

  if (builder?.logo_url) {
    try {
      const lh = 10; const lmW = logoPillW - 8;
      const lw = (logoNaturalW && logoNaturalH && logoNaturalH > 0)
        ? Math.min(lmW, Math.round((logoNaturalW / logoNaturalH) * lh * 10) / 10) : lmW;
      doc.addImage(builder.logo_url, "PNG", margin, logoPillY + (logoPillH - lh) / 2, lw, lh);
    } catch { /* skip */ }
  } else if (builder?.company_name) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(8);
    doc.setTextColor(240, 244, 255);
    doc.text(builder.company_name, margin, logoPillY + 12);
  }

  // ── Date — floating top-right ─────────────────────────────────────
  doc.setFont("helvetica", "normal"); doc.setFontSize(5);
  doc.setTextColor(210, 220, 240);
  doc.text(date, pageW - margin, 16, { align: "right" });

  // ── Bottom scrim — flat semi-transparent rectangle, no gradient ──
  const scrimY = pageH * 0.58;           // starts ~58% down
  const scrimH = pageH - scrimY;         // fills to page bottom
  doc.saveGraphicsState();
  doc.setGState(new GState({ opacity: 0.76 }));
  doc.setFillColor(5, 8, 18);
  doc.rect(0, scrimY, pageW, scrimH, "F");
  doc.restoreGraphicsState();

  // ── Text content — left side of scrim ────────────────────────────
  const tx  = margin + 6;               // text x
  const ty  = scrimY + 12;              // text block top

  // Accent rule
  doc.setFillColor(aR, aG, aB);
  doc.rect(tx, ty - 5, 16, 0.7, "F");

  // Eyebrow
  doc.setFont("helvetica", "bold"); doc.setFontSize(5);
  doc.setTextColor(aR, aG, aB);
  doc.text("YOUR NEW HOME", tx, ty);

  // Project name — large
  doc.setFont("helvetica", "bold"); doc.setFontSize(22);
  doc.setTextColor(245, 248, 255);
  const maxNameW = pageW * 0.52;
  const nameLines = doc.splitTextToSize(project.name, maxNameW) as string[];
  doc.text(nameLines, tx, ty + 10);
  let nameEndY = ty + 10 + nameLines.length * 9.5;

  // Community / lot
  if (lotInfo?.communityName || lotInfo?.lotNumber) {
    const sub = [lotInfo.communityName, lotInfo.lotNumber ? `Lot ${lotInfo.lotNumber}` : null].filter(Boolean).join("  ·  ");
    doc.setFont("helvetica", "normal"); doc.setFontSize(6.5);
    doc.setTextColor(aR, aG, aB);
    doc.text(sub, tx, nameEndY + 5);
    nameEndY += 9;
  }

  // Prepared for
  doc.setFont("helvetica", "normal"); doc.setFontSize(6);
  doc.setTextColor(145, 165, 210);
  doc.text(`Prepared for  ${buyer.firstName} ${buyer.lastName}`, tx, nameEndY + 5);

  // ── Price box — right side of scrim ──────────────────────────────
  const pBoxW  = 88;
  const pBoxH  = 42;
  const pBoxX  = pageW - margin - pBoxW;
  const pBoxY2 = scrimY + (scrimH - 10 - pBoxH) / 2 + 4; // centered in scrim above footer

  doc.setFillColor(8, 10, 20);
  doc.roundedRect(pBoxX, pBoxY2, pBoxW, pBoxH, 2, 2, "F");

  doc.setDrawColor(aR, aG, aB); doc.setLineWidth(0.5);
  doc.roundedRect(pBoxX, pBoxY2, pBoxW, pBoxH, 2, 2, "S");

  doc.setFillColor(aR, aG, aB);
  doc.roundedRect(pBoxX, pBoxY2, pBoxW, 2, 1, 1, "F");

  doc.setFont("helvetica", "bold"); doc.setFontSize(5);
  doc.setTextColor(aR, aG, aB);
  doc.text("YOUR ESTIMATE", pBoxX + pBoxW / 2, pBoxY2 + 12, { align: "center" });

  doc.setFont("helvetica", "bold"); doc.setFontSize(20);
  doc.setTextColor(245, 248, 255);
  doc.text(priceStr, pBoxX + pBoxW / 2, pBoxY2 + 30, { align: "center" });

  // ── AI Visualized badge — bottom-left ────────────────────────────
  if (exteriorRender) {
    doc.setFillColor(aR, aG, aB);
    doc.roundedRect(margin, pageH - 15, 28, 6, 1.5, 1.5, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(4.5);
    doc.setTextColor(5, 8, 18);
    doc.text("AI VISUALIZED", margin + 14, pageH - 11, { align: "center" });
  }

  drawPageFooter(1);

  // ══════════════════════════════════════════════════════════════════
  // PAGES 2+ — Interior views, one per page (full bleed)
  // ══════════════════════════════════════════════════════════════════

  let pageNum = 2;
  if (hasInterior1) {
    drawImagePage(interiorRender!, "INTERIOR — VIEW 1", pageNum++);
  }
  if (hasInterior2) {
    drawImagePage(interior2Render!, "INTERIOR — VIEW 2", pageNum++);
  }

  // ══════════════════════════════════════════════════════════════════
  // NEXT PAGE — Exterior Selections
  // ══════════════════════════════════════════════════════════════════

  if (hasExtOpts) {
    doc.addPage();
    drawPageHeader("EXTERIOR SELECTIONS");
    drawOptionsTable(exteriorOptionRows);
    drawPageFooter(pageNum++);
  }

  // ══════════════════════════════════════════════════════════════════
  // NEXT PAGE — Interior Selections
  // ══════════════════════════════════════════════════════════════════

  if (hasIntOpts) {
    doc.addPage();
    drawPageHeader("INTERIOR SELECTIONS");
    drawOptionsTable(interiorOptionRows);
    drawPageFooter(pageNum++);
  }

  // ══════════════════════════════════════════════════════════════════
  // LAST PAGE — Summary & Totals
  // ══════════════════════════════════════════════════════════════════

  doc.addPage();
  drawPageHeader("SUMMARY & TOTALS");

  let y = 24;

  // Buyer + builder info block
  const halfW = (cw - 10) / 2;
  doc.setFont("helvetica", "bold"); doc.setFontSize(6);
  doc.setTextColor(aR, aG, aB);
  doc.text("PREPARED FOR", margin, y);
  y += 5;
  doc.setFont("helvetica", "bold"); doc.setFontSize(9);
  doc.setTextColor(225, 232, 245);
  doc.text(`${buyer.firstName} ${buyer.lastName}`, margin, y);
  y += 5;
  doc.setFont("helvetica", "normal"); doc.setFontSize(7);
  doc.setTextColor(108, 128, 162);
  const buyerContact = [buyer.email, buyer.phone].filter(Boolean).join("  ·  ");
  doc.text(buyerContact, margin, y);
  if (lotInfo?.lotNumber) {
    y += 4.5;
    doc.text(`Lot ${lotInfo.lotNumber}${lotInfo.communityName ? `  ·  ${lotInfo.communityName}` : ""}`, margin, y);
  }

  if (builder) {
    const cx = margin + halfW + 10; let cy = 24;
    doc.setFont("helvetica", "bold"); doc.setFontSize(6);
    doc.setTextColor(aR, aG, aB);
    doc.text("PRESENTED BY", cx, cy); cy += 5;
    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.setTextColor(225, 232, 245);
    doc.text(builder.company_name, cx, cy); cy += 5;
    doc.setFont("helvetica", "normal"); doc.setFontSize(7);
    doc.setTextColor(108, 128, 162);
    const addr = [builder.billing_address, builder.city, builder.state].filter(Boolean).join(", ");
    const contact = [builder.contact_email, builder.phone].filter(Boolean).join("  ·  ");
    if (addr)    { doc.text(addr, cx, cy); cy += 4.5; }
    if (contact) doc.text(contact, cx, cy);
  }

  y += 14;

  // Divider
  doc.saveGraphicsState();
  doc.setGState(new GState({ opacity: 0.12 }));
  doc.setDrawColor(aR, aG, aB); doc.setLineWidth(0.2);
  doc.line(margin, y, pageW - margin, y);
  doc.restoreGraphicsState();
  y += 8;

  // Upgrade summary (counts only)
  const allRows = [...exteriorOptionRows, ...interiorOptionRows];
  const upgradeCount = allRows.filter(r => r.price > 0).length;
  const upgradeTotal = allRows.reduce((s, r) => s + r.price, 0);
  const basePrice    = totalPrice - upgradeTotal;

  doc.setFont("helvetica", "normal"); doc.setFontSize(7);
  doc.setTextColor(108, 128, 162);
  doc.text(`Base price:`, margin, y);
  doc.text(basePrice.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }), col3 - 4, y, { align: "right" });
  y += 5;

  if (upgradeCount > 0) {
    doc.text(`Upgrades (${upgradeCount} selected):`, margin, y);
    doc.setTextColor(aR, aG, aB);
    doc.text(`+${upgradeTotal.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}`, col3 - 4, y, { align: "right" });
    y += 5;
  }

  if (lotInfo?.priceModifier && lotInfo.priceModifier !== 0) {
    doc.setTextColor(108, 128, 162);
    doc.text(`Lot ${lotInfo.lotNumber} premium:`, margin, y);
    doc.setTextColor(aR, aG, aB);
    const lotMod = lotInfo.priceModifier;
    doc.text(`${lotMod > 0 ? "+" : "−"}${Math.abs(lotMod).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}`, col3 - 4, y, { align: "right" });
    y += 5;
  }

  y += 4;

  // Total bar
  doc.setFillColor(16, 20, 34);
  doc.roundedRect(margin, y, cw, 16, 2, 2, "F");
  doc.saveGraphicsState();
  doc.setGState(new GState({ opacity: 0.6 }));
  doc.setDrawColor(aR, aG, aB); doc.setLineWidth(0.4);
  doc.roundedRect(margin, y, cw, 16, 2, 2, "S");
  doc.restoreGraphicsState();
  doc.setFillColor(aR, aG, aB);
  doc.rect(margin, y, 3, 16, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(7);
  doc.setTextColor(155, 170, 210);
  doc.text("TOTAL ESTIMATE", margin + 8, y + 5.5);
  doc.setFont("helvetica", "normal"); doc.setFontSize(6);
  doc.setTextColor(88, 108, 148);
  doc.text("Inclusive of all selected upgrades", margin + 8, y + 11);
  doc.setFont("helvetica", "bold"); doc.setFontSize(16);
  doc.setTextColor(aR, aG, aB);
  doc.text(priceStr, col3 - 4, y + 11, { align: "right" });
  y += 24;

  // What's next note
  doc.setFont("helvetica", "bold"); doc.setFontSize(7.5);
  doc.setTextColor(aR, aG, aB);
  doc.text("What happens next?", margin, y);
  y += 5;
  doc.setFont("helvetica", "normal"); doc.setFontSize(6.5);
  doc.setTextColor(100, 118, 155);
  const nextStepLines = doc.splitTextToSize(
    "Our team will be in touch shortly to discuss bringing your home to life. Final pricing is subject to contract. We look forward to building something extraordinary with you.",
    cw
  ) as string[];
  doc.text(nextStepLines, margin, y);

  drawPageFooter(pageNum);

  return doc;
}
