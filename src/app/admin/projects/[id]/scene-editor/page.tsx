"use client";

import { Component, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { saveCategoryCamera, setDefaultOption as apiSetDefaultOption, updateCategory, createCategory, deleteCategory, createOption, updateOption, deleteOption } from "@/lib/admin-api";
import type {
  CategoryWithOptions, MaterialLibraryEntry, Option, OptionType, Project,
  PlacedPropData, PropCatalogEntry, PlacedShapeData, ShapeType, PlacedLight,
  ProjectAddon, CameraBookmark, AnnotationPin,
} from "@/types/database";
import type { MeshTriangleCounts } from "@/components/scene-editor/SceneEditorViewport";
import type { SceneTreeNode } from "@/lib/three/variant-engine";
import type {
  SceneEditorViewportHandle, SceneSettings, MeshOverrides, TransformMode, GlbMaterialInfo,
  MeshMaterialDef,
} from "@/components/scene-editor/SceneEditorViewport";
import { DEFAULT_SCENE_SETTINGS } from "@/components/scene-editor/SceneEditorViewport";
import MaterialEditor from "@/components/scene-editor/MaterialEditor";
import ThumbnailGenPanel from "@/components/scene-editor/ThumbnailGenPanel";
import { DEFAULT_MATERIAL_PROPS } from "@/lib/material-defaults";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, arrayMove, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const SceneEditorViewport = dynamic(
  () => import("@/components/scene-editor/SceneEditorViewport"),
  { ssr: false, loading: () => <div className="w-full h-full bg-[#0d0d0d] rounded-xl animate-pulse" /> },
);
const SceneTree = dynamic(() => import("@/components/scene-editor/SceneTree"), { ssr: false });

// ─── Constants ────────────────────────────────────────────────────────────────

const PHASES = ["blueprint", "interior", "exterior"] as const;
type Phase = typeof PHASES[number];

const PHASE_COLOR: Record<Phase, string> = {
  blueprint: "text-blue-400 border-blue-400/30 bg-blue-400/10",
  interior:  "text-violet-400 border-violet-400/30 bg-violet-400/10",
  exterior:  "text-green-400 border-green-400/30 bg-green-400/10",
};

const PHASE_DOT: Record<Phase, string> = {
  blueprint: "bg-blue-400",
  interior:  "bg-violet-400",
  exterior:  "bg-green-400",
};

const ENV_PRESETS = ["apartment","city","dawn","forest","lobby","night","park","studio","sunset","warehouse"];
const MAT_CATS    = ["Exterior","Walls","Roofing","Flooring","Countertops","Cabinetry","Windows","Other"];

interface SkyPresetDef {
  label: string;
  turbidity: number; rayleigh: number; mie: number; mieG: number;
  elevation: number; azimuth: number;
  stars?: boolean; ambientHint?: number;
}
const SKY_PRESETS: Record<string, SkyPresetDef> = {
  sunrise:     { label: "Sunrise",      turbidity: 9,  rayleigh: 3.0, mie: 0.005, mieG: 0.8, elevation: 8,   azimuth: 90,  ambientHint: 0.18 },
  golden_hour: { label: "Golden Hour",  turbidity: 11, rayleigh: 3.5, mie: 0.006, mieG: 0.9, elevation: 13,  azimuth: 275, ambientHint: 0.2  },
  morning:     { label: "Morning",      turbidity: 10, rayleigh: 2.0, mie: 0.005, mieG: 0.8, elevation: 25,  azimuth: 120, ambientHint: 0.25 },
  noon:        { label: "Noon",         turbidity: 10, rayleigh: 1.0, mie: 0.005, mieG: 0.8, elevation: 75,  azimuth: 180, ambientHint: 0.35 },
  afternoon:   { label: "Afternoon",    turbidity: 10, rayleigh: 2.0, mie: 0.005, mieG: 0.8, elevation: 40,  azimuth: 240, ambientHint: 0.3  },
  sunset:      { label: "Sunset",       turbidity: 10, rayleigh: 3.0, mie: 0.005, mieG: 0.8, elevation: 5,   azimuth: 270, ambientHint: 0.18 },
  dusk:        { label: "Dusk",         turbidity: 20, rayleigh: 4.0, mie: 0.010, mieG: 0.9, elevation: -5,  azimuth: 270, ambientHint: 0.12 },
  overcast:    { label: "Overcast",     turbidity: 20, rayleigh: 0.5, mie: 0.020, mieG: 0.5, elevation: 45,  azimuth: 180, ambientHint: 0.4  },
  night:       { label: "Night",        turbidity: 20, rayleigh: 0.1, mie: 0.001, mieG: 0.8, elevation: -30, azimuth: 0,   stars: true, ambientHint: 0.06 },
};

const OPT_TYPE_LABELS: Record<OptionType, string> = {
  visibility:        "Show / Hide",
  material_variant:  "KHR Variant",
  material_override: "Material Override",
};

const PRESET_MATS = [
  { name:"White Render",      category:"Walls",       base_color:"#f5f5f5", roughness:0.85, metalness:0.0 },
  { name:"Concrete",          category:"Walls",       base_color:"#9e9e9e", roughness:0.90, metalness:0.0 },
  { name:"Brick Red",         category:"Exterior",    base_color:"#c1440e", roughness:0.95, metalness:0.0 },
  { name:"Dark Cladding",     category:"Exterior",    base_color:"#2d2d2d", roughness:0.80, metalness:0.0 },
  { name:"Timber",            category:"Flooring",    base_color:"#8b5e3c", roughness:0.85, metalness:0.0 },
  { name:"Light Timber",      category:"Flooring",    base_color:"#c8a87a", roughness:0.80, metalness:0.0 },
  { name:"Polished Concrete", category:"Flooring",    base_color:"#b0b0b0", roughness:0.30, metalness:0.0 },
  { name:"Marble White",      category:"Countertops", base_color:"#f0ede8", roughness:0.20, metalness:0.0 },
  { name:"Dark Stone",        category:"Countertops", base_color:"#3a3a3a", roughness:0.40, metalness:0.0 },
  { name:"Colorbond Steel",   category:"Roofing",     base_color:"#5a5a5a", roughness:0.60, metalness:0.80 },
  { name:"Terracotta",        category:"Roofing",     base_color:"#c06035", roughness:0.90, metalness:0.0 },
  { name:"Aluminium Frame",   category:"Windows",     base_color:"#b8b8b8", roughness:0.30, metalness:0.95 },
  { name:"Black Frame",       category:"Windows",     base_color:"#1a1a1a", roughness:0.40, metalness:0.80 },
];

// ─── Tiny shared helpers ──────────────────────────────────────────────────────

function Swatch({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <span className="rounded-full border border-white/15 flex-shrink-0 inline-block"
      style={{ width: size, height: size, background: color }} />
  );
}

function Slider({ label, value, min, max, step, onChange, unit }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; unit?: string;
}) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-[10px] text-white/40 uppercase tracking-wide">{label}</span>
        <span className="text-[10px] text-white/50 tabular-nums">{value.toFixed(step < 1 ? 2 : 0)}{unit ?? ""}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1 rounded-full appearance-none bg-white/10 accent-blue-500 cursor-pointer" />
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between py-1.5 cursor-pointer group">
      <span className="text-xs text-white/60 group-hover:text-white/80 transition-colors">{label}</span>
      <button onClick={() => onChange(!value)}
        className={`w-8 h-4 rounded-full transition-colors relative flex-shrink-0 ${value ? "bg-blue-600" : "bg-white/15"}`}>
        <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${value ? "left-[18px]" : "left-0.5"}`} />
      </button>
    </label>
  );
}

function Toast({ msg }: { msg: string }) {
  return msg ? (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-xs text-white backdrop-blur-md pointer-events-none">
      {msg}
    </div>
  ) : null;
}

function PanelHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 py-2.5 text-[9px] uppercase tracking-widest text-white/25 font-bold flex-shrink-0 border-b border-white/5">
      {children}
    </div>
  );
}

// ─── Sortable category wrapper ────────────────────────────────────────────────

function SortableCategoryItem({
  id,
  children,
}: {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  children: (dragHandleProps: Record<string, any>) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.45 : 1 }}
    >
      {children({ ...listeners, ...attributes })}
    </div>
  );
}

// ─── Options Tree ─────────────────────────────────────────────────────────────

function OptionsTree({
  categories, activeOptionId, glbMeshNames, onActivate, onOptionDoubleClick,
  onCaptureCamera, onClearCamera, onSetDefault, onCategoryClick, onUpdateShowWhen,
  onCategoryAdded, onCategoryUpdated, onCategoryDeleted,
  onOptionAdded, onOptionUpdated, onOptionDeleted,
  onReorder, onOptionReorder,
  projectId,
}: {
  categories: CategoryWithOptions[];
  activeOptionId: string | null;
  glbMeshNames: Set<string>;
  onActivate: (id: string | null) => void;
  onOptionDoubleClick?: (optId: string) => void;
  onCaptureCamera?: (catId: string) => void;
  onClearCamera?: (catId: string) => void;
  onSetDefault?: (catId: string, optName: string) => void;
  onCategoryClick?: (cat: CategoryWithOptions) => void;
  onUpdateShowWhen?: (catId: string, showWhen: string[]) => void;
  onCategoryAdded?: (cat: CategoryWithOptions) => void;
  onCategoryUpdated?: (catId: string, name: string, phase: Phase) => void;
  onCategoryDeleted?: (catId: string) => void;
  onOptionAdded?: (catId: string, opt: CategoryWithOptions["options"][0]) => void;
  onOptionUpdated?: (optId: string, name: string, price: number, thumbnailUrl?: string | null) => void;
  onOptionDeleted?: (optId: string, catId: string) => void;
  onReorder?: (phase: Phase, newOrder: CategoryWithOptions[]) => void;
  onOptionReorder?: (catId: string, newOptions: CategoryWithOptions["options"]) => void;
  projectId?: string;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [showWhenOpen, setShowWhenOpen] = useState<Set<string>>(new Set());
  // CRUD state
  const [addCatOpen,   setAddCatOpen]   = useState(false);
  const [newCatName,   setNewCatName]   = useState("");
  const [newCatPhase,  setNewCatPhase]  = useState<Phase>("exterior");
  const [editCatId,    setEditCatId]    = useState<string | null>(null);
  const [editCatName,  setEditCatName]  = useState("");
  const [editCatPhase, setEditCatPhase] = useState<Phase>("exterior");
  const [addOptCatId,  setAddOptCatId]  = useState<string | null>(null);
  const [newOptName,   setNewOptName]   = useState("");
  const [newOptPrice,  setNewOptPrice]  = useState("0");
  const [editOptId,    setEditOptId]    = useState<string | null>(null);
  const [editOptName,  setEditOptName]  = useState("");
  const [editOptPrice, setEditOptPrice] = useState("0");
  const [thumbUploading, setThumbUploading] = useState(false);
  const thumbFileRef   = useRef<HTMLInputElement>(null);
  const thumbTargetRef = useRef<{ optId: string; catId: string } | null>(null);

  function toggleShowWhen(catId: string) {
    setShowWhenOpen(s => { const n = new Set(s); n.has(catId) ? n.delete(catId) : n.add(catId); return n; });
  }

  function toggleCat(id: string) {
    setCollapsed(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function handleAddCategory() {
    if (!projectId || !newCatName.trim()) return;
    const cat = await createCategory({ project_id: projectId, name: newCatName.trim(), phase: newCatPhase, sort_order: categories.length });
    if (cat) {
      onCategoryAdded?.({ ...cat, options: [] });
      setNewCatName(""); setAddCatOpen(false);
    }
  }

  async function handleUpdateCategory() {
    if (!editCatId || !editCatName.trim()) return;
    const ok = await updateCategory(editCatId, { name: editCatName.trim(), phase: editCatPhase });
    if (ok) { onCategoryUpdated?.(editCatId, editCatName.trim(), editCatPhase); setEditCatId(null); }
  }

  async function handleDeleteCategory(catId: string) {
    if (!confirm("Delete this category and all its options?")) return;
    const ok = await deleteCategory(catId);
    if (ok) onCategoryDeleted?.(catId);
  }

  async function handleAddOption(catId: string) {
    if (!newOptName.trim()) return;
    const opt = await createOption({ category_id: catId, friendly_name: newOptName.trim(), price_impact: Number(newOptPrice) || 0, sort_order: (categories.find(c => c.id === catId)?.options.length ?? 0) });
    if (opt) {
      onOptionAdded?.(catId, opt);
      setNewOptName(""); setNewOptPrice("0"); setAddOptCatId(null);
    }
  }

  async function handleUpdateOption() {
    if (!editOptId || !editOptName.trim()) return;
    const ok = await updateOption(editOptId, { friendly_name: editOptName.trim(), price_impact: Number(editOptPrice) || 0 });
    if (ok) { onOptionUpdated?.(editOptId, editOptName.trim(), Number(editOptPrice) || 0); setEditOptId(null); }
  }

  async function handleDeleteOption(optId: string, catId: string) {
    if (!confirm("Delete this option?")) return;
    const ok = await deleteOption(optId);
    if (ok) onOptionDeleted?.(optId, catId);
  }

  async function handleThumbnailUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    const target = thumbTargetRef.current;
    if (!file || !target) return;
    setThumbUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("optionId", target.optId);
      const res = await fetch("/api/admin/option-thumbnail", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Upload failed");
      const opt = categories.flatMap(c => c.options).find(o => o.id === target.optId);
      if (opt) {
        await updateOption(target.optId, { thumbnail_url: data.url });
        onOptionUpdated?.(target.optId, opt.friendly_name, opt.price_impact, data.url);
      }
    } catch (err) {
      console.error("Thumbnail upload error:", err);
    } finally {
      setThumbUploading(false);
      thumbTargetRef.current = null;
    }
  }

  async function handleThumbnailClear(optId: string) {
    const opt = categories.flatMap(c => c.options).find(o => o.id === optId);
    if (!opt) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("options") as any).update({ thumbnail_url: null }).eq("id", optId);
    onOptionUpdated?.(optId, opt.friendly_name, opt.price_impact, undefined);
  }

  function handleOptionDragEnd(event: DragEndEvent, catId: string) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const cat = categories.find(c => c.id === catId);
    if (!cat) return;
    const oldIdx = cat.options.findIndex(o => o.id === active.id);
    const newIdx = cat.options.findIndex(o => o.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    onOptionReorder?.(catId, arrayMove(cat.options, oldIdx, newIdx));
  }

  // Require a 6px movement before drag activates, preventing accidental drags on click
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleDragEnd(event: DragEndEvent, phase: Phase) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const cats = grouped[phase];
    const oldIdx = cats.findIndex(c => c.id === active.id);
    const newIdx = cats.findIndex(c => c.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    onReorder?.(phase, arrayMove(cats, oldIdx, newIdx));
  }

  const grouped = useMemo(() => {
    const map: Record<Phase, CategoryWithOptions[]> = { blueprint: [], interior: [], exterior: [] };
    for (const c of categories) map[c.phase as Phase]?.push(c);
    return map;
  }, [categories]);

  return (
    <div className="flex flex-col gap-0.5">
      {/* Hidden file input for thumbnail uploads */}
      <input ref={thumbFileRef} type="file" accept="image/*" className="hidden" onChange={handleThumbnailUpload} />
      {/* Add Category */}
      <div className="px-1 pb-1 border-b border-white/6 mb-1">
        {addCatOpen ? (
          <div className="flex flex-col gap-1.5 pt-1">
            <input value={newCatName} onChange={e => setNewCatName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAddCategory()}
              autoFocus placeholder="Category name"
              className="w-full bg-[#111] border border-white/15 rounded-md px-2 py-1 text-[10px] text-white/80 focus:outline-none focus:border-blue-500/50" />
            <div className="flex gap-1">
              <select value={newCatPhase} onChange={e => setNewCatPhase(e.target.value as Phase)}
                className="flex-1 bg-[#111] border border-white/15 rounded-md px-1.5 py-1 text-[10px] text-white/60 focus:outline-none">
                {PHASES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <button onClick={handleAddCategory} disabled={!newCatName.trim()}
                className="px-2 py-1 bg-blue-600 text-white rounded-md text-[10px] font-medium disabled:opacity-40 hover:bg-blue-500">Add</button>
              <button onClick={() => { setAddCatOpen(false); setNewCatName(""); }}
                className="px-2 py-1 border border-white/12 text-white/40 rounded-md text-[10px] hover:text-white">✕</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAddCatOpen(true)}
            className="w-full flex items-center gap-1.5 px-2 py-1 text-left text-white/30 hover:text-white/60 hover:bg-white/4 rounded-md transition-colors text-[10px]">
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Category
          </button>
        )}
      </div>

      {PHASES.map(phase => {
        const cats = grouped[phase];
        if (!cats.length) return null;
        return (
          <div key={phase}>
            <div className="flex items-center gap-1.5 px-1 py-1.5 mt-1">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PHASE_DOT[phase]}`} />
              <span className="text-[9px] text-white/25 uppercase tracking-widest font-semibold">{phase}</span>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEnd(e, phase)}>
              <SortableContext items={cats.map(c => c.id)} strategy={verticalListSortingStrategy}>
            {cats.map(cat => (
              <SortableCategoryItem key={cat.id} id={cat.id}>
              {(dragHandleProps) => (
              <div>
                <div className="flex items-center group/cat">
                  <button
                    {...dragHandleProps}
                    title="Drag to reorder"
                    className="flex-shrink-0 px-0.5 py-1 text-white/12 hover:text-white/35 cursor-grab active:cursor-grabbing opacity-0 group-hover/cat:opacity-100 transition-colors touch-none">
                    <svg className="w-2.5 h-3" viewBox="0 0 10 16" fill="currentColor">
                      <circle cx="3" cy="3" r="1.2"/><circle cx="7" cy="3" r="1.2"/>
                      <circle cx="3" cy="8" r="1.2"/><circle cx="7" cy="8" r="1.2"/>
                      <circle cx="3" cy="13" r="1.2"/><circle cx="7" cy="13" r="1.2"/>
                    </svg>
                  </button>
                  {editCatId === cat.id ? (
                    <div className="flex-1 flex flex-col gap-1 px-1.5 py-1">
                      <input value={editCatName} onChange={e => setEditCatName(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleUpdateCategory()}
                        autoFocus className="w-full bg-[#111] border border-blue-500/40 rounded-md px-2 py-1 text-[10px] text-white/80 focus:outline-none" />
                      <div className="flex gap-1">
                        <select value={editCatPhase} onChange={e => setEditCatPhase(e.target.value as Phase)}
                          className="flex-1 bg-[#111] border border-white/15 rounded-md px-1.5 py-1 text-[10px] text-white/60 focus:outline-none">
                          {PHASES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <button onClick={handleUpdateCategory}
                          className="px-2 py-0.5 bg-blue-600 text-white rounded text-[9px] hover:bg-blue-500">Save</button>
                        <button onClick={() => setEditCatId(null)}
                          className="px-2 py-0.5 border border-white/12 text-white/40 rounded text-[9px] hover:text-white">✕</button>
                      </div>
                    </div>
                  ) : (
                  <button
                    onClick={() => { toggleCat(cat.id); onCategoryClick?.(cat); }}
                    className="flex items-center gap-1.5 px-2 py-1.5 text-left hover:bg-white/4 rounded-lg transition-colors flex-1 min-w-0">
                    <span className="text-white/20 text-[9px]">{collapsed.has(cat.id) ? "▸" : "▾"}</span>
                    <span className={`text-xs flex-1 truncate ${cat.camera_override ? "text-white/70" : "text-white/55"}`}>{cat.name}</span>
                    {cat.camera_override && <span className="text-[8px] text-blue-400/50 flex-shrink-0">●</span>}
                    <span className={`text-[8px] font-bold uppercase px-1 py-0.5 rounded flex-shrink-0 ${PHASE_COLOR[cat.phase as Phase] ?? "text-white/20"}`}>{cat.phase.slice(0,3)}</span>
                    <span className="text-[9px] text-white/20">{cat.options.length}</span>
                  </button>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); onCaptureCamera?.(cat.id); }}
                    title={cat.camera_override ? "Re-capture camera for this category" : "Capture current camera for this category"}
                    className={`flex-shrink-0 p-1 rounded transition-colors opacity-0 group-hover/cat:opacity-100 ${
                      cat.camera_override ? "text-blue-400 hover:text-blue-300" : "text-white/25 hover:text-white/60"
                    }`}>
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <circle cx="12" cy="13" r="3" />
                    </svg>
                  </button>
                  {cat.camera_override && (
                    <button
                      onClick={e => { e.stopPropagation(); onClearCamera?.(cat.id); }}
                      title="Clear category camera"
                      className="flex-shrink-0 p-1 rounded text-white/15 hover:text-red-400 transition-colors opacity-0 group-hover/cat:opacity-100">
                      <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                  {/* Visibility rule toggle */}
                  <button
                    onClick={e => { e.stopPropagation(); toggleShowWhen(cat.id); }}
                    title="Set visibility condition"
                    className={`flex-shrink-0 p-1 rounded transition-colors opacity-0 group-hover/cat:opacity-100 ${
                      (cat.show_when?.length ?? 0) > 0
                        ? "text-amber-400/70 hover:text-amber-300 opacity-100"
                        : "text-white/25 hover:text-white/60"
                    }`}>
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                  {/* Edit/Delete category */}
                  {editCatId !== cat.id && (<>
                    <button
                      onClick={e => { e.stopPropagation(); setEditCatId(cat.id); setEditCatName(cat.name); setEditCatPhase(cat.phase as Phase); }}
                      title="Rename / change phase"
                      className="flex-shrink-0 p-1 rounded text-white/15 hover:text-white/60 transition-colors opacity-0 group-hover/cat:opacity-100">
                      <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); handleDeleteCategory(cat.id); }}
                      title="Delete category"
                      className="flex-shrink-0 p-1 rounded text-white/15 hover:text-red-400 transition-colors opacity-0 group-hover/cat:opacity-100">
                      <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </>)}
                </div>

                {/* Visibility rule editor */}
                {showWhenOpen.has(cat.id) && (
                  <div className="mx-2 mb-1.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-2 py-2 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] text-amber-400/60 uppercase tracking-wider font-semibold">Show when…</span>
                      {(cat.show_when?.length ?? 0) > 0 && (
                        <button
                          onClick={() => onUpdateShowWhen?.(cat.id, [])}
                          className="text-[8px] text-white/25 hover:text-red-400 transition-colors">
                          Clear all
                        </button>
                      )}
                    </div>

                    {/* Active conditions */}
                    {(cat.show_when?.length ?? 0) === 0 ? (
                      <p className="text-[8px] text-white/20 italic">Always visible — no condition set</p>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {cat.show_when!.map(optId => {
                          const triggerOpt = categories.flatMap(c => c.options).find(o => o.id === optId);
                          const triggerCat = categories.find(c => c.options.some(o => o.id === optId));
                          return (
                            <span key={optId} className="flex items-center gap-1 text-[8px] bg-amber-500/10 border border-amber-500/25 text-amber-300/80 rounded-full pl-1.5 pr-1 py-0.5">
                              <span className="text-amber-500/50">{triggerCat?.name}:</span>
                              {triggerOpt?.friendly_name ?? optId}
                              <button
                                onClick={() => onUpdateShowWhen?.(cat.id, cat.show_when!.filter(id => id !== optId))}
                                className="text-amber-500/40 hover:text-red-400 transition-colors leading-none ml-0.5">✕</button>
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Add condition dropdown */}
                    <select
                      defaultValue=""
                      onChange={e => {
                        const optId = e.target.value;
                        if (!optId) return;
                        e.target.value = "";
                        const already = cat.show_when ?? [];
                        if (!already.includes(optId)) onUpdateShowWhen?.(cat.id, [...already, optId]);
                      }}
                      className="w-full bg-[#111] border border-white/10 rounded-md px-2 py-1 text-[9px] text-white/50 outline-none focus:border-amber-500/40">
                      <option value="">+ Add condition…</option>
                      {categories
                        .filter(c => c.id !== cat.id)
                        .map(c => (
                          <optgroup key={c.id} label={`${c.phase.toUpperCase()} · ${c.name}`}>
                            {c.options.map(o => (
                              <option key={o.id} value={o.id} disabled={cat.show_when?.includes(o.id)}>
                                {o.friendly_name}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                    </select>
                  </div>
                )}

                {!collapsed.has(cat.id) && (<>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={e => handleOptionDragEnd(e, cat.id)}>
                    <SortableContext items={cat.options.map(o => o.id)} strategy={verticalListSortingStrategy}>
                  {cat.options.map(opt => {
                    const isActive  = opt.id === activeOptionId;
                    const isDefault = cat.default_option === opt.friendly_name;
                    const allNodes  = opt.node_list ?? [];
                    const glbNodes  = glbMeshNames.size > 0 ? allNodes.filter(n => glbMeshNames.has(n)) : allNodes;
                    const staleCount = glbMeshNames.size > 0 ? allNodes.length - glbNodes.length : 0;
                    const assignments = opt.material_assignments ?? [];
                    const isThumbLoading = thumbUploading && thumbTargetRef.current?.optId === opt.id;
                    return (
                      <SortableCategoryItem key={opt.id} id={opt.id}>
                      {(optDragHandleProps) => (
                      <div
                        className={`ml-3 rounded-lg mb-0.5 border transition-colors group/opt ${
                          isActive ? "bg-blue-600/12 border-blue-500/30" : "border-transparent hover:bg-white/4"
                        }`}>
                        {editOptId === opt.id ? (
                          <div className="flex flex-col gap-1 px-2 py-1.5">
                            <input value={editOptName} onChange={e => setEditOptName(e.target.value)}
                              onKeyDown={e => e.key === "Enter" && handleUpdateOption()}
                              autoFocus className="w-full bg-[#111] border border-blue-500/40 rounded-md px-2 py-1 text-[10px] text-white/80 focus:outline-none" />
                            <div className="flex items-center gap-1">
                              <span className="text-white/30 text-[9px]">$</span>
                              <input type="number" value={editOptPrice} onChange={e => setEditOptPrice(e.target.value)}
                                className="w-16 bg-[#111] border border-white/15 rounded-md px-1.5 py-1 text-[10px] text-white/80 focus:outline-none" />
                              <button onClick={handleUpdateOption}
                                className="px-2 py-0.5 bg-blue-600 text-white rounded text-[9px] hover:bg-blue-500">Save</button>
                              <button onClick={() => setEditOptId(null)}
                                className="px-2 py-0.5 border border-white/12 text-white/40 rounded text-[9px] hover:text-white">✕</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center">
                            <button
                              {...optDragHandleProps}
                              title="Drag to reorder"
                              className="flex-shrink-0 px-0.5 py-1 text-white/12 hover:text-white/35 cursor-grab active:cursor-grabbing opacity-0 group-hover/opt:opacity-100 transition-colors touch-none">
                              <svg className="w-2 h-2.5" viewBox="0 0 10 16" fill="currentColor">
                                <circle cx="3" cy="3" r="1.2"/><circle cx="7" cy="3" r="1.2"/>
                                <circle cx="3" cy="8" r="1.2"/><circle cx="7" cy="8" r="1.2"/>
                                <circle cx="3" cy="13" r="1.2"/><circle cx="7" cy="13" r="1.2"/>
                              </svg>
                            </button>
                            <button
                              onClick={() => onActivate(isActive ? null : opt.id)}
                              onDoubleClick={(e) => { e.stopPropagation(); onOptionDoubleClick?.(opt.id); }}
                              className="flex items-center gap-1.5 px-2 py-1.5 text-left flex-1 min-w-0">
                              {opt.thumbnail_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={opt.thumbnail_url} alt="" className="w-4 h-4 rounded flex-shrink-0 object-cover border border-white/10" />
                              ) : (
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? "bg-blue-400" : "bg-white/15"}`} />
                              )}
                              <span className={`text-xs flex-1 truncate ${isActive ? "text-white" : "text-white/55"}`}>
                                {opt.friendly_name}
                              </span>
                              {staleCount > 0 && (
                                <span className="text-[9px] text-amber-400/60" title={`${staleCount} stale node${staleCount !== 1 ? "s" : ""} not in GLB`}>⚠</span>
                              )}
                              {glbNodes.length > 0 && (
                                <span className="text-[9px] text-white/20">{glbNodes.length}n</span>
                              )}
                              {assignments.length > 0 && (
                                <span className="text-[9px] text-violet-400/50">{assignments.length}mat</span>
                              )}
                            </button>
                            {/* Thumbnail upload button */}
                            <button
                              onClick={e => { e.stopPropagation(); thumbTargetRef.current = { optId: opt.id, catId: cat.id }; thumbFileRef.current?.click(); }}
                              title={opt.thumbnail_url ? "Change thumbnail" : "Add thumbnail"}
                              disabled={isThumbLoading}
                              className="flex-shrink-0 p-1 rounded text-white/15 hover:text-white/60 transition-colors opacity-0 group-hover/opt:opacity-100 disabled:opacity-40">
                              {isThumbLoading ? (
                                <svg className="w-2.5 h-2.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/>
                                </svg>
                              ) : (
                                <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                  <circle cx="12" cy="13" r="3" />
                                </svg>
                              )}
                            </button>
                            {/* Clear thumbnail */}
                            {opt.thumbnail_url && (
                              <button
                                onClick={e => { e.stopPropagation(); handleThumbnailClear(opt.id); }}
                                title="Remove thumbnail"
                                className="flex-shrink-0 p-1 rounded text-white/15 hover:text-amber-400 transition-colors opacity-0 group-hover/opt:opacity-100">
                                <svg className="w-2 h-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            )}
                            <button
                              onClick={e => { e.stopPropagation(); onSetDefault?.(cat.id, opt.friendly_name); }}
                              title={isDefault ? "Remove as default" : "Set as default"}
                              className={`flex-shrink-0 p-1 rounded transition-colors ${
                                isDefault
                                  ? "text-amber-400 opacity-100"
                                  : "text-white/15 opacity-0 group-hover/opt:opacity-100 hover:text-amber-400"
                              }`}>
                              <svg className="w-3 h-3" viewBox="0 0 24 24" fill={isDefault ? "currentColor" : "none"} stroke="currentColor" strokeWidth={isDefault ? 0 : 2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                              </svg>
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); setEditOptId(opt.id); setEditOptName(opt.friendly_name); setEditOptPrice(String(opt.price_impact)); }}
                              title="Rename option"
                              className="flex-shrink-0 p-1 rounded text-white/15 hover:text-white/60 transition-colors opacity-0 group-hover/opt:opacity-100">
                              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                            </button>
                            <button
                              onClick={e => { e.stopPropagation(); handleDeleteOption(opt.id, cat.id); }}
                              title="Delete option"
                              className="flex-shrink-0 p-1 rounded text-white/15 hover:text-red-400 transition-colors opacity-0 group-hover/opt:opacity-100">
                              <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        )}
                      </div>
                      )}
                      </SortableCategoryItem>
                    );
                  })}
                    </SortableContext>
                  </DndContext>
                  {/* Add option */}
                  {addOptCatId === cat.id ? (
                    <div className="ml-3 px-2 py-1.5 flex flex-col gap-1">
                      <input value={newOptName} onChange={e => setNewOptName(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleAddOption(cat.id)}
                        autoFocus placeholder="Option name"
                        className="w-full bg-[#111] border border-blue-500/40 rounded-md px-2 py-1 text-[10px] text-white/80 focus:outline-none" />
                      <div className="flex items-center gap-1">
                        <span className="text-white/30 text-[9px]">$</span>
                        <input type="number" value={newOptPrice} onChange={e => setNewOptPrice(e.target.value)}
                          placeholder="0"
                          className="w-16 bg-[#111] border border-white/15 rounded-md px-1.5 py-1 text-[10px] text-white/80 focus:outline-none" />
                        <button onClick={() => handleAddOption(cat.id)} disabled={!newOptName.trim()}
                          className="px-2 py-0.5 bg-blue-600 text-white rounded text-[9px] disabled:opacity-40 hover:bg-blue-500">Add</button>
                        <button onClick={() => { setAddOptCatId(null); setNewOptName(""); setNewOptPrice("0"); }}
                          className="px-2 py-0.5 border border-white/12 text-white/40 rounded text-[9px] hover:text-white">✕</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => { setAddOptCatId(cat.id); setNewOptName(""); setNewOptPrice("0"); }}
                      className="ml-3 px-2 py-1 flex items-center gap-1 text-white/20 hover:text-white/50 text-[9px] transition-colors">
                      <svg className="w-2 h-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      Add option
                    </button>
                  )}
                </>)}
              </div>
              )}
              </SortableCategoryItem>
            ))}
              </SortableContext>
            </DndContext>
          </div>
        );
      })}
    </div>
  );
}

// ─── Option Properties Panel (bottom-left) ───────────────────────────────────

// Flat option picker across multiple categories — used in condition editor
function ConditionOptionSelect({
  categories, currentConditionOptId, onSelect,
}: {
  categories: CategoryWithOptions[];
  currentConditionOptId: string | null;
  onSelect: (optId: string) => void;
}) {
  return (
    <select
      value={currentConditionOptId ?? ""}
      onChange={e => e.target.value && onSelect(e.target.value)}
      className="w-full px-1.5 py-1 bg-[#111] border border-purple-500/30 rounded text-[9px] text-white focus:outline-none focus:border-purple-400/50">
      <option value="">— pick option —</option>
      {categories.map(cat => (
        <optgroup key={cat.id} label={cat.name}>
          {cat.options.map(opt => (
            <option key={opt.id} value={opt.id}>{opt.friendly_name}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return hidden ? (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function OptionPropertiesPanel({
  activeOption, selectedMeshes, materials, glbMaterials, glbMeshNames,
  allCategories, shapeNames, allShapes,
  deletedMeshes, onToggleHidden,
  onRemoveMaterialAssignment, onRemoveMesh, onRemoveStale, onSelectMesh, onSelectAll, onAssignMeshes, onAssignMeshesToCategory, paintMatId, onPaintApply,
  onSetCondition, onSetConditionBulk,
}: {
  activeOption: CategoryWithOptions["options"][0] | null;
  selectedMeshes: string[];
  materials: MaterialLibraryEntry[];
  glbMaterials: GlbMaterialInfo[];
  glbMeshNames: Set<string>;
  allCategories: CategoryWithOptions[];
  shapeNames?: Set<string>;
  allShapes?: PlacedShapeData[];
  deletedMeshes?: Set<string>;
  onToggleHidden?: (name: string) => void;
  onRemoveMaterialAssignment: (optionId: string, meshName: string) => Promise<void>;
  onRemoveMesh: (optionId: string, meshName: string) => Promise<void>;
  onRemoveStale: (optionId: string) => Promise<void>;
  onSelectMesh: (meshName: string) => void;
  onSelectAll: (names: string[]) => void;
  onAssignMeshes: (optionId: string, meshNames: string[]) => Promise<void>;
  onAssignMeshesToCategory: (categoryId: string, meshNames: string[]) => Promise<void>;
  paintMatId: string | null;
  onPaintApply: (optionId: string, meshName: string, matId: string) => Promise<void>;
  onSetCondition: (optionId: string, meshName: string, conditionOptionId: string | null) => Promise<void>;
  onSetConditionBulk: (optionId: string, meshNames: string[], conditionOptionId: string | null) => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [conditionMesh, setConditionMesh] = useState<string | null>(null);
  const [bulkCondOpen,  setBulkCondOpen]  = useState(false);

  if (!activeOption) {
    return <div className="flex-1 flex items-center justify-center text-white/15 text-[10px] px-4 text-center">Activate an option to see its meshes</div>;
  }

  const allNodes      = activeOption.node_list ?? [];
  // Nodes are "known" if they exist in the loaded GLB OR are a placed shape name.
  const isKnownNode   = (n: string) => glbMeshNames.has(n) || (shapeNames?.has(n) ?? false);
  const knownNodes    = glbMeshNames.size > 0 || (shapeNames?.size ?? 0) > 0
    ? allNodes.filter(isKnownNode)
    : allNodes;
  const glbNodes      = knownNodes; // keep alias for existing code below
  const visible       = search ? knownNodes.filter(n => n.toLowerCase().includes(search.toLowerCase())) : knownNodes;
  const sketchOnly    = allNodes.length - knownNodes.length;
  const assignments   = activeOption.material_assignments ?? [];
  const nodeConditions: Record<string, string> = (activeOption as any).node_conditions ?? {};
  const allVisibleSelected = visible.length > 0 && visible.every(n => selectedMeshes.includes(n));

  function matById(id: string) { return materials.find(m => m.id === id) ?? null; }
  function glbMatByName(name: string) { return glbMaterials.find(m => m.name === name) ?? null; }

  // Flatten all options across all categories except this option's own category
  const otherCategoryOptions = allCategories.filter(c => c.id !== activeOption.category_id);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-white/8 flex items-center justify-between gap-2">
        <span className="text-[10px] text-white/60 truncate font-medium flex-1 min-w-0">{activeOption.friendly_name}</span>
        <button
          onClick={() => onSelectAll(allVisibleSelected ? [] : visible)}
          className="flex-shrink-0 text-[9px] text-white/25 hover:text-white/60 transition-colors px-1.5 py-0.5 rounded hover:bg-white/5 whitespace-nowrap">
          {allVisibleSelected ? "Clear" : "Select all"}
        </button>
      </div>

      {/* Search */}
      <div className="flex-shrink-0 px-2 pt-1.5 pb-1">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${glbNodes.length} node${glbNodes.length !== 1 ? "s" : ""}…`}
          className="w-full px-2 py-1 text-[10px] bg-white/5 border border-white/[0.08] rounded-lg text-white placeholder-white/20 outline-none focus:border-blue-500/40"
        />
      </div>

      {/* Assign / bulk-condition toolbar */}
      {selectedMeshes.length > 0 && (
        <div className="flex-shrink-0 px-2 pb-1.5 flex flex-col gap-1">
          <div className="flex gap-1">
            <button onClick={() => onAssignMeshes(activeOption.id, selectedMeshes)}
              className="flex-1 py-1 text-[10px] font-semibold bg-blue-600/20 hover:bg-blue-600/35 border border-blue-500/30 text-blue-300 rounded-lg transition-colors">
              + Assign {selectedMeshes.length}
            </button>
            <button
              onClick={() => { setBulkCondOpen(v => !v); setConditionMesh(null); }}
              title="Set visibility condition for all selected meshes"
              className={`px-2.5 py-1 text-[10px] font-semibold rounded-lg border transition-colors ${
                bulkCondOpen
                  ? "bg-purple-600/30 border-purple-500/50 text-purple-300"
                  : "bg-white/5 border-white/10 text-white/40 hover:text-purple-300 hover:border-purple-500/30 hover:bg-purple-500/10"
              }`}>
              ⊙ Condition
            </button>
          </div>
          <button
            onClick={() => onAssignMeshesToCategory(activeOption.category_id, selectedMeshes)}
            title="Add selected meshes to every option in this category"
            className="w-full py-1 text-[10px] font-semibold bg-white/5 hover:bg-blue-600/20 border border-white/10 hover:border-blue-500/30 text-white/40 hover:text-blue-300 rounded-lg transition-colors"
          >
            + Assign to all in category
          </button>
          {bulkCondOpen && (
            <div className="px-2 py-2 bg-purple-500/8 border border-purple-500/20 rounded-lg flex flex-col gap-1.5">
              <p className="text-[8px] text-purple-300/70 uppercase tracking-wider font-semibold">
                Show {selectedMeshes.length} mesh{selectedMeshes.length !== 1 ? "es" : ""} only when…
              </p>
              {otherCategoryOptions.length === 0 ? (
                <p className="text-[8px] text-white/25">No other categories in this project.</p>
              ) : (
                <ConditionOptionSelect
                  categories={otherCategoryOptions}
                  currentConditionOptId={null}
                  onSelect={async optId => {
                    const targets = selectedMeshes.filter(n => glbNodes.includes(n));
                    await onSetConditionBulk(activeOption.id, targets, optId || null);
                    setBulkCondOpen(false);
                  }}
                />
              )}
              <button onClick={async () => {
                const targets = selectedMeshes.filter(n => glbNodes.includes(n));
                await onSetConditionBulk(activeOption.id, targets, null);
                setBulkCondOpen(false);
              }}
                className="text-[8px] text-white/25 hover:text-red-400 transition-colors self-start">
                ✕ Clear conditions from selected
              </button>
            </div>
          )}
        </div>
      )}

      {/* Mesh list */}
      <div className="flex-1 overflow-y-auto px-2 py-0.5" style={{ scrollbarWidth: "none" }}>
        {visible.length === 0 && glbNodes.length > 0 ? (
          <p className="text-[9px] text-white/20 text-center py-4">No matches</p>
        ) : visible.length === 0 ? (
          <p className="text-[9px] text-white/20 text-center py-4">No nodes assigned</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {visible.map((meshName: string) => {
              const assignment = assignments.find(a => a.mesh_name === meshName);
              const isGlbMat = assignment?.material_id?.startsWith("glb:");
              const mat    = assignment && !isGlbMat ? matById(assignment.material_id) : null;
              const glbMat = assignment && isGlbMat ? glbMatByName(assignment.material_id.slice(4)) : null;
              const matColor = mat?.base_color ?? glbMat?.color;
              const matName  = mat?.name ?? glbMat?.name;
              const isSelected = selectedMeshes.includes(meshName);
              const isHidden   = !!deletedMeshes?.has(meshName);
              const conditionOptId = nodeConditions[meshName] ?? null;
              const conditionOpt   = conditionOptId
                ? allCategories.flatMap(c => c.options).find(o => o.id === conditionOptId)
                : null;
              const conditionCat   = conditionOptId
                ? allCategories.find(c => c.options.some(o => o.id === conditionOptId))
                : null;
              const isEditingCond  = conditionMesh === meshName;

              return (
                <div key={meshName} className="flex flex-col">
                  {/* Main row */}
                  <div
                    className={`flex items-center gap-1.5 px-1.5 py-1 rounded-md cursor-pointer transition-colors group/mesh ${
                      isHidden ? "opacity-40" :
                      paintMatId ? "hover:bg-teal-500/20" : isSelected ? "bg-blue-600/15 border border-blue-500/25" : "bg-white/4 hover:bg-white/8"
                    }`}
                    onClick={() => { if (paintMatId) onPaintApply(activeOption.id, meshName, paintMatId); else onSelectMesh(meshName); }}>
                    {matColor ? <Swatch color={matColor} size={10} /> : <span className="w-2.5 h-2.5 rounded-full bg-white/10 flex-shrink-0" />}
                    <span className={`text-[9px] font-mono flex-1 truncate ${isHidden ? "line-through text-white/30" : isSelected ? "text-blue-300" : "text-white/50"}`}>{meshName}</span>
                    {/* Condition badge */}
                    {conditionOpt && !isEditingCond && (
                      <span className="text-[7px] text-purple-300/70 bg-purple-500/15 border border-purple-500/20 px-1 py-0.5 rounded truncate max-w-[56px] group-hover/mesh:hidden">
                        if {conditionOpt.friendly_name}
                      </span>
                    )}
                    {matName && !isHidden && !conditionOpt && <span className="text-[8px] text-white/20 truncate max-w-[48px] group-hover/mesh:hidden">{matName}</span>}
                    {/* Condition toggle button */}
                    <button onClick={e => { e.stopPropagation(); setConditionMesh(isEditingCond ? null : meshName); }}
                      title="Set visibility condition"
                      className={`flex-shrink-0 p-0.5 rounded transition-colors text-[9px] ${
                        conditionOptId ? "text-purple-400/70" : "opacity-0 group-hover/mesh:opacity-100 text-white/20 hover:text-purple-400"
                      }`}>
                      ⊙
                    </button>
                    {onToggleHidden && (
                      <button onClick={e => { e.stopPropagation(); onToggleHidden(meshName); }}
                        title={isHidden ? "Show mesh" : "Hide mesh"}
                        className={`flex-shrink-0 p-0.5 rounded transition-colors ${isHidden ? "text-white/40" : "opacity-0 group-hover/mesh:opacity-100 text-white/20 hover:text-white/70"}`}>
                        <EyeIcon hidden={isHidden} />
                      </button>
                    )}
                    {assignment && (
                      <button onClick={e => { e.stopPropagation(); onRemoveMaterialAssignment(activeOption.id, meshName); }}
                        title="Remove material from mesh"
                        className="hidden group-hover/mesh:flex w-4 h-4 items-center justify-center rounded text-white/20 hover:text-orange-400 hover:bg-orange-900/30 transition-colors text-[9px]">⊘</button>
                    )}
                    <button onClick={e => { e.stopPropagation(); onRemoveMesh(activeOption.id, meshName); }}
                      className="hidden group-hover/mesh:flex w-4 h-4 items-center justify-center rounded text-white/20 hover:text-red-400 hover:bg-red-900/30 transition-colors text-[9px]">✕</button>
                  </div>

                  {/* Inline condition editor */}
                  {isEditingCond && (
                    <div className="ml-3 mb-1 px-2 py-2 bg-purple-500/8 border border-purple-500/20 rounded-lg flex flex-col gap-1.5">
                      <p className="text-[8px] text-purple-300/70 uppercase tracking-wider font-semibold">Show only when…</p>
                      {otherCategoryOptions.length === 0 ? (
                        <p className="text-[8px] text-white/25">No other categories in this project.</p>
                      ) : (
                        <>
                          <select
                            defaultValue={conditionCat?.id ?? ""}
                            onChange={e => {
                              // Reset option when category changes
                              const el = e.currentTarget.closest(".cond-editor")?.querySelector(".cond-opt-select") as HTMLSelectElement | null;
                              if (el) el.value = "";
                            }}
                            className="cond-cat-select w-full px-1.5 py-1 bg-[#111] border border-white/10 rounded text-[9px] text-white focus:outline-none">
                            <option value="">— pick category —</option>
                            {otherCategoryOptions.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                          <ConditionOptionSelect
                            categories={otherCategoryOptions}
                            currentConditionOptId={conditionOptId}
                            onSelect={optId => {
                              onSetCondition(activeOption.id, meshName, optId || null);
                              setConditionMesh(null);
                            }}
                          />
                        </>
                      )}
                      {conditionOptId && (
                        <button onClick={() => { onSetCondition(activeOption.id, meshName, null); setConditionMesh(null); }}
                          className="text-[8px] text-white/25 hover:text-red-400 transition-colors self-start">
                          ✕ Remove condition
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {sketchOnly > 0 && (
          <div className="mt-2 border border-amber-500/20 rounded-lg bg-amber-500/5 px-2 py-1.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] text-amber-400/70 font-semibold">⚠ {sketchOnly} stale node{sketchOnly !== 1 ? "s" : ""} (not in GLB)</span>
              <button
                onClick={() => onRemoveStale(activeOption.id)}
                className="text-[8px] text-amber-400/60 hover:text-amber-300 transition-colors font-medium">
                Remove all
              </button>
            </div>
            <div className="flex flex-col gap-px">
              {allNodes.filter(n => !isKnownNode(n)).slice(0, 6).map(n => (
                <div key={n} className="flex items-center gap-1 group/stale">
                  <span className="text-[8px] font-mono text-amber-500/40 flex-1 truncate">{n}</span>
                  <button
                    onClick={() => onRemoveMesh(activeOption.id, n)}
                    className="hidden group-hover/stale:flex w-3 h-3 items-center justify-center text-amber-500/50 hover:text-red-400 text-[7px]">✕</button>
                </div>
              ))}
              {sketchOnly > 6 && <span className="text-[7px] text-white/15">+{sketchOnly - 6} more…</span>}
            </div>
          </div>
        )}

        {/* Shapes section */}
        {allShapes && allShapes.length > 0 && (() => {
          const nodeSet = new Set(allNodes);
          const assignedShapes = allShapes.filter(s => nodeSet.has(s.name));
          const availableShapes = allShapes.filter(s => !nodeSet.has(s.name));
          if (assignedShapes.length === 0 && availableShapes.length === 0) return null;
          return (
            <div className="mt-2 border border-white/8 rounded-lg px-2 py-1.5">
              <p className="text-[9px] text-white/25 uppercase tracking-wider font-semibold mb-1.5">Shapes</p>

              {/* Assigned shapes */}
              {assignedShapes.map(s => (
                <div key={s.id} className="flex items-center gap-1.5 py-0.5 group/shp">
                  <span className="text-[9px] opacity-50">{SHAPE_TYPES.find(t => t.type === s.shapeType)?.icon}</span>
                  <span className="text-[9px] font-mono text-green-400/70 flex-1 truncate">{s.name}</span>
                  <button
                    onClick={() => onRemoveMesh(activeOption.id, s.name)}
                    className="hidden group-hover/shp:flex w-3 h-3 items-center justify-center text-white/20 hover:text-red-400 text-[7px]">✕</button>
                </div>
              ))}

              {/* Available shapes to add */}
              {availableShapes.map(s => (
                <div key={s.id} className="flex items-center gap-1.5 py-0.5 group/shp">
                  <span className="text-[9px] opacity-30">{SHAPE_TYPES.find(t => t.type === s.shapeType)?.icon}</span>
                  <span className="text-[9px] font-mono text-white/30 flex-1 truncate">{s.name}</span>
                  <button
                    onClick={() => onAssignMeshes(activeOption.id, [s.name])}
                    className="hidden group-hover/shp:flex items-center gap-0.5 px-1 py-0.5 text-[8px] text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 rounded transition-colors">
                    + Add
                  </button>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// ─── Mesh / Material Properties Panel (bottom-right) ─────────────────────────

function vec3Label([x, y, z]: [number, number, number]) {
  return `${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}`;
}

function PropertiesPanel({
  selectedMeshes, meshOverrides, selectedMeshMat, selectedMeshGlbMat, glbMatOverrides,
  onEditMat, onEditGlb, onResetTransform, deletedMeshes, onDeleteMesh, onRestoreMesh,
  triangleCounts, isolationOverride, onClearIsolation,
}: {
  selectedMeshes: string[];
  meshOverrides: MeshOverrides;
  selectedMeshMat: MaterialLibraryEntry | null;
  selectedMeshGlbMat: GlbMaterialInfo | null;
  glbMatOverrides: Record<string, { base_color: string; roughness: number; metalness: number; properties?: MaterialLibraryEntry["properties"] }>;
  onEditMat: (id: string) => void;
  onEditGlb: (name: string) => void;
  onResetTransform?: (name: string) => void;
  deletedMeshes?: Set<string>;
  onDeleteMesh?: (name: string) => void;
  onRestoreMesh?: (name: string) => void;
  triangleCounts?: MeshTriangleCounts;
  isolationOverride?: string[] | null;
  onClearIsolation?: () => void;
}) {
  if (selectedMeshes.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-white/15 text-[10px] px-4 text-center gap-2">
        <span>Select a mesh or double-click a material to edit</span>
        {isolationOverride && isolationOverride.length > 0 && (
          <button onClick={onClearIsolation}
            className="px-2.5 py-1 bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-[9px] rounded-lg hover:bg-indigo-600/35 transition-colors">
            ⊙ {isolationOverride.length} mesh{isolationOverride.length !== 1 ? "es" : ""} isolated — clear (Alt+H)
          </button>
        )}
      </div>
    );
  }

  const meshName = selectedMeshes.length === 1 ? selectedMeshes[0] : null;
  const ov  = meshName ? meshOverrides[meshName] : null;
  const pos = ov?.position ?? [0, 0, 0] as [number,number,number];
  const rot = ov?.rotation ?? [0, 0, 0] as [number,number,number];
  const scl = ov?.scale    ?? [1, 1, 1] as [number,number,number];

  const isGlb     = !selectedMeshMat && !!selectedMeshGlbMat;
  const matColor  = selectedMeshMat?.base_color ?? selectedMeshGlbMat?.color ?? null;
  const matName   = selectedMeshMat?.name ?? selectedMeshGlbMat?.name ?? null;
  const glbOv     = selectedMeshGlbMat ? glbMatOverrides[selectedMeshGlbMat.name] : null;
  const roughness = selectedMeshMat?.roughness ?? glbOv?.roughness ?? selectedMeshGlbMat?.roughness;
  const metalness = selectedMeshMat?.metalness ?? glbOv?.metalness ?? selectedMeshGlbMat?.metalness;
  const hasTextures = !!(selectedMeshMat?.properties?.albedoMapUrl || selectedMeshMat?.properties?.normalMapUrl);

  function PropRow({ label, value }: { label: string; value: string }) {
    return (
      <div className="flex items-center justify-between py-1.5 border-b border-white/[0.05]">
        <span className="text-[9px] text-white/30 uppercase tracking-wider">{label}</span>
        <span className="text-[10px] text-white/55 font-mono">{value}</span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-2" style={{ scrollbarWidth: "none" }}>
      {selectedMeshes.length > 1 ? (
        <p className="text-[10px] text-white/35 py-2">{selectedMeshes.length} meshes selected</p>
      ) : (
        <>
          {/* Mesh name + triangle count */}
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/8 gap-2 min-w-0">
            <p className="text-[10px] text-white/40 font-mono truncate flex-1">{meshName}</p>
            {triangleCounts && meshName && triangleCounts[meshName] !== undefined && (
              <span className={`text-[9px] font-mono flex-shrink-0 px-1.5 py-0.5 rounded-md ${
                triangleCounts[meshName] > 50000 ? "text-amber-400/70 bg-amber-500/10" :
                triangleCounts[meshName] > 10000 ? "text-yellow-400/60 bg-yellow-500/8" : "text-white/25 bg-white/5"
              }`}>
                {(triangleCounts[meshName] / 1000).toFixed(1)}k △
              </span>
            )}
          </div>

          {/* Material card — double-click to edit */}
          {matName ? (
            <div className="mb-4">
              <p className="text-[9px] text-white/25 uppercase tracking-wider mb-1.5">Material</p>
              <button
                onDoubleClick={() => isGlb ? onEditGlb(selectedMeshGlbMat!.name) : onEditMat(selectedMeshMat!.id)}
                title="Double-click to edit"
                className="w-full flex items-center gap-2.5 px-2.5 py-2 bg-white/5 hover:bg-white/8 border border-white/10 hover:border-white/20 rounded-xl transition-colors group/matcard text-left">
                {/* Color preview */}
                <span className="w-8 h-8 rounded-lg flex-shrink-0 border border-white/15" style={{ background: matColor ?? "#888" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-white/70 truncate font-medium">{matName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {isGlb && <span className="text-[8px] text-amber-400/60 bg-amber-400/10 px-1 rounded">GLB</span>}
                    {roughness !== undefined && <span className="text-[9px] text-white/30">R {roughness.toFixed(2)}</span>}
                    {metalness !== undefined && <span className="text-[9px] text-white/30">M {metalness.toFixed(2)}</span>}
                    {hasTextures && <span className="text-[8px] text-blue-400/50">⬡ tex</span>}
                  </div>
                </div>
                <span className="text-[9px] text-white/15 group-hover/matcard:text-white/40 transition-colors flex-shrink-0">✎</span>
              </button>
              <p className="text-[8px] text-white/15 text-center mt-1">double-click to edit</p>
            </div>
          ) : (
            <div className="mb-4">
              <p className="text-[9px] text-white/25 uppercase tracking-wider mb-1.5">Material</p>
              <p className="text-[9px] text-white/20 px-1">No material assigned</p>
            </div>
          )}

          {/* Transform */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[9px] text-white/25 uppercase tracking-wider">Transform</p>
              {ov && meshName && (
                <button
                  onClick={() => onResetTransform?.(meshName)}
                  title="Reset to GLB default position"
                  className="text-[8px] text-white/25 hover:text-amber-400 transition-colors px-1.5 py-0.5 rounded hover:bg-amber-400/10">
                  Reset
                </button>
              )}
            </div>
            <PropRow label="Position" value={vec3Label(pos)} />
            <PropRow label="Rotation" value={vec3Label(rot)} />
            <PropRow label="Scale"    value={vec3Label(scl)} />
            {!ov && <p className="text-[8px] text-white/15 mt-1 italic">GLB default</p>}
          </div>

          {/* Delete / Restore mesh */}
          {meshName && (
            <div className="mt-4 pt-3 border-t border-white/8">
              {deletedMeshes?.has(meshName) ? (
                <button
                  onClick={() => onRestoreMesh?.(meshName)}
                  className="w-full py-1.5 text-[10px] font-semibold bg-green-600/15 hover:bg-green-600/25 border border-green-500/30 text-green-300 rounded-lg transition-colors">
                  Restore Mesh
                </button>
              ) : (
                <button
                  onClick={() => onDeleteMesh?.(meshName)}
                  className="w-full py-1.5 text-[10px] font-semibold bg-red-600/10 hover:bg-red-600/20 border border-red-500/25 text-red-400 rounded-lg transition-colors">
                  Delete Mesh
                </button>
              )}
              <p className="text-[8px] text-white/15 text-center mt-1">non-destructive · Save to persist</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Material Library ─────────────────────────────────────────────────────────

function MaterialLibrary({
  materials, glbMaterials, paintMatId, activeOptionId, selectedMeshes,
  onPaint, onCancelPaint, onPromoteGlb, onApplyToSelected, onEdit, onToast, onChanged,
}: {
  materials: MaterialLibraryEntry[];
  glbMaterials: GlbMaterialInfo[];
  paintMatId: string | null;
  activeOptionId: string | null;
  selectedMeshes: string[];
  onPaint: (id: string) => void;
  onCancelPaint: () => void;
  onPromoteGlb: (mat: GlbMaterialInfo) => Promise<void>;
  onApplyToSelected: () => Promise<void>;
  onEdit: (id: string) => void;
  onToast: (msg: string) => void;
  onChanged: () => void;
}) {
  const [showPresets,  setShowPresets]  = useState(false);
  const [promoting,    setPromoting]    = useState<string | null>(null);
  const [applyingAll,  setApplyingAll]  = useState(false);
  const [matSearch,    setMatSearch]    = useState("");

  async function addPreset(p: typeof PRESET_MATS[number]) {
    const r = await fetch("/api/admin/materials", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...p, normal_map_url: null, thumbnail_url: null }),
    });
    if (r.ok) { onToast(`Added "${p.name}"`); onChanged(); }
  }

  async function handlePromote(mat: GlbMaterialInfo) {
    setPromoting(mat.name);
    await onPromoteGlb(mat);
    setPromoting(null);
  }

  const paintHint = activeOptionId
    ? "Click to paint on active option meshes"
    : "Activate an option above to paint";

  const filteredMats    = matSearch ? materials.filter(m => m.name.toLowerCase().includes(matSearch.toLowerCase())) : materials;
  const filteredGlbMats = matSearch ? glbMaterials.filter(m => m.name.toLowerCase().includes(matSearch.toLowerCase())) : glbMaterials;

  return (
    <div className="flex flex-col gap-2">
      {/* Search */}
      <input
        value={matSearch} onChange={e => setMatSearch(e.target.value)}
        placeholder="Search materials…"
        className="w-full px-2.5 py-1.5 text-xs bg-white/5 border border-white/[0.08] rounded-lg text-white placeholder-white/20 outline-none focus:border-blue-500/50 flex-shrink-0"
      />

      {/* Paint mode indicator + Apply button */}
      {paintMatId && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 px-2 py-1.5 bg-blue-600/15 border border-blue-500/30 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
            <span className="text-[10px] text-blue-300 flex-1">Armed — click mesh to paint</span>
            <button onClick={onCancelPaint} className="text-[10px] text-white/30 hover:text-white transition-colors">✕</button>
          </div>
          {selectedMeshes.length > 0 && activeOptionId && (
            <button
              onClick={async () => { setApplyingAll(true); await onApplyToSelected(); setApplyingAll(false); }}
              disabled={applyingAll}
              className="w-full py-1.5 text-[10px] font-semibold bg-teal-600/20 hover:bg-teal-600/35 border border-teal-500/30 text-teal-300 rounded-lg transition-colors disabled:opacity-40">
              {applyingAll ? "Applying…" : `Apply to ${selectedMeshes.length} selected mesh${selectedMeshes.length !== 1 ? "es" : ""}`}
            </button>
          )}
          {selectedMeshes.length === 0 && (
            <p className="text-[9px] text-white/20 px-1">Select meshes in viewport or option panel to apply</p>
          )}
        </div>
      )}

      {/* GLB materials */}
      {filteredGlbMats.length > 0 && (
        <div>
          <p className="text-[9px] text-white/20 uppercase tracking-wider px-1 mb-1">From Model</p>
          <div className="flex flex-col gap-0.5">
            {filteredGlbMats.map(m => {
              const isActive = paintMatId === `glb:${m.name}`;
              return (
                <div key={m.name}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors group cursor-pointer ${
                    isActive ? "bg-blue-600/20 border border-blue-500/30" : "hover:bg-white/4 border border-transparent"
                  }`}
                  onClick={() => {
                    if (!activeOptionId) { onToast(paintHint); return; }
                    onPaint(isActive ? "" : `glb:${m.name}`);
                  }}
                  title={paintHint}>
                  <Swatch color={m.color} size={20} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white/70 text-[10px] truncate">{m.name}</p>
                    <p className="text-[9px] text-white/25">R:{m.roughness.toFixed(2)} M:{m.metalness.toFixed(2)}</p>
                  </div>
                  <button
                    onClick={async (e) => { e.stopPropagation(); await handlePromote(m); }}
                    disabled={promoting === m.name}
                    title="Add to ProPlan library"
                    className="hidden group-hover:flex text-[9px] text-white/25 hover:text-white px-1.5 py-0.5 rounded transition-colors disabled:opacity-30">
                    {promoting === m.name ? "…" : "↑ lib"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ProPlan library — grouped grid */}
      {filteredMats.length > 0 && (() => {
        const grouped = filteredMats.reduce<Record<string, MaterialLibraryEntry[]>>((acc, m) => {
          const cat = m.category ?? "Other";
          if (!acc[cat]) acc[cat] = [];
          acc[cat].push(m);
          return acc;
        }, {});
        const catOrder = ["Flooring", "Countertops", "Walls", "Exterior", "Roofing", "Cabinetry", "Windows", "Other"];
        const sortedCats = Object.keys(grouped).sort(
          (a, b) => (catOrder.indexOf(a) === -1 ? 99 : catOrder.indexOf(a)) - (catOrder.indexOf(b) === -1 ? 99 : catOrder.indexOf(b))
        );
        return (
          <div className="flex flex-col gap-3">
            <p className="text-[9px] text-white/20 uppercase tracking-wider px-1">ProPlan Library</p>
            {sortedCats.map(cat => (
              <div key={cat}>
                <p className="text-[8px] text-white/30 uppercase tracking-widest px-0.5 mb-1.5">{cat}</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {grouped[cat].map(m => {
                    const isActive = paintMatId === m.id;
                    const thumb = (m.properties as { albedoMapUrl?: string } | null)?.albedoMapUrl ?? null;
                    return (
                      <div
                        key={m.id}
                        className={`relative rounded-lg overflow-hidden cursor-pointer transition-all group/card ${
                          isActive
                            ? "ring-2 ring-blue-400 ring-offset-1 ring-offset-[#111]"
                            : "ring-1 ring-white/10 hover:ring-white/30"
                        }`}
                        style={{ aspectRatio: "1 / 1" }}
                        onClick={() => {
                          if (!activeOptionId) { onToast(paintHint); return; }
                          onPaint(isActive ? "" : m.id);
                        }}
                        onDoubleClick={e => { e.stopPropagation(); onEdit(m.id); }}
                        title={`${m.name} · Click to paint · Double-click to edit`}
                      >
                        {/* Thumbnail */}
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={m.name}
                            className="absolute inset-0 w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="absolute inset-0" style={{ backgroundColor: m.base_color }} />
                        )}

                        {/* Active overlay */}
                        {isActive && (
                          <div className="absolute inset-0 bg-blue-500/20" />
                        )}

                        {/* Name overlay */}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-1.5 pb-1 pt-4">
                          <p className="text-white text-[8px] font-medium leading-tight truncate">{m.name}</p>
                        </div>

                        {/* Edit button on hover */}
                        <button
                          onClick={e => { e.stopPropagation(); onEdit(m.id); }}
                          className="absolute top-1 right-1 w-4 h-4 rounded bg-black/60 text-white/60 hover:text-white text-[8px] flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity"
                          title="Edit material"
                        >✎</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        );
      })()}
      {matSearch && filteredMats.length === 0 && filteredGlbMats.length === 0 && (
        <p className="text-center py-4 text-white/20 text-[10px]">No materials match "{matSearch}"</p>
      )}

      {/* Starter presets */}
      <button onClick={() => setShowPresets(v => !v)}
        className="flex items-center gap-1.5 text-[9px] text-white/25 hover:text-white/45 transition-colors mt-1 px-1">
        <span>{showPresets ? "▾" : "▸"}</span>
        Starter presets ({PRESET_MATS.length})
      </button>
      {showPresets && (
        <div className="grid grid-cols-2 gap-1">
          {PRESET_MATS.map(p => (
            <button key={p.name} onClick={() => addPreset(p)}
              className="flex items-center gap-1.5 px-2 py-1.5 bg-white/4 hover:bg-white/8 rounded-lg transition-colors text-left">
              <Swatch color={p.base_color} size={14} />
              <div className="min-w-0">
                <p className="text-[9px] text-white/60 truncate">{p.name}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Props Library ────────────────────────────────────────────────────────────

// Use 1k resolution for faster downloads; texture fix in polyhaven-loader.ts rewrites paths at runtime
function phModel(id: string) { return `https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/${id}/${id}_1k.gltf`; }
function phThumb(id: string) { return `https://cdn.polyhaven.com/asset_img/thumbs/${id}.png?width=256`; }

const PROP_CATALOG: PropCatalogEntry[] = [
  // ── Trees ──
  { id: "pine_tree_01",          name: "Pine Tree",        category: "tree",  defaultScale: [1,1,1],      modelUrl: phModel("pine_tree_01"),          thumbnailUrl: phThumb("pine_tree_01") },
  { id: "fir_tree_01",           name: "Fir Tree",         category: "tree",  defaultScale: [1,1,1],      modelUrl: phModel("fir_tree_01"),           thumbnailUrl: phThumb("fir_tree_01") },
  { id: "jacaranda_tree",        name: "Jacaranda",        category: "tree",  defaultScale: [1,1,1],      modelUrl: phModel("jacaranda_tree"),        thumbnailUrl: phThumb("jacaranda_tree") },
  { id: "island_tree_01",        name: "Island Tree",      category: "tree",  defaultScale: [1,1,1],      modelUrl: phModel("island_tree_01"),        thumbnailUrl: phThumb("island_tree_01") },
  { id: "island_tree_02",        name: "Island Tree 2",    category: "tree",  defaultScale: [1,1,1],      modelUrl: phModel("island_tree_02"),        thumbnailUrl: phThumb("island_tree_02") },
  { id: "searsia_burchellii",    name: "Searsia",          category: "tree",  defaultScale: [1,1,1],      modelUrl: phModel("searsia_burchellii"),    thumbnailUrl: phThumb("searsia_burchellii") },
  { id: "searsia_lucida",        name: "Searsia Lucida",   category: "tree",  defaultScale: [1,1,1],      modelUrl: phModel("searsia_lucida"),        thumbnailUrl: phThumb("searsia_lucida") },
  { id: "tree_small_02",         name: "Small Tree",       category: "tree",  defaultScale: [1,1,1],      modelUrl: phModel("tree_small_02"),         thumbnailUrl: phThumb("tree_small_02") },
  { id: "dead_tree_trunk",       name: "Dead Tree",        category: "tree",  defaultScale: [1,1,1],      modelUrl: phModel("dead_tree_trunk"),       thumbnailUrl: phThumb("dead_tree_trunk") },
  { id: "dead_tree_trunk_02",    name: "Dead Tree 2",      category: "tree",  defaultScale: [1,1,1],      modelUrl: phModel("dead_tree_trunk_02"),    thumbnailUrl: phThumb("dead_tree_trunk_02") },
  // ── Saplings ──
  { id: "pine_sapling_medium",   name: "Pine Sapling",     category: "shrub", defaultScale: [1,1,1],      modelUrl: phModel("pine_sapling_medium"),   thumbnailUrl: phThumb("pine_sapling_medium") },
  { id: "fir_sapling_medium",    name: "Fir Sapling",      category: "shrub", defaultScale: [1,1,1],      modelUrl: phModel("fir_sapling_medium"),    thumbnailUrl: phThumb("fir_sapling_medium") },
  { id: "periwinkle_plant",      name: "Periwinkle",       category: "shrub", defaultScale: [1,1,1],      modelUrl: phModel("periwinkle_plant"),      thumbnailUrl: phThumb("periwinkle_plant") },
  { id: "potted_plant_04",       name: "Potted Plant",     category: "shrub", defaultScale: [1,1,1],      modelUrl: phModel("potted_plant_04"),       thumbnailUrl: phThumb("potted_plant_04") },
  { id: "othonna_cerarioides",   name: "Othonna",          category: "shrub", defaultScale: [1,1,1],      modelUrl: phModel("othonna_cerarioides"),   thumbnailUrl: phThumb("othonna_cerarioides") },
  { id: "calathea_orbifolia_01", name: "Calathea",         category: "shrub", defaultScale: [1,1,1],      modelUrl: phModel("calathea_orbifolia_01"), thumbnailUrl: phThumb("calathea_orbifolia_01") },
  { id: "anthurium_botany_01",   name: "Anthurium",        category: "shrub", defaultScale: [1,1,1],      modelUrl: phModel("anthurium_botany_01"),   thumbnailUrl: phThumb("anthurium_botany_01") },
  // ── Grass & Ground ──
  { id: "grass_medium_01",       name: "Grass Med",        category: "grass", defaultScale: [1,1,1],      modelUrl: phModel("grass_medium_01"),       thumbnailUrl: phThumb("grass_medium_01") },
  { id: "grass_medium_02",       name: "Grass Med 2",      category: "grass", defaultScale: [1,1,1],      modelUrl: phModel("grass_medium_02"),       thumbnailUrl: phThumb("grass_medium_02") },
  { id: "grass_bermuda_01",      name: "Bermuda Grass",    category: "grass", defaultScale: [1,1,1],      modelUrl: phModel("grass_bermuda_01"),      thumbnailUrl: phThumb("grass_bermuda_01") },
  { id: "moss_01",               name: "Moss",             category: "grass", defaultScale: [1,1,1],      modelUrl: phModel("moss_01"),               thumbnailUrl: phThumb("moss_01") },
  { id: "dandelion_01",          name: "Dandelion",        category: "grass", defaultScale: [1,1,1],      modelUrl: phModel("dandelion_01"),          thumbnailUrl: phThumb("dandelion_01") },
  { id: "celandine_01",          name: "Celandine",        category: "grass", defaultScale: [1,1,1],      modelUrl: phModel("celandine_01"),          thumbnailUrl: phThumb("celandine_01") },
  { id: "bark_debris_01",        name: "Bark Debris",      category: "grass", defaultScale: [1,1,1],      modelUrl: phModel("bark_debris_01"),        thumbnailUrl: phThumb("bark_debris_01") },
  // ── Rocks ──
  { id: "boulder_01",            name: "Boulder",          category: "rock",  defaultScale: [1,1,1],      modelUrl: phModel("boulder_01"),            thumbnailUrl: phThumb("boulder_01") },
  { id: "coast_rocks_01",        name: "Coast Rock",       category: "rock",  defaultScale: [1,1,1],      modelUrl: phModel("coast_rocks_01"),        thumbnailUrl: phThumb("coast_rocks_01") },
  { id: "coast_rocks_02",        name: "Coast Rock 2",     category: "rock",  defaultScale: [1,1,1],      modelUrl: phModel("coast_rocks_02"),        thumbnailUrl: phThumb("coast_rocks_02") },
  { id: "coast_land_rocks_02",   name: "Land Rock",        category: "rock",  defaultScale: [1,1,1],      modelUrl: phModel("coast_land_rocks_02"),   thumbnailUrl: phThumb("coast_land_rocks_02") },
  { id: "coast_land_rocks_04",   name: "Land Rock 2",      category: "rock",  defaultScale: [1,1,1],      modelUrl: phModel("coast_land_rocks_04"),   thumbnailUrl: phThumb("coast_land_rocks_04") },
];

const PROP_CAT_LABELS: Record<PropCatalogEntry["category"], string> = {
  tree: "Trees", shrub: "Plants", rock: "Rocks", grass: "Flowers", ground_cover: "Ground Cover", other: "Other",
};

// ─── Shapes panel ─────────────────────────────────────────────────────────────

const SHAPE_TYPES: { type: ShapeType; label: string; icon: string }[] = [
  { type: "box",      label: "Box",      icon: "⬜" },
  { type: "sphere",   label: "Sphere",   icon: "⬤"  },
  { type: "plane",    label: "Plane",    icon: "▬"  },
  { type: "cylinder", label: "Cylinder", icon: "⬭"  },
  { type: "cone",     label: "Cone",     icon: "▲"  },
  { type: "torus",    label: "Torus",    icon: "◎"  },
];

function ShapesPanel({
  shapes, onShapesChange, selectedShapeId, onSelectShape,
  shapeTransformMode, onSetShapeTransformMode, meshNames, materials,
}: {
  shapes: PlacedShapeData[];
  onShapesChange: (s: PlacedShapeData[]) => void;
  selectedShapeId?: string | null;
  onSelectShape?: (id: string) => void;
  shapeTransformMode?: "translate" | "rotate" | "scale";
  onSetShapeTransformMode?: (m: "translate" | "rotate" | "scale") => void;
  meshNames?: string[];
  materials?: import("@/types/database").MaterialLibraryEntry[];
}) {
  const selected = shapes.find(s => s.id === selectedShapeId) ?? null;

  function addShape(type: ShapeType) {
    const count = shapes.filter(s => s.shapeType === type).length;
    const newShape: PlacedShapeData = {
      id: Math.random().toString(36).slice(2),
      shapeType: type,
      name: `${type}_${count + 1}`,
      position: [0, 0.5, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: "#cccccc",
      roughness: 0.6,
      metalness: 0.0,
      opacity: 1.0,
    };
    onShapesChange([...shapes, newShape]);
    onSelectShape?.(newShape.id);
  }

  function updateSelected(patch: Partial<PlacedShapeData>) {
    if (!selected) return;
    onShapesChange(shapes.map(s => s.id === selected.id ? { ...s, ...patch } : s));
  }

  function removeShape(id: string) {
    onShapesChange(shapes.filter(s => s.id !== id));
    if (selectedShapeId === id) onSelectShape?.("");
  }

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Shape type grid */}
      <div className="flex-shrink-0 border-b border-white/8 px-2 py-2">
        <p className="text-[9px] uppercase tracking-wider text-white/25 mb-2">Add Shape</p>
        <div className="grid grid-cols-3 gap-1">
          {SHAPE_TYPES.map(({ type, label, icon }) => (
            <button
              key={type}
              onClick={() => addShape(type)}
              className="flex flex-col items-center gap-0.5 py-2 rounded-lg border border-white/10 bg-white/3 hover:bg-white/8 hover:border-white/20 transition-all"
            >
              <span className="text-base leading-none">{icon}</span>
              <span className="text-[9px] text-white/40">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Placed shapes list */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2" style={{ scrollbarWidth: "none" }}>
        {shapes.length === 0 ? (
          <p className="text-white/20 text-[11px] text-center mt-6">No shapes yet — click a type above</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {shapes.map(sh => {
              const isSel = selectedShapeId === sh.id;
              return (
                <div
                  key={sh.id}
                  className={`rounded-lg border transition-all cursor-pointer ${isSel ? "border-blue-500/40 bg-blue-500/10" : "border-white/8 hover:border-white/20 bg-white/3"}`}
                  onClick={() => onSelectShape?.(sh.id)}
                >
                  <div className="flex items-center gap-2 px-2 py-1.5 group">
                    <span className="text-sm leading-none opacity-60">
                      {SHAPE_TYPES.find(t => t.type === sh.shapeType)?.icon}
                    </span>
                    <span className={`flex-1 text-[11px] truncate ${isSel ? "text-blue-300" : "text-white/60"}`}>
                      {sh.name}
                    </span>
                    <div
                      className="w-3 h-3 rounded-full border border-white/20 flex-shrink-0"
                      style={{ background: sh.color }}
                    />
                    <button
                      onClick={e => { e.stopPropagation(); removeShape(sh.id); }}
                      className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-[10px] leading-none transition-opacity"
                    >✕</button>
                  </div>
                  {isSel && (
                    <div className="px-2 pb-2 flex flex-col gap-2 border-t border-white/8 pt-2">
                      {/* Transform mode */}
                      <div className="flex gap-1">
                        {(["translate","rotate","scale"] as const).map(m => (
                          <button key={m}
                            onClick={e => { e.stopPropagation(); onSetShapeTransformMode?.(m); }}
                            className={`flex-1 text-[9px] uppercase tracking-wide py-0.5 rounded transition-colors ${shapeTransformMode === m ? "bg-blue-500 text-white" : "bg-white/8 text-white/40 hover:text-white/70"}`}
                          >{m[0]}</button>
                        ))}
                      </div>
                      {/* Name */}
                      <div>
                        <p className="text-[9px] text-white/30 uppercase tracking-wide mb-0.5">Name (node ID)</p>
                        <input
                          value={sh.name}
                          onChange={e => updateSelected({ name: e.target.value })}
                          onClick={e => e.stopPropagation()}
                          className="w-full bg-white/5 text-white/80 text-[11px] px-2 py-1 rounded border border-white/10 outline-none focus:border-white/25 font-mono"
                        />
                      </div>
                      {/* Color */}
                      <div className="flex items-center gap-2">
                        <label className="text-[9px] text-white/30 uppercase tracking-wide w-16">Color</label>
                        <input
                          type="color"
                          value={sh.color}
                          onChange={e => updateSelected({ color: e.target.value })}
                          onClick={e => e.stopPropagation()}
                          className="w-8 h-6 rounded cursor-pointer border border-white/15 bg-transparent"
                        />
                      </div>
                      {/* Roughness */}
                      <div>
                        <div className="flex justify-between mb-0.5">
                          <span className="text-[9px] text-white/30 uppercase tracking-wide">Roughness</span>
                          <span className="text-[9px] text-white/40 tabular-nums">{sh.roughness.toFixed(2)}</span>
                        </div>
                        <input type="range" min={0} max={1} step={0.01} value={sh.roughness}
                          onChange={e => updateSelected({ roughness: parseFloat(e.target.value) })}
                          onClick={e => e.stopPropagation()}
                          className="w-full h-1 rounded-full appearance-none bg-white/10 accent-blue-500 cursor-pointer" />
                      </div>
                      {/* Metalness */}
                      <div>
                        <div className="flex justify-between mb-0.5">
                          <span className="text-[9px] text-white/30 uppercase tracking-wide">Metalness</span>
                          <span className="text-[9px] text-white/40 tabular-nums">{sh.metalness.toFixed(2)}</span>
                        </div>
                        <input type="range" min={0} max={1} step={0.01} value={sh.metalness}
                          onChange={e => updateSelected({ metalness: parseFloat(e.target.value) })}
                          onClick={e => e.stopPropagation()}
                          className="w-full h-1 rounded-full appearance-none bg-white/10 accent-blue-500 cursor-pointer" />
                      </div>
                      {/* Opacity */}
                      <div>
                        <div className="flex justify-between mb-0.5">
                          <span className="text-[9px] text-white/30 uppercase tracking-wide">Opacity</span>
                          <span className="text-[9px] text-white/40 tabular-nums">{sh.opacity.toFixed(2)}</span>
                        </div>
                        <input type="range" min={0} max={1} step={0.01} value={sh.opacity}
                          onChange={e => updateSelected({ opacity: parseFloat(e.target.value) })}
                          onClick={e => e.stopPropagation()}
                          className="w-full h-1 rounded-full appearance-none bg-white/10 accent-blue-500 cursor-pointer" />
                      </div>
                      {/* Wireframe toggle */}
                      <label className="flex items-center justify-between cursor-pointer" onClick={e => e.stopPropagation()}>
                        <span className="text-[9px] text-white/30 uppercase tracking-wide">Wireframe</span>
                        <button
                          onClick={() => updateSelected({ wireframe: !(sh.wireframe ?? false) })}
                          className={`w-7 h-3.5 rounded-full transition-colors relative ${sh.wireframe ? "bg-blue-600" : "bg-white/15"}`}
                        >
                          <span className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all ${sh.wireframe ? "left-[13px]" : "left-0.5"}`} />
                        </button>
                      </label>
                      {/* Material Library */}
                      {materials && materials.length > 0 && (
                        <div onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-between mb-0.5">
                            <p className="text-[9px] text-white/30 uppercase tracking-wide">Material Library</p>
                            {sh.material_id && (
                              <button
                                onClick={() => updateSelected({ material_id: undefined })}
                                className="text-[8px] text-white/25 hover:text-red-400 transition-colors">
                                Clear
                              </button>
                            )}
                          </div>
                          {sh.material_id && (() => {
                            const m = materials.find(m => m.id === sh.material_id);
                            return m ? (
                              <div className="flex items-center gap-2 px-2 py-1 mb-1 rounded-md bg-blue-500/10 border border-blue-500/25">
                                <span className="w-3 h-3 rounded-full flex-shrink-0 border border-white/20" style={{ background: m.base_color }} />
                                <span className="text-[10px] text-blue-300 truncate flex-1">{m.name}</span>
                              </div>
                            ) : null;
                          })()}
                          <div className="max-h-24 overflow-y-auto flex flex-col gap-0.5" style={{ scrollbarWidth: "none" }}>
                            {materials.map(m => (
                              <button
                                key={m.id}
                                onClick={() => updateSelected({ material_id: sh.material_id === m.id ? undefined : m.id })}
                                className={`flex items-center gap-2 px-2 py-1 rounded-md text-left transition-colors ${
                                  sh.material_id === m.id ? "bg-blue-500/15 border border-blue-500/30" : "hover:bg-white/6 border border-transparent"
                                }`}>
                                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-white/15" style={{ background: m.base_color }} />
                                <span className="text-[10px] text-white/55 truncate">{m.name}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Parent mesh */}
                      {meshNames && meshNames.length > 0 && (
                        <div>
                          <p className="text-[9px] text-white/30 uppercase tracking-wide mb-0.5">Parent Mesh</p>
                          <select
                            value={sh.parentMesh ?? ""}
                            onChange={e => updateSelected({ parentMesh: e.target.value || undefined })}
                            onClick={e => e.stopPropagation()}
                            className="w-full bg-white/5 text-white/70 text-[10px] px-2 py-1 rounded border border-white/10 outline-none focus:border-white/25"
                          >
                            <option value="">— none (world space) —</option>
                            {meshNames.map(n => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function PropsTab({
  placedProps, onPropsChange, activePropId, onActivePropChange,
  selectedPropId, onSelectProp, propTransformMode, onSetPropTransformMode,
}: {
  placedProps: PlacedPropData[];
  onPropsChange: (props: PlacedPropData[]) => void;
  activePropId: string | null;
  onActivePropChange: (id: string | null, url: string | null, scale: [number,number,number] | null) => void;
  selectedPropId?: string | null;
  onSelectProp?: (id: string) => void;
  propTransformMode?: "translate" | "rotate" | "scale";
  onSetPropTransformMode?: (m: "translate" | "rotate" | "scale") => void;
}) {
  const [search, setSearch]       = useState("");
  const [catFilter, setCatFilter] = useState<PropCatalogEntry["category"] | "all">("all");

  const filtered = PROP_CATALOG.filter(p => {
    if (catFilter !== "all" && p.category !== catFilter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  function handleSelectProp(p: PropCatalogEntry) {
    if (activePropId === p.id) {
      onActivePropChange(null, null, null);
      return;
    }
    onActivePropChange(p.id, p.modelUrl, p.defaultScale);
  }

  function handleRemovePlaced(id: string) {
    onPropsChange(placedProps.filter(p => p.id !== id));
  }

  const catOptions: (PropCatalogEntry["category"] | "all")[] = ["all", "tree", "shrub", "rock", "grass", "other"];

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Placement mode banner */}
      {activePropId && (
        <div className="flex-shrink-0 flex items-center justify-between gap-2 px-3 py-1.5 bg-blue-500/15 border-b border-blue-500/20">
          <p className="text-[10px] text-blue-300">Click in viewport to place</p>
          <button onClick={() => onActivePropChange(null, null, null)}
            className="text-[10px] text-blue-400 hover:text-blue-200 underline">Cancel</button>
        </div>
      )}
      {/* Search */}
      <div className="flex-shrink-0 px-2 py-1.5 border-b border-white/8">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search props…"
          className="w-full bg-white/5 text-white/80 text-[11px] px-2 py-1 rounded-md border border-white/8 outline-none placeholder-white/20 focus:border-white/20"
        />
      </div>
      {/* Category filter */}
      <div className="flex-shrink-0 flex gap-1 px-2 py-1.5 border-b border-white/8 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {catOptions.map(c => (
          <button key={c} onClick={() => setCatFilter(c)}
            className={`flex-shrink-0 px-2 py-0.5 rounded text-[9px] font-medium uppercase transition-colors ${
              catFilter === c ? "bg-blue-500/25 text-blue-300 border border-blue-500/30" : "text-white/30 hover:text-white/60 border border-transparent"
            }`}>
            {c === "all" ? "All" : PROP_CAT_LABELS[c]}
          </button>
        ))}
      </div>
      {/* Catalog grid */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2" style={{ scrollbarWidth: "none" }}>
        <div className="grid grid-cols-3 gap-1.5">
          {filtered.map(p => (
            <button key={p.id} onClick={() => handleSelectProp(p)}
              title={p.name}
              className={`group relative flex flex-col items-center rounded-lg overflow-hidden border transition-all ${
                activePropId === p.id
                  ? "border-blue-500 bg-blue-500/15"
                  : "border-white/8 hover:border-white/20 bg-white/3 hover:bg-white/6"
              }`}>
              {/* thumbnail */}
              <div className="w-full aspect-square bg-white/5 overflow-hidden">
                <img
                  src={p.thumbnailUrl}
                  alt={p.name}
                  className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </div>
              <span className="w-full px-1 py-0.5 text-center text-[9px] text-white/50 truncate">{p.name}</span>
              {activePropId === p.id && (
                <div className="absolute top-1 right-1 w-3 h-3 rounded-full bg-blue-500 flex items-center justify-center">
                  <svg viewBox="0 0 10 10" className="w-2 h-2 fill-white"><path d="M2 5l2.5 2.5L8 3"/></svg>
                </div>
              )}
            </button>
          ))}
        </div>
        {filtered.length === 0 && (
          <p className="text-white/20 text-[11px] text-center mt-6">No props found</p>
        )}
      </div>
      {/* Placed props list */}
      {placedProps.length > 0 && (
        <div className="flex-shrink-0 border-t border-white/8 px-2 py-2">
          <p className="text-[9px] uppercase tracking-wider text-white/25 mb-1.5">Placed ({placedProps.length})</p>
          <div className="flex flex-col gap-0.5 max-h-24 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
            {placedProps.map(pp => {
              const entry = PROP_CATALOG.find(c => c.id === pp.propId);
              const isSel = selectedPropId === pp.id;
              return (
                <div key={pp.id}
                  className={`flex flex-col rounded transition-colors cursor-pointer ${isSel ? "bg-blue-500/15 ring-1 ring-blue-500/30" : "hover:bg-white/5"}`}
                  onClick={() => onSelectProp?.(pp.id)}
                >
                  <div className="flex items-center gap-1.5 px-1.5 py-0.5 group">
                    <span className={`flex-1 text-[10px] truncate ${isSel ? "text-blue-300" : "text-white/50"}`}>
                      {entry?.name ?? pp.propId}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemovePlaced(pp.id); }}
                      className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-[10px] transition-opacity"
                      title="Remove"
                    >✕</button>
                  </div>
                  {isSel && (
                    <div className="flex gap-0.5 px-1.5 pb-1">
                      {(["translate","rotate","scale"] as const).map(m => (
                        <button key={m}
                          onClick={(e) => { e.stopPropagation(); onSetPropTransformMode?.(m); }}
                          className={`flex-1 text-[9px] uppercase tracking-wide py-0.5 rounded transition-colors ${propTransformMode === m ? "bg-blue-500 text-white" : "bg-white/8 text-white/40 hover:text-white/70"}`}
                        >{m[0]}</button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <button
            onClick={() => onPropsChange([])}
            className="mt-1.5 text-[9px] text-red-400/60 hover:text-red-400 transition-colors"
          >Clear all</button>
        </div>
      )}
    </div>
  );
}

// ─── Lights Panel ─────────────────────────────────────────────────────────────

function LightsPanel({
  placedLights, onLightsChange, placingLightType, onPlacingLightType, selectedLightId, onSelectLight,
}: {
  placedLights: import("@/types/database").PlacedLight[];
  onLightsChange: React.Dispatch<React.SetStateAction<import("@/types/database").PlacedLight[]>>;
  placingLightType: "point" | "spot" | null;
  onPlacingLightType: (t: "point" | "spot" | null) => void;
  selectedLightId: string | null;
  onSelectLight: (id: string | null) => void;
}) {
  const selected = placedLights.find(l => l.id === selectedLightId) ?? null;

  function update<K extends keyof import("@/types/database").PlacedLight>(
    key: K, value: import("@/types/database").PlacedLight[K],
  ) {
    onLightsChange(prev => prev.map(l => l.id === selectedLightId ? { ...l, [key]: value } : l));
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto px-2 py-2 gap-3" style={{ scrollbarWidth: "none" }}>

      {/* Add buttons */}
      <div className="flex gap-1.5">
        {(["point", "spot"] as const).map(type => (
          <button
            key={type}
            onClick={() => onPlacingLightType(placingLightType === type ? null : type)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-[10px] font-semibold transition-colors ${
              placingLightType === type
                ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                : "bg-white/4 border-white/10 text-white/50 hover:text-white/80 hover:bg-white/8"
            }`}>
            <span>{type === "point" ? "●" : "▼"}</span>
            {type === "point" ? "Point" : "Spot"}
          </button>
        ))}
      </div>

      {/* Placement hint */}
      {placingLightType && (
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <p className="text-[10px] text-amber-300">Click any surface to place</p>
          <button onClick={() => onPlacingLightType(null)} className="text-[10px] text-amber-400/70 hover:text-amber-300 underline">Cancel</button>
        </div>
      )}

      {/* Light list */}
      {placedLights.length === 0 && (
        <p className="text-[10px] text-white/20 text-center py-4">No lights placed yet</p>
      )}
      {placedLights.map((light, i) => (
        <div
          key={light.id}
          onClick={() => onSelectLight(selectedLightId === light.id ? null : light.id)}
          className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border cursor-pointer transition-colors ${
            selectedLightId === light.id
              ? "bg-white/8 border-white/15"
              : "bg-white/3 border-white/6 hover:bg-white/6"
          }`}>
          <span style={{ color: light.color, textShadow: `0 0 6px ${light.color}` }} className="text-xs">●</span>
          <span className="text-[11px] text-white/70 capitalize flex-1">{light.type} Light {i + 1}</span>
          <span className="text-[10px] text-white/30">{light.intensity.toFixed(1)}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onLightsChange(prev => prev.filter(l => l.id !== light.id)); if (selectedLightId === light.id) onSelectLight(null); }}
            className="text-[10px] text-white/20 hover:text-red-400 transition-colors px-1">✕</button>
        </div>
      ))}

      {/* Selected light properties */}
      {selected && (
        <div className="flex flex-col gap-3 mt-1 pt-3 border-t border-white/8">
          <p className="text-[10px] uppercase tracking-wider text-white/30">Properties</p>

          {/* Color */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-white/50">Color</span>
            <input type="color" value={selected.color} onChange={e => update("color", e.target.value)}
              className="w-8 h-6 rounded cursor-pointer bg-transparent border border-white/15" />
          </div>

          {/* Intensity */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between">
              <span className="text-[11px] text-white/50">Intensity</span>
              <span className="text-[10px] text-white/30">{selected.intensity.toFixed(1)}</span>
            </div>
            <input type="range" min={0} max={20} step={0.1} value={selected.intensity}
              onChange={e => update("intensity", parseFloat(e.target.value))}
              className="w-full h-1 rounded accent-amber-400 cursor-pointer" />
          </div>

          {/* Range */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between">
              <span className="text-[11px] text-white/50">Range</span>
              <span className="text-[10px] text-white/30">{selected.distance === 0 ? "∞" : selected.distance.toFixed(1) + "m"}</span>
            </div>
            <input type="range" min={0} max={30} step={0.5} value={selected.distance}
              onChange={e => update("distance", parseFloat(e.target.value))}
              className="w-full h-1 rounded accent-amber-400 cursor-pointer" />
          </div>

          {/* Spot-only controls */}
          {selected.type === "spot" && (
            <>
              <div className="flex flex-col gap-1">
                <div className="flex justify-between">
                  <span className="text-[11px] text-white/50">Cone Angle</span>
                  <span className="text-[10px] text-white/30">{Math.round((selected.angle ?? Math.PI / 6) * 180 / Math.PI)}°</span>
                </div>
                <input type="range" min={5} max={90} step={1}
                  value={Math.round((selected.angle ?? Math.PI / 6) * 180 / Math.PI)}
                  onChange={e => update("angle", parseInt(e.target.value) * Math.PI / 180)}
                  className="w-full h-1 rounded accent-amber-400 cursor-pointer" />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex justify-between">
                  <span className="text-[11px] text-white/50">Penumbra</span>
                  <span className="text-[10px] text-white/30">{((selected.penumbra ?? 0.2) * 100).toFixed(0)}%</span>
                </div>
                <input type="range" min={0} max={1} step={0.01} value={selected.penumbra ?? 0.2}
                  onChange={e => update("penumbra", parseFloat(e.target.value))}
                  className="w-full h-1 rounded accent-amber-400 cursor-pointer" />
              </div>
            </>
          )}

          {/* Cast shadow */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-white/50">Cast shadows</span>
            <button onClick={() => update("castShadow", !selected.castShadow)}
              className={`relative w-8 h-4 rounded-full transition-colors ${selected.castShadow ? "bg-amber-500" : "bg-white/15"}`}>
              <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${selected.castShadow ? "left-4.5" : "left-0.5"}`} />
            </button>
          </div>

          {/* Position readout */}
          <div className="flex flex-col gap-1">
            <p className="text-[10px] text-white/25">Position (drag in viewport to move)</p>
            <div className="flex gap-1">
              {(["x","y","z"] as const).map((axis, i) => (
                <div key={axis} className="flex-1 bg-white/4 rounded-md px-1.5 py-1 text-center">
                  <p className="text-[8px] text-white/25 uppercase">{axis}</p>
                  <p className="text-[10px] text-white/50 font-mono">{selected.position[i].toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Settings Panel ───────────────────────────────────────────────────────────

interface ScenePreset { id: string; name: string; settings: SceneSettings; created_at: string; }

function SettingsPanel({
  settings, onSettings, onGlobalSettings, cameraDefaults, onCameraDefaults, viewportRef, onToast,
  selectedMeshes, lightingPhase, onLightingPhase,
}: {
  settings: SceneSettings;
  onSettings: (s: SceneSettings) => void;
  onGlobalSettings: (s: SceneSettings) => void;
  cameraDefaults: Record<string, unknown>;
  onCameraDefaults: (d: Record<string, unknown>) => void;
  viewportRef: React.RefObject<SceneEditorViewportHandle | null>;
  onToast: (msg: string) => void;
  selectedMeshes: string[];
  lightingPhase: Phase;
  onLightingPhase: (p: Phase) => void;
}) {
  const [settingsTab, setSettingsTab] = useState<"environment" | "camera">("environment");
  const [uploadingHdri, setUploadingHdri] = useState(false);
  const hdriInputRef = useRef<HTMLInputElement>(null);

  // ── Presets ──────────────────────────────────────────────────────────────────
  const [presets,      setPresets]      = useState<ScenePreset[]>([]);
  const [presetsOpen,  setPresetsOpen]  = useState(false);
  const [presetName,   setPresetName]   = useState("");
  const [savingPreset, setSavingPreset] = useState(false);

  useEffect(() => {
    fetch("/api/admin/presets")
      .then(r => r.json())
      .then(d => Array.isArray(d) && setPresets(d))
      .catch(() => {});
  }, []);

  async function savePreset() {
    if (!presetName.trim()) return;
    setSavingPreset(true);
    const r = await fetch("/api/admin/presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: presetName.trim(), settings }),
    });
    if (r.ok) {
      const created = await r.json() as ScenePreset;
      setPresets(prev => [created, ...prev]);
      setPresetName("");
      onToast("Preset saved ✓");
    } else {
      onToast("Failed to save preset");
    }
    setSavingPreset(false);
  }

  async function deletePreset(id: string) {
    await fetch(`/api/admin/presets/${id}`, { method: "DELETE" });
    setPresets(prev => prev.filter(p => p.id !== id));
    onToast("Preset deleted");
  }

  // Per-phase lighting setting
  function s<K extends keyof SceneSettings>(key: K, value: SceneSettings[K]) {
    onSettings({ ...settings, [key]: value });
  }
  // Global setting (camera, structural, messaging) — synced across all phases
  function sg<K extends keyof SceneSettings>(key: K, value: SceneSettings[K]) {
    onGlobalSettings({ ...settings, [key]: value });
  }

  async function handleHdriUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingHdri(true);
    const fd = new FormData();
    fd.append("file", file);
    const r = await fetch("/api/admin/hdri-upload", { method: "POST", body: fd });
    const data = await r.json();
    if (!r.ok) onToast(`HDRI upload failed: ${data.error}`);
    else {
      onSettings({ ...settings, envLightHdriUrl: data.url, envLightType: "hdri" });
      onToast("HDRI uploaded ✓");
    }
    setUploadingHdri(false);
    if (hdriInputRef.current) hdriInputRef.current.value = "";
  }

  function capturePhaseCamera(phase: Phase) {
    const coords = viewportRef.current?.getCameraCoords();
    if (!coords) { onToast("Camera not ready"); return; }
    onCameraDefaults({ ...cameraDefaults, [phase]: coords });
    onToast(`${phase} camera captured`);
  }

  return (
    <div className="flex flex-col gap-0 h-full">
      {/* Tab bar */}
      <div className="flex flex-shrink-0 border-b border-white/8 mb-3">
        {(["environment", "camera"] as const).map(tab => (
          <button key={tab} onClick={() => setSettingsTab(tab)}
            className={`flex-1 py-1.5 text-[10px] font-medium capitalize transition-colors ${
              settingsTab === tab
                ? "text-white border-b border-blue-500"
                : "text-white/30 hover:text-white/60"
            }`}>
            {tab === "environment" ? "Environment" : "Camera"}
          </button>
        ))}
      </div>

      {settingsTab === "environment" && <div className="flex flex-col gap-4">

      {/* ── Lighting phase selector ── */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1.5">Lighting Phase</p>
        <div className="flex gap-1">
          {PHASES.map(phase => (
            <button
              key={phase}
              onClick={() => onLightingPhase(phase)}
              className={`flex-1 py-1 text-[10px] font-semibold rounded-lg border capitalize transition-colors ${
                lightingPhase === phase
                  ? PHASE_COLOR[phase]
                  : "text-white/30 border-white/8 hover:text-white/60"
              }`}>
              {phase.slice(0, 3)}
            </button>
          ))}
        </div>
        <p className="text-[9px] text-white/20 mt-1.5 leading-relaxed">Each phase has independent lighting. Editing one does not affect the others.</p>
      </div>

      {/* ── Presets ── */}
      <div>
        <button
          onClick={() => setPresetsOpen(v => !v)}
          className="w-full flex items-center justify-between text-[10px] uppercase tracking-wider text-white/30 hover:text-white/60 transition-colors mb-1.5">
          <span>Environment Presets</span>
          <span className="text-[9px]">{presetsOpen ? "▾" : "▸"} {presets.length > 0 && `${presets.length}`}</span>
        </button>
        {presetsOpen && (
          <div className="flex flex-col gap-2">
            {/* Save */}
            <div className="flex gap-1.5">
              <input
                value={presetName} onChange={e => setPresetName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && savePreset()}
                placeholder="Preset name…"
                className="flex-1 px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[10px] text-white placeholder-white/20 focus:outline-none focus:border-blue-500/40"
              />
              <button onClick={savePreset} disabled={savingPreset || !presetName.trim()}
                className="px-2.5 py-1.5 bg-blue-600/25 hover:bg-blue-600/40 border border-blue-500/30 text-blue-300 text-[10px] rounded-lg transition-colors disabled:opacity-30 whitespace-nowrap">
                {savingPreset ? "…" : "Save"}
              </button>
            </div>
            {/* List */}
            {presets.length === 0 ? (
              <p className="text-[9px] text-white/20 text-center py-2">No presets yet</p>
            ) : (
              <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                {presets.map(p => (
                  <div key={p.id} className="flex items-center gap-1.5 group/preset">
                    <button
                      onClick={() => { onSettings(p.settings); onToast(`Applied "${p.name}"`); }}
                      className="flex-1 text-left px-2 py-1.5 bg-white/4 hover:bg-white/8 border border-white/6 hover:border-white/15 rounded-lg text-[10px] text-white/60 hover:text-white transition-colors truncate">
                      {p.name}
                    </button>
                    <button onClick={() => deletePreset(p.id)}
                      className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded text-white/20 hover:text-red-400 hover:bg-red-900/30 opacity-0 group-hover/preset:opacity-100 transition-all text-[9px]">
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* IBL Environment */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1.5">Environment Lighting</p>
        <div className="flex gap-1 mb-2">
          {(["preset", "hdri", "none"] as const).map(t => (
            <button key={t} onClick={() => s("envLightType", t)}
              className={`flex-1 py-1.5 text-[10px] rounded-lg border transition-colors ${
                settings.envLightType === t ? "bg-white/10 border-white/20 text-white" : "border-white/8 text-white/30 hover:text-white/50"
              }`}>
              {t === "none" ? "None" : t === "hdri" ? "HDRI" : "Preset"}
            </button>
          ))}
        </div>
        {settings.envLightType === "preset" && (
          <select value={settings.envLightPreset} onChange={e => s("envLightPreset", e.target.value)}
            className="w-full px-2.5 py-2 bg-[#111] border border-white/10 rounded-lg text-xs text-white focus:outline-none">
            {ENV_PRESETS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>
        )}
        {settings.envLightType === "hdri" && (
          <div className="flex flex-col gap-2">
            {settings.envLightHdriUrl && (
              <p className="text-[10px] text-green-400/70 truncate">✓ {settings.envLightHdriUrl.split("/").pop()}</p>
            )}
            <input ref={hdriInputRef} type="file" accept=".hdr,.exr" onChange={handleHdriUpload} className="hidden" />
            <button onClick={() => hdriInputRef.current?.click()} disabled={uploadingHdri}
              className="w-full py-1.5 border border-white/10 text-white/50 hover:text-white text-xs rounded-lg transition-colors disabled:opacity-40">
              {uploadingHdri ? "Uploading…" : settings.envLightHdriUrl ? "Replace HDRI" : "Upload .hdr / .exr"}
            </button>
            <input value={settings.envLightHdriUrl} onChange={e => s("envLightHdriUrl", e.target.value)}
              placeholder="…or paste public HDRI URL"
              className="w-full px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[10px] text-white placeholder-white/20 focus:outline-none" />
          </div>
        )}
        {/* Environment controls — shown whenever env is not "none" */}
        {settings.envLightType !== "none" && (
          <div className="mt-2 flex flex-col gap-2 pt-2 border-t border-white/8">
            <Slider label="IBL Intensity"  value={settings.hdriIntensity}           min={0} max={4}   step={0.05} onChange={v => s("hdriIntensity", v)} />
            <Slider label="BG Brightness"  value={settings.hdriBackgroundBrightness} min={0} max={4}   step={0.05} onChange={v => s("hdriBackgroundBrightness", v)} />
            <Slider label="Rotation"       value={settings.hdriRotation}            min={0} max={360} step={1} unit="°" onChange={v => s("hdriRotation", v)} />
            <Slider label="Contrast"       value={settings.hdriContrast}            min={-1} max={1}  step={0.02} onChange={v => s("hdriContrast", v)} />
          </div>
        )}
      </div>

      {/* Background */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1.5">Background</p>
        <div className="flex gap-1 mb-2">
          {([["env","IBL"], ["color","Color"], ["sky","Sky"]] as const).map(([t, label]) => (
            <button key={t} onClick={() => s("bgType", t)}
              className={`flex-1 py-1.5 text-[10px] rounded-lg border transition-colors ${
                settings.bgType === t ? "bg-white/10 border-white/20 text-white" : "border-white/8 text-white/30 hover:text-white/50"
              }`}>
              {label}
            </button>
          ))}
        </div>
        {settings.bgType === "color" && (
          <div className="flex items-center gap-2">
            <Swatch color={settings.bgColor} size={28} />
            <input type="color" value={settings.bgColor} onChange={e => s("bgColor", e.target.value)}
              className="flex-1 h-7 rounded cursor-pointer bg-transparent border-0" />
            <input value={settings.bgColor} onChange={e => s("bgColor", e.target.value)}
              className="w-20 px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[10px] text-white font-mono focus:outline-none" />
          </div>
        )}
        {settings.bgType === "env" && settings.envLightType === "none" && (
          <p className="text-[9px] text-amber-400/60">No environment set — sky will be black.</p>
        )}
        {settings.bgType === "env" && settings.envLightType !== "none" && (
          <div className="mt-2">
            <Slider label="BG Multiplier" value={settings.hdriBackgroundBrightness} min={0} max={4} step={0.05}
              onChange={v => s("hdriBackgroundBrightness", v)} />
          </div>
        )}
        {settings.bgType === "sky" && (
          <div className="flex flex-col gap-2">
            {/* Sky preset grid */}
            <div className="grid grid-cols-3 gap-1">
              {Object.entries(SKY_PRESETS).map(([key, preset]) => (
                <button key={key}
                  onClick={() => {
                    const p = SKY_PRESETS[key];
                    onSettings({ ...settings,
                      bgType: "sky", skyPreset: key,
                      skyTurbidity: p.turbidity, skyRayleigh: p.rayleigh,
                      skyMieCoeff: p.mie, skyMieDirectionalG: p.mieG,
                      sunElevationDeg: p.elevation, sunAzimuthDeg: p.azimuth,
                      showStars: !!p.stars,
                      ambientIntensity: p.ambientHint ?? settings.ambientIntensity,
                    });
                  }}
                  className={`py-1.5 text-[9px] rounded-lg border transition-colors ${
                    settings.skyPreset === key
                      ? "bg-blue-600/20 border-blue-500/40 text-blue-300"
                      : "border-white/8 text-white/40 hover:text-white/70 hover:border-white/20"
                  }`}>
                  {preset.label}
                </button>
              ))}
            </div>
            {/* Fine-tune sky */}
            <div className="flex flex-col gap-2 pt-1 border-t border-white/8">
              <Slider label="Turbidity" value={settings.skyTurbidity} min={0} max={20} step={0.5}
                onChange={v => s("skyTurbidity", v)} />
              <Slider label="Rayleigh" value={settings.skyRayleigh} min={0} max={4} step={0.1}
                onChange={v => s("skyRayleigh", v)} />
              <Slider label="Sky Rotation" value={settings.skyRotation ?? 0} min={0} max={360} step={1} unit="°"
                onChange={v => s("skyRotation", v)} />
              <Slider label="Sky Brightness" value={settings.skyBrightness ?? 1} min={0.1} max={3} step={0.05}
                onChange={v => s("skyBrightness", v)} />
              <Toggle label="Show Stars" value={settings.showStars} onChange={v => s("showStars", v)} />
              <Toggle label="Show Clouds" value={settings.showClouds} onChange={v => s("showClouds", v)} />
              {settings.showClouds && (
                <div className="flex flex-col gap-2 pl-3 border-l border-white/10">
                  <Slider label="Opacity" value={settings.cloudOpacity} min={0} max={1} step={0.05}
                    onChange={v => s("cloudOpacity", v)} />
                  <Slider label="Speed" value={settings.cloudSpeed} min={0} max={2} step={0.05}
                    onChange={v => s("cloudSpeed", v)} />
                  <Slider label="Height" value={settings.cloudHeight} min={10} max={200} step={5}
                    onChange={v => s("cloudHeight", v)} />
                  <Slider label="Count" value={settings.cloudCount} min={1} max={12} step={1}
                    onChange={v => s("cloudCount", v)} />
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/40 flex-shrink-0">Cloud Color</span>
                    <input type="color" value={settings.cloudColor ?? "#ffffff"} onChange={e => s("cloudColor", e.target.value)}
                      className="flex-1 h-6 rounded cursor-pointer bg-transparent border-0" />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Fog */}
      <div>
        <Toggle label="Atmospheric Fog" value={settings.fogEnabled} onChange={v => s("fogEnabled", v)} />
        {settings.fogEnabled && (
          <div className="pl-2 flex flex-col gap-2 mt-1.5 border-l border-white/8">
            <div className="flex items-center gap-2">
              <Swatch color={settings.fogColor} size={20} />
              <input type="color" value={settings.fogColor} onChange={e => s("fogColor", e.target.value)}
                className="flex-1 h-6 rounded cursor-pointer bg-transparent border-0" />
            </div>
            <Slider label="Near" value={settings.fogNear} min={1} max={100} step={1}
              onChange={v => s("fogNear", v)} />
            <Slider label="Far" value={settings.fogFar} min={10} max={500} step={5}
              onChange={v => s("fogFar", v)} />
          </div>
        )}
      </div>

      {/* Direct Lighting */}
      <div className="flex flex-col gap-3">
        <p className="text-[10px] uppercase tracking-wider text-white/30">Direct Lighting</p>
        <Slider label="Ambient" value={settings.ambientIntensity} min={0} max={2} step={0.05}
          onChange={v => s("ambientIntensity", v)} />
        <Slider label="Sun Intensity" value={settings.sunIntensity} min={0} max={3} step={0.05}
          onChange={v => s("sunIntensity", v)} />
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/40 flex-shrink-0">Sun Color</span>
          <input type="color" value={settings.sunColor} onChange={e => s("sunColor", e.target.value)}
            className="flex-1 h-6 rounded cursor-pointer bg-transparent border-0" />
        </div>
        <p className="text-[10px] text-white/30 uppercase tracking-wide -mb-1">Sun Position</p>
        <Slider label="Elevation" value={settings.sunElevationDeg} min={0} max={90} step={1}
          unit="°" onChange={v => s("sunElevationDeg", v)} />
        <Slider label="Azimuth" value={settings.sunAzimuthDeg} min={0} max={360} step={1}
          unit="°" onChange={v => s("sunAzimuthDeg", v)} />
        <Slider label="Distance" value={settings.sunDistance} min={1} max={60} step={1}
          onChange={v => s("sunDistance", v)} />
      </div>

      {/* Scene elements */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1">Scene</p>
        <Toggle label="Show Grid"    value={settings.showGrid}    onChange={v => s("showGrid", v)} />
        <Toggle label="World Ground" value={settings.groundPlane} onChange={v => s("groundPlane", v)} />
        {settings.groundPlane && (
          <div className="pl-2 flex flex-col gap-2 mt-1 border-l border-white/8">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/40 flex-shrink-0">Color</span>
              <input type="color" value={settings.groundColor} onChange={e => s("groundColor", e.target.value)}
                className="flex-1 h-6 rounded cursor-pointer bg-transparent border-0" />
            </div>
          </div>
        )}
      </div>

      {/* Post-processing */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1">Post-processing</p>
        <Toggle label="Shadows"   value={settings.shadows} onChange={v => s("shadows", v)} />
        {settings.shadows && (
          <div className="pl-2 flex flex-col gap-2 mt-1 border-l border-white/8">
            <Slider label="Shadow Softness" value={settings.shadowRadius} min={1} max={12} step={0.5}
              onChange={v => s("shadowRadius", v)} />
            <Toggle label="Sky Dome Lights" value={settings.skyDomeLights} onChange={v => s("skyDomeLights", v)} />
            {settings.skyDomeLights && (
              <div className="pl-2 flex flex-col gap-2 mt-0.5 border-l border-white/8">
                <p className="text-[9px] text-white/30 leading-relaxed">4 overhead lights simulate overcast sky / HDRI diffuse shadows.</p>
                <Slider label="Dome Intensity" value={settings.skyDomeLightIntensity} min={0} max={2} step={0.05}
                  onChange={v => s("skyDomeLightIntensity", v)} />
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/40 flex-shrink-0">Dome Color</span>
                  <input type="color" value={settings.skyDomeLightColor}
                    onChange={e => s("skyDomeLightColor", e.target.value)}
                    className="flex-1 h-6 rounded cursor-pointer bg-transparent border-0" />
                </div>
                <Toggle label="Dome Cast Shadows" value={settings.skyDomeLightShadows} onChange={v => s("skyDomeLightShadows", v)} />
                {settings.skyDomeLightShadows && (
                  <p className="text-[9px] text-amber-400/60 leading-relaxed">4 shadow maps active — may impact performance on slow GPUs.</p>
                )}
              </div>
            )}
          </div>
        )}
        <Toggle label="SSAO"      value={settings.ssao}    onChange={v => s("ssao", v)} />
        {settings.ssao && (
          <div className="pl-2 flex flex-col gap-2 mt-1.5 border-l border-white/8">
            <Slider label="AO Radius"    value={settings.aoRadius}    min={0.1} max={10} step={0.1} onChange={v => s("aoRadius", v)} />
            <Slider label="AO Intensity" value={settings.aoIntensity} min={1}   max={50} step={1}   onChange={v => s("aoIntensity", v)} />
            <Slider label="AO Samples"   value={settings.aoSamples}   min={8}   max={256} step={8}   onChange={v => s("aoSamples", v)} />
          </div>
        )}
        <Toggle label="Bloom"     value={settings.bloom}   onChange={v => s("bloom", v)} />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-white/50">Anti-aliasing</span>
          <div className="flex gap-1">
            {(["smaa", "none"] as const).map(mode => (
              <button
                key={mode}
                onClick={() => s("aaMode", mode)}
                className={`text-[9px] font-semibold px-2 py-0.5 rounded-md border transition-colors ${
                  (settings.aaMode ?? "smaa") === mode
                    ? "text-white bg-white/10 border-white/20"
                    : "text-white/30 border-transparent hover:text-white/60"
                }`}>
                {mode === "smaa" ? "SMAA" : "Off"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Path Tracing ── */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-white/30 mb-2">Path Tracing</p>
        <div className="flex flex-col gap-2.5">
          <Toggle
            label="Enable when idle"
            value={settings.pathTracing ?? false}
            onChange={v => s("pathTracing", v)}
          />
          {(settings.pathTracing ?? false) && (
            <>
              <Slider
                label="Bounces"
                value={settings.pathTracingBounces ?? 4}
                min={1} max={12} step={1}
                onChange={v => s("pathTracingBounces", v)}
              />
              <p className="text-[9px] text-white/20 leading-relaxed">
                When the camera stops, path tracing accumulates samples — producing accurate GI, shadows, and reflections. Higher bounces = better indirect lighting, slower convergence.
              </p>
            </>
          )}
        </div>
      </div>

      </div>}{/* end environment tab */}

      {settingsTab === "camera" && <div className="flex flex-col gap-4">

      {/* Camera Controls */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-white/30 mb-2">Camera Controls</p>
        <div className="flex flex-col gap-3">
          <Toggle label="Architectural Mode" value={settings.architecturalMode} onChange={v => sg("architecturalMode", v)} />
          {settings.architecturalMode && (
            <p className="text-[9px] text-white/25 -mt-1 leading-relaxed">Camera stays level — vertical lines stay straight.</p>
          )}
          <Slider label="Field of View" value={settings.cameraFov} min={15} max={120} step={1} unit="°"
            onChange={v => sg("cameraFov", v)} />
          <Slider label="Rotate Speed" value={settings.rotateSpeed} min={0.1} max={3} step={0.1}
            onChange={v => sg("rotateSpeed", v)} />
          <Slider label="Pan Speed" value={settings.panSpeed} min={0.1} max={3} step={0.1}
            onChange={v => sg("panSpeed", v)} />
          <Slider label="Zoom Speed" value={settings.zoomSpeed} min={0.1} max={3} step={0.1}
            onChange={v => sg("zoomSpeed", v)} />
        </div>
      </div>

      {/* Phase Cameras */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-white/30 mb-2">Phase Cameras</p>
        <div className="flex flex-col gap-1.5">
          {PHASES.map(phase => {
            const has = !!(cameraDefaults as Record<string, unknown>)[phase];
            return (
              <div key={phase} className="flex items-center justify-between bg-white/4 rounded-lg px-2.5 py-2">
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${PHASE_COLOR[phase]}`}>
                    {phase.slice(0,3)}
                  </span>
                  <span className="text-[10px] text-white/35">{has ? "✓ set" : "default"}</span>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => capturePhaseCamera(phase)}
                    className="text-[10px] px-2 py-0.5 bg-white/8 hover:bg-white/15 text-white/50 hover:text-white rounded transition-colors">
                    Capture
                  </button>
                  {has && (
                    <button onClick={() => {
                      const d = { ...cameraDefaults }; delete (d as Record<string, unknown>)[phase];
                      onCameraDefaults(d); onToast(`${phase} camera cleared`);
                    }} className="text-[10px] px-1.5 py-0.5 hover:bg-red-900/40 text-white/25 hover:text-red-400 rounded transition-colors">
                      ✕
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Interior Camera 2 — second interior angle for the summary brochure */}
          {(() => {
            const has = !!(cameraDefaults as Record<string, unknown>).interior2;
            return (
              <div className="flex items-center justify-between bg-white/4 rounded-lg px-2.5 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border text-violet-400 border-violet-400/30 bg-violet-400/10">
                    Int2
                  </span>
                  <span className="text-[10px] text-white/35">{has ? "✓ set" : "not set"}</span>
                  <span className="text-[9px] text-white/20">2nd angle</span>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      const coords = viewportRef.current?.getCameraCoords();
                      if (!coords) { onToast("Camera not ready"); return; }
                      onCameraDefaults({ ...cameraDefaults, interior2: coords });
                      onToast("Interior Camera 2 captured");
                    }}
                    className="text-[10px] px-2 py-0.5 bg-white/8 hover:bg-white/15 text-white/50 hover:text-white rounded transition-colors">
                    Capture
                  </button>
                  {has && (
                    <button onClick={() => {
                      const d = { ...cameraDefaults }; delete (d as Record<string, unknown>).interior2;
                      onCameraDefaults(d); onToast("Interior Camera 2 cleared");
                    }} className="text-[10px] px-1.5 py-0.5 hover:bg-red-900/40 text-white/25 hover:text-red-400 rounded transition-colors">
                      ✕
                    </button>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Buyer Messages */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-white/30 mb-2">Buyer Messages</p>
        <div className="flex flex-col gap-2.5">
          <div>
            <label className="block text-[9px] font-semibold text-white/30 uppercase tracking-wide mb-1">Welcome message</label>
            <textarea
              rows={2}
              value={settings.welcomeMessage ?? ""}
              onChange={e => sg("welcomeMessage", e.target.value || undefined)}
              placeholder="Personalise every detail of your new home…"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white/70 placeholder-white/20 focus:outline-none focus:border-blue-600/40 resize-none"
            />
          </div>
          <div>
            <label className="block text-[9px] font-semibold text-white/30 uppercase tracking-wide mb-1">Exterior phase message</label>
            <input
              type="text"
              value={settings.exteriorMessage ?? ""}
              onChange={e => sg("exteriorMessage", e.target.value || undefined)}
              placeholder="Choose your facade, roofing, and landscaping."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white/70 placeholder-white/20 focus:outline-none focus:border-blue-600/40"
            />
          </div>
          <div>
            <label className="block text-[9px] font-semibold text-white/30 uppercase tracking-wide mb-1">Interior phase message</label>
            <input
              type="text"
              value={settings.interiorMessage ?? ""}
              onChange={e => sg("interiorMessage", e.target.value || undefined)}
              placeholder="Choose flooring, cabinets, and finishes."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white/70 placeholder-white/20 focus:outline-none focus:border-blue-600/40"
            />
          </div>
        </div>
      </div>

      </div>}{/* end camera tab */}
    </div>
  );
}

// ─── Mesh Health Check Panel ─────────────────────────────────────────────────

function MeshHealthPanel({
  categories, glbMeshNames, addonMeshNames, swapDiff, onClearDiff,
  triangleCounts, onRemoveMesh, onSelectMesh,
}: {
  categories: CategoryWithOptions[];
  glbMeshNames: Set<string>;
  addonMeshNames: Record<string, string[]>;
  swapDiff: { missing: string[]; found: string[] } | null;
  onClearDiff: () => void;
  triangleCounts: MeshTriangleCounts;
  onRemoveMesh: (optionId: string, meshName: string) => Promise<void>;
  onSelectMesh: (name: string) => void;
}) {
  const [search, setSearch] = useState("");

  // Build a flat map: nodeName → [optionId, optionName]
  const nodeOptMap: Record<string, { optId: string; optName: string; catName: string }> = {};
  for (const cat of categories)
    for (const opt of cat.options)
      for (const n of (opt.node_list ?? []))
        if (!nodeOptMap[n]) nodeOptMap[n] = { optId: opt.id, optName: opt.friendly_name, catName: cat.name };

  const allNodes = Object.keys(nodeOptMap);
  const allKnown = new Set([...glbMeshNames, ...Object.values(addonMeshNames).flat()]);
  const stale    = allNodes.filter(n => !allKnown.has(n));
  const healthy  = allNodes.filter(n => allKnown.has(n));
  const filtered = search
    ? allNodes.filter(n => n.toLowerCase().includes(search.toLowerCase()))
    : allNodes;

  const totalTris = Object.values(triangleCounts).reduce((s, v) => s + v, 0);

  return (
    <div className="flex flex-col gap-3">
      {/* Summary */}
      <div className="flex gap-2">
        <div className="flex-1 px-3 py-2 bg-green-500/8 border border-green-500/15 rounded-xl text-center">
          <p className="text-base font-bold text-green-400">{healthy.length}</p>
          <p className="text-[8px] text-green-400/60 uppercase tracking-wider">Healthy</p>
        </div>
        <div className={`flex-1 px-3 py-2 rounded-xl text-center border ${stale.length > 0 ? "bg-amber-500/8 border-amber-500/15" : "bg-white/3 border-white/8"}`}>
          <p className={`text-base font-bold ${stale.length > 0 ? "text-amber-400" : "text-white/20"}`}>{stale.length}</p>
          <p className={`text-[8px] uppercase tracking-wider ${stale.length > 0 ? "text-amber-400/60" : "text-white/20"}`}>Stale</p>
        </div>
        {totalTris > 0 && (
          <div className="flex-1 px-3 py-2 bg-white/3 border border-white/8 rounded-xl text-center">
            <p className="text-base font-bold text-white/40">{(totalTris / 1000).toFixed(0)}k</p>
            <p className="text-[8px] text-white/25 uppercase tracking-wider">Tris</p>
          </div>
        )}
      </div>

      {/* Swap diff banner */}
      {swapDiff && (
        <div className="flex items-start gap-2 px-2.5 py-2 bg-amber-500/8 border border-amber-500/20 rounded-xl">
          <span className="text-amber-400 text-xs flex-shrink-0">⚠</span>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] text-amber-400/80 font-semibold">Model swap detected</p>
            <p className="text-[8px] text-amber-400/50">{swapDiff.missing.length} nodes missing in new GLB</p>
          </div>
          <button onClick={onClearDiff} className="text-white/25 hover:text-white text-[10px]">✕</button>
        </div>
      )}

      {/* Triangle budget per mesh */}
      {Object.keys(triangleCounts).length > 0 && (
        <div>
          <p className="text-[8px] uppercase tracking-wider text-white/20 mb-1.5">Poly budget (top 10)</p>
          <div className="flex flex-col gap-0.5">
            {Object.entries(triangleCounts)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 10)
              .map(([name, tris]) => {
                const pct = Math.min(100, (tris / Math.max(...Object.values(triangleCounts))) * 100);
                return (
                  <div key={name} className="flex items-center gap-1.5 group cursor-pointer" onClick={() => onSelectMesh(name)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[8px] font-mono text-white/35 truncate max-w-[120px]">{name}</span>
                        <span className={`text-[8px] font-mono flex-shrink-0 ${tris > 50000 ? "text-amber-400/70" : "text-white/25"}`}>
                          {(tris / 1000).toFixed(1)}k
                        </span>
                      </div>
                      <div className="h-px bg-white/8 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${tris > 50000 ? "bg-amber-400/50" : "bg-blue-500/50"}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Search + node list */}
      <div>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${allNodes.length} mapped nodes…`}
          className="w-full px-2 py-1 bg-white/5 border border-white/[0.08] rounded-lg text-[10px] text-white placeholder-white/20 outline-none focus:border-blue-500/40 mb-1.5"
        />
        <div className="flex flex-col gap-0.5 max-h-[200px] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          {filtered.map(n => {
            const inScene = allKnown.has(n);
            const { optId, optName, catName } = nodeOptMap[n];
            return (
              <div key={n} className="flex items-center gap-1.5 px-1.5 py-1 rounded-md group hover:bg-white/4 cursor-pointer" onClick={() => inScene && onSelectMesh(n)}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${inScene ? "bg-green-400" : "bg-amber-400"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-mono text-white/50 truncate">{n}</p>
                  <p className="text-[7px] text-white/20 truncate">{catName} › {optName}</p>
                </div>
                {!inScene && (
                  <button
                    onClick={async e => { e.stopPropagation(); await onRemoveMesh(optId, n); }}
                    className="opacity-0 group-hover:opacity-100 text-red-400/60 hover:text-red-300 text-[9px] transition-opacity">✕</button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Structural Visibility Panel ─────────────────────────────────────────────

function StructuralVisibilityPanel({
  settings, onSettings, selectedMeshes, onToast,
}: {
  settings: SceneSettings;
  onSettings: (s: SceneSettings) => void;
  selectedMeshes: string[];
  onToast: (msg: string) => void;
}) {
  const LAYERS = [
    ["roofNodes",   "Roof",    "text-blue-400 border-blue-400/30 bg-blue-400/10"],
    ["level1Nodes", "Level 1", "text-emerald-400 border-emerald-400/30 bg-emerald-400/10"],
    ["level2Nodes", "Level 2", "text-violet-400 border-violet-400/30 bg-violet-400/10"],
    ["level3Nodes", "Level 3", "text-amber-400 border-amber-400/30 bg-amber-400/10"],
  ] as [keyof SceneSettings, string, string][];

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <p className="flex-shrink-0 text-[9px] text-white/25 px-2 pt-2 pb-1.5 leading-relaxed">
        Select meshes in the viewport, then assign them to a structural layer for visibility controls.
      </p>
      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-3 flex flex-col gap-2" style={{ scrollbarWidth: "none" }}>
        {LAYERS.map(([key, label, cls]) => {
          const nodes = (settings[key] as string[]) ?? [];
          return (
            <div key={key} className="bg-white/4 rounded-lg p-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${cls}`}>{label}</span>
                <div className="flex gap-1">
                  <button
                    disabled={selectedMeshes.length === 0}
                    onClick={() => {
                      onSettings({ ...settings, [key]: [...new Set([...nodes, ...selectedMeshes])] });
                      onToast(`${selectedMeshes.length} mesh${selectedMeshes.length !== 1 ? "es" : ""} → ${label}`);
                    }}
                    className="text-[9px] px-1.5 py-0.5 bg-white/8 hover:bg-white/15 text-white/50 hover:text-white rounded transition-colors disabled:opacity-30">
                    + Assign
                  </button>
                  {nodes.length > 0 && (
                    <button onClick={() => { onSettings({ ...settings, [key]: [] }); onToast(`${label} cleared`); }}
                      className="text-[9px] px-1.5 py-0.5 hover:bg-red-900/40 text-white/25 hover:text-red-400 rounded transition-colors">
                      Clear
                    </button>
                  )}
                </div>
              </div>
              {nodes.length > 0 ? (
                <div className="max-h-32 overflow-y-auto flex flex-col gap-0.5 pr-0.5" style={{ scrollbarWidth: "thin" }}>
                  {nodes.map((n: string) => (
                    <div key={n} className="flex items-center justify-between gap-1 px-1.5 py-0.5 rounded hover:bg-white/5 group">
                      <span className="text-[9px] text-white/50 truncate flex-1">{n}</span>
                      <button
                        onClick={() => onSettings({ ...settings, [key]: nodes.filter((x: string) => x !== n) })}
                        className="flex-shrink-0 text-white/20 hover:text-red-400 text-[9px] opacity-0 group-hover:opacity-100 transition-opacity leading-none">✕</button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[9px] text-white/20 italic">None — using group name fallback</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Scene Panel (mesh hierarchy) ────────────────────────────────────────────

function getAllMeshNames(ns: SceneTreeNode[]): string[] {
  const names: string[] = [];
  function collect(nodes: SceneTreeNode[]) {
    for (const n of nodes) {
      if (n.type === "Mesh") names.push(n.name);
      collect(n.children);
    }
  }
  collect(ns);
  return names;
}

function ScenePanel({
  nodes, selectedMeshes, assignedMeshes, isolationMeshes, deletedMeshes, onSelect, onToggle, onSelectAll, onToggleHidden,
}: {
  nodes: SceneTreeNode[];
  selectedMeshes: string[];
  assignedMeshes: Set<string>;
  isolationMeshes?: string[];
  deletedMeshes?: Set<string>;
  onSelect: (name: string) => void;
  onToggle: (name: string) => void;
  onSelectAll: (names: string[]) => void;
  onToggleHidden?: (name: string) => void;
}) {
  const [search, setSearch] = useState("");
  const isoSet = useMemo(() => isolationMeshes ? new Set(isolationMeshes) : null, [isolationMeshes]);

  const filtered = useMemo(() => {
    if (!search) return nodes;
    function filter(ns: SceneTreeNode[]): SceneTreeNode[] {
      return ns.flatMap(n => {
        const ch = filter(n.children);
        return n.name.toLowerCase().includes(search.toLowerCase()) || ch.length ? [{ ...n, children: ch }] : [];
      });
    }
    return filter(nodes);
  }, [nodes, search]);

  const meshCount = useMemo(() => {
    let n = 0;
    function count(ns: SceneTreeNode[]) { for (const x of ns) { if (x.type === "Mesh") n++; count(x.children); } }
    count(nodes);
    return n;
  }, [nodes]);

  const selectedSet = useMemo(() => new Set(selectedMeshes), [selectedMeshes]);

  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex items-center justify-between flex-shrink-0">
        <span className="text-[10px] text-white/25">
          {meshCount} meshes · {assignedMeshes.size} assigned
          {isoSet && <span className="text-blue-400/70"> · {isoSet.size} isolated</span>}
          {(deletedMeshes?.size ?? 0) > 0 && <span className="text-white/30"> · {deletedMeshes!.size} hidden</span>}
          {selectedMeshes.length > 0 && <span className="text-blue-400"> · {selectedMeshes.length} sel</span>}
        </span>
        <button
          onClick={() => {
            const visible = getAllMeshNames(filtered);
            const allSelected = visible.length > 0 && visible.every(n => selectedMeshes.includes(n));
            onSelectAll(allSelected ? [] : visible);
          }}
          className="text-[10px] text-white/25 hover:text-white/60 transition-colors px-1 py-0.5 rounded hover:bg-white/5">
          {(() => {
            const visible = getAllMeshNames(filtered);
            return visible.length > 0 && visible.every(n => selectedMeshes.includes(n)) ? "Clear" : "Select All";
          })()}
        </button>
      </div>
      <input
        value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search meshes…"
        className="w-full px-2.5 py-1.5 text-xs bg-white/5 border border-white/[0.08] rounded-lg text-white placeholder-white/20 outline-none focus:border-blue-500/50 flex-shrink-0"
      />
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        {nodes.length > 0 ? (
          <SceneTree
            nodes={filtered}
            selectedNames={selectedSet}
            assignedMeshes={assignedMeshes}
            deletedMeshes={deletedMeshes}
            onSelect={onSelect}
            onToggle={onToggle}
            onToggleHidden={onToggleHidden}
          />
        ) : (
          <p className="text-center py-8 text-white/20 text-xs">No model loaded</p>
        )}
      </div>
    </div>
  );
}

// ─── Materials Tab (right panel) ─────────────────────────────────────────────

function MaterialsTab({
  materials, glbMaterials, activeOptionId, selectedMeshes,
  onEdit, onEditGlb, onApply, onBaseApply, onCreateBlank, onPromoteGlb, onDuplicate, onDelete, onToast,
}: {
  materials: MaterialLibraryEntry[];
  glbMaterials: GlbMaterialInfo[];
  activeOptionId: string | null;
  selectedMeshes: string[];
  onEdit: (id: string) => void;
  onEditGlb: (name: string) => void;
  onApply: (matId: string) => Promise<void>;
  onBaseApply: (meshNames: string[], matId: string) => void;
  onCreateBlank: () => void;
  onPromoteGlb: (mat: GlbMaterialInfo) => Promise<void>;
  onDuplicate: (mat: MaterialLibraryEntry) => void;
  onDelete: (id: string) => Promise<void>;
  onToast: (msg: string) => void;
}) {
  const [search,       setSearch]       = useState("");
  const [pendingMat,   setPendingMat]   = useState<string | null>(null);
  const [applying,     setApplying]     = useState(false);
  const [promoting,    setPromoting]    = useState<string | null>(null);
  const [preview, setPreview] = useState<{ mat: MaterialLibraryEntry; x: number; y: number } | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Extract Polyhaven texture ID from albedo URL
  function phId(m: MaterialLibraryEntry): string | null {
    const url = (m.properties as Record<string, unknown> | null)?.albedoMapUrl as string | undefined;
    if (!url) return null;
    const match = url.match(/\/([^/]+)\/[^/]+_diff_/);
    return match?.[1] ?? null;
  }

  function showPreview(mat: MaterialLibraryEntry, e: React.MouseEvent) {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    const el = e.currentTarget as HTMLElement;
    hoverTimer.current = setTimeout(() => {
      const rect = el.getBoundingClientRect();
      const x = rect.right + 12 < window.innerWidth - 240 ? rect.right + 12 : rect.left - 252;
      const y = Math.min(rect.top, window.innerHeight - 300);
      setPreview({ mat, x, y });
    }, 120);
  }

  function hidePreview() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setPreview(null);
  }

  // Can apply via option (requires active option + selected meshes)
  const canApplyOption = !!(activeOptionId && selectedMeshes.length > 0);
  // Can set base material (requires selected meshes, no option needed)
  const canSetBase = !activeOptionId && selectedMeshes.length > 0;
  const canApply = canApplyOption || canSetBase;

  const filteredMats    = search ? materials.filter(m => m.name.toLowerCase().includes(search.toLowerCase())) : materials;
  const filteredGlbMats = search ? glbMaterials.filter(m => m.name.toLowerCase().includes(search.toLowerCase())) : glbMaterials;

  async function doApply(matId: string) {
    if (!canApply) { onToast(selectedMeshes.length > 0 ? "Activate an option first (or deactivate to set base mat)" : "Select meshes first"); return; }
    setApplying(true);
    if (canApplyOption) {
      await onApply(matId);
    } else {
      onBaseApply(selectedMeshes, matId);
    }
    setPendingMat(null);
    setApplying(false);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div className="flex-shrink-0 px-2 py-2 border-b border-white/8 flex flex-col gap-1.5 bg-[#0a0a0a]">
        <div className="flex items-center justify-between">
          <span className="text-[9px] uppercase tracking-wider" style={{ color: canSetBase ? "rgba(251,191,36,0.7)" : "rgba(255,255,255,0.3)" }}>
            {canApplyOption
              ? `${selectedMeshes.length} mesh${selectedMeshes.length !== 1 ? "es" : ""} → option`
              : canSetBase
                ? `${selectedMeshes.length} mesh${selectedMeshes.length !== 1 ? "es" : ""} → base mat`
                : "Select meshes to assign"}
          </span>
          <button onClick={onCreateBlank} title="New material"
            className="w-5 h-5 flex items-center justify-center rounded bg-white/6 hover:bg-white/14 border border-white/10 text-white/40 hover:text-white text-[11px] transition-colors">
            +
          </button>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search materials…"
          className="w-full px-2.5 py-1 text-xs bg-white/5 border border-white/[0.08] rounded-lg text-white placeholder-white/20 outline-none focus:border-blue-500/50" />
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto px-1.5 py-1.5" style={{ scrollbarWidth: "none" }}>

        {/* GLB materials */}
        {filteredGlbMats.length > 0 && (
          <div className="mb-2">
            <p className="text-[9px] text-white/20 uppercase tracking-wider px-1 mb-1">From Model</p>
            {filteredGlbMats.map(m => {
              const isPending = pendingMat === `glb:${m.name}`;
              return (
                <div key={m.name}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors cursor-pointer group/mat mb-0.5 ${
                    isPending ? "bg-blue-600/15 border border-blue-500/25" : "hover:bg-white/4 border border-transparent"
                  }`}
                  onClick={() => setPendingMat(isPending ? null : `glb:${m.name}`)}
                  onDoubleClick={e => { e.stopPropagation(); onEditGlb(m.name); }}>
                  <Swatch color={m.color} size={18} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white/70 text-[10px] truncate">{m.name}</p>
                    <p className="text-[9px] text-white/25">R:{m.roughness.toFixed(2)} M:{m.metalness.toFixed(2)}</p>
                  </div>
                  {isPending && canApply ? (
                    <button onClick={e => { e.stopPropagation(); doApply(`glb:${m.name}`); }} disabled={applying}
                      className={`text-[9px] text-white px-2 py-0.5 rounded transition-colors disabled:opacity-40 flex-shrink-0 ${canSetBase ? "bg-amber-600 hover:bg-amber-500" : "bg-blue-600 hover:bg-blue-500"}`}>
                      {applying ? "…" : canSetBase ? "Base" : "Apply"}
                    </button>
                  ) : (
                    <button onClick={async e => { e.stopPropagation(); setPromoting(m.name); await onPromoteGlb(m); setPromoting(null); }}
                      disabled={promoting === m.name}
                      title="Copy to material library"
                      className="hidden group-hover/mat:flex w-5 h-5 items-center justify-center rounded text-white/25 hover:text-white/70 hover:bg-white/8 text-[10px] transition-colors disabled:opacity-30 flex-shrink-0">
                      {promoting === m.name ? "…" : "⎘"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Library materials — grouped grid */}
        {filteredMats.length > 0 && (() => {
          const catOrder = ["Flooring", "Countertops", "Walls", "Exterior", "Roofing", "Cabinetry", "Windows", "Other"];
          const grouped = filteredMats.reduce<Record<string, MaterialLibraryEntry[]>>((acc, m) => {
            const cat = m.category ?? "Other";
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(m);
            return acc;
          }, {});
          const sortedCats = Object.keys(grouped).sort(
            (a, b) => (catOrder.indexOf(a) === -1 ? 99 : catOrder.indexOf(a)) - (catOrder.indexOf(b) === -1 ? 99 : catOrder.indexOf(b))
          );
          return (
            <div className="flex flex-col gap-3 mt-1">
              <p className="text-[9px] text-white/20 uppercase tracking-wider px-0.5">Library</p>
              {sortedCats.map(cat => (
                <div key={cat}>
                  <p className="text-[8px] text-white/30 uppercase tracking-widest px-0.5 mb-1.5">{cat}</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {grouped[cat].map(m => {
                      const isPending = pendingMat === m.id;
                      const thumb = (m.properties as { albedoMapUrl?: string } | null)?.albedoMapUrl ?? null;
                      return (
                        <div
                          key={m.id}
                          className={`relative rounded-lg overflow-hidden cursor-pointer transition-all group/card ${
                            isPending
                              ? "ring-2 ring-blue-400 ring-offset-1 ring-offset-[#0a0a0a]"
                              : "ring-1 ring-white/10 hover:ring-white/30"
                          }`}
                          style={{ aspectRatio: "1 / 1" }}
                          onClick={() => setPendingMat(isPending ? null : m.id)}
                          onDoubleClick={e => { e.stopPropagation(); onEdit(m.id); }}
                          onMouseEnter={e => showPreview(m, e)}
                          onMouseLeave={hidePreview}
                        >
                          {/* Thumbnail — Polyhaven CDN thumb, fallback to albedo then base color */}
                          {(() => {
                            const id = phId(m);
                            const src = id
                              ? `https://cdn.polyhaven.com/asset_img/thumbs/${id}.png?width=256`
                              : thumb ?? null;
                            return src ? (
                              <img src={src} alt={m.name} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                            ) : (
                              <div className="absolute inset-0" style={{ backgroundColor: m.base_color }} />
                            );
                          })()}

                          {/* Selected overlay */}
                          {isPending && <div className="absolute inset-0 bg-blue-500/25" />}


                          {/* Name overlay */}
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-1 pb-1 pt-5">
                            <p className="text-white text-[8px] font-medium leading-tight truncate">{m.name}</p>
                          </div>

                          {/* Hover action buttons (top-right) */}
                          {!isPending && (
                            <div className="absolute top-0.5 right-0.5 hidden group-hover/card:flex gap-0.5">
                              <button
                                onClick={e => { e.stopPropagation(); onEdit(m.id); }}
                                title="Edit" className="w-4 h-4 flex items-center justify-center rounded bg-black/70 text-white/60 hover:text-white text-[8px] transition-colors">
                                ✎
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); onDuplicate(m); }}
                                title="Duplicate" className="w-4 h-4 flex items-center justify-center rounded bg-black/70 text-white/60 hover:text-white text-[8px] transition-colors">
                                ⎘
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); if (confirm(`Delete "${m.name}"?`)) onDelete(m.id); }}
                                title="Delete" className="w-4 h-4 flex items-center justify-center rounded bg-black/70 text-white/40 hover:text-red-400 text-[8px] transition-colors">
                                ✕
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {search && filteredMats.length === 0 && filteredGlbMats.length === 0 && (
          <p className="text-center py-6 text-white/20 text-[10px]">No materials match "{search}"</p>
        )}
      </div>

      {/* Sticky action bar — shown when a material is selected */}
      {pendingMat && (
        <div className="flex-shrink-0 border-t border-white/8 bg-[#0d0d0d] px-2 py-2 flex flex-col gap-1.5">
          {/* Selected material name */}
          {(() => {
            const name = pendingMat.startsWith("glb:")
              ? pendingMat.slice(4)
              : (materials.find(m => m.id === pendingMat)?.name ?? pendingMat);
            return (
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-white/40 truncate max-w-[140px]">{name}</span>
                <button onClick={() => setPendingMat(null)} className="text-white/25 hover:text-white/60 text-[10px] transition-colors">✕</button>
              </div>
            );
          })()}

          {/* Action buttons */}
          <div className="flex gap-1.5">
            {canApplyOption && (
              <button
                onClick={() => doApply(pendingMat)}
                disabled={applying}
                className="flex-1 py-1.5 text-[10px] font-semibold bg-blue-600/90 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-40">
                {applying ? "Applying…" : `Apply to Option`}
              </button>
            )}
            {canSetBase && (
              <button
                onClick={() => doApply(pendingMat)}
                disabled={applying}
                className="flex-1 py-1.5 text-[10px] font-semibold bg-amber-600/90 hover:bg-amber-500 text-white rounded-lg transition-colors disabled:opacity-40">
                {applying ? "Applying…" : "Set as Base"}
              </button>
            )}
            {!canApply && (
              <p className="flex-1 text-center text-[9px] text-white/25 py-1.5">
                {selectedMeshes.length === 0 ? "Select meshes in viewport" : "Activate an option above"}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Polyhaven hover preview popover */}
      {preview && (() => {
        const id = phId(preview.mat);
        const props = preview.mat.properties as Record<string, unknown> | null;
        const roughness = preview.mat.roughness ?? 0.5;
        const metalness = preview.mat.metalness ?? 0;
        const clearcoat = (props?.clearcoat as number | undefined) ?? 0;
        return (
          <div
            className="fixed z-[9999] w-56 rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-[#1a1a1e] pointer-events-none"
            style={{ left: preview.x, top: preview.y }}
          >
            {id ? (
              <img
                src={`https://cdn.polyhaven.com/asset_img/primary/${id}.png?width=512`}
                alt={preview.mat.name}
                className="w-full aspect-square object-cover"
                style={{ display: "block" }}
              />
            ) : (
              <div
                className="w-full aspect-square"
                style={{ background: preview.mat.base_color ?? "#888" }}
              />
            )}
            <div className="px-3 py-2.5 space-y-1.5">
              <p className="text-white text-[11px] font-semibold leading-tight truncate">{preview.mat.name}</p>
              {preview.mat.category && (
                <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-medium bg-white/10 text-white/50 uppercase tracking-wide">
                  {preview.mat.category}
                </span>
              )}
              <div className="flex gap-2 pt-0.5">
                <div className="flex-1">
                  <p className="text-white/30 text-[8px] uppercase tracking-wider mb-0.5">Roughness</p>
                  <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full bg-white/50" style={{ width: `${roughness * 100}%` }} />
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-white/30 text-[8px] uppercase tracking-wider mb-0.5">Metalness</p>
                  <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full bg-amber-400/70" style={{ width: `${metalness * 100}%` }} />
                  </div>
                </div>
                {clearcoat > 0 && (
                  <div className="flex-1">
                    <p className="text-white/30 text-[8px] uppercase tracking-wider mb-0.5">Clearcoat</p>
                    <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full bg-blue-400/70" style={{ width: `${clearcoat * 100}%` }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─── Model error boundary ─────────────────────────────────────────────────────

class ModelErrorBoundary extends Component<
  { onError: (msg: string) => void; children: React.ReactNode },
  { caught: boolean }
> {
  state = { caught: false };
  static getDerivedStateFromError() { return { caught: true }; }
  componentDidCatch(err: unknown) {
    this.props.onError(err instanceof Error ? err.message : String(err));
  }
  render() { return this.state.caught ? null : this.props.children; }
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SceneEditorPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const router = useRouter();
  const viewportRef  = useRef<SceneEditorViewportHandle | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Core data ──────────────────────────────────────────────────────────────
  const [project,    setProject]    = useState<Project | null>(null);
  const [categories, setCategories] = useState<CategoryWithOptions[]>([]);
  const [materials,  setMaterials]  = useState<MaterialLibraryEntry[]>([]);
  const [sceneTree,  setSceneTree]  = useState<SceneTreeNode[]>([]);
  const [glbMaterials, setGlbMaterials] = useState<GlbMaterialInfo[]>([]);
  const [modelLoadErr, setModelLoadErr] = useState<string | null>(null);

  // ── Transform / scene state ────────────────────────────────────────────────
  const [selectedMeshes,  setSelectedMeshes]  = useState<string[]>([]);
  const [transformMode,   setTransformMode]   = useState<TransformMode | "none">("none");
  const [meshOverrides,   setMeshOverrides]   = useState<MeshOverrides>({});
  const DEFAULT_PHASE_SETTINGS: Record<Phase, SceneSettings> = {
    blueprint: { ...DEFAULT_SCENE_SETTINGS },
    interior:  { ...DEFAULT_SCENE_SETTINGS },
    exterior:  { ...DEFAULT_SCENE_SETTINGS },
  };
  const [phaseSettings,   setPhaseSettings]   = useState<Record<Phase, SceneSettings>>(DEFAULT_PHASE_SETTINGS);
  const [lightingPhase,   setLightingPhase]   = useState<Phase>("exterior");
  const [cameraDefaults,  setCameraDefaults]  = useState<Record<string, unknown>>({});
  const [hiddenLayers,    setHiddenLayers]    = useState<Set<string>>(new Set());

  // ── Undo / redo ────────────────────────────────────────────────────────────
  // Snapshot covers every editor action: transforms, scene settings,
  // material assignments (per option), and material property edits.
  type OptionSnap = { node_list: string[]; material_assignments: { mesh_name: string; material_id: string }[] };
  type MatSnap    = { name: string; category: string; base_color: string; roughness: number; metalness: number; properties: MaterialLibraryEntry["properties"] };
  type EditorSnapshot = { meshOverrides: MeshOverrides; phaseSettings: Record<Phase, SceneSettings>; options: Record<string, OptionSnap>; mats: Record<string, MatSnap>; deletedMeshes: string[] };

  const activeSettings = phaseSettings[lightingPhase];

  const meshOverridesRef   = useRef(meshOverrides);   meshOverridesRef.current   = meshOverrides;
  const categoriesRef      = useRef(categories);      categoriesRef.current      = categories;
  const materialsRef       = useRef(materials);       materialsRef.current       = materials;
  const phaseSettingsRef   = useRef(phaseSettings);   phaseSettingsRef.current   = phaseSettings;
  const selectedMeshesRef  = useRef(selectedMeshes);  selectedMeshesRef.current  = selectedMeshes;
  const undoStackRef = useRef<EditorSnapshot[]>([]);
  const redoStackRef = useRef<EditorSnapshot[]>([]);
  const [undoLen, setUndoLen] = useState(0);
  const [redoLen, setRedoLen] = useState(0);

  // Stable refs so keyboard handler ([] deps) always calls latest undo/redo
  const undoFnRef = useRef<() => Promise<void>>(async () => {});
  const redoFnRef = useRef<() => Promise<void>>(async () => {});

  function captureSnapshot(): EditorSnapshot {
    const options: Record<string, OptionSnap> = {};
    for (const cat of categoriesRef.current)
      for (const opt of cat.options)
        options[opt.id] = {
          node_list: [...(opt.node_list ?? [])],
          material_assignments: (opt.material_assignments ?? []).map(a => ({ ...a })),
        };
    const mats: Record<string, MatSnap> = {};
    for (const m of materialsRef.current)
      mats[m.id] = { name: m.name, category: m.category ?? "Other", base_color: m.base_color, roughness: m.roughness, metalness: m.metalness, properties: m.properties };
    return { meshOverrides: { ...meshOverridesRef.current }, phaseSettings: { blueprint: { ...phaseSettingsRef.current.blueprint }, interior: { ...phaseSettingsRef.current.interior }, exterior: { ...phaseSettingsRef.current.exterior } }, options, mats, deletedMeshes: [...deletedMeshesRef.current] };
  }

  function pushUndo() {
    undoStackRef.current = [...undoStackRef.current.slice(-49), captureSnapshot()];
    redoStackRef.current = [];
    setUndoLen(undoStackRef.current.length);
    setRedoLen(0);
  }

  async function applySnapshot(snap: EditorSnapshot) {
    setMeshOverrides(snap.meshOverrides);
    setPhaseSettings(snap.phaseSettings);
    if (snap.deletedMeshes) setDeletedMeshes(new Set(snap.deletedMeshes));
    // Restore changed options
    const cur: Record<string, OptionSnap> = {};
    for (const cat of categoriesRef.current)
      for (const opt of cat.options)
        cur[opt.id] = { node_list: opt.node_list ?? [], material_assignments: opt.material_assignments ?? [] };
    await Promise.all(
      Object.entries(snap.options)
        .filter(([id, v]) => JSON.stringify(cur[id]) !== JSON.stringify(v))
        .map(([id, v]) => (supabase.from("options") as any).update({ node_list: v.node_list, material_assignments: v.material_assignments }).eq("id", id))
    );
    // Restore changed materials
    const curMats: Record<string, MatSnap> = {};
    for (const m of materialsRef.current)
      curMats[m.id] = { name: m.name, category: m.category ?? "Other", base_color: m.base_color, roughness: m.roughness, metalness: m.metalness, properties: m.properties };
    await Promise.all(
      Object.entries(snap.mats)
        .filter(([id, v]) => JSON.stringify(curMats[id]) !== JSON.stringify(v))
        .map(([id, v]) => fetch(`/api/admin/materials/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) }))
    );
    await Promise.all([reloadCategories(), reloadMaterials()]);
  }

  async function undo() {
    if (!undoStackRef.current.length) return;
    const snap = undoStackRef.current[undoStackRef.current.length - 1];
    redoStackRef.current = [captureSnapshot(), ...redoStackRef.current.slice(0, 49)];
    undoStackRef.current = undoStackRef.current.slice(0, -1);
    setUndoLen(undoStackRef.current.length);
    setRedoLen(redoStackRef.current.length);
    await applySnapshot(snap);
  }
  undoFnRef.current = undo;

  async function redo() {
    if (!redoStackRef.current.length) return;
    const snap = redoStackRef.current[0];
    undoStackRef.current = [...undoStackRef.current.slice(-49), captureSnapshot()];
    redoStackRef.current = redoStackRef.current.slice(1);
    setUndoLen(undoStackRef.current.length);
    setRedoLen(redoStackRef.current.length);
    await applySnapshot(snap);
  }
  redoFnRef.current = redo;

  // Debounced scene-settings undo: captures snapshot on the first change in a burst
  const settingsChangingRef  = useRef(false);
  const settingsUndoTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  function debouncedSettingsUndo() {
    if (!settingsChangingRef.current) { settingsChangingRef.current = true; pushUndo(); }
    if (settingsUndoTimer.current) clearTimeout(settingsUndoTimer.current);
    settingsUndoTimer.current = setTimeout(() => { settingsChangingRef.current = false; }, 600);
  }

  // Per-phase lighting settings (env tab)
  function handleSceneSettings(s: SceneSettings) {
    debouncedSettingsUndo();
    setPhaseSettings(prev => ({ ...prev, [lightingPhase]: s }));
  }

  // Global settings (camera tab, structural panel) — synced to all phases
  const GLOBAL_KEYS: (keyof SceneSettings)[] = [
    "roofNodes", "level1Nodes", "level2Nodes", "level3Nodes",
    "groundPlane", "groundColor", "groundSize", "showGrid",
    "cameraFov", "architecturalMode", "rotateSpeed", "panSpeed", "zoomSpeed", "screenSpacePanning",
    "welcomeMessage", "exteriorMessage", "interiorMessage",
  ];
  function handleGlobalSettings(s: SceneSettings) {
    debouncedSettingsUndo();
    const patch = Object.fromEntries(GLOBAL_KEYS.map(k => [k, s[k]])) as Partial<SceneSettings>;
    setPhaseSettings(prev => ({
      blueprint: { ...prev.blueprint, ...patch },
      interior:  { ...prev.interior,  ...patch },
      exterior:  { ...prev.exterior,  ...patch },
    }));
  }

  // ── Option / paint state ───────────────────────────────────────────────────
  const [activeOptionId, setActiveOptionId] = useState<string | null>(null);
  const [paintMatId,     setPaintMatId]     = useState<string | null>(null);

  // ── Material editor state ──────────────────────────────────────────────────
  const [editingMatId,     setEditingMatId]     = useState<string | null>(null);
  const [editPreview,      setEditPreview]      = useState<MaterialLibraryEntry | null>(null);
  const [editingGlbMatName, setEditingGlbMatName] = useState<string | null>(null);
  const [glbMatOverrides,   setGlbMatOverrides]   = useState<Record<string, { base_color: string; roughness: number; metalness: number; properties?: MaterialLibraryEntry["properties"] }>>({});
  const [meshBaseMatMap,    setMeshBaseMatMap]    = useState<Record<string, string>>({}); // meshName → material_id
  const [deletedMeshes,    setDeletedMeshes]     = useState<Set<string>>(new Set());
  const deletedMeshesRef   = useRef(deletedMeshes);   deletedMeshesRef.current   = deletedMeshes;

  // ── Addon GLBs ─────────────────────────────────────────────────────────────
  const [addons,            setAddons]            = useState<ProjectAddon[]>([]);
  const [selectedAddonId,   setSelectedAddonId]   = useState<string | null>(null);
  const [addonMeshNames,    setAddonMeshNames]    = useState<Record<string, string[]>>({});
  const [addonUploading,    setAddonUploading]    = useState(false);
  const [addonUploadPct,    setAddonUploadPct]    = useState(0);
  const [addonUploadErr,    setAddonUploadErr]    = useState("");
  const [baking,            setBaking]            = useState(false);
  const addonFileRef = useRef<HTMLInputElement>(null);

  // ── Camera Bookmarks ───────────────────────────────────────────────────────
  const [cameraBookmarks, setCameraBookmarks] = useState<CameraBookmark[]>([]);
  const [bookmarkName,    setBookmarkName]    = useState("");

  // ── Annotation Pins ────────────────────────────────────────────────────────
  const [annotations,      setAnnotations]      = useState<AnnotationPin[]>([]);
  const [placingAnnotation, setPlacingAnnotation] = useState(false);
  const [editingAnnotId,   setEditingAnnotId]   = useState<string | null>(null);

  // ── Isolation override (H key) ─────────────────────────────────────────────
  const [isolationOverride, setIsolationOverride] = useState<string[] | null>(null);

  // ── Mesh triangle counts ───────────────────────────────────────────────────
  const [triangleCounts, setTriangleCounts] = useState<MeshTriangleCounts>({});

  // ── Smart model swap diff ──────────────────────────────────────────────────
  const [swapDiff, setSwapDiff] = useState<{ missing: string[]; found: string[] } | null>(null);

  // ── Left / right panel tabs ────────────────────────────────────────────────
  const [leftTab,  setLeftTab]  = useState<"options" | "thumb" | "layers" | "health">("options");
  const [rightTab, setRightTab] = useState<"scene" | "material" | "props" | "shapes" | "lights" | "settings">("scene");

  // ── Placed props ───────────────────────────────────────────────────────────
  const [placedProps,    setPlacedProps]    = useState<PlacedPropData[]>([]);
  const [placingPropId,  setPlacingPropId]  = useState<string | null>(null);
  const [placingPropUrl, setPlacingPropUrl] = useState<string | null>(null);
  const [placingPropScale, setPlacingPropScale] = useState<[number,number,number] | null>(null);
  const [selectedPropId, setSelectedPropId] = useState<string | null>(null);
  const [propTransformMode, setPropTransformMode] = useState<"translate" | "rotate" | "scale">("translate");
  const placedPropsRef = useRef(placedProps); placedPropsRef.current = placedProps;

  // ── Placed lights ──────────────────────────────────────────────────────────
  const [placedLights,     setPlacedLights]     = useState<PlacedLight[]>([]);
  const [placingLightType, setPlacingLightType] = useState<"point" | "spot" | null>(null);
  const [selectedLightId,  setSelectedLightId]  = useState<string | null>(null);

  // ── Placed shapes ──────────────────────────────────────────────────────────
  const [placedShapes,      setPlacedShapes]      = useState<PlacedShapeData[]>([]);
  const [selectedShapeId,   setSelectedShapeId]   = useState<string | null>(null);
  const [shapeTransformMode, setShapeTransformMode] = useState<"translate" | "rotate" | "scale">("translate");
  const shapeMeshNames = useMemo(() => new Set(placedShapes.map(s => s.name)), [placedShapes]);

  function handleActivePropChange(id: string | null, url: string | null, scale: [number,number,number] | null) {
    if (!id || !url || !scale) {
      setPlacingPropId(null); setPlacingPropUrl(null); setPlacingPropScale(null);
      return;
    }
    // Cancel if same prop already active
    if (placingPropId === id) {
      setPlacingPropId(null); setPlacingPropUrl(null); setPlacingPropScale(null);
      return;
    }
    setPlacingPropId(id);
    setPlacingPropUrl(url);
    setPlacingPropScale(scale);
  }

  function handlePropPlaced(pos: [number,number,number]) {
    if (!placingPropId || !placingPropUrl || !placingPropScale) return;
    const newId = Math.random().toString(36).slice(2);
    const newProp: PlacedPropData = {
      id: newId,
      propId: placingPropId,
      modelUrl: placingPropUrl,
      position: pos,
      rotation: [0, 0, 0],
      scale: placingPropScale,
    };
    setPlacedProps(prev => [...prev, newProp]);
    setSelectedPropId(newId);
  }

  function handlePropTransformed(id: string, pos: [number,number,number], rot: [number,number,number], sc: [number,number,number]) {
    setPlacedProps(prev => prev.map(p => p.id === id ? { ...p, position: pos, rotation: rot, scale: sc } : p));
  }

  function handleCancelPlacement() {
    setPlacingPropId(null);
    setPlacingPropUrl(null);
    setPlacingPropScale(null);
  }

  // ── Light handlers ─────────────────────────────────────────────────────────
  function handleLightPlaced(pos: [number,number,number]) {
    if (!placingLightType) return;
    const id = Math.random().toString(36).slice(2);
    const newLight: PlacedLight = {
      id,
      type: placingLightType,
      position: pos,
      color: "#ffe8cc",
      intensity: 3,
      distance: 8,
      decay: 2,
      castShadow: true,
      angle: Math.PI / 6,
      penumbra: 0.25,
    };
    setPlacedLights(prev => [...prev, newLight]);
    setPlacingLightType(null);
    setSelectedLightId(id);
  }

  function handleLightTransformed(id: string, pos: [number,number,number]) {
    setPlacedLights(prev => prev.map(l => l.id === id ? { ...l, position: pos } : l));
  }

  // ── Double-click handlers ──────────────────────────────────────────────────
  function handleMeshDoubleClick(meshName: string) {
    // Find material assigned to this mesh in the active option first
    if (activeOptionId) {
      const opt = categories.flatMap(c => c.options).find(o => o.id === activeOptionId);
      const assign = opt?.material_assignments?.find(a => a.mesh_name === meshName);
      if (assign) {
        if (assign.material_id.startsWith("glb:")) {
          setEditingGlbMatName(assign.material_id.slice(4)); setEditingMatId(null);
        } else {
          setEditingMatId(assign.material_id); setEditingGlbMatName(null);
        }
        setEditPreview(null); setRightTab("material"); return;
      }
    }
    // Fallback: base material map
    const baseMat = meshBaseMatMap[meshName];
    if (baseMat) {
      if (baseMat.startsWith("glb:")) {
        setEditingGlbMatName(baseMat.slice(4)); setEditingMatId(null);
      } else {
        setEditingMatId(baseMat); setEditingGlbMatName(null);
      }
      setEditPreview(null); setRightTab("material");
    }
  }

  function handleOptionDoubleClick(optId: string) {
    const opt = categories.flatMap(c => c.options).find(o => o.id === optId);
    if (!opt?.material_assignments?.length) return;
    // Prefer assignment for currently selected mesh
    const assign = (selectedMeshes.length > 0
      ? opt.material_assignments.find(a => a.mesh_name === selectedMeshes[0])
      : undefined) ?? opt.material_assignments[0];
    if (!assign) return;
    if (assign.material_id.startsWith("glb:")) {
      setEditingGlbMatName(assign.material_id.slice(4)); setEditingMatId(null);
    } else {
      setEditingMatId(assign.material_id); setEditingGlbMatName(null);
    }
    setEditPreview(null); setRightTab("material");
  }

  // ── UI state ───────────────────────────────────────────────────────────────
  const [uploading,     setUploading]     = useState(false);
  const [uploadPct,     setUploadPct]     = useState(0);
  const [uploadErr,     setUploadErr]     = useState("");
  const [autoCompress,    setAutoCompress]    = useState(true);
  const [compressing,     setCompressing]     = useState(false);
  const [compressResult,  setCompressResult]  = useState<{ originalFormatted: string; compressedFormatted: string; reductionPct: number } | null>(null);
  const [compressErr,     setCompressErr]     = useState("");
  const [compressErrModal, setCompressErrModal] = useState("");
  const [saving,          setSaving]          = useState(false);
  const [toast,         setToast]         = useState("");

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 2500); }

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z") { e.preventDefault(); undoFnRef.current(); }
        if (e.key === "y") { e.preventDefault(); redoFnRef.current(); }
        return;
      }
      switch (e.key.toLowerCase()) {
        case "w": setTransformMode("translate"); break;
        case "r": setTransformMode("scale");     break;
        case "d": setTransformMode("rotate");    break;
        case "h":
          // Alt+H clears isolation; H with selection isolates to selection
          if (e.altKey) {
            setIsolationOverride(null);
          } else if (selectedMeshesRef.current.length > 0) {
            setIsolationOverride([...selectedMeshesRef.current]);
          }
          break;
        case "escape":
          setSelectedMeshes([]);
          setTransformMode("none");
          setPaintMatId(null);
          setActiveOptionId(null);
          setIsolationOverride(null);
          setPlacingAnnotation(false);
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const [pRes, cRes, mRes] = await Promise.all([
        (supabase.from("projects") as any).select("*").eq("id", projectId).single(),
        (supabase.from("categories") as any)
          .select("*, options(*)")
          .eq("project_id", projectId)
          .order("sort_order")
          .order("sort_order", { referencedTable: "options" }),
        fetch("/api/admin/materials").then(r => r.json()),
      ]);
      if (pRes.data) {
        const p = pRes.data as Project;
        setProject(p);
        const cd = (p.camera_defaults ?? {}) as Record<string, unknown>;
        setCameraDefaults(cd);
        function migrateLegacySettings(saved: Partial<SceneSettings> & { sunPosition?: [number,number,number] }): SceneSettings {
          if (saved.sunPosition && !saved.sunElevationDeg) {
            const [x, y, z] = saved.sunPosition;
            const dist = Math.sqrt(x*x + y*y + z*z) || 18;
            saved.sunElevationDeg = Math.max(0, Math.round(Math.asin(y / dist) * 180 / Math.PI));
            saved.sunAzimuthDeg   = Math.round(((Math.atan2(x, z) * 180 / Math.PI) + 360) % 360);
            saved.sunDistance     = Math.round(dist);
            delete saved.sunPosition;
          }
          return { ...DEFAULT_SCENE_SETTINGS, ...saved };
        }
        if ((cd as any)._phaseSettings) {
          const ps = (cd as any)._phaseSettings as Partial<Record<Phase, Partial<SceneSettings>>>;
          setPhaseSettings({
            blueprint: migrateLegacySettings({ ...(ps.blueprint ?? {}) }),
            interior:  migrateLegacySettings({ ...(ps.interior  ?? {}) }),
            exterior:  migrateLegacySettings({ ...(ps.exterior  ?? {}) }),
          });
        } else if ((cd as any)._settings) {
          const s = migrateLegacySettings({ ...(cd as any)._settings });
          setPhaseSettings({ blueprint: s, interior: s, exterior: s });
        }
        if ((cd as any)._meshOverrides)   setMeshOverrides((cd as any)._meshOverrides as MeshOverrides);
        if ((cd as any)._meshBaseMats)    setMeshBaseMatMap((cd as any)._meshBaseMats as Record<string, string>);
        if ((cd as any)._glbMatOverrides) setGlbMatOverrides((cd as any)._glbMatOverrides);
        if ((cd as any)._deletedMeshes)   setDeletedMeshes(new Set((cd as any)._deletedMeshes as string[]));
        if ((cd as any)._placedProps)      setPlacedProps((cd as any)._placedProps as PlacedPropData[]);
        if ((cd as any)._placedShapes)    setPlacedShapes((cd as any)._placedShapes as PlacedShapeData[]);
        if ((cd as any)._placedLights)    setPlacedLights((cd as any)._placedLights as PlacedLight[]);
        if ((cd as any)._addons)          setAddons((cd as any)._addons as ProjectAddon[]);
        if ((cd as any)._cameraBookmarks) setCameraBookmarks((cd as any)._cameraBookmarks as CameraBookmark[]);
        if ((cd as any)._annotations)     setAnnotations((cd as any)._annotations as AnnotationPin[]);
      }
      if (cRes.data)          setCategories(cRes.data as CategoryWithOptions[]);
      if (Array.isArray(mRes)) setMaterials(mRes as MaterialLibraryEntry[]);
    }
    load();
  }, [projectId]);

  const reloadCategories = useCallback(async () => {
    const { data } = await (supabase.from("categories") as any)
      .select("*, options(*)")
      .eq("project_id", projectId)
      .order("sort_order")
      .order("sort_order", { referencedTable: "options" });
    if (data) setCategories(data as CategoryWithOptions[]);
  }, [projectId]);

  const reloadMaterials = useCallback(async () => {
    const r = await fetch("/api/admin/materials");
    if (r.ok) setMaterials(await r.json());
  }, []);

  // Preload material textures into browser HTTP cache so the first time a texture
  // is assigned to a mesh it appears instantly instead of after a network delay.
  useEffect(() => {
    const TEX_KEYS = [
      "albedoMapUrl", "normalMapUrl", "roughnessMapUrl", "glossinessMapUrl",
      "bumpMapUrl", "metalnessMapUrl", "aoMapUrl", "displacementMapUrl",
    ] as const;
    const seen = new Set<string>();
    for (const mat of materials) {
      const p = mat.properties ?? {};
      for (const key of TEX_KEYS) {
        const url = (p as Record<string, unknown>)[key];
        if (typeof url === "string" && url && !seen.has(url)) {
          seen.add(url);
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = url;
        }
      }
    }
  }, [materials]);

  // Also preload textures for the live edit preview so changes appear without delay.
  useEffect(() => {
    if (!editPreview) return;
    const TEX_KEYS = [
      "albedoMapUrl", "normalMapUrl", "roughnessMapUrl", "glossinessMapUrl",
      "bumpMapUrl", "metalnessMapUrl", "aoMapUrl", "displacementMapUrl",
    ] as const;
    const p = editPreview.properties ?? {};
    for (const key of TEX_KEYS) {
      const url = (p as Record<string, unknown>)[key];
      if (typeof url === "string" && url) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = url;
      }
    }
  }, [editPreview]);

  // ── Selection / transform handlers ────────────────────────────────────────
  const handleMeshSelect = useCallback((names: string[]) => {
    if (paintMatId && activeOptionId && names.length > 0) {
      // Paint mode: apply material to clicked mesh immediately
      const meshName = names[0];
      applyPaintToMesh(activeOptionId, meshName, paintMatId);
      return;
    }
    setSelectedMeshes(names);
    if (names.length > 0) setTransformMode(prev => prev === "none" ? "translate" : prev);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paintMatId, activeOptionId]);

  const handleMeshToggle = useCallback((name: string) => {
    setSelectedMeshes(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  }, []);

  const handleSceneTreeUpdate = useCallback((tree: SceneTreeNode[]) => {
    setSceneTree(tree);
  }, []);

  const handleSceneLoaded = useCallback((tree: SceneTreeNode[]) => {
    setSceneTree(tree);
    // Check for broken mappings after any model load
    const names = new Set<string>();
    function walk(nodes: SceneTreeNode[]) { for (const n of nodes) { if (n.name) names.add(n.name); if (n.children?.length) walk(n.children); } }
    walk(tree);
    checkMappingHealthAfterUpload(names);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  const handleMeshTransformStart = useCallback(() => {
    pushUndo();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMeshTransformed = useCallback((
    name: string,
    pos: [number,number,number],
    rot: [number,number,number],
    sc: [number,number,number],
  ) => {
    setMeshOverrides({ ...meshOverridesRef.current, [name]: { position: pos, rotation: rot, scale: sc } });
  }, []);

  function handleDeleteMesh(name: string) {
    pushUndo();
    setDeletedMeshes(prev => new Set([...prev, name]));
    setSelectedMeshes(prev => prev.filter(n => n !== name));
    showToast(`"${name}" hidden — Save to persist`);
  }

  function handleRestoreMesh(name: string) {
    pushUndo();
    setDeletedMeshes(prev => { const s = new Set(prev); s.delete(name); return s; });
    showToast(`"${name}" restored`);
  }

  function handleToggleMeshVisibility(name: string) {
    pushUndo();
    setDeletedMeshes(prev => {
      const s = new Set(prev);
      if (s.has(name)) { s.delete(name); } else { s.add(name); }
      return s;
    });
  }

  const handleResetMeshTransform = useCallback((name: string) => {
    pushUndo();
    const next = { ...meshOverridesRef.current };
    delete next[name];
    setMeshOverrides(next);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Active option helpers ──────────────────────────────────────────────────
  const activeOption = useMemo(() => {
    if (!activeOptionId) return null;
    for (const cat of categories) {
      const opt = cat.options.find(o => o.id === activeOptionId);
      if (opt) return opt;
    }
    return null;
  }, [activeOptionId, categories]);

  const isolationMeshes = useMemo(
    () => isolationOverride ?? (activeOption?.node_list?.length ? activeOption.node_list : undefined),
    [isolationOverride, activeOption]
  );

  async function handleAssignMeshes(optionId: string, meshNames: string[]) {
    pushUndo();
    const option = categories.flatMap(c => c.options).find(o => o.id === optionId);
    if (!option) return;
    const updated = [...new Set([...(option.node_list ?? []), ...meshNames])];
    const { error } = await (supabase.from("options") as any)
      .update({ node_list: updated }).eq("id", optionId);
    if (error) showToast(`Error: ${error.message}`);
    else { showToast(`${meshNames.length} mesh(es) assigned`); await reloadCategories(); }
  }

  async function handleAssignMeshesToCategory(categoryId: string, meshNames: string[]) {
    const cat = categories.find(c => c.id === categoryId);
    if (!cat || cat.options.length === 0) return;
    pushUndo();
    await Promise.all(
      cat.options.map(opt => {
        const updated = [...new Set([...(opt.node_list ?? []), ...meshNames])];
        return (supabase.from("options") as any).update({ node_list: updated }).eq("id", opt.id);
      }),
    );
    showToast(`${meshNames.length} mesh(es) assigned to all ${cat.options.length} options`);
    await reloadCategories();
  }

  async function applyPaintToMesh(optionId: string, meshName: string, matId: string) {
    pushUndo();
    const option = categories.flatMap(c => c.options).find(o => o.id === optionId);
    if (!option) return;
    const existing = (option.material_assignments ?? []).filter(
      (a: { mesh_name: string }) => a.mesh_name !== meshName
    );
    existing.push({ mesh_name: meshName, material_id: matId });
    const nodeList = [...new Set([...(option.node_list ?? []), meshName])];
    const { error } = await (supabase.from("options") as any)
      .update({ material_assignments: existing, node_list: nodeList, option_type: "material_override" })
      .eq("id", optionId);
    if (error) showToast(`Error: ${error.message}`);
    else { showToast(`Material applied`); await reloadCategories(); }
  }

  async function handleSetNodeCondition(optionId: string, meshName: string, conditionOptionId: string | null) {
    return handleSetNodeConditionBulk(optionId, [meshName], conditionOptionId);
  }

  async function handleSetNodeConditionBulk(optionId: string, meshNames: string[], conditionOptionId: string | null) {
    const option = categories.flatMap(c => c.options).find(o => o.id === optionId);
    if (!option) return;
    // Build the full conditions object in one pass so a single DB write covers all meshes
    const conditions = { ...((option as any).node_conditions ?? {}) } as Record<string, string>;
    for (const meshName of meshNames) {
      if (conditionOptionId === null) delete conditions[meshName];
      else conditions[meshName] = conditionOptionId;
    }
    const { error } = await (supabase.from("options") as any)
      .update({ node_conditions: conditions })
      .eq("id", optionId);
    if (error) showToast(`Error: ${error.message}`);
    else {
      await reloadCategories();
      showToast(conditionOptionId
        ? `Condition set on ${meshNames.length} mesh${meshNames.length !== 1 ? "es" : ""}`
        : `Condition removed from ${meshNames.length} mesh${meshNames.length !== 1 ? "es" : ""}`);
    }
  }

  async function handleRemoveMaterialAssignment(optionId: string, meshName: string) {
    pushUndo();
    const option = categories.flatMap(c => c.options).find(o => o.id === optionId);
    if (!option) return;
    const assignments = (option.material_assignments ?? []).filter(
      (a: { mesh_name: string }) => a.mesh_name !== meshName
    );
    const { error } = await (supabase.from("options") as any)
      .update({ material_assignments: assignments })
      .eq("id", optionId);
    if (error) showToast(`Error: ${error.message}`);
    else { showToast("Material removed"); await reloadCategories(); }
  }

  async function handleRemoveMesh(optionId: string, meshName: string) {
    pushUndo();
    const option = categories.flatMap(c => c.options).find(o => o.id === optionId);
    if (!option) return;
    const nodeList    = (option.node_list ?? []).filter((n: string) => n !== meshName);
    const assignments = (option.material_assignments ?? []).filter(
      (a: { mesh_name: string }) => a.mesh_name !== meshName
    );
    const { error } = await (supabase.from("options") as any)
      .update({ node_list: nodeList, material_assignments: assignments })
      .eq("id", optionId);
    if (error) showToast(`Error: ${error.message}`);
    else { showToast("Mesh removed"); await reloadCategories(); }
  }

  async function handleRemoveStaleNodes(optionId: string) {
    pushUndo();
    const option = categories.flatMap(c => c.options).find(o => o.id === optionId);
    if (!option) return;
    const isKnown = (n: string) => glbMeshNames.has(n) || shapeMeshNames.has(n);
    const nodeList    = (option.node_list ?? []).filter((n: string) => isKnown(n));
    const assignments = (option.material_assignments ?? []).filter(
      (a: { mesh_name: string }) => isKnown(a.mesh_name)
    );
    const removed = (option.node_list ?? []).length - nodeList.length;
    const { error } = await (supabase.from("options") as any)
      .update({ node_list: nodeList, material_assignments: assignments })
      .eq("id", optionId);
    if (error) showToast(`Error: ${error.message}`);
    else { showToast(`Removed ${removed} stale node${removed !== 1 ? "s" : ""}`); await reloadCategories(); }
  }

  async function handleApplyMaterial(matId: string) {
    if (!activeOptionId || !selectedMeshes.length) return;
    const option = categories.flatMap(c => c.options).find(o => o.id === activeOptionId);
    if (!option) return;
    pushUndo();
    let assignments = [...(option.material_assignments ?? [])];
    const nodeList = new Set(option.node_list ?? []);
    for (const meshName of selectedMeshes) {
      assignments = assignments.filter((a: { mesh_name: string }) => a.mesh_name !== meshName);
      assignments.push({ mesh_name: meshName, material_id: matId });
      nodeList.add(meshName);
    }
    const { error } = await (supabase.from("options") as any)
      .update({ material_assignments: assignments, node_list: [...nodeList], option_type: "material_override" })
      .eq("id", activeOptionId);
    if (error) showToast(`Error: ${error.message}`);
    else { showToast(`Material applied to ${selectedMeshes.length} mesh${selectedMeshes.length !== 1 ? "es" : ""}`); await reloadCategories(); }
  }

  function handleSetBaseMaterial(meshNames: string[], matId: string) {
    pushUndo();
    setMeshBaseMatMap(prev => {
      const next = { ...prev };
      for (const name of meshNames) next[name] = matId;
      return next;
    });
    showToast(`Base material set for ${meshNames.length} mesh${meshNames.length !== 1 ? "es" : ""}`);
  }

  async function handleApplyPaintToSelected() {
    pushUndo();
    if (!paintMatId || !activeOptionId || !selectedMeshes.length) return;
    const option = categories.flatMap(c => c.options).find(o => o.id === activeOptionId);
    if (!option) return;
    let assignments = [...(option.material_assignments ?? [])];
    const nodeList  = new Set(option.node_list ?? []);
    for (const meshName of selectedMeshes) {
      assignments = assignments.filter((a: { mesh_name: string }) => a.mesh_name !== meshName);
      assignments.push({ mesh_name: meshName, material_id: paintMatId });
      nodeList.add(meshName);
    }
    const { error } = await (supabase.from("options") as any)
      .update({ material_assignments: assignments, node_list: [...nodeList], option_type: "material_override" })
      .eq("id", activeOptionId);
    if (error) showToast(`Error: ${error.message}`);
    else { showToast(`Material applied to ${selectedMeshes.length} mesh(es)`); await reloadCategories(); }
  }

  async function handleMatCreateBlank() {
    const r = await fetch("/api/admin/materials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "New Material",
        category: "Other",
        base_color: "#cccccc",
        roughness: 0.8,
        metalness: 0.0,
        properties: {},
      }),
    });
    if (r.ok) {
      const created = await r.json() as MaterialLibraryEntry;
      setMaterials(prev => [...prev, created]);
      setEditingMatId(created.id);
      setEditPreview(null);
      showToast("New material created");
    } else {
      showToast("Create failed");
    }
  }

  async function handleMatSave(updated: MaterialLibraryEntry) {
    pushUndo();
    const r = await fetch(`/api/admin/materials/${updated.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: updated.name,
        category: updated.category,
        base_color: updated.base_color,
        roughness: updated.roughness,
        metalness: updated.metalness,
        normal_map_url: updated.normal_map_url ?? null,
        thumbnail_url: updated.thumbnail_url ?? null,
        properties: updated.properties ?? {},
      }),
    });
    if (r.ok) {
      const saved = await r.json() as MaterialLibraryEntry;
      setMaterials(prev => prev.map(m => m.id === saved.id ? saved : m));
      setEditPreview(null);
      showToast("Material saved ✓");
    } else {
      showToast("Save failed");
    }
  }

  function handleGlbMatSave(updated: MaterialLibraryEntry) {
    if (!editingGlbMatName) return;
    setGlbMatOverrides(prev => ({ ...prev, [editingGlbMatName]: {
      base_color: updated.base_color, roughness: updated.roughness, metalness: updated.metalness, properties: updated.properties,
    }}));
    showToast("GLB material updated ✓");
  }

  function handleGlbMatPreview(preview: MaterialLibraryEntry) {
    if (!editingGlbMatName) return;
    setGlbMatOverrides(prev => ({ ...prev, [editingGlbMatName]: {
      base_color: preview.base_color, roughness: preview.roughness, metalness: preview.metalness, properties: preview.properties,
    }}));
  }

  async function handleMatDuplicate(mat: MaterialLibraryEntry) {
    console.log("[DUP] source mat:", mat.name, "| properties:", JSON.stringify(mat.properties));
    const r = await fetch("/api/admin/materials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${mat.name} (copy)`,
        category: mat.category,
        base_color: mat.base_color,
        roughness: mat.roughness,
        metalness: mat.metalness,
        normal_map_url: mat.normal_map_url ?? null,
        thumbnail_url: mat.thumbnail_url ?? null,
        // Merge DEFAULT_MATERIAL_PROPS so the duplicate always has a fully-populated
        // properties object even if the source was promoted from GLB without ever
        // being opened in the editor (where DEFAULT_PROPS are normally seeded).
        properties: { ...DEFAULT_MATERIAL_PROPS, ...(mat.properties ?? {}) },
      }),
    });
    if (r.ok) {
      const created = await r.json() as MaterialLibraryEntry;
      setMaterials(prev => [...prev, created]);
      setEditingMatId(created.id);
      setEditPreview(null);
      showToast(`Duplicated as "${created.name}"`);
    } else {
      showToast("Duplicate failed");
    }
  }

  async function handleMatDelete(id: string) {
    const r = await fetch(`/api/admin/materials/${id}`, { method: "DELETE" });
    if (r.ok) {
      setMaterials(prev => prev.filter(m => m.id !== id));
      setEditingMatId(null);
      setEditPreview(null);
      showToast("Material deleted");
    } else {
      showToast("Delete failed");
    }
  }

  async function handlePromoteGlb(mat: GlbMaterialInfo) {
    const r = await fetch("/api/admin/materials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: mat.name, category: "Other",
        base_color: mat.color, roughness: mat.roughness, metalness: mat.metalness,
        properties: { ...DEFAULT_MATERIAL_PROPS },
      }),
    });
    if (r.ok) {
      const created = await r.json() as MaterialLibraryEntry;
      setMaterials(prev => [...prev, created]);
      setEditingMatId(created.id);
      setEditPreview(null);
      showToast(`"${mat.name}" added — edit to customise`);
    }
  }

  // ── Category camera capture ────────────────────────────────────────────────
  async function handleCaptureCategoryCamera(catId: string) {
    const coords = viewportRef.current?.getCameraCoords();
    if (!coords) { showToast("Camera not ready"); return; }
    const ok = await saveCategoryCamera(catId, coords);
    if (ok) {
      setCategories(prev => prev.map(c => c.id === catId ? { ...c, camera_override: coords } : c));
      showToast("Category camera saved");
    } else {
      showToast("Failed to save category camera");
    }
  }

  async function handleClearCategoryCamera(catId: string) {
    const ok = await saveCategoryCamera(catId, null as any);
    if (ok) {
      setCategories(prev => prev.map(c => c.id === catId ? { ...c, camera_override: null } : c));
      showToast("Camera cleared");
    }
  }

  // ── Default option ─────────────────────────────────────────────────────────
  async function handleUpdateShowWhen(catId: string, showWhen: string[]) {
    const ok = await updateCategory(catId, { show_when: showWhen });
    if (ok) setCategories(prev => prev.map(c => c.id === catId ? { ...c, show_when: showWhen } : c));
    else showToast("Failed to update visibility rule");
  }

  async function handleSetDefaultOption(catId: string, optName: string) {
    const cat = categories.find(c => c.id === catId);
    const isAlreadyDefault = cat?.default_option === optName;
    const newDefault = isAlreadyDefault ? null : optName;
    const ok = await apiSetDefaultOption(catId, newDefault ?? "");
    if (ok) {
      setCategories(prev => prev.map(c => c.id === catId ? { ...c, default_option: newDefault } : c));
      showToast(isAlreadyDefault ? "Default cleared" : `Default set to "${optName}"`);
    }
  }

  // ── Reset mesh transforms ──────────────────────────────────────────────────
  function buildMerged(overrides: Partial<{ _meshOverrides: MeshOverrides }> = {}) {
    return {
      ...cameraDefaults,
      _phaseSettings: phaseSettings,
      _meshOverrides: overrides._meshOverrides ?? meshOverrides,
      _meshBaseMats: meshBaseMatMap,
      _glbMatOverrides: glbMatOverrides,
      _deletedMeshes: [...deletedMeshes],
      _placedProps: placedProps,
      _placedShapes: placedShapes,
      _placedLights: placedLights,
      _addons: addons,
      _cameraBookmarks: cameraBookmarks,
      _annotations: annotations,
    };
  }

  async function handleResetTransforms() {
    if (!project) return;
    setMeshOverrides({});
    const merged = buildMerged({ _meshOverrides: {} });
    await (supabase.from("projects") as any).update({ camera_defaults: merged }).eq("id", projectId);
    setCameraDefaults(merged);
    showToast("Mesh transforms reset ✓");
  }

  // ── Save ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!project) return;
    setSaving(true);
    const merged = buildMerged();
    const { error } = await (supabase.from("projects") as any)
      .update({ camera_defaults: merged, env_preset: activeSettings.envLightPreset })
      .eq("id", projectId);
    if (error) showToast(`Save failed: ${error.message}`);
    else { showToast("Saved ✓"); setCameraDefaults(merged); }
    setSaving(false);
  }

  // ── GLB Upload ─────────────────────────────────────────────────────────────
  // Files ≤ 100 MB: single POST via XHR (with progress).
  // Files > 100 MB: S3 multipart — presigned part URLs uploaded directly to R2.
  const MULTIPART_THRESHOLD = 100 * 1024 * 1024; // 100 MB
  const PART_SIZE           =  50 * 1024 * 1024; // 50 MB per part

  async function handleUploadMultipart(file: File) {
    setUploading(true); setUploadErr(""); setUploadPct(0);
    try {
      // 1. Initiate
      const initRes = await fetch("/api/models/multipart/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!initRes.ok) { const d = await initRes.json(); throw new Error(d.error ?? "Initiate failed"); }
      const { uploadId, key } = (await initRes.json()) as { uploadId: string; key: string };

      // 2. Upload parts
      const totalParts = Math.ceil(file.size / PART_SIZE);
      const completedParts: { PartNumber: number; ETag: string }[] = [];

      for (let i = 0; i < totalParts; i++) {
        const partNumber = i + 1;
        const start  = i * PART_SIZE;
        const end    = Math.min(start + PART_SIZE, file.size);
        const chunk  = file.slice(start, end);

        // Get presigned URL for this part
        const presignRes = await fetch("/api/models/multipart/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, uploadId, partNumber }),
        });
        if (!presignRes.ok) { const d = await presignRes.json(); throw new Error(d.error ?? "Presign failed"); }
        const { url } = (await presignRes.json()) as { url: string };

        // Upload chunk directly to R2
        const partRes = await fetch(url, {
          method: "PUT",
          body: chunk,
          headers: { "Content-Type": "model/gltf-binary" },
        });
        if (!partRes.ok) throw new Error(`Part ${partNumber} upload failed (${partRes.status})`);

        const etag = partRes.headers.get("ETag");
        if (!etag) throw new Error(`No ETag returned for part ${partNumber}`);
        completedParts.push({ PartNumber: partNumber, ETag: etag });
        setUploadPct(Math.round((partNumber / totalParts) * 100));
      }

      // 3. Complete
      const completeRes = await fetch("/api/models/multipart/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, key, uploadId, parts: completedParts }),
      });
      if (!completeRes.ok) { const d = await completeRes.json(); throw new Error(d.error ?? "Complete failed"); }
      const data = await completeRes.json();
      setProject(prev => prev
        ? { ...prev, model_url: data.model_url, model_storage_path: data.model_storage_path }
        : prev);
      setModelLoadErr(null);
      showToast("GLB uploaded ✓");
      if (autoCompress) await handleCompress();
    } catch (err: any) {
      setUploadErr(err.message ?? "Upload failed");
    } finally {
      setUploading(false); setUploadPct(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MULTIPART_THRESHOLD) {
      handleUploadMultipart(file);
      return;
    }

    setUploading(true); setUploadErr(""); setUploadPct(0);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("projectId", projectId);
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", ev => {
      if (ev.lengthComputable) setUploadPct(Math.round((ev.loaded / ev.total) * 100));
    });
    xhr.addEventListener("load", () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          setProject(prev => prev
            ? { ...prev, model_url: data.model_url, model_storage_path: data.model_storage_path }
            : prev);
          setModelLoadErr(null);
          showToast("GLB uploaded ✓");
          if (autoCompress) {
            // Can't await inside XHR callback — trigger compress via timeout
            setTimeout(() => handleCompress(), 100);
          }
        } else setUploadErr(data.error ?? "Upload failed");
      } catch { setUploadErr("Upload failed"); }
      setUploading(false); setUploadPct(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
    xhr.addEventListener("error", () => { setUploadErr("Network error"); setUploading(false); });
    xhr.open("POST", "/api/models/upload");
    xhr.send(fd);
  }

  async function handleCompress() {
    if (!project?.id || compressing) return;
    setCompressing(true);
    setCompressErr("");
    setCompressResult(null);
    try {
      const res = await fetch("/api/admin/compress-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id }),
      });
      const data = await res.json() as { ok?: boolean; error?: string; model_url?: string; originalFormatted?: string; compressedFormatted?: string; reductionPct?: number };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Compression failed");
      setProject(prev => prev ? { ...prev, model_url: data.model_url! } : prev);
      setCompressResult({ originalFormatted: data.originalFormatted!, compressedFormatted: data.compressedFormatted!, reductionPct: data.reductionPct! });
      showToast(`Compressed ✓ ${data.reductionPct}% smaller`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setCompressErr(msg);
      setCompressErrModal(msg);
    } finally {
      setCompressing(false);
    }
  }

  // ── Addon handlers ─────────────────────────────────────────────────────────
  function handleAddonUpload(file: File) {
    const addonId = Math.random().toString(36).slice(2);
    setAddonUploading(true); setAddonUploadErr(""); setAddonUploadPct(0);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("addonId", addonId);
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", ev => {
      if (ev.lengthComputable) setAddonUploadPct(Math.round((ev.loaded / ev.total) * 100));
    });
    xhr.addEventListener("load", () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          const newAddon: ProjectAddon = {
            id: addonId,
            name: file.name.replace(/\.glb$/i, ""),
            modelUrl: data.modelUrl,
            storagePath: data.storagePath,
            transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
            visible: true,
          };
          setAddons(prev => [...prev, newAddon]);
          setSelectedAddonId(addonId);
          showToast(`Addon "${newAddon.name}" imported ✓`);
        } else { setAddonUploadErr(data.error ?? "Upload failed"); }
      } catch { setAddonUploadErr("Upload failed"); }
      setAddonUploading(false); setAddonUploadPct(0);
      if (addonFileRef.current) addonFileRef.current.value = "";
    });
    xhr.addEventListener("error", () => { setAddonUploadErr("Network error"); setAddonUploading(false); });
    xhr.open("POST", `/api/admin/projects/${projectId}/addons/upload`);
    xhr.send(fd);
  }

  function handleAddonTransformed(id: string, pos: [number,number,number], rot: [number,number,number], sc: [number,number,number]) {
    setAddons(prev => prev.map(a => a.id === id ? { ...a, transform: { position: pos, rotation: rot, scale: sc } } : a));
  }

  function handleAddonDelete(id: string) {
    const addon = addons.find(a => a.id === id);
    setAddons(prev => prev.filter(a => a.id !== id));
    if (selectedAddonId === id) {
      setSelectedAddonId(null);
      if (addon) setSelectedMeshes(prev => prev.filter(n => n !== addon.name));
    }
    setAddonMeshNames(prev => { const n = { ...prev }; delete n[id]; return n; });
  }

  function handleAddonToggleVisible(id: string) {
    setAddons(prev => prev.map(a => a.id === id ? { ...a, visible: !a.visible } : a));
  }

  function handleAddonRename(id: string, name: string) {
    setAddons(prev => prev.map(a => a.id === id ? { ...a, name } : a));
  }

  async function handleBakeAddons() {
    if (!project || addons.length === 0 || baking) return;
    if (!window.confirm(`Bake ${addons.length} addon(s) into the base model? This replaces the base model permanently and clears all addons.`)) return;
    setBaking(true);
    try {
      const res = await fetch(`/api/admin/projects/${projectId}/addons/bake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addons: addons.map(a => ({ modelUrl: a.modelUrl, name: a.name, transform: a.transform })) }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Bake failed");
      setProject(prev => prev ? { ...prev, model_url: data.modelUrl, model_storage_path: data.storagePath } : prev);
      setAddons([]);
      setAddonMeshNames({});
      showToast("Addons baked into base model ✓");
    } catch (err: unknown) {
      showToast(`Bake failed: ${(err as Error).message}`);
    } finally {
      setBaking(false);
    }
  }

  // ── Camera bookmark handlers ────────────────────────────────────────────────
  function handleCaptureBookmark() {
    const coords = viewportRef.current?.getCameraCoords();
    if (!coords) { showToast("No camera coords available"); return; }
    const name = bookmarkName.trim() || `View ${cameraBookmarks.length + 1}`;
    const bookmark: CameraBookmark = {
      id: Math.random().toString(36).slice(2),
      name,
      pos: coords.pos as [number, number, number],
      target: coords.target as [number, number, number],
      fov: coords.fov ?? 60,
    };
    setCameraBookmarks(prev => [...prev, bookmark]);
    setBookmarkName("");
    showToast(`Bookmark "${name}" saved`);
  }

  function handleDeleteBookmark(id: string) {
    setCameraBookmarks(prev => prev.filter(b => b.id !== id));
  }

  function handleFlyToBookmark(b: CameraBookmark) {
    viewportRef.current?.flyTo({ pos: b.pos, target: b.target, fov: b.fov });
  }

  // ── Annotation handlers ─────────────────────────────────────────────────────
  function handleAnnotationPlaced(pos: [number,number,number]) {
    const pin: AnnotationPin = {
      id: Math.random().toString(36).slice(2),
      position: pos,
      text: "New note",
      color: "#f472b6",
    };
    setAnnotations(prev => [...prev, pin]);
    setPlacingAnnotation(false);
    setEditingAnnotId(pin.id);
  }

  function handleAnnotationUpdate(id: string, text: string) {
    setAnnotations(prev => prev.map(a => a.id === id ? { ...a, text } : a));
  }

  function handleAnnotationDelete(id: string) {
    setAnnotations(prev => prev.filter(a => a.id !== id));
    if (editingAnnotId === id) setEditingAnnotId(null);
  }

  // ── Smart model swap ────────────────────────────────────────────────────────
  function checkMappingHealthAfterUpload(newMeshNames: Set<string>) {
    const allMapped = new Set<string>();
    for (const cat of categories)
      for (const opt of cat.options)
        for (const n of (opt.node_list ?? [])) allMapped.add(n);
    if (allMapped.size === 0) return;
    const missing = [...allMapped].filter(n => !newMeshNames.has(n));
    const found   = [...allMapped].filter(n => newMeshNames.has(n));
    if (missing.length > 0) setSwapDiff({ missing, found });
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const assignedMeshes = useMemo(() => {
    const s = new Set<string>();
    for (const cat of categories)
      for (const opt of cat.options)
        for (const n of (opt.node_list ?? [])) s.add(n);
    return s;
  }, [categories]);

  // All named objects that actually exist in the loaded GLB (meshes AND groups).
  // Groups are needed for visibility-type options that show/hide entire sections.
  const glbMeshNames = useMemo(() => {
    const s = new Set<string>();
    function walk(nodes: import("@/lib/three/variant-engine").SceneTreeNode[]) {
      for (const n of nodes) {
        if (n.name) s.add(n.name); // meshes + groups + any named object
        if (n.children?.length) walk(n.children);
      }
    }
    walk(sceneTree);
    return s;
  }, [sceneTree]);

  // Effective materials list — patched with live editor preview for real-time viewport feedback
  const effectiveMaterials = useMemo(
    () => editPreview ? materials.map(m => m.id === editPreview.id ? editPreview : m) : materials,
    [materials, editPreview]
  );

  // Resolve a material_id string to a MeshMaterialDef (handles glb: prefix and library IDs)
  const resolveMaterialId = useCallback((material_id: string): MeshMaterialDef | null => {
    if (material_id.startsWith("glb:")) {
      const name = material_id.slice(4);
      const glbMat = glbMaterials.find(m => m.name === name);
      if (!glbMat) return null;
      const ov = glbMatOverrides[name];
      return {
        color:       ov?.base_color  ?? glbMat.color,
        roughness:   ov?.roughness   ?? glbMat.roughness,
        metalness:   ov?.metalness   ?? glbMat.metalness,
        properties:  ov?.properties,
        glbMatName:  name,  // tells viewport to use original material with embedded textures
      };
    }
    const mat = effectiveMaterials.find(m => m.id === material_id);
    return mat ? { color: mat.base_color, roughness: mat.roughness, metalness: mat.metalness, properties: mat.properties } : null;
  }, [glbMaterials, glbMatOverrides, effectiveMaterials]);

  // Show material assignments for ALL options so materials are always visible in the viewport,
  // not just when a specific option is active. Priority: editing > active option > others.
  const meshMaterialMap = useMemo<Record<string, MeshMaterialDef> | undefined>(() => {
    const map: Record<string, MeshMaterialDef> = {};

    // Pass 1 (lowest) — GLB in-session edits for any mesh that was explicitly adjusted
    for (const [glbName, ov] of Object.entries(glbMatOverrides)) {
      const glbMat = glbMaterials.find(m => m.name === glbName);
      if (!glbMat) continue;
      for (const meshName of glbMat.usedByMeshes) {
        map[meshName] = {
          color:      ov.base_color ?? glbMat.color,
          roughness:  ov.roughness  ?? glbMat.roughness,
          metalness:  ov.metalness  ?? glbMat.metalness,
          properties: ov.properties,
        };
      }
    }

    // Pass 2 — base library materials assigned without an option (override GLB edits)
    for (const [meshName, matId] of Object.entries(meshBaseMatMap)) {
      const resolved = resolveMaterialId(matId);
      if (resolved) map[meshName] = resolved;
    }

    // Pass 3 — default option per category (shows the configurator's default state).
    // Skip any category whose option is currently active — Pass 4 handles that
    // category exclusively, so if the active option has no material assignment
    // the mesh correctly falls through to its GLB original rather than showing
    // the default option's material on top.
    console.log("[MAT] meshMaterialMap recalc | activeOption:", activeOption?.friendly_name ?? "none", activeOption?.id ?? "");
    for (const cat of categories) {
      const skipping = !!(activeOption && cat.options.some(o => o.id === activeOption.id));
      if (skipping) { console.log("[MAT] Pass3 SKIP cat:", cat.name); continue; }
      const defaultOpt = cat.default_option
        ? cat.options.find(o => o.friendly_name === cat.default_option)
        : null;
      if (!defaultOpt) continue;
      for (const { mesh_name, material_id } of defaultOpt.material_assignments ?? []) {
        const resolved = resolveMaterialId(material_id as string);
        if (resolved) map[mesh_name] = resolved;
      }
    }

    // Pass 4 — active option owns its category (highest priority before live edit)
    for (const { mesh_name, material_id } of activeOption?.material_assignments ?? []) {
      const resolved = resolveMaterialId(material_id as string);
      if (resolved) map[mesh_name] = resolved;
    }

    // Pass 5 — live preview for material being edited in the editor
    if (editingMatId) {
      for (const cat of categories) {
        for (const opt of cat.options) {
          for (const { mesh_name, material_id } of opt.material_assignments ?? []) {
            if (material_id === editingMatId) {
              const resolved = resolveMaterialId(material_id as string);
              if (resolved) map[mesh_name] = resolved;
            }
          }
        }
      }
    }

    console.log("[MAT] final map:", Object.entries(map).map(([k,v]) => `${k}→${v.color}`).join(", ") || "(empty)");
    return Object.keys(map).length > 0 ? map : undefined;
  }, [categories, activeOption, editingMatId, resolveMaterialId, glbMatOverrides, glbMaterials, meshBaseMatMap]);

  // Material assigned to the single selected mesh (for bottom bar display)
  const selectedMeshMaterialId = useMemo(() => {
    if (selectedMeshes.length !== 1) return null;
    const meshName = selectedMeshes[0];
    // Active option assignment (highest priority)
    for (const { mesh_name, material_id } of activeOption?.material_assignments ?? []) {
      if (mesh_name === meshName) return material_id as string;
    }
    // Any option assignment
    for (const cat of categories) {
      for (const opt of cat.options) {
        for (const { mesh_name, material_id } of opt.material_assignments ?? []) {
          if (mesh_name === meshName) return material_id as string;
        }
      }
    }
    // Base material assignment
    if (meshBaseMatMap[meshName]) return meshBaseMatMap[meshName];
    return null;
  }, [selectedMeshes, activeOption, categories, meshBaseMatMap]);

  const selectedMeshMat = useMemo(
    () => (selectedMeshMaterialId && !selectedMeshMaterialId.startsWith("glb:"))
      ? effectiveMaterials.find(m => m.id === selectedMeshMaterialId) ?? null
      : null,
    [selectedMeshMaterialId, effectiveMaterials],
  );

  const selectedMeshGlbMat = useMemo(() => {
    if (selectedMeshMaterialId?.startsWith("glb:")) {
      const name = selectedMeshMaterialId.slice(4);
      return glbMaterials.find(m => m.name === name) ?? null;
    }
    // Fallback for meshes with no ProPlan assignment: find by usedByMeshes
    if (selectedMeshes.length === 1 && !selectedMeshMaterialId) {
      return glbMaterials.find(m => m.usedByMeshes.includes(selectedMeshes[0])) ?? null;
    }
    return null;
  }, [selectedMeshMaterialId, selectedMeshes, glbMaterials]);

  // Meshes to highlight teal in the viewport when paint mode is active
  const paintHighlightMeshes = useMemo(
    () => (paintMatId && activeOption?.node_list?.length) ? activeOption.node_list : undefined,
    [paintMatId, activeOption]
  );

  const primaryMesh  = selectedMeshes.at(-1) ?? null;
  const previewUrl   = project?.slug && project?.company_slug
    ? `/project/${project.company_slug}/${project.slug}` : null;

  if (!project) {
    return (
      <div className="h-full bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </div>
    );
  }

  const TRANSFORM_BUTTONS = [
    { mode: "none"      as const, icon: "⊹", label: "Select",    key: null   },
    { mode: "translate" as const, icon: "↔", label: "Move",      key: "W"    },
    { mode: "rotate"    as const, icon: "↻", label: "Rotate",    key: "D"    },
    { mode: "scale"     as const, icon: "⊡", label: "Scale",     key: "R"    },
  ];

  return (
    <div className="h-full bg-[#0a0a0a] text-white flex flex-col overflow-hidden">
      <Toast msg={toast} />

      {/* Smart Model Swap diff modal */}
      {swapDiff && swapDiff.missing.length > 0 && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setSwapDiff(null)}>
          <div className="bg-[#1a1a1a] border border-amber-500/30 rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-amber-500/15 border border-amber-500/25 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white mb-1">Model swap — mapping review</p>
                <p className="text-xs text-white/50">New model loaded. {swapDiff.found.length} mapped mesh{swapDiff.found.length !== 1 ? "es" : ""} found, {swapDiff.missing.length} missing from new GLB.</p>
              </div>
            </div>
            {swapDiff.missing.length > 0 && (
              <div className="mb-4">
                <p className="text-[9px] uppercase tracking-wider text-amber-400/70 font-semibold mb-1.5">Missing ({swapDiff.missing.length})</p>
                <div className="max-h-32 overflow-y-auto flex flex-col gap-0.5" style={{ scrollbarWidth: "none" }}>
                  {swapDiff.missing.slice(0, 20).map(n => (
                    <div key={n} className="flex items-center gap-2 px-2 py-1 bg-amber-500/8 rounded-md">
                      <span className="text-[9px] font-mono text-amber-400/70 flex-1 truncate">{n}</span>
                      <button
                        onClick={async () => {
                          const opt = categories.flatMap(c => c.options).find(o => o.node_list?.includes(n));
                          if (opt) await handleRemoveMesh(opt.id, n);
                          setSwapDiff(prev => prev ? { ...prev, missing: prev.missing.filter(x => x !== n) } : null);
                        }}
                        className="text-[8px] text-amber-500/60 hover:text-red-400 transition-colors">remove</button>
                    </div>
                  ))}
                  {swapDiff.missing.length > 20 && <p className="text-[8px] text-white/20 px-2">+{swapDiff.missing.length - 20} more — use Health tab</p>}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setLeftTab("health")} className="flex-1 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 text-amber-300 text-xs font-medium rounded-lg transition-colors">
                Open Health tab
              </button>
              <button onClick={() => setSwapDiff(null)} className="flex-1 py-2 bg-white/8 hover:bg-white/14 border border-white/12 text-white/70 text-xs font-medium rounded-lg transition-colors">
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compress error modal */}
      {compressErrModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setCompressErrModal("")}>
          <div className="bg-[#1a1a1a] border border-red-500/30 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-red-500/15 border border-red-500/25 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white mb-1">Compression failed</p>
                <p className="text-xs text-white/50 leading-relaxed break-words">{compressErrModal}</p>
              </div>
            </div>
            <button
              onClick={() => setCompressErrModal("")}
              className="w-full py-2 bg-white/8 hover:bg-white/14 border border-white/12 text-white/70 text-xs font-medium rounded-lg transition-colors">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/8 flex-shrink-0 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={() => router.back()}
            className="text-white/35 hover:text-white/70 text-xs transition-colors flex-shrink-0">
            ← {project.name}
          </button>
          <span className="text-white/15">/</span>
          <span className="text-white/60 text-xs font-medium">Scene Editor</span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Undo / Redo */}
          <button onClick={undo} disabled={!undoLen}
            title="Undo (Ctrl+Z)"
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white disabled:opacity-20 transition-colors text-sm">
            ↩
          </button>
          <button onClick={redo} disabled={!redoLen}
            title="Redo (Ctrl+Y)"
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white disabled:opacity-20 transition-colors text-sm">
            ↪
          </button>

          <div className="w-px h-5 bg-white/10 mx-0.5" />

          {project.model_url
            ? <span className="text-green-400/80 text-[10px] bg-green-400/8 border border-green-400/15 px-2 py-0.5 rounded-full">GLB loaded</span>
            : <span className="text-white/25 text-[10px] bg-white/4 border border-white/8 px-2 py-0.5 rounded-full">No model</span>
          }

          <input ref={fileInputRef} type="file" accept=".glb" onChange={handleUpload} className="hidden" />
          <input ref={addonFileRef} type="file" accept=".glb" onChange={e => { const f = e.target.files?.[0]; if (f) handleAddonUpload(f); }} className="hidden" />
          {uploading ? (
            <div className="flex items-center gap-1.5">
              <div className="w-24 h-1 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${uploadPct}%` }} />
              </div>
              <span className="text-white/40 text-[10px] w-8 tabular-nums">{uploadPct}%</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1.5 bg-white/7 hover:bg-white/12 border border-white/8 text-white/60 text-xs rounded-lg transition-colors">
                {project.model_url ? "Replace GLB" : "Upload GLB"}
              </button>
              {addonUploading ? (
                <div className="flex items-center gap-1.5">
                  <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${addonUploadPct}%` }} />
                  </div>
                  <span className="text-white/40 text-[10px] tabular-nums">{addonUploadPct}%</span>
                </div>
              ) : (
                <button
                  onClick={() => addonFileRef.current?.click()}
                  title="Import an additional GLB as an addon (porch extension, garage, etc.)"
                  className="px-2.5 py-1.5 bg-white/7 hover:bg-white/12 border border-white/8 text-white/60 text-xs rounded-lg transition-colors">
                  + Addon
                </button>
              )}
              {/* Auto-compress toggle */}
              <label className="flex items-center gap-1 cursor-pointer select-none" title="Automatically compress textures + geometry after upload">
                <span
                  className={`w-6 h-3.5 rounded-full border transition-colors relative flex-shrink-0 ${autoCompress ? "bg-green-600/60 border-green-500/40" : "bg-white/8 border-white/15"}`}
                  onClick={() => setAutoCompress(v => !v)}
                >
                  <span className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all ${autoCompress ? "left-[11px]" : "left-0.5"}`} />
                </span>
                <span className="text-[10px] text-white/35">Auto compress</span>
              </label>
            </div>
          )}
          {uploadErr && <span className="text-red-400 text-[10px] truncate max-w-[120px]">{uploadErr}</span>}

          {/* Compress Textures button — always visible when model exists */}
          {project.model_url && !uploading && (
            compressing ? (
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 border border-green-400/40 border-t-green-400 rounded-full animate-spin flex-shrink-0" />
                <span className="text-[10px] text-green-400/70">Compressing…</span>
              </div>
            ) : (
              <button
                onClick={handleCompress}
                title="Download model, compress textures to JPEG 2048px + Draco geometry, re-upload"
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-green-500/10 hover:bg-green-500/18 border border-green-500/20 text-green-400/80 text-xs rounded-lg transition-colors">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 22V12h6v10"/>
                </svg>
                Compress
              </button>
            )
          )}
          {compressResult && !compressing && (
            <span className="text-[10px] text-green-400/60 whitespace-nowrap">
              {compressResult.originalFormatted} → {compressResult.compressedFormatted} ({compressResult.reductionPct}% ↓)
            </span>
          )}
          {compressErr && <span className="text-red-400 text-[10px] truncate max-w-[140px]" title={compressErr}>Compress failed</span>}

          <button onClick={handleResetTransforms} title="Clear all saved mesh position/rotation/scale overrides"
            className="px-3 py-1.5 bg-white/5 hover:bg-red-500/20 border border-white/8 hover:border-red-500/30 text-white/40 hover:text-red-400 text-xs font-semibold rounded-lg transition-colors">
            Reset transforms
          </button>

          <button onClick={handleSave} disabled={saving}
            className="px-3 py-1.5 bg-white/8 hover:bg-white/14 border border-white/12 text-white/75 text-xs font-semibold rounded-lg transition-colors disabled:opacity-40">
            {saving ? "Saving…" : "Save"}
          </button>

          {previewUrl && (
            <a href={previewUrl} target="_blank" rel="noopener noreferrer"
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors">
              Preview ↗
            </a>
          )}
        </div>
      </div>

      {/* ── 3-Column Body ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── LEFT PANEL ── */}
        <div className="w-[252px] flex flex-col border-r border-white/8 flex-shrink-0 overflow-hidden">

          {/* Tab bar */}
          <div className="flex flex-shrink-0 border-b border-white/8">
            {(["options", "thumb", "layers", "health"] as const).map(tab => {
              const label = tab === "layers" ? "Layers" : tab === "health" ? "Health" : tab === "thumb" ? "Thumb" : "Options";
              const hasBrokenMappings = tab === "health" && swapDiff && swapDiff.missing.length > 0;
              return (
                <button key={tab} onClick={() => setLeftTab(tab)}
                  className={`flex-1 py-2 text-[10px] font-medium capitalize transition-colors relative ${
                    leftTab === tab
                      ? "text-white border-b border-blue-500 bg-blue-500/5"
                      : "text-white/30 hover:text-white/60 hover:bg-white/4"
                  }`}>
                  {label}
                  {hasBrokenMappings && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-400" />}
                </button>
              );
            })}
          </div>

          {/* Layers tab — structural visibility + addons */}
          {leftTab === "layers" && (
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col overflow-y-auto" style={{ scrollbarWidth: "none" }}>
              <StructuralVisibilityPanel
                settings={activeSettings}
                onSettings={handleGlobalSettings}
                selectedMeshes={selectedMeshes}
                onToast={showToast}
              />
              {/* Addons section */}
              <div className="border-t border-white/8 flex-shrink-0">
                <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
                  <span className="text-[9px] uppercase tracking-widest text-white/25 font-bold">Addon GLBs</span>
                  <div className="flex items-center gap-1">
                    {addons.length > 0 && (
                      <button
                        onClick={handleBakeAddons}
                        disabled={baking}
                        title="Bake all addons into the base model (permanent merge)"
                        className="text-[9px] text-amber-400/60 hover:text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/20 hover:border-amber-500/40 transition-colors disabled:opacity-40">
                        {baking ? "Baking…" : "⊕ Bake"}
                      </button>
                    )}
                  </div>
                </div>
                {addonUploadErr && <p className="text-[9px] text-red-400 px-3 py-1">{addonUploadErr}</p>}
                {addons.length === 0 ? (
                  <p className="text-[9px] text-white/20 px-3 py-3 text-center">No addons yet — import a GLB to extend the scene</p>
                ) : (
                  <div className="flex flex-col gap-px px-1.5 py-1.5">
                    {addons.map(addon => (
                      <div key={addon.id}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer group transition-colors ${
                          selectedAddonId === addon.id ? "bg-blue-600/15 border border-blue-500/25" : "hover:bg-white/5 border border-transparent"
                        }`}
                        onClick={() => {
                          const selecting = selectedAddonId !== addon.id;
                          setSelectedAddonId(selecting ? addon.id : null);
                          if (selecting) { setSelectedMeshes([addon.name]); setSelectedPropId(null); }
                          else { setSelectedMeshes([]); }
                        }}>
                        <button
                          onClick={e => { e.stopPropagation(); handleAddonToggleVisible(addon.id); }}
                          className={`flex-shrink-0 transition-colors ${addon.visible ? "text-white/50 hover:text-white" : "text-white/15 hover:text-white/40"}`}>
                          <EyeIcon hidden={!addon.visible} />
                        </button>
                        <span className={`flex-1 text-[10px] truncate ${selectedAddonId === addon.id ? "text-blue-300" : "text-white/60"}`}>
                          {addon.name}
                        </span>
                        <button onClick={e => { e.stopPropagation(); handleAddonDelete(addon.id); }}
                          className="opacity-0 group-hover:opacity-100 text-red-400/60 hover:text-red-300 text-[10px] transition-opacity">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Health tab — mesh mapping health check */}
          {leftTab === "health" && (
            <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2" style={{ scrollbarWidth: "none" }}>
              <MeshHealthPanel
                categories={categories}
                glbMeshNames={glbMeshNames}
                addonMeshNames={addonMeshNames}
                swapDiff={swapDiff}
                onClearDiff={() => setSwapDiff(null)}
                triangleCounts={triangleCounts}
                onRemoveMesh={handleRemoveMesh}
                onSelectMesh={name => handleMeshSelect([name])}
              />
            </div>
          )}

          {/* Thumb tab */}
          {leftTab === "thumb" && (
            <ThumbnailGenPanel
              categories={categories}
              onOptionThumbnailUpdated={(optId, url) =>
                setCategories(prev => prev.map(c => ({
                  ...c,
                  options: c.options.map(o =>
                    o.id === optId ? { ...o, thumbnail_url: url } : o,
                  ),
                })))
              }
            />
          )}

          {/* Options tab */}
          {leftTab === "options" && <>

          {/* Top-left: Options tree */}
          <div className="flex flex-col min-h-0 overflow-hidden" style={{ flex: "1 1 0" }}>
            <PanelHeader>Options</PanelHeader>
            <div className="flex-1 overflow-y-auto px-1.5 py-1" style={{ scrollbarWidth: "none" }}>
              {categories.length > 0 ? (
                <OptionsTree
                  categories={categories}
                  activeOptionId={activeOptionId}
                  glbMeshNames={glbMeshNames}
                  onActivate={(id) => {
                    setActiveOptionId(id);
                    setSelectedMeshes([]);
                    if (!id) { setPaintMatId(null); return; }
                    // Keep material editor in sync when switching options
                    if ((editingMatId || editingGlbMatName) && selectedMeshes.length === 1) {
                      const meshName = selectedMeshes[0];
                      const newOpt = categories.flatMap(c => c.options).find(o => o.id === id);
                      const assign = newOpt?.material_assignments?.find(a => a.mesh_name === meshName);
                      if (assign) {
                        if (assign.material_id.startsWith("glb:")) {
                          setEditingGlbMatName(assign.material_id.slice(4));
                          setEditingMatId(null);
                        } else {
                          setEditingMatId(assign.material_id);
                          setEditingGlbMatName(null);
                        }
                        setEditPreview(null);
                      }
                    }
                  }}
                  onCaptureCamera={handleCaptureCategoryCamera}
                  onClearCamera={handleClearCategoryCamera}
                  onSetDefault={handleSetDefaultOption}
                  onUpdateShowWhen={handleUpdateShowWhen}
                  onCategoryClick={(cat) => {
                    if (cat.camera_override) viewportRef.current?.flyTo(cat.camera_override);
                  }}
                  projectId={project.id}
                  onCategoryAdded={(cat) => setCategories(prev => [...prev, cat])}
                  onCategoryUpdated={(catId, name, phase) => setCategories(prev => prev.map(c => c.id === catId ? { ...c, name, phase } : c))}
                  onCategoryDeleted={(catId) => setCategories(prev => prev.filter(c => c.id !== catId))}
                  onOptionAdded={(catId, opt) => setCategories(prev => prev.map(c => c.id === catId ? { ...c, options: [...c.options, opt] } : c))}
                  onOptionUpdated={(optId, name, price, thumbnailUrl) => setCategories(prev => prev.map(c => ({ ...c, options: c.options.map(o => o.id === optId ? { ...o, friendly_name: name, price_impact: price, ...(thumbnailUrl !== undefined ? { thumbnail_url: thumbnailUrl ?? undefined } : {}) } : o) })))}
                  onOptionDeleted={(optId, catId) => setCategories(prev => prev.map(c => c.id === catId ? { ...c, options: c.options.filter(o => o.id !== optId) } : c))}
                  onOptionReorder={(catId, newOptions) => {
                    const updated = newOptions.map((opt, i) => ({ ...opt, sort_order: i }));
                    setCategories(prev => prev.map(c => c.id === catId ? { ...c, options: updated } : c));
                    updated.forEach(opt => updateOption(opt.id, { sort_order: opt.sort_order }).catch(console.error));
                  }}
                  onOptionDoubleClick={handleOptionDoubleClick}
                  onReorder={(phase, newOrder) => {
                    const updated = newOrder.map((cat, i) => ({ ...cat, sort_order: i }));
                    setCategories(prev => {
                      const others = prev.filter(c => c.phase !== phase);
                      return [...others, ...updated].sort((a, b) => {
                        const pi = PHASES.indexOf(a.phase as Phase);
                        const pj = PHASES.indexOf(b.phase as Phase);
                        if (pi !== pj) return pi - pj;
                        return (a.sort_order ?? 0) - (b.sort_order ?? 0);
                      });
                    });
                    updated.forEach(cat => updateCategory(cat.id, { sort_order: cat.sort_order }).catch(console.error));
                  }}
                />
              ) : (
                <p className="text-center py-8 text-white/15 text-[10px]">No options yet</p>
              )}
            </div>
          </div>

          {/* Bottom-left: Option properties */}
          <div className="flex flex-col min-h-0 overflow-hidden border-t border-white/8" style={{ flex: "1 1 0" }}>
            <PanelHeader>Option Meshes</PanelHeader>
            <div className="flex-1 overflow-hidden flex flex-col">
              <OptionPropertiesPanel
                activeOption={activeOption}
                selectedMeshes={selectedMeshes}
                materials={effectiveMaterials}
                glbMaterials={glbMaterials}
                glbMeshNames={glbMeshNames}
                onRemoveMesh={handleRemoveMesh}
                onRemoveStale={handleRemoveStaleNodes}
                onSelectMesh={handleMeshToggle}
                onSelectAll={names => setSelectedMeshes(names)}
                onAssignMeshes={handleAssignMeshes}
                onAssignMeshesToCategory={handleAssignMeshesToCategory}
                onRemoveMaterialAssignment={handleRemoveMaterialAssignment}
                onSetCondition={handleSetNodeCondition}
                onSetConditionBulk={handleSetNodeConditionBulk}
                allCategories={categories}
                shapeNames={shapeMeshNames}
                allShapes={placedShapes}
                paintMatId={paintMatId}
                onPaintApply={applyPaintToMesh}
                deletedMeshes={deletedMeshes}
                onToggleHidden={handleToggleMeshVisibility}
              />
            </div>
          </div>
          </>}{/* end options tab */}
        </div>

        {/* ── CENTER: Viewport + toolbar ── */}
        <div className="flex-1 flex flex-col overflow-hidden p-3 gap-2">
          <div className="flex-1 overflow-hidden" style={{ cursor: (placingPropUrl || placingLightType || placingAnnotation) ? "crosshair" : undefined }}>
            {project.model_url && !modelLoadErr ? (
              <ModelErrorBoundary key={project.model_url} onError={setModelLoadErr}>
              <SceneEditorViewport
                ref={viewportRef}
                modelUrl={project.model_url}
                selectedMeshNames={selectedMeshes}
                onMeshSelect={handleMeshSelect}
                onSceneLoaded={handleSceneLoaded}
                transformMode={transformMode}
                sceneSettings={activeSettings}
                meshOverrides={meshOverrides}
                onMeshTransformStart={handleMeshTransformStart}
                onMeshTransformed={handleMeshTransformed}
                placedProps={placedProps}
                placingPropUrl={placingPropUrl}
                placingPropScale={placingPropScale ?? undefined}
                onPropPlaced={handlePropPlaced}
                onCancelPlacement={handleCancelPlacement}
                selectedPropId={selectedPropId}
                onPropSelect={(id) => { setSelectedPropId(id); }}
                onPropTransformed={handlePropTransformed}
                propTransformMode={propTransformMode}
                placedShapes={placedShapes}
                selectedShapeId={selectedShapeId}
                onShapeSelect={(id) => { setSelectedShapeId(id ?? null); if (id) { setSelectedMeshes([]); setSelectedPropId(null); } }}
                onShapeTransformed={(id, pos, rot, sc) => setPlacedShapes(prev => prev.map(s => s.id === id ? { ...s, position: pos, rotation: rot, scale: sc } : s))}
                shapeTransformMode={shapeTransformMode}
                shapeMaterials={effectiveMaterials}
                isolationMeshes={isolationMeshes}
                paintHighlightMeshes={paintHighlightMeshes}
                meshMaterials={meshMaterialMap}
                onGlbMats={setGlbMaterials}
                hiddenLayers={hiddenLayers}
                deletedMeshes={deletedMeshes}
                placedLights={placedLights}
                placingLightType={placingLightType}
                onLightPlaced={handleLightPlaced}
                selectedLightId={selectedLightId}
                onLightSelect={setSelectedLightId}
                onLightTransformed={handleLightTransformed}
                onMeshDoubleClick={handleMeshDoubleClick}
                addons={addons}
                onAddonTransformed={handleAddonTransformed}
                onAddonMeshNames={(addonId, names) => setAddonMeshNames(prev => ({ ...prev, [addonId]: names }))}
                onSceneTreeUpdate={handleSceneTreeUpdate}
                onTriangleCounts={setTriangleCounts}
                annotations={annotations}
                placingAnnotation={placingAnnotation}
                onAnnotationPlaced={handleAnnotationPlaced}
              />
              </ModelErrorBoundary>
            ) : (
              <div className="w-full h-full bg-[#0d0d0d] rounded-xl flex flex-col items-center justify-center gap-3 border border-dashed border-white/10">
                <div className="text-4xl opacity-20">⬡</div>
                {modelLoadErr ? (
                  <>
                    <p className="text-red-400/70 text-sm font-medium">Model failed to load</p>
                    <p className="text-white/25 text-xs max-w-[240px] text-center">{modelLoadErr}</p>
                    <p className="text-white/25 text-xs">Re-upload a valid GLB to recover</p>
                  </>
                ) : (
                  <p className="text-white/25 text-sm">Upload a GLB to start editing</p>
                )}
                <button onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors">
                  {modelLoadErr ? "Re-upload GLB" : "Upload GLB"}
                </button>
              </div>
            )}
          </div>

          {/* Transform toolbar */}
          <div className="flex items-center gap-1 px-2 py-1.5 bg-[#111] border border-white/8 rounded-xl flex-shrink-0">
            {TRANSFORM_BUTTONS.map(({ mode, icon, label, key }) => (
              <button key={mode}
                onClick={() => setTransformMode(mode)}
                title={key ? `${label} (${key})` : label}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                  transformMode === mode ? "bg-blue-600 text-white" : "text-white/35 hover:text-white hover:bg-white/8"
                }`}>
                <span>{icon}</span>
                <span className="hidden sm:inline">{label}</span>
                {key && <span className="hidden md:inline text-[9px] opacity-50 font-mono">{key}</span>}
              </button>
            ))}

            <div className="w-px h-4 bg-white/10 mx-0.5" />

            {/* Layer visibility toggles */}
            {(() => {
              const layers: { key: string; label: string; nodes: string[] }[] = [
                { key: "roof",   label: "Roof", nodes: activeSettings.roofNodes   },
                { key: "level1", label: "L1",   nodes: activeSettings.level1Nodes },
                { key: "level2", label: "L2",   nodes: activeSettings.level2Nodes },
                { key: "level3", label: "L3",   nodes: activeSettings.level3Nodes },
              ].filter(l => l.nodes.length > 0);
              if (layers.length === 0) return null;
              return (
                <>
                  <div className="flex items-center gap-0.5">
                    {layers.map(({ key, label }) => {
                      const hidden = hiddenLayers.has(key);
                      return (
                        <button
                          key={key}
                          onClick={() => setHiddenLayers(prev => {
                            const next = new Set(prev);
                            if (next.has(key)) next.delete(key); else next.add(key);
                            return next;
                          })}
                          title={hidden ? `Show ${label}` : `Hide ${label}`}
                          className={`px-2 py-1 rounded-md text-[9px] font-semibold transition-colors ${
                            hidden
                              ? "bg-white/6 text-white/20 border border-white/10 line-through"
                              : "text-white/50 hover:text-white border border-transparent hover:border-white/10"
                          }`}>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="w-px h-4 bg-white/10 mx-0.5" />
                </>
              );
            })()}

            <div className="w-px h-4 bg-white/10 mx-0.5" />

            {primaryMesh && meshOverrides[primaryMesh] && (
              <button
                onClick={() => {
                  pushUndo();
                  setMeshOverrides(prev => { const n = { ...prev }; delete n[primaryMesh!]; return n; });
                  showToast("Transform reset");
                }}
                className="px-2.5 py-1.5 rounded-lg text-[11px] text-white/35 hover:text-red-400 hover:bg-red-900/20 transition-colors">
                ↺ Reset
              </button>
            )}

            {/* Paint mode indicator */}
            {paintMatId && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-600/15 border border-blue-500/25 rounded-lg ml-auto">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
                <span className="text-[10px] text-blue-300">Paint mode</span>
                <button onClick={() => setPaintMatId(null)} className="text-white/30 hover:text-white ml-1 text-[10px]">✕</button>
              </div>
            )}

            {/* Selected mesh info */}
            {selectedMeshes.length > 0 && !paintMatId && (
              <div className="ml-auto flex items-center gap-1.5">
                {selectedMeshes.length === 1 ? (
                  <span className="text-blue-300 text-[10px] font-mono bg-blue-600/12 border border-blue-500/20 rounded-lg px-2 py-0.5 truncate max-w-[180px]">
                    {selectedMeshes[0]}
                  </span>
                ) : (
                  <span className="text-blue-300 text-[10px] bg-blue-600/12 border border-blue-500/20 rounded-lg px-2 py-0.5">
                    {selectedMeshes.length} meshes
                  </span>
                )}
                {(selectedMeshMat || selectedMeshGlbMat) && (() => {
                  const color = selectedMeshMat?.base_color ?? selectedMeshGlbMat!.color;
                  const name  = selectedMeshMat?.name ?? selectedMeshGlbMat!.name;
                  const isGlb = !selectedMeshMat;
                  return (
                    <>
                      <span className="text-white/20 text-[10px]">→</span>
                      <button
                        onDoubleClick={() => {
                          if (isGlb) { setEditingGlbMatName(selectedMeshGlbMat!.name); setRightTab("material"); }
                          else { setEditingMatId(selectedMeshMat!.id); setRightTab("material"); }
                        }}
                        title="Double-click to edit material"
                        className="flex items-center gap-1.5 bg-white/6 border border-white/10 hover:border-white/20 rounded-lg px-2 py-0.5 transition-colors group/matbar">
                        <span className="w-3 h-3 rounded-sm flex-shrink-0 border border-white/15" style={{ background: color }} />
                        <span className="text-white/55 group-hover/matbar:text-white/80 text-[10px] transition-colors truncate max-w-[120px]">{name}</span>
                        {isGlb && <span className="text-white/20 text-[8px]">GLB</span>}
                        <span className="text-white/20 text-[9px] group-hover/matbar:text-white/40 transition-colors hidden group-hover/matbar:inline">✎</span>
                      </button>
                    </>
                  );
                })()}
                <button onClick={() => { setSelectedMeshes([]); setTransformMode("none"); }}
                  className="text-white/25 hover:text-white text-xs transition-colors">✕</button>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        {(() => {
          const editingEntry: MaterialLibraryEntry | null = editingMatId
            ? (materials.find(m => m.id === editingMatId) ?? null)
            : editingGlbMatName
              ? (() => {
                  const g = glbMaterials.find(m => m.name === editingGlbMatName);
                  if (!g) return null;
                  const ov = glbMatOverrides[editingGlbMatName] ?? {};
                  return {
                    id: `glb:${editingGlbMatName}`, name: g.name, category: "GLB",
                    base_color: ov.base_color ?? g.color, roughness: ov.roughness ?? g.roughness,
                    metalness: ov.metalness ?? g.metalness, normal_map_url: null, thumbnail_url: null,
                    properties: ov.properties ?? {}, created_at: "",
                  } as MaterialLibraryEntry;
                })()
              : null;

          return (
            <div className="w-[280px] flex flex-col border-l border-white/8 flex-shrink-0 overflow-hidden">

              {/* Top-right: tab bar + tab content (50%) */}
              <div className="flex flex-col min-h-0 overflow-hidden" style={{ flex: "1 1 0" }}>
                <div className="flex flex-shrink-0 border-b border-white/8">
                  {(["scene", "material", "props", "shapes", "lights", "settings"] as const).map(tab => (
                    <button key={tab} onClick={() => setRightTab(tab)}
                      className={`flex-1 py-2 text-[10px] font-medium capitalize transition-colors ${
                        rightTab === tab
                          ? "text-white border-b border-blue-500 bg-blue-500/5"
                          : "text-white/30 hover:text-white/60 hover:bg-white/4"
                      }`}>
                      {tab}
                    </button>
                  ))}
                </div>
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                  {rightTab === "scene" && (
                    <div className="flex-1 overflow-hidden px-1.5 py-1.5 flex flex-col">
                      <ScenePanel
                        nodes={sceneTree}
                        selectedMeshes={selectedMeshes}
                        assignedMeshes={assignedMeshes}
                        isolationMeshes={isolationMeshes}
                        onSelect={name => handleMeshSelect([name])}
                        onToggle={handleMeshToggle}
                        onSelectAll={names => setSelectedMeshes(names)}
                        deletedMeshes={deletedMeshes}
                        onToggleHidden={handleToggleMeshVisibility}
                      />
                    </div>
                  )}
                  {rightTab === "material" && (
                    <MaterialsTab
                      materials={effectiveMaterials}
                      glbMaterials={glbMaterials}
                      activeOptionId={activeOptionId}
                      selectedMeshes={selectedMeshes}
                      onEdit={id => { setEditingMatId(id); setEditingGlbMatName(null); setEditPreview(null); }}
                      onEditGlb={name => { setEditingGlbMatName(name); setEditingMatId(null); setEditPreview(null); }}
                      onApply={handleApplyMaterial}
                      onBaseApply={handleSetBaseMaterial}
                      onCreateBlank={handleMatCreateBlank}
                      onPromoteGlb={handlePromoteGlb}
                      onDuplicate={handleMatDuplicate}
                      onDelete={handleMatDelete}
                      onToast={showToast}
                    />
                  )}
                  {rightTab === "props" && (
                    <PropsTab
                      placedProps={placedProps}
                      onPropsChange={setPlacedProps}
                      activePropId={placingPropId}
                      onActivePropChange={handleActivePropChange}
                      selectedPropId={selectedPropId}
                      onSelectProp={(id) => setSelectedPropId(id)}
                      propTransformMode={propTransformMode}
                      onSetPropTransformMode={setPropTransformMode}
                    />
                  )}
                  {rightTab === "shapes" && (
                    <ShapesPanel
                      shapes={placedShapes}
                      onShapesChange={setPlacedShapes}
                      selectedShapeId={selectedShapeId}
                      onSelectShape={(id) => { setSelectedShapeId(id); setSelectedMeshes([]); setSelectedPropId(null); }}
                      shapeTransformMode={shapeTransformMode}
                      onSetShapeTransformMode={setShapeTransformMode}
                      materials={effectiveMaterials}
                      meshNames={(() => {
                        const names: string[] = [];
                        function collect(node: SceneTreeNode) { if (node.type === "Mesh") names.push(node.name); node.children?.forEach(collect); }
                        sceneTree.forEach(collect);
                        return names;
                      })()}
                    />
                  )}
                  {rightTab === "lights" && (
                    <LightsPanel
                      placedLights={placedLights}
                      onLightsChange={setPlacedLights}
                      placingLightType={placingLightType}
                      onPlacingLightType={setPlacingLightType}
                      selectedLightId={selectedLightId}
                      onSelectLight={(id) => { setSelectedLightId(id); setSelectedMeshes([]); setSelectedPropId(null); }}
                    />
                  )}
                  {rightTab === "settings" && (
                    <div className="flex-1 overflow-y-auto px-3 py-3 pb-6" style={{ scrollbarWidth: "none" }}>
                      <SettingsPanel
                        settings={activeSettings}
                        onSettings={handleSceneSettings}
                        onGlobalSettings={handleGlobalSettings}
                        cameraDefaults={cameraDefaults}
                        onCameraDefaults={setCameraDefaults}
                        viewportRef={viewportRef}
                        onToast={showToast}
                        selectedMeshes={selectedMeshes}
                        lightingPhase={lightingPhase}
                        onLightingPhase={setLightingPhase}
                      />

                      {/* ── Camera Bookmarks ───────────────────────────── */}
                      <div className="mt-5 border-t border-white/8 pt-4">
                        <p className="text-[9px] uppercase tracking-widest text-white/25 font-bold mb-3">Camera Views</p>
                        <div className="flex gap-1 mb-2">
                          <input
                            value={bookmarkName}
                            onChange={e => setBookmarkName(e.target.value)}
                            placeholder="View name…"
                            className="flex-1 px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-[10px] text-white placeholder-white/20 outline-none focus:border-blue-500/40"
                          />
                          <button onClick={handleCaptureBookmark}
                            className="px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600/35 border border-blue-500/30 text-blue-300 text-[10px] rounded-lg transition-colors">
                            + Save
                          </button>
                        </div>
                        {cameraBookmarks.length === 0 ? (
                          <p className="text-[9px] text-white/20 text-center py-2">No bookmarks — position camera and save</p>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            {cameraBookmarks.map(b => (
                              <div key={b.id} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-white/5 group transition-colors">
                                <button onClick={() => handleFlyToBookmark(b)}
                                  className="flex-1 text-left text-[10px] text-white/60 hover:text-white transition-colors truncate">
                                  ▶ {b.name}
                                </button>
                                <button onClick={() => handleDeleteBookmark(b.id)}
                                  className="opacity-0 group-hover:opacity-100 text-red-400/60 hover:text-red-300 text-[10px] transition-opacity">✕</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* ── Annotation Pins ────────────────────────────── */}
                      <div className="mt-5 border-t border-white/8 pt-4">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[9px] uppercase tracking-widest text-white/25 font-bold">Annotations</p>
                          <button
                            onClick={() => setPlacingAnnotation(v => !v)}
                            className={`text-[9px] px-2 py-0.5 rounded border transition-colors ${
                              placingAnnotation
                                ? "bg-pink-600/20 border-pink-500/40 text-pink-300"
                                : "bg-white/5 border-white/10 text-white/40 hover:text-pink-300 hover:border-pink-500/30"
                            }`}>
                            {placingAnnotation ? "Click scene…" : "+ Place pin"}
                          </button>
                        </div>
                        {annotations.length === 0 ? (
                          <p className="text-[9px] text-white/20 text-center py-2">No annotations yet</p>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {annotations.map(pin => (
                              <div key={pin.id} className="flex flex-col gap-1 px-2 py-1.5 rounded-lg bg-white/3 border border-white/8 group">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 border border-white/20" style={{ background: pin.color }} />
                                  {editingAnnotId === pin.id ? (
                                    <input
                                      autoFocus
                                      value={pin.text}
                                      onChange={e => handleAnnotationUpdate(pin.id, e.target.value)}
                                      onBlur={() => setEditingAnnotId(null)}
                                      onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") setEditingAnnotId(null); }}
                                      className="flex-1 bg-transparent text-[10px] text-white outline-none border-b border-white/20"
                                    />
                                  ) : (
                                    <button onClick={() => setEditingAnnotId(pin.id)}
                                      className="flex-1 text-left text-[10px] text-white/60 hover:text-white transition-colors truncate">
                                      {pin.text}
                                    </button>
                                  )}
                                  <button onClick={() => handleAnnotationDelete(pin.id)}
                                    className="opacity-0 group-hover:opacity-100 text-red-400/60 hover:text-red-300 text-[10px] transition-opacity">✕</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom-right: Properties panel (50%) */}
              <div className="flex flex-col min-h-0 overflow-hidden border-t border-white/8" style={{ flex: "1 1 0" }}>
                <PanelHeader>
                  {editingEntry ? (editingGlbMatName ? `GLB: ${editingGlbMatName}` : "Material") : "Properties"}
                </PanelHeader>
                {editingEntry ? (
                  <div className="flex-1 overflow-hidden flex flex-col">
                    <MaterialEditor
                      key={editingMatId ?? editingGlbMatName ?? "none"}
                      material={editingEntry}
                      onSave={editingGlbMatName ? (u => { handleGlbMatSave(u); return Promise.resolve(); }) : handleMatSave}
                      onDuplicate={handleMatDuplicate}
                      onDelete={editingGlbMatName ? async () => {} : handleMatDelete}
                      onClose={() => { setEditingMatId(null); setEditingGlbMatName(null); setEditPreview(null); }}
                      onPreview={editingGlbMatName ? handleGlbMatPreview : setEditPreview}
                      onToast={showToast}
                      onApplyToOption={(activeOptionId && selectedMeshes.length > 0) ? () => {
                        const matId = editingMatId ?? (editingGlbMatName ? `glb:${editingGlbMatName}` : null);
                        if (matId) handleApplyMaterial(matId);
                      } : undefined}
                      glbEmbeddedMaps={editingGlbMatName ? (() => {
                        const g = glbMaterials.find(m => m.name === editingGlbMatName);
                        return g ? { hasMap: g.hasMap, hasNormalMap: g.hasNormalMap, hasBumpMap: g.hasBumpMap, hasRoughnessMap: g.hasRoughnessMap, hasMetalnessMap: g.hasMetalnessMap, hasAoMap: g.hasAoMap } : undefined;
                      })() : undefined}
                    />
                  </div>
                ) : (
                  <PropertiesPanel
                    selectedMeshes={selectedMeshes}
                    meshOverrides={meshOverrides}
                    selectedMeshMat={selectedMeshMat}
                    selectedMeshGlbMat={selectedMeshGlbMat}
                    glbMatOverrides={glbMatOverrides}
                    onEditMat={id => { setEditingMatId(id); setEditingGlbMatName(null); setEditPreview(null); }}
                    onEditGlb={name => { setEditingGlbMatName(name); setEditingMatId(null); setEditPreview(null); }}
                    onResetTransform={handleResetMeshTransform}
                    deletedMeshes={deletedMeshes}
                    onDeleteMesh={handleDeleteMesh}
                    onRestoreMesh={handleRestoreMesh}
                    triangleCounts={triangleCounts}
                    isolationOverride={isolationOverride}
                    onClearIsolation={() => setIsolationOverride(null)}
                  />
                )}
              </div>
            </div>
          );
        })()}

      </div>
    </div>
  );
}
