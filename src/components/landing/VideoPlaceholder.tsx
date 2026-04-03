export default function VideoPlaceholder({
  title,
  duration = "2:30",
  subtitle,
}: {
  title: string;
  duration?: string;
  subtitle?: string;
}) {
  return (
    <div className="relative group cursor-pointer rounded-2xl overflow-hidden border border-white/8 bg-[#0a0a0a] select-none w-full aspect-video">
      {/* Blueprint grid */}
      <div className="absolute inset-0 blueprint-grid" />
      {/* Gradient vignette */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950/50 via-[#080808]/70 to-violet-950/40" />
      {/* Radial glow behind play */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-64 h-64 rounded-full bg-blue-600/6 blur-3xl group-hover:bg-blue-600/12 transition-all duration-700" />
      </div>
      {/* Play button */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-20 h-20 rounded-full bg-white/8 border border-white/15 backdrop-blur-sm flex items-center justify-center
          group-hover:bg-white/14 group-hover:scale-110 group-hover:border-white/25
          transition-all duration-300 shadow-2xl shadow-black/50">
          <svg className="w-7 h-7 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
      {/* Corner labels — architectural feel */}
      <div className="absolute top-4 left-5 font-mono text-[9px] text-blue-400/30 tracking-wider select-none">REC ● 00:00</div>
      <div className="absolute top-4 right-5 font-mono text-[9px] text-blue-400/30 tracking-wider select-none">{duration}</div>
      {/* Bottom overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/80 via-black/30 to-transparent">
        <div className="flex items-end justify-between">
          <div>
            {subtitle && (
              <p className="text-[10px] font-semibold text-blue-400/60 uppercase tracking-widest mb-1">{subtitle}</p>
            )}
            <p className="text-sm font-semibold text-white/85">{title}</p>
          </div>
          <span className="flex items-center gap-1.5 text-[10px] text-white/30 bg-white/5 border border-white/8 rounded px-2 py-1 flex-shrink-0 ml-4">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zM21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Watch
          </span>
        </div>
      </div>
    </div>
  );
}
