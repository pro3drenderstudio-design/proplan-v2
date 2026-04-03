"use client";

import { useRef, useState, useCallback } from "react";

// ── Slider Component ───────────────────────────────────────────────────────────

export default function AIRenderSlider() {
  const [pos, setPos]         = useState(42);
  const [dragging, setDragging] = useState(false);
  const containerRef            = useRef<HTMLDivElement>(null);

  const calcPos = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct  = Math.min(Math.max(((clientX - rect.left) / rect.width) * 100, 5), 95);
    setPos(pct);
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    const move = (ev: MouseEvent) => calcPos(ev.clientX);
    const up   = () => { setDragging(false); window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const move  = (ev: TouchEvent) => calcPos(ev.touches[0].clientX);
    const end   = () => { setDragging(false); window.removeEventListener("touchmove", move); window.removeEventListener("touchend", end); };
    setDragging(true);
    window.addEventListener("touchmove", move, { passive: true });
    window.addEventListener("touchend", end);
    calcPos(touch.clientX);
  };

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a] shadow-2xl shadow-black/60 select-none"
      ref={containerRef}
      style={{ cursor: dragging ? "col-resize" : "default" }}
    >
      {/* Labels */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10">
        <div className="w-2 h-2 rounded-full bg-blue-400" />
        <span className="text-xs font-semibold text-white/80">Floor Plan</span>
      </div>
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-sm border border-white/10">
        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        <span className="text-xs font-semibold text-white/80">AI Render</span>
      </div>

      {/* Floor Plan (full width, underneath) */}
      <div className="w-full aspect-[16/10]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/plan1.png" alt="Floor plan" className="w-full h-full object-cover" draggable={false} />
      </div>

      {/* AI Render (clipped to right of slider) */}
      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 0 0 ${pos}%)` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/rendered1.jpg" alt="AI Render" className="w-full h-full object-cover" draggable={false} />
      </div>

      {/* Divider line */}
      <div
        className="absolute inset-y-0 z-10 w-px bg-white/80"
        style={{ left: `${pos}%` }}
      />

      {/* Drag handle */}
      <div
        className="absolute top-1/2 z-20 -translate-y-1/2 -translate-x-1/2"
        style={{ left: `${pos}%` }}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
      >
        <div className="w-10 h-10 rounded-full bg-white shadow-xl flex items-center justify-center cursor-col-resize group hover:scale-110 transition-transform">
          <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l-3 3 3 3M16 9l3 3-3 3"/>
          </svg>
        </div>
      </div>

      {/* Drag hint overlay (fades out once dragged) */}
      {pos === 42 && !dragging && (
        <div className="absolute inset-0 z-5 flex items-end justify-center pb-6 pointer-events-none">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-black/50 backdrop-blur-sm border border-white/10">
            <svg className="w-3.5 h-3.5 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l-3 3 3 3M16 9l3 3-3 3"/>
            </svg>
            <span className="text-[11px] text-white/60 font-medium">Drag to compare</span>
          </div>
        </div>
      )}
    </div>
  );
}
