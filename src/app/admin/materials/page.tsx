"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MaterialFolder, MaterialLibraryEntry } from "@/types/database";
import { DEFAULT_MATERIAL_PROPS } from "@/lib/material-defaults";
import MaterialEditor from "@/components/scene-editor/MaterialEditor";
import LightbeansBatchImport from "@/components/admin/LightbeansBatchImport";

// ─── Material card ────────────────────────────────────────────────────────────

function MaterialCard({
  mat, selected,
  onSelect, onDuplicate, onDelete, onUploadThumb, onClearThumb,
}: {
  mat: MaterialLibraryEntry;
  selected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onUploadThumb: () => void;
  onClearThumb: () => void;
}) {
  // Priority: custom thumbnail → albedo map → base color
  const imgSrc = mat.thumbnail_url ?? mat.properties?.albedoMapUrl ?? null;
  const hasCustomThumb = !!mat.thumbnail_url;

  return (
    <div
      onClick={onSelect}
      className={`group/card relative rounded-xl overflow-hidden cursor-pointer transition-all border ${
        selected
          ? "border-blue-500/60 ring-1 ring-blue-500/40 shadow-lg shadow-blue-500/10"
          : "border-white/8 hover:border-white/20"
      }`}
    >
      {/* Thumbnail / albedo / swatch */}
      <div
        className="w-full aspect-square relative"
        style={{ backgroundColor: mat.base_color }}
      >
        {imgSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/55 opacity-0 group-hover/card:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
          {/* Top row: upload thumb + clear thumb */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={e => { e.stopPropagation(); onUploadThumb(); }}
              title={hasCustomThumb ? "Replace thumbnail" : "Upload custom thumbnail"}
              className="flex items-center gap-1 px-2 py-1 bg-white/12 hover:bg-white/22 rounded-lg text-white/70 hover:text-white transition-colors text-[9px]"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <circle cx="12" cy="13" r="3" />
              </svg>
              Thumb
            </button>
            {hasCustomThumb && (
              <button
                onClick={e => { e.stopPropagation(); onClearThumb(); }}
                title="Remove custom thumbnail (show albedo / color)"
                className="px-2 py-1 bg-white/12 hover:bg-amber-900/50 rounded-lg text-white/50 hover:text-amber-400 transition-colors text-[9px]"
              >
                Reset
              </button>
            )}
          </div>
          {/* Bottom row: duplicate + delete */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={e => { e.stopPropagation(); onDuplicate(); }}
              title="Duplicate"
              className="w-6 h-6 bg-white/12 hover:bg-white/25 rounded-lg flex items-center justify-center text-white/70 hover:text-white transition-colors"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDelete(); }}
              title="Delete"
              className="w-6 h-6 bg-white/12 hover:bg-red-900/60 rounded-lg flex items-center justify-center text-white/70 hover:text-red-400 transition-colors"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Albedo-is-showing badge — subtle, so user knows it's the map not a photo */}
        {!hasCustomThumb && mat.properties?.albedoMapUrl && (
          <div className="absolute bottom-1 left-1 px-1 py-0.5 bg-black/50 rounded text-[7px] text-white/40 pointer-events-none">
            albedo
          </div>
        )}

        {/* Selected indicator */}
        {selected && (
          <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center shadow">
            <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>

      {/* Label */}
      <div className="px-2 py-1.5 bg-[#111]">
        <p className="text-[10px] text-white/70 truncate leading-tight font-medium">{mat.name}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {mat.category && (
            <span className="text-[8px] text-white/25 uppercase tracking-wide">{mat.category.slice(0, 3)}</span>
          )}
          <span className="text-[8px] text-white/18">R{mat.roughness.toFixed(1)}</span>
          <span className="text-[8px] text-white/18">M{mat.metalness.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EditorEmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-white/20 select-none px-6 text-center">
      <svg className="w-10 h-10 mb-3 opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={0.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
      </svg>
      <p className="text-xs font-medium text-white/30">No material selected</p>
      <p className="text-[10px] mt-1 text-white/15 leading-snug">
        Click any card in the library to open the editor
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MaterialLibraryPage() {
  const [folders,   setFolders]   = useState<MaterialFolder[]>([]);
  const [materials, setMaterials] = useState<MaterialLibraryEntry[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState("");
  const [selectedId,  setSelectedId]  = useState<string | null>(null);
  const [collapsed,   setCollapsed]   = useState<Set<string>>(new Set());

  // Folder CRUD
  const [addFolderOpen,   setAddFolderOpen]   = useState(false);
  const [newFolderName,   setNewFolderName]   = useState("");
  const [creatingFolder,  setCreatingFolder]  = useState(false);
  const [renameFolderId,  setRenameFolderId]  = useState<string | null>(null);
  const [renameFolderVal, setRenameFolderVal] = useState("");

  // Material creation (per folder)
  const [addMatFolderId, setAddMatFolderId] = useState<string | null>(null);
  const [newMatName,     setNewMatName]     = useState("");
  const [creatingMat,    setCreatingMat]    = useState(false);

  // Batch import
  const [batchImportOpen, setBatchImportOpen] = useState(false);

  // Thumbnail upload
  const [thumbUploadingId, setThumbUploadingId] = useState<string | null>(null);
  const thumbFileRef     = useRef<HTMLInputElement>(null);
  const thumbTargetIdRef = useRef<string | null>(null);

  // Toast
  const [toast, setToast] = useState("");
  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch("/api/admin/materials").then(r => r.json()),
      fetch("/api/admin/materials/folders").then(r => r.json()),
    ]).then(([mats, fols]) => {
      setMaterials(Array.isArray(mats) ? mats : []);
      setFolders(Array.isArray(fols) ? fols : []);
      setLoading(false);
    });
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────
  const searchLower = search.toLowerCase();
  const filtered    = search
    ? materials.filter(m => m.name.toLowerCase().includes(searchLower))
    : materials;

  const selectedMaterial = materials.find(m => m.id === selectedId) ?? null;

  // Strip folder_id before passing to MaterialEditor so the editor's auto-save
  // draft never overwrites folder assignment (managed separately).
  // Strip folder_id and thumbnail_url before passing to the editor so its
  // auto-save draft never overwrites those two fields (managed separately).
  const matForEditor: MaterialLibraryEntry | null = selectedMaterial
    ? (({ folder_id: _f, thumbnail_url: _tu, ...rest }) => rest as MaterialLibraryEntry)(
        selectedMaterial as MaterialLibraryEntry & { folder_id?: string | null },
      )
    : null;

  // ── Folder CRUD ───────────────────────────────────────────────────────────
  async function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    const res = await fetch("/api/admin/materials/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newFolderName.trim(), sort_order: folders.length }),
    });
    const folder = await res.json();
    if (res.ok) {
      setFolders(prev => [...prev, folder]);
      setNewFolderName("");
      setAddFolderOpen(false);
    } else {
      showToast(`Error: ${folder.error}`);
    }
    setCreatingFolder(false);
  }

  async function handleRenameFolder() {
    if (!renameFolderId || !renameFolderVal.trim()) return;
    const res = await fetch(`/api/admin/materials/folders/${renameFolderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: renameFolderVal.trim() }),
    });
    if (res.ok) {
      setFolders(prev => prev.map(f =>
        f.id === renameFolderId ? { ...f, name: renameFolderVal.trim() } : f,
      ));
      setRenameFolderId(null);
    }
  }

  async function handleDeleteFolder(id: string) {
    const name = folders.find(f => f.id === id)?.name ?? "this folder";
    if (!confirm(`Delete "${name}"? Materials inside will become unfiled.`)) return;
    await fetch(`/api/admin/materials/folders/${id}`, { method: "DELETE" });
    setFolders(prev => prev.filter(f => f.id !== id));
    setMaterials(prev => prev.map(m =>
      (m as MaterialLibraryEntry & { folder_id?: string | null }).folder_id === id
        ? { ...m, folder_id: null }
        : m,
    ));
    showToast("Folder deleted");
  }

  // ── Move material to folder ───────────────────────────────────────────────
  async function handleMoveToFolder(matId: string, folderId: string | null) {
    await fetch(`/api/admin/materials/${matId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder_id: folderId }),
    });
    setMaterials(prev => prev.map(m =>
      m.id === matId ? { ...m, folder_id: folderId } : m,
    ));
  }

  // ── Material CRUD ─────────────────────────────────────────────────────────
  async function handleCreateMaterial(folderId: string | null) {
    if (!newMatName.trim()) return;
    setCreatingMat(true);
    const res = await fetch("/api/admin/materials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newMatName.trim(),
        base_color: "#8b8b8b",
        roughness: 0.5,
        metalness: 0.0,
        folder_id: folderId,
        properties: { ...DEFAULT_MATERIAL_PROPS },
      }),
    });
    const mat = await res.json();
    if (res.ok) {
      setMaterials(prev => [...prev, mat]);
      setSelectedId(mat.id);
      setNewMatName("");
      setAddMatFolderId(null);
    } else {
      showToast(`Error: ${mat.error}`);
    }
    setCreatingMat(false);
  }

  // ── MaterialEditor callbacks ──────────────────────────────────────────────
  const handleSaveMaterial = useCallback(async (updated: MaterialLibraryEntry) => {
    const res = await fetch(`/api/admin/materials/${updated.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    if (res.ok) {
      const saved: MaterialLibraryEntry = await res.json();
      setMaterials(prev => prev.map(m => m.id === saved.id ? saved : m));
    }
  }, []);

  // Live update card swatch/name while typing in editor
  const handlePreviewMaterial = useCallback((draft: MaterialLibraryEntry) => {
    setMaterials(prev => prev.map(m =>
      m.id === draft.id ? { ...m, ...draft } : m,
    ));
  }, []);

  const handleDuplicateMaterial = useCallback(async (mat: MaterialLibraryEntry) => {
    const { id: _id, created_at: _ca, ...rest } = mat;
    const res = await fetch("/api/admin/materials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...rest, name: `${mat.name} (copy)` }),
    });
    const newMat = await res.json();
    if (res.ok) {
      setMaterials(prev => [...prev, newMat]);
      setSelectedId(newMat.id);
      showToast("Duplicated");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDeleteMaterial = useCallback(async (id: string) => {
    await fetch(`/api/admin/materials/${id}`, { method: "DELETE" });
    setMaterials(prev => prev.filter(m => m.id !== id));
    setSelectedId(null);
    showToast("Deleted");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Thumbnail upload ──────────────────────────────────────────────────────
  async function handleThumbUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file     = e.target.files?.[0];
    e.target.value = "";
    const targetId = thumbTargetIdRef.current;
    if (!file || !targetId) return;
    setThumbUploadingId(targetId);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("slot", "mat_thumb");
    const res  = await fetch("/api/admin/texture-upload", { method: "POST", body: fd });
    const data = await res.json();
    if (res.ok && data.url) {
      await fetch(`/api/admin/materials/${targetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thumbnail_url: data.url }),
      });
      setMaterials(prev => prev.map(m =>
        m.id === targetId ? { ...m, thumbnail_url: data.url } : m,
      ));
    } else {
      showToast(`Thumbnail upload failed: ${data.error ?? "unknown error"}`);
    }
    setThumbUploadingId(null);
    thumbTargetIdRef.current = null;
  }

  async function handleThumbClearById(matId: string) {
    await fetch(`/api/admin/materials/${matId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thumbnail_url: null }),
    });
    setMaterials(prev => prev.map(m =>
      m.id === matId ? { ...m, thumbnail_url: null } : m,
    ));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function toggleCollapse(key: string) {
    setCollapsed(s => {
      const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n;
    });
  }

  function getFolderMats(folderId: string) {
    return filtered.filter(m =>
      (m as MaterialLibraryEntry & { folder_id?: string | null }).folder_id === folderId,
    );
  }

  const unfiled = filtered.filter(m =>
    !(m as MaterialLibraryEntry & { folder_id?: string | null }).folder_id,
  );

  // Inline "add material" form rendered inside each folder section
  function AddMatInline({ folderId }: { folderId: string }) {
    const isOpen = addMatFolderId === folderId;
    return isOpen ? (
      <div className="flex items-center gap-1.5 col-span-full">
        <input
          value={newMatName}
          onChange={e => setNewMatName(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") handleCreateMaterial(folderId === "__unfiled__" ? null : folderId);
            if (e.key === "Escape") { setAddMatFolderId(null); setNewMatName(""); }
          }}
          autoFocus
          placeholder="Material name"
          className="flex-1 bg-[#111] border border-blue-500/40 rounded-lg px-2.5 py-1.5 text-[10px] text-white/80 focus:outline-none"
        />
        <button
          onClick={() => handleCreateMaterial(folderId === "__unfiled__" ? null : folderId)}
          disabled={creatingMat || !newMatName.trim()}
          className="px-2.5 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] disabled:opacity-40 hover:bg-blue-500"
        >
          {creatingMat ? "…" : "Add"}
        </button>
        <button
          onClick={() => { setAddMatFolderId(null); setNewMatName(""); }}
          className="px-2 py-1.5 text-white/30 hover:text-white text-[10px]"
        >✕</button>
      </div>
    ) : (
      <button
        onClick={() => { setAddMatFolderId(folderId); setNewMatName(""); }}
        className="col-span-full flex items-center gap-1.5 text-white/25 hover:text-white/55 text-[10px] transition-colors py-1 w-fit"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Add material
      </button>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex overflow-hidden">

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-xs text-white backdrop-blur-md pointer-events-none">
          {toast}
        </div>
      )}

      {/* Lightbeans batch import modal */}
      {batchImportOpen && (
        <LightbeansBatchImport
          folders={folders}
          onClose={() => setBatchImportOpen(false)}
          onImported={(count) => {
            setBatchImportOpen(false);
            showToast(`Imported ${count} material${count !== 1 ? "s" : ""}`);
            fetch("/api/admin/materials").then(r => r.json()).then(mats => {
              setMaterials(Array.isArray(mats) ? mats : []);
            });
          }}
        />
      )}

      {/* Hidden file input for thumbnail uploads */}
      <input ref={thumbFileRef} type="file" accept="image/*" className="hidden" onChange={handleThumbUpload} />

      {/* ══════════════════════════════════════════════════════════════════════
          LEFT PANEL — Material editor
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="w-[280px] flex-shrink-0 border-r border-white/8 flex flex-col bg-[#0e0e0e]">
        {matForEditor && selectedMaterial ? (
          <>
            {/* Folder + thumbnail strip */}
            <div className="flex-shrink-0 px-2.5 py-2 border-b border-white/6 flex items-center gap-2 flex-wrap">
              {/* Folder selector */}
              <svg className="w-3.5 h-3.5 text-amber-400/40 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-3 1.146z" />
              </svg>
              <select
                value={selectedMaterial.folder_id ?? ""}
                onChange={e => handleMoveToFolder(selectedMaterial.id, e.target.value || null)}
                className="flex-1 min-w-0 bg-transparent border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white/55 focus:outline-none focus:border-blue-500/40"
              >
                <option value="">Unfiled</option>
                {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>

            {/* Thumbnail strip */}
            <div className="flex-shrink-0 px-2.5 py-1.5 border-b border-white/6 flex items-center gap-2">
              <span className="text-[9px] text-white/25 uppercase tracking-wider flex-shrink-0">Thumb</span>
              {selectedMaterial.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedMaterial.thumbnail_url}
                  alt=""
                  className="w-6 h-6 rounded object-cover border border-white/10 flex-shrink-0"
                />
              ) : (
                <span
                  className="w-6 h-6 rounded border border-white/10 flex-shrink-0"
                  style={{ backgroundColor: selectedMaterial.base_color }}
                />
              )}
              <button
                onClick={() => { thumbTargetIdRef.current = selectedMaterial.id; thumbFileRef.current?.click(); }}
                disabled={thumbUploadingId === selectedMaterial.id}
                className="text-[9px] px-2 py-0.5 bg-white/6 hover:bg-white/10 border border-white/8 text-white/40 hover:text-white rounded-lg transition-colors disabled:opacity-30"
              >
                {thumbUploadingId === selectedMaterial.id ? "…" : "Upload"}
              </button>
              {selectedMaterial.thumbnail_url && (
                <button
                  onClick={() => handleThumbClearById(selectedMaterial.id)}
                  className="text-[9px] text-white/20 hover:text-red-400 transition-colors ml-auto"
                  title="Remove thumbnail"
                >✕</button>
              )}
            </div>

            {/* Full MaterialEditor */}
            <div className="flex-1 overflow-hidden">
              <MaterialEditor
                key={matForEditor.id}
                material={matForEditor}
                onSave={handleSaveMaterial}
                onPreview={handlePreviewMaterial}
                onDuplicate={handleDuplicateMaterial}
                onDelete={handleDeleteMaterial}
                onClose={() => setSelectedId(null)}
                onToast={showToast}
                glbEmbeddedMaps={{}}
              />
            </div>
          </>
        ) : (
          <EditorEmptyState />
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          RIGHT PANEL — Grid explorer
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-hidden flex flex-col bg-[#0c0c0c]">

        {/* Toolbar */}
        <div className="flex-shrink-0 px-4 py-2.5 border-b border-white/6 flex items-center gap-2.5">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/20 pointer-events-none"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search materials…"
              className="w-full pl-8 pr-7 py-1.5 bg-white/5 border border-white/8 rounded-lg text-[11px] text-white/70 placeholder-white/20 focus:outline-none focus:border-blue-500/40"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/60 text-[10px]"
              >✕</button>
            )}
          </div>

          {/* New folder */}
          {addFolderOpen ? (
            <div className="flex items-center gap-1.5">
              <input
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") handleCreateFolder();
                  if (e.key === "Escape") { setAddFolderOpen(false); setNewFolderName(""); }
                }}
                autoFocus
                placeholder="Folder name"
                className="w-36 bg-[#111] border border-blue-500/40 rounded-lg px-2.5 py-1.5 text-[10px] text-white/80 focus:outline-none"
              />
              <button
                onClick={handleCreateFolder}
                disabled={creatingFolder || !newFolderName.trim()}
                className="px-2.5 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] disabled:opacity-40 hover:bg-blue-500"
              >
                {creatingFolder ? "…" : "Create"}
              </button>
              <button
                onClick={() => { setAddFolderOpen(false); setNewFolderName(""); }}
                className="px-2 py-1.5 text-white/30 hover:text-white text-[10px]"
              >✕</button>
            </div>
          ) : (
            <button
              onClick={() => setAddFolderOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-white/10 hover:border-white/20 text-white/40 hover:text-white/70 rounded-lg text-[10px] transition-colors flex-shrink-0"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m3-3H9m4.06-7.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
              </svg>
              New Folder
            </button>
          )}

          <div className="flex-1" />

          {/* Count */}
          {!loading && (
            <span className="text-[9px] text-white/20 flex-shrink-0">
              {materials.length} material{materials.length !== 1 ? "s" : ""}
              {search && filtered.length !== materials.length && ` · ${filtered.length} match${filtered.length !== 1 ? "es" : ""}`}
            </span>
          )}

          {/* Lightbeans batch import */}
          <button
            onClick={() => setBatchImportOpen(true)}
            className="flex items-center gap-1.5 text-[9px] px-2.5 py-1.5 border border-white/8 text-white/25 hover:text-white/55 hover:border-white/20 rounded-lg transition-colors flex-shrink-0"
            title="Batch import from Lightbeans"
          >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Lightbeans
          </button>

          {/* Seed */}
          <button
            onClick={async () => {
              if (!confirm("Seed ~40 Polyhaven CC0 materials? Existing names are skipped.")) return;
              const r = await fetch("/api/admin/seed-materials", { method: "POST" });
              const d = await r.json();
              if (r.ok) {
                showToast(`Seeded ${d.inserted} material${d.inserted !== 1 ? "s" : ""}`);
                const mats = await fetch("/api/admin/materials").then(x => x.json());
                setMaterials(Array.isArray(mats) ? mats : []);
              } else {
                showToast("Seed failed");
              }
            }}
            className="text-[9px] px-2.5 py-1.5 border border-white/8 text-white/25 hover:text-white/55 hover:border-white/20 rounded-lg transition-colors flex-shrink-0"
            title="Seed Polyhaven materials"
          >
            Seed Library
          </button>
        </div>

        {/* Scrollable grid content */}
        <div className="flex-1 overflow-y-auto px-4 py-4" style={{ scrollbarWidth: "none" }}>
          {loading ? (
            <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}>
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="rounded-xl overflow-hidden border border-white/6 animate-pulse">
                  <div className="aspect-square bg-white/5" />
                  <div className="px-2 py-1.5 bg-[#111] h-10" />
                </div>
              ))}
            </div>
          ) : materials.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-white/20 py-20">
              <svg className="w-12 h-12 mb-4 opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={0.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-white/25">No materials yet</p>
              <p className="text-[11px] mt-1 text-white/15">Create a folder and add your first material, or seed the Polyhaven library.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">

              {/* Named folders */}
              {folders.map(folder => {
                const mats        = getFolderMats(folder.id);
                const isCollapsed = collapsed.has(folder.id);
                // Don't show empty folders when searching
                if (search && mats.length === 0) return null;
                return (
                  <div key={folder.id}>
                    {/* Folder header */}
                    <div className="flex items-center gap-2 mb-3 group/fhdr">
                      <button
                        onClick={() => toggleCollapse(folder.id)}
                        className="flex items-center gap-2 flex-1 min-w-0 hover:opacity-80 transition-opacity"
                      >
                        <svg className="w-3.5 h-3.5 text-amber-400/50 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-3 1.146z" />
                        </svg>
                        {renameFolderId === folder.id ? (
                          <input
                            value={renameFolderVal}
                            onChange={e => setRenameFolderVal(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter") handleRenameFolder();
                              if (e.key === "Escape") setRenameFolderId(null);
                            }}
                            onClick={e => e.stopPropagation()}
                            autoFocus
                            className="bg-[#111] border border-blue-500/40 rounded px-1.5 py-0.5 text-xs text-white/80 focus:outline-none w-48"
                          />
                        ) : (
                          <span className="text-xs font-semibold text-white/60 truncate">{folder.name}</span>
                        )}
                        <span className="text-[9px] text-white/25 flex-shrink-0">{mats.length}</span>
                        <span className="text-white/20 text-[9px] flex-shrink-0">{isCollapsed ? "▸" : "▾"}</span>
                      </button>

                      {/* Folder actions */}
                      {renameFolderId === folder.id ? (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={handleRenameFolder}
                            className="text-[9px] px-1.5 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-500">✓</button>
                          <button onClick={() => setRenameFolderId(null)}
                            className="text-[9px] px-1 py-0.5 text-white/30 hover:text-white">✕</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover/fhdr:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setRenameFolderId(folder.id); setRenameFolderVal(folder.name); }}
                            className="p-1.5 text-white/20 hover:text-white/60 rounded-lg transition-colors"
                            title="Rename"
                          >
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteFolder(folder.id)}
                            className="p-1.5 text-white/20 hover:text-red-400 rounded-lg transition-colors"
                            title="Delete folder"
                          >
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>

                    {!isCollapsed && (
                      <div
                        className="grid gap-3"
                        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}
                      >
                        {mats.map(mat => (
                          <MaterialCard
                            key={mat.id}
                            mat={mat}
                            selected={selectedId === mat.id}
                            onSelect={() => setSelectedId(mat.id)}
                            onDuplicate={() => handleDuplicateMaterial(mat)}
                            onDelete={() => {
                              if (!confirm(`Delete "${mat.name}"?`)) return;
                              handleDeleteMaterial(mat.id);
                            }}
                            onUploadThumb={() => { thumbTargetIdRef.current = mat.id; thumbFileRef.current?.click(); }}
                            onClearThumb={() => handleThumbClearById(mat.id)}
                          />
                        ))}
                        <AddMatInline folderId={folder.id} />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Unfiled */}
              {(unfiled.length > 0 || !search) && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <button
                      onClick={() => toggleCollapse("__unfiled__")}
                      className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                    >
                      <svg className="w-3.5 h-3.5 text-white/15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-xs font-semibold text-white/30">Unfiled</span>
                      <span className="text-[9px] text-white/20">{unfiled.length}</span>
                      <span className="text-white/20 text-[9px]">{collapsed.has("__unfiled__") ? "▸" : "▾"}</span>
                    </button>
                  </div>

                  {!collapsed.has("__unfiled__") && (
                    <div
                      className="grid gap-3"
                      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}
                    >
                      {unfiled.map(mat => (
                        <MaterialCard
                          key={mat.id}
                          mat={mat}
                          selected={selectedId === mat.id}
                          onSelect={() => setSelectedId(mat.id)}
                          onDuplicate={() => handleDuplicateMaterial(mat)}
                          onDelete={() => {
                            if (!confirm(`Delete "${mat.name}"?`)) return;
                            handleDeleteMaterial(mat.id);
                          }}
                          onUploadThumb={() => { thumbTargetIdRef.current = mat.id; thumbFileRef.current?.click(); }}
                          onClearThumb={() => handleThumbClearById(mat.id)}
                        />
                      ))}
                      <AddMatInline folderId="__unfiled__" />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
