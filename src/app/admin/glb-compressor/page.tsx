"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { ModelInfo, NodeEntry } from "@/components/admin/GlbCompressorViewer";

// Dynamic import — Three.js must not run on the server
const GlbViewer = dynamic(
  () => import("@/components/admin/GlbCompressorViewer"),
  { ssr: false, loading: () => <ViewerPlaceholder text="Initializing viewer…" /> }
);

// ── Types ─────────────────────────────────────────────────────────────────────

interface CompressResult {
  blob:     Blob;
  filename: string;
  origSize: number;
  compSize: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBytes(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} MB`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)} KB`;
  return `${n} B`;
}

function SliderRow({
  label, id, value, onChange,
}: { label: string; id: string; value: number; onChange: (v: number) => void }) {
  const pct = ((value - 1) / 15) * 100;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center">
        <label htmlFor={id} className="text-[10px] font-semibold tracking-widest uppercase text-white/40">
          {label}
        </label>
        <span className="text-[11px] font-mono text-blue-400">{value}</span>
      </div>
      <input
        id={id} type="range" min={1} max={16} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-0.5 rounded cursor-pointer accent-blue-500"
        style={{
          background: `linear-gradient(to right, rgb(59,130,246) ${pct}%, rgba(255,255,255,0.12) ${pct}%)`,
        }}
      />
    </div>
  );
}

function ViewerPlaceholder({ text }: { text: string }) {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <p className="text-xs text-white/25">{text}</p>
    </div>
  );
}

function DropZone({ onFile }: { onFile: (f: File) => void }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(list: FileList | null) {
    const f = list?.[0];
    if (!f) return;
    if (!f.name.match(/\.glb$/i)) { alert("Please select a .glb file."); return; }
    onFile(f);
  }

  return (
    <div
      className={[
        "absolute inset-0 flex flex-col items-center justify-center gap-4 z-10 transition-colors",
        dragging ? "bg-blue-600/10" : "bg-[#0d0d0d]",
      ].join(" ")}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
      onClick={() => inputRef.current?.click()}
    >
      {/* Dashed border ring */}
      <div className={[
        "absolute inset-8 rounded-2xl border-2 border-dashed pointer-events-none transition-colors",
        dragging ? "border-blue-500" : "border-white/10",
      ].join(" ")} />

      <input ref={inputRef} type="file" accept=".glb" hidden onChange={e => handleFiles(e.target.files)} />

      {/* Icon */}
      <div className={`transition-colors ${dragging ? "text-blue-400" : "text-white/20"}`}>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M24 6L10 22H20V38H28V22H38L24 6Z" fill="currentColor"/>
          <rect x="10" y="42" width="28" height="3" rx="1.5" fill="currentColor" opacity="0.4"/>
        </svg>
      </div>

      <div className="text-center relative z-10 pointer-events-none">
        <p className="text-sm font-semibold text-white/60">Drop your GLB file here</p>
        <p className="text-xs text-white/30 mt-1">or click anywhere to browse · up to 500 MB</p>
      </div>
    </div>
  );
}

// ── Scene tree ────────────────────────────────────────────────────────────────

