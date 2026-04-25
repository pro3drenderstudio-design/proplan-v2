"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  getCategoriesWithOptions,
  createCategory,
  updateCategory,
  deleteCategory,
  createOption,
  updateOption,
  deleteOption,
  getAllProjects,
  updateViewerMode,
} from "@/lib/admin-api";
import { CategoryWithOptions, Option, PhaseColumn, Project } from "@/types/database";

const PHASES: { value: PhaseColumn; label: string }[] = [
  { value: "blueprint", label: "Blueprint" },
  { value: "interior",  label: "Interior"  },
  { value: "exterior",  label: "Exterior"  },
];

const PHASE_COLOR: Record<PhaseColumn, string> = {
  blueprint: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  interior:  "text-violet-400 bg-violet-400/10 border-violet-400/20",
  exterior:  "text-green-400 bg-green-400/10 border-green-400/20",
};

function fmtPrice(n: number) {
  if (n === 0) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

// ── Viewer Mode Toggle ────────────────────────────────────────────────────────

function ViewerModeToggle({
  project,
  onSwitch,
  switching,
}: {
  project: Project;
  onSwitch: (mode: "sketchfab" | "r3f") => void;
  switching: boolean;
}) {
  // Resolve effective mode
  const effective: "sketchfab" | "r3f" =
    project.viewer_mode === "r3f" ? "r3f"
    : project.viewer_mode === "sketchfab" ? "sketchfab"
    : project.model_url ? "r3f"
    : "sketchfab";

  const hasGlb = !!project.model_url;
  const hasSketchfab = !!project.sketchfab_uid;

  return (
    <div className="flex items-center gap-2">
      {/* LIVE badge */}
      <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-white/30 select-none">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        Live
      </div>

      {/* Toggle pill */}
      <div className="flex items-center bg-white/6 border border-white/10 rounded-lg p-0.5 gap-0.5">
        <button
          disabled={switching || (!hasSketchfab)}
          onClick={() => onSwitch("sketchfab")}
          title={!hasSketchfab ? "No Sketchfab UID configured" : "Switch live viewer to Sketchfab"}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            effective === "sketchfab"
              ? "bg-white/12 text-white shadow-sm"
              : "text-white/35 hover:text-white/60 disabled:opacity-25 disabled:cursor-not-allowed"
          }`}>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
          </svg>
          Sketchfab
        </button>
        <button
          disabled={switching || (!hasGlb)}
          onClick={() => onSwitch("r3f")}
          title={!hasGlb ? "No GLB uploaded yet — go to Scene Editor first" : "Switch live viewer to Scene Editor"}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            effective === "r3f"
              ? "bg-blue-600/80 text-white shadow-sm"
              : "text-white/35 hover:text-white/60 disabled:opacity-25 disabled:cursor-not-allowed"
          }`}>
          {switching ? (
            <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 10V7" />
            </svg>
          )}
          Scene Editor
        </button>
      </div>
    </div>
  );
}

// ── Inline text editor ────────────────────────────────────────────────────────

function InlineText({
  value, onSave, placeholder, className,
}: {
  value: string; onSave: (v: string) => Promise<void> | void;
  placeholder?: string; className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw]         = useState(value);

  async function commit() {
    setEditing(false);
    const trimmed = raw.trim();
    if (trimmed && trimmed !== value) await onSave(trimmed);
    else setRaw(value);
  }

  if (editing) {
    return (
      <input autoFocus value={raw}
        onChange={e => setRaw(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") { setEditing(false); setRaw(value); }
        }}
        className={`bg-[#1e1e1e] border border-blue-500/40 rounded px-2 py-0.5 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500/40 ${className ?? ""}`}
      />
    );
  }
  return (
    <button onClick={() => setEditing(true)}
      className={`text-left hover:text-white/80 transition-colors group ${className ?? ""}`}>
      {value || <span className="text-white/20">{placeholder ?? "Click to edit"}</span>}
      <span className="ml-1.5 text-[9px] text-white/15 group-hover:text-white/30">edit</span>
    </button>
  );
}

// ── Option row ────────────────────────────────────────────────────────────────

