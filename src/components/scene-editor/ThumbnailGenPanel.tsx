"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CategoryWithOptions } from "@/types/database";
import { updateOption } from "@/lib/admin-api";

// ── Canvas renderer ───────────────────────────────────────────────────────────

const SIZE = 400;

function renderColorCircle(canvas: HTMLCanvasElement, hex: string) {
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, SIZE, SIZE);

  ctx.save();
  ctx.beginPath();
  ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
  ctx.clip();

  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Subtle sphere highlight — top-left specular, bottom-right shadow
  const gRadial = ctx.createRadialGradient(
    SIZE * 0.36, SIZE * 0.30, 0,
    SIZE * 0.50, SIZE * 0.50, SIZE * 0.60,
  );
  gRadial.addColorStop(0,   "rgba(255,255,255,0.28)");
  gRadial.addColorStop(0.45,"rgba(255,255,255,0.06)");
  gRadial.addColorStop(1,   "rgba(0,0,0,0.18)");
  ctx.fillStyle = gRadial;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Thin inner ring for definition
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 1, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function renderImageCircle(canvas: HTMLCanvasElement, img: HTMLImageElement) {
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, SIZE, SIZE);

  ctx.save();
  ctx.beginPath();
  ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
  ctx.clip();

  const scale = Math.max(SIZE / img.naturalWidth, SIZE / img.naturalHeight);
  const w = img.naturalWidth  * scale;
  const h = img.naturalHeight * scale;
  ctx.drawImage(img, (SIZE - w) / 2, (SIZE - h) / 2, w, h);
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 1, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isValidHex(h: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(h);
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error("Canvas toBlob failed"))), "image/png"),
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  categories: CategoryWithOptions[];
  onOptionThumbnailUpdated: (optId: string, url: string) => void;
}

type Mode = "color" | "image";