function TreeList({ nodes }: { nodes: NodeEntry[] }) {
  return (
    <div className="space-y-px text-[11px]">
      {nodes.map((n, i) => (
        <div
          key={i}
          style={{ paddingLeft: `${n.depth * 10 + 4}px` }}
          className="flex items-center gap-1.5 py-0.5 rounded hover:bg-white/4 group"
        >
          <span className={n.isMesh ? "text-blue-400/70" : "text-white/20"} style={{ fontSize: 8 }}>
            {n.isMesh ? "◆" : "○"}
          </span>
          <span className={`truncate ${n.isMesh ? "text-white/70" : "text-white/35"}`}>
            {n.name}
          </span>
          {n.isMesh && n.vertCount !== undefined && n.vertCount > 0 && (
            <span className="ml-auto text-[10px] text-white/20 flex-shrink-0 font-mono">
              {n.vertCount.toLocaleString()}v
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function GlbCompressorPage() {
  // File / viewer state
  const [file,       setFile]       = useState<File | null>(null);
  const [modelUrl,   setModelUrl]   = useState<string | null>(null);
  const [modelInfo,  setModelInfo]  = useState<ModelInfo | null>(null);
  const [wireframe,  setWireframe]  = useState(false);
  const [gridOn,     setGridOn]     = useState(true);
  const [resetKey,   setResetKey]   = useState(0);
  const [treeOpen,   setTreeOpen]   = useState(false);

  // Compression settings
  const [posB, setPosB] = useState(14);
  const [norB, setNorB] = useState(10);
  const [texB, setTexB] = useState(12);
  const [colB, setColB] = useState(8);
  const [genB, setGenB] = useState(12);
  const [method, setMethod] = useState<"edgebreaker" | "sequential">("edgebreaker");

  // Compression state
  const [compressing, setCompressing] = useState(false);
  const [result,      setResult]      = useState<CompressResult | null>(null);

  // Global drag-over overlay (when a model is already loaded)
  const [globalDrag, setGlobalDrag] = useState(false);
  const dragCounter = useRef(0);

  // ── File handling ──────────────────────────────────────────────────────────
  function pickFile(f: File) {
    // Revoke old blob URL
    if (modelUrl) URL.revokeObjectURL(modelUrl);

    const url = URL.createObjectURL(f);
    setFile(f);
    setModelUrl(url);
    setModelInfo(null);
    setResult(null);
    setWireframe(false);
    setTreeOpen(false);
  }

  // Cleanup blob URL on unmount
  useEffect(() => () => { if (modelUrl) URL.revokeObjectURL(modelUrl); }, []); // eslint-disable-line

  // Global drag-and-drop (replace model when one is already loaded)
  useEffect(() => {
    if (!file) return;
    function onEnter(e: DragEvent) {
      if (!e.dataTransfer?.types.includes("Files")) return;
      dragCounter.current++;
      setGlobalDrag(true);
    }
    function onLeave() {
      dragCounter.current--;
      if (dragCounter.current <= 0) { dragCounter.current = 0; setGlobalDrag(false); }
    }
    function onDrop(e: DragEvent) {
      e.preventDefault();
      dragCounter.current = 0;
      setGlobalDrag(false);
      const f = e.dataTransfer?.files[0];
      if (f?.name.match(/\.glb$/i)) pickFile(f);
    }
    function onOver(e: DragEvent) { e.preventDefault(); }
    window.addEventListener("dragenter",  onEnter);
    window.addEventListener("dragleave",  onLeave);
    window.addEventListener("dragover",   onOver);
    window.addEventListener("drop",       onDrop);
    return () => {
      window.removeEventListener("dragenter",  onEnter);
      window.removeEventListener("dragleave",  onLeave);
      window.removeEventListener("dragover",   onOver);
      window.removeEventListener("drop",       onDrop);
    };
  }, [file]); // eslint-disable-line

  const handleModelLoad = useCallback((info: ModelInfo) => setModelInfo(info), []);

  // ── Compress ───────────────────────────────────────────────────────────────
  async function compress() {
    if (!file || compressing) return;
    setCompressing(true);
    setResult(null);

    try {
      const fd = new FormData();
      fd.append("model",            file, file.name);
      fd.append("method",           method);
      fd.append("quantizePosition", String(posB));
      fd.append("quantizeNormal",   String(norB));
      fd.append("quantizeTexcoord", String(texB));
      fd.append("quantizeColor",    String(colB));
      fd.append("quantizeGeneric",  String(genB));

      const res = await fetch("/api/admin/compress-glb", { method: "POST", body: fd });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error((err as { error: string }).error ?? `HTTP ${res.status}`);
      }

      const origSize = parseInt(res.headers.get("X-Original-Size")   ?? "0", 10);
      const compSize = parseInt(res.headers.get("X-Compressed-Size") ?? "0", 10);
      const filename  = res.headers.get("X-Filename") ?? file.name.replace(/\.glb$/i, ".draco.glb");
      const blob      = await res.blob();

      setResult({ blob, filename, origSize, compSize });
    } catch (err: unknown) {
      alert("Compression failed:\n\n" + (err as Error).message);
    } finally {
      setCompressing(false);
    }
  }

  // ── Download ───────────────────────────────────────────────────────────────
  function download() {
    if (!result) return;
    const url = URL.createObjectURL(result.blob);
    const a   = Object.assign(document.createElement("a"), { href: url, download: result.filename });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5_000);
  }

  const pctSmaller = result
    ? Math.round((1 - result.compSize / result.origSize) * 100)
    : 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-white/8 bg-[#111]">
        <div className="flex items-center gap-3">
          <GlbIcon className="w-4 h-4 text-white/40" />
          <h1 className="text-sm font-bold text-white">GLB Compressor</h1>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-white/10 text-white/30 bg-white/4 tracking-wide uppercase">
            Draco
          </span>
        </div>
        {file && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/40 truncate max-w-[200px]">{file.name}</span>
            <span className="text-[10px] text-white/25 bg-white/5 px-2 py-0.5 rounded border border-white/8">
              {fmtBytes(file.size)}
            </span>
            <button
              onClick={() => { setFile(null); setModelUrl(null); setModelInfo(null); setResult(null); }}
              className="text-xs text-white/30 hover:text-white/70 px-2 py-1 rounded hover:bg-white/8 transition-colors"
            >
              New file
            </button>
          </div>
        )}
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* Viewer panel */}
        <div className="flex-1 relative bg-[#0d0d0d]">
          {!file ? (
            <DropZone onFile={pickFile} />
          ) : (
            <>
              <GlbViewer
                url={modelUrl}
                wireframe={wireframe}
                gridVisible={gridOn}
                resetKey={resetKey}
                onModelLoad={handleModelLoad}
              />

              {/* Viewer toolbar */}
              <div className="absolute bottom-3 left-3 flex gap-1.5 z-10">
                <ViewerBtn
                  title="Reset camera"
                  active={false}
                  onClick={() => setResetKey(k => k + 1)}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                    <path d="M3 3v5h5"/>
                  </svg>
                </ViewerBtn>
                <ViewerBtn title="Wireframe" active={wireframe} onClick={() => setWireframe(v => !v)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <polygon points="12 2 22 20 2 20"/>
                  </svg>
                </ViewerBtn>
                <ViewerBtn title="Grid" active={gridOn} onClick={() => setGridOn(v => !v)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                  </svg>
                </ViewerBtn>
              </div>
            </>
          )}
        </div>

        {/* ── Sidebar ───────────────────────────────────────────────────── */}
        <aside className="w-72 flex-shrink-0 flex flex-col border-l border-white/8 bg-[#111] overflow-y-auto">

          {/* File info */}
          {modelInfo && (
            <div className="border-b border-white/8">
              <div className="px-4 py-3 flex items-center justify-between">
                <p className="text-[9px] font-bold uppercase tracking-widest text-white/30">File Info</p>
              </div>
              <div className="px-4 pb-3 space-y-1.5">
                <InfoRow label="Meshes"     value={modelInfo.meshCount.toLocaleString()} />
                <InfoRow label="Primitives" value={modelInfo.primCount.toLocaleString()} />
                <InfoRow label="Vertices"   value={modelInfo.vertCount.toLocaleString()} />
                <InfoRow label="Triangles"  value={modelInfo.triCount.toLocaleString()} />
              </div>

              {/* Scene tree */}
              {modelInfo.nodes.length > 0 && (
                <div className="border-t border-white/5">
                  <button
                    onClick={() => setTreeOpen(v => !v)}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-[10px] text-white/30 hover:text-white/60 transition-colors"
                  >
                    <svg
                      className={`w-2.5 h-2.5 transition-transform ${treeOpen ? "rotate-180" : ""}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}
                    >
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                    Scene hierarchy
                  </button>
                  {treeOpen && (
                    <div className="px-3 pb-3 max-h-52 overflow-y-auto scrollbar-thin">
                      <TreeList nodes={modelInfo.nodes} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Empty state placeholder */}
          {!modelInfo && (
            <div className="px-4 py-6 border-b border-white/8 text-center">
              <p className="text-xs text-white/20">Load a GLB file to see info</p>
            </div>
          )}

          {/* Compression settings */}
          <div className="border-b border-white/8">
            <div className="px-4 py-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/30">Quantization Bits</p>
              <p className="text-[10px] text-white/20 mt-0.5">Lower = smaller file, less precision</p>
            </div>
            <div className="px-4 pb-4 space-y-4">
              <SliderRow label="POSITION" id="sl-pos" value={posB} onChange={setPosB} />
              <SliderRow label="NORMAL"   id="sl-nor" value={norB} onChange={setNorB} />
              <SliderRow label="TEXCOORD" id="sl-tex" value={texB} onChange={setTexB} />
              <SliderRow label="COLOR"    id="sl-col" value={colB} onChange={setColB} />
              <SliderRow label="GENERIC"  id="sl-gen" value={genB} onChange={setGenB} />

              {/* Method toggle */}
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-white/30 mb-2">Method</p>
                <div className="flex bg-white/5 rounded-lg border border-white/8 overflow-hidden text-[11px]">
                  {(["edgebreaker", "sequential"] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setMethod(m)}
                      className={[
                        "flex-1 py-1.5 capitalize transition-colors",
                        method === m
                          ? "bg-blue-600/30 text-blue-400 font-semibold"
                          : "text-white/35 hover:text-white/60 hover:bg-white/5",
                      ].join(" ")}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Compress button */}
          <button
            onClick={compress}
            disabled={!file || compressing}
            className="flex items-center justify-center gap-2 px-4 py-3.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-semibold text-white border-b border-white/8"
          >
            {compressing ? (
              <>
                <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Compressing…
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <polyline points="16 16 12 12 8 16"/>
                  <line x1="12" y1="12" x2="12" y2="21"/>
                  <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
                </svg>
                Compress with Draco
              </>
            )}
          </button>

          {/* Results */}
          {result && (
            <div className="border-b border-white/8">
              <div className="px-4 py-3 flex items-center justify-between">
                <p className="text-[9px] font-bold uppercase tracking-widest text-white/30">Result</p>
                <span className="text-[10px] font-bold text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded-full">
                  −{pctSmaller}%
                </span>
              </div>

              {/* Bar */}
              <div className="px-4 mb-3">
                <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all duration-700"
                    style={{ width: `${(result.compSize / result.origSize) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-white/25 mt-1">
                  <span>{fmtBytes(result.origSize)}</span>
                  <span className="text-green-400/80">{fmtBytes(result.compSize)}</span>
                </div>
              </div>

              <div className="px-4 pb-3 space-y-1.5">
                <InfoRow label="Original"   value={fmtBytes(result.origSize)} />
                <InfoRow label="Compressed" value={fmtBytes(result.compSize)} />
                <InfoRow label="Reduction"  value={`${pctSmaller}% smaller`} accent />
              </div>

              {/* Download */}
              <button
                onClick={download}
                className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-green-600/20 hover:bg-green-600/30 text-green-400 text-sm font-semibold transition-colors border-t border-green-400/10"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download
                <span className="text-[11px] opacity-60 font-normal">{fmtBytes(result.compSize)}</span>
              </button>
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />
        </aside>
      </div>

      {/* Global drag-over overlay (when replacing model) */}
      {globalDrag && (
        <div className="fixed inset-0 z-50 border-2 border-blue-500 bg-blue-600/10 pointer-events-none flex items-center justify-center">
          <p className="text-lg font-bold text-blue-400">Drop to replace model</p>
        </div>
      )}
    </div>
  );
}

// ── Small sub-components ──────────────────────────────────────────────────────

function InfoRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[11px] text-white/35">{label}</span>
      <span className={`text-[11px] font-mono ${accent ? "text-green-400 font-semibold" : "text-white/60"}`}>
        {value}
      </span>
    </div>
  );
}

function ViewerBtn({
  children, title, active, onClick,
}: { children: React.ReactNode; title: string; active: boolean; onClick: () => void }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={[
        "w-7 h-7 flex items-center justify-center rounded-lg backdrop-blur-sm border transition-colors",
        active
          ? "bg-blue-600/30 border-blue-500/50 text-blue-400"
          : "bg-[#111]/80 border-white/10 text-white/40 hover:text-white/80 hover:border-white/20",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function GlbIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"/>
    </svg>
  );
}
