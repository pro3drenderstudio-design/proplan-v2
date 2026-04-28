"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import CreditTopupBanner from "@/components/builder/CreditTopupBanner";

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
      <div className="px-4 md:px-8 pt-6 md:pt-8 pb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
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
          className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-blue-600/20"
        >
          <span className="text-base leading-none">+</span> New Render
        </button>
      </div>

      {!loading && records.length > 0 && (
        <>
          {/* Stat cards */}
          <div className="px-4 md:px-8 pb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
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
          <div className="px-4 md:px-8 pb-4 flex items-center gap-2 flex-wrap">
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
      <div className="px-4 md:px-8 pb-10">
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
                    {r.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.image_url}
                        alt="Render"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-white/15">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-8 h-8">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                        </svg>
                        <span className="text-[10px]">Image unavailable</span>
                      </div>
                    )}
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

interface CreditInfo {
  builderId:    string;
  remaining:    number;
  total:        number;
  packQty:      number;
  packPrice:    number;
}

export default function RenderStudioPage() {
  const [view,        setView]        = useState<View>("archive");
  const [controlsOpen, setControlsOpen] = useState(false);

  const [records,        setRecords]        = useState<RenderRecord[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(true);

  // AI credit tracking
  const [creditInfo,     setCreditInfo]     = useState<CreditInfo | null>(null);

  const [renderType, setRenderType] = useState<RenderType>("elevation");
  const [style,      setStyle]      = useState<StyleId>("traditional");
  const [lighting,   setLighting]   = useState<LightingId>("golden_hour");
  const [season,     setSeason]     = useState<SeasonId>("summer");
  const [landscape,  setLandscape]  = useState<LandscapeId>("lush");
  const [revision,   setRevision]   = useState("");

  // Elevation optional color fields
  const [elevColors, setElevColors] = useState({
    brickColor: "", roofColor: "", roofType: "", shutterColor: "", doorColor: "",
    garageDoorColor: "", windowTrimColor: "", trimColor: "", sidingColor: "", sidingType: "", porchPostColor: "",
  });
  function setElev(key: keyof typeof elevColors, val: string) {
    setElevColors(prev => ({ ...prev, [key]: val }));
  }

  // Floor plan interior color fields
  const [fpColors, setFpColors] = useState({
    floorType: "", floorColor: "", wallColor: "", interiorDoorColor: "",
    windowFrameColor: "", cabinetColor: "", cabinetStyle: "", countertopMaterial: "",
    countertopColor: "", accentWallColor: "",
  });
  const [showTextLabels, setShowTextLabels] = useState(false);
  function setFp(key: keyof typeof fpColors, val: string) {
    setFpColors(prev => ({ ...prev, [key]: val }));
  }

  const [referenceDataUrl, setReferenceDataUrl] = useState<string | null>(null);
  const [renderDataUrl,    setRenderDataUrl]    = useState<string | null>(null);
  const [renderSavedUrl,   setRenderSavedUrl]   = useState<string | null>(null);
  const [history,          setHistory]          = useState<HistoryEntry[]>([]);
  const [generating,       setGenerating]       = useState(false);
  const [elapsed,          setElapsed]          = useState(0);
  const [error,            setError]            = useState("");

  // Markup mode
  const [isMarkingUp,      setIsMarkingUp]      = useState(false);
  const [markupColor,      setMarkupColor]      = useState("#ef4444");
  const [markupWidth,      setMarkupWidth]      = useState(4);
  const [markupTool,       setMarkupTool]       = useState<"pen" | "eraser">("pen");
  const markupCanvasRef    = useRef<HTMLCanvasElement>(null);
  const markupDrawing      = useRef(false);
  const markupStrokes      = useRef<ImageData[]>([]);

  const fileInputRef   = useRef<HTMLInputElement>(null);
  const dropRef        = useRef<HTMLDivElement>(null);
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const renderImgRef   = useRef<HTMLImageElement | null>(null);

  async function getBuilderIdFromSession(): Promise<string | null> {
    // Impersonation takes priority
    if (typeof window !== "undefined") {
      const imp = window.localStorage.getItem("proplan_impersonate_builder_id");
      if (imp) return imp;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase.from("profiles") as any)
      .select("builder_id").eq("id", user.id).single();
    return profile?.builder_id ?? null;
  }

  // Size markup canvas to match rendered image dimensions
  useEffect(() => {
    if (!isMarkingUp || !renderDataUrl) return;
    const img = new Image();
    img.onload = () => {
      const canvas = markupCanvasRef.current;
      if (!canvas) return;
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      markupStrokes.current = [];
    };
    img.src = renderDataUrl;
  }, [isMarkingUp, renderDataUrl]);

  async function loadArchive() {
    setArchiveLoading(true);
    const builderId = await getBuilderIdFromSession();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase.from("renders") as any).select("*").order("created_at", { ascending: false });
    if (builderId) query = query.eq("builder_id", builderId);
    const { data } = await query;
    setRecords((data as RenderRecord[]) ?? []);
    setArchiveLoading(false);
  }

  async function loadCreditInfo() {
    const builderId = await getBuilderIdFromSession();
    if (!builderId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: builder } = await (supabase.from("builders") as any)
      .select("ai_credits_remaining, ai_credits_total, plan_id")
      .eq("id", builderId).single();
    if (!builder) return;

    let packQty   = 50;
    let packPrice = 7500;
    if (builder.plan_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: plan } = await (supabase.from("plans") as any)
        .select("extra_ai_pack_qty, extra_ai_pack_price")
        .eq("id", builder.plan_id).single();
      if (plan) {
        packQty   = plan.extra_ai_pack_qty   ?? packQty;
        packPrice = plan.extra_ai_pack_price  ?? packPrice;
      }
    }

    setCreditInfo({
      builderId,
      remaining: builder.ai_credits_remaining ?? 0,
      total:     builder.ai_credits_total     ?? 250,
      packQty,
      packPrice,
    });
  }

  useEffect(() => {
    loadArchive();
    loadCreditInfo();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  function getMarkupMergedBase64(): string | null {
    const canvas = markupCanvasRef.current;
    if (!canvas || !renderDataUrl) return null;
    const merged = document.createElement("canvas");
    merged.width  = canvas.width;
    merged.height = canvas.height;
    const ctx = merged.getContext("2d")!;
    const img = new Image();
    img.src = renderDataUrl;
    ctx.drawImage(img, 0, 0, merged.width, merged.height);
    ctx.drawImage(canvas, 0, 0);
    return merged.toDataURL("image/jpeg", 0.92).split(",")[1];
  }

  async function generate(isRevision = false, withMarkup = false) {
    // Guard: check AI credits before generating
    if (creditInfo && creditInfo.remaining <= 0) {
      setError("You've run out of AI render credits. Buy a top-up pack to continue.");
      return;
    }

    setGenerating(true);
    setError("");

    try {
      const builderId = await getBuilderIdFromSession();

      const requestBody: Record<string, unknown> = {
        renderType, style, lighting, season, landscape,
        revision:   isRevision ? revision : undefined,
        isRevision,
        builderId,
        // include elevation colors if set
        ...(renderType === "elevation" ? Object.fromEntries(
          Object.entries(elevColors).filter(([, v]) => v.trim())
        ) : {}),
        // include floor plan colors + label toggle if set
        ...(renderType === "floor_plan" ? {
          ...Object.fromEntries(Object.entries(fpColors).filter(([, v]) => v.trim())),
          showTextLabels,
        } : {}),
      };

      if (isRevision && withMarkup) {
        const merged = getMarkupMergedBase64();
        if (merged) {
          requestBody.imageBase64 = merged;
        } else if (renderSavedUrl) {
          requestBody.imageUrl = renderSavedUrl;
        }
      } else if (isRevision && renderSavedUrl) {
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
      if (withMarkup) { setIsMarkingUp(false); markupStrokes.current = []; }

      setHistory(prev => [{
        id: Date.now().toString(),
        dataUrl,
        label: isRevision
          ? `Edit: ${revision.slice(0, 24)}…`
          : `${STYLES.find(s => s.id === style)?.label} · ${LIGHTINGS.find(l => l.id === lighting)?.label}`,
      }, ...prev].slice(0, 12));

      // Decrement AI credits
      if (builderId && creditInfo) {
        const newRemaining = Math.max(0, creditInfo.remaining - 1);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from("builders") as any)
          .update({ ai_credits_remaining: newRemaining })
          .eq("id", builderId);
        setCreditInfo(prev => prev ? { ...prev, remaining: newRemaining } : prev);
      }

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
      <div className="flex flex-col h-full overflow-hidden">
        {creditInfo && (
          <CreditTopupBanner
            remaining={creditInfo.remaining}
            total={creditInfo.total}
            packQty={creditInfo.packQty}
            packPrice={creditInfo.packPrice}
            builderId={creditInfo.builderId}
            type="ai"
          />
        )}
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
      </div>
    );
  }

  const showExteriorOptions = renderType !== "floor_plan" && renderType !== "interior";

  return (
    <div className="flex h-full relative">

      {/* Mobile backdrop */}
      {controlsOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setControlsOpen(false)} />
      )}

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 bg-[#0a0a0a] border-b border-white/6 flex items-center gap-3 px-4 h-12 flex-shrink-0">
        <button onClick={() => setView("archive")} className="text-white/30 hover:text-white/70 transition-colors">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd"/>
          </svg>
        </button>
        <span className="text-sm font-bold text-white/80 flex-1" style={{ fontFamily: "var(--font-syne), sans-serif" }}>New Render</span>
        <button
          onClick={() => setControlsOpen(v => !v)}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-white/6 border border-white/10 rounded-lg text-xs text-white/50 hover:text-white transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
          </svg>
          Controls
        </button>
      </div>

      {/* ── Left: Controls ── */}
      <aside className={[
        "flex-shrink-0 border-r border-white/6 bg-[#0a0a0a] overflow-y-auto flex flex-col",
        "fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300",
        "md:relative md:translate-x-0 md:z-auto md:inset-auto",
        controlsOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
      ].join(" ")}>
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

              {/* Elevation optional colors */}
              <div>
                <SectionLabel>Exterior Colours <span className="normal-case font-normal text-white/20">(optional)</span></SectionLabel>
                <div className="space-y-2">
                  {[
                    { key: "brickColor",      label: "Brick Color",         ph: "e.g. Red, Tan, Cream" },
                    { key: "sidingColor",     label: "Siding Color",        ph: "e.g. White, Beige" },
                    { key: "sidingType",      label: "Siding Type",         ph: "e.g. Hardie Board, Vinyl" },
                    { key: "roofColor",       label: "Roof Color",          ph: "e.g. Charcoal, Brown" },
                    { key: "roofType",        label: "Roof Type",           ph: "e.g. Asphalt Shingle, Metal" },
                    { key: "trimColor",       label: "Trim Color",          ph: "e.g. White, Black" },
                    { key: "windowTrimColor", label: "Window Trim Color",   ph: "e.g. Black, White" },
                    { key: "doorColor",       label: "Front Door Color",    ph: "e.g. Navy Blue, Red" },
                    { key: "garageDoorColor", label: "Garage Door Color",   ph: "e.g. White, Taupe" },
                    { key: "shutterColor",    label: "Shutter Color",       ph: "e.g. Black, Hunter Green" },
                    { key: "porchPostColor",  label: "Porch Post Color",    ph: "e.g. White, Wood" },
                  ].map(({ key, label, ph }) => (
                    <div key={key}>
                      <label className="block text-[9px] font-semibold uppercase tracking-widest text-white/25 mb-1">{label}</label>
                      <input
                        type="text"
                        value={elevColors[key as keyof typeof elevColors]}
                        onChange={e => setElev(key as keyof typeof elevColors, e.target.value)}
                        placeholder={ph}
                        className="w-full bg-[#141414] border border-white/8 rounded-lg px-3 py-1.5 text-xs text-white/70 placeholder-white/20 focus:outline-none focus:border-blue-500/40 transition-colors"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Floor plan interior colors */}
          {renderType === "floor_plan" && (
            <div className="space-y-3">
              {/* Text labels toggle */}
              <div className="flex items-center justify-between bg-[#141414] border border-white/8 rounded-lg px-3 py-2.5">
                <div>
                  <p className="text-xs font-semibold text-white/70">Show Room Labels</p>
                  <p className="text-[10px] text-white/30 mt-0.5">Include room names, dimensions &amp; annotations</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTextLabels(v => !v)}
                  className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 ${showTextLabels ? "bg-blue-600" : "bg-white/12"}`}
                >
                  <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${showTextLabels ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </div>

              <div>
                <SectionLabel>Interior Finishes <span className="normal-case font-normal text-white/20">(optional)</span></SectionLabel>
                <div className="space-y-2">
                  {[
                    { key: "floorType",         label: "Floor Type",          ph: "e.g. Hardwood, Tile, Vinyl Plank" },
                    { key: "floorColor",        label: "Floor Color",         ph: "e.g. Light Oak, Dark Walnut" },
                    { key: "wallColor",         label: "Wall Color",          ph: "e.g. Soft White, Greige, Navy" },
                    { key: "accentWallColor",   label: "Accent Wall Color",   ph: "e.g. Charcoal, Forest Green" },
                    { key: "interiorDoorColor", label: "Interior Door Color", ph: "e.g. White, Black, Wood" },
                    { key: "windowFrameColor",  label: "Window Frame Color",  ph: "e.g. White, Black, Bronze" },
                    { key: "cabinetStyle",      label: "Cabinet Style",       ph: "e.g. Shaker, Flat Panel, Raised" },
                    { key: "cabinetColor",      label: "Cabinet Color",       ph: "e.g. White, Navy, Natural Wood" },
                    { key: "countertopMaterial",label: "Countertop Material", ph: "e.g. Quartz, Marble, Granite" },
                    { key: "countertopColor",   label: "Countertop Color",    ph: "e.g. White, Calacatta, Black" },
                  ].map(({ key, label, ph }) => (
                    <div key={key}>
                      <label className="block text-[9px] font-semibold uppercase tracking-widest text-white/25 mb-1">{label}</label>
                      <input
                        type="text"
                        value={fpColors[key as keyof typeof fpColors]}
                        onChange={e => setFp(key as keyof typeof fpColors, e.target.value)}
                        placeholder={ph}
                        className="w-full bg-[#141414] border border-white/8 rounded-lg px-3 py-1.5 text-xs text-white/70 placeholder-white/20 focus:outline-none focus:border-blue-500/40 transition-colors"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Credit counter */}
          {creditInfo && (
            <div className={`flex items-center justify-between text-xs mb-2 px-1 ${
              creditInfo.remaining <= 0 ? "text-red-400" : creditInfo.remaining / creditInfo.total <= 0.2 ? "text-amber-400" : "text-white/30"
            }`}>
              <span>AI Credits</span>
              <span className="font-semibold">{creditInfo.remaining} / {creditInfo.total} remaining</span>
            </div>
          )}

          <button
            onClick={() => generate(false)}
            disabled={!referenceDataUrl || generating || (creditInfo ? creditInfo.remaining <= 0 : false)}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
          >
            {generating ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generating…</>
            ) : creditInfo && creditInfo.remaining <= 0 ? "No Credits Left" : "Generate Render"}
          </button>

          {creditInfo && creditInfo.remaining <= 0 && creditInfo.packPrice > 0 && (
            <button
              onClick={async () => {
                const res = await fetch("/api/stripe/credits", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ builderId: creditInfo.builderId, packType: "ai" }),
                });
                const { url } = await res.json();
                if (url) window.location.href = url;
              }}
              className="w-full mt-2 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-colors"
            >
              Buy {creditInfo.packQty} Credits — ${(creditInfo.packPrice / 100).toFixed(0)}
            </button>
          )}

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>
          )}

          {/* Revision panel */}
          {renderDataUrl && (
            <div className="border-t border-white/8 pt-5">
              <div className="flex items-center justify-between mb-1">
                <SectionLabel>Revision / Edit</SectionLabel>
                <button
                  onClick={() => setIsMarkingUp(v => !v)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-colors ${isMarkingUp ? "bg-violet-600/20 border-violet-500/40 text-violet-300" : "bg-white/5 border-white/10 text-white/40 hover:text-white/60"}`}
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  {isMarkingUp ? "Exit Markup" : "Mark Up"}
                </button>
              </div>
              <p className="text-[11px] text-white/30 mb-2">
                {isMarkingUp ? "Draw on the render to show where changes should go, then describe and apply" : "Describe a change to apply to the current render"}
              </p>
              <textarea
                value={revision}
                onChange={e => setRevision(e.target.value)}
                placeholder={isMarkingUp ? '"change the marked area to white stucco"' : '"add a car in the driveway" or "change brick to white stucco"'}
                rows={3}
                className="w-full text-xs text-white/60 bg-[#141414] border border-white/8 rounded-xl px-3 py-2 resize-none focus:outline-none focus:border-blue-500/40 placeholder-white/20 transition-colors"
              />
              <button
                onClick={() => generate(true, isMarkingUp)}
                disabled={!revision.trim() || generating}
                className="w-full mt-2 py-2.5 rounded-xl bg-white/8 hover:bg-white/12 border border-white/10 disabled:opacity-40 text-white/70 text-xs font-semibold transition-colors flex items-center justify-center gap-2"
              >
                {generating ? (
                  <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Applying…</>
                ) : isMarkingUp ? "Apply Markup Edit" : "Apply Edit"}
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── Right: Canvas ── */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#080808] pt-12 md:pt-0">
        <div className="flex-1 flex items-center justify-center p-6 min-h-0">
          {!referenceDataUrl && !renderDataUrl ? (
            <div className="text-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-16 h-16 mx-auto mb-3 text-white/10">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              <p className="text-sm font-semibold text-white/30">Upload a reference image to get started</p>
              <p className="text-xs text-white/20 mt-1">Elevation drawings, floor plans, sketches, or photos</p>
            </div>
          ) : renderDataUrl && referenceDataUrl && !isMarkingUp ? (
            <div className="w-full h-full max-h-[600px]">
              <CompareSlider before={referenceDataUrl} after={renderDataUrl} />
            </div>
          ) : renderDataUrl && (isMarkingUp || !referenceDataUrl) ? (
            <div className="w-full h-full max-h-[600px] flex items-center justify-center relative select-none">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={renderDataUrl}
                alt="Render"
                className="max-w-full max-h-full rounded-xl shadow-2xl object-contain"
                style={{ display: "block" }}
              />
              {isMarkingUp && (
                <>
                  {/* Canvas overlay — sized to the img via onLoad */}
                  <canvas
                    ref={markupCanvasRef}
                    className="absolute inset-0 rounded-xl"
                    style={{ cursor: markupTool === "eraser" ? "cell" : "crosshair", touchAction: "none" }}
                    onMouseDown={e => {
                      const c = markupCanvasRef.current!;
                      const r = c.getBoundingClientRect();
                      const ctx = c.getContext("2d")!;
                      markupDrawing.current = true;
                      markupStrokes.current.push(ctx.getImageData(0, 0, c.width, c.height));
                      ctx.beginPath();
                      ctx.moveTo((e.clientX - r.left) * (c.width / r.width), (e.clientY - r.top) * (c.height / r.height));
                    }}
                    onMouseMove={e => {
                      if (!markupDrawing.current) return;
                      const c = markupCanvasRef.current!;
                      const r = c.getBoundingClientRect();
                      const ctx = c.getContext("2d")!;
                      ctx.globalCompositeOperation = markupTool === "eraser" ? "destination-out" : "source-over";
                      ctx.strokeStyle = markupColor;
                      ctx.lineWidth = markupWidth * (c.width / r.width);
                      ctx.lineCap = "round";
                      ctx.lineJoin = "round";
                      ctx.lineTo((e.clientX - r.left) * (c.width / r.width), (e.clientY - r.top) * (c.height / r.height));
                      ctx.stroke();
                    }}
                    onMouseUp={() => { markupDrawing.current = false; }}
                    onMouseLeave={() => { markupDrawing.current = false; }}
                  />
                  {/* Markup toolbar */}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-2 rounded-2xl"
                    style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.1)" }}>
                    {/* Tool toggle */}
                    <button onClick={() => setMarkupTool("pen")}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${markupTool === "pen" ? "bg-white/20 text-white" : "text-white/40 hover:text-white"}`} title="Pen">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                    <button onClick={() => setMarkupTool("eraser")}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${markupTool === "eraser" ? "bg-white/20 text-white" : "text-white/40 hover:text-white"}`} title="Eraser">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                    <div className="w-px h-5 bg-white/15 mx-1" />
                    {/* Color swatches */}
                    {["#ef4444","#f97316","#facc15","#4ade80","#60a5fa","#a78bfa","#ffffff","#000000"].map(c => (
                      <button key={c} onClick={() => { setMarkupTool("pen"); setMarkupColor(c); }}
                        className={`w-5 h-5 rounded-full border-2 transition-all ${markupColor === c && markupTool === "pen" ? "border-white scale-125" : "border-transparent"}`}
                        style={{ background: c }} />
                    ))}
                    <div className="w-px h-5 bg-white/15 mx-1" />
                    {/* Stroke width */}
                    {[2, 4, 8, 14].map(w => (
                      <button key={w} onClick={() => setMarkupWidth(w)}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${markupWidth === w ? "bg-white/20" : "hover:bg-white/10"}`}>
                        <span className="block rounded-full bg-white" style={{ width: Math.min(w + 6, 18), height: Math.min(w + 6, 18) - 10 + 4 }} />
                      </button>
                    ))}
                    <div className="w-px h-5 bg-white/15 mx-1" />
                    {/* Undo */}
                    <button
                      onClick={() => {
                        const c = markupCanvasRef.current!;
                        const ctx = c.getContext("2d")!;
                        const prev = markupStrokes.current.pop();
                        if (prev) ctx.putImageData(prev, 0, 0);
                        else ctx.clearRect(0, 0, c.width, c.height);
                      }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors" title="Undo">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                    </button>
                    {/* Clear */}
                    <button
                      onClick={() => { const c = markupCanvasRef.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); markupStrokes.current = []; }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-white/10 transition-colors" title="Clear all">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                </>
              )}
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
