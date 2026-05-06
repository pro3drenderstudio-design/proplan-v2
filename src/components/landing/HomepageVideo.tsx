"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

const SRC =
  "https://pub-771cb4534de742a8876353182e3b5c47.r2.dev/Site%20Assets/Homepage%20Demo%20video(2k).mp4";

export interface HomepageVideoHandle {
  playWithSound: () => void;
}

type Mode = "autoplay" | "playing" | "paused";

function fmt(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
}

const HomepageVideo = forwardRef<HomepageVideoHandle>(function HomepageVideo(_, ref) {
  const videoRef     = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [mode,        setMode]        = useState<Mode>("autoplay");
  const [muted,       setMuted]       = useState(false);
  const [progress,    setProgress]    = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration,    setDuration]    = useState(0);
  const [ctrlsVisible, setCtrlsVisible] = useState(false);
  const [fullscreen,  setFullscreen]  = useState(false);
  // brief flash on play/pause click
  const [flashIcon,   setFlashIcon]   = useState<"play" | "pause" | null>(null);

  /* ── Expose handle ───────────────────────────────────────────────────────── */
  const startWithSound = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.muted = false;
    v.loop  = false;
    v.play();
    setMode("playing");
    setMuted(false);
    containerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  useImperativeHandle(ref, () => ({ playWithSound: startWithSound }), [startWithSound]);

  /* ── Video events ────────────────────────────────────────────────────────── */
  function handleEnded() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.loop  = true;
    v.play();
    setMode("autoplay");
    setProgress(0);
    setCurrentTime(0);
  }

  function handleTimeUpdate() {
    const v = videoRef.current;
    if (!v?.duration) return;
    setCurrentTime(v.currentTime);
    setProgress(v.currentTime / v.duration);
  }

  function handleLoadedMetadata() {
    setDuration(videoRef.current?.duration ?? 0);
  }

  /* ── Playback toggle ─────────────────────────────────────────────────────── */
  function flash(icon: "play" | "pause") {
    setFlashIcon(icon);
    setTimeout(() => setFlashIcon(null), 600);
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (mode === "autoplay") {
      startWithSound();
      return;
    }
    if (mode === "playing") {
      v.pause();
      setMode("paused");
      flash("pause");
    } else {
      v.play();
      setMode("playing");
      flash("play");
    }
  }

  /* ── Controls visibility ─────────────────────────────────────────────────── */
  function scheduleHide() {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setCtrlsVisible(false), 2500);
  }

  function handleMouseMove() {
    if (mode !== "playing") return;
    setCtrlsVisible(true);
    scheduleHide();
  }

  function handleMouseLeave() {
    if (mode === "playing") setCtrlsVisible(false);
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }

  const ctrlsShown = mode === "paused" || (mode === "playing" && ctrlsVisible);

  /* ── Seek ────────────────────────────────────────────────────────────────── */
  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    const v = videoRef.current;
    if (!v) return;
    const rect  = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.currentTime = ratio * v.duration;
  }

  /* ── Mute ────────────────────────────────────────────────────────────────── */
  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }

  /* ── Fullscreen ──────────────────────────────────────────────────────────── */
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  useEffect(() => {
    const fn = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", fn);
    return () => document.removeEventListener("fullscreenchange", fn);
  }, []);

  /* ── Cursor ──────────────────────────────────────────────────────────────── */
  const cursor =
    mode === "autoplay" ? "cursor-pointer" :
    mode === "paused"   ? "cursor-pointer" :
    ctrlsVisible        ? "cursor-default" : "cursor-none";

  /* ── Render ──────────────────────────────────────────────────────────────── */
  return (
    <div
      ref={containerRef}
      className={`relative rounded-2xl overflow-hidden border border-white/8 bg-black ${cursor}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <video
        ref={videoRef}
        src={SRC}
        autoPlay
        loop
        muted
        playsInline
        onEnded={handleEnded}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        className="w-full aspect-video object-cover block"
      />

      {/* Full-area click zone (behind controls) */}
      <div className="absolute inset-0" onClick={togglePlay} />

      {/* ── Centre overlay: autoplay prompt or paused indicator ── */}
      {mode !== "playing" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {mode === "autoplay" && (
            <div className="absolute inset-0 bg-black/30 backdrop-blur-[1.5px]" />
          )}
          <div className="relative z-10 flex flex-col items-center gap-3">
            <div
              className={`rounded-full border backdrop-blur-sm flex items-center justify-center
                shadow-2xl shadow-black/70 transition-all duration-300 group-hover:scale-105
                ${mode === "autoplay"
                  ? "w-20 h-20 bg-white/12 border-white/25 hover:bg-white/20"
                  : "w-16 h-16 bg-white/10 border-white/18 opacity-80"
                }`}
            >
              <svg
                className={`text-white ml-1 ${mode === "autoplay" ? "w-7 h-7" : "w-6 h-6"}`}
                fill="currentColor" viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
            {mode === "autoplay" && (
              <span className="text-white/55 text-xs font-medium tracking-wide">
                Watch with sound
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Flash icon on play/pause click ── */}
      {flashIcon && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center animate-ping-once">
            {flashIcon === "pause" ? (
              <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg className="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* ── Bottom controls bar ── */}
      <div
        className={`absolute bottom-0 left-0 right-0 transition-all duration-300
          ${ctrlsShown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1.5 pointer-events-none"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gradient scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent pointer-events-none rounded-b-2xl" />

        <div className="relative px-4 pb-4 pt-10">
          {/* Progress bar */}
          <div
            className="w-full h-1 bg-white/15 rounded-full mb-3.5 cursor-pointer group/bar hover:h-[5px] transition-all duration-150"
            onClick={handleSeek}
          >
            <div
              className="h-full bg-white rounded-full relative transition-[width] duration-75"
              style={{ width: `${progress * 100}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg scale-0 group-hover/bar:scale-100 transition-transform duration-150" />
            </div>
          </div>

          {/* Controls row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Play / Pause */}
              <button
                onClick={togglePlay}
                className="text-white/75 hover:text-white transition-colors"
                aria-label={mode === "playing" ? "Pause" : "Play"}
              >
                {mode === "playing" ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>

              {/* Mute / Unmute */}
              <button
                onClick={toggleMute}
                className="text-white/75 hover:text-white transition-colors"
                aria-label={muted ? "Unmute" : "Mute"}
              >
                {muted ? (
                  <svg className="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                  </svg>
                ) : (
                  <svg className="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                  </svg>
                )}
              </button>

              {/* Time */}
              <span className="text-white/40 text-[11px] font-mono tabular-nums select-none">
                {fmt(currentTime)} / {fmt(duration)}
              </span>
            </div>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="text-white/75 hover:text-white transition-colors"
              aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {fullscreen ? (
                <svg className="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
                </svg>
              ) : (
                <svg className="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default HomepageVideo;
