"use client";

import { useEffect, useRef, useState } from "react";
import type { MaterialLibraryEntry, MaterialProperties } from "@/types/database";
import { DEFAULT_MATERIAL_PROPS } from "@/lib/material-defaults";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAT_CATS = ["Exterior", "Walls", "Roofing", "Flooring", "Countertops", "Cabinetry", "Windows", "Other"];

const DEFAULT_PROPS = DEFAULT_MATERIAL_PROPS;

type Tab = "surface" | "maps" | "uv" | "physical";

// ─── Sub-components ───────────────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[9px] uppercase tracking-wider text-white/30">{label}</span>
      {children}
    </div>
  );
}

function Slider({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  unit?: string; onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between">
        <span className="text-[9px] text-white/35 uppercase tracking-wide">{label}</span>
        <span className="text-[9px] text-white/45 tabular-nums">{value.toFixed(step < 0.1 ? 3 : step < 1 ? 2 : 0)}{unit ?? ""}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1 rounded-full appearance-none bg-white/10 accent-blue-500 cursor-pointer" />
    </div>
  );
}

function MapInput({ label, slot, value, onChange, onToast }: {
  label: string; slot: string; value: string | null | undefined;
  onChange: (url: string | null) => void; onToast: (msg: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef  = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("slot", slot);
    const r = await fetch("/api/admin/texture-upload", { method: "POST", body: fd });
    const data = await r.json();
    if (r.ok) { onChange(data.url); onToast(`${label} uploaded`); }
    else onToast(`Upload failed: ${data.error}`);
    setUploading(false);
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[9px] text-white/35 uppercase tracking-wide">{label}</span>
        <div className="flex items-center gap-1">
          {value && (
            <button onClick={() => onChange(null)}
              className="text-[9px] text-white/20 hover:text-red-400 transition-colors px-1">
              ✕
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*,.hdr,.exr" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            title="Upload texture"
            className="text-[9px] px-1.5 py-0.5 bg-white/6 hover:bg-white/12 border border-white/8 text-white/40 hover:text-white rounded transition-colors disabled:opacity-30">
            {uploading ? "…" : "↑"}
          </button>
        </div>
      </div>
      <input
        ref={inputRef}
        type="text"
        value={value ?? ""}
        onChange={e => onChange(e.target.value || null)}
        placeholder="Paste URL or upload ↑"
        className="w-full px-2 py-1.5 text-[10px] bg-white/5 border border-white/8 rounded-lg text-white placeholder-white/15 focus:outline-none focus:border-blue-500/50 font-mono"
      />
      {value && (
        <div className="w-full h-10 rounded-lg overflow-hidden bg-white/5 border border-white/8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt={label} className="w-full h-full object-cover opacity-70" />
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface GlbEmbeddedMaps {
  hasMap?: boolean; hasNormalMap?: boolean; hasBumpMap?: boolean;
  hasRoughnessMap?: boolean; hasMetalnessMap?: boolean; hasAoMap?: boolean;
}

interface MaterialEditorProps {
  material: MaterialLibraryEntry;
  onSave: (updated: MaterialLibraryEntry) => Promise<void>;
  onDuplicate: (mat: MaterialLibraryEntry) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
  onPreview: (draft: MaterialLibraryEntry) => void;
  onToast: (msg: string) => void;
  onApplyToOption?: () => void;
  glbEmbeddedMaps?: GlbEmbeddedMaps;
}

export default function MaterialEditor({
  material, onSave, onDuplicate, onDelete, onClose, onPreview, onToast, onApplyToOption, glbEmbeddedMaps,
}: MaterialEditorProps) {
  const [draft,    setDraft]    = useState<MaterialLibraryEntry>({
    ...material,
    properties: { ...DEFAULT_PROPS, ...(material.properties ?? {}) },
  });
  const [tab,      setTab]      = useState<Tab>("surface");
  const [triScaleLocked, setTriScaleLocked] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "pending" | "saved">("idle");
  const [deleting, setDeleting] = useState(false);
  const [duping,   setDuping]   = useState(false);
  const saveTimer    = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingSave  = useRef<MaterialLibraryEntry | null>(null);
  const onSaveRef    = useRef(onSave);
  onSaveRef.current  = onSave;

  // Flush any pending debounced save when the editor unmounts so the name /
  // properties aren't lost when the user navigates away within the debounce window.
  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (pendingSave.current) onSaveRef.current(pendingSave.current).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function scheduleAutoSave(next: MaterialLibraryEntry) {
    pendingSave.current = next;
    setSaveState("pending");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      pendingSave.current = null;
      await onSaveRef.current(next);
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1500);
    }, 800);
  }

  function update(patch: Partial<MaterialLibraryEntry>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    onPreview(next);
    scheduleAutoSave(next);
  }

  function updateProp(patch: Partial<MaterialProperties>) {
    const next = { ...draft, properties: { ...DEFAULT_PROPS, ...(draft.properties ?? {}), ...patch } };
    setDraft(next);
    onPreview(next);
    scheduleAutoSave(next);
  }

  const p = draft.properties as Required<MaterialProperties>;

  const TABS: { id: Tab; label: string }[] = [
    { id: "surface",  label: "Surface"  },
    { id: "maps",     label: "Maps"     },
    { id: "uv",       label: "UV"       },
    { id: "physical", label: "Physical" },
  ];

  async function handleDuplicate() {
    setDuping(true);
    await onDuplicate(draft);
    setDuping(false);
  }

  async function handleDelete() {
    if (!confirm(`Delete "${draft.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    await onDelete(draft.id);
    setDeleting(false);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Header ── */}
      <div className="flex-shrink-0 px-3 py-2.5 border-b border-white/8">
        <div className="flex items-center gap-1.5 mb-2.5">
          <button onClick={onClose}
            className="text-white/30 hover:text-white transition-colors text-[10px] flex items-center gap-1">
            ← Library
          </button>
          <div className="flex-1" />
          <span className={`text-[9px] transition-all ${
            saveState === "pending" ? "text-white/25" : saveState === "saved" ? "text-green-400/70" : "opacity-0"
          }`}>
            {saveState === "pending" ? "saving…" : "✓ saved"}
          </span>
          <button onClick={handleDuplicate} disabled={duping}
            title="Duplicate material"
            className="text-[9px] px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/8 text-white/40 hover:text-white rounded-lg transition-colors disabled:opacity-30">
            {duping ? "…" : "⎘ Dup"}
          </button>
          <button onClick={handleDelete} disabled={deleting}
            title="Delete material"
            className="text-[9px] px-2 py-1 hover:bg-red-900/30 border border-transparent hover:border-red-800/40 text-white/25 hover:text-red-400 rounded-lg transition-colors disabled:opacity-30">
            {deleting ? "…" : "Delete"}
          </button>
        </div>

        {/* Name */}
        <input
          value={draft.name}
          onChange={e => update({ name: e.target.value })}
          className="w-full px-2.5 py-1.5 bg-white/7 border border-white/10 rounded-lg text-sm text-white font-medium focus:outline-none focus:border-blue-500/60 mb-2"
          placeholder="Material name"
        />
        {/* Category */}
        <select value={draft.category ?? "Other"} onChange={e => update({ category: e.target.value })}
          className="w-full px-2 py-1.5 bg-[#111] border border-white/10 rounded-lg text-xs text-white/60 focus:outline-none">
          {MAT_CATS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* ── Tabs ── */}
      <div className="flex border-b border-white/8 flex-shrink-0">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2 text-[9px] font-semibold uppercase tracking-wider transition-colors ${
              tab === t.id
                ? "text-blue-400 border-b border-blue-500"
                : "text-white/25 hover:text-white/50"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-4" style={{ scrollbarWidth: "none" }}>

        {/* ── Surface ── */}
        {tab === "surface" && (
          <>
            <Row label={p.albedoMapUrl ? "Diffuse Color (tint over map)" : "Diffuse Color"}>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg border border-white/15 flex-shrink-0 overflow-hidden">
                  <input type="color" value={draft.base_color}
                    onChange={e => update({ base_color: e.target.value })}
                    className="w-10 h-10 -m-1 cursor-pointer border-0 bg-transparent" />
                </div>
                <input value={draft.base_color} onChange={e => update({ base_color: e.target.value })}
                  className="flex-1 px-2 py-1.5 bg-white/5 border border-white/8 rounded-lg text-[10px] text-white font-mono uppercase focus:outline-none focus:border-blue-500/50"
                  placeholder="#ffffff" maxLength={7} />
              </div>
              {/* When an albedo map is present, color multiplies over it — show tint toggle */}
              {p.albedoMapUrl && (
                <label className="flex items-center gap-2 mt-1 cursor-pointer">
                  <button onClick={() => updateProp({ colorTint: !p.colorTint })}
                    className={`w-7 h-4 rounded-full relative transition-colors ${p.colorTint ? "bg-blue-600" : "bg-white/15"}`}>
                    <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${p.colorTint ? "left-[14px]" : "left-0.5"}`} />
                  </button>
                  <span className="text-[9px] text-white/40">
                    {p.colorTint ? "Color tint ON — color multiplies map" : "Color tint OFF — map shows pure"}
                  </span>
                </label>
              )}
            </Row>

            <Slider label="Roughness" value={draft.roughness} min={0} max={1} step={0.01}
              onChange={v => update({ roughness: v })} />

            <Slider label="Metalness" value={draft.metalness} min={0} max={1} step={0.01}
              onChange={v => update({ metalness: v })} />

            <div className="border-t border-white/8 pt-3">
              <Slider label="Opacity" value={p.opacity} min={0} max={1} step={0.01}
                onChange={v => updateProp({ opacity: v })} />
            </div>

            <Row label="Emissive">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded border border-white/15 overflow-hidden flex-shrink-0">
                  <input type="color" value={p.emissiveColor || "#000000"}
                    onChange={e => updateProp({ emissiveColor: e.target.value })}
                    className="w-9 h-9 -m-1 cursor-pointer border-0 bg-transparent" />
                </div>
                <div className="flex-1">
                  <Slider label="Intensity" value={p.emissiveIntensity} min={0} max={5} step={0.05}
                    onChange={v => updateProp({ emissiveIntensity: v })} />
                </div>
              </div>
            </Row>
          </>
        )}

        {/* ── Maps ── */}
        {tab === "maps" && (
          <>
            {/* GLB embedded texture info banner */}
            {glbEmbeddedMaps && Object.values(glbEmbeddedMaps).some(Boolean) && (
              <div className="px-2.5 py-2 bg-amber-500/8 border border-amber-500/20 rounded-lg mb-1">
                <p className="text-[9px] text-amber-400/80 font-medium mb-1">Embedded from GLB model</p>
                <div className="flex flex-wrap gap-1">
                  {glbEmbeddedMaps.hasMap         && <span className="text-[8px] bg-amber-500/15 text-amber-300/70 px-1.5 py-0.5 rounded">Albedo</span>}
                  {glbEmbeddedMaps.hasNormalMap    && <span className="text-[8px] bg-amber-500/15 text-amber-300/70 px-1.5 py-0.5 rounded">Normal</span>}
                  {glbEmbeddedMaps.hasBumpMap      && <span className="text-[8px] bg-amber-500/15 text-amber-300/70 px-1.5 py-0.5 rounded">Bump</span>}
                  {glbEmbeddedMaps.hasRoughnessMap && <span className="text-[8px] bg-amber-500/15 text-amber-300/70 px-1.5 py-0.5 rounded">Roughness</span>}
                  {glbEmbeddedMaps.hasMetalnessMap && <span className="text-[8px] bg-amber-500/15 text-amber-300/70 px-1.5 py-0.5 rounded">Metalness</span>}
                  {glbEmbeddedMaps.hasAoMap        && <span className="text-[8px] bg-amber-500/15 text-amber-300/70 px-1.5 py-0.5 rounded">AO</span>}
                </div>
                <p className="text-[8px] text-white/25 mt-1">Paste a URL below to override any slot.</p>
              </div>
            )}

            <MapInput label="Albedo / Diffuse" slot="albedo" value={p.albedoMapUrl} onToast={onToast}
              onChange={v => updateProp({ albedoMapUrl: v })} />

            {p.albedoMapUrl && (
              <Slider label="Albedo Brightness" value={p.albedoBrightness ?? 1} min={0} max={4} step={0.01}
                onChange={v => updateProp({ albedoBrightness: v })} />
            )}

            <div className="flex flex-col gap-2">
              <MapInput label="Normal Map" slot="normal" value={p.normalMapUrl} onToast={onToast}
                onChange={v => updateProp({ normalMapUrl: v })} />
              {p.normalMapUrl && (
                <Slider label="Normal Intensity" value={p.normalScale} min={0} max={20} step={0.1}
                  onChange={v => updateProp({ normalScale: v })} />
              )}
            </div>

            <div className="flex flex-col gap-2">
              <MapInput label="Bump Map" slot="bump" value={p.bumpMapUrl} onToast={onToast}
                onChange={v => updateProp({ bumpMapUrl: v })} />
              {p.bumpMapUrl && (
                <Slider label="Bump Height" value={p.bumpScale} min={0} max={20} step={0.1}
                  onChange={v => updateProp({ bumpScale: v })} />
              )}
            </div>

            <MapInput label="Roughness Map" slot="roughness" value={p.roughnessMapUrl} onToast={onToast}
              onChange={v => updateProp({ roughnessMapUrl: v })} />

            <MapInput label="Metalness Map" slot="metalness" value={p.metalnessMapUrl} onToast={onToast}
              onChange={v => updateProp({ metalnessMapUrl: v })} />

            <div className="flex flex-col gap-2">
              <MapInput label="AO Map" slot="ao" value={p.aoMapUrl} onToast={onToast}
                onChange={v => updateProp({ aoMapUrl: v })} />
              {p.aoMapUrl && (
                <Slider label="AO Intensity" value={p.aoIntensity} min={0} max={2} step={0.05}
                  onChange={v => updateProp({ aoIntensity: v })} />
              )}
            </div>

            <div className="flex flex-col gap-2">
              <MapInput label="Displacement Map" slot="displacement" value={p.displacementMapUrl} onToast={onToast}
                onChange={v => updateProp({ displacementMapUrl: v })} />
              {p.displacementMapUrl && (
                <Slider label="Displacement Scale" value={p.displacementScale} min={0} max={1} step={0.01}
                  onChange={v => updateProp({ displacementScale: v })} />
              )}
            </div>
          </>
        )}

        {/* ── UV ── */}
        {tab === "uv" && (
          <>
            {/* Projection type selector */}
            <Row label="Projection">
              <div className="grid grid-cols-2 gap-1">
                {([
                  { id: "uv",           label: "Mesh UV"      },
                  { id: "triplanar",    label: "Triplanar"    },
                  { id: "planar-top",   label: "Planar Top"   },
                  { id: "planar-front", label: "Planar Front" },
                  { id: "planar-side",  label: "Planar Side"  },
                ] as const).map(opt => (
                  <button key={opt.id} onClick={() => updateProp({ uvProjection: opt.id })}
                    className={`py-1.5 px-2 rounded-lg text-[9px] font-medium transition-colors border ${
                      p.uvProjection === opt.id
                        ? "bg-blue-600/30 border-blue-500/60 text-blue-300"
                        : "bg-white/4 border-white/8 text-white/35 hover:text-white/60 hover:bg-white/8"
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              {p.uvProjection !== "uv" && (
                <p className="text-[8px] text-white/20 mt-1">
                  World-space projection — ignores mesh UVs, uses object geometry.
                </p>
              )}
            </Row>

            {/* World-space projection: scale controls */}
            {p.uvProjection !== "uv" ? (
              <div className="flex flex-col gap-3">
                {p.uvProjection === "triplanar" ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] uppercase tracking-wider text-white/30">Scale per axis</span>
                      <button
                        onClick={() => setTriScaleLocked(v => !v)}
                        title={triScaleLocked ? "Unlock axes" : "Lock axes (uniform)"}
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] transition-colors border ${
                          triScaleLocked
                            ? "bg-blue-600/25 border-blue-500/50 text-blue-300"
                            : "bg-white/5 border-white/10 text-white/30 hover:text-white/60"
                        }`}
                      >
                        {triScaleLocked ? (
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1C9.24 1 7 3.24 7 6v1H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2V6c0-2.76-2.24-5-5-5zm0 2c1.66 0 3 1.34 3 3v1H9V6c0-1.66 1.34-3 3-3zm0 9a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"/></svg>
                        ) : (
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M18 1c-2.76 0-5 2.24-5 5v1H5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2h2V6c0-2.76-2.24-5-5-5zm-6 11a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"/></svg>
                        )}
                        {triScaleLocked ? "Locked" : "Lock"}
                      </button>
                    </div>
                    <Slider label="Scale X" value={p.uvScaleX ?? p.uvScale ?? 1} min={0.05} max={10} step={0.05}
                      onChange={v => updateProp(triScaleLocked ? { uvScaleX: v, uvScaleY: v, uvScaleZ: v } : { uvScaleX: v })} />
                    <Slider label="Scale Y" value={p.uvScaleY ?? p.uvScale ?? 1} min={0.05} max={10} step={0.05}
                      onChange={v => updateProp(triScaleLocked ? { uvScaleX: v, uvScaleY: v, uvScaleZ: v } : { uvScaleY: v })} />
                    <Slider label="Scale Z" value={p.uvScaleZ ?? p.uvScale ?? 1} min={0.05} max={10} step={0.05}
                      onChange={v => updateProp(triScaleLocked ? { uvScaleX: v, uvScaleY: v, uvScaleZ: v } : { uvScaleZ: v })} />
                    <button
                      onClick={() => updateProp({ uvScaleX: 1, uvScaleY: 1, uvScaleZ: 1 })}
                      className="text-[9px] text-white/20 hover:text-white/50 transition-colors self-start px-1">
                      ↺ Reset
                    </button>

                    {/* Position */}
                    <span className="text-[9px] uppercase tracking-wider text-white/30 mt-1">Position</span>
                    <Slider label="Offset X" value={p.uvTriOffsetX ?? 0} min={-5} max={5} step={0.01}
                      onChange={v => updateProp({ uvTriOffsetX: v })} />
                    <Slider label="Offset Y" value={p.uvTriOffsetY ?? 0} min={-5} max={5} step={0.01}
                      onChange={v => updateProp({ uvTriOffsetY: v })} />
                    <Slider label="Offset Z" value={p.uvTriOffsetZ ?? 0} min={-5} max={5} step={0.01}
                      onChange={v => updateProp({ uvTriOffsetZ: v })} />
                    <button
                      onClick={() => updateProp({ uvTriOffsetX: 0, uvTriOffsetY: 0, uvTriOffsetZ: 0 })}
                      className="text-[9px] text-white/20 hover:text-white/50 transition-colors self-start px-1">
                      ↺ Reset
                    </button>

                    {/* Rotation */}
                    <span className="text-[9px] uppercase tracking-wider text-white/30 mt-1">Rotation</span>
                    <Slider label="Rotation" value={p.uvTriRotation ?? 0} min={0} max={360} step={1} unit="°"
                      onChange={v => updateProp({ uvTriRotation: v })} />
                    <button
                      onClick={() => updateProp({ uvTriRotation: 0 })}
                      className="text-[9px] text-white/20 hover:text-white/50 transition-colors self-start px-1">
                      ↺ Reset
                    </button>
                  </>
                ) : (
                  <>
                    <Slider label="Scale (m⁻¹)" value={p.uvScale} min={0.05} max={10} step={0.05}
                      onChange={v => updateProp({ uvScale: v })} />
                    <button
                      onClick={() => updateProp({ uvScale: 1 })}
                      className="text-[9px] text-white/20 hover:text-white/50 transition-colors self-start px-1">
                      ↺ Reset Scale
                    </button>
                  </>
                )}
                <p className="text-[8px] text-white/20">
                  Higher = smaller texture tiles. Lower = larger tiles.
                </p>
              </div>
            ) : (
              /* Mesh UV: Scale / Tile / Offset / Rotation */
              <>
                <div className="flex flex-col gap-3">
                  <p className="text-[9px] text-white/40 uppercase tracking-wider">Scale</p>
                  <Slider label="Uniform Scale" value={Math.round((2 / (p.uvRepeatX + p.uvRepeatY)) * 100) / 100} min={0.05} max={10} step={0.05}
                    onChange={v => { const r = Math.round((1 / v) * 100) / 100; updateProp({ uvRepeatX: r, uvRepeatY: r }); }} />
                </div>

                <div className="flex flex-col gap-3">
                  <p className="text-[9px] text-white/40 uppercase tracking-wider">Tiling</p>
                  <Slider label="Repeat X" value={p.uvRepeatX} min={0.1} max={20} step={0.1}
                    onChange={v => updateProp({ uvRepeatX: v })} />
                  <Slider label="Repeat Y" value={p.uvRepeatY} min={0.1} max={20} step={0.1}
                    onChange={v => updateProp({ uvRepeatY: v })} />
                  <button onClick={() => updateProp({ uvRepeatY: p.uvRepeatX })}
                    className="text-[9px] text-white/25 hover:text-white/50 transition-colors self-start px-1">
                    Lock X→Y
                  </button>
                </div>

                <div className="flex flex-col gap-3">
                  <p className="text-[9px] text-white/40 uppercase tracking-wider">Offset</p>
                  <Slider label="Offset X" value={p.uvOffsetX} min={-2} max={2} step={0.01}
                    onChange={v => updateProp({ uvOffsetX: v })} />
                  <Slider label="Offset Y" value={p.uvOffsetY} min={-2} max={2} step={0.01}
                    onChange={v => updateProp({ uvOffsetY: v })} />
                </div>

                <Slider label="Rotation" value={p.uvRotation} min={0} max={360} step={1} unit="°"
                  onChange={v => updateProp({ uvRotation: v })} />

                <button
                  onClick={() => updateProp({ uvRepeatX: 1, uvRepeatY: 1, uvOffsetX: 0, uvOffsetY: 0, uvRotation: 0 })}
                  className="text-[9px] text-white/20 hover:text-white/50 transition-colors self-start px-1">
                  ↺ Reset UV
                </button>
              </>
            )}
          </>
        )}

        {/* ── Physical ── */}
        {tab === "physical" && (
          <>
            <div className="flex flex-col gap-3">
              <p className="text-[9px] text-white/40 uppercase tracking-wider">Refraction</p>
              <Slider label="IOR (Index of Refraction)" value={p.ior} min={1.0} max={2.5} step={0.01}
                onChange={v => updateProp({ ior: v })} />
              <Slider label="Transmission (Glass)" value={p.transmission} min={0} max={1} step={0.01}
                onChange={v => updateProp({ transmission: v })} />
              {p.transmission > 0 && (
                <p className="text-[8px] text-white/20">
                  Tip: set opacity = 1 for physically correct glass. Transmission handles the transparency.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <p className="text-[9px] text-white/40 uppercase tracking-wider">Clearcoat</p>
              <Slider label="Clearcoat" value={p.clearcoat} min={0} max={1} step={0.01}
                onChange={v => updateProp({ clearcoat: v })} />
              {p.clearcoat > 0 && (
                <Slider label="Clearcoat Roughness" value={p.clearcoatRoughness} min={0} max={1} step={0.01}
                  onChange={v => updateProp({ clearcoatRoughness: v })} />
              )}
            </div>

            {/* Common presets */}
            <div className="flex flex-col gap-2">
              <p className="text-[9px] text-white/40 uppercase tracking-wider">Quick Presets</p>
              {[
                { label: "Glass",      patch: { transmission: 1, ior: 1.52, roughness: 0, opacity: 1 } },
                { label: "Car Paint",  patch: { clearcoat: 1, clearcoatRoughness: 0.1, roughness: 0.35, metalness: 0 } },
                { label: "Polished Metal", patch: { metalness: 1, roughness: 0.05, clearcoat: 0 } },
                { label: "Matte",      patch: { roughness: 0.95, metalness: 0, clearcoat: 0, transmission: 0 } },
              ].map(({ label, patch }) => (
                <button key={label} onClick={() => {
                  const physPatch: Partial<MaterialProperties> = {};
                  const basePatch: Partial<MaterialLibraryEntry> = {};
                  for (const [k, v] of Object.entries(patch)) {
                    if (k === "roughness" || k === "metalness") (basePatch as any)[k] = v;
                    else (physPatch as any)[k] = v;
                  }
                  const next = {
                    ...draft,
                    ...basePatch,
                    properties: { ...DEFAULT_PROPS, ...(draft.properties ?? {}), ...physPatch },
                  };
                  setDraft(next); onPreview(next); scheduleAutoSave(next);
                }}
                  className="w-full text-left px-2.5 py-1.5 bg-white/4 hover:bg-white/8 border border-white/6 rounded-lg text-[10px] text-white/50 hover:text-white transition-colors">
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Apply to Option ── */}
      {onApplyToOption && (
        <div className="flex-shrink-0 px-3 py-3 border-t border-white/8">
          <button onClick={onApplyToOption}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-colors">
            Apply to Option
          </button>
        </div>
      )}
    </div>
  );
}
