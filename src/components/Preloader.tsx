"use client";

import { useEffect, useRef, useState } from "react";

export type PreloaderStatus = "initializing" | "optimizing" | "ready";

interface PreloaderProps {
  visible: boolean;
  /** Bytes downloaded so far (optional — omit for indeterminate animation) */
  downloadedBytes?: number;
  /** Total file size in bytes (0 = unknown/indeterminate) */
  totalBytes?: number;
  /** Whether the 3D viewer has finished its scene setup */
  viewerReady?: boolean;
  /** Builder accent color (hex) for the progress bar */
  accentColor?: string | null;
  builderName?: string | null;
  builderLogo?: string | null;
  /** Legacy status prop — kept for compatibility */
  status?: PreloaderStatus;
}

const ROTATING_MESSAGES = [
  "Preparing your building materials…",
  "Loading structural components…",
  "Applying exterior finishes…",
  "Setting up interior spaces…",
  "Configuring lighting environments…",
  "Syncing your design selections…",
  "Optimising 3D geometry…",
  "Warming up the render engine…",
  "Calibrating material textures…",
  "Almost there — polishing the details…",
];

export default function Preloader({
  visible,
  downloadedBytes = 0,
  totalBytes = 0,
  viewerReady = false,
  accentColor,
  builderName,
  builderLogo,
}: PreloaderProps) {
  const color = accentColor ?? "#3b82f6";

  const downloadDone = totalBytes > 0 && downloadedBytes >= totalBytes;
  const rawDownload  = totalBytes > 0 ? Math.min(downloadedBytes / totalBytes, 1) : 0;
  const downloadPct  = rawDownload * 85;

  const [displayPct, setDisplayPct]   = useState(0);
  const [shownMsgIdx, setShownMsgIdx] = useState(0);
  const [msgFaded, setMsgFaded]       = useState(false);
  const processingStart = useRef<number | null>(null);
  const mountTimeRef    = useRef<number>(0);
  const rafRef          = useRef<number>(0);
  const prevMsgIdx      = useRef(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    mountTimeRef.current = performance.now();
  }, []);

  useEffect(() => {
    if (!mounted) return;

    if (totalBytes > 0 && downloadDone && !viewerReady && processingStart.current === null) {
      processingStart.current = performance.now();
    }

    const animate = () => {
      setDisplayPct(prev => {
        let target: number;
        if (viewerReady) {
          target = 100;
        } else if (totalBytes > 0) {
          target = downloadDone
            ? Math.min(85 + (performance.now() - (processingStart.current ?? 0)) / 400, 97)
            : downloadPct;
        } else {
          const elapsed = performance.now() - mountTimeRef.current;
          const fast = 30 * (1 - Math.exp(-elapsed / 1800));
          const slow = 93 * (1 - Math.exp(-elapsed / 22000));
          target = Math.min(Math.max(fast, slow), 93);
        }
        const diff = target - prev;
        if (Math.abs(diff) < 0.05) return target;
        return prev + diff * 0.06;
      });
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, downloadDone, viewerReady, downloadPct]);

  const pct      = Math.min(Math.round(displayPct), 100);
  const barWidth = `${displayPct.toFixed(2)}%`;
  const targetMsgIdx = Math.min(Math.floor(pct / 10), ROTATING_MESSAGES.length - 1);

  // Cross-fade message when crossing a 10% boundary
  useEffect(() => {
    if (targetMsgIdx === prevMsgIdx.current) return;
    setMsgFaded(true);
    const swap = setTimeout(() => {
      setShownMsgIdx(targetMsgIdx);
      prevMsgIdx.current = targetMsgIdx;
      setMsgFaded(false);
    }, 280);
    return () => clearTimeout(swap);
  }, [targetMsgIdx]);

  return (
    <div
      className={[
        "fixed inset-0 z-[100] flex flex-col items-center justify-center select-none",
        "transition-opacity duration-700",
        visible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
      ].join(" ")}
      style={{
        background: "#0d0d0d",
        transform: "translateZ(0)",
        willChange: "opacity",
        backdropFilter: "blur(0px)",
        WebkitBackdropFilter: "blur(0px)",
      }}
    >
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute left-1/2 -translate-x-1/2 rounded-full blur-[180px]"
          style={{
            width: 640,
            height: 480,
            top: "15%",
            background: color,
            opacity: 0.12,
          }}
        />
      </div>

      {/* Main content column */}
      <div className="relative flex flex-col items-center gap-10 w-full max-w-xs px-8 text-center">

        {/* Builder logo */}
        <div className="flex flex-col items-center">
          {builderLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={builderLogo}
              alt={builderName ?? "Builder"}
              className="h-10 object-contain"
              style={{ opacity: 0.9 }}
            />
          ) : builderName ? (
            <span className="text-white/80 text-sm font-semibold tracking-widest uppercase">
              {builderName}
            </span>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/logo_light.png"
              alt="ProPlan Studio"
              className="h-8 object-contain"
              style={{ opacity: 0.7 }}
            />
          )}
        </div>

        {/* Headline + subtext */}
        <div className="flex flex-col items-center gap-3">
          <h1
            className="text-white text-xl font-light tracking-[0.06em]"
            style={{ letterSpacing: "0.06em" }}
          >
            Loading your home
          </h1>
          <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.28)" }}>
            Allow 2–5 minutes to load.<br />
            We promise it&apos;s worth the wait.
          </p>
        </div>

        {/* Progress bar + labels */}
        <div className="w-full flex flex-col gap-3">
          {/* Bar */}
          <div
            className="w-full rounded-full overflow-hidden"
            style={{ height: 1, background: "rgba(255,255,255,0.08)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: barWidth,
                background: `linear-gradient(90deg, ${color}80, ${color})`,
                boxShadow: `0 0 8px ${color}50`,
                transition: "none",
              }}
            />
          </div>

          {/* Percentage + rotating message */}
          <div className="flex items-center justify-between w-full">
            <span
              className="font-mono text-[11px] tabular-nums"
              style={{ color: "rgba(255,255,255,0.25)" }}
            >
              {String(pct).padStart(2, "0")}%
            </span>
            <span
              className="text-[11px] text-right"
              style={{
                color: "rgba(255,255,255,0.22)",
                opacity: msgFaded ? 0 : 1,
                transition: "opacity 0.28s ease",
                maxWidth: "74%",
              }}
            >
              {ROTATING_MESSAGES[shownMsgIdx]}
            </span>
          </div>
        </div>
      </div>

      {/* Powered-by footer */}
      {(builderLogo || builderName) && (
        <div className="absolute bottom-6 flex items-center gap-1.5">
          <span className="text-[10px] tracking-wider" style={{ color: "rgba(255,255,255,0.1)" }}>
            Powered by
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo_light.png"
            alt="ProPlan Studio"
            className="h-3 object-contain"
            style={{ opacity: 0.18 }}
          />
        </div>
      )}
    </div>
  );
}
