"use client";

import { useRef } from "react";

const RENDERS = [
  {
    title: "Modern Farmhouse — Exterior",
    type: "Exterior Dusk",
    palette: { sky: ["#0f1923", "#1a2f4a", "#2d4a6e"], accent: "#f59e0b", roof: "#1a1a2e" },
  },
  {
    title: "Open Kitchen — Interior",
    type: "Interior",
    palette: { sky: ["#1a1208", "#2a1e0d", "#3d2e12"], accent: "#fb923c", roof: "#2a1e0d" },
  },
  {
    title: "The Cypress — Aerial",
    type: "Aerial View",
    palette: { sky: ["#0a1628", "#102040", "#1a3050"], accent: "#60a5fa", roof: "#0a0a15" },
  },
  {
    title: "Craftsman Elevation — Dusk",
    type: "Exterior",
    palette: { sky: ["#1a0f28", "#2a1a40", "#3d2a60"], accent: "#a78bfa", roof: "#0d0a1a" },
  },
  {
    title: "Primary Suite — Interior",
    type: "Interior",
    palette: { sky: ["#0f1a14", "#1a2a20", "#263d2d"], accent: "#4ade80", roof: "#0d1a10" },
  },
];

function RenderIllustration({ palette, type }: { palette: typeof RENDERS[0]["palette"]; type: string }) {
  const isInterior = type === "Interior";
  const isAerial   = type === "Aerial View";

  if (isInterior) {
    return (
      <svg viewBox="0 0 400 260" className="w-full h-full" fill="none">
        <defs>
          <linearGradient id={`int-${palette.accent}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={palette.sky[0]}/>
            <stop offset="100%" stopColor={palette.sky[2]}/>
          </linearGradient>
          <linearGradient id={`win-${palette.accent}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={palette.sky[1]}/>
            <stop offset="100%" stopColor={palette.sky[2]}/>
          </linearGradient>
        </defs>
        <rect width="400" height="260" fill={`url(#int-${palette.accent})`}/>
        {/* Floor */}
        <path d="M 0 200 L 200 160 L 400 200 L 400 260 L 0 260 Z" fill={palette.sky[0]} fillOpacity="0.5"/>
        {/* Back wall */}
        <rect x="60" y="40" width="280" height="160" fill={palette.sky[1]} fillOpacity="0.3" stroke={palette.accent} strokeWidth="0.3" strokeOpacity="0.3"/>
        {/* Large window */}
        <rect x="130" y="50" width="140" height="100" fill={palette.accent} fillOpacity="0.1" stroke={palette.accent} strokeWidth="0.5" strokeOpacity="0.4"/>
        <line x1="200" y1="50" x2="200" y2="150" stroke={palette.accent} strokeWidth="0.5" strokeOpacity="0.3"/>
        {/* Light ray */}
        <path d="M 130 50 L 60 200 L 270 200 L 270 50 Z" fill={palette.accent} fillOpacity="0.03"/>
        {/* Island/table */}
        <rect x="120" y="175" width="160" height="30" rx="3" fill={palette.sky[1]} stroke={palette.accent} strokeWidth="0.4" strokeOpacity="0.3"/>
        {/* Stools */}
        {[145, 185, 225, 265].map(x => (
          <rect key={x} x={x} y={160} width="14" height="22" rx="2" fill={palette.sky[2]} fillOpacity="0.6" stroke={palette.accent} strokeWidth="0.3" strokeOpacity="0.2"/>
        ))}
        {/* Upper cabinets */}
        <rect x="60" y="90" width="60" height="50" rx="1" fill={palette.sky[2]} fillOpacity="0.5" stroke={palette.accent} strokeWidth="0.3" strokeOpacity="0.2"/>
        <rect x="280" y="90" width="60" height="50" rx="1" fill={palette.sky[2]} fillOpacity="0.5" stroke={palette.accent} strokeWidth="0.3" strokeOpacity="0.2"/>
        {/* Pendant lights */}
        {[155, 200, 245].map(x => (
          <g key={x}>
            <line x1={x} y1="40" x2={x} y2="68" stroke={palette.accent} strokeWidth="0.5" strokeOpacity="0.5"/>
            <ellipse cx={x} cy={70} rx="8" ry="5" fill={palette.accent} fillOpacity="0.2" stroke={palette.accent} strokeWidth="0.5"/>
            <ellipse cx={x} cy={73} rx="4" ry="2" fill={palette.accent} fillOpacity="0.4"/>
          </g>
        ))}
      </svg>
    );
  }

  if (isAerial) {
    return (
      <svg viewBox="0 0 400 260" className="w-full h-full" fill="none">
        <defs>
          <linearGradient id={`aer-${palette.accent}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={palette.sky[0]}/>
            <stop offset="100%" stopColor={palette.sky[2]}/>
          </linearGradient>
        </defs>
        <rect width="400" height="260" fill={`url(#aer-${palette.accent})`}/>
        {/* Lot */}
        <rect x="60" y="30" width="280" height="200" rx="4" fill={palette.sky[1]} fillOpacity="0.4" stroke={palette.accent} strokeWidth="0.4" strokeOpacity="0.2"/>
        {/* Lawn areas */}
        <rect x="60" y="30" width="280" height="200" rx="4" fill="#1a3020" fillOpacity="0.4"/>
        {/* Roof top-down */}
        <polygon points="200,60 290,120 290,180 110,180 110,120" fill={palette.sky[0]} fillOpacity="0.9" stroke={palette.accent} strokeWidth="0.5" strokeOpacity="0.4"/>
        <polygon points="200,60 290,120 200,130 110,120" fill={palette.accent} fillOpacity="0.08"/>
        <line x1="200" y1="60" x2="200" y2="180" stroke={palette.accent} strokeWidth="0.5" strokeOpacity="0.2" strokeDasharray="4 3"/>
        {/* Driveway */}
        <path d="M 180 180 L 165 230 L 215 230 L 220 180 Z" fill={palette.sky[1]} fillOpacity="0.5"/>
        {/* Pool */}
        <rect x="240" y="185" width="70" height="40" rx="8" fill={palette.accent} fillOpacity="0.15" stroke={palette.accent} strokeWidth="0.5" strokeOpacity="0.4"/>
        {/* Trees */}
        {[[85,55],[85,100],[85,155],[315,60],[315,110],[315,160]].map(([x,y],i) => (
          <circle key={i} cx={x} cy={y} r="14" fill="#0f2510" fillOpacity="0.85" stroke="#1a3a15" strokeWidth="0.5"/>
        ))}
        {/* Patio */}
        <rect x="105" y="182" width="70" height="20" rx="2" fill={palette.sky[2]} fillOpacity="0.4" stroke={palette.accent} strokeWidth="0.3" strokeOpacity="0.3"/>
        {/* Car in driveway */}
        <rect x="177" y="200" width="36" height="20" rx="3" fill={palette.sky[2]} fillOpacity="0.5"/>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 400 260" className="w-full h-full" fill="none">
      <defs>
        <linearGradient id={`ext-${palette.accent}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={palette.sky[0]}/>
          <stop offset="40%" stopColor={palette.sky[1]}/>
          <stop offset="100%" stopColor={palette.sky[2]}/>
        </linearGradient>
        <linearGradient id={`hb-${palette.accent}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={palette.sky[1]}/>
          <stop offset="100%" stopColor={palette.sky[0]}/>
        </linearGradient>
      </defs>
      <rect width="400" height="260" fill={`url(#ext-${palette.accent})`}/>
      {/* Ground */}
      <rect x="0" y="185" width="400" height="75" fill="#0d1a0d" fillOpacity="0.7"/>
      <ellipse cx="200" cy="188" rx="190" ry="8" fill="#1a2e1a" fillOpacity="0.5"/>
      {/* House */}
      <rect x="80" y="110" width="240" height="75" fill={`url(#hb-${palette.accent})`}/>
      {/* Roof */}
      <polygon points="65,110 200,45 335,110" fill={palette.roof}/>
      {/* Side */}
      <polygon points="320,110 355,128 355,185 320,185" fill={palette.sky[0]} fillOpacity="0.6"/>
      {/* Chimney */}
      <rect x="285" y="58" width="20" height="45" fill={palette.sky[0]} fillOpacity="0.9"/>
      {/* Windows */}
      <rect x="95" y="125" width="50" height="38" rx="1" fill={palette.accent} fillOpacity="0.2" stroke={palette.accent} strokeWidth="0.5" strokeOpacity="0.5"/>
      <line x1="120" y1="125" x2="120" y2="163" stroke={palette.accent} strokeWidth="0.4" strokeOpacity="0.4"/>
      <rect x="255" y="125" width="50" height="38" rx="1" fill={palette.accent} fillOpacity="0.2" stroke={palette.accent} strokeWidth="0.5" strokeOpacity="0.5"/>
      <line x1="280" y1="125" x2="280" y2="163" stroke={palette.accent} strokeWidth="0.4" strokeOpacity="0.4"/>
      {/* Door */}
      <rect x="176" y="140" width="48" height="45" rx="1" fill={palette.sky[0]} fillOpacity="0.8"/>
      <circle cx="219" cy="165" r="2.5" fill={palette.accent} fillOpacity="0.6"/>
      {/* Window glow */}
      <rect x="93" y="123" width="54" height="42" fill={palette.accent} fillOpacity="0.05" filter="blur(4px)"/>
      <rect x="253" y="123" width="54" height="42" fill={palette.accent} fillOpacity="0.05" filter="blur(4px)"/>
      {/* Shrubs */}
      {[[88,186],[128,188],[168,189],[230,189],[272,188],[312,186]].map(([x,y],i) => (
        <ellipse key={i} cx={x} cy={y} rx={14+(i%2)*4} ry="9" fill="#0d1e0d" fillOpacity="0.85"/>
      ))}
      {/* Tree */}
      <ellipse cx="52" cy="145" rx="35" ry="48" fill="#0d1e0d" fillOpacity="0.9"/>
      <ellipse cx="52" cy="128" rx="28" ry="38" fill="#112514" fillOpacity="0.8"/>
      <ellipse cx="350" cy="138" rx="32" ry="44" fill="#0d1e0d" fillOpacity="0.9"/>
      {/* Stars */}
      {[[40,18],[90,12],[180,22],[280,8],[340,20],[380,14]].map(([x,y],i) => (
        <circle key={i} cx={x} cy={y} r="1" fill="white" fillOpacity="0.35"/>
      ))}
    </svg>
  );
}

export default function RenderCarousel() {
  const trackRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (!trackRef.current) return;
    trackRef.current.scrollBy({ left: dir === "right" ? 340 : -340, behavior: "smooth" });
  };

  return (
    <div className="relative">
      {/* Left fade */}
      <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-[#080808] to-transparent z-10 pointer-events-none" />
      {/* Right fade */}
      <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[#080808] to-transparent z-10 pointer-events-none" />

      {/* Scroll buttons */}
      <button onClick={() => scroll("left")}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/10 border border-white/15 backdrop-blur-sm flex items-center justify-center text-white/70 hover:bg-white/20 hover:text-white transition-all">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
        </svg>
      </button>
      <button onClick={() => scroll("right")}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/10 border border-white/15 backdrop-blur-sm flex items-center justify-center text-white/70 hover:bg-white/20 hover:text-white transition-all">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
        </svg>
      </button>

      {/* Track */}
      <div
        ref={trackRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide px-8 pb-2"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {RENDERS.map((render, i) => (
          <div key={i} className="flex-shrink-0 w-72 group">
            <div className="rounded-xl overflow-hidden border border-white/8 bg-[#141414] hover:border-white/20 transition-colors">
              <div className="aspect-[400/260] overflow-hidden">
                <RenderIllustration palette={render.palette} type={render.type} />
              </div>
              <div className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white/80 truncate">{render.title}</p>
                  <p className="text-[10px] text-white/35 mt-0.5">{render.type}</p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/8 text-white/40 font-medium flex-shrink-0 ml-2">AI</span>
              </div>
            </div>
          </div>
        ))}

        {/* Coming soon card */}
        <div className="flex-shrink-0 w-72">
          <div className="rounded-xl overflow-hidden border border-dashed border-white/12 bg-[#0e0e0e] h-full flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
              </svg>
            </div>
            <p className="text-xs font-medium text-white/30">Your renders here</p>
            <p className="text-[10px] text-white/20 mt-1">Generated from your home models</p>
          </div>
        </div>
      </div>
    </div>
  );
}
