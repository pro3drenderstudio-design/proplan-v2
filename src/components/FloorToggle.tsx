"use client";

import { LevelId } from "@/logic/visibilityController";
import { PhaseId } from "@/constants/phases";

interface FloorToggleProps {
  floors: number;
  currentLevel: LevelId;
  currentPhase: PhaseId;
  onLevelChange: (level: LevelId) => void;
}

export default function FloorToggle({ floors, currentLevel, currentPhase, onLevelChange }: FloorToggleProps) {
  if (currentPhase !== "blueprint") return null;

  const count  = Math.min(Math.max(floors, 1), 3);
  const levels = Array.from({ length: count }, (_, i) => (i + 1) as LevelId);

  return (
    <div
      className="flex items-center gap-1 rounded-xl px-3 py-2"
      style={{
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: "1px solid rgba(255,255,255,0.09)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
      }}
    >
      <span
        className="text-[9px] font-bold uppercase tracking-widest pr-2"
        style={{ color: "rgba(255,255,255,0.28)" }}
      >
        Floor
      </span>
      {levels.map((lvl) => {
        const isActive = lvl === currentLevel;
        return (
          <button
            key={lvl}
            onClick={() => onLevelChange(lvl)}
            className="w-7 h-7 rounded-lg text-xs font-bold transition-all duration-150 select-none"
            style={isActive ? {
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.22)",
              color: "rgba(255,255,255,0.9)",
            } : {
              border: "1px solid transparent",
              color: "rgba(255,255,255,0.3)",
            }}
          >
            {lvl}
          </button>
        );
      })}
    </div>
  );
}
