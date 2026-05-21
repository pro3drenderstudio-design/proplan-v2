"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getCommunityById } from "@/lib/admin-api";
import { CommunityWithLots, Lot, LotStatus, LotCta, MapSettings, FloorPlan } from "@/types/database";
import { getBuilderBySlug } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";
import QRModal, { QRLot } from "@/components/QRModal";

const LOT_COLORS: Record<LotStatus | "coming_soon", { fill: string; stroke: string; label: string }> = {
  available:   { fill: "rgba(34,197,94,0.25)",  stroke: "#22c55e",             label: "Available"   },
  reserved:    { fill: "rgba(251,191,36,0.25)", stroke: "#fbbf24",             label: "Reserved"    },
  sold:        { fill: "rgba(239,68,68,0.15)",  stroke: "rgba(239,68,68,0.7)", label: "Sold"        },
  coming_soon: { fill: "rgba(148,163,184,0.1)", stroke: "rgba(148,163,184,0.5)", label: "Coming Soon" },
};

const CTA_TYPES = [
  { value: "configurator", label: "3D Configurator" },
  { value: "external",     label: "External Link"   },
  { value: "contact",      label: "Lead Form"       },
  { value: "schedule",     label: "Schedule Tour"   },
] as const;

type DrawingPoint = [number, number];

function pointsToSvgPoly(points: DrawingPoint[], w: number, h: number) {
  return points.map(([x, y]) => `${(x / 100) * w},${(y / 100) * h}`).join(" ");
}

type LotFormState = {
  lot_number: string;
  status: LotStatus;
  floor_plan_id: string;
  price_modifier: string;
  notes: string;
  text_color: string;
  label_x: number | null;
  label_y: number | null;
  label_font_size: number;
  lot_size_sqft: string;
  lot_width_ft: string;
  lot_depth_ft: string;
  phase: string;
  estimated_completion: string;
  virtual_tour_url: string;
  is_coming_soon: boolean;
  ctas: LotCta[];
};

const DEFAULT_LOT_FORM: Omit<LotFormState, "lot_number"> = {
  status: "available",
  floor_plan_id: "",
  price_modifier: "0",
  notes: "",
  text_color: "#ffffff",
  label_x: null,
  label_y: null,
  label_font_size: 11,
  lot_size_sqft: "",
  lot_width_ft: "",
  lot_depth_ft: "",
  phase: "1",
  estimated_completion: "",
  virtual_tour_url: "",
  is_coming_soon: false,
  ctas: [{ type: "configurator", label: "" }],
};

