"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

type Status = "available" | "reserved" | "sold";

interface Lot {
  id: string;
  number: string;
  x: number; y: number; w: number; h: number;
  status: Status;
  modelKey: string;
  lotSize?: string;
  premium?: number;
}

interface HomeModel {
  name: string;
  beds: number;
  baths: number;
  sqft: number;
  price: number;
  floors: number;
  desc: string;
  features: string[];
  tag?: string;
}

// ── Home models ───────────────────────────────────────────────────────────────

const MODELS: Record<string, HomeModel> = {
  Cypress: {
    name: "The Cypress",
    beds: 3, baths: 2, sqft: 1847, price: 389900, floors: 1,
    desc: "An elegant single-story design with open-concept living and a spacious primary suite tucked away for privacy.",
    features: ["Open great room", "Covered back patio", "Walk-in pantry", "Two-car garage"],
  },
  Magnolia: {
    name: "The Magnolia",
    beds: 4, baths: 2.5, sqft: 2248, price: 449900, floors: 2,
    desc: "Two-story living at its finest — upstairs gameroom, flex-room study, and a chef's kitchen made for entertaining.",
    features: ["Chef's kitchen island", "Upstairs gameroom", "Study/flex room", "Oversized master bath"],
    tag: "Popular",
  },
  Ridgewood: {
    name: "The Ridgewood",
    beds: 4, baths: 3, sqft: 2679, price: 519900, floors: 2,
    desc: "Spacious four-bedroom home with a private guest suite, three-car garage, and luxury finishes throughout.",
    features: ["Guest suite with full bath", "Three-car garage", "Media room", "Quartz countertops throughout"],
  },
  Summit: {
    name: "The Summit",
    beds: 5, baths: 3.5, sqft: 3104, price: 599900, floors: 2,
    desc: "Our flagship floorplan — dramatic two-story entry, dual staircases, and a resort-style primary retreat.",
    features: ["Dual staircase entry", "Private study + library", "Outdoor kitchen-ready patio", "Wine room"],
    tag: "Flagship",
  },
};

// ── Status styling ────────────────────────────────────────────────────────────

const ST: Record<Status, { fill: string; stroke: string; dot: string; label: string }> = {
  available: { fill: "rgba(21,128,61,0.14)",  stroke: "#16a34a", dot: "#16a34a", label: "Available" },
  reserved:  { fill: "rgba(217,119,6,0.14)",  stroke: "#d97706", dot: "#d97706", label: "Reserved"  },
  sold:      { fill: "rgba(107,114,128,0.18)", stroke: "#9ca3af", dot: "#9ca3af", label: "Sold"      },
};

// ── Lot map data ──────────────────────────────────────────────────────────────
// SVG viewBox: 0 0 900 600
// Streets:
//   Timber Ridge Dr   horizontal  y=136  h=22
//   Creekside Lane    horizontal  y=330  h=22
//   Southbranch Blvd  horizontal  y=498  h=22
//   Oak Valley Way    vertical    x=424  w=22

type RawLot = [string, Status, string, string?]; // [num, status, model, lotSize?]

const RAW: RawLot[] = [
  // Row 0 Left (y=4 h=128) — 5 lots
  ["1",  "sold",      "Cypress",  "6,240 sqft"],
  ["2",  "sold",      "Cypress",  "5,980 sqft"],
  ["3",  "sold",      "Magnolia", "6,100 sqft"],
  ["4",  "sold",      "Magnolia", "6,340 sqft"],
  ["5",  "sold",      "Ridgewood","7,200 sqft"],
  // Row 0 Right (y=4 h=128) — 3 lots after amenity
  ["6",  "sold",      "Ridgewood","7,500 sqft"],
  ["7",  "sold",      "Magnolia", "6,800 sqft"],
  ["8",  "reserved",  "Summit",   "8,100 sqft"],
  // Row 1 Left (y=162 h=162) — 8 lots
  ["9",  "sold",      "Cypress",  "5,600 sqft"],
  ["10", "sold",      "Cypress",  "5,600 sqft"],
  ["11", "sold",      "Magnolia", "5,750 sqft"],
  ["12", "reserved",  "Ridgewood","5,750 sqft"],
  ["13", "reserved",  "Ridgewood","5,750 sqft"],
  ["14", "available", "Summit",   "6,400 sqft"],
  ["15", "available", "Magnolia", "5,750 sqft"],
  ["16", "available", "Cypress",  "5,600 sqft"],
  // Row 1 Right (y=162 h=162) — 8 lots
  ["17", "sold",      "Cypress",  "5,600 sqft"],
  ["18", "sold",      "Magnolia", "5,800 sqft"],
  ["19", "reserved",  "Ridgewood","5,800 sqft"],
  ["20", "reserved",  "Summit",   "6,200 sqft"],
  ["21", "available", "Magnolia", "5,800 sqft"],
  ["22", "available", "Cypress",  "5,600 sqft"],
  ["23", "available", "Ridgewood","5,900 sqft"],
  ["24", "available", "Summit",   "6,200 sqft"],
  // Row 2 Left (y=356 h=138) — 8 lots
  ["25", "available", "Cypress",  "5,500 sqft"],
  ["26", "available", "Magnolia", "5,600 sqft"],
  ["27", "available", "Ridgewood","5,700 sqft"],
  ["28", "available", "Summit",   "6,000 sqft"],
  ["29", "available", "Cypress",  "5,500 sqft"],
  ["30", "available", "Magnolia", "5,600 sqft"],
  ["31", "available", "Ridgewood","5,700 sqft"],
  ["32", "available", "Summit",   "6,000 sqft"],
  // Row 2 Right (y=356 h=138) — 8 lots
  ["33", "reserved",  "Cypress",  "5,500 sqft"],
  ["34", "available", "Magnolia", "5,600 sqft"],
  ["35", "available", "Ridgewood","5,800 sqft"],
  ["36", "available", "Summit",   "6,000 sqft"],
  ["37", "available", "Cypress",  "5,500 sqft"],
  ["38", "available", "Magnolia", "5,600 sqft"],
  ["39", "available", "Ridgewood","5,800 sqft"],
  ["40", "available", "Summit",   "6,000 sqft"],
  // Row 3 Left (y=524 h=70) — 4 wide lots
  ["41", "available", "Magnolia", "7,200 sqft"],
  ["42", "available", "Ridgewood","7,400 sqft"],
  ["43", "available", "Summit",   "7,600 sqft"],
  ["44", "available", "Summit",   "7,800 sqft"],
  // Row 3 Right (y=524 h=70) — 3 lots
  ["45", "available", "Ridgewood","7,200 sqft"],
  ["46", "available", "Summit",   "7,400 sqft"],
  ["47", "available", "Summit",   "7,800 sqft"],
];

