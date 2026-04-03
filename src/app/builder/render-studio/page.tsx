"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────────────

type View        = "archive" | "studio";
type RenderType  = "elevation" | "floor_plan" | "interior";
type StyleId     = "modern" | "traditional" | "craftsman" | "contemporary" | "mediterranean" | "colonial";
type LightingId  = "golden_hour" | "midday" | "dusk" | "overcast" | "night";
type SeasonId    = "summer" | "spring" | "fall" | "winter";
type LandscapeId = "lush" | "desert" | "minimal" | "tropical";

interface RenderRecord {
  id: string;
  render_type: string;
  style: string;
  lighting: string;
  season: string | null;
  landscape: string | null;
  image_url: string;
  is_revision: boolean;
  created_at: string;
}

interface HistoryEntry {
  id: string;
  dataUrl: string;
  label: string;
}

// ── Options ───────────────────────────────────────────────────────────────────

const RENDER_TYPES: { id: RenderType; label: string; desc: string }[] = [
  { id: "elevation",  label: "Exterior Elevation", desc: "Facade / street view render" },
  { id: "floor_plan", label: "Floor Plan",          desc: "Furnished top-down view"     },
  { id: "interior",   label: "Interior",            desc: "Inside room visualization"   },
];

const STYLES: { id: StyleId; label: string }[] = [
  { id: "modern",        label: "Modern"        },
  { id: "traditional",   label: "Traditional"   },
  { id: "craftsman",     label: "Craftsman"     },
  { id: "contemporary",  label: "Contemporary"  },
  { id: "mediterranean", label: "Mediterranean" },
  { id: "colonial",      label: "Colonial"      },
];

const LIGHTINGS: { id: LightingId; label: string; icon: string }[] = [
  { id: "golden_hour", label: "Golden Hour", icon: "🌅" },
  { id: "midday",      label: "Midday",      icon: "☀️" },
  { id: "dusk",        label: "Dusk",        icon: "🌆" },
  { id: "overcast",    label: "Overcast",    icon: "☁️" },
  { id: "night",       label: "Night",       icon: "🌙" },
];

const SEASONS: { id: SeasonId; label: string }[] = [
  { id: "summer", label: "Summer" },
  { id: "spring", label: "Spring" },
  { id: "fall",   label: "Fall"   },
  { id: "winter", label: "Winter" },
];

const LANDSCAPES: { id: LandscapeId; label: string }[] = [
  { id: "lush",     label: "Lush / Garden" },
  { id: "minimal",  label: "Minimal"       },
  { id: "tropical", label: "Tropical"      },
  { id: "desert",   label: "Desert / Xeri" },
];

const RENDER_TYPE_LABEL: Record<string, string> = {
  elevation:  "Exterior Elevation",
  floor_plan: "Floor Plan",
  interior:   "Interior",
};

const STYLE_LABEL: Record<string, string> = {
  modern: "Modern", traditional: "Traditional", craftsman: "Craftsman",
  contemporary: "Contemporary", mediterranean: "Mediterranean", colonial: "Colonial",
};

const LIGHTING_LABEL: Record<string, string> = {
  golden_hour: "Golden Hour", midday: "Midday", dusk: "Dusk",
  overcast: "Overcast", night: "Night",
};

// ── Small UI helpers ──────────────────────────────────────────────────────────

