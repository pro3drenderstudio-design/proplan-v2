"use client";

import { useEffect, useRef, useState } from "react";

export type PreloaderStatus = "initializing" | "optimizing" | "ready";

interface PreloaderProps {
  visible: boolean;
  /** Kept for API compatibility — not used for progress timing */
  downloadedBytes?: number;
  totalBytes?: number;
  /** When true, bar snaps to 100% and preloader fades out */
  viewerReady?: boolean;
  /** Builder accent color (hex) */
  accentColor?: string | null;
  builderName?: string | null;
  builderLogo?: string | null;
  status?: PreloaderStatus;
}

const MESSAGES = [
  "Preparing your design studio",
  "Loading structural geometry",
  "Calibrating surface materials",
  "Rendering environment lighting",
  "Configuring your selections",
  "Applying architectural finishes",
  "Finalising the details",
];

// Quadratic ease-out: fast start, decelerates to 85% exactly at 12 s.
// After 12 s, slow crawl 85 → 97% over 3 s.
// viewerReady snaps target to 100%.
function computeTarget(elapsedSec: number, viewerReady: boolean): number {
  if (viewerReady) return 100;
  if (elapsedSec <= 12) {
    const t = elapsedSec / 12;
    return 85 * (1 - Math.pow(1 - t, 2));
  }
  const overtime = Math.min(elapsedSec - 12, 3);
  return Math.min(85 + (overtime / 3) * 12, 97);
}

