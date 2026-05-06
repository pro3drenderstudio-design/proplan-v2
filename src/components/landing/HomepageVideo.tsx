"use client";

import { useRef, useState } from "react";

const SRC = "https://pub-771cb4534de742a8876353182e3b5c47.r2.dev/Site%20Assets/Homepage%20Demo%20video(2k).mp4";

export default function HomepageVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  function handlePlay() {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    v.muted = false;
    v.loop = false;
    v.play();
    setPlaying(true);
  }

  function handleEnded() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.loop = true;
    v.play();
    setPlaying(false);
  }

  return (
    <div className="relative group rounded-2xl overflow-hidden border border-white/8">
      <video
        ref={videoRef}
        src={SRC}
        autoPlay
        loop
        muted
        playsInline
        onEnded={handleEnded}
        className="w-full aspect-video object-cover"
      />

      {!playing && (
        <button
          onClick={handlePlay}
          aria-label="Play with sound"
          className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors duration-200"
        >
          <div className="w-20 h-20 rounded-full bg-white/10 border border-white/20 backdrop-blur-sm flex items-center justify-center
            group-hover:bg-white/18 group-hover:scale-110 group-hover:border-white/35
            transition-all duration-300 shadow-2xl shadow-black/50">
            <svg className="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </button>
      )}
    </div>
  );
}