function buildLots(): Lot[] {
  const lots: Lot[] = [];
  let ri = 0;

  function push(num: string, x: number, y: number, w: number, h: number) {
    const raw = RAW[ri++];
    if (!raw) return;
    lots.push({ id: raw[0], number: num, x, y, w, h, status: raw[1], modelKey: raw[2], lotSize: raw[3] });
  }

  // Row 0 Left — 5 lots
  const r0y = 4, r0h = 128;
  const r0lw = Math.floor((416 - 10) / 5);
  for (let i = 0; i < 5; i++) push(String(i + 1), 6 + i * (r0lw + 2), r0y, r0lw, r0h);

  // Row 0 Right — 3 lots (amenity occupies x=448–622)
  const r0rlotW = Math.floor((894 - 626) / 3);
  for (let i = 0; i < 3; i++) push(String(6 + i), 628 + i * (r0rlotW + 2), r0y, r0rlotW, r0h);

  // Row 1 Left — 8 lots
  const r1y = 162, r1h = 162;
  const r1lw = Math.floor((416 - 10) / 8);
  for (let i = 0; i < 8; i++) push(String(9 + i), 6 + i * (r1lw + 2), r1y, r1lw, r1h);

  // Row 1 Right — 8 lots
  const r1rw = Math.floor((894 - 448) / 8);
  for (let i = 0; i < 8; i++) push(String(17 + i), 448 + i * (r1rw + 2), r1y, r1rw, r1h);

  // Row 2 Left — 8 lots
  const r2y = 356, r2h = 138;
  for (let i = 0; i < 8; i++) push(String(25 + i), 6 + i * (r1lw + 2), r2y, r1lw, r2h);

  // Row 2 Right — 8 lots
  for (let i = 0; i < 8; i++) push(String(33 + i), 448 + i * (r1rw + 2), r2y, r1rw, r2h);

  // Row 3 Left — 4 wide lots
  const r3y = 524, r3h = 70;
  const r3lw = Math.floor((416 - 10) / 4);
  for (let i = 0; i < 4; i++) push(String(41 + i), 6 + i * (r3lw + 2), r3y, r3lw, r3h);

  // Row 3 Right — 3 lots (entry road gap at center, right side)
  const r3rw = Math.floor((894 - 448) / 3);
  for (let i = 0; i < 3; i++) push(String(45 + i), 448 + i * (r3rw + 2), r3y, r3rw, r3h);

  return lots;
}

