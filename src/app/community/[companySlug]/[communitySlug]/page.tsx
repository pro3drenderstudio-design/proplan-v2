"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Community, Lot, MapSettings, FloorPlan, LotCta } from "@/types/database";

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

interface LotWithData extends Lot {
  floorPlan?: FloorPlan | null;
  project?: Project | null;
}

interface FilterState {
  statuses: string[];
  minBeds: number | null;
  minBaths: number | null;
  minGarage: number | null;
  priceMin: string;
  priceMax: string;
  sqftMin: string;
  phases: number[];
  moveInReady: boolean;
}

const ALL_STATUSES = ["available", "reserved", "sold", "coming_soon"];

const DEFAULT_FILTERS: FilterState = {
  statuses: [...ALL_STATUSES],
  minBeds: null,
  minBaths: null,
  minGarage: null,
  priceMin: "",
  priceMax: "",
  sqftMin: "",
  phases: [],
  moveInReady: false,
};

const STATUS: Record<string, { fill: string; stroke: string; glow: string; label: string; dot: string }> = {
  available:   { fill: "rgba(34,197,94,0.15)",   stroke: "rgba(34,197,94,0.75)",   glow: "rgba(34,197,94,0.35)",   label: "Available",   dot: "#22c55e" },
  reserved:    { fill: "rgba(251,191,36,0.15)",  stroke: "rgba(251,191,36,0.75)",  glow: "rgba(251,191,36,0.35)",  label: "Reserved",    dot: "#fbbf24" },
  sold:        { fill: "rgba(239,68,68,0.15)",   stroke: "rgba(239,68,68,0.7)",    glow: "rgba(239,68,68,0.3)",    label: "Sold",        dot: "#ef4444" },
  coming_soon: { fill: "rgba(148,163,184,0.06)", stroke: "rgba(148,163,184,0.3)",  glow: "rgba(148,163,184,0.08)", label: "Coming Soon", dot: "#94a3b8" },
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
function fmtSqft(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toString();
}
function fmtDate(s: string | null): string | null {
  if (!s) return null;
  try { return new Date(s).toLocaleDateString("en-US", { month: "short", year: "numeric" }); }
  catch { return null; }
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
function effectiveLotStatus(lot: LotWithData): string {
  if (lot.is_coming_soon) return "coming_soon";
  return lot.status;
}

export default function CommunityMapPage({ params }: { params: Promise<{ companySlug: string; communitySlug: string }> }) {
  const searchParams = useSearchParams();
  const [companySlug,   setCompanySlug]   = useState("");
  const [communitySlug, setCommunitySlug] = useState("");
  const [community,     setCommunity]     = useState<Community | null>(null);
  const [builder,       setBuilder]       = useState<Builder | null>(null);
  const [lots,          setLots]          = useState<LotWithData[]>([]);
  const [projectMap,    setProjectMap]    = useState<Record<string, Project>>({});
  const [loading,       setLoading]       = useState(true);

  const [hoveredLot,  setHoveredLot]  = useState<string | null>(null);
  const [selectedLot, setSelectedLot] = useState<LotWithData | null>(null);
  const [tooltip,     setTooltip]     = useState<{ x: number; y: number } | null>(null);
  const [imgRect,     setImgRect]     = useState({ left: 0, top: 0, w: 0, h: 0 });
  const [mapZoom,     setMapZoom]     = useState(1);
  const [panOffset,   setPanOffset]   = useState({ x: 0, y: 0 });
  const [isDragging,  setIsDragging]  = useState(false);
  const [isMobile,    setIsMobile]    = useState(false);

  const [filterOpen, setFilterOpen] = useState(false);
  const [filters,    setFilters]    = useState<FilterState>({ ...DEFAULT_FILTERS });
  const [favorites,  setFavorites]  = useState<Set<string>>(new Set());

  const [contactLot,  setContactLot]  = useState<LotWithData | null>(null);
  const [contactForm, setContactForm] = useState({ firstName: "", lastName: "", email: "", phone: "", message: "" });
  const [contactBusy, setContactBusy] = useState(false);
  const [contactDone, setContactDone] = useState(false);
  const [contactErr,  setContactErr]  = useState("");

  const imgRef       = useRef<HTMLImageElement>(null);
  const mapWrapRef   = useRef<HTMLDivElement>(null);
  const mapCanvasRef = useRef<HTMLDivElement>(null);
  const panStart     = useRef({ cx: 0, cy: 0, px: 0, py: 0 });
  const hasDragged   = useRef(false);
  const touchPanRef  = useRef<{ id: number; sx: number; sy: number; px: number; py: number } | null>(null);
  const pinchRef     = useRef<{ dist: number; zoom: number } | null>(null);

  // ── Computed ──────────────────────────────────────────────────────────────
  const uniquePhases = useMemo(() =>
    [...new Set(lots.filter(l => l.phase).map(l => l.phase!))].sort((a, b) => a - b),
  [lots]);

  const minPrice = useMemo(() => lots.reduce((min: number | null, lot) => {
    const bp = lot.floorPlan?.base_price ?? (lot.project?.base_price ?? null);
    if (bp === null) return min;
    const total = bp + (lot.price_modifier ?? 0);
    return min === null ? total : Math.min(min, total);
  }, null), [lots]);

  const filteredLotIds = useMemo(() => {
    const ids = new Set<string>();
    for (const lot of lots) {
      const fp     = lot.floorPlan;
      const status = effectiveLotStatus(lot);
      if (!filters.statuses.includes(status)) continue;
      if (filters.moveInReady && status !== "available") continue;
      if (filters.phases.length > 0 && !filters.phases.includes(lot.phase ?? 1)) continue;
      if (fp) {
        if (filters.minBeds   && (fp.beds          ?? 0) < filters.minBeds)   continue;
        if (filters.minBaths  && (fp.baths         ?? 0) < filters.minBaths)  continue;
        if (filters.minGarage && (fp.garage_spaces ?? 0) < filters.minGarage) continue;
        const price = (fp.base_price ?? 0) + (lot.price_modifier ?? 0);
        const pMin = parseFloat(filters.priceMin.replace(/[^0-9.]/g, ""));
        const pMax = parseFloat(filters.priceMax.replace(/[^0-9.]/g, ""));
        if (!isNaN(pMin) && price < pMin) continue;
        if (!isNaN(pMax) && price > pMax) continue;
        const sMin = parseFloat(filters.sqftMin.replace(/[^0-9.]/g, ""));
        if (!isNaN(sMin) && (fp.sqft ?? 0) < sMin) continue;
      }
      ids.add(lot.id);
    }
    return ids;
  }, [lots, filters]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filters.statuses.length < ALL_STATUSES.length) n++;
    if (filters.phases.length > 0) n++;
    if (filters.minBeds)    n++;
    if (filters.minBaths)   n++;
    if (filters.minGarage)  n++;
    if (filters.priceMin)   n++;
    if (filters.priceMax)   n++;
    if (filters.sqftMin)    n++;
    if (filters.moveInReady) n++;
    return n;
  }, [filters]);

  // ── Mobile detection ──────────────────────────────────────────────────────
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Touch prevention ──────────────────────────────────────────────────────
  useEffect(() => {
    const el = mapCanvasRef.current;
    if (!el) return;
    const handler = (e: TouchEvent) => { if (e.touches.length > 0) e.preventDefault(); };
    el.addEventListener("touchmove", handler, { passive: false });
    return () => el.removeEventListener("touchmove", handler);
  }, []);

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

      // Load floor plans
      const fpIds = [...new Set(rawLots.filter(l => l.floor_plan_id).map(l => l.floor_plan_id!))];
      const fpMap: Record<string, FloorPlan> = {};
      if (fpIds.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: fps } = await (supabase.from("floor_plans") as any).select("*").in("id", fpIds);
        if (fps) for (const fp of fps as FloorPlan[]) fpMap[fp.id] = fp;
      }

      // Load projects (legacy lot.project_id + floor_plan.project_id for configurator links)
      const projIds = [...new Set([
        ...rawLots.filter(l => l.project_id).map(l => l.project_id!),
        ...Object.values(fpMap).filter(fp => fp.project_id).map(fp => fp.project_id!),
      ])];
      const projMap: Record<string, Project> = {};
      if (projIds.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: projs } = await (supabase.from("projects") as any)
          .select("id,name,slug,company_slug,beds,baths,floors,sqft,base_price,thumbnail_url,home_type,description")
          .in("id", projIds);
        if (projs) for (const p of projs as Project[]) projMap[p.id] = p;
      }

      setProjectMap(projMap);
      setLots(rawLots.map(l => ({
        ...l,
        floorPlan: l.floor_plan_id ? (fpMap[l.floor_plan_id] ?? null) : null,
        project:   l.project_id   ? (projMap[l.project_id]   ?? null) : null,
      })));
      setLoading(false);
    })();
  }, [companySlug, communitySlug]);

  // ── Favorites ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!community?.id) return;
    try {
      const saved = localStorage.getItem(`fav_${community.id}`);
      if (saved) setFavorites(new Set(JSON.parse(saved) as string[]));
    } catch { /* ignore */ }
  }, [community?.id]);

  function toggleFavorite(lotId: string) {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(lotId)) next.delete(lotId);
      else next.add(lotId);
      try { localStorage.setItem(`fav_${community!.id}`, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }

  // ── Auto-select lot from URL param (?lot=<id>) ────────────────────────────
  useEffect(() => {
    if (lots.length === 0) return;
    const lotParam = searchParams.get("lot");
    if (!lotParam) return;
    const match = lots.find(l => l.id === lotParam);
    if (match) setSelectedLot(match);
  }, [lots, searchParams]);

  // ── Map interaction ───────────────────────────────────────────────────────
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

  // ── Contact form ──────────────────────────────────────────────────────────
  function closeContactModal() {
    setContactLot(null);
    setContactForm({ firstName: "", lastName: "", email: "", phone: "", message: "" });
    setContactBusy(false);
    setContactDone(false);
    setContactErr("");
  }
  async function submitContact(e: React.FormEvent) {
    e.preventDefault();
    if (!contactLot) return;
    setContactBusy(true);
    setContactErr("");
    try {
      const res = await fetch("/api/community-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          community_id:   community?.id,
          community_name: community?.name,
          community_slug: communitySlug,
          lot_id:         contactLot.id,
          lot_number:     contactLot.lot_number,
          floor_plan_id:  contactLot.floor_plan_id ?? null,
          project_id:     contactLot.project_id ?? null,
          first_name:     contactForm.firstName,
          last_name:      contactForm.lastName,
          email:          contactForm.email,
          phone:          contactForm.phone || null,
          message:        contactForm.message || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "Submission failed");
      }
      setContactDone(true);
    } catch (err) {
      setContactErr(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setContactBusy(false);
    }
  }

  // ── Loading / not found ───────────────────────────────────────────────────
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

  // ── Stats & map settings ──────────────────────────────────────────────────
  const stats = {
    available:   lots.filter(l => effectiveLotStatus(l) === "available").length,
    reserved:    lots.filter(l => effectiveLotStatus(l) === "reserved").length,
    sold:        lots.filter(l => effectiveLotStatus(l) === "sold").length,
    coming_soon: lots.filter(l => effectiveLotStatus(l) === "coming_soon").length,
    total:       lots.length,
  };

  const comm               = community!;
  const ms: MapSettings    = comm.map_settings ?? {};
  const showLabels         = ms.show_labels !== false;
  const defaultLabelColor  = ms.default_label_color ?? "rgba(255,255,255,0.9)";
  const defaultLabelSize   = ms.default_label_size ?? null;
  const defaultStrokeWidth = ms.stroke_width ?? 1.5;

  const addressLine   = [comm.address, comm.city, comm.state, comm.zip].filter(Boolean).join(", ");
  const mapsUrl       = (comm.latitude && comm.longitude)
    ? `https://www.google.com/maps?q=${comm.latitude},${comm.longitude}`
    : addressLine ? `https://www.google.com/maps/search/${encodeURIComponent(addressLine)}` : null;
  const directionsUrl = (comm.latitude && comm.longitude)
    ? `https://www.google.com/maps/dir/?api=1&destination=${comm.latitude},${comm.longitude}`
    : addressLine ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addressLine)}` : null;

  // ── CTA helpers ───────────────────────────────────────────────────────────
  function getEffectiveCtas(lot: LotWithData): LotCta[] {
    const arr = (lot.ctas ?? []) as LotCta[];
    if (arr.length > 0) return arr;
    const t = lot.cta_type;
    if (!t || t === "none") return [];
    return [{ type: t as LotCta["type"], label: lot.cta_label ?? "", url: lot.cta_url ?? undefined }];
  }
  function getConfiguratorProject(lot: LotWithData): Project | null {
    if (lot.floorPlan?.project_id) return projectMap[lot.floorPlan.project_id] ?? null;
    return lot.project ?? null;
  }

  // ── Lot detail content ────────────────────────────────────────────────────
  function LotDetailContent({ lot }: { lot: LotWithData }) {
    const fp         = lot.floorPlan;
    const proj       = lot.project;
    const status     = effectiveLotStatus(lot);
    const s          = STATUS[status] ?? STATUS.available;
    const isFav      = favorites.has(lot.id);
    const configProj = getConfiguratorProject(lot);

    const thumbnailUrl = fp?.thumbnail_url ?? proj?.thumbnail_url ?? null;
    const displayName  = fp?.name          ?? proj?.name          ?? null;
    const homeStyle    = fp?.home_style    ?? proj?.home_type      ?? null;
    const description  = fp?.description   ?? proj?.description    ?? null;
    const beds         = fp?.beds          ?? proj?.beds           ?? null;
    const baths        = fp?.baths         ?? proj?.baths          ?? null;
    const floors       = fp?.floors        ?? proj?.floors         ?? null;
    const sqft         = fp?.sqft          ?? proj?.sqft           ?? null;
    const garage       = fp?.garage_spaces ?? null;
    const basePrice    = fp?.base_price    ?? (proj ? proj.base_price : null);
    const totalPrice   = basePrice !== null ? basePrice + (lot.price_modifier ?? 0) : null;

    const rawCtas      = getEffectiveCtas(lot);
    const effectiveCtas: LotCta[] = rawCtas.length === 0 && configProj
      ? [{ type: "configurator", label: "Configure this home" }]
      : rawCtas;

    const Arrow = () => (
      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
      </svg>
    );

    function renderCta(cta: LotCta, idx: number) {
      const isPrimary    = idx === 0;
      const cls          = `flex items-center justify-center gap-2 w-full ${isPrimary ? "py-3.5 text-sm font-bold" : "py-2.5 text-xs font-semibold"} rounded-xl text-white transition-all hover:brightness-110`;
      const primaryStyle = { background: "rgba(37,99,235,0.85)", border: "1px solid rgba(59,130,246,0.4)", boxShadow: "0 4px 20px rgba(37,99,235,0.3)" };
      const secondStyle  = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)" };
      const style        = isPrimary ? primaryStyle : secondStyle;

      if (cta.type === "external" && cta.url) {
        return <a key={idx} href={cta.url} target="_blank" rel="noopener noreferrer" className={cls} style={style}>{cta.label || "Learn More"} <Arrow /></a>;
      }
      if (cta.type === "contact") {
        return <button key={idx} onClick={() => setContactLot(lot)} className={cls} style={style}>{cta.label || "Request Info"} <Arrow /></button>;
      }
      if (cta.type === "schedule" && cta.url) {
        return <a key={idx} href={cta.url} target="_blank" rel="noopener noreferrer" className={cls} style={style}>{cta.label || "Schedule a Tour"} <Arrow /></a>;
      }
      if (cta.type === "configurator" && configProj) {
        return (
          <Link key={idx}
            href={`/project/${configProj.company_slug}/${configProj.slug}?lotId=${encodeURIComponent(lot.id)}&lotNumber=${encodeURIComponent(lot.lot_number)}&communitySlug=${encodeURIComponent(comm.slug)}&communityName=${encodeURIComponent(comm.name)}&lotPriceModifier=${lot.price_modifier ?? 0}`}
            target="_top" className={cls} style={style}>
            {cta.label || "Configure this home"} <Arrow />
          </Link>
        );
      }
      return null;
    }

    const FavBtn = ({ size = "sm" }: { size?: "sm" | "md" }) => (
      <button onClick={() => toggleFavorite(lot.id)}
        className={`${size === "md" ? "w-8 h-8" : "w-7 h-7"} flex items-center justify-center rounded-lg transition-colors hover:bg-white/8 flex-shrink-0`}>
        <svg className="w-4 h-4" fill={isFav ? "#ef4444" : "none"} viewBox="0 0 24 24" stroke={isFav ? "#ef4444" : "rgba(255,255,255,0.3)"} strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
        </svg>
      </button>
    );

    return (
      <>
        {/* Header */}
        <div className="relative flex-shrink-0">
          {thumbnailUrl ? (
            <div className="relative overflow-hidden" style={{ height: isMobile ? 180 : 208 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumbnailUrl} alt={displayName ?? lot.lot_number} className="w-full h-full object-cover" />
              <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.72) 100%)" }} />
              <div className="absolute bottom-0 left-0 right-0 px-5 pb-4">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/50">Lot</p>
                    <p className="text-2xl font-bold text-white leading-tight">{lot.lot_number}</p>
                    {lot.phase && lot.phase > 0 && <p className="text-[10px] text-white/40 mt-0.5">Phase {lot.phase}</p>}
                  </div>
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
                    style={{ background: "rgba(0,0,0,0.6)", border: `1px solid ${s.stroke}`, color: s.dot }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
                    {s.label}
                  </span>
                </div>
              </div>
              <div className="absolute top-3 right-3 flex items-center gap-1.5">
                <button onClick={() => toggleFavorite(lot.id)}
                  className="w-8 h-8 flex items-center justify-center rounded-full transition-colors"
                  style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}>
                  <svg className="w-4 h-4" fill={isFav ? "#ef4444" : "none"} viewBox="0 0 24 24" stroke={isFav ? "#ef4444" : "rgba(255,255,255,0.6)"} strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                  </svg>
                </button>
                <button onClick={() => setSelectedLot(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-white/60 hover:text-white transition-colors"
                  style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)" }}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">Lot</p>
                <p className="text-xl font-bold text-white">{lot.lot_number}</p>
                {lot.phase && lot.phase > 0 && <p className="text-[10px] text-white/30 mt-0.5">Phase {lot.phase}</p>}
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
                  style={{ background: s.fill, border: `1px solid ${s.stroke}`, color: s.dot }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
                  {s.label}
                </span>
                <FavBtn />
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

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-5 py-4 space-y-4">

            {/* Home model */}
            {displayName && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1">Home Model</p>
                <h2 className="text-lg font-bold text-white leading-tight">{displayName}</h2>
                {homeStyle && <p className="text-xs text-white/35 mt-0.5 capitalize">{homeStyle.replace(/_/g, " ")}</p>}
                {description && <p className="text-xs text-white/40 mt-2 leading-relaxed">{description}</p>}
              </div>
            )}

            {/* Specs */}
            {(beds || baths || floors || sqft || garage) && (
              <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${[beds, baths, floors, sqft, garage].filter(x => x != null).length}, 1fr)` }}>
                {[
                  { label: "Bed",    value: beds },
                  { label: "Bath",   value: baths },
                  { label: "Floor",  value: floors },
                  { label: "Sqft",   value: sqft ? fmtSqft(sqft) : null },
                  { label: "Garage", value: garage },
                ].filter(x => x.value != null).map(spec => (
                  <div key={spec.label} className="flex flex-col items-center py-2.5 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-base font-bold text-white">{spec.value}</p>
                    <p className="text-[9px] uppercase tracking-wider text-white/30 mt-0.5">{spec.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Price */}
            {totalPrice !== null && (
              <div className="rounded-xl px-4 py-3.5"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1">Starting Price</p>
                <p className="text-3xl font-bold text-white">{fmtPrice(totalPrice)}</p>
                {(lot.price_modifier ?? 0) !== 0 && (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="text-[11px] text-white/30">{fmtPrice(basePrice!)} base</span>
                    <span className="text-[11px] text-white/20">·</span>
                    <span className="text-[11px]" style={{ color: (lot.price_modifier ?? 0) > 0 ? "#fbbf24" : "#34d399" }}>
                      {(lot.price_modifier ?? 0) > 0 ? "+" : "−"}{fmtPrice(Math.abs(lot.price_modifier ?? 0))} lot adj.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Lot details */}
            {(lot.lot_size_sqft || lot.estimated_completion || lot.virtual_tour_url) && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">Lot Details</p>
                <div className="grid grid-cols-2 gap-2">
                  {lot.lot_size_sqft && (
                    <div className="rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <p className="text-[10px] text-white/30 mb-0.5">Lot Size</p>
                      <p className="text-sm font-bold text-white">{lot.lot_size_sqft.toLocaleString()} sqft</p>
                      {lot.lot_width_ft && lot.lot_depth_ft && (
                        <p className="text-[10px] text-white/25 mt-0.5">{lot.lot_width_ft}′ × {lot.lot_depth_ft}′</p>
                      )}
                    </div>
                  )}
                  {lot.estimated_completion && (
                    <div className="rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <p className="text-[10px] text-white/30 mb-0.5">Est. Completion</p>
                      <p className="text-sm font-bold text-white">{fmtDate(lot.estimated_completion)}</p>
                    </div>
                  )}
                </div>
                {lot.virtual_tour_url && (
                  <a href={lot.virtual_tour_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs text-white/50 hover:text-white/80 transition-colors"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                    Virtual Tour
                    <svg className="w-3 h-3 ml-auto flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  </a>
                )}
              </div>
            )}

            {/* Notes */}
            {lot.notes && (
              <div className="rounded-xl px-4 py-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-1.5">Notes</p>
                <p className="text-xs text-white/45 leading-relaxed">{lot.notes}</p>
              </div>
            )}

            {/* CTAs */}
            {status === "available" && effectiveCtas.length > 0 && (
              <div className="space-y-2">
                {effectiveCtas.map((cta, idx) => renderCta(cta, idx)).filter(Boolean)}
              </div>
            )}
            {status === "coming_soon" && (
              <div className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold text-slate-400/70"
                style={{ background: "rgba(148,163,184,0.06)", border: "1px solid rgba(148,163,184,0.2)" }}>
                Coming soon — not yet available
              </div>
            )}
            {status === "reserved" && (
              <div className="flex items-center justify-center w-full py-3 rounded-xl text-sm font-semibold text-amber-400/70"
                style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)" }}>
                This lot is currently reserved
              </div>
            )}
            {status === "sold" && (
              <div className="flex items-center justify-center w-full py-3 rounded-xl text-sm font-semibold text-white/25"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                This lot has been sold
              </div>
            )}

            {/* Directions */}
            {directionsUrl && (
              <a href={directionsUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 w-full py-2.5 px-3 rounded-xl text-xs text-white/40 hover:text-white/70 transition-colors"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                <span className="flex-1">Get Directions</span>
                <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </a>
            )}
          </div>
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

  // ── Filter panel ──────────────────────────────────────────────────────────
  function FilterPanel() {
    function toggleStatus(key: string) {
      setFilters(f => {
        const next = f.statuses.includes(key) ? f.statuses.filter(x => x !== key) : [...f.statuses, key];
        return { ...f, statuses: next.length === 0 ? [key] : next };
      });
    }
    function togglePhase(p: number) {
      setFilters(f => ({ ...f, phases: f.phases.includes(p) ? f.phases.filter(x => x !== p) : [...f.phases, p] }));
    }
    const btnBase   = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)" };
    const btnActive = { background: "rgba(59,130,246,0.18)",  border: "1px solid rgba(59,130,246,0.4)",  color: "#93c5fd" };

    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 flex-shrink-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-white">Filters</p>
            {activeFilterCount > 0 && (
              <span className="text-[10px] font-bold text-blue-400 bg-blue-500/15 px-1.5 py-0.5 rounded-full">{activeFilterCount}</span>
            )}
          </div>
          <button onClick={() => setFilters({ ...DEFAULT_FILTERS })} className="text-[11px] text-white/30 hover:text-white/60 transition-colors">
            Reset all
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* Status */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Status</p>
            <div className="flex flex-wrap gap-1.5">
              {ALL_STATUSES.map(key => {
                const st     = STATUS[key];
                const active = filters.statuses.includes(key);
                return (
                  <button key={key} onClick={() => toggleStatus(key)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                    style={active ? { background: `${st.dot}1a`, border: `1px solid ${st.dot}60`, color: st.dot } : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.3)" }}>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: active ? st.dot : "rgba(255,255,255,0.2)" }} />
                    {st.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Phases (only when multiple exist) */}
          {uniquePhases.length > 1 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Phase</p>
              <div className="flex flex-wrap gap-1.5">
                {uniquePhases.map(p => (
                  <button key={p} onClick={() => togglePhase(p)}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                    style={filters.phases.includes(p) ? btnActive : btnBase}>
                    Phase {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Bedrooms */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Min. Bedrooms</p>
            <div className="flex gap-1.5">
              {[null, 1, 2, 3, 4].map(n => (
                <button key={n ?? "any"} onClick={() => setFilters(f => ({ ...f, minBeds: n }))}
                  className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                  style={filters.minBeds === n ? btnActive : btnBase}>
                  {n === null ? "Any" : `${n}+`}
                </button>
              ))}
            </div>
          </div>

          {/* Bathrooms */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Min. Bathrooms</p>
            <div className="flex gap-1.5">
              {[null, 1, 2, 3].map(n => (
                <button key={n ?? "any"} onClick={() => setFilters(f => ({ ...f, minBaths: n }))}
                  className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                  style={filters.minBaths === n ? btnActive : btnBase}>
                  {n === null ? "Any" : `${n}+`}
                </button>
              ))}
            </div>
          </div>

          {/* Garage */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Min. Garage</p>
            <div className="flex gap-1.5">
              {[null, 1, 2, 3].map(n => (
                <button key={n ?? "any"} onClick={() => setFilters(f => ({ ...f, minGarage: n }))}
                  className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
                  style={filters.minGarage === n ? btnActive : btnBase}>
                  {n === null ? "Any" : `${n}+`}
                </button>
              ))}
            </div>
          </div>

          {/* Price range */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Price Range</p>
            <div className="flex gap-2">
              {[
                { key: "priceMin" as const, label: "Min", placeholder: "$0" },
                { key: "priceMax" as const, label: "Max", placeholder: "No limit" },
              ].map(({ key, label, placeholder }) => (
                <div key={key} className="flex-1">
                  <p className="text-[9px] text-white/25 mb-1">{label}</p>
                  <input type="text" placeholder={placeholder} value={filters[key]}
                    onChange={e => setFilters(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full px-2.5 py-2 rounded-lg text-xs text-white placeholder-white/20 outline-none"
                    style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }} />
                </div>
              ))}
            </div>
          </div>

          {/* Min sq ft */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">Min. Square Footage</p>
            <input type="text" placeholder="Any size" value={filters.sqftMin}
              onChange={e => setFilters(f => ({ ...f, sqftMin: e.target.value }))}
              className="w-full px-2.5 py-2 rounded-lg text-xs text-white placeholder-white/20 outline-none"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }} />
          </div>

          {/* Move-in ready */}
          <button onClick={() => setFilters(f => ({ ...f, moveInReady: !f.moveInReady }))}
            className="flex items-center gap-3 w-full">
            <div className="w-9 h-5 rounded-full transition-colors flex-shrink-0 relative"
              style={{ background: filters.moveInReady ? "rgba(37,99,235,0.8)" : "rgba(255,255,255,0.1)", border: filters.moveInReady ? "1px solid rgba(59,130,246,0.5)" : "1px solid rgba(255,255,255,0.1)" }}>
              <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
                style={{ left: filters.moveInReady ? "calc(100% - 18px)" : 2 }} />
            </div>
            <span className="text-xs font-semibold text-white/60">Move-in ready only</span>
          </button>
        </div>

        {/* Footer count */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-white/8">
          <p className="text-xs text-center" style={{ color: "rgba(255,255,255,0.35)" }}>
            <span className="font-bold text-white">{filteredLotIds.size}</span> of{" "}
            <span className="font-bold text-white">{lots.length}</span> lots match
          </p>
        </div>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="relative h-screen bg-[#080808] overflow-hidden">

      {/* Map canvas */}
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
            <img ref={imgRef} src={community.site_map_url} alt={community.name}
              className="w-full h-full object-contain" onLoad={measureImgRect} />

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
                  const status  = effectiveLotStatus(lot);
                  const s       = STATUS[status] ?? STATUS.available;
                  const isHov   = hoveredLot === lot.id;
                  const isSel   = selectedLot?.id === lot.id;
                  const isDimmed = !filteredLotIds.has(lot.id);
                  const isCS    = status === "coming_soon";
                  const [cx, cy] = centroid(lot.polygon);
                  const svgCx   = lot.label_x != null ? (lot.label_x / 100) * imgRect.w : (cx / 100) * imgRect.w;
                  const svgCy   = lot.label_y != null ? (lot.label_y / 100) * imgRect.h : (cy / 100) * imgRect.h;
                  const pts     = toSvgPoints(lot.polygon, imgRect.w, imgRect.h);
                  const fs      = lot.label_font_size ?? defaultLabelSize ?? Math.max(9, Math.min(13, imgRect.w / 70));
                  const fc      = lot.text_color ?? defaultLabelColor;

                  return (
                    <g key={lot.id} style={{ opacity: isDimmed ? 0.25 : 1, transition: "opacity 0.2s" }}>
                      {(isHov || isSel) && !isDimmed && (
                        <polygon points={pts} fill={s.glow} stroke="none" filter={`url(#glow-${lot.id})`} style={{ pointerEvents: "none" }} />
                      )}
                      <polygon
                        points={pts}
                        fill={isHov || isSel ? s.fill.replace("0.15", "0.28").replace("0.06", "0.15") : s.fill}
                        stroke={s.stroke}
                        strokeWidth={isSel ? 2.5 : isHov ? 2 : defaultStrokeWidth}
                        strokeDasharray={isCS ? "5 3" : isSel ? "5 3" : undefined}
                        className="cursor-pointer"
                        style={{ transition: "fill 0.15s, stroke-width 0.15s" }}
                        data-lot="true"
                        onMouseEnter={e => { if (!hasDragged.current && !isMobile) { setHoveredLot(lot.id); setTooltip({ x: e.clientX, y: e.clientY }); } }}
                        onMouseMove={e => { if (!isMobile) setTooltip({ x: e.clientX, y: e.clientY }); }}
                        onMouseLeave={() => { setHoveredLot(null); setTooltip(null); }}
                        onClick={() => { if (!hasDragged.current) setSelectedLot(prev => prev?.id === lot.id ? null : lot); }}
                      />
                      {showLabels && (
                        <text x={svgCx} y={svgCy} textAnchor="middle" dominantBaseline="middle"
                          fontSize={fs} fontWeight="700"
                          fill={isCS ? "rgba(148,163,184,0.7)" : fc}
                          style={{ pointerEvents: "none", userSelect: "none" }}
                          filter="url(#label-shadow)">
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

      {/* Vignette */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)" }} />

      {/* Top bar */}
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

        {/* Right: stats + filter button */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Desktop stats */}
          <div className="hidden sm:flex items-center gap-2">
            {([
              { key: "available" as const, label: "Available" },
              { key: "reserved"  as const, label: "Reserved" },
              { key: "sold"      as const, label: "Sold" },
              ...(stats.coming_soon > 0 ? [{ key: "coming_soon" as const, label: "Coming Soon" }] : []),
            ]).map(({ key, label }) => {
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

          {/* Mobile compact stats */}
          <div className="flex sm:hidden items-center gap-1.5" style={{ ...GLASS, borderRadius: 12, padding: "6px 10px" }}>
            {([
              { key: "available" as const, dot: "#22c55e" },
              { key: "reserved"  as const, dot: "#fbbf24" },
              { key: "sold"      as const, dot: "#ef4444" },
            ]).map(({ key, dot }) => (
              <div key={key} className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: dot }} />
                <span className="text-[11px] font-bold text-white/70">{stats[key]}</span>
              </div>
            ))}
          </div>

          {/* Filter / Search Homes button */}
          <button onClick={() => setFilterOpen(v => !v)}
            className="relative flex items-center gap-2 rounded-xl transition-all"
            style={filterOpen
              ? { background: "rgba(37,99,235,0.28)", border: "1px solid rgba(59,130,246,0.55)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", padding: "8px 14px", boxShadow: "0 0 0 1px rgba(59,130,246,0.2)" }
              : { background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.22)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", padding: "8px 14px", boxShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke={filterOpen ? "#93c5fd" : "rgba(255,255,255,0.85)"} strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <span className="text-sm font-semibold" style={{ color: filterOpen ? "#93c5fd" : "rgba(255,255,255,0.9)" }}>
              <span className="hidden sm:inline">Search Homes</span>
              <span className="sm:hidden">Search</span>
            </span>
            {activeFilterCount > 0 ? (
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-[10px] font-bold text-white flex-shrink-0">
                {activeFilterCount}
              </span>
            ) : (
              <span className="hidden sm:flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0"
                style={{ background: "rgba(34,197,94,0.2)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" }}>
                {stats.available}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Filter drawer — desktop (left slide-in) */}
      <div
        className="hidden sm:flex absolute left-0 top-[72px] bottom-0 z-25 flex-col overflow-hidden"
        style={{
          width: filterOpen ? 272 : 0,
          transition: "width 0.28s cubic-bezier(0.4,0,0.2,1)",
          ...GLASS,
          borderRight: "1px solid rgba(255,255,255,0.09)",
          borderRadius: 0,
        }}
      >
        {filterOpen && <FilterPanel />}
      </div>

      {/* Filter drawer — mobile (bottom sheet) */}
      <div
        className="sm:hidden fixed inset-x-0 bottom-0 z-40 flex flex-col overflow-hidden"
        style={{
          maxHeight: "72vh",
          borderRadius: "20px 20px 0 0",
          transform: filterOpen ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
          background: "rgba(8,8,12,0.97)",
          backdropFilter: "blur(32px)",
          WebkitBackdropFilter: "blur(32px)",
          borderTop: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div className="flex justify-center pt-3 pb-0 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>
        <FilterPanel />
      </div>
      {isMobile && filterOpen && (
        <div className="sm:hidden fixed inset-0 z-30 bg-black/40" onClick={() => setFilterOpen(false)} />
      )}

      {/* Zoom controls — desktop */}
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

      {/* Community info card — desktop bottom-left */}
      {!selectedLot && (
        <div className="hidden sm:block absolute bottom-5 z-20 max-w-xs"
          style={{ ...GLASS, borderRadius: 16, padding: "16px 18px", left: filterOpen ? 292 : 20, transition: "left 0.28s cubic-bezier(0.4,0,0.2,1)" }}>
          <h1 className="text-base font-bold text-white leading-tight">{community.name}</h1>
          {community.description && (
            <p className="text-xs text-white/45 mt-1.5 leading-relaxed">{community.description}</p>
          )}

          {/* Address */}
          {addressLine && (
            <div className="flex items-start gap-1.5 mt-2">
              <svg className="w-3 h-3 text-white/25 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              <p className="text-[11px] text-white/35 leading-tight">{addressLine}</p>
            </div>
          )}

          {/* Community metadata */}
          {(comm.hoa_fee_monthly || comm.school_district) && (
            <div className="mt-2 space-y-1">
              {comm.hoa_fee_monthly && (
                <p className="text-[11px] text-white/30">HOA: <span className="text-white/50 font-semibold">{fmtPrice(comm.hoa_fee_monthly)}/mo</span></p>
              )}
              {comm.school_district && (
                <p className="text-[11px] text-white/30">School District: <span className="text-white/50 font-semibold">{comm.school_district}</span></p>
              )}
            </div>
          )}

          {/* Price range */}
          {minPrice !== null && (
            <p className="text-[11px] text-white/35 mt-2">From <span className="text-white/70 font-bold">{fmtPrice(minPrice)}</span></p>
          )}

          {/* Stats */}
          <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/8">
            <div className="text-center">
              <p className="text-lg font-bold text-white">{stats.total}</p>
              <p className="text-[10px] text-white/30">Total</p>
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
            {stats.coming_soon > 0 && (
              <>
                <div className="w-px h-8 bg-white/8" />
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-400">{stats.coming_soon}</p>
                  <p className="text-[10px] text-white/30">Soon</p>
                </div>
              </>
            )}
          </div>

          {/* Directions */}
          {mapsUrl && (
            <a href={directionsUrl ?? mapsUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 w-full mt-3 py-2 rounded-xl text-[11px] font-semibold text-white/40 hover:text-white/70 transition-colors"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              Get Directions
            </a>
          )}

          {lots.length > 0 && (
            <p className="text-[10px] text-white/20 mt-3 text-center">Click a lot on the map to explore</p>
          )}
        </div>
      )}

      {/* Community info — mobile bottom bar */}
      {!selectedLot && !filterOpen && (
        <div className="sm:hidden absolute bottom-0 left-0 right-0 z-20"
          style={{ ...GLASS, borderTop: "1px solid rgba(255,255,255,0.09)", padding: "14px 16px 20px" }}>
          <div className="flex items-center justify-between mb-1">
            <div>
              <h1 className="text-sm font-bold text-white leading-tight">{community.name}</h1>
              {addressLine && <p className="text-[10px] text-white/30 mt-0.5">{addressLine}</p>}
            </div>
            <div className="flex items-center gap-3">
              <div className="text-center">
                <span className="text-sm font-bold text-green-400">{stats.available}</span>
                <span className="text-[10px] text-white/30 ml-1">avail</span>
              </div>
              {stats.reserved > 0 && (
                <div>
                  <span className="text-sm font-bold text-amber-400">{stats.reserved}</span>
                  <span className="text-[10px] text-white/30 ml-1">res</span>
                </div>
              )}
              <div>
                <span className="text-sm font-bold text-white/50">{stats.total}</span>
                <span className="text-[10px] text-white/30 ml-1">total</span>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between mt-1">
            {minPrice !== null
              ? <p className="text-[10px] text-white/30">From <span className="font-bold text-white/50">{fmtPrice(minPrice)}</span></p>
              : <p className="text-[10px] text-white/25">Tap a lot on the map to explore</p>
            }
            {directionsUrl && (
              <a href={directionsUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/60">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                Directions
              </a>
            )}
          </div>
        </div>
      )}

      {/* Hover tooltip — desktop */}
      {!isMobile && tooltip && hoveredLot && !selectedLot && (() => {
        const lot = lots.find(l => l.id === hoveredLot);
        if (!lot) return null;
        const fp          = lot.floorPlan;
        const proj        = lot.project;
        const status      = effectiveLotStatus(lot);
        const s           = STATUS[status] ?? STATUS.available;
        const thumbUrl    = fp?.thumbnail_url ?? proj?.thumbnail_url ?? null;
        const name        = fp?.name ?? proj?.name ?? null;
        const homeType    = fp?.home_style ?? proj?.home_type ?? null;
        const beds        = fp?.beds ?? proj?.beds ?? null;
        const baths       = fp?.baths ?? proj?.baths ?? null;
        const sqft        = fp?.sqft ?? proj?.sqft ?? null;
        const floors      = fp?.floors ?? proj?.floors ?? null;
        const basePrice   = fp?.base_price ?? (proj ? proj.base_price : null);
        const totalPrice  = basePrice !== null ? basePrice + (lot.price_modifier ?? 0) : null;
        const isDimmed    = !filteredLotIds.has(lot.id);

        const cardW = 252, margin = 14;
        const flipX = tooltip.x + margin + cardW > window.innerWidth - 12;
        const left  = flipX ? tooltip.x - cardW - margin : tooltip.x + margin;
        const top   = Math.min(tooltip.y - 12, window.innerHeight - 340);

        return (
          <div className="fixed z-50 pointer-events-none"
            style={{ left, top: Math.max(8, top), width: cardW, background: "rgba(6,6,10,0.94)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)", border: `1px solid ${s.stroke}`, borderRadius: 14, boxShadow: `0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)`, overflow: "hidden", animation: "hoverCardIn 0.14s ease-out", opacity: isDimmed ? 0.5 : 1 }}>
            <style>{`@keyframes hoverCardIn { from { opacity:0; transform:translateY(4px) scale(0.97); } to { opacity:1; transform:none; } }`}</style>
            <div style={{ height: 2, background: s.dot, opacity: 0.8 }} />
            {thumbUrl && (
              <div className="relative overflow-hidden" style={{ height: 118 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumbUrl} alt={name ?? ""} className="w-full h-full object-cover" />
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
                  <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5 text-white/30">Lot</p>
                  <p className="text-base font-bold text-white leading-none">{lot.lot_number}</p>
                  {lot.phase && lot.phase > 0 && <p className="text-[9px] text-white/25 mt-0.5">Phase {lot.phase}</p>}
                </div>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 mt-0.5"
                  style={{ background: `${s.dot}18`, border: `1px solid ${s.dot}55`, color: s.dot }}>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: s.dot }} />
                  {s.label}
                </span>
              </div>
              {name && (
                <div>
                  <p className="text-xs font-semibold text-white/80 leading-tight">{name}</p>
                  {homeType && <p className="text-[10px] text-white/35 mt-0.5 capitalize">{homeType.replace(/_/g, " ")}</p>}
                </div>
              )}
              {(beds || baths || sqft || floors) && (
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { v: beds,   l: "Bed" },
                    { v: baths,  l: "Bath" },
                    { v: sqft ? fmtSqft(sqft) : null, l: "Sqft" },
                    { v: floors, l: "Floor" },
                  ].filter(x => x.v != null).map(({ v, l }) => (
                    <div key={l} className="flex flex-col items-center py-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
                      <p className="text-xs font-bold text-white leading-none">{v}</p>
                      <p className="text-[8px] uppercase tracking-wider text-white/30 mt-0.5">{l}</p>
                    </div>
                  ))}
                </div>
              )}
              {totalPrice !== null && !thumbUrl && (
                <div className="flex items-baseline justify-between pt-1">
                  <span className="text-base font-bold text-white">{fmtPrice(totalPrice)}</span>
                  {(lot.price_modifier ?? 0) !== 0 && (
                    <span className="text-[10px]" style={{ color: (lot.price_modifier ?? 0) > 0 ? "#fbbf24" : "#34d399" }}>
                      {(lot.price_modifier ?? 0) > 0 ? "+" : "−"}{fmtPrice(Math.abs(lot.price_modifier ?? 0))} lot
                    </span>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between pt-0.5 border-t border-white/6">
                <p className="text-[9px] text-white/20 uppercase tracking-widest">
                  {isDimmed ? "Outside filter" : "Click to explore"}
                </p>
                <svg className="w-3 h-3 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Lot detail panel — desktop right */}
      <div className="hidden sm:flex absolute right-0 top-0 bottom-0 z-30 flex-col overflow-hidden"
        style={{ width: selectedLot ? 360 : 0, transition: "width 0.3s cubic-bezier(0.4,0,0.2,1)", ...GLASS, borderLeft: "1px solid rgba(255,255,255,0.09)", borderRadius: 0 }}>
        {selectedLot && <LotDetailContent lot={selectedLot} />}
      </div>

      {/* Lot detail panel — mobile bottom sheet */}
      <div className="sm:hidden fixed inset-x-0 bottom-0 z-40 flex flex-col overflow-hidden"
        style={{
          maxHeight: "78vh",
          borderRadius: "20px 20px 0 0",
          transform: selectedLot ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.32s cubic-bezier(0.4,0,0.2,1)",
          background: "rgba(8,8,12,0.97)",
          backdropFilter: "blur(32px)",
          WebkitBackdropFilter: "blur(32px)",
          borderTop: "1px solid rgba(255,255,255,0.1)",
        }}>
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>
        {selectedLot && <LotDetailContent lot={selectedLot} />}
      </div>
      {isMobile && selectedLot && (
        <div className="sm:hidden fixed inset-0 z-30 bg-black/40" onClick={() => setSelectedLot(null)} />
      )}

      {/* Contact / Request Info modal */}
      {contactLot && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeContactModal} />
          <div className="relative w-full sm:max-w-md flex flex-col overflow-hidden"
            style={{ background: "rgba(10,10,16,0.97)", backdropFilter: "blur(32px)", WebkitBackdropFilter: "blur(32px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: isMobile ? "20px 20px 0 0" : 20 }}>
            <div className="sm:hidden flex justify-center pt-3 pb-0.5 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>
            <div className="flex items-start justify-between px-5 py-4 border-b border-white/8">
              <div>
                <h2 className="text-base font-bold text-white">Request Information</h2>
                <p className="text-xs text-white/40 mt-0.5">Lot {contactLot.lot_number}{community?.name ? ` · ${community.name}` : ""}</p>
              </div>
              <button onClick={closeContactModal} className="w-8 h-8 flex items-center justify-center rounded-xl text-white/30 hover:text-white hover:bg-white/8 transition-colors flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-5">
              {contactDone ? (
                <div className="flex flex-col items-center py-8 text-center">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
                    style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)" }}>
                    <svg className="w-7 h-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-base font-bold text-white mb-2">Message Sent!</h3>
                  <p className="text-sm text-white/45 leading-relaxed max-w-xs">{"We've received your inquiry and will be in touch shortly."}</p>
                  <button onClick={closeContactModal} className="mt-6 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors"
                    style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
                    Close
                  </button>
                </div>
              ) : (
                <form onSubmit={submitContact} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { field: "firstName" as const, label: "First Name", placeholder: "Jane", required: true },
                      { field: "lastName"  as const, label: "Last Name",  placeholder: "Smith", required: true },
                    ].map(({ field, label, placeholder, required }) => (
                      <div key={field}>
                        <label className="block text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-1.5">
                          {label} {required && <span className="text-red-400">*</span>}
                        </label>
                        <input required={required} type="text" value={contactForm[field]}
                          onChange={e => setContactForm(f => ({ ...f, [field]: e.target.value }))}
                          placeholder={placeholder}
                          className="w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-white/20 outline-none focus:ring-1 focus:ring-blue-500/50 transition-all"
                          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }} />
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-1.5">Email <span className="text-red-400">*</span></label>
                    <input required type="email" value={contactForm.email}
                      onChange={e => setContactForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="jane@example.com"
                      className="w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-white/20 outline-none focus:ring-1 focus:ring-blue-500/50 transition-all"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-1.5">Phone</label>
                    <input type="tel" value={contactForm.phone}
                      onChange={e => setContactForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="(555) 000-0000"
                      className="w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-white/20 outline-none focus:ring-1 focus:ring-blue-500/50 transition-all"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-white/35 uppercase tracking-wider mb-1.5">Message</label>
                    <textarea rows={3} value={contactForm.message}
                      onChange={e => setContactForm(f => ({ ...f, message: e.target.value }))}
                      placeholder="Any questions about this lot…"
                      className="w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-white/20 outline-none focus:ring-1 focus:ring-blue-500/50 transition-all resize-none"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }} />
                  </div>
                  {contactErr && <p className="text-xs text-red-400 text-center">{contactErr}</p>}
                  <button type="submit" disabled={contactBusy}
                    className="w-full py-3.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: "rgba(37,99,235,0.85)", border: "1px solid rgba(59,130,246,0.4)", boxShadow: "0 4px 20px rgba(37,99,235,0.3)" }}>
                    {contactBusy ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        Sending…
                      </span>
                    ) : "Send Request"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