export default function Preloader({
  visible,
  viewerReady = false,
  accentColor,
  builderName,
  builderLogo,
}: PreloaderProps) {
  const accent  = accentColor ?? "#C9A96E"; // warm gold — luxury default
  const accent6 = `${accent}10`;            // 6% opacity for glow

  const [progress, setProgress]   = useState(0);
  const [msgIdx,   setMsgIdx]     = useState(0);
  const [msgShow,  setMsgShow]    = useState(true);
  const [entered,  setEntered]    = useState(false);

  const mountAt = useRef<number>(0);
  const rafRef  = useRef<number>(0);

  // Staggered entrance
  useEffect(() => {
    mountAt.current = performance.now();
    const t = setTimeout(() => setEntered(true), 60);
    return () => clearTimeout(t);
  }, []);

  // rAF-driven progress
  useEffect(() => {
    const tick = () => {
      const elapsed = (performance.now() - mountAt.current) / 1000;
      const target  = computeTarget(elapsed, viewerReady);
      setProgress(prev => {
        const d = target - prev;
        if (Math.abs(d) < 0.015) return target;
        return prev + d * 0.09;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [viewerReady]);

  // Message cross-fade every 2.6 s
  useEffect(() => {
    const id = setInterval(() => {
      setMsgShow(false);
      setTimeout(() => {
        setMsgIdx(i => (i + 1) % MESSAGES.length);
        setMsgShow(true);
      }, 380);
    }, 2600);
    return () => clearInterval(id);
  }, []);

  const fillPct = progress.toFixed(3);
  const showDot = progress > 0.5 && progress < 99.6;

  return (
    <div
      className={[
        "fixed inset-0 z-[100] select-none",
        "transition-opacity duration-700",
        visible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
      ].join(" ")}
      style={{ background: "#080909" }}
    >
      {/* ── Fonts & keyframes ─────────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Jost:wght@200;300&display=swap');

        @keyframes pl-shimmer {
          0%   { transform: translateX(-120%); }
          100% { transform: translateX(600%);  }
        }
        @keyframes pl-pulse {
          0%, 100% { box-shadow: 0 0 6px 2px ${accent}55; }
          50%       { box-shadow: 0 0 12px 4px ${accent}90; }
        }
        @keyframes pl-scan {
          0%   { top: -1px; opacity: 0; }
          5%   { opacity: 1; }
          95%  { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>

      {/* ── Architectural grid ────────────────────────────────────── */}
      <div
        aria-hidden
        style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: [
            "linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px)",
            "linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px)",
            "linear-gradient(rgba(255,255,255,0.009) 1px, transparent 1px)",
            "linear-gradient(90deg, rgba(255,255,255,0.009) 1px, transparent 1px)",
          ].join(","),
          backgroundSize: "80px 80px, 80px 80px, 20px 20px, 20px 20px",
        }}
      />

      {/* ── Scanning line (atmospheric) ───────────────────────────── */}
      <div
        aria-hidden
        style={{
          position: "absolute", left: 0, right: 0, height: 1,
          background: `linear-gradient(90deg, transparent, ${accent}18, transparent)`,
          animation: "pl-scan 8s linear infinite",
          animationDelay: "1.2s",
          pointerEvents: "none",
        }}
      />

      {/* ── Ambient centre glow ───────────────────────────────────── */}
      <div
        aria-hidden
        style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: `radial-gradient(ellipse 52% 42% at 50% 54%, ${accent6} 0%, transparent 68%)`,
        }}
      />

      {/* ── Corner L-marks ────────────────────────────────────────── */}
      {(["tl","tr","bl","br"] as const).map(pos => {
        const isRight  = pos.endsWith("r");
        const isBottom = pos.startsWith("b");
        return (
          <div
            key={pos}
            aria-hidden
            style={{
              position: "absolute",
              top:    isBottom ? undefined : 28,
              bottom: isBottom ? 28        : undefined,
              left:   isRight  ? undefined : 28,
              right:  isRight  ? 28        : undefined,
              opacity: entered ? 0.4 : 0,
              transition: "opacity 1.2s ease 0.3s",
            }}
          >
            {/* Horizontal arm */}
            <div style={{
              width: 20, height: 1,
              background: accent,
              marginBottom: isBottom ? undefined : 0,
              marginTop:    isBottom ? 0         : undefined,
              order: isBottom ? 1 : 0,
            }} />
            {/* Vertical arm */}
            <div style={{
              width: 1, height: 20,
              background: accent,
              marginLeft: isRight ? "auto" : 0,
              order: isBottom ? 0 : 1,
            }} />
          </div>
        );
      })}

      {/* ── Main content ──────────────────────────────────────────── */}
      <div
        style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "0 32px",
        }}
      >
        {/* Builder identity */}
        <div style={{
          marginBottom: 56,
          opacity:   entered ? 1 : 0,
          transform: entered ? "translateY(0)" : "translateY(10px)",
          transition: "opacity 0.9s ease 0.1s, transform 0.9s ease 0.1s",
        }}>
          {builderLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={builderLogo}
              alt={builderName ?? ""}
              style={{ height: 34, objectFit: "contain", opacity: 0.8 }}
            />
          ) : builderName ? (
            <span style={{
              fontFamily: "'Jost', sans-serif",
              fontWeight: 200,
              fontSize: 10,
              letterSpacing: "0.42em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.42)",
            }}>
              {builderName}
            </span>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/logo_light.png"
              alt="ProPlan Studio"
              style={{ height: 26, objectFit: "contain", opacity: 0.42 }}
            />
          )}
        </div>

        {/* Headline */}
        <div style={{
          textAlign: "center",
          marginBottom: 56,
          opacity:   entered ? 1 : 0,
          transform: entered ? "translateY(0)" : "translateY(12px)",
          transition: "opacity 1s ease 0.28s, transform 1s ease 0.28s",
        }}>
          <h1 style={{
            fontFamily: "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
            fontWeight: 300,
            fontSize: "clamp(36px, 5.5vw, 58px)",
            letterSpacing: "0.04em",
            color: "rgba(255,255,255,0.9)",
            lineHeight: 1.05,
            margin: 0,
          }}>
            Your Home
          </h1>
          <p style={{
            fontFamily: "'Jost', sans-serif",
            fontWeight: 200,
            fontSize: 9,
            letterSpacing: "0.42em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.2)",
            margin: "16px 0 0",
          }}>
            is being prepared
          </p>
        </div>

        {/* Progress + message */}
        <div style={{
          width: "100%", maxWidth: 340,
          display: "flex", flexDirection: "column", gap: 20,
          opacity:   entered ? 1 : 0,
          transform: entered ? "translateY(0)" : "translateY(8px)",
          transition: "opacity 1.1s ease 0.5s, transform 1.1s ease 0.5s",
        }}>
          {/* Track */}
          <div style={{ position: "relative" }}>
            {/* End-cap tick marks */}
            <div style={{
              position: "absolute", left: 0, top: -4,
              width: 1, height: 9,
              background: "rgba(255,255,255,0.1)",
            }} />
            <div style={{
              position: "absolute", right: 0, top: -4,
              width: 1, height: 9,
              background: "rgba(255,255,255,0.1)",
            }} />

            {/* Background track */}
            <div style={{
              height: 1,
              background: "rgba(255,255,255,0.07)",
              position: "relative", overflow: "hidden",
            }}>
              {/* Fill with shimmer */}
              <div style={{
                position: "absolute", left: 0, top: 0, bottom: 0,
                width: `${fillPct}%`,
                background: accent,
                overflow: "hidden",
              }}>
                {/* Shimmer sweep */}
                <div style={{
                  position: "absolute",
                  top: -3, bottom: -3,
                  width: "25%",
                  background: `linear-gradient(90deg, transparent, ${accent}90, transparent)`,
                  animation: "pl-shimmer 2.4s ease-in-out infinite",
                  animationDelay: "0.8s",
                }} />
              </div>
            </div>

            {/* Glowing leading dot */}
            {showDot && (
              <div style={{
                position: "absolute",
                top: "50%",
                left: `${fillPct}%`,
                transform: "translate(-50%, -50%)",
                width: 4, height: 4,
                borderRadius: "50%",
                background: accent,
                animation: "pl-pulse 1.6s ease-in-out infinite",
              }} />
            )}
          </div>

          {/* Rotating status message */}
          <p style={{
            fontFamily: "'Jost', sans-serif",
            fontWeight: 200,
            fontSize: 9,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.18)",
            textAlign: "center",
            margin: 0,
            opacity: msgShow ? 1 : 0,
            transition: "opacity 0.38s ease",
          }}>
            {MESSAGES[msgIdx]}
          </p>
        </div>
      </div>

      {/* ── Powered-by footer ─────────────────────────────────────── */}
      {(builderLogo || builderName) && (
        <div style={{
          position: "absolute",
          bottom: 28,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex", alignItems: "center", gap: 7,
          opacity: entered ? 0.22 : 0,
          transition: "opacity 1.4s ease 0.9s",
          whiteSpace: "nowrap",
        }}>
          <span style={{
            fontFamily: "'Jost', sans-serif",
            fontWeight: 200,
            fontSize: 8,
            letterSpacing: "0.26em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.7)",
          }}>
            Powered by
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo_light.png"
            alt="ProPlan Studio"
            style={{ height: 9, objectFit: "contain", opacity: 0.8 }}
          />
        </div>
      )}
    </div>
  );
}
