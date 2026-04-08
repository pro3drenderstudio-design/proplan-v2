"use client";

import { useRef } from "react";

const RENDERS = [
  {
    url:   "https://qvgsdrjkjtzwtxfepyoe.supabase.co/storage/v1/object/public/render-studio/1775607389780-elevation.jpg",
    title: "Traditional Elevation — Dusk",
    type:  "Exterior Dusk",
  },
  {
    url:   "https://qvgsdrjkjtzwtxfepyoe.supabase.co/storage/v1/object/public/render-studio/1775502302584-elevation.jpg",
    title: "Classic Elevation — Golden Hour",
    type:  "Exterior Golden Hour",
  },
  {
    url:   "https://qvgsdrjkjtzwtxfepyoe.supabase.co/storage/v1/object/public/render-studio/1775156293099-interior.jpg",
    title: "Living Area — Golden Hour",
    type:  "Interior",
  },
  {
    url:   "https://qvgsdrjkjtzwtxfepyoe.supabase.co/storage/v1/object/public/render-studio/1775608561463-elevation.jpg",
    title: "Modern Farmhouse — Midday",
    type:  "Exterior Midday",
  },
  {
    url:   "https://qvgsdrjkjtzwtxfepyoe.supabase.co/storage/v1/object/public/render-studio/1775345418634-elevation.jpg",
    title: "Craftsman Elevation — Night",
    type:  "Exterior Night",
  },
  {
    url:   "https://qvgsdrjkjtzwtxfepyoe.supabase.co/storage/v1/object/public/render-studio/1775090072907-interior.jpg",
    title: "Modern Interior — Natural Light",
    type:  "Interior",
  },
  {
    url:   "https://qvgsdrjkjtzwtxfepyoe.supabase.co/storage/v1/object/public/render-studio/1775094785433-floor_plan.jpg",
    title: "Floor Plan Render",
    type:  "Floor Plan",
  },
  {
    url:   "https://qvgsdrjkjtzwtxfepyoe.supabase.co/storage/v1/object/public/render-studio/1775122222672-elevation.jpg",
    title: "Contemporary Elevation — Dusk",
    type:  "Exterior Dusk",
  },
];

export default function RenderCarousel() {
  const trackRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (!trackRef.current) return;
    trackRef.current.scrollBy({ left: dir === "right" ? 340 : -340, behavior: "smooth" });
  };

  return (
    <div className="relative">
      {/* Fades */}
      <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-[#080808] to-transparent z-10 pointer-events-none" />
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={render.url}
                  alt={render.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white/80 truncate">{render.title}</p>
                  <p className="text-[10px] text-white/35 mt-0.5">{render.type}</p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 font-medium flex-shrink-0 ml-2">AI</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