function PillButton<T extends string>({
  value, current, onClick, children,
}: { value: T; current: T; onClick: (v: T) => void; children: React.ReactNode }) {
  const active = value === current;
  return (
    <button
      onClick={() => onClick(value)}
      className={[
        "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
        active
          ? "bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-600/30"
          : "bg-white/4 border-white/8 text-white/40 hover:border-white/20 hover:text-white/70",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-2">{children}</p>;
}

// ── Comparison slider ─────────────────────────────────────────────────────────

function CompareSlider({ before, after }: { before: string; after: string }) {
  const [pos, setPos] = useState(50);
  const containerRef  = useRef<HTMLDivElement>(null);
  const dragging      = useRef(false);

  function applyMove(clientX: number) {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setPos(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)));
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full select-none cursor-ew-resize overflow-hidden rounded-xl"
      onMouseDown={e => { dragging.current = true; applyMove(e.clientX); }}
      onMouseMove={e => { if (dragging.current) applyMove(e.clientX); }}
      onMouseUp={() => { dragging.current = false; }}
      onMouseLeave={() => { dragging.current = false; }}
      onTouchStart={e => { dragging.current = true; applyMove(e.touches[0].clientX); }}
      onTouchMove={e => { if (dragging.current) applyMove(e.touches[0].clientX); }}
      onTouchEnd={() => { dragging.current = false; }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={after}  alt="AI render"   className="absolute inset-0 w-full h-full object-contain bg-[#080808]" />
      <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={before} alt="Reference" className="absolute inset-0 w-full h-full object-contain bg-[#141414]" />
      </div>
      <div className="absolute top-0 bottom-0 w-px bg-white/60 shadow-[0_0_8px_rgba(255,255,255,0.3)]" style={{ left: `${pos}%` }} />
      <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-[#0e0e0e] border border-white/20 shadow-xl flex items-center justify-center z-10 pointer-events-none" style={{ left: `${pos}%` }}>
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-white/60">
          <path d="M7 4l-3 3 3 3M13 4l3 3-3 3"/>
        </svg>
      </div>
      <span className="absolute top-3 left-3 text-[10px] font-semibold uppercase tracking-wider text-white/70 bg-black/50 px-2 py-1 rounded-md backdrop-blur-sm">Reference</span>
      <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wider text-white bg-blue-600/80 px-2 py-1 rounded-md backdrop-blur-sm">AI Render</span>
    </div>
  );
}

// ── Archive view ──────────────────────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; color: string; dot: string }> = {
  elevation:  { label: "Exterior",   color: "text-blue-400",    dot: "bg-blue-500"    },
  floor_plan: { label: "Floor Plan", color: "text-violet-400",  dot: "bg-violet-500"  },
  interior:   { label: "Interior",   color: "text-emerald-400", dot: "bg-emerald-500" },
};

const LIGHTING_ICON: Record<string, string> = {
  golden_hour: "🌅", midday: "☀️", dusk: "🌆", overcast: "☁️", night: "🌙",
};

function timeAgo(dateStr: string) {
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return "Just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30)  return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function ArchiveView({
  records, loading, onNew, onOpen,
}: {
  records: RenderRecord[];
  loading: boolean;
  onNew: () => void;
  onOpen: (r: RenderRecord) => void;
}) {
  const [filter, setFilter] = useState<string>("all");

  const counts = {
    elevation:  records.filter(r => r.render_type === "elevation").length,
    floor_plan: records.filter(r => r.render_type === "floor_plan").length,
    interior:   records.filter(r => r.render_type === "interior").length,
    revisions:  records.filter(r => r.is_revision).length,
  };

  const styleCounts: Record<string, number> = {};
  records.forEach(r => { styleCounts[r.style] = (styleCounts[r.style] ?? 0) + 1; });
  const topStyle = Object.entries(styleCounts).sort((a, b) => b[1] - a[1])[0]?.[0];

  const filtered = filter === "all" ? records : records.filter(r => r.render_type === filter);

  async function downloadRender(url: string, filename: string) {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">

      {/* Header */}
      <div className="px-8 pt-8 pb-5 flex items-start justify-between">
        <div>
          <h1
            className="text-2xl font-extrabold text-white tracking-tight"
            style={{ fontFamily: "var(--font-syne), sans-serif" }}
          >
            Render Studio
          </h1>
          <p className="text-sm text-white/30 mt-0.5">
            {loading ? "Loading…" : `${records.length} render${records.length !== 1 ? "s" : ""}${topStyle ? ` · Most used: ${STYLE_LABEL[topStyle] ?? topStyle}` : ""}`}
          </p>
        </div>
        <button
          onClick={onNew}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-blue-600/20"
        >
          <span className="text-base leading-none">+</span> New Render
        </button>
      </div>

      {!loading && records.length > 0 && (
        <>
          {/* Stat cards */}
          <div className="px-8 pb-6 grid grid-cols-4 gap-4">
            {[
              { label: "Total Renders",  value: records.length,       accent: "text-white"        },
              { label: "Exteriors",      value: counts.elevation,     accent: "text-blue-400"     },
              { label: "Floor Plans",    value: counts.floor_plan,    accent: "text-violet-400"   },
              { label: "Interiors",      value: counts.interior,      accent: "text-emerald-400"  },
            ].map(s => (
              <div key={s.label} className="bg-[#0e0e0e] rounded-2xl border border-white/8 px-4 py-4 hover:border-white/14 transition-colors">
                <p className="text-[10px] font-semibold text-white/25 uppercase tracking-widest">{s.label}</p>
                <p
                  className={`text-3xl font-extrabold mt-1 ${s.accent}`}
                  style={{ fontFamily: "var(--font-syne), sans-serif" }}
                >
                  {s.value}
                </p>
              </div>
            ))}
          </div>

          {/* Filter tabs */}
          <div className="px-8 pb-4 flex items-center gap-2">
            {[
              { id: "all",        label: `All (${records.length})`         },
              { id: "elevation",  label: `Exterior (${counts.elevation})`  },
              { id: "floor_plan", label: `Floor Plan (${counts.floor_plan})`},
              { id: "interior",   label: `Interior (${counts.interior})`   },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={[
                  "px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all",
                  filter === tab.id
                    ? "bg-white/10 border-white/20 text-white"
                    : "bg-transparent border-white/8 text-white/35 hover:border-white/20 hover:text-white/60",
                ].join(" ")}
              >
                {tab.label}
              </button>
            ))}
            {counts.revisions > 0 && (
              <span className="ml-auto text-[11px] text-white/25">
                {counts.revisions} edited render{counts.revisions !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </>
      )}

      {/* Grid */}
      <div className="px-8 pb-10">
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="rounded-2xl bg-white/4 animate-pulse" style={{ aspectRatio: "16/10" }} />
            ))}
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-center mb-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-8 h-8 text-white/20">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
            </div>
            <p className="text-sm font-bold text-white/40" style={{ fontFamily: "var(--font-syne), sans-serif" }}>No renders yet</p>
            <p className="text-xs text-white/25 mt-1 mb-5">Upload a reference image to generate your first render</p>
            <button onClick={onNew} className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-blue-600/20">
              Create first render
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-white/25">No renders in this category</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(r => {
              const meta = TYPE_META[r.render_type] ?? TYPE_META.elevation;
              return (
                <div
                  key={r.id}
                  onClick={() => onOpen(r)}
                  className="group text-left rounded-2xl overflow-hidden border border-white/8 hover:border-white/18 hover:shadow-2xl hover:shadow-black/40 transition-all bg-[#0e0e0e] cursor-pointer"
                >
                  <div className="relative overflow-hidden bg-[#141414]" style={{ aspectRatio: "16/10" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={r.image_url}
                      alt="Render"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className={`absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-black/50 backdrop-blur-sm ${meta.color}`}>
                      {meta.label}
                    </span>
                    {r.is_revision && (
                      <span className="absolute top-2 right-2 text-[10px] font-semibold uppercase tracking-wider bg-violet-600/80 text-white px-2 py-0.5 rounded-md backdrop-blur-sm">
                        Edit
                      </span>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="bg-[#0e0e0e]/90 text-white/80 text-xs font-semibold px-3 py-1.5 rounded-lg border border-white/10">
                        Open in Studio
                      </span>
                    </div>
                  </div>

                  <div className="px-3 pt-2.5 pb-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-white/70 truncate">
                        {STYLE_LABEL[r.style] ?? r.style}
                      </p>
                      <span className="text-sm flex-shrink-0" title={LIGHTING_LABEL[r.lighting]}>
                        {LIGHTING_ICON[r.lighting] ?? ""}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-[11px] text-white/30 truncate">
                        {LIGHTING_LABEL[r.lighting] ?? r.lighting}
                        {r.season ? ` · ${r.season}` : ""}
                      </p>
                      <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                          <p className="text-[10px] text-white/20">{timeAgo(r.created_at)}</p>
                          <button
                            onClick={e => { e.stopPropagation(); downloadRender(r.image_url, `render-${r.id}.png`); }}
                            title="Download render"
                            className="w-5 h-5 rounded flex items-center justify-center text-white/25 hover:text-blue-400 hover:bg-blue-500/12 transition-colors"
                          >
                            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3">
                              <path d="M7.25 1a.75.75 0 0 1 1.5 0v6.69l2.22-2.22a.75.75 0 1 1 1.06 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 1 1 1.06-1.06L7.25 7.69V1Z"/>
                              <path d="M3.25 11a.75.75 0 0 0 0 1.5h9.5a.75.75 0 0 0 0-1.5h-9.5Z"/>
                            </svg>
                          </button>
                        </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RenderStudioPage() {
  const [view, setView] = useState<View>("archive");

  const [records,        setRecords]        = useState<RenderRecord[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(true);

  const [renderType, setRenderType] = useState<RenderType>("elevation");
  const [style,      setStyle]      = useState<StyleId>("traditional");
  const [lighting,   setLighting]   = useState<LightingId>("golden_hour");
  const [season,     setSeason]     = useState<SeasonId>("summer");
  const [landscape,  setLandscape]  = useState<LandscapeId>("lush");
  const [revision,   setRevision]   = useState("");

  const [referenceDataUrl, setReferenceDataUrl] = useState<string | null>(null);
  const [renderDataUrl,    setRenderDataUrl]    = useState<string | null>(null);
  const [renderSavedUrl,   setRenderSavedUrl]   = useState<string | null>(null);
  const [history,          setHistory]          = useState<HistoryEntry[]>([]);
  const [generating,       setGenerating]       = useState(false);
  const [elapsed,          setElapsed]          = useState(0);
  const [error,            setError]            = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef      = useRef<HTMLDivElement>(null);
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadArchive() {
    setArchiveLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from("renders") as any)
      .select("*")
      .order("created_at", { ascending: false });
    setRecords((data as RenderRecord[]) ?? []);
    setArchiveLoading(false);
  }

  useEffect(() => { loadArchive(); }, []);

  useEffect(() => {
    if (generating) {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [generating]);

  function openRecord(r: RenderRecord) {
    setRenderDataUrl(r.image_url);
    setRenderSavedUrl(r.image_url);
    setReferenceDataUrl(null);
    setRevision("");
    setError("");
    setHistory([]);
    setView("studio");
  }

  function loadFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = e => {
      setReferenceDataUrl(e.target?.result as string);
      setRenderDataUrl(null);
      setRevision("");
      setError("");
    };
    reader.readAsDataURL(file);
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  }, []);

  async function generate(isRevision = false) {
    setGenerating(true);
    setError("");

    try {
      const requestBody: Record<string, unknown> = {
        renderType, style, lighting, season, landscape,
        revision:   isRevision ? revision : undefined,
        isRevision,
      };

      if (isRevision && renderSavedUrl) {
        requestBody.imageUrl = renderSavedUrl;
      } else {
        const sourceDataUrl = referenceDataUrl;
        if (!sourceDataUrl) return;
        requestBody.imageBase64 = sourceDataUrl.includes(",")
          ? sourceDataUrl.split(",")[1]
          : sourceDataUrl;
      }

      const res = await fetch("/api/render-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`API ${res.status}: ${body}`);
      }

      const { imageBase64, imageUrl } = await res.json() as {
        imageBase64: string;
        imageUrl:    string;
        renderId:    string | null;
      };
      const dataUrl = `data:image/jpeg;base64,${imageBase64}`;
      setRenderDataUrl(dataUrl);
      setRenderSavedUrl(imageUrl ?? null);
      if (isRevision) setRevision("");

      setHistory(prev => [{
        id: Date.now().toString(),
        dataUrl,
        label: isRevision
          ? `Edit: ${revision.slice(0, 24)}…`
          : `${STYLES.find(s => s.id === style)?.label} · ${LIGHTINGS.find(l => l.id === lighting)?.label}`,
      }, ...prev].slice(0, 12));

      loadArchive();
    } catch (err) {
      console.error("Render Studio error:", err);
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  function download(format: "png" | "jpeg") {
    if (!renderDataUrl) return;
    const a    = document.createElement("a");
    a.href     = renderDataUrl;
    a.download = `proplan-render-${Date.now()}.${format}`;
    a.click();
  }

  if (view === "archive") {
    return (
      <ArchiveView
        records={records}
        loading={archiveLoading}
        onNew={() => {
          setReferenceDataUrl(null);
          setRenderDataUrl(null);
          setRenderSavedUrl(null);
          setHistory([]);
          setRevision("");
          setError("");
          setView("studio");
        }}
        onOpen={openRecord}
      />
    );
  }

  const showExteriorOptions = renderType !== "floor_plan" && renderType !== "interior";

  return (
    <div className="flex h-full">

      {/* ── Left: Controls ── */}
      <aside className="w-72 flex-shrink-0 border-r border-white/6 bg-[#0a0a0a] overflow-y-auto flex flex-col">
        <div className="px-5 py-4 border-b border-white/6 flex items-center gap-3">
          <button
            onClick={() => setView("archive")}
            className="text-white/30 hover:text-white/70 transition-colors"
            aria-label="Back to archive"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd"/>
            </svg>
          </button>
          <div>
            <h1
              className="text-sm font-bold text-white/80"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              New Render
            </h1>
            <p className="text-[10px] text-white/25">Upload reference → generate</p>
          </div>
        </div>

        <div className="flex-1 px-5 py-5 space-y-6">

          {/* Upload */}
          <div>
            <SectionLabel>Reference Image</SectionLabel>
            <div
              ref={dropRef}
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className={[
                "relative rounded-xl border-2 border-dashed cursor-pointer transition-colors overflow-hidden",
                referenceDataUrl ? "border-transparent" : "border-white/10 hover:border-blue-500/40 hover:bg-blue-600/5",
              ].join(" ")}
              style={{ minHeight: 120 }}
            >
              {referenceDataUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={referenceDataUrl} alt="Reference" className="w-full object-cover rounded-xl" style={{ maxHeight: 160 }} />
                  <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors rounded-xl flex items-center justify-center">
                    <span className="opacity-0 hover:opacity-100 text-xs text-white font-medium bg-black/60 px-3 py-1.5 rounded-lg">Replace</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-white/25">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-8 h-8 opacity-50">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <p className="text-xs text-center">Drop image here or <span className="text-blue-400">browse</span></p>
                  <p className="text-[10px] text-white/20">Elevation · Floor plan · Sketch · Photo</p>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) loadFile(f); }} />
          </div>

          {/* Render Type */}
          <div>
            <SectionLabel>Render Type</SectionLabel>
            <div className="space-y-1.5">
              {RENDER_TYPES.map(t => (
                <button key={t.id} onClick={() => setRenderType(t.id)}
                  className={["w-full flex items-start gap-3 px-3 py-2.5 rounded-xl border text-left transition-all",
                    renderType === t.id
                      ? "border-blue-500/30 bg-blue-600/10"
                      : "border-white/6 hover:border-white/14 bg-transparent"].join(" ")}>
                  <div className={["w-2 h-2 rounded-full mt-1.5 flex-shrink-0", renderType === t.id ? "bg-blue-400" : "bg-white/15"].join(" ")} />
                  <div>
                    <p className={["text-xs font-semibold", renderType === t.id ? "text-blue-300" : "text-white/50"].join(" ")}>{t.label}</p>
                    <p className="text-[10px] text-white/25 mt-0.5">{t.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Style */}
          <div>
            <SectionLabel>Architectural Style</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {STYLES.map(s => <PillButton key={s.id} value={s.id} current={style} onClick={setStyle}>{s.label}</PillButton>)}
            </div>
          </div>

          {/* Lighting */}
          <div>
            <SectionLabel>Lighting</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {LIGHTINGS.map(l => (
                <PillButton key={l.id} value={l.id} current={lighting} onClick={setLighting}>
                  {l.icon} {l.label}
                </PillButton>
              ))}
            </div>
          </div>

          {showExteriorOptions && (
            <>
              <div>
                <SectionLabel>Season</SectionLabel>
                <div className="flex flex-wrap gap-1.5">
                  {SEASONS.map(s => <PillButton key={s.id} value={s.id} current={season} onClick={setSeason}>{s.label}</PillButton>)}
                </div>
              </div>
              <div>
                <SectionLabel>Landscape Style</SectionLabel>
                <div className="flex flex-wrap gap-1.5">
                  {LANDSCAPES.map(l => <PillButton key={l.id} value={l.id} current={landscape} onClick={setLandscape}>{l.label}</PillButton>)}
                </div>
              </div>
            </>
          )}

          <button
            onClick={() => generate(false)}
            disabled={!referenceDataUrl || generating}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
          >
            {generating ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generating…</>
            ) : "Generate Render"}
          </button>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>
          )}

          {/* Revision panel */}
          {renderDataUrl && (
            <div className="border-t border-white/8 pt-5">
              <SectionLabel>Revision / Edit</SectionLabel>
              <p className="text-[11px] text-white/30 mb-2">Describe a change to apply to the current render</p>
              <textarea
                value={revision}
                onChange={e => setRevision(e.target.value)}
                placeholder='"add a car in the driveway" or "change brick to white stucco"'
                rows={3}
                className="w-full text-xs text-white/60 bg-[#141414] border border-white/8 rounded-xl px-3 py-2 resize-none focus:outline-none focus:border-blue-500/40 placeholder-white/20 transition-colors"
              />
              <button
                onClick={() => generate(true)}
                disabled={!revision.trim() || generating}
                className="w-full mt-2 py-2.5 rounded-xl bg-white/8 hover:bg-white/12 border border-white/10 disabled:opacity-40 text-white/70 text-xs font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {generating ? (
                  <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Applying…</>
                ) : "Apply Edit"}
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Right: Canvas ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#080808]">
        <div className="flex-1 flex items-center justify-center p-6 min-h-0">
          {!referenceDataUrl && !renderDataUrl ? (
            <div className="text-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-16 h-16 mx-auto mb-3 text-white/10">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              <p className="text-sm font-semibold text-white/30">Upload a reference image to get started</p>
              <p className="text-xs text-white/20 mt-1">Elevation drawings, floor plans, sketches, or photos</p>
            </div>
          ) : renderDataUrl && referenceDataUrl ? (
            <div className="w-full h-full max-h-[600px]">
              <CompareSlider before={referenceDataUrl} after={renderDataUrl} />
            </div>
          ) : renderDataUrl && !referenceDataUrl ? (
            <div className="w-full h-full max-h-[600px] flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={renderDataUrl} alt="Render" className="max-w-full max-h-full rounded-xl shadow-2xl object-contain" />
            </div>
          ) : (
            <div className="w-full max-w-2xl">
              {generating ? (
                <div className="flex flex-col items-center gap-4 py-24">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-6 h-6 rounded-full border-2 border-violet-400/30 border-t-violet-400 animate-spin" style={{ animationDirection: "reverse" }} />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-white/60" style={{ fontFamily: "var(--font-syne), sans-serif" }}>Generating your render…</p>
                    <p className="text-xs text-white/30 mt-1">
                      {elapsed < 15 && "This usually takes 20–50 seconds"}
                      {elapsed >= 15 && elapsed < 35 && "Still working — model is processing…"}
                      {elapsed >= 35 && elapsed < 60 && "Almost there…"}
                      {elapsed >= 60 && "Taking longer than usual, please wait…"}
                    </p>
                    <p className="text-xs text-white/20 mt-1">{elapsed}s</p>
                  </div>
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={referenceDataUrl!} alt="Reference" className="w-full rounded-xl opacity-30" />
              )}
            </div>
          )}
        </div>

        {/* Toolbar */}
        {renderDataUrl && (
          <div className="border-t border-white/6 bg-[#0a0a0a] px-6 py-3 flex items-center justify-between gap-4 flex-shrink-0">
            <p className="text-xs text-white/25">{referenceDataUrl ? "Drag the slider to compare" : "Opened from archive"}</p>
            <div className="flex items-center gap-2">
              {["png", "jpeg"].map(fmt => (
                <button key={fmt} onClick={() => download(fmt as "png" | "jpeg")}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/5 text-xs font-semibold text-white/50 hover:text-white/80 transition-all uppercase">
                  {fmt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* History strip */}
        {history.length > 0 && (
          <div className="border-t border-white/6 bg-[#0a0a0a] px-6 py-3 flex-shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-2">Session History</p>
            <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-hide">
              {history.map(entry => (
                <button key={entry.id} onClick={() => setRenderDataUrl(entry.dataUrl)} title={entry.label}
                  className="flex-shrink-0 group relative rounded-xl overflow-hidden border-2 border-transparent hover:border-blue-500/50 transition-colors">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={entry.dataUrl} alt={entry.label} className="w-20 h-14 object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
