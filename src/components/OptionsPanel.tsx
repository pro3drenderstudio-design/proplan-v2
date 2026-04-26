"use client";

import { useEffect, useRef, useState } from "react";
import { CategoryWithOptions, Option } from "@/types/database";
import { PhaseId } from "@/constants/phases";

interface OptionsPanelProps {
  categories: CategoryWithOptions[];
  currentPhase: PhaseId;
  selectedOptions: Record<string, string>;
  onOptionSelect: (categoryId: string, option: Option) => void;
  favorites?: Set<string>;
  onToggleFavorite?: (optionId: string) => void;
  isOpen?: boolean;
  phaseMessage?: string;
  /** When true, renders as flow content (no fixed/absolute positioning) for use in a scrollable container */
  stackMode?: boolean;
}

const scrollStyle: React.CSSProperties = { scrollbarWidth: "none", msOverflowStyle: "none" };

function OptionRow({
  option,
  isSelected,
  isFav,
  onSelect,
  onToggleFavorite,
  compact = false,
}: {
  option: Option;
  isSelected: boolean;
  isFav: boolean;
  onSelect: () => void;
  onToggleFavorite?: () => void;
  compact?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const hasThumb = !!option.thumbnail_url;

  const thumbSize    = compact ? 14 : hovered ? 36 : 22;
  const thumbRadius  = compact ? 4  : hovered ? 8 : 9999;
  const vertPad      = compact ? 5  : hasThumb ? (hovered ? 6 : 8) : 10;

  return (
    <div className="flex items-center gap-1" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <button
        onClick={onSelect}
        className="flex-1 flex items-center gap-2 rounded-xl px-2 text-left transition-all duration-200 select-none min-w-0 group"
        style={{
          paddingTop: vertPad,
          paddingBottom: vertPad,
          background: isSelected
            ? "rgba(255,255,255,0.09)"
            : hovered
            ? "rgba(255,255,255,0.055)"
            : "rgba(255,255,255,0.03)",
          border: isSelected
            ? "1px solid rgba(255,255,255,0.18)"
            : hovered
            ? "1px solid rgba(255,255,255,0.1)"
            : "1px solid rgba(255,255,255,0.05)",
          boxShadow: isSelected ? "inset 0 1px 0 rgba(255,255,255,0.06)" : "none",
        }}
      >
        {/* Thumbnail / dot */}
        {hasThumb ? (
          <div
            className="flex-shrink-0 overflow-hidden transition-all duration-200"
            style={{
              width: thumbSize,
              height: thumbSize,
              borderRadius: thumbRadius,
              boxShadow: hovered && !compact
                ? "0 4px 12px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.15)"
                : isSelected
                ? "0 0 0 2px rgba(255,255,255,0.25)"
                : "0 0 0 1px rgba(255,255,255,0.12)",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={option.thumbnail_url!}
              alt={option.friendly_name}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <span
            className="flex-shrink-0 rounded-full transition-all duration-200"
            style={{
              width: compact ? 5 : hovered ? 8 : 6,
              height: compact ? 5 : hovered ? 8 : 6,
              background: isSelected ? "#60a5fa" : hovered ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.15)",
              boxShadow: isSelected ? "0 0 6px rgba(96,165,250,0.5)" : "none",
            }}
          />
        )}

        {/* Label */}
        <span
          className="flex-1 font-medium leading-snug truncate transition-colors duration-150"
          style={{
            fontSize: compact ? 10 : 12,
            color: isSelected ? "rgba(255,255,255,0.92)" : hovered ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.5)",
          }}
        >
          {option.friendly_name}
        </span>

        {/* Price */}
        <span
          className="font-semibold flex-shrink-0 ml-1 transition-colors"
          style={{
            fontSize: compact ? 9 : 10,
            color: isSelected ? "#93c5fd" : hovered ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.2)",
          }}
        >
          {option.price_impact === 0
            ? "incl."
            : `${option.price_impact > 0 ? "+" : ""}${option.price_impact.toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 0,
              })}`}
        </span>
      </button>

      {onToggleFavorite && !compact && (
        <button
          onClick={onToggleFavorite}
          className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-150"
          style={{
            background: isFav ? "rgba(245,158,11,0.15)" : "transparent",
            border: isFav ? "1px solid rgba(245,158,11,0.25)" : "1px solid transparent",
            opacity: hovered || isFav ? 1 : 0,
          }}
          title={isFav ? "Remove from favorites" : "Save to favorites"}
        >
          <svg viewBox="0 0 16 16" className="w-3 h-3 transition-all duration-150"
            fill={isFav ? "#f59e0b" : "none"} stroke={isFav ? "#f59e0b" : "rgba(255,255,255,0.22)"} strokeWidth={1.5}>
            <path strokeLinejoin="round" d="M8 1.5l1.795 3.637 4.012.583-2.904 2.827.685 3.993L8 10.507l-3.588 1.883.685-3.993-2.904-2.827 4.012-.583L8 1.5z" />
          </svg>
        </button>
      )}
    </div>
  );
}

