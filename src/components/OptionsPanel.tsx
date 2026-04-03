"use client";

import { CategoryWithOptions, Option } from "@/types/database";
import { PhaseId } from "@/constants/phases";

interface OptionsPanelProps {
  categories: CategoryWithOptions[];
  currentPhase: PhaseId;
  selectedOptions: Record<string, string>;
  onOptionSelect: (categoryId: string, option: Option) => void;
}

export default function OptionsPanel({
  categories,
  currentPhase,
  selectedOptions,
  onOptionSelect,
}: OptionsPanelProps) {
  const visible = categories.filter(
    (c) => c.phase?.toLowerCase() === currentPhase?.toLowerCase()
  );

  if (visible.length === 0) return null;

  return (
    <div
      className="absolute right-4 top-20 bottom-24 z-50 w-[260px] flex flex-col gap-2.5 overflow-y-auto"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      {visible.map((category) => (
        <div
          key={category.id}
          className="flex-shrink-0 rounded-2xl p-4"
          style={{
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          }}
        >
          <p
            className="text-[9px] font-bold uppercase tracking-[0.18em] mb-3"
            style={{ color: "rgba(255,255,255,0.28)", fontFamily: "var(--font-syne), sans-serif" }}
          >
            {category.name}
          </p>

          <div className="flex flex-col gap-1">
            {category.options.map((option) => {
              const isSelected = selectedOptions[category.id] === option.id;
              return (
                <button
                  key={option.id}
                  onClick={() => onOptionSelect(category.id, option)}
                  className="flex items-center justify-between w-full rounded-xl px-3 py-2.5 text-left transition-all duration-150 select-none group"
                  style={isSelected ? {
                    background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
                  } : {
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.05)",
                  }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Selection indicator */}
                    <span
                      className="flex-shrink-0 w-1.5 h-1.5 rounded-full transition-all duration-150"
                      style={{
                        background: isSelected ? "#60a5fa" : "rgba(255,255,255,0.15)",
                        boxShadow: isSelected ? "0 0 6px rgba(96,165,250,0.5)" : "none",
                      }}
                    />
                    <span
                      className="text-xs font-medium leading-snug truncate transition-colors"
                      style={{ color: isSelected ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.5)" }}
                    >
                      {option.friendly_name}
                    </span>
                  </div>

                  {/* Price */}
                  <span
                    className="text-[10px] font-semibold flex-shrink-0 ml-2 transition-colors"
                    style={{ color: isSelected ? "#93c5fd" : "rgba(255,255,255,0.2)" }}
                  >
                    {option.price_impact === 0
                      ? "incl."
                      : `${option.price_impact > 0 ? "+" : ""}${option.price_impact.toLocaleString("en-US", {
                          style: "currency",
                          currency: "USD",
                          maximumFractionDigits: 0,
                        })}`
                    }
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
