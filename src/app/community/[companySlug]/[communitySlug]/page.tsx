"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Community, Lot, MapSettings } from "@/types/database";

interface Builder {
  company_name: string;
  logo_url: string | null;
  contact_email: string | null;
  phone: string | null;
  website_url: string | null;
  city: string | null;
  state: string | null;
}

interface Project {
  id: string;
  name: string;
  slug: string;
  company_slug: string;
  beds: number | null;
  baths: number | null;
  floors: number | null;
  sqft: number | null;
  base_price: number;
  thumbnail_url: string | null;
  home_type: string | null;
  description: string | null;
}

interface LotWithProject extends Lot {
  project?: Project | null;
}

const STATUS: Record<string, { fill: string; stroke: string; glow: string; label: string; dot: string }> = {
  available: { fill: "rgba(34,197,94,0.15)",  stroke: "rgba(34,197,94,0.75)",  glow: "rgba(34,197,94,0.35)",  label: "Available", dot: "#22c55e" },
  reserved:  { fill: "rgba(251,191,36,0.15)", stroke: "rgba(251,191,36,0.75)", glow: "rgba(251,191,36,0.35)", label: "Reserved",  dot: "#fbbf24" },
  sold:      { fill: "rgba(239,68,68,0.15)",  stroke: "rgba(239,68,68,0.7)",   glow: "rgba(239,68,68,0.3)",   label: "Sold",      dot: "#ef4444" },
};

const GLASS = {
  background: "rgba(0,0,0,0.52)",
  backdropFilter: "blur(24px)",
  WebkitBackdropFilter: "blur(24px)",
  border: "1px solid rgba(255,255,255,0.09)",
};

