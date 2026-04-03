"use client";

export type PreloaderStatus = "initializing" | "optimizing" | "ready";

const STATUS_TEXT: Record<PreloaderStatus, string> = {
  initializing: "Initializing 3D Engine...",
  optimizing:   "Optimizing Geometry...",
  ready:        "Almost there...",
};

interface PreloaderProps {
  status: PreloaderStatus;
  /** When true the overlay fades out and unmounts */
  visible: boolean;
}

export default function Preloader({ status, visible }: PreloaderProps) {
  return (
    <div
      className={[
        "fixed inset-0 z-50 flex flex-col items-center justify-center",
        "bg-[#0a0f1a] transition-opacity duration-1000",
        visible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
      ].join(" ")}
    >
      {/* Subtle radial glow behind the logo */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[480px] h-[480px] rounded-full bg-blue-600/10 blur-3xl" />
      </div>

      <div className="relative flex flex-col items-center gap-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 select-none">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_light.png" alt="ProPlan Studio" className="h-10 object-contain" />
          <p className="text-xs font-medium tracking-[0.25em] uppercase text-white/30">
            3D Home Configurator
          </p>
        </div>

        {/* Spinner + status text */}
        <div className="flex flex-col items-center gap-3">
          <svg
            className="animate-spin text-blue-500"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            aria-label="Loading"
          >
            <circle
              cx="12" cy="12" r="10"
              stroke="currentColor" strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="47"
              strokeDashoffset="12"
              className="opacity-25"
            />
            <path
              d="M12 2a10 10 0 0 1 10 10"
              stroke="currentColor" strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>

          <p className="text-sm text-white/50 tracking-wide transition-all duration-500">
            {STATUS_TEXT[status]}
          </p>
        </div>
      </div>
    </div>
  );
}