export default function BuilderCommunityEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [community,   setCommunity]   = useState<CommunityWithLots | null>(null);
  const [floorPlans,  setFloorPlans]  = useState<FloorPlan[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [toast,       setToast]       = useState("");
  const [builderId,   setBuilderId]   = useState<string | null>(null);

  // Drawing
  const [isDrawing,      setIsDrawing]      = useState(false);
  const [drawingPoints,  setDrawingPoints]  = useState<DrawingPoint[]>([]);
  const [mousePos,       setMousePos]       = useState<DrawingPoint | null>(null);
  const [pendingPolygon, setPendingPolygon] = useState<DrawingPoint[] | null>(null);

  // Selection / editing
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);
  const [lotForm,     setLotForm]     = useState<LotFormState | null>(null);
  const [savingLot,   setSavingLot]   = useState(false);
  const [deletingLot, setDeletingLot] = useState(false);

  // Map settings
  const [mapSettingsOpen,   setMapSettingsOpen]   = useState(false);
  const [mapSettings,       setMapSettings]       = useState<MapSettings>({});
  const [savingMapSettings, setSavingMapSettings] = useState(false);
  const [applyToAll,        setApplyToAll]        = useState(false);

  // Community meta
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaForm,    setMetaForm]    = useState({
    name: "", slug: "", description: "",
    address: "", city: "", state: "", zip: "",
    latitude: "", longitude: "",
    hoa_fee_monthly: "", school_district: "",
  });
  const [savingMeta,  setSavingMeta]  = useState(false);

  // Mobile + map
  const [panelOpen,   setPanelOpen]   = useState(false);
  const [mapUploading, setMapUploading] = useState(false);
  const [svgSize,     setSvgSize]     = useState({ w: 0, h: 0 });
  const [mapZoom,     setMapZoom]     = useState(1);
  const [panOffset,   setPanOffset]   = useState({ x: 0, y: 0 });
  const [isDragging,  setIsDragging]  = useState(false);
  const mapRef       = useRef<HTMLDivElement>(null);
  const imgRef       = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const panStart     = useRef({ cx: 0, cy: 0, px: 0, py: 0 });
  const hasDragged       = useRef(false);
  const isDraggingLabel  = useRef(false);

  // Share & QR
  const [copiedShare, setCopiedShare] = useState<"url" | "embed" | null>(null);
  const [qrOpen,      setQrOpen]      = useState(false);
  const [lotQrOpen,   setLotQrOpen]   = useState<string | null>(null);
  const [builderLogo, setBuilderLogo] = useState<string | null>(null);
  const [accentColor, setAccentColor] = useState<string | null>(null);
  const [builderNameState, setBuilderNameState] = useState<string | null>(null);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  function handleMapWheel(e: React.WheelEvent) {
    e.preventDefault();
    setMapZoom(prev => Math.max(0.3, Math.min(4, prev * (e.deltaY < 0 ? 1.1 : 0.9))));
  }

  function handlePanStart(e: React.MouseEvent) {
    if (isDrawing) return;
    if ((e.target as HTMLElement).closest("[data-lot]")) return;
    hasDragged.current = false;
    setIsDragging(true);
    panStart.current = { cx: e.clientX, cy: e.clientY, px: panOffset.x, py: panOffset.y };
  }

  function handlePanMove(e: React.MouseEvent) {
    if (isDraggingLabel.current && mapRef.current) {
      const rect = mapRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
      setLotForm(f => f ? { ...f, label_x: x, label_y: y } : f);
      return;
    }
    if (!isDragging || isDrawing) return;
    const dx = e.clientX - panStart.current.cx;
    const dy = e.clientY - panStart.current.cy;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasDragged.current = true;
    setPanOffset({ x: panStart.current.px + dx, y: panStart.current.py + dy });
  }

  function handlePanEnd() {
    isDraggingLabel.current = false;
    setIsDragging(false);
    setTimeout(() => { hasDragged.current = false; }, 0);
  }

  function copyShareUrl() {
    if (!community?.slug || !community?.company_slug) return;
    const url = `${window.location.origin}/community/${community.company_slug}/${community.slug}`;
    navigator.clipboard.writeText(url).then(() => { setCopiedShare("url"); setTimeout(() => setCopiedShare(null), 2000); });
  }

  function copyEmbedCode() {
    if (!community?.slug || !community?.company_slug) return;
    const url = `${window.location.origin}/community/${community.company_slug}/${community.slug}`;
    const embed = `<iframe src="${url}" width="100%" height="700" frameborder="0" allowfullscreen style="border-radius:12px;"></iframe>`;
    navigator.clipboard.writeText(embed).then(() => { setCopiedShare("embed"); setTimeout(() => setCopiedShare(null), 2000); });
  }

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (supabase.from("profiles") as any).select("builder_id").eq("id", user?.id ?? "").single();
      const bid = profile?.builder_id;
      if (bid) setBuilderId(bid);

      const c = await getCommunityById(id);
      setCommunity(c);
      if (c) {
        setMetaForm({
          name: c.name, slug: c.slug, description: c.description ?? "",
          address: c.address ?? "", city: c.city ?? "", state: c.state ?? "", zip: c.zip ?? "",
          latitude: c.latitude != null ? String(c.latitude) : "",
          longitude: c.longitude != null ? String(c.longitude) : "",
          hoa_fee_monthly: c.hoa_fee_monthly != null ? String(c.hoa_fee_monthly / 100) : "",
          school_district: c.school_district ?? "",
        });
        if (c.map_settings) setMapSettings(c.map_settings);
        if (c.company_slug) {
          getBuilderBySlug(c.company_slug).then(b => {
            if (b) { setBuilderLogo(b.logo_url); setAccentColor(b.accent_color); setBuilderNameState(b.company_name); }
          });
        }
      }

      if (bid) {
        const fps = await fetch(`/api/builder/floor-plans?builderId=${bid}`).then(r => r.json()).catch(() => []);
        setFloorPlans(fps as FloorPlan[]);
      }

      setLoading(false);
    })();
  }, [id]);

  const updateSvgSize = useCallback(() => {
    if (imgRef.current) setSvgSize({ w: imgRef.current.clientWidth, h: imgRef.current.clientHeight });
  }, []);

  useEffect(() => {
    window.addEventListener("resize", updateSvgSize);
    return () => window.removeEventListener("resize", updateSvgSize);
  }, [updateSvgSize]);

  function getRelativePos(e: React.MouseEvent): DrawingPoint {
    const rect = mapRef.current!.getBoundingClientRect();
    return [((e.clientX - rect.left) / rect.width) * 100, ((e.clientY - rect.top) / rect.height) * 100];
  }

  function handleMapClick(e: React.MouseEvent) {
    if (!isDrawing) return;
    const pos = getRelativePos(e);
    if (drawingPoints.length >= 3) {
      const [fx, fy] = drawingPoints[0];
      if (Math.sqrt((pos[0] - fx) ** 2 + (pos[1] - fy) ** 2) < 2.5) { closePolygon(); return; }
    }
    setDrawingPoints(prev => [...prev, pos]);
  }

  function handleMapMouseMove(e: React.MouseEvent) {
    if (!isDrawing) return;
    setMousePos(getRelativePos(e));
  }

  function closePolygon() {
    if (drawingPoints.length < 3) return;
    setIsDrawing(false); setMousePos(null);
    setSelectedLot(null);
    setLotForm({
      lot_number: `Lot ${(community?.lots.length ?? 0) + 1}`,
      ...DEFAULT_LOT_FORM,
      text_color: mapSettings.default_label_color ?? "#ffffff",
      label_font_size: mapSettings.default_label_size ?? 11,
    });
    setPendingPolygon(drawingPoints);
    setDrawingPoints([]);
  }

  function cancelDraw() { setIsDrawing(false); setDrawingPoints([]); setMousePos(null); }

  function lotFormFromLot(lot: Lot): LotFormState {
    // Resolve CTAs: use new ctas array if non-empty, else convert legacy fields
    const resolvedCtas: LotCta[] = lot.ctas?.length
      ? lot.ctas
      : lot.cta_type && lot.cta_type !== "none"
        ? [{ type: lot.cta_type as LotCta["type"], label: lot.cta_label ?? "", url: lot.cta_url ?? undefined }]
        : [{ type: "configurator", label: "" }];

    return {
      lot_number:           lot.lot_number,
      status:               lot.status,
      floor_plan_id:        lot.floor_plan_id ?? "",
      price_modifier:       String(lot.price_modifier ?? 0),
      notes:                lot.notes ?? "",
      text_color:           lot.text_color ?? "#ffffff",
      label_x:              lot.label_x ?? null,
      label_y:              lot.label_y ?? null,
      label_font_size:      lot.label_font_size ?? 11,
      lot_size_sqft:        lot.lot_size_sqft != null ? String(lot.lot_size_sqft) : "",
      lot_width_ft:         lot.lot_width_ft  != null ? String(lot.lot_width_ft)  : "",
      lot_depth_ft:         lot.lot_depth_ft  != null ? String(lot.lot_depth_ft)  : "",
      phase:                String(lot.phase ?? 1),
      estimated_completion: lot.estimated_completion ?? "",
      virtual_tour_url:     lot.virtual_tour_url ?? "",
      is_coming_soon:       lot.is_coming_soon ?? false,
      ctas:                 resolvedCtas,
    };
  }

  function selectLot(lot: Lot) {
    if (isDrawing) return;
    setPendingPolygon(null);
    setSelectedLot(lot);
    setLotForm(lotFormFromLot(lot));
  }

  function buildLotPayload(form: LotFormState) {
    return {
      lot_number:           form.lot_number,
      status:               form.status,
      floor_plan_id:        form.floor_plan_id || null,
      price_modifier:       Number(form.price_modifier),
      notes:                form.notes || null,
      text_color:           form.text_color || null,
      label_x:              form.label_x,
      label_y:              form.label_y,
      label_font_size:      form.label_font_size,
      ctas:                 form.ctas.filter(c => c.type),
      lot_size_sqft:        form.lot_size_sqft  ? Number(form.lot_size_sqft)  : null,
      lot_width_ft:         form.lot_width_ft   ? Number(form.lot_width_ft)   : null,
      lot_depth_ft:         form.lot_depth_ft   ? Number(form.lot_depth_ft)   : null,
      phase:                Number(form.phase ?? 1),
      estimated_completion: form.estimated_completion || null,
      virtual_tour_url:     form.virtual_tour_url || null,
      is_coming_soon:       form.is_coming_soon,
    };
  }

  async function handleSaveLot() {
    if (!lotForm || !community) return;
    setSavingLot(true);
    const payload = buildLotPayload(lotForm);

    if (selectedLot) {
      const res = await fetch(`/api/communities/${community.id}/lots/${selectedLot.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setCommunity(prev => prev ? { ...prev, lots: prev.lots.map(l => l.id === selectedLot.id ? { ...l, ...payload } as Lot : l) } : null);
        showToast("Lot saved"); setSelectedLot(null); setLotForm(null);
      } else showToast("Save failed");
    } else if (pendingPolygon) {
      const res = await fetch(`/api/communities/${community.id}/lots`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, polygon: pendingPolygon }),
      });
      if (res.ok) {
        const newLot = await res.json() as Lot;
        setCommunity(prev => prev ? { ...prev, lots: [...prev.lots, newLot] } : null);
        showToast("Lot created"); setPendingPolygon(null); setLotForm(null);
      } else showToast("Create failed");
    }
    setSavingLot(false);
  }

  async function handleDeleteLot() {
    if (!selectedLot || !community) return;
    if (!confirm(`Delete ${selectedLot.lot_number}?`)) return;
    setDeletingLot(true);
    const res = await fetch(`/api/communities/${community.id}/lots/${selectedLot.id}`, { method: "DELETE" });
    if (res.ok) {
      setCommunity(prev => prev ? { ...prev, lots: prev.lots.filter(l => l.id !== selectedLot.id) } : null);
      showToast("Lot deleted"); setSelectedLot(null); setLotForm(null);
    } else showToast("Delete failed");
    setDeletingLot(false);
  }

  async function handleMapUpload(file: File) {
    if (!community) return;
    setMapUploading(true);
    const fd = new FormData(); fd.append("file", file);
    const res = await fetch(`/api/communities/${community.id}/site-map`, { method: "POST", body: fd });
    if (res.ok) {
      const { url } = await res.json() as { url: string };
      setCommunity(prev => prev ? { ...prev, site_map_url: url } : null);
      showToast("Site map uploaded");
    } else showToast("Upload failed");
    setMapUploading(false);
  }

  async function handleSaveMeta() {
    if (!community) return;
    setSavingMeta(true);
    const res = await fetch(`/api/communities/${community.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name:             metaForm.name,
        slug:             metaForm.slug,
        description:      metaForm.description || null,
        address:          metaForm.address || null,
        city:             metaForm.city || null,
        state:            metaForm.state || null,
        zip:              metaForm.zip || null,
        latitude:         metaForm.latitude  ? Number(metaForm.latitude)  : null,
        longitude:        metaForm.longitude ? Number(metaForm.longitude) : null,
        hoa_fee_monthly:  metaForm.hoa_fee_monthly ? Math.round(Number(metaForm.hoa_fee_monthly) * 100) : null,
        school_district:  metaForm.school_district || null,
      }),
    });
    if (res.ok) {
      setCommunity(prev => prev ? { ...prev,
        name: metaForm.name, slug: metaForm.slug, description: metaForm.description || null,
        address: metaForm.address || null, city: metaForm.city || null, state: metaForm.state || null, zip: metaForm.zip || null,
      } : null);
      setEditingMeta(false); showToast("Details saved");
    } else {
      const { error } = await res.json().catch(() => ({}));
      showToast(error ?? "Save failed");
    }
    setSavingMeta(false);
  }

  async function handleSaveMapSettings() {
    if (!community) return;
    setSavingMapSettings(true);
    const res = await fetch(`/api/communities/${community.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ map_settings: mapSettings }),
    });
    if (res.ok) {
      setCommunity(prev => prev ? { ...prev, map_settings: mapSettings } : null);
      if (applyToAll) {
        await fetch(`/api/communities/${community.id}/lots`, { method: "PATCH" });
        setCommunity(prev => prev ? { ...prev, lots: prev.lots.map(l => ({ ...l, text_color: null, label_font_size: null })) } : null);
        setApplyToAll(false);
      }
      showToast("Map settings saved");
    } else showToast("Save failed");
    setSavingMapSettings(false);
  }

  async function handleDeleteCommunity() {
    if (!community) return;
    if (!confirm(`Delete "${community.name}" and all ${community.lots.length} lots? This cannot be undone.`)) return;
    const res = await fetch(`/api/communities/${community.id}`, { method: "DELETE" });
    if (res.ok) router.push("/builder/communities");
    else showToast("Delete failed");
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!community) return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <p className="text-white/40 text-sm">Community not found.</p>
      <Link href="/builder/communities" className="text-xs text-blue-400 hover:underline">← My Communities</Link>
    </div>
  );

  const { w, h } = svgSize;
  const inputCls = "w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-blue-500/60 transition-colors";
  const labelCls = "block text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1.5";

  return (
    <div className="flex h-full overflow-hidden relative">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#111] border border-white/15 text-white text-sm px-4 py-2.5 rounded-xl shadow-2xl">
          {toast}
        </div>
      )}

      {/* ── Canvas ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-white/8 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 text-xs text-white/30">
            <Link href="/builder/communities" className="hover:text-white transition-colors">Communities</Link>
            <span>›</span>
            <span className="text-white/70 font-medium">{community.name}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setPanelOpen(v => !v)}
              className="md:hidden flex items-center gap-1.5 px-2.5 py-1.5 bg-white/6 border border-white/10 text-xs text-white/50 rounded-lg hover:text-white transition-colors">
              Lots
            </button>
            <div className="flex items-center gap-1 bg-white/4 border border-white/8 rounded-lg px-1 py-0.5">
              <button onClick={() => setMapZoom(v => Math.max(0.3, v - 0.1))} className="w-6 h-6 flex items-center justify-center text-white/40 hover:text-white transition-colors">−</button>
              <span className="text-[10px] text-white/35 w-9 text-center tabular-nums">{Math.round(mapZoom * 100)}%</span>
              <button onClick={() => setMapZoom(v => Math.min(4, v + 0.1))} className="w-6 h-6 flex items-center justify-center text-white/40 hover:text-white transition-colors">+</button>
              {(mapZoom !== 1 || panOffset.x !== 0 || panOffset.y !== 0) && (
                <button onClick={() => { setMapZoom(1); setPanOffset({ x: 0, y: 0 }); }} className="w-5 h-5 flex items-center justify-center text-white/25 hover:text-white/60 transition-colors ml-0.5">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
            {community.slug && community.company_slug && (
              <a href={`/community/${community.company_slug}/${community.slug}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 border border-white/12 text-xs text-white/50 rounded-lg hover:text-white hover:border-white/25 transition-colors">
                Preview →
              </a>
            )}
            {isDrawing ? (
              <>
                {drawingPoints.length >= 3 && (
                  <button onClick={closePolygon} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-xs text-white font-medium rounded-lg hover:bg-blue-500 transition-colors">
                    Close Shape
                  </button>
                )}
                <button onClick={cancelDraw} className="px-3 py-1.5 border border-white/12 text-xs text-white/40 rounded-lg hover:text-white transition-colors">Cancel</button>
              </>
            ) : (
              <button
                onClick={() => { hasDragged.current = false; setIsDrawing(true); setSelectedLot(null); setLotForm(null); setPendingPolygon(null); }}
                disabled={!community.site_map_url}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-xs text-white font-medium rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-40">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Draw Lot
              </button>
            )}
          </div>
        </div>

        {/* Map area */}
        <div className="flex-1 overflow-hidden flex items-center justify-center bg-[#0d0d0d] p-4"
          onWheel={handleMapWheel} onMouseDown={handlePanStart} onMouseMove={handlePanMove}
          onMouseUp={handlePanEnd} onMouseLeave={handlePanEnd}
          style={{ cursor: isDrawing ? "crosshair" : isDragging ? "grabbing" : "grab" }}>
          {community.site_map_url ? (
            <div ref={mapRef} className="relative max-w-full max-h-full"
              style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${mapZoom})`, transformOrigin: "center center", transition: isDragging ? "none" : "transform 0.1s ease" }}
              onClick={e => { if (isDrawing || !hasDragged.current) handleMapClick(e); }}
              onMouseMove={handleMapMouseMove}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img ref={imgRef} src={community.site_map_url} alt={community.name}
                className="block max-w-full max-h-[calc(100vh-12rem)] object-contain rounded-lg select-none"
                onLoad={updateSvgSize} draggable={false} />
              <svg className="absolute inset-0" width={w} height={h}
                style={{ pointerEvents: isDrawing ? "none" : "auto" }}>
                {community.lots.map(lot => {
                  const statusKey = lot.is_coming_soon ? "coming_soon" : lot.status;
                  const col = LOT_COLORS[statusKey] ?? LOT_COLORS.available;
                  const isSelected = selectedLot?.id === lot.id;
                  return (
                    <g key={lot.id} data-lot="true" style={{ pointerEvents: "all", cursor: "pointer" }}
                      onClick={e => { e.stopPropagation(); if (!hasDragged.current) selectLot(lot); }}>
                      <polygon points={pointsToSvgPoly(lot.polygon, w, h)}
                        fill={col.fill} stroke={isSelected ? "#fff" : col.stroke}
                        strokeWidth={isSelected ? 2 : (mapSettings.stroke_width ?? 1.5)}
                        strokeDasharray={isSelected || lot.is_coming_soon ? "5 3" : undefined} />
                      {mapSettings.show_labels !== false && lot.polygon.length >= 3 && (() => {
                        const centX = (lot.polygon.reduce((s, [x]) => s + x, 0) / lot.polygon.length / 100) * w;
                        const centY = (lot.polygon.reduce((s, [, y]) => s + y, 0) / lot.polygon.length / 100) * h;
                        const lx = (isSelected && lotForm?.label_x != null) ? (lotForm.label_x / 100) * w : (lot.label_x != null ? (lot.label_x / 100) * w : centX);
                        const ly = (isSelected && lotForm?.label_y != null) ? (lotForm.label_y / 100) * h : (lot.label_y != null ? (lot.label_y / 100) * h : centY);
                        const fs = isSelected ? (lotForm?.label_font_size ?? mapSettings.default_label_size ?? 11) : (lot.label_font_size ?? mapSettings.default_label_size ?? 11);
                        const fc = lot.text_color ?? mapSettings.default_label_color ?? "#ffffff";
                        return (
                          <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
                            fontSize={fs} fontWeight="600" fill={fc} fillOpacity={0.9}
                            style={{ cursor: isSelected ? "move" : "default", pointerEvents: isSelected ? "all" : "none", userSelect: "none" }}
                            onMouseDown={isSelected ? e => { e.stopPropagation(); isDraggingLabel.current = true; } : undefined}
                            onClick={isSelected ? e => e.stopPropagation() : undefined}>
                            {lot.lot_number}
                          </text>
                        );
                      })()}
                    </g>
                  );
                })}
                {pendingPolygon && pendingPolygon.length >= 3 && (
                  <polygon points={pointsToSvgPoly(pendingPolygon, w, h)} fill="rgba(59,130,246,0.25)" stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="5 3" />
                )}
                {isDrawing && drawingPoints.length > 0 && (
                  <g>
                    <polyline points={[...drawingPoints, ...(mousePos ? [mousePos] : [])].map(([x, y]) => `${(x / 100) * w},${(y / 100) * h}`).join(" ")}
                      fill="none" stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="5 3" />
                    {drawingPoints.map(([x, y], i) => (
                      <circle key={i} cx={(x / 100) * w} cy={(y / 100) * h} r={i === 0 ? 5 : 3}
                        fill={i === 0 ? "#3b82f6" : "white"} stroke={i === 0 ? "white" : "#3b82f6"} strokeWidth={1.5} />
                    ))}
                  </g>
                )}
              </svg>
            </div>
          ) : (
            <div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleMapUpload(f); e.target.value = ""; }} />
              <div onClick={() => !mapUploading && fileInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith("image/")) handleMapUpload(f); }}
                className="flex flex-col items-center justify-center gap-4 w-96 h-64 border-2 border-dashed border-white/15 rounded-2xl cursor-pointer hover:border-blue-500/40 hover:bg-blue-600/5 transition-colors">
                {mapUploading ? <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /> : (
                  <>
                    <svg className="w-12 h-12 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c-.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
                    </svg>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-white/40">Upload your site plan</p>
                      <p className="text-xs text-white/20 mt-1">Drop an image here or click to browse</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {community.site_map_url && (
          <div className="px-5 py-2.5 border-t border-white/8 flex items-center gap-3 flex-shrink-0">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleMapUpload(f); e.target.value = ""; }} />
            <button onClick={() => fileInputRef.current?.click()} disabled={mapUploading}
              className="text-xs text-white/30 hover:text-white/60 transition-colors disabled:opacity-40">
              {mapUploading ? "Uploading…" : "Replace site map image"}
            </button>
            <span className="text-white/10">·</span>
            <span className="text-xs text-white/20">Click lots to edit · "Draw Lot" to add new</span>
          </div>
        )}
      </div>

      {panelOpen && <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setPanelOpen(false)} />}

      {/* ── Sidebar ── */}
      <div className={[
        "flex-shrink-0 border-l border-white/8 bg-[#111] flex flex-col overflow-hidden",
        "fixed inset-y-0 right-0 z-50 w-80 transform transition-transform duration-300",
        "md:relative md:translate-x-0 md:z-auto md:inset-auto",
        panelOpen ? "translate-x-0" : "translate-x-full md:translate-x-0",
      ].join(" ")}>

        {lotForm ? (
          /* ── Lot Edit Form ── */
          <>
            <div className="px-4 py-3.5 border-b border-white/8 flex items-center justify-between flex-shrink-0">
              <p className="text-sm font-semibold text-white">{selectedLot ? "Edit Lot" : "New Lot"}</p>
              <button onClick={() => { setLotForm(null); setSelectedLot(null); setPendingPolygon(null); }}
                className="text-white/30 hover:text-white text-lg leading-none">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">

              {/* Lot number */}
              <div>
                <label className={labelCls}>Lot Number / Label</label>
                <input value={lotForm.lot_number} onChange={e => setLotForm(f => f && ({ ...f, lot_number: e.target.value }))} className={inputCls} />
              </div>

              {/* Status */}
              <div>
                <label className={labelCls}>Status</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["available", "reserved", "sold"] as LotStatus[]).map(s => {
                    const col = LOT_COLORS[s];
                    return (
                      <button key={s} onClick={() => setLotForm(f => f && ({ ...f, status: s, is_coming_soon: false }))}
                        className="py-1.5 rounded-lg text-[10px] font-semibold border transition-colors"
                        style={{ background: lotForm.status === s && !lotForm.is_coming_soon ? col.fill : "transparent", borderColor: lotForm.status === s && !lotForm.is_coming_soon ? col.stroke : "rgba(255,255,255,0.1)", color: lotForm.status === s && !lotForm.is_coming_soon ? col.stroke : "rgba(255,255,255,0.4)" }}>
                        {col.label}
                      </button>
                    );
                  })}
                  <button onClick={() => setLotForm(f => f && ({ ...f, is_coming_soon: !f.is_coming_soon }))}
                    className="py-1.5 rounded-lg text-[10px] font-semibold border transition-colors col-span-1"
                    style={{ background: lotForm.is_coming_soon ? LOT_COLORS.coming_soon.fill : "transparent", borderColor: lotForm.is_coming_soon ? LOT_COLORS.coming_soon.stroke : "rgba(255,255,255,0.1)", color: lotForm.is_coming_soon ? LOT_COLORS.coming_soon.stroke : "rgba(255,255,255,0.4)" }}>
                    Coming Soon
                  </button>
                </div>
              </div>

              {/* Floor Plan */}
              <div>
                <label className={labelCls}>Floor Plan</label>
                <select value={lotForm.floor_plan_id} onChange={e => setLotForm(f => f && ({ ...f, floor_plan_id: e.target.value }))} className={inputCls}>
                  <option value="">— None —</option>
                  {floorPlans.map(fp => <option key={fp.id} value={fp.id}>{fp.name}{fp.sqft ? ` · ${fp.sqft.toLocaleString()} sqft` : ""}</option>)}
                </select>
                {floorPlans.length === 0 && (
                  <p className="text-[10px] text-white/25 mt-1">
                    <Link href="/builder/floor-plans" className="text-blue-400/70 hover:text-blue-400">Create floor plans →</Link>
                  </p>
                )}
              </div>

              {/* Lot size */}
              <div>
                <label className={labelCls}>Lot Size</label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-3">
                    <input type="number" value={lotForm.lot_size_sqft} onChange={e => setLotForm(f => f && ({ ...f, lot_size_sqft: e.target.value }))}
                      placeholder="Total sqft" className={inputCls} />
                  </div>
                  <input type="number" value={lotForm.lot_width_ft} onChange={e => setLotForm(f => f && ({ ...f, lot_width_ft: e.target.value }))}
                    placeholder="Width (ft)" className={inputCls} />
                  <span className="flex items-center justify-center text-white/30 text-sm">×</span>
                  <input type="number" value={lotForm.lot_depth_ft} onChange={e => setLotForm(f => f && ({ ...f, lot_depth_ft: e.target.value }))}
                    placeholder="Depth (ft)" className={inputCls} />
                </div>
              </div>

              {/* Phase + Completion */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Phase</label>
                  <input type="number" min={1} value={lotForm.phase} onChange={e => setLotForm(f => f && ({ ...f, phase: e.target.value }))} className={inputCls} placeholder="1" />
                </div>
                <div>
                  <label className={labelCls}>Est. Completion</label>
                  <input type="date" value={lotForm.estimated_completion} onChange={e => setLotForm(f => f && ({ ...f, estimated_completion: e.target.value }))} className={inputCls} />
                </div>
              </div>

              {/* Price modifier */}
              <div>
                <label className={labelCls}>Lot Premium / Discount ($)</label>
                <input type="number" value={lotForm.price_modifier} onChange={e => setLotForm(f => f && ({ ...f, price_modifier: e.target.value }))} className={inputCls} placeholder="0" />
                <p className="text-[10px] text-white/25 mt-1">Added to the floor plan's base price</p>
              </div>

              {/* Virtual Tour */}
              <div>
                <label className={labelCls}>Virtual Tour URL</label>
                <input type="url" value={lotForm.virtual_tour_url} onChange={e => setLotForm(f => f && ({ ...f, virtual_tour_url: e.target.value }))}
                  placeholder="https://my.matterport.com/…" className={inputCls} />
              </div>

              {/* Notes */}
              <div>
                <label className={labelCls}>Notes</label>
                <textarea value={lotForm.notes} onChange={e => setLotForm(f => f && ({ ...f, notes: e.target.value }))}
                  rows={2} className={`${inputCls} resize-none`} />
              </div>

              {/* ── CTAs (up to 3) ── */}
              <div className="pt-2 border-t border-white/8 space-y-3">
                <div className="flex items-center justify-between">
                  <label className={`${labelCls} mb-0`}>Calls to Action</label>
                  {lotForm.ctas.length < 3 && (
                    <button onClick={() => setLotForm(f => f && ({ ...f, ctas: [...f.ctas, { type: "contact", label: "" }] }))}
                      className="text-[10px] text-blue-400/70 hover:text-blue-400 transition-colors">+ Add CTA</button>
                  )}
                </div>
                {lotForm.ctas.map((cta, idx) => (
                  <div key={idx} className="bg-[#1a1a1a] border border-white/8 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">
                        {idx === 0 ? "Primary" : idx === 1 ? "Secondary" : "Tertiary"}
                      </span>
                      {idx > 0 && (
                        <button onClick={() => setLotForm(f => f && ({ ...f, ctas: f.ctas.filter((_, i) => i !== idx) }))}
                          className="text-white/25 hover:text-red-400 transition-colors text-xs">Remove</button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {CTA_TYPES.map(ct => (
                        <button key={ct.value}
                          onClick={() => setLotForm(f => f && ({ ...f, ctas: f.ctas.map((c, i) => i === idx ? { ...c, type: ct.value } : c) }))}
                          className={`py-1 px-2 rounded-lg text-[10px] font-semibold border transition-colors text-left
                            ${cta.type === ct.value ? "bg-blue-600/20 border-blue-500/50 text-blue-300" : "bg-white/4 border-white/10 text-white/40 hover:text-white/60"}`}>
                          {ct.label}
                        </button>
                      ))}
                    </div>
                    <input value={cta.label}
                      onChange={e => setLotForm(f => f && ({ ...f, ctas: f.ctas.map((c, i) => i === idx ? { ...c, label: e.target.value } : c) }))}
                      placeholder={
                        cta.type === "configurator" ? "Configure this home" :
                        cta.type === "contact"      ? "Request Info" :
                        cta.type === "schedule"     ? "Schedule a Tour" :
                        "Button label"
                      }
                      className={inputCls} />
                    {(cta.type === "external" || cta.type === "schedule") && (
                      <input value={cta.url ?? ""}
                        onChange={e => setLotForm(f => f && ({ ...f, ctas: f.ctas.map((c, i) => i === idx ? { ...c, url: e.target.value } : c) }))}
                        placeholder="https://…" type="url" className={inputCls} />
                    )}
                  </div>
                ))}
              </div>

              {/* Label styling */}
              <div className="pt-2 border-t border-white/8 space-y-3">
                <label className={labelCls}>Label Color</label>
                <div className="flex items-center gap-2">
                  {["#ffffff", "#000000", "#1a1a1a", "#fbbf24", "#f87171", "#34d399"].map(c => (
                    <button key={c} onClick={() => setLotForm(f => f && ({ ...f, text_color: c }))}
                      className="w-6 h-6 rounded-full border-2 transition-all flex-shrink-0"
                      style={{ background: c, borderColor: lotForm.text_color === c ? "#60a5fa" : "rgba(255,255,255,0.15)", boxShadow: lotForm.text_color === c ? "0 0 0 2px #1d4ed8" : "none" }} />
                  ))}
                  <label className="w-6 h-6 rounded-full border border-white/15 overflow-hidden cursor-pointer flex-shrink-0 relative">
                    <input type="color" value={lotForm.text_color ?? "#ffffff"}
                      onChange={e => setLotForm(f => f && ({ ...f, text_color: e.target.value }))}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    <div className="w-full h-full" style={{ background: lotForm.text_color ?? "#ffffff" }} />
                  </label>
                </div>
                <div>
                  <label className={labelCls}>Label Size</label>
                  <div className="flex items-center gap-3">
                    <input type="range" min={7} max={30} step={1} value={lotForm.label_font_size}
                      onChange={e => setLotForm(f => f && ({ ...f, label_font_size: Number(e.target.value) }))}
                      className="flex-1 accent-blue-500" />
                    <span className="text-xs tabular-nums text-white/50 w-5 text-right">{lotForm.label_font_size}</span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className={`${labelCls} mb-0`}>Label Position</label>
                    {lotForm.label_x != null && (
                      <button onClick={() => setLotForm(f => f && ({ ...f, label_x: null, label_y: null }))}
                        className="text-[10px] text-blue-400/60 hover:text-blue-400 transition-colors">Reset</button>
                    )}
                  </div>
                  <p className="text-[10px] text-white/20">Drag the label on the map to reposition</p>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-white/8 space-y-2 flex-shrink-0">
              <button onClick={handleSaveLot} disabled={savingLot}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm text-white font-semibold transition-colors disabled:opacity-50">
                {savingLot ? "Saving…" : selectedLot ? "Save Changes" : "Create Lot"}
              </button>
              {selectedLot && (
                <button onClick={handleDeleteLot} disabled={deletingLot}
                  className="w-full py-2 rounded-xl border border-red-500/20 text-red-400/70 hover:text-red-400 hover:border-red-500/40 text-sm transition-colors disabled:opacity-40">
                  {deletingLot ? "Deleting…" : "Delete Lot"}
                </button>
              )}
            </div>
          </>
        ) : (
          /* ── Info / Lots List ── */
          <>
            {/* Community details */}
            <div className="border-b border-white/8 flex-shrink-0">
              <div className="px-4 py-3.5 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{community.name}</p>
                  <p className="text-xs text-white/30 mt-0.5">{community.lots.length} lots defined</p>
                  {(community.city || community.state) && (
                    <p className="text-[10px] text-white/25 mt-0.5">{[community.city, community.state].filter(Boolean).join(", ")}</p>
                  )}
                </div>
                <button onClick={() => { setEditingMeta(v => !v); setMetaForm({ name: community.name, slug: community.slug, description: community.description ?? "", address: community.address ?? "", city: community.city ?? "", state: community.state ?? "", zip: community.zip ?? "", latitude: community.latitude != null ? String(community.latitude) : "", longitude: community.longitude != null ? String(community.longitude) : "", hoa_fee_monthly: community.hoa_fee_monthly != null ? String(community.hoa_fee_monthly / 100) : "", school_district: community.school_district ?? "" }); }}
                  className="ml-2 flex-shrink-0 text-[10px] px-2 py-1 rounded-lg border border-white/12 text-white/35 hover:text-white hover:border-white/25 transition-colors">
                  {editingMeta ? "Cancel" : "Edit"}
                </button>
              </div>

              {editingMeta && (
                <div className="px-4 pb-4 space-y-3">
                  {[
                    { k: "name",        label: "Name",        placeholder: "Oakwood Estates" },
                    { k: "slug",        label: "URL Slug",    placeholder: "oakwood-estates", mono: true },
                    { k: "description", label: "Description", placeholder: "Brief overview…", area: true },
                    { k: "address",     label: "Street Address", placeholder: "123 Oak Ln" },
                  ].map(({ k, label, placeholder, mono, area }) => (
                    <div key={k}>
                      <label className={labelCls}>{label}</label>
                      {area ? (
                        <textarea value={(metaForm as Record<string, string>)[k]} onChange={e => setMetaForm(f => ({ ...f, [k]: e.target.value }))}
                          rows={2} placeholder={placeholder} className={`${inputCls} resize-none`} />
                      ) : (
                        <input value={(metaForm as Record<string, string>)[k]} onChange={e => setMetaForm(f => ({ ...f, [k]: e.target.value }))}
                          placeholder={placeholder} className={`${inputCls}${mono ? " font-mono text-xs" : ""}`} />
                      )}
                    </div>
                  ))}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className={labelCls}>City</label>
                      <input value={metaForm.city} onChange={e => setMetaForm(f => ({ ...f, city: e.target.value }))} placeholder="Austin" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>State</label>
                      <input value={metaForm.state} onChange={e => setMetaForm(f => ({ ...f, state: e.target.value }))} placeholder="TX" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>ZIP</label>
                      <input value={metaForm.zip} onChange={e => setMetaForm(f => ({ ...f, zip: e.target.value }))} placeholder="78701" className={inputCls} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>Latitude</label>
                      <input type="number" step="any" value={metaForm.latitude} onChange={e => setMetaForm(f => ({ ...f, latitude: e.target.value }))} placeholder="30.2672" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Longitude</label>
                      <input type="number" step="any" value={metaForm.longitude} onChange={e => setMetaForm(f => ({ ...f, longitude: e.target.value }))} placeholder="-97.7431" className={inputCls} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>HOA / Month ($)</label>
                      <input type="number" value={metaForm.hoa_fee_monthly} onChange={e => setMetaForm(f => ({ ...f, hoa_fee_monthly: e.target.value }))} placeholder="150" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>School District</label>
                      <input value={metaForm.school_district} onChange={e => setMetaForm(f => ({ ...f, school_district: e.target.value }))} placeholder="Austin ISD" className={inputCls} />
                    </div>
                  </div>
                  <button onClick={handleSaveMeta} disabled={savingMeta || !metaForm.name || !metaForm.slug}
                    className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs text-white font-semibold transition-colors disabled:opacity-50">
                    {savingMeta ? "Saving…" : "Save Details"}
                  </button>
                </div>
              )}
            </div>

            {/* Map Settings */}
            <div className="border-b border-white/8">
              <button onClick={() => setMapSettingsOpen(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/4 transition-colors">
                <span className="text-xs font-semibold text-white/50">Map Settings</span>
                <svg className={`w-3.5 h-3.5 text-white/25 transition-transform ${mapSettingsOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {mapSettingsOpen && (
                <div className="px-4 pb-4 space-y-4">
                  <div>
                    <label className={labelCls}>Default Label Color</label>
                    <div className="flex items-center gap-2">
                      {["#ffffff", "#000000", "#1a1a1a", "#fbbf24", "#f87171", "#34d399"].map(c => (
                        <button key={c} onClick={() => setMapSettings(s => ({ ...s, default_label_color: c }))}
                          className="w-5 h-5 rounded-full border-2 flex-shrink-0 transition-all"
                          style={{ background: c, borderColor: mapSettings.default_label_color === c ? "#60a5fa" : "rgba(255,255,255,0.15)" }} />
                      ))}
                      <label className="w-5 h-5 rounded-full border border-white/15 overflow-hidden cursor-pointer flex-shrink-0 relative">
                        <input type="color" value={mapSettings.default_label_color ?? "#ffffff"}
                          onChange={e => setMapSettings(s => ({ ...s, default_label_color: e.target.value }))}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                        <div className="w-full h-full" style={{ background: mapSettings.default_label_color ?? "#ffffff" }} />
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Default Label Size</label>
                    <div className="flex items-center gap-3">
                      <input type="range" min={7} max={30} step={1} value={mapSettings.default_label_size ?? 11}
                        onChange={e => setMapSettings(s => ({ ...s, default_label_size: Number(e.target.value) }))} className="flex-1 accent-blue-500" />
                      <span className="text-xs tabular-nums text-white/50 w-5 text-right">{mapSettings.default_label_size ?? 11}</span>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Stroke Width</label>
                    <div className="flex gap-1.5">
                      {[1, 1.5, 2, 3].map(sw => (
                        <button key={sw} onClick={() => setMapSettings(s => ({ ...s, stroke_width: sw }))}
                          className="flex-1 py-1 rounded text-[10px] font-medium border transition-colors"
                          style={{ background: (mapSettings.stroke_width ?? 1.5) === sw ? "rgba(59,130,246,0.2)" : "transparent", borderColor: (mapSettings.stroke_width ?? 1.5) === sw ? "rgba(59,130,246,0.6)" : "rgba(255,255,255,0.1)", color: (mapSettings.stroke_width ?? 1.5) === sw ? "#60a5fa" : "rgba(255,255,255,0.4)" }}>
                          {sw}px
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-white/25">Show Labels</p>
                    <button onClick={() => setMapSettings(s => ({ ...s, show_labels: s.show_labels === false ? true : false }))}
                      className={`w-9 h-5 rounded-full border transition-colors relative flex-shrink-0 ${mapSettings.show_labels === false ? "bg-white/8 border-white/15" : "bg-blue-600 border-blue-500"}`}>
                      <span className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-all ${mapSettings.show_labels === false ? "left-0.5" : "left-4"}`} />
                    </button>
                  </div>
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <div className={`w-4 h-4 rounded border flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors ${applyToAll ? "bg-amber-500 border-amber-400" : "bg-transparent border-white/20"}`}
                      onClick={() => setApplyToAll(v => !v)}>
                      {applyToAll && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <div onClick={() => setApplyToAll(v => !v)}>
                      <p className="text-[10px] font-medium text-white/60">Apply to all lots</p>
                      <p className="text-[9px] text-white/25 mt-0.5">Overwrite per-lot color &amp; size on save</p>
                    </div>
                  </label>
                  <button onClick={handleSaveMapSettings} disabled={savingMapSettings}
                    className={`w-full py-2 rounded-lg border text-xs transition-colors disabled:opacity-40 ${applyToAll ? "bg-amber-500/15 border-amber-400/40 text-amber-300" : "bg-white/6 hover:bg-white/10 border-white/8 text-white/60 hover:text-white"}`}>
                    {savingMapSettings ? "Saving…" : applyToAll ? "Save & Apply to All" : "Save Map Settings"}
                  </button>
                </div>
              )}
            </div>

            {/* Lots list */}
            <div className="flex-1 overflow-y-auto p-4">
              {community.lots.length === 0 ? (
                <p className="text-xs text-white/25 text-center py-8">No lots yet. Upload a site plan then click "Draw Lot".</p>
              ) : (
                <div className="space-y-1.5">
                  {community.lots.map(lot => {
                    const statusKey = lot.is_coming_soon ? "coming_soon" : lot.status;
                    const col = LOT_COLORS[statusKey] ?? LOT_COLORS.available;
                    const fp  = floorPlans.find(p => p.id === lot.floor_plan_id);
                    const configuratorUrl = fp?.project_id && community.company_slug
                      ? `${window.location.origin}/project/${community.company_slug}/${fp.project_id}?lotId=${lot.id}&lotNumber=${encodeURIComponent(lot.lot_number)}&communitySlug=${community.slug}&communityName=${encodeURIComponent(community.name)}&lotPriceModifier=${lot.price_modifier ?? 0}&utm_source=qr`
                      : null;
                    const lotPageUrl = community.company_slug && community.slug
                      ? `${window.location.origin}/community/${community.company_slug}/${community.slug}?lot=${lot.id}&utm_source=qr`
                      : null;
                    const qrUrl = configuratorUrl ?? lotPageUrl;
                    return (
                      <div key={lot.id} className="flex items-center gap-1">
                        <button onClick={() => selectLot(lot)}
                          className="flex-1 flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/4 hover:bg-white/8 transition-colors text-left border border-transparent hover:border-white/8">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col.stroke }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-white/80">{lot.lot_number}</p>
                            <p className="text-[10px] text-white/30 truncate">
                              {fp?.name ?? "No floor plan"}{lot.phase > 1 ? ` · Phase ${lot.phase}` : ""}
                            </p>
                          </div>
                          <span className="text-[10px] font-medium flex-shrink-0" style={{ color: col.stroke }}>{col.label}</span>
                        </button>
                        {qrUrl && (
                          <button onClick={e => { e.stopPropagation(); setLotQrOpen(lot.id); }}
                            className="flex-shrink-0 w-7 h-7 rounded-md bg-white/4 hover:bg-white/10 border border-white/8 flex items-center justify-center transition-colors" title="Yard Sign QR">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 text-white/40">
                              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
                              <path strokeLinecap="round" d="M14 14h2m3 0h1M14 17h1m2 0h2M14 20h3m2 0h1"/>
                            </svg>
                          </button>
                        )}
                        {lotQrOpen === lot.id && qrUrl && (
                          <QRModal url={qrUrl} label={`Lot ${lot.lot_number}`} sublabel={fp?.name ?? community.name}
                            builderLogo={builderLogo} accentColor={accentColor} builderName={builderNameState}
                            thumbnailUrl={fp?.thumbnail_url ?? null} onClose={() => setLotQrOpen(null)} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Share & Publish */}
            {community.slug && community.company_slug && (
              <div className="border-t border-white/8 p-4 flex-shrink-0 space-y-2">
                <p className={`${labelCls} mb-3`}>Share & Publish</p>
                {[
                  { id: "url",   label: "Copy Site Map URL",  icon: "copy" },
                  { id: "embed", label: "Copy Embed Code",    icon: "code" },
                ].map(({ id, label }) => (
                  <button key={id} onClick={id === "url" ? copyShareUrl : copyEmbedCode}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-white/4 border border-white/8 hover:bg-white/8 hover:border-white/14 transition-colors text-left">
                    <span className="text-xs font-medium text-white/60">{copiedShare === id ? "Copied!" : label}</span>
                    {copiedShare === id
                      ? <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      : <svg className="w-3.5 h-3.5 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    }
                  </button>
                ))}
                <button onClick={() => setQrOpen(true)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-white/4 border border-white/8 hover:bg-violet-600/12 hover:border-violet-500/30 transition-colors text-left">
                  <span className="text-xs font-medium text-white/60">QR Code &amp; Yard Signs</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 text-white/30">
                    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
                    <path strokeLinecap="round" d="M14 14h2m3 0h1M14 17h1m2 0h2M14 20h3m2 0h1"/>
                  </svg>
                </button>
              </div>
            )}

            {/* Delete community */}
            <div className="border-t border-white/8 px-4 py-3 flex-shrink-0">
              <button onClick={handleDeleteCommunity}
                className="w-full py-2 rounded-lg border border-red-500/20 text-red-400/50 hover:text-red-400 hover:border-red-500/40 text-xs transition-colors">
                Delete Community
              </button>
            </div>

            {qrOpen && community.slug && community.company_slug && (() => {
              const communityUrl = `${window.location.origin}/community/${community.company_slug}/${community.slug}?utm_source=qr`;
              const lotItems = community.lots.filter(l => {
                const fp = floorPlans.find(p => p.id === l.floor_plan_id);
                return fp?.project_id && community.company_slug;
              }).map(l => {
                const fp = floorPlans.find(p => p.id === l.floor_plan_id)!;
                return { id: l.id, lot_number: l.lot_number, url: `${window.location.origin}/project/${community.company_slug}/${fp.project_id}?lotId=${l.id}&lotNumber=${encodeURIComponent(l.lot_number)}&communitySlug=${community.slug}&communityName=${encodeURIComponent(community.name)}&lotPriceModifier=${l.price_modifier ?? 0}&utm_source=qr`, sublabel: fp.name, thumbnailUrl: fp.thumbnail_url ?? null } as QRLot;
              });
              return (
                <QRModal url={communityUrl} label={community.name} builderLogo={builderLogo}
                  accentColor={accentColor} builderName={builderNameState}
                  thumbnailUrl={lotItems[0]?.thumbnailUrl ?? null}
                  lots={lotItems.length > 0 ? lotItems : undefined} onClose={() => setQrOpen(false)} />
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}
