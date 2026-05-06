"use client";

import { useRef } from "react";
import CalendlyButton from "@/components/CalendlyButton";
import HomepageVideo, { type HomepageVideoHandle } from "@/components/landing/HomepageVideo";

function Arrow() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

export default function HeroActions() {
  const videoRef = useRef<HomepageVideoHandle>(null);

  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
        <CalendlyButton className="flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white text-[15px] font-semibold rounded-xl transition-colors shadow-2xl shadow-blue-600/25">
          Schedule a Demo <Arrow />
        </CalendlyButton>

        <button
          onClick={() => videoRef.current?.playWithSound()}
          className="flex items-center gap-2 px-8 py-4 border border-white/15 hover:border-white/30 bg-white/5 hover:bg-white/10 text-white/75 hover:text-white text-[15px] font-semibold rounded-xl transition-all duration-200"
        >
          <PlayIcon />
          Watch Demo
        </button>
      </div>

      <p className="text-xs text-white/20 mb-10">
        No commitment · Live demo in 30 minutes · Cancel anytime
      </p>

      <div className="max-w-4xl mx-auto">
        <HomepageVideo ref={videoRef} />
      </div>
    </>
  );
}
