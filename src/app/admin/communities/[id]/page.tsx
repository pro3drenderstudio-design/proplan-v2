"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getCommunityById, getAllProjects, getAllBuildersBySlug } from "@/lib/admin-api";
import { CommunityWithLots, Lot, LotStatus, MapSettings, Project, Builder } from "@/types/database";
import QRModal, { QRLot } from "@/components/QRModal";

const LOT_COLORS: Record<LotStatus, { fill: string; stroke: string; label: string }> = {
  available: { fill: "rgba(34,197,94,0.25)",  stroke: "#22c55e", label: "Available" },
  reserved:  { fill: "rgba(251,191,36,0.25)", stroke: "#fbbf24", label: "Reserved"  },
  sold:      { fill: "rgba(239,68,68,0.15)",   stroke: "rgba(239,68,68,0.7)",   label: "Sold" },
};

type DrawingPoint = [number, number];

function pointsToSvgPoly(points: DrawingPoint[], w: number, h: number) {
  return points.map(([x, y]) => `${(x / 100) * w},${(y / 100) * h}`).join(" ");
}

export default function CommunityEditorPage() {
  const { id } = useParams<{ id: string }>();

  const [community,   setCommunity]   = useState<CommunityWithLots | null>(null);
  const [projects,    setProjects]    = useState<Project[]>([]);
  const [builders,    setBuilders]    = useState<Record<string, Builder>>({});
  const [loading,     setLoading]     = useState(true);
  const [toast,       setToast]       = useState("");

  // Community metadata editing
  const [editingMeta,  setEditingMeta]  = useState(false);
  const [metaForm,     setMetaForm]     = useState({ name: "", slug: "", description: "", company_slug: "" });
  const [savingMeta,   setSavingMeta]   = useState(false);

  // Drawing state
  const [isDrawing,      setIsDrawing]      = useState(false);
  const [drawingPoints,  setDrawingPoints]  = useState<DrawingPoint[]>([]);
  const [mousePos,       setMousePos]       = useState<DrawingPoint | null>(null);

  // Selection / editing
  const [selectedLot,    setSelectedLot]    = useState<Lot | null>(null);
  const [lotForm,        setLotForm]        = useState<{ lot_number: string; status: LotStatus; project_id: string; price_modifier: string; notes: string; text_color: string; label_x: number | null; label_y: number | null; label_font_size: number; cta_type: "configurator" | "external" | "contact" | "none"; cta_label: string; cta_url: string } | null>(null);
  const [savingLot,      setSavingLot]      = useState(false);
  const [deletingLot,    setDeletingLot]    = useState(false);

  // Vertex drag editing
  const [editingVerticesLotId, setEditingVerticesLotId] = useState<string | null>(null);
  const [editedPolygon,        setEditedPolygon]        = useState<DrawingPoint[]>([]);
  const [draggingVertex,       setDraggingVertex]       = useState<number | null>(null);
  const [savingVertices,       setSavingVertices]       = useState(false);

  // Mobile panel
  const [panelOpen, setPanelOpen] = useState(false);

  // Map settings
  const [mapSettingsOpen,   setMapSettingsOpen]   = useState(false);
  const [mapSettings,       setMapSettings]       = useState<MapSettings>({});
  const [savingMapSettings, setSavingMapSettings] = useState(false);
  const [applyToAll,        setApplyToAll]        = useState(false);

  // Site map upload
  const [mapUploading,   setMapUploading]   = useState(false);
  const [svgSize,        setSvgSize]        = useState({ w: 0, h: 0 });
  const [mapZoom,        setMapZoom]        = useState(1);
  const [panOffset,      setPanOffset]      = useState({ x: 0, y: 0 });
  const [isDragging,     setIsDragging]     = useState(false);
  const mapRef       = useRef<HTMLDivElement>(null);
  const imgRef       = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapAreaRef   = useRef<HTMLDivElement>(null);
  const panStart     = useRef({ cx: 0, cy: 0, px: 0, py: 0 });
  const hasDragged       = useRef(false);
  const isDraggingLabel  = useRef(false);

  function handleMapWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1.1 : 0.9;
    setMapZoom(prev => Math.max(0.3, Math.min(4, prev * delta)));
  }

  function handlePanStart(e: React.MouseEvent) {
    if (isDrawing) return;
    if ((e.target as HTMLElement).closest("[data-lot]")) return; // don't pan when clicking a lot
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

  // Share & Publish
  const [copiedShare, setCopiedShare] = useState<"url" | "embed" | null>(null);
  const [qrOpen,    setQrOpen]    = useState(false);
  const [lotQrOpen, setLotQrOpen] = useState<string | null>(null);

  function copyShareUrl() {
    if (!community?.slug || !community?.company_slug) return;
    const url = `${window.location.origin}/community/${community.company_slug}/${community.slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedShare("url");
      setTimeout(() => setCopiedShare(null), 2000);
    });
  }

  function copyEmbedCode() {
    if (!community?.slug || !community?.company_slug) return;
    const url = `${window.location.origin}/community/${community.company_slug}/${community.slug}`;
    const embed = `<iframe src="${url}" width="100%" height="700" frameborder="0" allowfullscreen style="border-radius:12px;"></iframe>`;
    navigator.clipboard.writeText(embed).then(() => {
      setCopiedShare("embed");
      setTimeout(() => setCopiedShare(null), 2000);
    });
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  useEffect(() => {
    Promise.all([getCommunityById(id), getAllProjects(), getAllBuildersBySlug()]).then(([c, p, b]) => {
      setCommunity(c);
      setProjects(p.filter(proj => proj.status === "live" || proj.status === "in_development"));
      setBuilders(b);
      if (c) {
        setMetaForm({ name: c.name, slug: c.slug, description: c.description ?? "", company_slug: c.company_slug ?? "" });
        if (c.map_settings) setMapSettings(c.map_settings);
      }
      setLoading(false);
    });
  }, [id]);

  // Keep SVG overlay in sync with rendered image size
  const updateSvgSize = useCallback(() => {
    if (imgRef.current) {
      setSvgSize({ w: imgRef.current.clientWidth, h: imgRef.current.clientHeight });
    }
  }, []);

  useEffect(() => {
    window.addEventListener("resize", updateSvgSize);
    return () => window.removeEventListener("resize", updateSvgSize);
  }, [updateSvgSize]);

  // ── Map interaction ──────────────────────────────────────────────────────────

  function getRelativePos(e: React.MouseEvent): DrawingPoint {
    const rect = mapRef.current!.getBoundingClientRect();
    return [
      ((e.clientX - rect.left) / rect.width)  * 100,
      ((e.clientY - rect.top)  / rect.height) * 100,
    ];
  }

  function handleMapClick(e: React.MouseEvent) {
    if (!isDrawing) return;
    const pos = getRelativePos(e);

    // Close polygon if clicking within 2.5% of first point (and have 3+ points)
    if (drawingPoints.length >= 3) {
      const [fx, fy] = drawingPoints[0];
      const dist = Math.sqrt((pos[0] - fx) ** 2 + (pos[1] - fy) ** 2);
      if (dist < 2.5) { closePolygon(); return; }
    }
    setDrawingPoints(prev => [...prev, pos]);
  }

  function handleMapMouseMove(e: React.MouseEvent) {
    if (!isDrawing) return;
    setMousePos(getRelativePos(e));
  }

  function closePolygon() {
    if (drawingPoints.length < 3) return;
    setIsDrawing(false);
    setMousePos(null);
    // Open the lot form for this new polygon
    setSelectedLot(null);
    setLotForm({ lot_number: `Lot ${(community?.lots.length ?? 0) + 1}`, status: "available", project_id: "", price_modifier: "0", notes: "", text_color: mapSettings.default_label_color ?? "#ffffff", label_x: null, label_y: null, label_font_size: mapSettings.default_label_size ?? 11, cta_type: "configurator", cta_label: "", cta_url: "" });
    // Store drawing points for save
    setPendingPolygon(drawingPoints);
    setDrawingPoints([]);
  }

  const [pendingPolygon, setPendingPolygon] = useState<DrawingPoint[] | null>(null);

  function cancelDraw() {
    setIsDrawing(false);
    setDrawingPoints([]);
    setMousePos(null);
  }

  // ── Lot selection ────────────────────────────────────────────────────────────

  function selectLot(lot: Lot) {
    if (isDrawing) return;
    setPendingPolygon(null);
    setSelectedLot(lot);
    setLotForm({
      lot_number:      lot.lot_number,
      status:          lot.status,
      project_id:      lot.project_id ?? "",
      price_modifier:  String(lot.price_modifier ?? 0),
      notes:           lot.notes ?? "",
      text_color:      lot.text_color ?? "#ffffff",
      label_x:         lot.label_x ?? null,
      label_y:         lot.label_y ?? null,
      label_font_size: lot.label_font_size ?? 11,
      cta_type:        (lot as Lot & { cta_type?: string }).cta_type as "configurator" | "external" | "contact" | "none" ?? "configurator",
      cta_label:       (lot as Lot & { cta_label?: string }).cta_label ?? "",
      cta_url:         (lot as Lot & { cta_url?: string }).cta_url ?? "",
    });
  }

  // ── Save lot ─────────────────────────────────────────────────────────────────

  async function handleSaveLot() {
    if (!lotForm || !community) return;
    setSavingLot(true);

    if (selectedLot) {
      // Update existing lot
      const res = await fetch(`/api/communities/${community.id}/lots/${selectedLot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lot_number:      lotForm.lot_number,
          status:          lotForm.status,
          project_id:      lotForm.project_id || null,
          price_modifier:  Number(lotForm.price_modifier),
          notes:           lotForm.notes || null,
          text_color:      lotForm.text_color || null,
          label_x:         lotForm.label_x,
          label_y:         lotForm.label_y,
          label_font_size: lotForm.label_font_size,
          cta_type:        lotForm.cta_type,
          cta_label:       lotForm.cta_label || null,
          cta_url:         lotForm.cta_url || null,
        }),
      });
      if (res.ok) {
        setCommunity(prev => prev ? {
          ...prev,
          lots: prev.lots.map(l => l.id === selectedLot.id
            ? { ...l, ...lotForm, project_id: lotForm.project_id || null, price_modifier: Number(lotForm.price_modifier) }
            : l),
        } : null);
        showToast("Lot saved");
        setSelectedLot(null);
        setLotForm(null);
      } else {
        showToast("Save failed");
      }
    } else if (pendingPolygon) {
      // Create new lot
      const res = await fetch(`/api/communities/${community.id}/lots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lot_number:      lotForm.lot_number,
          polygon:         pendingPolygon,
          status:          lotForm.status,
          project_id:      lotForm.project_id || null,
          price_modifier:  Number(lotForm.price_modifier),
          notes:           lotForm.notes || null,
          text_color:      lotForm.text_color || null,
          label_x:         lotForm.label_x,
          label_y:         lotForm.label_y,
          label_font_size: lotForm.label_font_size,
          cta_type:        lotForm.cta_type,
          cta_label:       lotForm.cta_label || null,
          cta_url:         lotForm.cta_url || null,
        }),
      });
      if (res.ok) {
        const newLot = await res.json() as Lot;
        setCommunity(prev => prev ? { ...prev, lots: [...prev.lots, newLot] } : null);
        showToast("Lot created");
        setPendingPolygon(null);
        setLotForm(null);
      } else {
        showToast("Create failed");
      }
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
      showToast("Lot deleted");
      setSelectedLot(null);
      setLotForm(null);
    } else {
      showToast("Delete failed");
    }
    setDeletingLot(false);
  }

  // ── Vertex drag editing ──────────────────────────────────────────────────────

  function startVertexEdit(lot: Lot) {
    setEditingVerticesLotId(lot.id);
    setEditedPolygon(lot.polygon.map(p => [...p] as DrawingPoint));
    setSelectedLot(null);
    setLotForm(null);
  }

  function cancelVertexEdit() {
    setEditingVerticesLotId(null);
    setEditedPolygon([]);
    setDraggingVertex(null);
  }

  function handleVertexPointerDown(e: React.PointerEvent<SVGCircleElement>, idx: number) {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraggingVertex(idx);
  }

  function handleVertexPointerMove(e: React.PointerEvent<SVGElement>) {
    if (draggingVertex === null || !mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setEditedPolygon(prev => prev.map((pt, i) => i === draggingVertex ? [x, y] : pt));
  }

  function handleVertexPointerUp() {
    setDraggingVertex(null);
  }

  async function saveVertexEdit() {
    if (!editingVerticesLotId || !community) return;
    setSavingVertices(true);
    const res = await fetch(`/api/communities/${community.id}/lots/${editingVerticesLotId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ polygon: editedPolygon }),
    });
    if (res.ok) {
      setCommunity(prev => prev ? {
        ...prev,
        lots: prev.lots.map(l => l.id === editingVerticesLotId ? { ...l, polygon: editedPolygon } : l),
      } : null);
      showToast("Vertices saved");
      cancelVertexEdit();
    } else {
      showToast("Save failed");
    }
    setSavingVertices(false);
  }

  // ── Site map upload ──────────────────────────────────────────────────────────

  async function handleMapUpload(file: File) {
    if (!community) return;
    setMapUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/communities/${community.id}/site-map`, { method: "POST", body: fd });
    if (res.ok) {
      const { url } = await res.json() as { url: string };
      setCommunity(prev => prev ? { ...prev, site_map_url: url } : null);
      showToast("Site map uploaded");
    } else {
      showToast("Upload failed");
    }
    setMapUploading(false);
  }

  async function handleSaveMeta() {
    if (!community) return;
    setSavingMeta(true);
    const res = await fetch(`/api/communities/${community.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name:         metaForm.name,
        slug:         metaForm.slug,
        description:  metaForm.description || null,
        company_slug: metaForm.company_slug || null,
      }),
    });
    if (res.ok) {
      setCommunity(prev => prev ? { ...prev, ...metaForm, description: metaForm.description || null, company_slug: metaForm.company_slug || null } : null);
      setEditingMeta(false);
      showToast("Community updated");
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
        setCommunity(prev => prev ? {
          ...prev,
          lots: prev.lots.map(l => ({ ...l, text_color: null, label_font_size: null })),
        } : null);
        setApplyToAll(false);
      }
      showToast("Map settings saved");
    } else { showToast("Save failed"); }
    setSavingMapSettings(false);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (!community) {
    return <div className="flex flex-col items-center justify-center h-full gap-3"><p className="text-white/40 text-sm">Community not found.</p><Link href="/admin/communities" className="text-xs text-blue-400 hover:underline">← Back</Link></div>;
  }

  const { w, h } = svgSize;

  return (
    <div className="flex h-full overflow-hidden relative">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#111] border border-white/15 text-white text-sm px-4 py-2.5 rounded-xl shadow-2xl">
          {toast}
        </div>
      )}

      {/* ── Main canvas area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-white/8 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 text-xs text-white/30">
            <Link href="/admin/communities" className="hover:text-white transition-colors">Site Maps</Link>
            <span>›</span>
            <span className="text-white/70 font-medium">{community.name}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Mobile panel toggle */}
            <button
              onClick={() => setPanelOpen(v => !v)}
              className="md:hidden flex items-center gap-1.5 px-2.5 py-1.5 bg-white/6 border border-white/10 text-xs text-white/50 rounded-lg hover:text-white transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h8" />
              </svg>
              Lots
            </button>
            {/* Zoom controls */}
            <div className="flex items-center gap-1 bg-white/4 border border-white/8 rounded-lg px-1 py-0.5">
              <button onClick={() => setMapZoom(v => Math.max(0.3, v - 0.1))} className="w-6 h-6 flex items-center justify-center text-white/40 hover:text-white transition-colors text-base leading-none">−</button>
              <span className="text-[10px] text-white/35 w-9 text-center tabular-nums">{Math.round(mapZoom * 100)}%</span>
              <button onClick={() => setMapZoom(v => Math.min(4, v + 0.1))} className="w-6 h-6 flex items-center justify-center text-white/40 hover:text-white transition-colors text-base leading-none">+</button>
              {(mapZoom !== 1 || panOffset.x !== 0 || panOffset.y !== 0) && <button onClick={() => { setMapZoom(1); setPanOffset({ x: 0, y: 0 }); }} className="w-5 h-5 flex items-center justify-center text-white/25 hover:text-white/60 transition-colors ml-0.5" title="Reset view">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>}
            </div>
            {community.slug && community.company_slug && (
              <a href={`/community/${community.company_slug}/${community.slug}`}
                target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 border border-white/12 text-xs text-white/50 rounded-lg hover:text-white hover:border-white/25 transition-colors">
                Preview →
              </a>
            )}
            {editingVerticesLotId ? (
              <>
                <span className="text-[10px] text-amber-400/80 bg-amber-400/10 border border-amber-400/20 px-2 py-1 rounded-lg">
                  Drag vertices to reshape
                </span>
                <button onClick={saveVertexEdit} disabled={savingVertices}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-xs text-white font-medium rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-40">
                  {savingVertices ? "Saving…" : "Save Shape"}
                </button>
                <button onClick={cancelVertexEdit}
                  className="px-3 py-1.5 border border-white/12 text-xs text-white/40 rounded-lg hover:text-white transition-colors">
                  Cancel
                </button>
              </>
            ) : isDrawing ? (
              <>
                {drawingPoints.length >= 3 && (
                  <button onClick={closePolygon}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-xs text-white font-medium rounded-lg hover:bg-blue-500 transition-colors">
                    Close Shape
                  </button>
                )}
                <button onClick={cancelDraw}
                  className="px-3 py-1.5 border border-white/12 text-xs text-white/40 rounded-lg hover:text-white transition-colors">
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => { setIsDrawing(true); setSelectedLot(null); setLotForm(null); setPendingPolygon(null); }}
                disabled={!community.site_map_url}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-xs text-white font-medium rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-40"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Draw Lot
              </button>
            )}
          </div>
        </div>

        {/* Map area */}
        <div
          ref={mapAreaRef}
          className="flex-1 overflow-hidden flex items-center justify-center bg-[#0d0d0d] p-4"
          onWheel={handleMapWheel}
          onMouseDown={handlePanStart}
          onMouseMove={handlePanMove}
          onMouseUp={handlePanEnd}
          onMouseLeave={handlePanEnd}
          style={{ cursor: isDrawing ? "crosshair" : isDragging ? "grabbing" : "grab" }}
        >
          {community.site_map_url ? (
            <div
              ref={mapRef}
              className="relative max-w-full max-h-full"
              style={{ transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${mapZoom})`, transformOrigin: "center center", transition: isDragging ? "none" : "transform 0.1s ease" }}
              onClick={e => { if (!hasDragged.current) handleMapClick(e); }}
              onMouseMove={handleMapMouseMove}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={community.site_map_url}
                alt={community.name}
                className="block max-w-full max-h-[calc(100vh-12rem)] object-contain rounded-lg select-none"
                onLoad={updateSvgSize}
                draggable={false}
              />

              {/* SVG overlay */}
              <svg
                className="absolute inset-0 pointer-events-none"
                width={w} height={h}
                style={{ pointerEvents: isDrawing ? "none" : "auto" }}
                onPointerMove={editingVerticesLotId ? handleVertexPointerMove : undefined}
                onPointerUp={editingVerticesLotId ? handleVertexPointerUp : undefined}
              >
                {/* Saved lots */}
                {community.lots.map(lot => {
                  const col = LOT_COLORS[lot.status];
                  const isSelected = selectedLot?.id === lot.id;
                  const isEditingThis = editingVerticesLotId === lot.id;
                  const displayPoly = isEditingThis ? editedPolygon : lot.polygon;
                  return (
                    <g key={lot.id} data-lot="true"
                      style={{ pointerEvents: editingVerticesLotId && !isEditingThis ? "none" : "all", cursor: isEditingThis ? "default" : "pointer" }}
                      onClick={e => { e.stopPropagation(); if (!hasDragged.current && !editingVerticesLotId) selectLot(lot); }}>
                      <polygon
                        points={pointsToSvgPoly(displayPoly, w, h)}
                        fill={isEditingThis ? "rgba(251,191,36,0.2)" : col.fill}
                        stroke={isEditingThis ? "#fbbf24" : isSelected ? "#fff" : col.stroke}
                        strokeWidth={isEditingThis ? 2 : isSelected ? 2 : (mapSettings.stroke_width ?? 1.5)}
                        strokeDasharray={isEditingThis ? "6 3" : isSelected ? "5 3" : undefined}
                      />
                      {/* Vertex handles — only when editing this lot */}
                      {isEditingThis && editedPolygon.map(([x, y], idx) => (
                        <circle
                          key={idx}
                          cx={(x / 100) * w}
                          cy={(y / 100) * h}
                          r={6}
                          fill={draggingVertex === idx ? "#fbbf24" : "#fff"}
                          stroke="#fbbf24"
                          strokeWidth={2}
                          style={{ cursor: "grab", pointerEvents: "all" }}
                          onPointerDown={e => handleVertexPointerDown(e, idx)}
                        />
                      ))}
                      {/* Label */}
                      {mapSettings.show_labels !== false && displayPoly.length >= 3 && (() => {
                        const centX = (displayPoly.reduce((s, [x]) => s + x, 0) / displayPoly.length / 100) * w;
                        const centY = (displayPoly.reduce((s, [, y]) => s + y, 0) / displayPoly.length / 100) * h;
                        const lx = (isSelected && lotForm?.label_x != null) ? (lotForm.label_x / 100) * w : (lot.label_x != null ? (lot.label_x / 100) * w : centX);
                        const ly = (isSelected && lotForm?.label_y != null) ? (lotForm.label_y / 100) * h : (lot.label_y != null ? (lot.label_y / 100) * h : centY);
                        const fs = isSelected ? (lotForm?.label_font_size ?? mapSettings.default_label_size ?? 11) : (lot.label_font_size ?? mapSettings.default_label_size ?? 11);
                        const fc = lot.text_color ?? mapSettings.default_label_color ?? "#ffffff";
                        return (
                          <text
                            x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
                            fontSize={fs} fontWeight="600"
                            fill={fc} fillOpacity={0.9}
                            style={{ cursor: isSelected ? "move" : "default", pointerEvents: isSelected ? "all" : "none", userSelect: "none" }}
                            onMouseDown={isSelected ? e => { e.stopPropagation(); isDraggingLabel.current = true; } : undefined}
                            onClick={isSelected ? e => e.stopPropagation() : undefined}
                          >
                            {lot.lot_number}
                          </text>
                        );
                      })()}
                    </g>
                  );
                })}

                {/* Pending new polygon (not yet saved) */}
                {pendingPolygon && pendingPolygon.length >= 3 && (
                  <polygon
                    points={pointsToSvgPoly(pendingPolygon, w, h)}
                    fill="rgba(59,130,246,0.25)"
                    stroke="#3b82f6"
                    strokeWidth={1.5}
                    strokeDasharray="5 3"
                  />
                )}

                {/* Active drawing */}
                {isDrawing && drawingPoints.length > 0 && (
                  <g>
                    <polyline
                      points={[...drawingPoints, ...(mousePos ? [mousePos] : [])].map(([x, y]) => `${(x / 100) * w},${(y / 100) * h}`).join(" ")}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth={1.5}
                      strokeDasharray="5 3"
                    />
                    {drawingPoints.map(([x, y], i) => (
                      <circle key={i}
                        cx={(x / 100) * w} cy={(y / 100) * h}
                        r={i === 0 ? 5 : 3}
                        fill={i === 0 ? "#3b82f6" : "white"}
                        stroke={i === 0 ? "white" : "#3b82f6"}
                        strokeWidth={1.5}
                      />
                    ))}
                  </g>
                )}
              </svg>
            </div>
          ) : (
            // Upload drop zone
            <div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleMapUpload(f); e.target.value = ""; }} />
              <div
                onClick={() => !mapUploading && fileInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith("image/")) handleMapUpload(f); }}
                className="flex flex-col items-center justify-center gap-3 w-80 h-52 border-2 border-dashed border-white/15 rounded-2xl cursor-pointer hover:border-blue-500/40 hover:bg-blue-600/5 transition-colors"
              >
                {mapUploading ? (
                  <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <svg className="w-10 h-10 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
                    </svg>
                    <p className="text-sm text-white/40 text-center">
                      Drop your site plan here<br />
                      <span className="text-white/20 text-xs">or click to browse</span>
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Replace site map button */}
        {community.site_map_url && (
          <div className="px-5 py-2.5 border-t border-white/8 flex items-center gap-3 flex-shrink-0">
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleMapUpload(f); e.target.value = ""; }} />
            <button onClick={() => fileInputRef.current?.click()} disabled={mapUploading}
              className="text-xs text-white/30 hover:text-white/60 transition-colors disabled:opacity-40">
              {mapUploading ? "Uploading…" : "Replace site map image"}
            </button>
            <span className="text-white/10">·</span>
            <span className="text-xs text-white/20">Click lots on the map to edit · Click "Draw Lot" to add new lots</span>
          </div>
        )}
      </div>

      {/* Mobile backdrop */}
      {panelOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setPanelOpen(false)} />
      )}

      {/* ── Right sidebar ── */}
      <div className={[
        "flex-shrink-0 border-l border-white/8 bg-[#111] flex flex-col overflow-hidden",
        "fixed inset-y-0 right-0 z-50 w-72 transform transition-transform duration-300",
        "md:relative md:translate-x-0 md:z-auto md:inset-auto",
        panelOpen ? "translate-x-0" : "translate-x-full md:translate-x-0",
      ].join(" ")}>
        {lotForm ? (
          <>
            <div className="px-4 py-3.5 border-b border-white/8 flex items-center justify-between flex-shrink-0">
              <p className="text-sm font-semibold text-white">
                {selectedLot ? "Edit Lot" : "New Lot"}
              </p>
              <button onClick={() => { setLotForm(null); setSelectedLot(null); setPendingPolygon(null); }}
                className="text-white/30 hover:text-white text-lg leading-none">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1.5">Lot Number / Label</label>
                <input value={lotForm.lot_number}
                  onChange={e => setLotForm(f => f && ({ ...f, lot_number: e.target.value }))}
                  className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-blue-500/60 transition-colors" />
              </div>
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1.5">Status</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["available", "reserved", "sold"] as LotStatus[]).map(s => {
                    const col = LOT_COLORS[s];
                    return (
                      <button key={s} onClick={() => setLotForm(f => f && ({ ...f, status: s }))}
                        className="py-1.5 rounded-lg text-[10px] font-semibold border transition-colors"
                        style={{
                          background: lotForm.status === s ? col.fill : "transparent",
                          borderColor: lotForm.status === s ? col.stroke : "rgba(255,255,255,0.1)",
                          color: lotForm.status === s ? col.stroke : "rgba(255,255,255,0.4)",
                        }}>
                        {col.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1.5">Assigned Model</label>
                <select value={lotForm.project_id}
                  onChange={e => setLotForm(f => f && ({ ...f, project_id: e.target.value }))}
                  className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/70 focus:outline-none focus:border-blue-500/60 transition-colors">
                  <option value="">— None —</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1.5">Price Modifier ($)</label>
                <input type="number" value={lotForm.price_modifier}
                  onChange={e => setLotForm(f => f && ({ ...f, price_modifier: e.target.value }))}
                  className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-blue-500/60 transition-colors"
                  placeholder="0" />
                <p className="text-[10px] text-white/25 mt-1">Added to the model's base price for this lot</p>
              </div>
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1.5">Notes</label>
                <textarea value={lotForm.notes ?? ""}
                  onChange={e => setLotForm(f => f && ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-blue-500/60 transition-colors resize-none" />
              </div>
              {/* CTA */}
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1.5">Call to Action</label>
                <div className="grid grid-cols-2 gap-1 mb-2">
                  {([
                    { value: "configurator", label: "Configurator" },
                    { value: "external",     label: "External Link" },
                    { value: "contact",      label: "Lead Form" },
                    { value: "none",         label: "None" },
                  ] as const).map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => setLotForm(f => f && ({ ...f, cta_type: opt.value }))}
                      className="py-1.5 rounded-lg text-[10px] font-semibold border transition-colors"
                      style={{
                        background: lotForm.cta_type === opt.value ? "rgba(59,130,246,0.2)" : "transparent",
                        borderColor: lotForm.cta_type === opt.value ? "rgba(59,130,246,0.5)" : "rgba(255,255,255,0.1)",
                        color: lotForm.cta_type === opt.value ? "#93c5fd" : "rgba(255,255,255,0.4)",
                      }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                {(lotForm.cta_type === "configurator" || lotForm.cta_type === "external" || lotForm.cta_type === "contact") && (
                  <input value={lotForm.cta_label}
                    onChange={e => setLotForm(f => f && ({ ...f, cta_label: e.target.value }))}
                    placeholder={
                      lotForm.cta_type === "configurator" ? "Configure this home (default)" :
                      lotForm.cta_type === "contact"      ? "Request Info (default)" :
                                                            "Button label…"
                    }
                    className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-blue-500/60 transition-colors mb-1.5" />
                )}
                {lotForm.cta_type === "external" && (
                  <input value={lotForm.cta_url}
                    onChange={e => setLotForm(f => f && ({ ...f, cta_url: e.target.value }))}
                    placeholder="https://…"
                    className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 font-mono focus:outline-none focus:border-blue-500/60 transition-colors" />
                )}
              </div>

              <div>
                <label className="block text-[9px] font-bold uppercase tracking-widest text-white/25 mb-2">Label Text Color</label>
                <div className="flex items-center gap-2">
                  {["#ffffff", "#000000", "#1a1a1a", "#fbbf24", "#f87171", "#34d399"].map(c => (
                    <button
                      key={c}
                      onClick={() => setLotForm(f => f && ({ ...f, text_color: c }))}
                      className="w-6 h-6 rounded-full border-2 transition-all flex-shrink-0"
                      style={{
                        background: c,
                        borderColor: lotForm.text_color === c ? "#60a5fa" : "rgba(255,255,255,0.15)",
                        boxShadow: lotForm.text_color === c ? "0 0 0 2px #1d4ed8" : "none",
                      }}
                    />
                  ))}
                  <label className="w-6 h-6 rounded-full border border-white/15 overflow-hidden cursor-pointer flex-shrink-0 relative" title="Custom color">
                    <input
                      type="color"
                      value={lotForm.text_color ?? "#ffffff"}
                      onChange={e => setLotForm(f => f && ({ ...f, text_color: e.target.value }))}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="w-full h-full flex items-center justify-center" style={{ background: lotForm.text_color ?? "#ffffff" }}>
                      <svg className="w-3 h-3" style={{ color: lotForm.text_color === "#ffffff" || lotForm.text_color === "#fbbf24" || lotForm.text_color === "#34d399" ? "#00000060" : "#ffffff60" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                  </label>
                </div>
                <p className="text-[10px] text-white/20 mt-1.5">Color of the lot number on the map</p>
              </div>
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1.5">Label Size</label>
                <div className="flex items-center gap-3">
                  <input type="range" min={7} max={30} step={1} value={lotForm.label_font_size}
                    onChange={e => setLotForm(f => f && ({ ...f, label_font_size: Number(e.target.value) }))}
                    className="flex-1 accent-blue-500" />
                  <span className="text-xs tabular-nums text-white/50 w-5 text-right">{lotForm.label_font_size}</span>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-white/25">Label Position</label>
                  {lotForm.label_x != null && (
                    <button onClick={() => setLotForm(f => f && ({ ...f, label_x: null, label_y: null }))}
                      className="text-[10px] text-blue-400/60 hover:text-blue-400 transition-colors">
                      Reset
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-white/30">
                  {lotForm.label_x != null ? `${lotForm.label_x.toFixed(1)}% × ${(lotForm.label_y ?? 0).toFixed(1)}%` : "Centered in lot"}
                </p>
                <p className="text-[10px] text-white/20 mt-0.5">Drag the label on the map to reposition</p>
              </div>
            </div>
            <div className="p-4 border-t border-white/8 space-y-2 flex-shrink-0">
              <button onClick={handleSaveLot} disabled={savingLot}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm text-white font-semibold transition-colors disabled:opacity-50">
                {savingLot ? "Saving…" : selectedLot ? "Save Changes" : "Create Lot"}
              </button>
              {selectedLot && (
                <>
                  <button
                    onClick={() => { startVertexEdit(selectedLot); setPanelOpen(false); }}
                    className="w-full py-2 rounded-xl border border-amber-500/20 text-amber-400/70 hover:text-amber-400 hover:border-amber-500/40 text-sm transition-colors"
                  >
                    Edit Vertices
                  </button>
                  <button onClick={handleDeleteLot} disabled={deletingLot}
                    className="w-full py-2 rounded-xl border border-red-500/20 text-red-400/70 hover:text-red-400 hover:border-red-500/40 text-sm transition-colors disabled:opacity-40">
                    {deletingLot ? "Deleting…" : "Delete Lot"}
                  </button>
                </>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Community metadata */}
            <div className="border-b border-white/8 flex-shrink-0">
              <div className="px-4 py-3.5 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{community.name}</p>
                  <p className="text-xs text-white/30 mt-0.5">{community.lots.length} lots · {builders[community.company_slug ?? ""]?.company_name ?? community.company_slug ?? "No builder"}</p>
                </div>
                <button
                  onClick={() => { setEditingMeta(v => !v); setMetaForm({ name: community.name, slug: community.slug, description: community.description ?? "", company_slug: community.company_slug ?? "" }); }}
                  className="ml-2 flex-shrink-0 text-[10px] px-2 py-1 rounded-lg border border-white/12 text-white/35 hover:text-white hover:border-white/25 transition-colors"
                >
                  {editingMeta ? "Cancel" : "Edit"}
                </button>
              </div>

              {editingMeta && (
                <div className="px-4 pb-4 space-y-3">
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1.5">Name</label>
                    <input value={metaForm.name}
                      onChange={e => setMetaForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-blue-500/60 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1.5">URL Slug</label>
                    <input value={metaForm.slug}
                      onChange={e => setMetaForm(f => ({ ...f, slug: e.target.value }))}
                      className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 font-mono focus:outline-none focus:border-blue-500/60 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1.5">Builder</label>
                    <select value={metaForm.company_slug}
                      onChange={e => setMetaForm(f => ({ ...f, company_slug: e.target.value }))}
                      className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/70 focus:outline-none focus:border-blue-500/60 transition-colors">
                      <option value="">— None —</option>
                      {Object.entries(builders).map(([slug, b]) => (
                        <option key={slug} value={slug}>{b.company_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1.5">Description</label>
                    <textarea value={metaForm.description}
                      onChange={e => setMetaForm(f => ({ ...f, description: e.target.value }))}
                      rows={3}
                      placeholder="Brief description of the community…"
                      className="w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-blue-500/60 transition-colors resize-none" />
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
              <button
                onClick={() => setMapSettingsOpen(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/4 transition-colors"
              >
                <span className="text-xs font-semibold text-white/50">Map Settings</span>
                <svg className={`w-3.5 h-3.5 text-white/25 transition-transform ${mapSettingsOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {mapSettingsOpen && (
                <div className="px-4 pb-4 space-y-4">
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-white/25 mb-2">Default Label Color</label>
                    <div className="flex items-center gap-2">
                      {["#ffffff", "#000000", "#1a1a1a", "#fbbf24", "#f87171", "#34d399"].map(c => (
                        <button key={c} onClick={() => setMapSettings(s => ({ ...s, default_label_color: c }))}
                          className="w-5 h-5 rounded-full border-2 flex-shrink-0 transition-all"
                          style={{ background: c, borderColor: mapSettings.default_label_color === c ? "#60a5fa" : "rgba(255,255,255,0.15)", boxShadow: mapSettings.default_label_color === c ? "0 0 0 2px #1d4ed8" : "none" }} />
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
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1.5">Default Label Size</label>
                    <div className="flex items-center gap-3">
                      <input type="range" min={7} max={30} step={1} value={mapSettings.default_label_size ?? 11}
                        onChange={e => setMapSettings(s => ({ ...s, default_label_size: Number(e.target.value) }))}
                        className="flex-1 accent-blue-500" />
                      <span className="text-xs tabular-nums text-white/50 w-5 text-right">{mapSettings.default_label_size ?? 11}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1.5">Stroke Width</label>
                    <div className="flex gap-1.5">
                      {[1, 1.5, 2, 3].map(w => (
                        <button key={w} onClick={() => setMapSettings(s => ({ ...s, stroke_width: w }))}
                          className="flex-1 py-1 rounded text-[10px] font-medium border transition-colors"
                          style={{ background: (mapSettings.stroke_width ?? 1.5) === w ? "rgba(59,130,246,0.2)" : "transparent", borderColor: (mapSettings.stroke_width ?? 1.5) === w ? "rgba(59,130,246,0.6)" : "rgba(255,255,255,0.1)", color: (mapSettings.stroke_width ?? 1.5) === w ? "#60a5fa" : "rgba(255,255,255,0.4)" }}>
                          {w}px
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-white/25">Show Lot Labels</p>
                      <p className="text-[10px] text-white/20 mt-0.5">Display lot numbers on map</p>
                    </div>
                    <button
                      onClick={() => setMapSettings(s => ({ ...s, show_labels: s.show_labels === false ? true : false }))}
                      className={`w-9 h-5 rounded-full border transition-colors relative flex-shrink-0 ${mapSettings.show_labels === false ? "bg-white/8 border-white/15" : "bg-blue-600 border-blue-500"}`}
                    >
                      <span className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-all ${mapSettings.show_labels === false ? "left-0.5" : "left-4"}`} />
                    </button>
                  </div>
                  <label className="flex items-start gap-2.5 cursor-pointer group">
                    <div className={`w-4 h-4 rounded border flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors ${applyToAll ? "bg-amber-500 border-amber-400" : "bg-transparent border-white/20 group-hover:border-white/40"}`}
                      onClick={() => setApplyToAll(v => !v)}>
                      {applyToAll && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div onClick={() => setApplyToAll(v => !v)}>
                      <p className="text-[10px] font-medium text-white/60">Apply to all lots</p>
                      <p className="text-[9px] text-white/25 mt-0.5">Overwrite per-lot color &amp; size on save. Position is preserved.</p>
                    </div>
                  </label>
                  <button onClick={handleSaveMapSettings} disabled={savingMapSettings}
                    className={`w-full py-2 rounded-lg border text-xs transition-colors disabled:opacity-40 ${applyToAll ? "bg-amber-500/15 border-amber-400/40 text-amber-300 hover:bg-amber-500/25" : "bg-white/6 hover:bg-white/10 border-white/8 text-white/60 hover:text-white"}`}>
                    {savingMapSettings ? "Saving…" : applyToAll ? "Save & Apply to All Lots" : "Save Map Settings"}
                  </button>
                </div>
              )}
            </div>

            {/* Lots list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {community.lots.length === 0 ? (
                <p className="text-xs text-white/25 text-center py-6">No lots yet. Upload a site map and click "Draw Lot" to get started.</p>
              ) : (
                <div className="space-y-1.5">
                  {community.lots.map(lot => {
                    const col = LOT_COLORS[lot.status];
                    const proj = projects.find(p => p.id === lot.project_id);
                    const lotUrl = proj && proj.slug && proj.company_slug
                      ? `${window.location.origin}/project/${proj.company_slug}/${proj.slug}?lotId=${lot.id}&lotNumber=${encodeURIComponent(lot.lot_number)}&communitySlug=${community.slug}&communityName=${encodeURIComponent(community.name)}&lotPriceModifier=${lot.price_modifier ?? 0}&utm_source=qr`
                      : null;
                    const builder = community.company_slug ? builders[community.company_slug] : null;
                    return (
                      <div key={lot.id} className="flex items-center gap-1">
                        <button onClick={() => selectLot(lot)}
                          className="flex-1 flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/4 hover:bg-white/8 transition-colors text-left border border-transparent hover:border-white/8">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: col.stroke }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-white/80">{lot.lot_number}</p>
                            <p className="text-[10px] text-white/30 truncate">{proj?.name ?? "No model assigned"}</p>
                          </div>
                          <span className="text-[10px] font-medium flex-shrink-0" style={{ color: col.stroke }}>{col.label}</span>
                        </button>
                        {lotUrl && (
                          <button
                            onClick={e => { e.stopPropagation(); setLotQrOpen(lot.id); }}
                            className="flex-shrink-0 w-7 h-7 rounded-md bg-white/4 hover:bg-white/10 border border-white/8 flex items-center justify-center transition-colors"
                            title="QR Code"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 text-white/40">
                              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
                              <path strokeLinecap="round" d="M14 14h2m3 0h1M14 17h1m2 0h2M14 20h3m2 0h1"/>
                            </svg>
                          </button>
                        )}
                        {lotQrOpen === lot.id && lotUrl && (
                          <QRModal
                            url={lotUrl}
                            label={`Lot ${lot.lot_number}`}
                            sublabel={proj?.name}
                            builderLogo={builder?.logo_url}
                            accentColor={builder?.accent_color}
                            builderName={builder?.company_name}
                            thumbnailUrl={proj?.thumbnail_url}
                            onClose={() => setLotQrOpen(null)}
                          />
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
                <p className="text-[9px] font-bold uppercase tracking-widest text-white/25 mb-3">Share & Publish</p>
                <button
                  onClick={copyShareUrl}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-white/4 border border-white/8 hover:bg-white/8 hover:border-white/14 transition-colors text-left"
                >
                  <span className="text-xs font-medium text-white/60">
                    {copiedShare === "url" ? "Copied!" : "Copy Configurator URL"}
                  </span>
                  {copiedShare === "url" ? (
                    <svg className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5 text-white/30 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={copyEmbedCode}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-white/4 border border-white/8 hover:bg-white/8 hover:border-white/14 transition-colors text-left"
                >
                  <span className="text-xs font-medium text-white/60">
                    {copiedShare === "embed" ? "Copied!" : "Copy Embed Code"}
                  </span>
                  {copiedShare === "embed" ? (
                    <svg className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5 text-white/30 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => setQrOpen(true)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-white/4 border border-white/8 hover:bg-violet-600/12 hover:border-violet-500/30 transition-colors text-left"
                >
                  <span className="text-xs font-medium text-white/60">QR Code &amp; Yard Signs</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5 text-white/30 flex-shrink-0">
                    <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
                    <path strokeLinecap="round" d="M14 14h2m3 0h1M14 17h1m2 0h2M14 20h3m2 0h1"/>
                  </svg>
                </button>
              </div>
            )}

            {qrOpen && community.slug && community.company_slug && (() => {
              const builder = builders[community.company_slug];
              const communityUrl = `${window.location.origin}/community/${community.company_slug}/${community.slug}?utm_source=qr`;
              const lotItems = (community.lots ?? []).filter(l => {
                const proj = projects.find(p => p.id === l.project_id);
                return proj?.slug && proj?.company_slug;
              }).map(l => {
                const proj = projects.find(p => p.id === l.project_id)!;
                return {
                  id: l.id,
                  lot_number: l.lot_number,
                  url: `${window.location.origin}/project/${proj.company_slug}/${proj.slug}?lotId=${l.id}&lotNumber=${encodeURIComponent(l.lot_number)}&communitySlug=${community.slug}&communityName=${encodeURIComponent(community.name)}&lotPriceModifier=${l.price_modifier ?? 0}&utm_source=qr`,
                  sublabel: proj.name,
                  thumbnailUrl: proj.thumbnail_url ?? null,
                } as QRLot;
              });
              return (
                <QRModal
                  url={communityUrl}
                  label={community.name}
                  builderLogo={builder?.logo_url}
                  accentColor={builder?.accent_color}
                  builderName={builder?.company_name}
                  thumbnailUrl={lotItems[0]?.thumbnailUrl ?? null}
                  lots={lotItems.length > 0 ? lotItems : undefined}
                  onClose={() => setQrOpen(false)}
                />
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}
