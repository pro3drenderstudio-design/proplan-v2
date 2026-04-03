"use client";

import { PHASES, PhaseId } from "@/constants/phases";

interface PhaseControllerProps {
  currentPhase: PhaseId;
  setPhase: (phase: PhaseId) => void;
}

const PHASE_ICONS: Record<string, React.ReactNode> = {
  exterior: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-3 h-3">
      <path strokeLinecap="round" strokeLinejoin="round" d="M1.5 6.5L8 1.5l6.5 5V14.5h-4.5v-3.5h-4V14.5H1.5V6.5z" />
    </svg>
  ),
  interior: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-3 h-3">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 14V4.5L8 2l6 2.5V14M5.5 14V9.5h5V14" />
    </svg>
  ),
  blueprint: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-3 h-3">
      <rect x="1.5" y="1.5" width="13" height="13" rx="1" />
      <path strokeLinecap="round" d="M5 1.5v13M1.5 5h13M1.5 11h13M11 1.5v13" />
    </svg>
  ),
};

export default function PhaseController({ currentPhase, setPhase }: PhaseControllerProps) {
  return (
    <div className="absolute top-5 left-1/2 -translate-x-1/2 z-50">
      <div
        className="flex items-center gap-1 rounded-2xl p-1.5 shadow-2xl shadow-black/60"
        style={{
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.09)",
        }}
      >
        {PHASES.map((phase, i) => {
          const isActive = phase.id === currentPhase;
          return (
            <button
              key={phase.id}
              onClick={() => setPhase(phase.id)}
              title={phase.description}
              className={[
                "relative flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-semibold tracking-widest uppercase transition-all duration-200 select-none",
                isActive
                  ? "text-white"
                  : "text-white/35 hover:text-white/65",
              ].join(" ")}
              style={isActive ? {
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.18)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
              } : {
                border: "1px solid transparent",
              }}
            >
              <span className={`transition-colors ${isActive ? "text-blue-400" : "text-white/25"}`}>
                {PHASE_ICONS[phase.id]}
              </span>
              <span>{phase.label}</span>
              <span
                className="font-mono text-[9px] ml-0.5"
                style={{ color: isActive ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.15)" }}
              >
                0{i + 1}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