export default function ThumbnailGenPanel({ categories, onOptionThumbnailUpdated }: Props) {
  const [mode,      setMode]      = useState<Mode>("color");
  const [hex,       setHex]       = useState("#8B7355");
  const [swInput,   setSwInput]   = useState("");
  const [swLoading, setSwLoading] = useState(false);
  const [swError,   setSwError]   = useState("");
  const [uploadImg, setUploadImg] = useState<HTMLImageElement | null>(null);
  const [dragging,  setDragging]  = useState(false);
  const [optSearch, setOptSearch] = useState("");
  const [assignIds, setAssignIds] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);
  const [assignErr, setAssignErr] = useState("");

  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const fileRef    = useRef<HTMLInputElement>(null);
  const prevObjUrl = useRef<string>("");

  // Re-render canvas when color or image changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (mode === "color" && isValidHex(hex)) {
      renderColorCircle(canvas, hex);
    } else if (mode === "image" && uploadImg) {
      renderImageCircle(canvas, uploadImg);
    }
  }, [mode, hex, uploadImg]);

  const hasPreview = mode === "color" ? isValidHex(hex) : !!uploadImg;

  // ── SW lookup ─────────────────────────────────────────────────────────────

  async function lookupSW() {
    if (!swInput.trim()) return;
    setSwLoading(true);
    setSwError("");
    try {
      const res  = await fetch(`/api/admin/sw-color?code=${encodeURIComponent(swInput.trim())}`);
      const data = await res.json();
      if (res.ok && data.hex) {
        setHex(data.hex);
        setSwError("");
      } else {
        setSwError(data.error ?? "Not found");
      }
    } catch {
      setSwError("Network error");
    }
    setSwLoading(false);
  }

  // ── Image handling ────────────────────────────────────────────────────────

  const handleFiles = useCallback((files: FileList | null) => {
    const file = files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    if (prevObjUrl.current) URL.revokeObjectURL(prevObjUrl.current);
    const url = URL.createObjectURL(file);
    prevObjUrl.current = url;
    const img = new Image();
    img.onload = () => setUploadImg(img);
    img.src = url;
  }, []);

  useEffect(() => {
    return () => { if (prevObjUrl.current) URL.revokeObjectURL(prevObjUrl.current); };
  }, []);

  // ── Download ──────────────────────────────────────────────────────────────

  async function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas || !hasPreview) return;
    const blob = await canvasToBlob(canvas);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = mode === "color"
      ? `swatch-${hex.replace("#", "")}.png`
      : "thumbnail.png";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }

  // ── Assign to option ──────────────────────────────────────────────────────

  async function handleAssign() {
    const canvas = canvasRef.current;
    if (!canvas || !hasPreview || assignIds.size === 0) return;
    setAssigning(true);
    setAssignErr("");
    const errs: string[] = [];
    // Upload once, reuse the same blob for every option
    let blob: Blob;
    try {
      blob = await canvasToBlob(canvas);
    } catch {
      setAssignErr("Failed to generate image");
      setAssigning(false);
      return;
    }
    for (const optId of assignIds) {
      try {
        const fd = new FormData();
        fd.append("file", blob, "thumbnail.png");
        fd.append("optionId", optId);
        const res  = await fetch("/api/admin/option-thumbnail", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Upload failed");
        await updateOption(optId, { thumbnail_url: data.url });
        onOptionThumbnailUpdated(optId, data.url);
      } catch (err) {
        errs.push(err instanceof Error ? err.message : "Failed");
      }
    }
    if (errs.length) setAssignErr(errs.join("; "));
    else setAssignIds(new Set());
    setAssigning(false);
  }

  // ── Option list ───────────────────────────────────────────────────────────

  const allOptions = categories.flatMap(cat =>
    (cat.options ?? []).map(opt => ({ opt, catName: cat.name, phase: cat.phase as string })),
  );
  const filteredOptions = optSearch
    ? allOptions.filter(x =>
        x.opt.friendly_name?.toLowerCase().includes(optSearch.toLowerCase()) ||
        x.catName.toLowerCase().includes(optSearch.toLowerCase()),
      )
    : allOptions;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4 px-3 py-3 overflow-y-auto flex-1" style={{ scrollbarWidth: "none" }}>

      {/* Mode toggle */}
      <div className="flex gap-0.5 p-0.5 bg-white/5 rounded-lg">
        {(["color", "image"] as Mode[]).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={`flex-1 py-1.5 text-[10px] capitalize rounded-md font-medium transition-colors ${
              mode === m ? "bg-white/12 text-white" : "text-white/35 hover:text-white/55"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* ── Color inputs ── */}
      {mode === "color" && (
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-[9px] uppercase tracking-widest text-white/25 font-bold mb-1.5">Hex Color</p>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={isValidHex(hex) ? hex : "#8b7355"}
                onChange={e => { setHex(e.target.value); setSwInput(""); }}
                className="w-8 h-8 rounded-md border border-white/10 bg-transparent cursor-pointer flex-shrink-0 p-0.5"
              />
              <input
                value={hex}
                onChange={e => { setHex(e.target.value); setSwError(""); }}
                placeholder="#RRGGBB"
                spellCheck={false}
                className="flex-1 px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[10px] text-white/80 font-mono focus:outline-none focus:border-blue-500/40"
              />
            </div>
          </div>

          <div>
            <p className="text-[9px] uppercase tracking-widest text-white/25 font-bold mb-1.5">Sherwin-Williams</p>
            <div className="flex gap-1.5">
              <input
                value={swInput}
                onChange={e => { setSwInput(e.target.value); setSwError(""); }}
                onKeyDown={e => e.key === "Enter" && lookupSW()}
                placeholder="SW 7008"
                className="flex-1 px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[10px] text-white/80 focus:outline-none focus:border-blue-500/40"
              />
              <button
                onClick={lookupSW}
                disabled={swLoading || !swInput.trim()}
                className="px-2.5 py-1.5 bg-white/6 hover:bg-white/10 border border-white/10 text-white/45 hover:text-white/80 rounded-lg text-[10px] transition-colors disabled:opacity-40"
              >
                {swLoading ? "…" : "Look up"}
              </button>
            </div>
            {swError && <p className="text-[9px] text-red-400/60 mt-1">{swError}</p>}
          </div>
        </div>
      )}

      {/* ── Image upload ── */}
      {mode === "image" && (
        <div
          onDragOver={e  => { e.preventDefault(); setDragging(true);  }}
          onDragLeave={() => setDragging(false)}
          onDrop={e      => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl py-8 text-center cursor-pointer transition-colors ${
            dragging ? "border-blue-500/50 bg-blue-500/5" : "border-white/10 hover:border-white/20"
          }`}
        >
          {uploadImg
            ? <p className="text-[10px] text-white/40">Drop another to replace</p>
            : <>
                <p className="text-[10px] text-white/35 mb-1">Drop image here</p>
                <p className="text-[9px]  text-white/20">or click to browse</p>
              </>
          }
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={e => handleFiles(e.target.files)} />
        </div>
      )}

      {/* ── Circle preview ── */}
      <div className="flex flex-col items-center gap-2">
        <p className="text-[9px] uppercase tracking-widest text-white/25 font-bold self-start">Preview</p>
        <div className="w-[140px] h-[140px] relative">
          <canvas
            ref={canvasRef}
            width={SIZE} height={SIZE}
            className="w-full h-full rounded-full"
            style={{ display: hasPreview ? "block" : "none" }}
          />
          {!hasPreview && (
            <div className="w-full h-full rounded-full border-2 border-dashed border-white/10 bg-white/3 flex items-center justify-center">
              <span className="text-[9px] text-white/20 text-center px-3 leading-snug">
                {mode === "color" ? "Enter a valid hex" : "Upload an image"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Download ── */}
      <button
        onClick={handleDownload}
        disabled={!hasPreview}
        className="flex items-center justify-center gap-1.5 py-1.5 bg-white/5 hover:bg-white/8 border border-white/10 text-white/40 hover:text-white/70 text-[10px] rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
        Download PNG
      </button>

      {/* Divider */}
      <div className="border-t border-white/8" />

      {/* ── Assign to option ── */}
      <div className="flex flex-col gap-2">
        <p className="text-[9px] uppercase tracking-widest text-white/25 font-bold">Assign to Option</p>

        <input
          value={optSearch}
          onChange={e => setOptSearch(e.target.value)}
          placeholder="Search options…"
          className="px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[10px] text-white/70 focus:outline-none focus:border-blue-500/40"
        />

        <div
          className="max-h-[160px] overflow-y-auto flex flex-col gap-0.5 rounded-lg border border-white/8 bg-white/2 p-1"
          style={{ scrollbarWidth: "none" }}
        >
          {filteredOptions.length === 0 ? (
            <p className="text-[9px] text-white/20 px-2 py-3 text-center">No options</p>
          ) : filteredOptions.map(({ opt, catName, phase }) => {
            const label = opt.friendly_name || "Untitled";
            const isSelected = assignIds.has(opt.id);
            const phaseDot: Record<string, string> = {
              exterior: "bg-green-400",
              interior: "bg-violet-400",
              blueprint: "bg-blue-400",
            };
            return (
              <button key={opt.id}
                onClick={() => setAssignIds(prev => {
                  const next = new Set(prev);
                  next.has(opt.id) ? next.delete(opt.id) : next.add(opt.id);
                  return next;
                })}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors ${
                  isSelected ? "bg-blue-500/15 text-white" : "hover:bg-white/5 text-white/50"
                }`}
              >
                {/* Current thumbnail or placeholder */}
                {opt.thumbnail_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={opt.thumbnail_url} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0 border border-white/10" />
                  : <div className="w-5 h-5 rounded-full bg-white/8 flex-shrink-0 border border-white/10" />
                }
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] truncate leading-snug">{label}</p>
                  <div className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${phaseDot[phase] ?? "bg-white/20"}`} />
                    <p className="text-[8px] text-white/25 truncate">{catName}</p>
                  </div>
                </div>
                {isSelected && (
                  <svg className="w-3 h-3 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>

        {assignErr && <p className="text-[9px] text-red-400/60">{assignErr}</p>}

        <button
          onClick={handleAssign}
          disabled={assignIds.size === 0 || !hasPreview || assigning}
          className="py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {assigning
            ? "Assigning…"
            : assignIds.size > 0
            ? `Assign to ${assignIds.size} option${assignIds.size !== 1 ? "s" : ""}`
            : "Select options above"}
        </button>
      </div>
    </div>
  );
}
