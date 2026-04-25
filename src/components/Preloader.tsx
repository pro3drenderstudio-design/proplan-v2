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

const LOADING_MESSAGES = [
  "Loading your home…",
  "Preparing your spaces…",
  "Setting up your options…",
  "Configuring your finishes…",
  "Bringing your vision to life…",
  "Rendering your materials…",
  "Fine-tuning the details…",
  "Calculating your features…",
  "Connecting the experience…",
  "Almost ready…",
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

  // When totalBytes > 0: byte-accurate three-phase progress
  //   0 – 85 : download (proportional to bytes)
  //   85 – 97: processing (time-based after download completes)
  //   97 –100: scene setup (jump when viewerReady fires)
  //
  // When totalBytes === 0 (indeterminate): time-based exponential decay
  //   0 → ~80%: asymptotically approaches 80% while scene loads
  //   100: jumps when viewerReady fires
  const downloadDone = totalBytes > 0 && downloadedBytes >= totalBytes;
  const rawDownload  = totalBytes > 0 ? Math.min(downloadedBytes / totalBytes, 1) : 0;
  const downloadPct  = rawDownload * 85;

  const [displayPct, setDisplayPct] = useState(0);
  const processingStart             = useRef<number | null>(null);
  const mountTimeRef                = useRef<number>(0);
  const rafRef                      = useRef<number>(0);
  const [mounted, setMounted]       = useState(false);

  useEffect(() => {
    setMounted(true);
    mountTimeRef.current = performance.now();
  }, []);

  // Animate display percentage smoothly
  useEffect(() => {
    if (!mounted) return;

    // Phase bookkeeping (byte-accurate mode only)
    if (totalBytes > 0 && downloadDone && !viewerReady && processingStart.current === null) {
      processingStart.current = performance.now();
    }

    const animate = () => {
      setDisplayPct(prev => {
        let processingTarget: number;
        if (viewerReady) {
          processingTarget = 100;
        } else if (totalBytes > 0) {
          // Byte-accurate: download → processing → entering
          processingTarget = downloadDone
            ? Math.min(85 + (performance.now() - (processingStart.current ?? 0)) / 400, 97)
            : downloadPct;
        } else {
          // Indeterminate: two-speed exponential so progress feels active the whole time.
          // Fast phase (τ=1800ms) races to ~30% in the first 2-3s (feels responsive).
          // Slow phase (τ=22000ms) crawls the remaining distance to the 93% cap,
          // reaching ~50% at 10s, ~75% at 25s, ~88% at 45s — won't appear stuck
          // unless the model takes > 50s.  Snaps to 100 when viewerReady fires.
          const elapsed = performance.now() - mountTimeRef.current;
          const fast = 30 * (1 - Math.exp(-elapsed / 1800));
          const slow = 93 * (1 - Math.exp(-elapsed / 22000));
          processingTarget = Math.min(Math.max(fast, slow), 93);
        }
        const diff = processingTarget - prev;
        if (Math.abs(diff) < 0.05) return processingTarget;
        return prev + diff * 0.06;
      });
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, downloadDone, viewerReady, downloadPct]);

  const pct        = Math.min(Math.round(displayPct), 100);
  const barWidth   = `${displayPct.toFixed(2)}%`;
  const msgIdx     = Math.min(Math.floor(pct / 10), LOADING_MESSAGES.length - 1);
  const statusText = LOADING_MESSAGES[msgIdx];

  return (
    <div
      className={[
        "fixed inset-0 z-[100] flex flex-col items-center justify-center select-none",
        "transition-opacity duration-700",
        visible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
      ].join(" ")}
      style={{ background: "#0d0d0d", transform: "translateZ(0)", willChange: "opacity", backdropFilter: "blur(0px)", WebkitBackdropFilter: "blur(0px)" }}
    >
      {/* Ambient glow — positioned at 40% height where content lives */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute left-1/2 -translate-x-1/2 rounded-full blur-[120px] opacity-20"
          style={{ width: 600, height: 400, top: "25%", background: color }}
        />
      </div>

      {/* Content column */}
      <div className="relative flex flex-col items-center gap-10 w-full max-w-md px-8">

        {/* Branding */}
        <div className="flex flex-col items-center gap-3">
          {builderLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={builderLogo} alt={builderName ?? "Builder"} className="h-9 object-contain opacity-90" />
          ) : builderName ? (
            <span className="text-white/80 text-base font-semibold tracking-wide">{builderName}</span>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/logo_light.png" alt="ProPlan Studio" className="h-8 object-contain opacity-70" />
          )}
          <p className="text-[10px] font-medium tracking-[0.3em] uppercase text-white/20">
            Home Configurator
          </p>
        </div>

        {/* Progress section */}
        <div className="w-full flex flex-col items-center gap-5">
          {/* Percentage */}
          <div
            className="font-mono text-6xl font-light tabular-nums leading-none"
            style={{ color: pct < 5 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.9)" }}
          >
            {String(pct).padStart(2, "0")}
            <span className="text-3xl" style={{ color: "rgba(255,255,255,0.3)" }}>%</span>
          </div>

          {/* Progress bar */}
          <div className="w-full">
            <div className="w-full h-[2px] rounded-full bg-white/8 overflow-hidden">
              <div
                className="h-full rounded-full transition-none"
                style={{
                  width: barWidth,
                  background: `linear-gradient(90deg, ${color}cc, ${color})`,
                  boxShadow: `0 0 8px ${color}80`,
                  transition: "none",
                }}
              />
            </div>
          </div>

          {/* Status line */}
          <div className="flex items-center gap-2.5 h-5">
            {!viewerReady && (
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0"
                style={{ background: color }}
              />
            )}
            <span className="text-xs text-white/35 tracking-wider transition-opacity duration-500">
              {statusText}
            </span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 flex items-center gap-1.5">
        {builderLogo || builderName ? (
          <>
            <span className="text-[10px] text-white/12 tracking-wider">Powered by</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo_light.png" alt="ProPlan Studio" className="h-3.5 object-contain opacity-20" />
          </>
        ) : null}
      </div>
    </div>
  );
}
