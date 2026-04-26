"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MaterialFolder, MaterialProperties } from "@/types/database";

// ── Filename parser ───────────────────────────────────────────────────────────

type TexSlot = "albedo" | "roughness" | "glossiness" | "normal" | "displacement" | "thumbnail";

const SLOT_PATTERNS: [RegExp, TexSlot | "skip"][] = [
  [/DIFFUSE/i,              "albedo"],
  [/ROUGHNESS/i,            "roughness"],
  [/GLOSSINESS/i,           "glossiness"],
  [/NORMALS?\d*_OPENGL/i,   "normal"],
  [/NORMALS?\d*_DIRECTX/i,  "skip"],   // DirectX flips Y — incompatible with Three.js
  [/NORMALS?\d+(?!_)/i,     "normal"],  // e.g. NORMALS8 with no suffix
  [/DISPLACEMENT\d*/i,      "displacement"],
  [/REFLECTION/i,           "skip"],   // specular workflow only, no PBR slot
  [/sphere[_-]?preview/i,   "thumbnail"],
  [/plane[_-]?preview/i,    "skip"],
];

function classifyFile(filename: string): TexSlot | "skip" {
  const stem = filename.replace(/\.[^.]+$/, "");
  for (const [re, slot] of SLOT_PATTERNS) {
    if (re.test(stem)) return slot;
  }
  return "skip";
}

function getMaterialKey(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/-\d{3}-.+$/, "")                       // strip -001-DIFFUSE-4K etc.
    .replace(/-(?:sphere|plane)[_-]?preview.*/i, ""); // strip -sphere-preview-01 etc.
}

