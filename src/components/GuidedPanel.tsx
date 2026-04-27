"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CategoryWithOptions, Option, Project } from "@/types/database";

// ─── Copy generation ──────────────────────────────────────────────────────────

function buildIntroText(project: Project): string {
  const name = project.name ?? "Your new home";
  const attrs: string[] = [];
  if (project.beds) attrs.push(`${project.beds}-bedroom`);
  if (project.floors && project.floors > 1) attrs.push(`${project.floors}-storey`);
  if (project.home_type) attrs.push(project.home_type.toLowerCase());

  let sentence = `The ${name}`;
  if (attrs.length) sentence += ` is a ${attrs.join(", ")}`;
  if (project.baths) sentence += ` with ${project.baths} bath${project.baths > 1 ? "s" : ""}`;
  if (project.sqft) sentence += ` and ${project.sqft.toLocaleString()} sq ft of living space`;
  const parts = [sentence + "."];

  if (project.description) {
    const first =
      project.description.match(/^[^.!?]+[.!?]/)?.[0] ??
      project.description.slice(0, 110);
    parts.push(first.trim());
  }

  parts.push("Let's personalise every detail together.");
  return parts.join(" ");
}

// Simple positional templates — no keyword matching, maximum variety
const FIRST_TEMPLATES = [
  "Let's start by choosing your",
  "First up — your",
  "Let's begin with your",
  "Start with your",
];

const MID_TEMPLATES = [
  "Now let's pick your",
  "Great choice. Now your",
  "Choose your preferred",
  "Let's personalise your",
  "Next up — your",
  "What about your",
  "Time to choose your",
  "Now, your",
  "Select your",
  "How about your",
  "Moving on to your",
  "Next, your",
  "Let's choose your",
  "Your turn — choose your",
  "Now for your",
  "Great. Now let's do your",
  "On to your",
  "Let's sort your",
  "Up next, your",
  "Ready for your",
  "Let's nail your",
  "Over to your",
  "Now let's look at your",
  "Pick your",
];

const LAST_TEMPLATES = [
  "Finally, your",
  "Last one — your",
  "One last choice — your",
  "Almost there. Your",
  "To finish — your",
  "Last step — your",
];

function getPrompt(idx: number, total: number, catName: string): string {
  const name = catName.toLowerCase();
  if (total === 1) return `Let's choose your ${name}.`;
  if (idx === 0) {
    return `${FIRST_TEMPLATES[0]} ${name}.`;
  }
  if (idx === total - 1) {
    return `${LAST_TEMPLATES[idx % LAST_TEMPLATES.length]} ${name}.`;
  }
  return `${MID_TEMPLATES[(idx - 1) % MID_TEMPLATES.length]} ${name}.`;
}

// ─── Option card ──────────────────────────────────────────────────────────────

interface CardProps {
  option: Option;
  isSelected: boolean;
  isKeyFocused: boolean;
  accent: string;
  disabled: boolean;
  onClick: () => void;
  onFocus: () => void;
  onHover: () => void;
  onHoverEnd: () => void;
}