function CategoryCard({
  category,
  selectedOptions,
  onOptionSelect,
  favorites,
  onToggleFavorite,
  compact = false,
}: {
  category: CategoryWithOptions;
  selectedOptions: Record<string, string>;
  onOptionSelect: (categoryId: string, option: Option) => void;
  favorites?: Set<string>;
  onToggleFavorite?: (optionId: string) => void;
  compact?: boolean;
}) {
  return (
    <div
      className="flex-shrink-0 rounded-xl"
      style={{
        padding: compact ? "8px 10px" : 16,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
      }}
    >
      <p
        className="font-bold uppercase"
        style={{
          fontSize: compact ? 8 : 9,
          letterSpacing: "0.18em",
          marginBottom: compact ? 6 : 12,
          color: "rgba(255,255,255,0.28)",
          fontFamily: "var(--font-syne), sans-serif",
        }}
      >
        {category.name}
      </p>

      <div className="flex flex-col gap-0.5">
        {category.options.map((option) => (
          <OptionRow
            key={option.id}
            option={option}
            isSelected={selectedOptions[category.id] === option.id}
            isFav={favorites?.has(option.id) ?? false}
            onSelect={() => onOptionSelect(category.id, option)}
            onToggleFavorite={onToggleFavorite ? () => onToggleFavorite(option.id) : undefined}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
}

export default function OptionsPanel({
  categories,
  currentPhase,
  selectedOptions,
  onOptionSelect,
  favorites,
  onToggleFavorite,
  isOpen = true,
  phaseMessage,
  stackMode = false,
}: OptionsPanelProps) {
  const mobileRef  = useRef<HTMLDivElement>(null);
  const desktopRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mobileRef.current?.scrollTo({ top: 0, behavior: "instant" });
    desktopRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }, [currentPhase]);

  const selectedOptionIds = new Set(Object.values(selectedOptions));
  const visible = categories.filter((c) => {
    if (c.phase?.toLowerCase() !== currentPhase?.toLowerCase()) return false;
    if (!c.show_when || c.show_when.length === 0) return true;
    return c.show_when.some((id) => selectedOptionIds.has(id));
  });

  if (visible.length === 0) return null;

  const messageNode = phaseMessage ? (
    <p
      className="text-[10px] leading-relaxed px-1"
      style={{ color: "rgba(255,255,255,0.38)", fontStyle: "italic" }}
    >
      {phaseMessage}
    </p>
  ) : null;

  // Stack mode: renders as a plain flow list for use inside a scrollable container
  if (stackMode) {
    return (
      <div className="flex flex-col gap-2.5 pb-2">
        {messageNode}
        {visible.map((category) => (
          <CategoryCard
            key={category.id}
            category={category}
            selectedOptions={selectedOptions}
            onOptionSelect={onOptionSelect}
            favorites={favorites}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Mobile: compact bottom sheet */}
      {isOpen && (
        <div
          ref={mobileRef}
          className="md:hidden fixed left-2 right-2 bottom-[72px] max-h-[28vh] z-[60] flex flex-col gap-1.5 overflow-y-auto pb-1"
          style={scrollStyle}
        >
          {messageNode}
          {visible.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              selectedOptions={selectedOptions}
              onOptionSelect={onOptionSelect}
              favorites={favorites}
              onToggleFavorite={onToggleFavorite}
              compact
            />
          ))}
        </div>
      )}

      {/* Desktop: always-visible absolute right panel */}
      <div
        ref={desktopRef}
        className="hidden md:flex absolute right-4 top-20 bottom-24 w-[260px] flex-col gap-2.5 overflow-y-auto"
        style={scrollStyle}
      >
        {messageNode}
        {visible.map((category) => (
          <CategoryCard
            key={category.id}
            category={category}
            selectedOptions={selectedOptions}
            onOptionSelect={onOptionSelect}
            favorites={favorites}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
    </>
  );
}