function fmtPrice(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
function centroid(polygon: [number, number][]): [number, number] {
  return [polygon.reduce((s, p) => s + p[0], 0) / polygon.length, polygon.reduce((s, p) => s + p[1], 0) / polygon.length];
}
function toSvgPoints(polygon: [number, number][], w: number, h: number) {
  return polygon.map(([x, y]) => `${(x / 100) * w},${(y / 100) * h}`).join(" ");
}
function BuilderInitials({ name }: { name: string }) {
  const parts = name.trim().split(" ");
  return <>{(parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")}</>;
}

export default function CommunityMapPage({ params }: { params: Promise<{ companySlug: string; communitySlug: string }> }) {
  const [companySlug,   setCompanySlug]   = useState("");
  const [communitySlug, setCommunitySlug] = useState("");
  const [community,     setCommunity]     = useState<Community | null>(null);
  const [builder,       setBuilder]       = useState<Builder | null>(null);
  const [lots,          setLots]          = useState<LotWithProject[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [hoveredLot,    setHoveredLot]    = useState<string | null>(null);
  const [selectedLot,   setSelectedLot]   = useState<LotWithProject | null>(null);
  const [tooltip,       setTooltip]       = useState<{ x: number; y: number } | null>(null);
  const [imgRect,       setImgRect]       = useState({ left: 0, top: 0, w: 0, h: 0 });
  const [mapZoom,       setMapZoom]       = useState(1);
  const [panOffset,     setPanOffset]     = useState({ x: 0, y: 0 });
  const [isDragging,    setIsDragging]    = useState(false);
  const [isMobile,      setIsMobile]      = useState(false);

  const imgRef       = useRef<HTMLImageElement>(null);
  const mapWrapRef   = useRef<HTMLDivElement>(null);
  const mapCanvasRef = useRef<HTMLDivElement>(null);
  const panStart     = useRef({ cx: 0, cy: 0, px: 0, py: 0 });
  const hasDragged   = useRef(false);
  const touchPanRef  = useRef<{ id: number; sx: number; sy: number; px: number; py: number } | null>(null);
  const pinchRef     = useRef<{ dist: number; zoom: number } | null>(null);

  // ── Mobile detection ──────────────────────────────────────────────────────
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Prevent page scroll while touching the map ────────────────────────────
  useEffect(() => {
    const el = mapCanvasRef.current;
    if (!el) return;
    const handler = (e: TouchEvent) => { if (e.touches.length > 0) e.preventDefault(); };
    el.addEventListener("touchmove", handler, { passive: false });
    return () => el.removeEventListener("touchmove", handler);
  }, []);

  // ── Mouse pan ─────────────────────────────────────────────────────────────
  function handleMapWheel(e: React.WheelEvent) {
    e.preventDefault();
    setMapZoom(prev => Math.max(0.5, Math.min(4, prev * (e.deltaY < 0 ? 1.1 : 0.9))));
  }
  function handlePanStart(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest("[data-lot]")) return;
    hasDragged.current = false;
    setIsDragging(true);
    panStart.current = { cx: e.clientX, cy: e.clientY, px: panOffset.x, py: panOffset.y };
  }
  function handlePanMove(e: React.MouseEvent) {
    if (!isDragging) return;
    const dx = e.clientX - panStart.current.cx;
    const dy = e.clientY - panStart.current.cy;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasDragged.current = true;
    setPanOffset({ x: panStart.current.px + dx, y: panStart.current.py + dy });
  }
  function handlePanEnd() {
    setIsDragging(false);
    setTimeout(() => { hasDragged.current = false; }, 0);
  }

  // ── Touch pan / pinch zoom ────────────────────────────────────────────────
  function getTouchDist(touches: React.TouchList) {
    return Math.hypot(touches[1].clientX - touches[0].clientX, touches[1].clientY - touches[0].clientY);
  }
  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 1) {
      if ((e.target as HTMLElement).closest("[data-lot]")) return;
      const t = e.touches[0];
      touchPanRef.current = { id: t.identifier, sx: t.clientX, sy: t.clientY, px: panOffset.x, py: panOffset.y };
      hasDragged.current = false;
    } else if (e.touches.length === 2) {
      pinchRef.current = { dist: getTouchDist(e.touches), zoom: mapZoom };
      touchPanRef.current = null;
    }
  }
  function handleTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 1 && touchPanRef.current) {
      const t = e.touches[0];
      const dx = t.clientX - touchPanRef.current.sx;
      const dy = t.clientY - touchPanRef.current.sy;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) hasDragged.current = true;
      setPanOffset({ x: touchPanRef.current.px + dx, y: touchPanRef.current.py + dy });
    } else if (e.touches.length === 2 && pinchRef.current) {
      const scale = getTouchDist(e.touches) / pinchRef.current.dist;
      setMapZoom(Math.max(0.5, Math.min(4, pinchRef.current.zoom * scale)));
    }
  }
  function handleTouchEnd() {
    touchPanRef.current = null;
    pinchRef.current = null;
    setTimeout(() => { hasDragged.current = false; }, 0);
  }

  // ── Data loading ──────────────────────────────────────────────────────────
  useEffect(() => {
    params.then(p => { setCompanySlug(p.companySlug); setCommunitySlug(p.communitySlug); });
  }, [params]);

  useEffect(() => {
    if (!companySlug || !communitySlug) return;
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: comm } = await (supabase.from("communities") as any)
        .select("*").eq("company_slug", companySlug).eq("slug", communitySlug).single();
      if (!comm) { setLoading(false); return; }
      setCommunity(comm as Community);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: bld } = await (supabase.from("builders") as any)
        .select("company_name,logo_url,contact_email,phone,website_url,city,state")
        .eq("company_slug", companySlug).single();
      if (bld) setBuilder(bld as Builder);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: lotData } = await (supabase.from("lots") as any)
        .select("*").eq("community_id", comm.id);
      const rawLots = (lotData ?? []) as Lot[];

      const projectIds = [...new Set(rawLots.filter(l => l.project_id).map(l => l.project_id!))];
      const projectMap: Record<string, Project> = {};
      if (projectIds.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: projs } = await (supabase.from("projects") as any)
          .select("id,name,slug,company_slug,beds,baths,floors,sqft,base_price,thumbnail_url,home_type,description")
          .in("id", projectIds);
        if (projs) for (const p of projs as Project[]) projectMap[p.id] = p;
      }

      setLots(rawLots.map(l => ({ ...l, project: l.project_id ? (projectMap[l.project_id] ?? null) : null })));
      setLoading(false);
    })();
  }, [companySlug, communitySlug]);

  function measureImgRect() {
    const el = imgRef.current;
    if (!el || !el.naturalWidth || !el.naturalHeight) return;
    const { clientWidth: elW, clientHeight: elH, naturalWidth: natW, naturalHeight: natH } = el;
    const scale = Math.min(elW / natW, elH / natH);
    const rendW = natW * scale;
    const rendH = natH * scale;
    setImgRect({ left: (elW - rendW) / 2, top: (elH - rendH) / 2, w: rendW, h: rendH });
  }

  useEffect(() => {
    window.addEventListener("resize", measureImgRect);
    return () => window.removeEventListener("resize", measureImgRect);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [community]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#080808]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 rounded-full border-2 border-white/10 border-t-white/60 animate-spin" />
          <p className="text-xs text-white/25 tracking-wider">Loading community map…</p>
        </div>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#080808] text-white/30 text-sm">
        Community not found.
      </div>
    );
  }

  const stats = {
    available: lots.filter(l => l.status === "available").length,
    reserved:  lots.filter(l => l.status === "reserved").length,
    sold:      lots.filter(l => l.status === "sold").length,
    total:     lots.length,
  };

  // ── Map settings ──────────────────────────────────────────────────────────
  const comm               = community!;
  const ms: MapSettings    = comm.map_settings ?? {};
  const showLabels         = ms.show_labels !== false;
  const defaultLabelColor  = ms.default_label_color ?? "rgba(255,255,255,0.9)";
  const defaultLabelSize   = ms.default_label_size ?? null;
  const defaultStrokeWidth = ms.stroke_width ?? 1.5;

  // ── Lot detail content (shared between side panel and bottom sheet) ────────
  function LotDetailContent({ lot }: { lot: LotWithProject }) {
    const s = STATUS[lot.status] ?? STATUS.available;
    const proj = lot.project;
    const totalPrice = proj ? proj.base_price + (lot.price_modifier ?? 0) : null;

    return (
      <>
        {/* Thumbnail / header */}
        <div className="relative flex-shrink-0">
          {proj?.thumbnail_url ? (
            <div className="relative overflow-hidden" style={{ height: isMobile ? 180 : 208 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={proj.thumbnail_url} alt={proj.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.7) 100%)" }} />
              <div className="absolute bottom-0 left-0 right-0 px-5 pb-4">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Lot</p>
                    <p className="text-2xl font-bold text-white leading-tight">{lot.lot_number}</p>
                  </div>
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
                    style={{ background: "rgba(0,0,0,0.6)", border: `1px solid ${s.stroke}`, color: s.dot }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
                    {s.label}
                  </span>
                </div>
              </div>
              <button onClick={() => setSelectedLot(null)}
                className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full text-white/60 hover:text-white transition-colors"
                style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">Lot</p>
                <p className="text-xl font-bold text-white">{lot.lot_number}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
                  style={{ background: s.fill, border: `1px solid ${s.stroke}`, color: s.dot }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
                  {s.label}
                </span>
                <button onClick={() => setSelectedLot(null)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/8 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {proj ? (
            <div className="px-5 py-4 space-y-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1">Home Model</p>
                <h2 className="text-lg font-bold text-white leading-tight">{proj.name}</h2>
                {proj.home_type && <p className="text-xs text-white/35 mt-0.5 capitalize">{proj.home_type.replace("_", " ")}</p>}
                {proj.description && <p className="text-xs text-white/40 mt-2 leading-relaxed">{proj.description}</p>}
              </div>

              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Bed",   value: proj.beds   ?? "—" },
                  { label: "Bath",  value: proj.baths  ?? "—" },
                  { label: "Floor", value: proj.floors ?? "—" },
                  { label: "Sqft",  value: proj.sqft ? (proj.sqft >= 1000 ? `${(proj.sqft/1000).toFixed(1)}k` : proj.sqft) : "—" },
                ].map(spec => (
                  <div key={spec.label} className="flex flex-col items-center py-2.5 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-base font-bold text-white">{spec.value}</p>
                    <p className="text-[9px] uppercase tracking-wider text-white/30 mt-0.5">{spec.label}</p>
                  </div>
                ))}
              </div>

              {totalPrice !== null && (
                <div className="rounded-xl px-4 py-3.5"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1">Starting Price</p>
                  <p className="text-3xl font-bold text-white">{fmtPrice(totalPrice)}</p>
                  {(lot.price_modifier ?? 0) !== 0 && (
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="text-[11px] text-white/30">{fmtPrice(proj.base_price)} base</span>
                      <span className="text-[11px] text-white/20">·</span>
                      <span className="text-[11px]" style={{ color: (lot.price_modifier ?? 0) > 0 ? "#fbbf24" : "#34d399" }}>
                        {(lot.price_modifier ?? 0) > 0 ? "+" : "−"}{fmtPrice(Math.abs(lot.price_modifier ?? 0))} lot
                      </span>
                    </div>
                  )}
                </div>
              )}

              {lot.notes && (
                <div className="rounded-xl px-4 py-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-1.5">Lot Notes</p>
                  <p className="text-xs text-white/45 leading-relaxed">{lot.notes}</p>
                </div>
              )}

              {lot.status === "available" && (
                <Link
                  href={`/project/${proj.company_slug}/${proj.slug}?lotId=${encodeURIComponent(lot.id)}&lotNumber=${encodeURIComponent(lot.lot_number)}&communitySlug=${encodeURIComponent(comm.slug)}&communityName=${encodeURIComponent(comm.name)}&lotPriceModifier=${lot.price_modifier ?? 0}`}
                  target="_top"
                  className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-sm font-bold text-white transition-all hover:brightness-110"
                  style={{ background: "rgba(37,99,235,0.85)", border: "1px solid rgba(59,130,246,0.4)", boxShadow: "0 4px 20px rgba(37,99,235,0.3)" }}
                >
                  Configure this home
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
              )}
              {lot.status === "reserved" && (
                <div className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold text-amber-400/70"
                  style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)" }}>
                  This lot is currently reserved
                </div>
              )}
              {lot.status === "sold" && (
                <div className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold text-white/25"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  This lot has been sold
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-5 text-center">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <svg className="w-6 h-6 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-white/40">No model assigned</p>
              <p className="text-xs text-white/20 mt-1 leading-relaxed">Contact us to learn more about this lot.</p>
            </div>
          )}
        </div>

        {/* Builder contact footer */}
        {builder && (builder.contact_email || builder.phone || builder.website_url) && (
          <div className="flex-shrink-0 px-5 py-4 border-t border-white/8">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-3">Contact {builder.company_name}</p>
            <div className="space-y-2">
              {builder.contact_email && (
                <a href={`mailto:${builder.contact_email}`} className="flex items-center gap-2.5 text-xs text-white/40 hover:text-white/70 transition-colors group">
                  <svg className="w-3.5 h-3.5 text-white/20 group-hover:text-white/40 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                  {builder.contact_email}
                </a>
              )}
              {builder.phone && (
                <a href={`tel:${builder.phone}`} className="flex items-center gap-2.5 text-xs text-white/40 hover:text-white/70 transition-colors group">
                  <svg className="w-3.5 h-3.5 text-white/20 group-hover:text-white/40 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                  </svg>
                  {builder.phone}
                </a>
              )}
              {builder.website_url && (
                <a href={builder.website_url} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 text-xs text-white/40 hover:text-white/70 transition-colors group">
                  <svg className="w-3.5 h-3.5 text-white/20 group-hover:text-white/40 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253" />
                  </svg>
                  {builder.website_url.replace(/^https?:\/\//, "")}
                </a>
              )}
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="relative h-screen bg-[#080808] overflow-hidden">

      {/* ── Map canvas ────────────────────────────────────────────────────────── */}
      <div
        ref={mapCanvasRef}
        className="absolute inset-0 overflow-hidden"
        onWheel={handleMapWheel}
        onMouseDown={handlePanStart}
        onMouseMove={handlePanMove}
        onMouseUp={handlePanEnd}
        onMouseLeave={handlePanEnd}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
      >
        {community.site_map_url ? (
          <div
            ref={mapWrapRef}
            className="relative w-full h-full"
            style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${mapZoom})`, transformOrigin: "center center", transition: isDragging ? "none" : "transform 0.1s ease" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={community.site_map_url}
              alt={community.name}
              className="w-full h-full object-contain"
              onLoad={measureImgRect}
            />

            {imgRect.w > 0 && imgRect.h > 0 && (
              <svg
                style={{ position: "absolute", left: imgRect.left, top: imgRect.top, width: imgRect.w, height: imgRect.h, overflow: "visible" }}
                viewBox={`0 0 ${imgRect.w} ${imgRect.h}`}
              >
                <defs>
                  {lots.map(lot => (
                    <filter key={`glow-${lot.id}`} id={`glow-${lot.id}`} x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="4" result="blur" />
                      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                  ))}
                  <filter id="label-shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="rgba(0,0,0,0.9)" />
                  </filter>
                </defs>

                {lots.map(lot => {
                  if (!lot.polygon || lot.polygon.length < 3) return null;
                  const s     = STATUS[lot.status] ?? STATUS.available;
                  const isHov = hoveredLot === lot.id;
                  const isSel = selectedLot?.id === lot.id;
                  const [cx, cy] = centroid(lot.polygon);
                  const svgCx = lot.label_x != null ? (lot.label_x / 100) * imgRect.w : (cx / 100) * imgRect.w;
                  const svgCy = lot.label_y != null ? (lot.label_y / 100) * imgRect.h : (cy / 100) * imgRect.h;
                  const pts   = toSvgPoints(lot.polygon, imgRect.w, imgRect.h);
                  const fs    = lot.label_font_size ?? defaultLabelSize ?? Math.max(9, Math.min(13, imgRect.w / 70));
                  const fc    = lot.text_color ?? defaultLabelColor;

                  return (
                    <g key={lot.id}>
                      {(isHov || isSel) && (
                        <polygon points={pts} fill={s.glow} stroke="none" filter={`url(#glow-${lot.id})`} style={{ pointerEvents: "none" }} />
                      )}
                      <polygon
                        points={pts}
                        fill={isHov || isSel ? s.fill.replace("0.15", "0.28") : s.fill}
                        stroke={s.stroke}
                        strokeWidth={isSel ? 2.5 : isHov ? 2 : defaultStrokeWidth}
                        strokeDasharray={isSel ? "5 3" : undefined}
                        className="cursor-pointer"
                        style={{ transition: "fill 0.15s, stroke-width 0.15s" }}
                        data-lot="true"
                        onMouseEnter={e => { if (!hasDragged.current && !isMobile) { setHoveredLot(lot.id); setTooltip({ x: e.clientX, y: e.clientY }); } }}
                        onMouseMove={e => { if (!isMobile) setTooltip({ x: e.clientX, y: e.clientY }); }}
                        onMouseLeave={() => { setHoveredLot(null); setTooltip(null); }}
                        onClick={() => { if (!hasDragged.current) setSelectedLot(prev => prev?.id === lot.id ? null : lot); }}
                      />
                      {showLabels && (
                        <text
                          x={svgCx} y={svgCy}
                          textAnchor="middle" dominantBaseline="middle"
                          fontSize={fs} fontWeight="700"
                          fill={fc}
                          style={{ pointerEvents: "none", userSelect: "none" }}
                          filter="url(#label-shadow)"
                        >
                          {lot.lot_number}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-white/15 text-sm">
            No site map uploaded yet.
          </div>
        )}
      </div>

      {/* Edge vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)" }} />

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-start justify-between px-3 sm:px-5 pt-3 sm:pt-5 gap-2 sm:gap-4">

        {/* Builder identity */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0" style={{ ...GLASS, borderRadius: 14, padding: "8px 12px" }}>
          {builder?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={builder.logo_url} alt={builder.company_name} className="h-6 sm:h-7 object-contain max-w-[80px] sm:max-w-[100px]" />
          ) : (
            <div className="w-7 h-7 rounded-lg bg-blue-600/30 border border-blue-500/30 flex items-center justify-center text-[11px] font-bold text-blue-400">
              <BuilderInitials name={builder?.company_name ?? companySlug} />
            </div>
          )}
          <div className="border-l border-white/10 pl-2 sm:pl-3">
            <p className="text-[9px] sm:text-[10px] text-white/35 leading-none">Developed by</p>
            <p className="text-[11px] sm:text-xs font-semibold text-white/80 mt-0.5 leading-none">{builder?.company_name ?? companySlug}</p>
            {(builder?.city || builder?.state) && (
              <p className="hidden sm:block text-[10px] text-white/25 mt-0.5 leading-none">{[builder.city, builder.state].filter(Boolean).join(", ")}</p>
            )}
          </div>
        </div>

        {/* Availability stats — hidden on mobile */}
        <div className="hidden sm:flex items-center gap-2">
          {([ { key: "available", label: "Available" }, { key: "reserved", label: "Reserved" }, { key: "sold", label: "Sold" } ] as const).map(({ key, label }) => {
            const s = STATUS[key];
            return (
              <div key={key} className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ ...GLASS, borderRadius: 12 }}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: s.dot }} />
                <span className="text-xs text-white/40">{label}</span>
                <span className="text-xs font-bold text-white/80">{stats[key]}</span>
              </div>
            );
          })}
        </div>

        {/* Mobile: compact stats pill */}
        <div className="flex sm:hidden items-center gap-1.5" style={{ ...GLASS, borderRadius: 12, padding: "6px 10px" }}>
          {([ { key: "available" as const, dot: "#22c55e" }, { key: "reserved" as const, dot: "#fbbf24" }, { key: "sold" as const, dot: "#ef4444" } ]).map(({ key, dot }) => (
            <div key={key} className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot }} />
              <span className="text-[11px] font-bold text-white/70">{stats[key]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Zoom controls — desktop only ────────────────────────────────────── */}
      <div className="hidden sm:flex absolute bottom-5 right-5 z-20 flex-col gap-1" style={{ ...GLASS, borderRadius: 12, padding: "6px" }}>
        <button onClick={() => setMapZoom(v => Math.min(4, v + 0.15))}
          className="w-8 h-8 flex items-center justify-center text-white/50 hover:text-white transition-colors text-lg leading-none rounded-lg hover:bg-white/8">+</button>
        <div className="text-center">
          <span className="text-[9px] text-white/25 tabular-nums block">{Math.round(mapZoom * 100)}%</span>
        </div>
        <button onClick={() => setMapZoom(v => Math.max(0.5, v - 0.15))}
          className="w-8 h-8 flex items-center justify-center text-white/50 hover:text-white transition-colors text-lg leading-none rounded-lg hover:bg-white/8">−</button>
        {(mapZoom !== 1 || panOffset.x !== 0 || panOffset.y !== 0) && (
          <button onClick={() => { setMapZoom(1); setPanOffset({ x: 0, y: 0 }); }}
            className="w-8 h-8 flex items-center justify-center text-white/30 hover:text-white/60 transition-colors rounded-lg hover:bg-white/8">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Community info card — desktop bottom-left ───────────────────────── */}
      {!selectedLot && (
        <div
          className="hidden sm:block absolute bottom-5 left-5 z-20 max-w-xs"
          style={{ ...GLASS, borderRadius: 16, padding: "16px 18px" }}
        >
          <h1 className="text-base font-bold text-white leading-tight">{community.name}</h1>
          {community.description && (
            <p className="text-xs text-white/45 mt-1.5 leading-relaxed">{community.description}</p>
          )}
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/8">
            <div className="text-center">
              <p className="text-lg font-bold text-white">{stats.total}</p>
              <p className="text-[10px] text-white/30">Total Lots</p>
            </div>
            <div className="w-px h-8 bg-white/8" />
            <div className="text-center">
              <p className="text-lg font-bold text-green-400">{stats.available}</p>
              <p className="text-[10px] text-white/30">Available</p>
            </div>
            {stats.reserved > 0 && (
              <>
                <div className="w-px h-8 bg-white/8" />
                <div className="text-center">
                  <p className="text-lg font-bold text-amber-400">{stats.reserved}</p>
                  <p className="text-[10px] text-white/30">Reserved</p>
                </div>
              </>
            )}
          </div>
          {lots.length > 0 && (
            <p className="text-[10px] text-white/20 mt-3 text-center">Click a lot on the map to explore</p>
          )}
        </div>
      )}

      {/* ── Community info bar — mobile bottom ─────────────────────────────── */}
      {!selectedLot && (
        <div
          className="sm:hidden absolute bottom-0 left-0 right-0 z-20"
          style={{ ...GLASS, borderTop: "1px solid rgba(255,255,255,0.09)", padding: "14px 16px 20px" }}
        >
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-sm font-bold text-white leading-tight">{community.name}</h1>
            <div className="flex items-center gap-3">
              <div className="text-center">
                <span className="text-sm font-bold text-green-400">{stats.available}</span>
                <span className="text-[10px] text-white/30 ml-1">avail</span>
              </div>
              {stats.reserved > 0 && (
                <div className="text-center">
                  <span className="text-sm font-bold text-amber-400">{stats.reserved}</span>
                  <span className="text-[10px] text-white/30 ml-1">res</span>
                </div>
              )}
              <div className="text-center">
                <span className="text-sm font-bold text-white/50">{stats.total}</span>
                <span className="text-[10px] text-white/30 ml-1">total</span>
              </div>
            </div>
          </div>
          {lots.length > 0 && (
            <p className="text-[10px] text-white/25">Tap a lot on the map to explore</p>
          )}
        </div>
      )}

      {/* ── Hover tooltip — desktop only ────────────────────────────────────── */}
      {!isMobile && tooltip && hoveredLot && !selectedLot && (() => {
        const lot = lots.find(l => l.id === hoveredLot);
        if (!lot) return null;
        const s    = STATUS[lot.status] ?? STATUS.available;
        const proj = lot.project;
        const totalPrice = proj ? proj.base_price + (lot.price_modifier ?? 0) : null;
        const hasPremium = (lot.price_modifier ?? 0) !== 0;
        const cardW = 252, margin = 14;
        const flipX = tooltip.x + margin + cardW > window.innerWidth - 12;
        const left  = flipX ? tooltip.x - cardW - margin : tooltip.x + margin;
        const top   = Math.min(tooltip.y - 12, window.innerHeight - 340);

        return (
          <div className="fixed z-50 pointer-events-none"
            style={{ left, top: Math.max(8, top), width: cardW, background: "rgba(6,6,10,0.94)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)", border: `1px solid ${s.stroke}`, borderRadius: 14, boxShadow: `0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)`, overflow: "hidden", animation: "hoverCardIn 0.14s ease-out" }}
          >
            <style>{`@keyframes hoverCardIn { from { opacity:0; transform:translateY(4px) scale(0.97); } to { opacity:1; transform:none; } }`}</style>
            <div style={{ height: 2, background: s.dot, opacity: 0.8 }} />
            {proj?.thumbnail_url && (
              <div className="relative overflow-hidden" style={{ height: 118 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={proj.thumbnail_url} alt={proj.name} className="w-full h-full object-cover" />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0) 30%, rgba(6,6,10,0.85) 100%)" }} />
                {totalPrice !== null && (
                  <div className="absolute bottom-2.5 right-3">
                    <span className="text-sm font-bold text-white" style={{ textShadow: "0 1px 6px rgba(0,0,0,0.8)" }}>{fmtPrice(totalPrice)}</span>
                  </div>
                )}
              </div>
            )}
            <div className="px-3.5 pt-3 pb-3.5 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>Lot</p>
                  <p className="text-base font-bold text-white leading-none">{lot.lot_number}</p>
                </div>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 mt-0.5"
                  style={{ background: `${s.dot}18`, border: `1px solid ${s.dot}55`, color: s.dot }}>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.dot }} />
                  {s.label}
                </span>
              </div>
              {proj && (
                <>
                  <div>
                    <p className="text-xs font-semibold text-white/80 leading-tight">{proj.name}</p>
                    {proj.home_type && <p className="text-[10px] text-white/35 mt-0.5 capitalize">{proj.home_type.replace("_", " ")}</p>}
                  </div>
                  {(proj.beds || proj.baths || proj.sqft || proj.floors) && (
                    <div className="grid grid-cols-4 gap-1.5">
                      {[{ v: proj.beds, l: "Bed" }, { v: proj.baths, l: "Bath" }, { v: proj.sqft ? `${proj.sqft >= 1000 ? (proj.sqft/1000).toFixed(1)+"k" : proj.sqft}` : null, l: "Sqft" }, { v: proj.floors, l: "Floor" }].map(({ v, l }) => v != null && (
                        <div key={l} className="flex flex-col items-center py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
                          <p className="text-xs font-bold text-white leading-none">{v}</p>
                          <p className="text-[8px] uppercase tracking-wider text-white/30 mt-0.5">{l}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {totalPrice !== null && !proj.thumbnail_url && (
                    <div className="flex items-baseline justify-between pt-1">
                      <span className="text-base font-bold text-white">{fmtPrice(totalPrice)}</span>
                      {hasPremium && <span className="text-[10px]" style={{ color: (lot.price_modifier ?? 0) > 0 ? "#fbbf24" : "#34d399" }}>{(lot.price_modifier ?? 0) > 0 ? "+" : "−"}{fmtPrice(Math.abs(lot.price_modifier ?? 0))} lot</span>}
                    </div>
                  )}
                </>
              )}
              <div className="flex items-center justify-between pt-0.5 border-t border-white/6">
                <p className="text-[9px] text-white/20 uppercase tracking-widest">Click to explore</p>
                <svg className="w-3 h-3 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Lot detail panel — desktop right side ──────────────────────────── */}
      <div
        className="hidden sm:flex absolute right-0 top-0 bottom-0 z-30 flex-col overflow-hidden"
        style={{ width: selectedLot ? 360 : 0, transition: "width 0.3s cubic-bezier(0.4,0,0.2,1)", ...GLASS, borderLeft: "1px solid rgba(255,255,255,0.09)", borderRadius: 0 }}
      >
        {selectedLot && <LotDetailContent lot={selectedLot} />}
      </div>

      {/* ── Lot detail panel — mobile bottom sheet ─────────────────────────── */}
      <div
        className="sm:hidden fixed inset-x-0 bottom-0 z-40 flex flex-col overflow-hidden"
        style={{
          maxHeight: "78vh",
          borderRadius: "20px 20px 0 0",
          transform: selectedLot ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.32s cubic-bezier(0.4,0,0.2,1)",
          background: "rgba(8,8,12,0.97)",
          backdropFilter: "blur(32px)",
          WebkitBackdropFilter: "blur(32px)",
          borderTop: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>
        {selectedLot && <LotDetailContent lot={selectedLot} />}
      </div>

      {/* Mobile backdrop when bottom sheet open */}
      {isMobile && selectedLot && (
        <div
          className="sm:hidden fixed inset-0 z-30 bg-black/40"
          onClick={() => setSelectedLot(null)}
        />
      )}
    </div>
  );
}
