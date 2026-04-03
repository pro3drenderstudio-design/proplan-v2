"use client";

export default function AdminRendersPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 py-4 border-b border-white/8 flex-shrink-0">
        <h1 className="text-base font-bold text-white">Render Monitor</h1>
        <p className="text-xs text-white/35 mt-0.5">fal.ai usage, costs, and job history</p>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-3">🎨</p>
          <p className="text-white/40 text-sm font-medium">Coming soon</p>
          <p className="text-white/20 text-xs mt-1">Render job tracking and cost monitoring</p>
        </div>
      </div>
    </div>
  );
}