function OptionCard({
  option,
  isSelected,
  isKeyFocused,
  accent,
  disabled,
  onClick,
  onFocus,
  onHover,
  onHoverEnd,
}: CardProps) {
  const [hovered, setHovered] = useState(false);
  const highlighted = hovered || isKeyFocused;

  const delta = option.price_impact ?? 0;
  const priceLabel =
    delta === 0
      ? "Included"
      : delta > 0
      ? `+${delta.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        })}`
      : delta.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        });

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => { setHovered(true); onFocus(); onHover(); }}
      onMouseLeave={() => { setHovered(false); onHoverEnd(); }}
      disabled={disabled}
      style={{
        flexShrink: 0,
        width: 104,
        borderRadius: 6,
        // outline renders outside but is never clipped by parent overflow
        outline: isSelected
          ? `2px solid ${accent}`
          : highlighted
          ? `2px solid ${accent}70`
          : "2px solid transparent",
        outlineOffset: 0,
        border: "none",
        overflow: "hidden",
        cursor: disabled ? "default" : "pointer",
        background: isSelected
          ? `${accent}18`
          : highlighted
          ? "rgba(255,255,255,0.13)"
          : "rgba(255,255,255,0.05)",
        padding: 0,
        position: "relative",
        transition: "outline-color 0.14s, background 0.14s, opacity 0.2s",
        scrollSnapAlign: "start",
        textAlign: "center",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {/* Thumbnail */}
      <div
        style={{
          width: "100%",
          aspectRatio: "1",
          overflow: "hidden",
          position: "relative",
          background: "#0e0e0f",
        }}
      >
        {option.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={option.thumbnail_url}
            alt={option.friendly_name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: `linear-gradient(135deg, ${accent}18, ${accent}06)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 4,
                background: `${accent}25`,
              }}
            />
          </div>
        )}

        {/* Price badge */}
        <div
          style={{
            position: "absolute",
            top: 5,
            right: 5,
            background: "rgba(0,0,0,0.75)",
            borderRadius: 3,
            padding: "1px 5px",
            fontSize: 8,
            fontFamily: "var(--font-jost), sans-serif",
            fontWeight: 300,
            letterSpacing: "0.03em",
            color:
              delta > 0
                ? "#f5d78a"
                : delta < 0
                ? "#86efac"
                : "rgba(255,255,255,0.38)",
          }}
        >
          {priceLabel}
        </div>

        {/* Checkmark */}
        {isSelected && (
          <div
            style={{
              position: "absolute",
              top: 5,
              left: 5,
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg viewBox="0 0 12 12" fill="none" width={9} height={9}>
              <path
                d="M2 6l2.5 2.5L10 4"
                stroke="#080909"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Label */}
      <div style={{ padding: "7px 8px 8px" }}>
        <p
          style={{
            fontFamily: "var(--font-jost), sans-serif",
            fontWeight: 300,
            fontSize: 10,
            color: isSelected || highlighted
              ? "rgba(255,255,255,0.92)"
              : "rgba(255,255,255,0.58)",
            margin: 0,
            lineHeight: 1.3,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            transition: "color 0.15s",
          }}
        >
          {option.friendly_name}
        </p>
      </div>
    </button>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface GuidedPanelProps {
  project: Project;
  categories: CategoryWithOptions[];
  selectedOptions: Record<string, Option>;
  builderLogo?: string | null;
  builderName?: string | null;
  accentColor?: string | null;
  totalPrice: number;
  onOptionSelect: (categoryId: string, option: Option) => void;
  onOptionHover: (catId: string, option: Option | null) => void;
  onCategoryEnter: (category: CategoryWithOptions) => void;
  onFinished: () => void;
  onOpenSummary: () => void;
}

type Step = "intro" | "category" | "finale";

// ─── Main component ───────────────────────────────────────────────────────────

export default function GuidedPanel({
  project,
  categories,
  selectedOptions,
  builderLogo,
  builderName,
  accentColor,
  totalPrice,
  onOptionSelect,
  onOptionHover,
  onCategoryEnter,
  onFinished,
  onOpenSummary,
}: GuidedPanelProps) {
  const accent = accentColor ?? "#C9A96E";

  const [step, setStep]           = useState<Step>("intro");
  const [catIdx, setCatIdx]       = useState(0);
  const [entered, setEntered]     = useState(false);
  const [introTyped, setIntroTyped] = useState("");
  const [showCTA, setShowCTA]     = useState(false);
  const [panelIn, setPanelIn]     = useState(false);
  const [focusIdx, setFocusIdx]   = useState(0);
  const [selecting, setSelecting] = useState(false);
  const [isTouch, setIsTouch]     = useState(false);
  const [mobileOptIdx, setMobileOptIdx] = useState(0);

  const [isTransitioning, setIsTransitioning] = useState(false);

  const selectRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartX = useRef(0);
  const introText  = useMemo(() => buildIntroText(project), [project]);

  const currentCat  = categories[catIdx];
  const selectedOpt = currentCat ? selectedOptions[currentCat.id] : undefined;

  // ── Guard: clamp catIdx when conditional categories are removed mid-flow
  // (e.g. user goes back and deselects the option that unlocked a category).
  useEffect(() => {
    if (step === "category" && categories.length > 0 && catIdx >= categories.length) {
      setCatIdx(categories.length - 1);
    }
  }, [categories.length, catIdx, step]);

  // ── Entrance — delay matches Preloader fade (700 ms) so content appears
  // as the Preloader finishes dissolving, not before it starts.
  useEffect(() => {
    const id = setTimeout(() => setEntered(true), 500);
    return () => clearTimeout(id);
  }, []);

  // ── Detect touch/coarse-pointer device
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    setIsTouch(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsTouch(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // ── On mobile: reset mobileOptIdx to currently selected option when category changes
  useEffect(() => {
    if (step !== "category" || !currentCat) return;
    const selIdx = currentCat.options.findIndex(o => o.id === selectedOptions[currentCat.id]?.id);
    setMobileOptIdx(selIdx >= 0 ? selIdx : 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catIdx, step]);

  // ── On mobile: preview whichever option is currently shown
  useEffect(() => {
    if (!isTouch || step !== "category" || !currentCat) return;
    const opt = currentCat.options[mobileOptIdx];
    if (opt) onOptionHover(currentCat.id, opt);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobileOptIdx, isTouch, catIdx, step]);

  // ── Typewriter — waits for `entered` so text only appears after Preloader fades
  useEffect(() => {
    if (step !== "intro" || !entered) return;
    setIntroTyped("");
    setShowCTA(false);
    let i = 0;
    const id = setInterval(() => {
      i++;
      setIntroTyped(introText.slice(0, i));
      if (i >= introText.length) {
        clearInterval(id);
        setTimeout(() => setShowCTA(true), 400);
      }
    }, 24);
    return () => clearInterval(id);
  }, [step, introText, entered]);

  // ── Panel slide-in when entering category step
  useEffect(() => {
    if (step !== "category") return;
    setPanelIn(false);
    const t = setTimeout(() => setPanelIn(true), 40);
    return () => clearTimeout(t);
  }, [step]);

  // ── Notify parent + reset focus when category changes
  useEffect(() => {
    if (step !== "category" || !currentCat) return;
    onCategoryEnter(currentCat);
    setFocusIdx(0);
    // Clear any hover preview when moving to a new category
    onOptionHover(currentCat.id, null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catIdx, step]);

  // ── Keyboard navigation
  useEffect(() => {
    if (step !== "category" || !currentCat) return;
    const opts = currentCat.options;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") {
        setFocusIdx(i => Math.min(i + 1, opts.length - 1));
        e.preventDefault();
      } else if (e.key === "ArrowLeft") {
        setFocusIdx(i => Math.max(i - 1, 0));
        e.preventDefault();
      } else if ((e.key === "Enter" || e.key === " ") && opts[focusIdx]) {
        selectOption(opts[focusIdx]);
        e.preventDefault();
      } else if (e.key === "Escape") {
        onFinished();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, catIdx, focusIdx]);

  function advance(dir: "next" | "prev" = "next") {
    if (selectRef.current) clearTimeout(selectRef.current);
    const next = dir === "next" ? catIdx + 1 : catIdx - 1;
    if (next >= categories.length) {
      setIsTransitioning(true);
      setTimeout(() => setStep("finale"), 200);
    } else if (next < 0) {
      return;
    } else {
      setIsTransitioning(true);
      setTimeout(() => { setCatIdx(next); }, 200);
      setTimeout(() => { setIsTransitioning(false); }, 230);
    }
  }

  function selectOption(option: Option) {
    if (!currentCat || selecting) return;
    setSelecting(true);
    onOptionSelect(currentCat.id, option);
    selectRef.current = setTimeout(() => {
      setSelecting(false);
      advance("next");
    }, 480);
  }

  function jumpTo(idx: number) {
    if (idx === catIdx) return;
    setIsTransitioning(true);
    setTimeout(() => { setCatIdx(idx); }, 200);
    setTimeout(() => { setIsTransitioning(false); }, 230);
  }

  const totalFormatted = totalPrice.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes gp-fadeUp  { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes gp-cursor  { 0%,100% { opacity:1; } 50% { opacity:0; } }
      `}</style>

      {/* ── Intro overlay ────────────────────────────────────────────────── */}
      {/* Background is always opaque — prevents any flash of the 3D scene.    */}
      {/* Only the inner content fades/slides in via `entered` state.          */}
      {step === "intro" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 90,
            background: "rgba(5,7,14,0.9)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 40px",
          }}
        >
          {/* Brand */}
          {(builderLogo || builderName) && (
            <div
              style={{
                marginBottom: 44,
                opacity: entered ? 1 : 0,
                transition: "opacity 0.8s ease 0.1s",
              }}
            >
              {builderLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={builderLogo}
                  alt={builderName ?? ""}
                  style={{ height: 28, objectFit: "contain", opacity: 0.7 }}
                />
              ) : (
                <span
                  style={{
                    fontFamily: "var(--font-jost), sans-serif",
                    fontWeight: 200,
                    fontSize: 10,
                    letterSpacing: "0.4em",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.35)",
                  }}
                >
                  {builderName}
                </span>
              )}
            </div>
          )}

          {/* Typewriter */}
          <div
            style={{
              maxWidth: 480,
              textAlign: "center",
              marginBottom: 48,
              minHeight: "7em",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-cormorant), Georgia, serif",
                fontWeight: 300,
                fontSize: "clamp(20px, 3vw, 28px)",
                color: "rgba(255,255,255,0.85)",
                lineHeight: 1.65,
                letterSpacing: "0.02em",
                margin: 0,
              }}
            >
              {introTyped}
              {entered && !showCTA && (
                <span
                  style={{
                    marginLeft: 2,
                    color: accent,
                    animation: "gp-cursor 1s ease-in-out infinite",
                    display: "inline-block",
                  }}
                >
                  |
                </span>
              )}
            </p>
          </div>

          {/* CTAs */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
              opacity: showCTA ? 1 : 0,
              transform: showCTA ? "translateY(0)" : "translateY(10px)",
              transition: "opacity 0.5s ease, transform 0.5s ease",
              pointerEvents: showCTA ? "auto" : "none",
            }}
          >
            <button
              onClick={() => {
                if (categories.length === 0) {
                  setStep("finale");
                } else {
                  setCatIdx(0);
                  setStep("category");
                }
              }}
              style={{
                fontFamily: "var(--font-jost), sans-serif",
                fontWeight: 300,
                fontSize: 11,
                letterSpacing: "0.3em",
                textTransform: "uppercase",
                color: "#080909",
                background: accent,
                border: "none",
                borderRadius: 2,
                padding: "14px 48px",
                cursor: "pointer",
              }}
            >
              Begin Configuring
            </button>
            <button
              onClick={onFinished}
              style={{
                fontFamily: "var(--font-jost), sans-serif",
                fontWeight: 200,
                fontSize: 9,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.22)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px 8px",
              }}
            >
              Explore freely
            </button>
          </div>
        </div>
      )}

      {/* ── Bottom panel ─────────────────────────────────────────────────── */}
      {step === "category" && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 95,
            background: "rgba(8,9,9,0.55)",
            backdropFilter: "blur(32px)",
            WebkitBackdropFilter: "blur(32px)",
            borderTop: `1px solid ${accent}20`,
            transform: panelIn ? "translateY(0)" : "translateY(40px)",
            opacity: panelIn ? 1 : 0,
            transition:
              "transform 0.52s cubic-bezier(0.16,1,0.3,1), opacity 0.38s ease",
          }}
        >
          {/* Progress dots */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              paddingTop: 8,
              paddingBottom: 2,
            }}
          >
            {categories.map((cat, i) => {
              const isDone    = !!selectedOptions[cat.id];
              const isCurrent = i === catIdx;
              return (
                <button
                  key={cat.id}
                  onClick={() => jumpTo(i)}
                  title={cat.name}
                  style={{
                    width:  isCurrent ? 20 : isDone ? 6 : 5,
                    height: isCurrent ? 4  : isDone ? 5 : 4,
                    borderRadius: isCurrent ? 2 : "50%",
                    background: isCurrent
                      ? accent
                      : isDone
                      ? `${accent}75`
                      : "rgba(255,255,255,0.14)",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    transition: "width 0.28s ease, background 0.28s ease",
                    flexShrink: 0,
                  }}
                />
              );
            })}
          </div>

          {/* Animated category content */}
          <div
            style={{
              padding: "6px 20px 12px",
              textAlign: "center",
              opacity: isTransitioning ? 0 : 1,
              transform: isTransitioning ? "translateY(10px)" : "translateY(0)",
              transition: `opacity ${isTransitioning ? "0.18s" : "0.32s"} ease, transform ${isTransitioning ? "0.18s" : "0.32s"} ease`,
            }}
          >
            {currentCat && (
              <>
                {/* Eyebrow */}
                <p
                  style={{
                    fontFamily: "var(--font-jost), sans-serif",
                    fontWeight: 200,
                    fontSize: 8,
                    letterSpacing: "0.28em",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.9)",
                    margin: "0 0 4px",
                  }}
                >
                  {String(currentCat.phase).charAt(0).toUpperCase() +
                    String(currentCat.phase).slice(1)}{" "}
                  &middot; {catIdx + 1} of {categories.length}
                </p>

                {/* Prompt */}
                <h2
                  style={{
                    fontFamily: "var(--font-cormorant), Georgia, serif",
                    fontWeight: 300,
                    fontSize: isTouch ? "clamp(15px, 2.2vw, 20px)" : "clamp(22px, 3.3vw, 30px)",
                    color: "rgba(255,255,255,0.88)",
                    margin: "0 0 10px",
                    lineHeight: 1.2,
                    letterSpacing: "0.01em",
                  }}
                >
                  {getPrompt(catIdx, categories.length, currentCat.name)}
                </h2>

                {/* Option display — desktop: scroll carousel / mobile: single-card nav */}
                {isTouch ? (
                  /* ── Mobile single-card navigator ── */
                  <div
                    style={{ marginBottom: 8 }}
                    onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
                    onTouchEnd={e => {
                      const dx = e.changedTouches[0].clientX - touchStartX.current;
                      if (dx > 55 && mobileOptIdx > 0) setMobileOptIdx(i => i - 1);
                      if (dx < -55 && mobileOptIdx < currentCat.options.length - 1) setMobileOptIdx(i => i + 1);
                    }}
                  >
                    {/* Option dots */}
                    <div style={{ display: "flex", justifyContent: "center", gap: 4, marginBottom: 7 }}>
                      {currentCat.options.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setMobileOptIdx(i)}
                          style={{
                            width: i === mobileOptIdx ? 14 : 4,
                            height: 3,
                            borderRadius: 2,
                            background: i === mobileOptIdx ? accent : "rgba(255,255,255,0.2)",
                            border: "none",
                            padding: 0,
                            cursor: "pointer",
                            transition: "width 0.25s ease, background 0.25s ease",
                          }}
                        />
                      ))}
                    </div>

                    {/* Card + arrows */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                      <button
                        onClick={() => mobileOptIdx > 0 && setMobileOptIdx(i => i - 1)}
                        disabled={mobileOptIdx === 0}
                        style={{
                          width: 24, height: 24, flexShrink: 0,
                          borderRadius: "50%",
                          background: mobileOptIdx === 0 ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.09)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          color: mobileOptIdx === 0 ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.6)",
                          cursor: mobileOptIdx === 0 ? "default" : "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "background 0.15s",
                        }}
                      >
                        <svg viewBox="0 0 12 12" fill="none" width={8} height={8} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M8 2L4 6l4 4" />
                        </svg>
                      </button>

                      {/* Option card */}
                      {(() => {
                        const opt = currentCat.options[mobileOptIdx];
                        if (!opt) return null;
                        const delta = opt.price_impact ?? 0;
                        const priceLabel = delta === 0
                          ? "Included"
                          : delta > 0
                          ? `+${delta.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}`
                          : delta.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
                        const isSelected = selectedOpt?.id === opt.id;
                        return (
                          <div style={{ flex: 1, maxWidth: 160 }}>
                            <div style={{
                              borderRadius: 6,
                              overflow: "hidden",
                              outline: isSelected ? `2px solid ${accent}` : `2px solid ${accent}45`,
                              outlineOffset: 0,
                              background: "rgba(255,255,255,0.06)",
                            }}>
                              <div style={{ width: "100%", aspectRatio: "16/9", position: "relative", background: "#0e0e0f", overflow: "hidden" }}>
                                {opt.thumbnail_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={opt.thumbnail_url} alt={opt.friendly_name}
                                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                                ) : (
                                  <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg, ${accent}18, ${accent}06)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <div style={{ width: 28, height: 28, borderRadius: 4, background: `${accent}25` }} />
                                  </div>
                                )}
                                {isSelected && (
                                  <div style={{ position: "absolute", top: 5, left: 5, width: 14, height: 14, borderRadius: "50%", background: accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <svg viewBox="0 0 12 12" fill="none" width={8} height={8}>
                                      <path d="M2 6l2.5 2.5L10 4" stroke="#080909" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                  </div>
                                )}
                              </div>
                              <div style={{ padding: "5px 8px 7px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                <p style={{ fontFamily: "var(--font-jost), sans-serif", fontWeight: 300, fontSize: 10, color: "rgba(255,255,255,0.85)", margin: 0 }}>
                                  {opt.friendly_name}
                                </p>
                                <span style={{ fontFamily: "var(--font-jost), sans-serif", fontWeight: 300, fontSize: 9, color: delta > 0 ? "#f5d78a" : delta < 0 ? "#86efac" : "rgba(255,255,255,0.35)" }}>
                                  {priceLabel}
                                </span>
                              </div>
                            </div>
                            {/* Confirm button */}
                            <button
                              onClick={() => selectOption(opt)}
                              disabled={selecting}
                              style={{
                                width: "100%",
                                marginTop: 6,
                                padding: "7px 0",
                                background: isSelected ? `${accent}22` : accent,
                                border: isSelected ? `1px solid ${accent}60` : "none",
                                borderRadius: 3,
                                fontFamily: "var(--font-jost), sans-serif",
                                fontWeight: 300,
                                fontSize: 9,
                                letterSpacing: "0.22em",
                                textTransform: "uppercase",
                                color: isSelected ? accent : "#080909",
                                cursor: selecting ? "default" : "pointer",
                                transition: "background 0.15s",
                              }}
                            >
                              {isSelected ? "Selected" : "Select"}
                            </button>
                          </div>
                        );
                      })()}

                      <button
                        onClick={() => mobileOptIdx < currentCat.options.length - 1 && setMobileOptIdx(i => i + 1)}
                        disabled={mobileOptIdx === currentCat.options.length - 1}
                        style={{
                          width: 24, height: 24, flexShrink: 0,
                          borderRadius: "50%",
                          background: mobileOptIdx === currentCat.options.length - 1 ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.09)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          color: mobileOptIdx === currentCat.options.length - 1 ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.6)",
                          cursor: mobileOptIdx === currentCat.options.length - 1 ? "default" : "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          transition: "background 0.15s",
                        }}
                      >
                        <svg viewBox="0 0 12 12" fill="none" width={8} height={8} stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 2l4 4-4 4" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ) : (
                /* ── Desktop scroll carousel ── */
                <div
                  style={{
                    display: "flex",
                    gap: 9,
                    overflowX: "auto",
                    justifyContent: "safe center",
                    scrollSnapType: "x mandatory",
                    WebkitOverflowScrolling: "touch",
                    scrollbarWidth: "none",
                    msOverflowStyle: "none",
                    marginBottom: 14,
                    paddingTop: 6,
                    paddingBottom: 8,
                    paddingLeft: 4,
                    paddingRight: 4,
                  }}
                >
                  {currentCat.options.map((opt, i) => (
                    <OptionCard
                      key={opt.id}
                      option={opt}
                      isSelected={selectedOpt?.id === opt.id}
                      isKeyFocused={i === focusIdx}
                      accent={accent}
                      disabled={selecting}
                      onClick={() => selectOption(opt)}
                      onFocus={() => setFocusIdx(i)}
                      onHover={() => onOptionHover(currentCat.id, opt)}
                      onHoverEnd={() => onOptionHover(currentCat.id, null)}
                    />
                  ))}
                </div>
                )}

                {/* Footer */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 16,
                  }}
                >
                  {/* Back */}
                  {catIdx > 0 && (
                    <button
                      onClick={() => advance("prev")}
                      style={{
                        fontFamily: "var(--font-jost), sans-serif",
                        fontWeight: 200,
                        fontSize: 8,
                        letterSpacing: "0.22em",
                        textTransform: "uppercase",
                        color: "rgba(255,255,255,0.22)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <svg
                        viewBox="0 0 12 12"
                        fill="none"
                        width={8}
                        height={8}
                        stroke="currentColor"
                        strokeWidth={1.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M8 2L4 6l4 4" />
                      </svg>
                      Back
                    </button>
                  )}

                  {/* Estimate */}
                  <div>
                    <p
                      style={{
                        fontFamily: "var(--font-jost), sans-serif",
                        fontWeight: 200,
                        fontSize: 7,
                        letterSpacing: "0.22em",
                        textTransform: "uppercase",
                        color: "rgba(255,255,255,0.2)",
                        margin: "0 0 2px",
                      }}
                    >
                      Estimate
                    </p>
                    <p
                      style={{
                        fontFamily: "var(--font-cormorant), Georgia, serif",
                        fontWeight: 400,
                        fontSize: 18,
                        color: "rgba(255,255,255,0.72)",
                        margin: 0,
                        lineHeight: 1,
                        letterSpacing: "0.01em",
                      }}
                    >
                      {totalFormatted}
                    </p>
                  </div>

                  {/* Skip */}
                  {!currentCat.is_mandatory && (
                    <button
                      onClick={() => advance("next")}
                      style={{
                        fontFamily: "var(--font-jost), sans-serif",
                        fontWeight: 200,
                        fontSize: 8,
                        letterSpacing: "0.22em",
                        textTransform: "uppercase",
                        color: "rgba(255,255,255,0.22)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      Skip
                    </button>
                  )}

                  {/* Exit */}
                  <button
                    onClick={onFinished}
                    style={{
                      fontFamily: "var(--font-jost), sans-serif",
                      fontWeight: 200,
                      fontSize: 8,
                      letterSpacing: "0.2em",
                      textTransform: "uppercase",
                      color: "rgba(255,255,255,0.2)",
                      background: "none",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 2,
                      padding: "5px 12px",
                      cursor: "pointer",
                    }}
                  >
                    Exit guide
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Finale overlay ────────────────────────────────────────────────── */}
      {step === "finale" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 150,
            background: "rgba(5,7,14,0.92)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 40px",
            textAlign: "center",
            animation: "gp-fadeUp 0.6s ease forwards",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-jost), sans-serif",
              fontWeight: 200,
              fontSize: 9,
              letterSpacing: "0.38em",
              textTransform: "uppercase",
              color: accent,
              margin: "0 0 18px",
            }}
          >
            Configuration complete
          </p>

          <h2
            style={{
              fontFamily: "var(--font-cormorant), Georgia, serif",
              fontWeight: 300,
              fontSize: "clamp(30px, 5vw, 54px)",
              color: "rgba(255,255,255,0.92)",
              letterSpacing: "0.02em",
              lineHeight: 1.1,
              margin: "0 0 10px",
            }}
          >
            {project.name}
          </h2>

          <p
            style={{
              fontFamily: "var(--font-cormorant), Georgia, serif",
              fontStyle: "italic",
              fontWeight: 300,
              fontSize: "clamp(15px, 2.2vw, 20px)",
              color: "rgba(255,255,255,0.32)",
              letterSpacing: "0.03em",
              margin: "0 0 52px",
            }}
          >
            Every detail, chosen by you.
          </p>

          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <button
              onClick={() => { onFinished(); onOpenSummary(); }}
              style={{
                fontFamily: "var(--font-jost), sans-serif",
                fontWeight: 300,
                fontSize: 11,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                color: "#080909",
                background: accent,
                border: "none",
                borderRadius: 2,
                padding: "14px 40px",
                cursor: "pointer",
              }}
            >
              View Summary
            </button>
            <button
              onClick={onFinished}
              style={{
                fontFamily: "var(--font-jost), sans-serif",
                fontWeight: 200,
                fontSize: 11,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.4)",
                background: "none",
                border: "1px solid rgba(255,255,255,0.13)",
                borderRadius: 2,
                padding: "14px 32px",
                cursor: "pointer",
              }}
            >
              Keep Exploring
            </button>
          </div>

          <p
            style={{
              fontFamily: "var(--font-jost), sans-serif",
              fontWeight: 200,
              fontSize: 15,
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.18)",
              marginTop: 40,
              textTransform: "uppercase",
            }}
          >
            Estimated total &nbsp;
            <span
              style={{
                fontFamily: "var(--font-cormorant), Georgia, serif",
                fontSize: 33,
                fontWeight: 400,
                color: "rgba(255,255,255,0.5)",
                letterSpacing: "0.01em",
              }}
            >
              {totalFormatted}
            </span>
          </p>
        </div>
      )}
    </>
  );
}