function OptionRow({
  opt, isR3FMode, onUpdate, onDelete,
}: {
  opt: Option;
  isR3FMode: boolean;
  onUpdate: (id: string, payload: Partial<Pick<Option, "friendly_name" | "price_impact">>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [priceEdit, setPriceEdit] = useState(false);
  const [priceRaw,  setPriceRaw]  = useState(String(opt.price_impact));
  const [deleting,  setDeleting]  = useState(false);

  async function commitPrice() {
    setPriceEdit(false);
    const n = parseInt(priceRaw, 10);
    if (!isNaN(n) && n !== opt.price_impact) await onUpdate(opt.id, { price_impact: n });
    else setPriceRaw(String(opt.price_impact));
  }

  async function handleDelete() {
    if (!confirm(`Delete option "${opt.friendly_name}"? This cannot be undone.`)) return;
    setDeleting(true);
    await onDelete(opt.id);
  }

  const nodeCount = opt.node_list?.length ?? 0;

  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/3 border border-white/6 group ${deleting ? "opacity-40" : ""}`}>
      <div className="flex-1 min-w-0">
        <InlineText
          value={opt.friendly_name}
          onSave={name => onUpdate(opt.id, { friendly_name: name })}
          className="text-sm text-white/80 font-medium truncate"
        />
        <div className="flex items-center gap-2 mt-0.5">
          {nodeCount > 0 ? (
            <span className="text-[10px] text-green-400/60">
              {nodeCount} {isR3FMode ? "mesh" : "node"}{nodeCount !== 1 ? "es" : ""} mapped
            </span>
          ) : (
            <span className={`text-[10px] ${isR3FMode ? "text-white/25" : "text-amber-400/60"}`}>
              {isR3FMode ? "Map in Scene Editor" : "No nodes mapped"}
            </span>
          )}
          {opt.option_type && opt.option_type !== "visibility" && (
            <span className="text-[9px] text-blue-400/50 bg-blue-400/8 px-1.5 py-0.5 rounded-full">
              {opt.option_type === "material_override" ? "Material" : "KHR Variant"}
            </span>
          )}
        </div>
      </div>

      {/* Price impact */}
      <div className="flex-shrink-0 w-24">
        {priceEdit ? (
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-white/40">$</span>
            <input autoFocus type="text" value={priceRaw}
              onChange={e => setPriceRaw(e.target.value)}
              onBlur={commitPrice}
              onKeyDown={e => { if (e.key === "Enter") commitPrice(); if (e.key === "Escape") { setPriceEdit(false); setPriceRaw(String(opt.price_impact)); } }}
              className="w-full bg-[#1e1e1e] border border-blue-500/40 rounded pl-5 pr-2 py-1 text-xs text-white outline-none"
            />
          </div>
        ) : (
          <button onClick={() => { setPriceEdit(true); setPriceRaw(String(opt.price_impact)); }}
            className="text-xs text-white/50 hover:text-white transition-colors">
            {fmtPrice(opt.price_impact)}
          </button>
        )}
      </div>

      <button onClick={handleDelete} disabled={deleting}
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-white/30 hover:text-red-400 disabled:cursor-not-allowed">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ── Category panel ────────────────────────────────────────────────────────────

function CategoryPanel({
  cat, isSelected, onClick, onUpdate, onDelete,
}: {
  cat: CategoryWithOptions; isSelected: boolean; onClick: () => void;
  onUpdate: (id: string, payload: Parameters<typeof updateCategory>[1]) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete category "${cat.name}" and all its options?`)) return;
    setDeleting(true);
    await onDelete(cat.id);
  }

  return (
    <div onClick={onClick}
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-colors group ${
        isSelected
          ? "bg-blue-600/15 border border-blue-500/30"
          : "bg-white/3 border border-transparent hover:bg-white/6 hover:border-white/8"
      } ${deleting ? "opacity-40" : ""}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-bold uppercase tracking-wider ${PHASE_COLOR[cat.phase]}`}>
            {cat.phase}
          </span>
          {cat.is_mandatory && <span className="text-[9px] text-amber-400/60 font-medium">required</span>}
        </div>
        <p className={`text-sm font-medium mt-0.5 truncate ${isSelected ? "text-white" : "text-white/70"}`}>{cat.name}</p>
        <p className="text-[10px] text-white/30 mt-0.5">{cat.options.length} option{cat.options.length !== 1 ? "s" : ""}</p>
      </div>
      <button onClick={handleDelete} disabled={deleting}
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-white/30 hover:text-red-400 disabled:cursor-not-allowed">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminProjectEditorPage() {
  const params    = useParams();
  const router    = useRouter();
  const projectId = params.id as string;

  const [project,      setProject]      = useState<Project | null>(null);
  const [categories,   setCategories]   = useState<CategoryWithOptions[]>([]);
  const [selected,     setSelected]     = useState<string | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [switching,    setSwitching]    = useState(false);
  const [duplicating,  setDuplicating]  = useState(false);

  // Add-category form
  const [addingCat,   setAddingCat]   = useState(false);
  const [newCatName,  setNewCatName]  = useState("");
  const [newCatPhase, setNewCatPhase] = useState<PhaseColumn>("interior");
  const [newCatMand,  setNewCatMand]  = useState(false);
  const [savingCat,   setSavingCat]   = useState(false);

  // Add-option form
  const [addingOpt,   setAddingOpt]   = useState(false);
  const [newOptName,  setNewOptName]  = useState("");
  const [newOptPrice, setNewOptPrice] = useState("0");
  const [savingOpt,   setSavingOpt]   = useState(false);

  const load = useCallback(async () => {
    const [allProjects, cats] = await Promise.all([
      getAllProjects(),
      getCategoriesWithOptions(projectId),
    ]);
    const proj = allProjects.find(p => p.id === projectId);
    if (proj) setProject(proj);
    setCategories(cats);
    if (cats.length > 0 && !selected) setSelected(cats[0].id);
    setLoading(false);
  }, [projectId, selected]);

  useEffect(() => { load(); }, [load]);

  // Effective viewer mode, resolving null/undefined
  const effectiveMode: "sketchfab" | "r3f" =
    project?.viewer_mode === "r3f" ? "r3f"
    : project?.viewer_mode === "sketchfab" ? "sketchfab"
    : project?.model_url ? "r3f"
    : "sketchfab";

  const isR3FMode = effectiveMode === "r3f";

  async function handleSwitchMode(mode: "sketchfab" | "r3f") {
    if (!project || switching) return;
    setSwitching(true);
    const ok = await updateViewerMode(projectId, mode);
    if (ok) setProject(prev => prev ? { ...prev, viewer_mode: mode } : prev);
    setSwitching(false);
  }

  // ── Category mutations ──────────────────────────────────────────────────────

  async function handleAddCategory() {
    if (!newCatName.trim()) return;
    setSavingCat(true);
    const maxSort = categories.reduce((m, c) => Math.max(m, c.sort_order), 0);
    const created = await createCategory({
      project_id: projectId, name: newCatName.trim(),
      phase: newCatPhase, is_mandatory: newCatMand, sort_order: maxSort + 10,
    });
    if (created) {
      setCategories(prev => [...prev, { ...created, options: [] }]);
      setSelected(created.id);
      setNewCatName(""); setNewCatPhase("interior"); setNewCatMand(false); setAddingCat(false);
    }
    setSavingCat(false);
  }

  async function handleUpdateCategory(id: string, payload: Parameters<typeof updateCategory>[1]) {
    const ok = await updateCategory(id, payload);
    if (ok) setCategories(prev => prev.map(c => c.id === id ? { ...c, ...payload } : c));
  }

  async function handleDeleteCategory(id: string) {
    const ok = await deleteCategory(id);
    if (ok) { setCategories(prev => prev.filter(c => c.id !== id)); if (selected === id) setSelected(null); }
  }

  // ── Option mutations ────────────────────────────────────────────────────────

  async function handleAddOption() {
    if (!newOptName.trim() || !selected) return;
    setSavingOpt(true);
    const selCat = categories.find(c => c.id === selected);
    const maxSort = selCat?.options.reduce((m, o) => Math.max(m, o.sort_order), 0) ?? 0;
    const created = await createOption({
      category_id: selected, friendly_name: newOptName.trim(),
      price_impact: parseInt(newOptPrice, 10) || 0, sort_order: maxSort + 10,
    });
    if (created) {
      setCategories(prev => prev.map(c =>
        c.id === selected ? { ...c, options: [...c.options, created] } : c
      ));
      setNewOptName(""); setNewOptPrice("0"); setAddingOpt(false);
    }
    setSavingOpt(false);
  }

  async function handleUpdateOption(id: string, payload: Partial<Pick<Option, "friendly_name" | "price_impact">>) {
    const ok = await updateOption(id, payload);
    if (ok) {
      setCategories(prev => prev.map(c => ({
        ...c, options: c.options.map(o => o.id === id ? { ...o, ...payload } : o),
      })));
    }
  }

  async function handleDeleteOption(id: string) {
    const ok = await deleteOption(id);
    if (ok) setCategories(prev => prev.map(c => ({ ...c, options: c.options.filter(o => o.id !== id) })));
  }

  async function handleDuplicate() {
    if (!project || duplicating) return;
    setDuplicating(true);
    try {
      const res = await fetch(`/api/admin/projects/${projectId}/duplicate`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const { id } = await res.json() as { id: string };
      router.push(`/admin/projects/${id}`);
    } catch (err) {
      console.error("duplicate failed:", err);
      alert("Duplicate failed. See console for details.");
      setDuplicating(false);
    }
  }

  const selectedCat = categories.find(c => c.id === selected) ?? null;

  if (loading) {
    return <div className="flex items-center justify-center h-full text-white/30 text-sm">Loading…</div>;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-white/8 flex items-center gap-4 flex-wrap">
        <button onClick={() => router.back()} className="text-white/40 hover:text-white transition-colors flex-shrink-0">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold text-white truncate">{project?.name ?? "Project"} — Options</h1>
          <p className="text-xs text-white/35 mt-0.5">
            {categories.length} categories · {categories.reduce((s, c) => s + c.options.length, 0)} options
          </p>
        </div>

        {/* Viewer mode toggle */}
        {project && (
          <ViewerModeToggle
            project={project}
            onSwitch={handleSwitchMode}
            switching={switching}
          />
        )}

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Scene Editor — primary when R3F mode */}
          <Link href={`/admin/projects/${projectId}/scene-editor`}
            className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${
              isR3FMode
                ? "text-blue-300 border-blue-500/30 bg-blue-600/12 hover:bg-blue-600/20"
                : "text-white/40 border-white/10 hover:text-white/70 hover:border-white/20"
            }`}>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 10V7" />
            </svg>
            Scene Editor
          </Link>

          {/* Node Bridge — primary when Sketchfab mode, dimmed in R3F mode */}
          <Link
            href={isR3FMode ? "#" : `/admin/node-bridge?project=${projectId}`}
            onClick={isR3FMode ? (e) => e.preventDefault() : undefined}
            title={isR3FMode ? "Node Bridge is for Sketchfab only — switch live viewer to Sketchfab to use it" : "Map nodes in Sketchfab"}
            className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors ${
              isR3FMode
                ? "text-white/20 border-white/6 cursor-not-allowed opacity-50"
                : "text-blue-400 border-blue-400/20 bg-blue-400/6 hover:bg-blue-400/12"
            }`}>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/>
              <path strokeLinecap="round" d="M8.5 12h4m1 0l2-4.5M13.5 12l2 4.5" />
            </svg>
            Node Bridge
            {isR3FMode && <span className="text-[8px] opacity-60">(Sketchfab)</span>}
          </Link>

          {/* Duplicate project */}
          <button
            onClick={handleDuplicate}
            disabled={duplicating}
            title="Duplicate this project — copies all categories and options"
            className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border text-amber-400 border-amber-400/20 bg-amber-400/6 hover:bg-amber-400/12 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {duplicating ? (
              <span className="w-3 h-3 border border-amber-400/40 border-t-amber-400 rounded-full animate-spin" />
            ) : (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
            {duplicating ? "Duplicating…" : "Duplicate"}
          </button>
        </div>
      </div>

      {/* Mode context banner */}
      {isR3FMode && (
        <div className="flex-shrink-0 px-6 py-2 bg-blue-600/8 border-b border-blue-500/15 flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-blue-400/70 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-[10px] text-blue-300/70">
            <strong className="text-blue-300">Scene Editor mode</strong> — mesh assignments and materials are managed in Scene Editor. Node Bridge does not apply.
          </p>
        </div>
      )}

      {/* Body: two-column */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Category list */}
        <div className="w-72 flex-shrink-0 border-r border-white/8 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/8 flex-shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Categories</span>
            <button onClick={() => setAddingCat(true)}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium">
              + Add
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {categories.length === 0 && !addingCat && (
              <div className="text-center py-8 text-white/25 text-xs">No categories yet.<br />Click + Add to create one.</div>
            )}

            {categories.map(cat => (
              <CategoryPanel key={cat.id} cat={cat} isSelected={selected === cat.id}
                onClick={() => setSelected(cat.id)}
                onUpdate={handleUpdateCategory} onDelete={handleDeleteCategory}
              />
            ))}

            {addingCat && (
              <div className="bg-[#1a1a1a] border border-blue-500/30 rounded-xl p-3 space-y-2.5 mt-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400/70">New Category</p>
                <input autoFocus value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleAddCategory(); if (e.key === "Escape") setAddingCat(false); }}
                  placeholder="Category name…"
                  className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-blue-500/40"
                />
                <select value={newCatPhase} onChange={e => setNewCatPhase(e.target.value as PhaseColumn)}
                  className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-blue-500/40">
                  {PHASES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                <label className="flex items-center gap-2 text-xs text-white/50 cursor-pointer">
                  <input type="checkbox" checked={newCatMand} onChange={e => setNewCatMand(e.target.checked)} className="accent-blue-500" />
                  Mandatory selection
                </label>
                <div className="flex gap-2">
                  <button onClick={handleAddCategory} disabled={savingCat || !newCatName.trim()}
                    className="flex-1 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold transition-colors">
                    {savingCat ? "Saving…" : "Add Category"}
                  </button>
                  <button onClick={() => { setAddingCat(false); setNewCatName(""); }}
                    className="px-3 py-1.5 rounded-lg bg-white/6 hover:bg-white/10 text-white/50 text-xs transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Options for selected category */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selectedCat ? (
            <div className="flex items-center justify-center h-full text-white/25 text-sm">
              Select a category to manage its options
            </div>
          ) : (
            <>
              {/* Category header */}
              <div className="flex-shrink-0 px-5 py-3 border-b border-white/8 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`text-[9px] px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider flex-shrink-0 ${PHASE_COLOR[selectedCat.phase]}`}>
                    {selectedCat.phase}
                  </span>
                  <InlineText value={selectedCat.name}
                    onSave={name => handleUpdateCategory(selectedCat.id, { name })}
                    className="text-sm font-semibold text-white"
                  />
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <select value={selectedCat.phase}
                    onChange={e => handleUpdateCategory(selectedCat.id, { phase: e.target.value as PhaseColumn })}
                    className="bg-[#1a1a1a] border border-white/10 rounded-lg px-2 py-1 text-xs text-white/70 outline-none focus:border-blue-500/40">
                    {PHASES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                  <label className="flex items-center gap-1.5 text-xs text-white/40 cursor-pointer">
                    <input type="checkbox" checked={selectedCat.is_mandatory}
                      onChange={e => handleUpdateCategory(selectedCat.id, { is_mandatory: e.target.checked })}
                      className="accent-blue-500" />
                    Mandatory
                  </label>
                </div>
              </div>

              {/* Geometry rule: Show when */}
              <div className="flex-shrink-0 px-5 py-3 border-b border-white/8">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Visibility Rule</span>
                  {(selectedCat.show_when?.length ?? 0) > 0 && (
                    <button
                      onClick={() => handleUpdateCategory(selectedCat.id, { show_when: [] })}
                      className="text-[9px] text-white/25 hover:text-red-400 transition-colors">
                      Clear rule
                    </button>
                  )}
                </div>
                {(selectedCat.show_when?.length ?? 0) === 0 ? (
                  <p className="text-[10px] text-white/25 italic">Always visible — no condition set</p>
                ) : (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {selectedCat.show_when!.map(optId => {
                      const opt = categories.flatMap(c => c.options).find(o => o.id === optId);
                      const catName = categories.find(c => c.options.some(o => o.id === optId))?.name ?? "?";
                      return (
                        <span key={optId} className="flex items-center gap-1 text-[9px] bg-amber-500/10 border border-amber-500/25 text-amber-300/80 rounded-full px-2 py-0.5">
                          <span className="text-amber-500/50">{catName}:</span>
                          {opt?.friendly_name ?? optId}
                          <button onClick={() => handleUpdateCategory(selectedCat.id, { show_when: selectedCat.show_when!.filter(id => id !== optId) })}
                            className="text-amber-500/40 hover:text-red-400 ml-0.5 leading-none">✕</button>
                        </span>
                      );
                    })}
                  </div>
                )}
                <select
                  value=""
                  onChange={e => {
                    const optId = e.target.value;
                    if (!optId) return;
                    const already = selectedCat.show_when ?? [];
                    if (!already.includes(optId)) {
                      handleUpdateCategory(selectedCat.id, { show_when: [...already, optId] });
                    }
                  }}
                  className="w-full bg-[#111] border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white/60 outline-none focus:border-amber-500/40 mt-1">
                  <option value="">+ Add condition — show when selected…</option>
                  {categories
                    .filter(c => c.id !== selectedCat.id)
                    .map(c => (
                      <optgroup key={c.id} label={`${c.phase.toUpperCase()} · ${c.name}`}>
                        {c.options.map(o => (
                          <option key={o.id} value={o.id} disabled={selectedCat.show_when?.includes(o.id)}>
                            {o.friendly_name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                </select>
              </div>

              {/* Options list */}
              <div className="flex-1 overflow-y-auto p-5 space-y-2">
                {selectedCat.options.length > 0 && (
                  <div className="flex items-center gap-3 px-3 pb-1.5">
                    <span className="flex-1 text-[9px] font-bold uppercase tracking-widest text-white/20">Option Name</span>
                    <span className="w-24 text-[9px] font-bold uppercase tracking-widest text-white/20">Price Impact</span>
                    <span className="w-5" />
                  </div>
                )}

                {selectedCat.options.length === 0 && !addingOpt && (
                  <div className="text-center py-10 text-white/25 text-xs">
                    No options yet.<br />Click + Add Option to create one.
                  </div>
                )}

                {selectedCat.options.map(opt => (
                  <OptionRow key={opt.id} opt={opt} isR3FMode={isR3FMode}
                    onUpdate={handleUpdateOption} onDelete={handleDeleteOption}
                  />
                ))}

                {addingOpt && (
                  <div className="bg-[#1a1a1a] border border-blue-500/30 rounded-xl p-4 space-y-3 mt-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400/70">New Option</p>
                    <input autoFocus value={newOptName}
                      onChange={e => setNewOptName(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleAddOption(); if (e.key === "Escape") setAddingOpt(false); }}
                      placeholder="Option name…"
                      className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-blue-500/40"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/40">Price impact: $</span>
                      <input type="text" value={newOptPrice}
                        onChange={e => setNewOptPrice(e.target.value)}
                        placeholder="0"
                        className="w-24 bg-[#111] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-blue-500/40"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleAddOption} disabled={savingOpt || !newOptName.trim()}
                        className="flex-1 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold transition-colors">
                        {savingOpt ? "Saving…" : "Add Option"}
                      </button>
                      <button onClick={() => { setAddingOpt(false); setNewOptName(""); setNewOptPrice("0"); }}
                        className="px-3 py-1.5 rounded-lg bg-white/6 hover:bg-white/10 text-white/50 text-xs transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex-shrink-0 px-5 py-3 border-t border-white/8">
                {!addingOpt && (
                  <button onClick={() => setAddingOpt(true)}
                    className="w-full py-2 rounded-xl border border-dashed border-white/15 text-white/40 hover:border-blue-500/40 hover:text-blue-400 transition-colors text-sm">
                    + Add Option
                  </button>
                )}
                <p className="text-[10px] text-white/20 text-center mt-2">
                  {isR3FMode ? (
                    <>Mesh mappings are set in{" "}
                      <Link href={`/admin/projects/${projectId}/scene-editor`} className="text-blue-400/60 hover:text-blue-400">
                        Scene Editor
                      </Link>
                    </>
                  ) : (
                    <>Node mappings are set in{" "}
                      <Link href={`/admin/node-bridge?project=${projectId}`} className="text-blue-400/60 hover:text-blue-400">
                        Node Bridge
                      </Link>
                    </>
                  )}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