const LOTS = buildLots();

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPrice(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

// ── Site map component ────────────────────────────────────────────────────────

function SiteMap({ onLotSelect }: { onLotSelect: (lot: Lot | null) => void }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const panStart = useRef({ cx: 0, cy: 0, px: 0, py: 0 });
  const hasDragged = useRef(false);

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    setZoom(v => Math.max(0.6, Math.min(5, v * (e.deltaY < 0 ? 1.12 : 0.9))));
  }
  function onMouseDown(e: React.MouseEvent) {
    hasDragged.current = false;
    setDragging(true);
    panStart.current = { cx: e.clientX, cy: e.clientY, px: pan.x, py: pan.y };
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!dragging) return;
    const dx = e.clientX - panStart.current.cx;
    const dy = e.clientY - panStart.current.cy;
    if (Math.abs(dx) + Math.abs(dy) > 3) hasDragged.current = true;
    setPan({ x: panStart.current.px + dx, y: panStart.current.py + dy });
  }
  function onMouseUp() { setDragging(false); setTimeout(() => { hasDragged.current = false; }, 0); }

  function clickLot(lot: Lot) {
    if (hasDragged.current) return;
    const next = selected === lot.id ? null : lot.id;
    setSelected(next);
    onLotSelect(next ? lot : null);
  }

  const stats = {
    available: LOTS.filter(l => l.status === "available").length,
    reserved:  LOTS.filter(l => l.status === "reserved").length,
    sold:      LOTS.filter(l => l.status === "sold").length,
  };

  return (
    <div className="relative rounded-2xl overflow-hidden border border-stone-200" style={{ background: "#F4F0E8" }}>
      {/* Legend */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-3 bg-white/90 backdrop-blur rounded-xl px-3 py-2 shadow-sm border border-stone-200">
        {(["available","reserved","sold"] as Status[]).map(s => (
          <div key={s} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: ST[s].dot }} />
            <span className="text-[11px] font-medium text-stone-600">{ST[s].label}</span>
            <span className="text-[11px] font-bold text-stone-800">{stats[s as keyof typeof stats]}</span>
          </div>
        ))}
      </div>

      {/* Zoom controls */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1 bg-white/90 backdrop-blur rounded-xl p-1 shadow-sm border border-stone-200">
        <button onClick={() => setZoom(v => Math.min(5, v + 0.2))}
          className="w-7 h-7 flex items-center justify-center text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg text-base font-bold transition-colors">+</button>
        <div className="text-center"><span className="text-[9px] text-stone-400 tabular-nums">{Math.round(zoom*100)}%</span></div>
        <button onClick={() => setZoom(v => Math.max(0.6, v - 0.2))}
          className="w-7 h-7 flex items-center justify-center text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg text-base font-bold transition-colors">−</button>
        {(zoom !== 1 || pan.x !== 0 || pan.y !== 0) && (
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            className="w-7 h-7 flex items-center justify-center text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        )}
      </div>

      {/* Map canvas */}
      <div
        className="overflow-hidden"
        style={{ height: 520, cursor: dragging ? "grabbing" : "grab" }}
        onWheel={handleWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <div style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`, transformOrigin: "center center", transition: dragging ? "none" : "transform 0.1s ease", width: "100%", height: "100%" }}>
          <svg viewBox="0 0 900 600" className="w-full h-full" style={{ display: "block" }}>
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(120,100,70,0.08)" strokeWidth="0.5" />
              </pattern>
              <filter id="lotShadow">
                <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="rgba(0,0,0,0.12)" />
              </filter>
            </defs>

            {/* Background */}
            <rect width="900" height="600" fill="#F4F0E8" />
            <rect width="900" height="600" fill="url(#grid)" />

            {/* Streets */}
            {/* Timber Ridge Drive */}
            <rect x="0" y="136" width="900" height="22" fill="#D4CAB8" />
            <text x="215" y="151" textAnchor="middle" fontSize="9" fill="#8B7D6B" fontWeight="600" letterSpacing="1">TIMBER RIDGE DRIVE</text>

            {/* Creekside Lane */}
            <rect x="0" y="330" width="900" height="22" fill="#D4CAB8" />
            <text x="215" y="345" textAnchor="middle" fontSize="9" fill="#8B7D6B" fontWeight="600" letterSpacing="1">CREEKSIDE LANE</text>

            {/* Southbranch Blvd */}
            <rect x="0" y="498" width="900" height="22" fill="#C8BC9A" />
            <text x="215" y="513" textAnchor="middle" fontSize="9" fill="#7A6B4E" fontWeight="700" letterSpacing="1.5">SOUTHBRANCH BOULEVARD</text>

            {/* Oak Valley Way (vertical) */}
            <rect x="422" y="0" width="22" height="600" fill="#D4CAB8" />
            <text x="433" y="298" textAnchor="middle" fontSize="9" fill="#8B7D6B" fontWeight="600" letterSpacing="1"
              transform="rotate(-90, 433, 298)">OAK VALLEY WAY</text>

            {/* Entry road */}
            <rect x="422" y="520" width="22" height="80" fill="#B8AE92" />
            <polygon points="422,600 433,592 444,600" fill="#A09478" />

            {/* Amenity area (top right, before lots 6-8) */}
            <rect x="448" y="4" width="174" height="128" rx="4" fill="#C5D8B0" stroke="#8AAD6A" strokeWidth="1.5" />
            <text x="535" y="56" textAnchor="middle" fontSize="10" fill="#4A7A3A" fontWeight="700" letterSpacing="0.5">CLUBHOUSE</text>
            <text x="535" y="72" textAnchor="middle" fontSize="10" fill="#4A7A3A" fontWeight="700" letterSpacing="0.5">& POOL</text>
            {/* pool icon */}
            <ellipse cx="535" cy="95" rx="28" ry="14" fill="rgba(59,130,246,0.25)" stroke="rgba(59,130,246,0.5)" strokeWidth="1" />
            <text x="535" y="99" textAnchor="middle" fontSize="8" fill="#2563EB">~</text>

            {/* Phase labels */}
            <text x="215" y="95" textAnchor="middle" fontSize="8.5" fill="#8B7D6B" fontWeight="500" letterSpacing="0.5" opacity="0.7">PHASE 1</text>
            <text x="215" y="260" textAnchor="middle" fontSize="8.5" fill="#8B7D6B" fontWeight="500" letterSpacing="0.5" opacity="0.7">PHASE 2</text>
            <text x="215" y="435" textAnchor="middle" fontSize="8.5" fill="#8B7D6B" fontWeight="500" letterSpacing="0.5" opacity="0.7">PHASE 3</text>
            <text x="660" y="260" textAnchor="middle" fontSize="8.5" fill="#8B7D6B" fontWeight="500" letterSpacing="0.5" opacity="0.7">PHASE 2</text>
            <text x="660" y="435" textAnchor="middle" fontSize="8.5" fill="#8B7D6B" fontWeight="500" letterSpacing="0.5" opacity="0.7">PHASE 3</text>

            {/* Lots */}
            {LOTS.map(lot => {
              const s = ST[lot.status];
              const isHov = hovered === lot.id;
              const isSel = selected === lot.id;
              const cx = lot.x + lot.w / 2;
              const cy = lot.y + lot.h / 2;

              return (
                <g key={lot.id}>
                  <rect
                    x={lot.x} y={lot.y} width={lot.w} height={lot.h}
                    rx="2"
                    fill={isHov || isSel ? s.fill.replace("0.14","0.28").replace("0.18","0.32") : s.fill}
                    stroke={isHov || isSel ? s.stroke : s.stroke + "AA"}
                    strokeWidth={isSel ? 2.5 : isHov ? 2 : 1.2}
                    strokeDasharray={isSel ? "5 3" : undefined}
                    style={{ transition: "fill 0.12s, stroke-width 0.12s", cursor: "pointer" }}
                    filter={isHov ? "url(#lotShadow)" : undefined}
                    onMouseEnter={() => setHovered(lot.id)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => clickLot(lot)}
                  />
                  <text
                    x={cx} y={cy - (lot.h > 100 ? 6 : 0)}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize={lot.h > 100 ? 11 : 9}
                    fontWeight="700"
                    fill={lot.status === "sold" ? "#9CA3AF" : lot.status === "reserved" ? "#92400E" : "#166534"}
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {lot.number}
                  </text>
                  {lot.h > 100 && (
                    <text
                      x={cx} y={cy + 8}
                      textAnchor="middle" dominantBaseline="middle"
                      fontSize="8"
                      fill={lot.status === "sold" ? "#9CA3AF" : lot.status === "reserved" ? "#B45309" : "#15803D"}
                      style={{ pointerEvents: "none", userSelect: "none" }}
                    >
                      {lot.status === "sold" ? "SOLD" : lot.status === "reserved" ? "HOLD" : "AVAIL"}
                    </text>
                  )}
                </g>
              );
            })}

            {/* North arrow */}
            <g transform="translate(860, 48)">
              <circle cx="0" cy="0" r="18" fill="white" stroke="#D4CAB8" strokeWidth="1.5" />
              <polygon points="0,-12 -5,4 0,0 5,4" fill="#5C4A2A" />
              <polygon points="0,-12 -5,4 0,0" fill="#C8BC9A" />
              <text y="14" textAnchor="middle" fontSize="9" fontWeight="700" fill="#5C4A2A">N</text>
            </g>
          </svg>
        </div>
      </div>

      <p className="text-center text-[11px] text-stone-400 py-2">Click a lot to view details · Scroll to zoom · Drag to pan</p>
    </div>
  );
}

// ── Lot detail panel ──────────────────────────────────────────────────────────

function LotPanel({ lot, onClose }: { lot: Lot; onClose: () => void }) {
  const model = MODELS[lot.modelKey];
  const s = ST[lot.status];
  const totalPrice = model ? model.price + (lot.premium ?? 0) : null;

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-lg overflow-hidden sticky top-24">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-stone-100">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Lot</p>
            <h3 className="text-2xl font-bold text-stone-900">{lot.number}</h3>
            {lot.lotSize && <p className="text-xs text-stone-400 mt-0.5">{lot.lotSize} lot</p>}
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
              style={{ background: s.fill, border: `1px solid ${s.stroke}`, color: s.dot }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
              {s.label}
            </span>
            <button onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {model && (
        <div className="px-5 py-4 space-y-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Home Model</p>
            <h4 className="text-base font-bold text-stone-800">{model.name}</h4>
            <p className="text-xs text-stone-500 mt-1 leading-relaxed">{model.desc}</p>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {[
              { l: "Bed",   v: model.beds   },
              { l: "Bath",  v: model.baths  },
              { l: "Floor", v: model.floors },
              { l: "Sqft",  v: model.sqft >= 1000 ? `${(model.sqft/1000).toFixed(1)}k` : model.sqft },
            ].map(s => (
              <div key={s.l} className="flex flex-col items-center py-2.5 rounded-xl bg-stone-50 border border-stone-100">
                <p className="text-sm font-bold text-stone-800">{s.v}</p>
                <p className="text-[9px] uppercase tracking-wider text-stone-400 mt-0.5">{s.l}</p>
              </div>
            ))}
          </div>

          {totalPrice !== null && (
            <div className="rounded-xl px-4 py-3 bg-stone-50 border border-stone-100">
              <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-1">Starting From</p>
              <p className="text-2xl font-bold text-stone-900">{fmtPrice(totalPrice)}</p>
            </div>
          )}

          {lot.status === "available" && (
            <a href="#contact"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold text-white transition-all hover:brightness-105"
              style={{ background: "#1E4D2B" }}
            >
              Request Info on Lot {lot.number}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </a>
          )}
          {lot.status === "reserved" && (
            <div className="flex items-center justify-center py-2.5 rounded-xl text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200">
              This lot is currently under contract
            </div>
          )}
          {lot.status === "sold" && (
            <div className="flex items-center justify-center py-2.5 rounded-xl text-sm font-medium text-stone-400 bg-stone-50 border border-stone-200">
              This lot has been sold
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SouthbranchPage() {
  const [selectedLot, setSelectedLot] = useState<Lot | null>(null);
  const [activeModel, setActiveModel] = useState("Magnolia");
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", message: "", model: "" });
  const [submitted, setSubmitted] = useState(false);

  const stats = {
    total:     LOTS.length,
    available: LOTS.filter(l => l.status === "available").length,
    reserved:  LOTS.filter(l => l.status === "reserved").length,
    sold:      LOTS.filter(l => l.status === "sold").length,
  };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <div className="min-h-screen" style={{ background: "#FAFAF7", fontFamily: "'DM Sans', system-ui, sans-serif", color: "#1A1A1A" }}>

      {/* ── Nav ────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-stone-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {/* Builder logo placeholder */}
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: "#1E4D2B" }}>MP</div>
              <div>
                <p className="text-[11px] font-bold text-stone-800 leading-none">Meridian Premier</p>
                <p className="text-[10px] text-stone-400 leading-none mt-0.5">Homes</p>
              </div>
            </div>
            <div className="hidden md:block w-px h-6 bg-stone-200" />
            <nav className="hidden md:flex items-center gap-0.5">
              {[
                { label: "Communities", href: "#" },
                { label: "Home Models", href: "#models" },
                { label: "Site Map",    href: "#sitemap" },
                { label: "Amenities",  href: "#amenities" },
              ].map(n => (
                <a key={n.label} href={n.href}
                  className="px-3 py-1.5 text-sm text-stone-500 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition-colors">
                  {n.label}
                </a>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <a href="tel:+15125550198" className="hidden sm:flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
              (512) 555-0198
            </a>
            <a href="#contact"
              className="px-4 py-2 text-sm font-semibold text-white rounded-xl transition-all hover:brightness-110 shadow-sm"
              style={{ background: "#1E4D2B" }}>
              Request Info
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ height: "min(560px, 72vw)" }}>
        {/* Background gradient simulating a community aerial/neighborhood photo */}
        <div className="absolute inset-0" style={{
          background: "linear-gradient(135deg, #2D5A3D 0%, #1a3d28 35%, #3D6B28 65%, #2A4A1E 100%)"
        }} />
        {/* Texture overlay */}
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: "radial-gradient(ellipse at 30% 40%, rgba(255,255,255,0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 70%, rgba(255,220,100,0.08) 0%, transparent 40%)",
        }} />
        {/* Subtle grid */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }} />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-end h-full max-w-7xl mx-auto px-6 pb-10">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold" style={{ background: "rgba(255,255,255,0.15)", color: "#D4EDCA", border: "1px solid rgba(255,255,255,0.2)" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Now Selling · Phase 3 Open
              </span>
            </div>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "clamp(36px,5vw,60px)", lineHeight: 1.1, color: "white", letterSpacing: "-0.02em" }}>
              Southbranch
            </h1>
            <p className="text-white/70 mt-2 text-base leading-relaxed max-w-lg">
              A master-planned community of 47 single-family homes nestled along Barton Creek, minutes from Austin's best dining, schools, and recreation.
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-6">
              <a href="#sitemap"
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl transition-all shadow-lg"
                style={{ background: "white", color: "#1E4D2B" }}>
                Explore Site Map
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </a>
              <a href="#models"
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-all"
                style={{ background: "rgba(255,255,255,0.15)", color: "white", border: "1px solid rgba(255,255,255,0.25)" }}>
                View Home Models
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ──────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-stone-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-5 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { label: "Homesites",    value: `${stats.total}`,       sub: "total lots"          },
            { label: "Available",    value: `${stats.available}`,   sub: "ready to purchase",  accent: "#16A34A" },
            { label: "Priced From",  value: "$389,900",             sub: "The Cypress"         },
            { label: "Up to",        value: "3,104 sqft",           sub: "The Summit model"    },
          ].map(s => (
            <div key={s.label} className="text-center md:text-left">
              <p className="text-[11px] font-bold uppercase tracking-widest text-stone-400">{s.label}</p>
              <p className="text-2xl font-bold mt-0.5" style={{ color: s.accent ?? "#1A1A1A" }}>{s.value}</p>
              <p className="text-xs text-stone-400 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── About section ──────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: "#1E4D2B" }}>About the Community</p>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "clamp(26px,3vw,36px)", lineHeight: 1.2, letterSpacing: "-0.02em" }}>
              Live where nature and<br />neighborhood meet
            </h2>
            <p className="text-stone-500 mt-4 leading-relaxed">
              Southbranch is designed for families who want space, community, and connectivity. Three curated floorplans — from intimate single-story homes to expansive five-bedroom estates — offer something for every stage of life.
            </p>
            <p className="text-stone-500 mt-3 leading-relaxed">
              Each home is built with Meridian Premier's signature quality: energy-efficient construction, open layouts, and luxury finishes included as standard — not upgrades.
            </p>
            <div className="flex flex-wrap gap-4 mt-6">
              {[
                { label: "Cedar Park ISD",      icon: "🏫" },
                { label: "20 min to Downtown",  icon: "🏙️" },
                { label: "On Barton Creek",      icon: "🌿" },
                { label: "Energy Star Rated",   icon: "⚡" },
              ].map(f => (
                <div key={f.label} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-100 border border-stone-200">
                  <span className="text-sm">{f.icon}</span>
                  <span className="text-xs font-medium text-stone-600">{f.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Total Homesites",   value: `${stats.total}`, color: "#F0EDE6" },
              { label: "Available Today",   value: `${stats.available}`, color: "#DCFCE7", textColor: "#166534" },
              { label: "Sq Ft Range",       value: "1,847–3,104", color: "#F0EDE6" },
              { label: "Price Range",       value: "$389–$600k", color: "#F0EDE6" },
            ].map(s => (
              <div key={s.label} className="rounded-2xl p-5 border border-stone-200"
                style={{ background: s.color }}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">{s.label}</p>
                <p className="text-xl font-bold mt-1" style={{ color: s.textColor ?? "#1A1A1A" }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Interactive site map ────────────────────────────────────────────── */}
      <section id="sitemap" className="py-16 border-t border-stone-200" style={{ background: "#F4F1EB" }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: "#1E4D2B" }}>Interactive Site Map</p>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "clamp(24px,2.5vw,32px)", letterSpacing: "-0.02em" }}>
                Find your perfect lot
              </h2>
              <p className="text-stone-500 text-sm mt-1">47 homesites across three phases · {stats.available} still available</p>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-200 border border-green-600 inline-block" />Available</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-100 border border-amber-600 inline-block" />Reserved</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-stone-200 border border-stone-400 inline-block" />Sold</span>
            </div>
          </div>

          <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
            <SiteMap onLotSelect={setSelectedLot} />

            {selectedLot ? (
              <LotPanel lot={selectedLot} onClose={() => setSelectedLot(null)} />
            ) : (
              <div className="hidden lg:flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-white text-center px-6 py-16">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 bg-stone-100 border border-stone-200">
                  <svg className="w-6 h-6 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-stone-600">Click any lot on the map</p>
                <p className="text-xs text-stone-400 mt-1 leading-relaxed">See lot details, assigned home model, and pricing.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Home models ─────────────────────────────────────────────────────── */}
      <section id="models" className="py-16 max-w-7xl mx-auto px-6">
        <div className="text-center mb-10">
          <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: "#1E4D2B" }}>Home Models</p>
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "clamp(26px,3vw,36px)", letterSpacing: "-0.02em" }}>
            Four floorplans, one community
          </h2>
          <p className="text-stone-500 text-sm mt-2">Every model includes Meridian Premier's standard luxury package at no extra cost.</p>
        </div>

        {/* Model tabs */}
        <div className="flex overflow-x-auto gap-2 mb-8 pb-2 scrollbar-hide">
          {Object.entries(MODELS).map(([key, m]) => (
            <button key={key} onClick={() => setActiveModel(key)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeModel === key ? "text-white shadow-sm" : "text-stone-500 bg-stone-100 hover:bg-stone-200"}`}
              style={activeModel === key ? { background: "#1E4D2B" } : {}}>
              {m.name}
              {m.tag && <span className="ml-2 text-[10px] font-bold uppercase opacity-70">{m.tag}</span>}
            </button>
          ))}
        </div>

        {/* Active model detail */}
        {(() => {
          const m = MODELS[activeModel];
          if (!m) return null;
          return (
            <div className="grid md:grid-cols-2 gap-8 items-start">
              {/* Floor plan visual */}
              <div className="rounded-2xl overflow-hidden border border-stone-200 bg-stone-50" style={{ minHeight: 320 }}>
                <div className="relative h-80" style={{ background: "linear-gradient(135deg, #E8E4DC 0%, #D5CFBF 100%)" }}>
                  {/* Blueprint-style floor plan placeholder */}
                  <div className="absolute inset-6 rounded-xl border-2 border-stone-400/40" style={{ background: "rgba(255,255,255,0.4)" }}>
                    <div className="absolute inset-0 opacity-30" style={{
                      backgroundImage: "linear-gradient(rgba(90,75,55,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(90,75,55,0.4) 1px, transparent 1px)",
                      backgroundSize: "24px 24px",
                    }} />
                    <div className="flex items-center justify-center h-full flex-col gap-2">
                      <p className="text-xs font-bold uppercase tracking-widest text-stone-500">{m.name}</p>
                      <p className="text-[11px] text-stone-400">Floor Plan · {m.sqft.toLocaleString()} sqft</p>
                      <div className="flex items-center gap-4 mt-3 text-xs text-stone-500">
                        <span>{m.beds} bed</span>
                        <span>·</span>
                        <span>{m.baths} bath</span>
                        <span>·</span>
                        <span>{m.floors} {m.floors === 1 ? "story" : "stories"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="absolute bottom-3 right-3 px-2 py-1 rounded-lg bg-white/80 text-[10px] font-bold text-stone-600 border border-stone-200">
                    Rendering available — request a tour
                  </div>
                </div>
              </div>

              {/* Model details */}
              <div>
                <div className="flex items-start justify-between mb-1">
                  <h3 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: 26, letterSpacing: "-0.02em" }}>{m.name}</h3>
                  {m.tag && (
                    <span className="mt-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold text-white" style={{ background: "#1E4D2B" }}>{m.tag}</span>
                  )}
                </div>

                <div className="flex flex-wrap gap-3 mt-2 mb-4">
                  {[
                    { l: "Beds",   v: m.beds   },
                    { l: "Baths",  v: m.baths  },
                    { l: "Sqft",   v: m.sqft.toLocaleString() },
                    { l: "Stories",v: m.floors },
                  ].map(s => (
                    <div key={s.l} className="flex flex-col items-center px-4 py-2.5 rounded-xl bg-stone-50 border border-stone-200 min-w-[60px]">
                      <span className="text-base font-bold text-stone-800">{s.v}</span>
                      <span className="text-[10px] uppercase tracking-wider text-stone-400 mt-0.5">{s.l}</span>
                    </div>
                  ))}
                </div>

                <p className="text-stone-600 text-sm leading-relaxed mb-4">{m.desc}</p>

                <div className="rounded-xl p-4 bg-stone-50 border border-stone-200 mb-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-2">Included Features</p>
                  <div className="space-y-1.5">
                    {m.features.map(f => (
                      <div key={f} className="flex items-center gap-2 text-sm text-stone-600">
                        <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 16 16" fill="none">
                          <circle cx="8" cy="8" r="7" fill="#DCFCE7" stroke="#16A34A" strokeWidth="1.5" />
                          <path d="M5 8l2 2 4-4" stroke="#16A34A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        {f}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl border border-stone-200 bg-white mb-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Starting From</p>
                    <p className="text-2xl font-bold text-stone-900 mt-0.5">{fmtPrice(m.price)}</p>
                  </div>
                  <a href="#contact"
                    className="px-4 py-2.5 text-sm font-bold text-white rounded-xl transition-all hover:brightness-110"
                    style={{ background: "#1E4D2B" }}>
                    Get Pricing
                  </a>
                </div>

                <p className="text-[11px] text-stone-400">
                  Price shown is base price and excludes lot premiums and selected options. Contact our sales team for a personalized quote.
                </p>
              </div>
            </div>
          );
        })()}
      </section>

      {/* ── Amenities ───────────────────────────────────────────────────────── */}
      <section id="amenities" className="py-16 border-t border-stone-200" style={{ background: "#F4F1EB" }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: "#1E4D2B" }}>Life at Southbranch</p>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "clamp(26px,3vw,36px)", letterSpacing: "-0.02em" }}>
              Community amenities
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: "🏊", title: "Resort-Style Pool",     desc: "Lagoon-style pool with sun shelf, lap lanes, and a shaded pavilion for gatherings." },
              { icon: "🏋️", title: "Fitness Center",        desc: "Fully equipped 2,400 sqft clubhouse gym with cardio, weights, and yoga studio." },
              { icon: "🌳", title: "3 Miles of Trails",    desc: "Hike and bike paths winding through preserved greenbelts along Barton Creek." },
              { icon: "🐕", title: "Dog Park",              desc: "Two dedicated dog parks — one for large breeds, one for small — with agility stations." },
              { icon: "⛺", title: "Pocket Parks",          desc: "Five neighborhood parks with playgrounds, covered picnic areas, and open lawns." },
              { icon: "🏡", title: "Event Lawn",            desc: "A flexible outdoor gathering space available for private resident events year-round." },
            ].map(a => (
              <div key={a.title} className="bg-white rounded-2xl p-5 border border-stone-200 hover:border-stone-300 hover:shadow-md transition-all">
                <div className="text-2xl mb-3">{a.icon}</div>
                <h3 className="font-bold text-stone-800 text-sm mb-1">{a.title}</h3>
                <p className="text-xs text-stone-500 leading-relaxed">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Location ────────────────────────────────────────────────────────── */}
      <section className="py-16 max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: "#1E4D2B" }}>Location</p>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "clamp(24px,2.5vw,32px)", letterSpacing: "-0.02em" }}>
              Everything within reach
            </h2>
            <p className="text-stone-500 mt-3 text-sm leading-relaxed">
              Southbranch sits at the intersection of Hill Country character and Austin convenience — off TX-45 and 183A, minutes from Q2 Stadium, the Domain, and major tech campuses.
            </p>
            <div className="mt-6 space-y-3">
              {[
                { place: "H-E-B Grocery",            dist: "4 min" },
                { place: "Cedar Park Regional Medical", dist: "8 min" },
                { place: "Apple Campus (Northwest)",  dist: "14 min" },
                { place: "Q2 Stadium",                dist: "20 min" },
                { place: "Austin–Bergstrom Airport",  dist: "38 min" },
              ].map(r => (
                <div key={r.place} className="flex items-center justify-between py-2.5 border-b border-stone-100">
                  <span className="text-sm text-stone-600">{r.place}</span>
                  <span className="text-sm font-semibold text-stone-800">{r.dist}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Map placeholder */}
          <div className="rounded-2xl overflow-hidden border border-stone-200 shadow-sm" style={{ height: 340 }}>
            <div className="w-full h-full flex items-center justify-center relative" style={{ background: "linear-gradient(145deg, #C5D8B0 0%, #A8C490 40%, #8FAD78 100%)" }}>
              <div className="absolute inset-0 opacity-20" style={{
                backgroundImage: "linear-gradient(rgba(0,0,0,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.2) 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }} />
              {/* Fake road lines */}
              <div className="absolute" style={{ top: "38%", left: 0, right: 0, height: 14, background: "rgba(255,255,255,0.6)", borderTop: "1px solid rgba(255,255,255,0.8)", borderBottom: "1px solid rgba(255,255,255,0.8)" }} />
              <div className="absolute" style={{ top: 0, bottom: 0, left: "55%", width: 14, background: "rgba(255,255,255,0.6)", borderLeft: "1px solid rgba(255,255,255,0.8)", borderRight: "1px solid rgba(255,255,255,0.8)" }} />
              {/* Pin */}
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-xl border-2 border-white" style={{ background: "#1E4D2B" }}>
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                  </svg>
                </div>
                <div className="mt-2 px-3 py-1 rounded-full bg-white shadow-lg text-xs font-bold text-stone-800">Southbranch</div>
              </div>
              <p className="absolute bottom-3 right-3 text-[10px] text-white/60 font-medium">Cedar Park, TX · 78613</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Contact / Interest form ─────────────────────────────────────────── */}
      <section id="contact" className="py-16 border-t border-stone-200" style={{ background: "#1E4D2B" }}>
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-[11px] font-bold uppercase tracking-widest mb-2 text-white/50">Get Started</p>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "clamp(26px,3vw,36px)", letterSpacing: "-0.02em", color: "white" }}>
              Request community information
            </h2>
            <p className="text-white/60 text-sm mt-2">Our sales team will reach out within one business day.</p>
          </div>

          {submitted ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-white/10 border border-white/20 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Thank you!</h3>
              <p className="text-white/60 text-sm">We&apos;ll be in touch soon. In the meantime, keep exploring the site map above.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="bg-white/10 backdrop-blur rounded-2xl border border-white/20 p-6 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-white/60 mb-1.5">Full Name</label>
                  <input type="text" required placeholder="Jane Smith"
                    value={formData.name} onChange={e => setFormData(d => ({ ...d, name: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm text-white bg-white/10 border border-white/20 placeholder-white/30 focus:outline-none focus:border-white/50 transition-colors" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-white/60 mb-1.5">Email Address</label>
                  <input type="email" required placeholder="jane@email.com"
                    value={formData.email} onChange={e => setFormData(d => ({ ...d, email: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm text-white bg-white/10 border border-white/20 placeholder-white/30 focus:outline-none focus:border-white/50 transition-colors" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-white/60 mb-1.5">Phone (optional)</label>
                  <input type="tel" placeholder="(512) 555-0000"
                    value={formData.phone} onChange={e => setFormData(d => ({ ...d, phone: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm text-white bg-white/10 border border-white/20 placeholder-white/30 focus:outline-none focus:border-white/50 transition-colors" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-white/60 mb-1.5">Home Model Interest</label>
                  <select value={formData.model} onChange={e => setFormData(d => ({ ...d, model: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-white/10 border border-white/20 focus:outline-none focus:border-white/50 transition-colors"
                    style={{ color: formData.model ? "white" : "rgba(255,255,255,0.4)" }}>
                    <option value="" style={{ color: "#333" }}>Any / Not sure</option>
                    {Object.entries(MODELS).map(([k, m]) => (
                      <option key={k} value={k} style={{ color: "#333" }}>{m.name} — from {fmtPrice(m.price)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-white/60 mb-1.5">Message (optional)</label>
                <textarea rows={3} placeholder="Tell us a bit about your timeline, preferred lot, or any questions..."
                  value={formData.message} onChange={e => setFormData(d => ({ ...d, message: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm text-white bg-white/10 border border-white/20 placeholder-white/30 focus:outline-none focus:border-white/50 transition-colors resize-none" />
              </div>
              <button type="submit"
                className="w-full py-3 rounded-xl text-sm font-bold text-[#1E4D2B] transition-all hover:brightness-105 shadow-lg"
                style={{ background: "white" }}>
                Send Request
              </button>
              <p className="text-center text-[11px] text-white/40">By submitting you agree to receive communications from Meridian Premier Homes. No spam, ever.</p>
            </form>
          )}
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="bg-stone-900 py-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ background: "#1E4D2B" }}>MP</div>
            <div>
              <p className="text-sm font-bold text-white">Meridian Premier Homes</p>
              <p className="text-[11px] text-stone-500">5900 Balcones Dr, Ste 100 · Austin, TX 78731</p>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <p className="text-[11px] text-stone-500 text-center">© 2025 Meridian Premier Homes · All rights reserved · TREC License #789456</p>
            <p className="text-[10px] text-stone-600 text-center flex items-center gap-1">
              Interactive site map powered by
              <span className="font-semibold text-stone-400 ml-1">ProPlan Studio</span>
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm text-stone-500">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="tel:+15125550198" className="hover:text-white transition-colors">(512) 555-0198</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