function buildMaterialName(key: string): string {
  return key;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ParsedMaterial {
  key:           string;
  name:          string;
  files:         Partial<Record<TexSlot, File>>;
  skippedLabels: string[];
  thumbUrl:      string | null;
  duplicate:     boolean;
}

function parseFiles(fileList: File[], existingNames: Set<string>): ParsedMaterial[] {
  const groups = new Map<string, ParsedMaterial>();

  for (const file of fileList) {
    const key  = getMaterialKey(file.name);
    const slot = classifyFile(file.name);

    if (!groups.has(key)) {
      const name = buildMaterialName(key);
      groups.set(key, { key, name, files: {}, skippedLabels: [], thumbUrl: null, duplicate: existingNames.has(name) });
    }
    const g = groups.get(key)!;

    if (slot === "skip") {
      if (/DIRECTX/i.test(file.name))   g.skippedLabels.push("DirectX normal (needs OpenGL)");
      else if (/REFLECTION/i.test(file.name)) g.skippedLabels.push("Reflection map");
      // plane-preview silently skipped
    } else if (slot === "thumbnail") {
      g.files.thumbnail = file;
      g.thumbUrl = URL.createObjectURL(file);
    } else {
      // Roughness beats glossiness if both present
      if (slot === "glossiness" && g.files.roughness) continue;
      if (slot === "roughness" && g.files.glossiness) delete g.files.glossiness;
      g.files[slot] = file;
    }
  }

  return Array.from(groups.values()).filter(g =>
    Object.keys(g.files).some(s => s !== "thumbnail"),
  );
}

// ── Upload helpers ────────────────────────────────────────────────────────────

const SLOT_TO_PROP: Record<Exclude<TexSlot, "thumbnail">, keyof MaterialProperties> = {
  albedo:       "albedoMapUrl",
  roughness:    "roughnessMapUrl",
  glossiness:   "glossinessMapUrl",
  normal:       "normalMapUrl",
  displacement: "displacementMapUrl",
};

async function uploadTex(file: File, slotLabel: string): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("slot", slotLabel);
  const res  = await fetch("/api/admin/texture-upload", { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Upload failed");
  return data.url as string;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  folders:    MaterialFolder[];
  onClose:    () => void;
  onImported: (count: number) => void;
}

type Step = "drop" | "preview" | "importing" | "done";

const SLOT_LABELS: Record<Exclude<TexSlot, "thumbnail">, string> = {
  albedo:       "Albedo",
  roughness:    "Roughness",
  glossiness:   "Glossiness",
  normal:       "Normal",
  displacement: "Displacement",
};

const SLOT_COLORS: Record<Exclude<TexSlot, "thumbnail">, string> = {
  albedo:       "bg-amber-500/12 border-amber-500/25 text-amber-300/70",
  roughness:    "bg-slate-500/12 border-slate-500/25 text-slate-300/60",
  glossiness:   "bg-purple-500/12 border-purple-500/25 text-purple-300/60",
  normal:       "bg-blue-500/12 border-blue-500/25 text-blue-300/70",
  displacement: "bg-emerald-500/12 border-emerald-500/25 text-emerald-300/60",
};

export default function LightbeansBatchImport({ folders, onClose, onImported }: Props) {
  const [step,          setStep]          = useState<Step>("drop");
  const [materials,     setMaterials]     = useState<ParsedMaterial[]>([]);
  const [folderId,      setFolderId]      = useState<string>("");
  const [progress,      setProgress]      = useState({ done: 0, total: 0, current: "" });
  const [errors,        setErrors]        = useState<string[]>([]);
  const [dragging,      setDragging]      = useState(false);
  const [existingNames, setExistingNames] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-select the Lightbeans folder
  useEffect(() => {
    const lb = folders.find(f => f.name === "Lightbeans.com Materials");
    if (lb) setFolderId(lb.id);
  }, [folders]);

  // Fetch existing material names once on mount for duplicate detection
  useEffect(() => {
    fetch("/api/admin/materials")
      .then(r => r.json())
      .then((mats: { name: string }[]) => {
        if (Array.isArray(mats)) setExistingNames(new Set(mats.map(m => m.name)));
      })
      .catch(() => {});
  }, []);

  // Revoke Object URLs on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      materials.forEach(m => { if (m.thumbUrl) URL.revokeObjectURL(m.thumbUrl); });
    };
  }, [materials]);

  const handleFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => /\.(png|jpg|jpeg|webp|tif|tiff)$/i.test(f.name));
    if (!arr.length) return;
    const parsed = parseFiles(arr, existingNames);
    setMaterials(parsed);
    setStep("preview");
  }, [existingNames]);

  async function handleImport() {
    setStep("importing");
    const errs: string[] = [];
    let imported = 0;
    const toImport = materials.filter(m => !m.duplicate);
    setProgress({ done: 0, total: toImport.length, current: "" });

    // Ensure Lightbeans folder exists
    let resolvedFolderId = folderId;
    if (!resolvedFolderId) {
      const res = await fetch("/api/admin/materials/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Lightbeans.com Materials", sort_order: 999 }),
      });
      if (res.ok) {
        const folder = await res.json();
        resolvedFolderId = folder.id;
        setFolderId(folder.id);
      }
    }

    for (let i = 0; i < toImport.length; i++) {
      const m = toImport[i];
      setProgress({ done: i, total: toImport.length, current: m.name });

      try {
        const properties: Partial<MaterialProperties> = {};
        let thumbnail_url: string | null = null;
        let normal_map_url: string | null = null;

        for (const [rawSlot, file] of Object.entries(m.files) as [TexSlot, File][]) {
          if (rawSlot === "thumbnail") {
            thumbnail_url = await uploadTex(file, "mat_thumb");
          } else {
            const url = await uploadTex(file, rawSlot);
            (properties as Record<string, string>)[SLOT_TO_PROP[rawSlot]] = url;
            if (rawSlot === "normal") normal_map_url = url;
          }
        }

        const res = await fetch("/api/admin/materials", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name:          m.name,
            base_color:    "#8b8b8b",
            roughness:     0.5,
            metalness:     0.0,
            folder_id:     resolvedFolderId || null,
            thumbnail_url,
            normal_map_url,
            properties,
          }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error ?? "Create failed");
        }
        imported++;
      } catch (err) {
        errs.push(`${m.name}: ${err instanceof Error ? err.message : "Failed"}`);
      }
    }

    setErrors(errs);
    setProgress(p => ({ ...p, done: toImport.length, current: "" }));
    setStep("done");
    onImported(imported);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[85vh] bg-[#0e0e0e] border border-white/10 rounded-2xl flex flex-col shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex-shrink-0 px-5 py-4 border-b border-white/8 flex items-center gap-3">
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-white/80">Lightbeans Batch Import</h2>
            <p className="text-[10px] text-white/30 mt-0.5">
              Drop all files from one or more downloaded materials — maps are auto-assigned by filename
            </p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 text-xl leading-none">×</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5" style={{ scrollbarWidth: "none" }}>

          {/* ── Drop zone ── */}
          {step === "drop" && (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-colors ${
                dragging ? "border-blue-500/60 bg-blue-500/5" : "border-white/12 hover:border-white/22"
              }`}
            >
              <svg className="w-10 h-10 text-white/15 mx-auto mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm text-white/40 mb-1">Drop texture files here</p>
              <p className="text-[10px] text-white/20">
                Select all files for one or more materials at once — DIFFUSE, ROUGHNESS, NORMALS8_OPENGL, etc.
              </p>
              <input
                ref={fileInputRef}
                type="file" multiple accept="image/*"
                className="hidden"
                onChange={e => e.target.files && handleFiles(e.target.files)}
              />
            </div>
          )}

          {/* ── Preview ── */}
          {step === "preview" && (
            <>
              <div className="flex items-center gap-3 mb-4 flex-wrap">
                <span className="text-xs text-white/50">
                  {materials.length} material{materials.length !== 1 ? "s" : ""} detected
                </span>
                <div className="flex-1" />
                <label className="flex items-center gap-2 text-[10px] text-white/35">
                  <svg className="w-3 h-3 text-amber-400/40" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a2.25 2.25 0 011.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 013 3v1.146A4.483 4.483 0 0019.5 9h-15a4.483 4.483 0 00-3 1.146z" />
                  </svg>
                  Folder
                  <select
                    value={folderId}
                    onChange={e => setFolderId(e.target.value)}
                    className="bg-[#111] border border-white/10 rounded-lg px-2 py-1 text-[10px] text-white/55 focus:outline-none"
                  >
                    <option value="">Unfiled</option>
                    {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </label>
              </div>

              <div className="flex flex-col gap-2">
                {materials.map(m => (
                  <div key={m.key} className={`flex items-start gap-3 border rounded-xl px-3 py-3 ${
                    m.duplicate ? "bg-white/1 border-white/5 opacity-50" : "bg-white/3 border-white/7"
                  }`}>
                    {/* Sphere preview thumbnail */}
                    {m.thumbUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.thumbUrl} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-white/10" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-white/5 border border-white/8 flex-shrink-0" />
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <p className={`text-[11px] font-medium truncate ${m.duplicate ? "text-white/35 line-through" : "text-white/70"}`}>{m.name}</p>
                        {m.duplicate && (
                          <span className="flex-shrink-0 text-[8px] px-1.5 py-0.5 border rounded bg-amber-500/8 border-amber-500/20 text-amber-400/50">
                            already exists
                          </span>
                        )}
                      </div>
                      {!m.duplicate && (
                        <div className="flex flex-wrap gap-1">
                          {(Object.entries(m.files) as [TexSlot, File][])
                            .filter(([slot]) => slot !== "thumbnail")
                            .map(([slot]) => (
                              <span key={slot} className={`text-[8px] px-1.5 py-0.5 border rounded font-medium ${SLOT_COLORS[slot as keyof typeof SLOT_COLORS]}`}>
                                {SLOT_LABELS[slot as keyof typeof SLOT_LABELS]}
                              </span>
                            ))
                          }
                          {m.files.thumbnail && (
                            <span className="text-[8px] px-1.5 py-0.5 border rounded bg-white/5 border-white/10 text-white/30">
                              Thumbnail
                            </span>
                          )}
                          {m.skippedLabels.map(label => (
                            <span key={label} className="text-[8px] px-1.5 py-0.5 border rounded bg-white/3 border-white/6 text-white/20 line-through">
                              {label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Convention notes */}
              <div className="mt-4 px-3 py-2.5 bg-white/3 border border-white/6 rounded-xl">
                <p className="text-[9px] text-white/30 font-medium mb-1">Auto-assignment notes</p>
                <ul className="space-y-0.5 text-[9px] text-white/20">
                  <li>· NORMALS8_DIRECTX skipped — Three.js uses OpenGL convention (NORMALS8_OPENGL)</li>
                  <li>· REFLECTION skipped — specular workflow only, no metallic/roughness equivalent</li>
                  <li>· When both ROUGHNESS and GLOSSINESS exist, ROUGHNESS takes priority</li>
                  <li>· Sphere previews used as material thumbnails</li>
                </ul>
              </div>
            </>
          )}

          {/* ── Importing ── */}
          {step === "importing" && (
            <div className="py-10 text-center">
              <div className="w-full bg-white/5 rounded-full h-0.5 mb-5 overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                />
              </div>
              <p className="text-xs text-white/50 mb-1">{progress.current || "Starting…"}</p>
              <p className="text-[10px] text-white/25">{progress.done} / {progress.total} materials</p>
            </div>
          )}

          {/* ── Done ── */}
          {step === "done" && (
            <div className="py-10 text-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-4 ${
                errors.length === 0 ? "bg-emerald-500/15" : "bg-amber-500/15"
              }`}>
                {errors.length === 0 ? (
                  <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                )}
              </div>
              <p className="text-sm text-white/70 mb-1">
                {materials.filter(m => !m.duplicate).length - errors.length} of {materials.filter(m => !m.duplicate).length} imported
                {materials.some(m => m.duplicate) && (
                  <span className="text-white/30 text-xs ml-2">· {materials.filter(m => m.duplicate).length} skipped (already exist)</span>
                )}
              </p>
              {errors.length > 0 && (
                <div className="mt-3 text-left max-w-md mx-auto space-y-1">
                  {errors.map((e, i) => (
                    <p key={i} className="text-[9px] text-red-400/60">{e}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-5 py-3 border-t border-white/8 flex items-center justify-end gap-2.5">
          {step === "done" ? (
            <button onClick={onClose}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs transition-colors">
              Done
            </button>
          ) : step === "preview" ? (
            <>
              <button onClick={() => setStep("drop")}
                className="px-3 py-2 text-white/30 hover:text-white text-xs transition-colors">
                ← Back
              </button>
              <button onClick={handleImport}
                disabled={materials.every(m => m.duplicate)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {(() => {
                  const count = materials.filter(m => !m.duplicate).length;
                  const skipped = materials.length - count;
                  return `Import ${count} material${count !== 1 ? "s" : ""}${skipped ? ` · ${skipped} skipped` : ""}`;
                })()}
              </button>
            </>
          ) : step !== "importing" ? (
            <button onClick={onClose}
              className="px-3 py-2 text-white/30 hover:text-white text-xs transition-colors">
              Cancel
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
