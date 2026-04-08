import Link from "next/link";
import Nav  from "@/components/landing/Nav";
import Footer from "@/components/landing/Footer";
import VideoPlaceholder from "@/components/landing/VideoPlaceholder";

function Check() {
  return (
    <svg className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-px" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="#10b981" fillOpacity="0.12"/>
      <path d="M5 8.5l2 2 4-4" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function Arrow() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
    </svg>
  );
}

function SiteMapIllustration() {
  const lots = [
    { x: 60,  y: 60,  w: 90, h: 70, status: "available", label: "Lot 1" },
    { x: 165, y: 60,  w: 90, h: 70, status: "reserved",  label: "Lot 2" },
    { x: 270, y: 60,  w: 90, h: 70, status: "available", label: "Lot 3" },
    { x: 375, y: 60,  w: 90, h: 70, status: "sold",      label: "Lot 4" },
    { x: 60,  y: 155, w: 90, h: 70, status: "sold",      label: "Lot 5" },
    { x: 165, y: 155, w: 90, h: 70, status: "available", label: "Lot 6" },
    { x: 270, y: 155, w: 90, h: 70, status: "available", label: "Lot 7" },
    { x: 375, y: 155, w: 90, h: 70, status: "reserved",  label: "Lot 8" },
  ];
  const colors: Record<string, { fill: string; stroke: string; label: string }> = {
    available: { fill: "rgba(59,130,246,0.15)",  stroke: "#3b82f6", label: "#60a5fa" },
    reserved:  { fill: "rgba(251,191,36,0.15)",  stroke: "#f59e0b", label: "#fbbf24" },
    sold:      { fill: "rgba(239,68,68,0.12)",   stroke: "#ef4444", label: "#f87171" },
  };
  return (
    <svg viewBox="0 0 530 300" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="530" height="300" fill="#080808"/>
      {Array.from({ length: 8 }).map((_, i) => (
        <line key={`h${i}`} x1="0" y1={i * 40} x2="530" y2={i * 40} stroke="#1a2535" strokeWidth="0.5"/>
      ))}
      {Array.from({ length: 14 }).map((_, i) => (
        <line key={`v${i}`} x1={i * 40} y1="0" x2={i * 40} y2="300" stroke="#1a2535" strokeWidth="0.5"/>
      ))}
      <rect x="0" y="115" width="530" height="24" fill="#111820" opacity="0.9"/>
      <line x1="0" y1="127" x2="530" y2="127" stroke="#2a3540" strokeWidth="1" strokeDasharray="12 8"/>
      <text x="265" y="131" fill="#2a3a50" fontSize="8" textAnchor="middle" fontFamily="monospace">COMMUNITY DRIVE</text>
      {lots.map((lot) => {
        const c = colors[lot.status];
        return (
          <g key={lot.label}>
            <rect x={lot.x} y={lot.y} width={lot.w} height={lot.h} rx="4" fill={c.fill} stroke={c.stroke} strokeWidth="1"/>
            <text x={lot.x + lot.w / 2} y={lot.y + lot.h / 2 - 6} fill={c.label} fontSize="8" textAnchor="middle" fontFamily="monospace" fontWeight="bold">{lot.label}</text>
            <text x={lot.x + lot.w / 2} y={lot.y + lot.h / 2 + 8} fill={c.label} fontSize="7" textAnchor="middle" fontFamily="monospace" opacity="0.7">{lot.status.toUpperCase()}</text>
          </g>
        );
      })}
      {[
        { x: 60,  color: "#3b82f6", label: "Available" },
        { x: 160, color: "#f59e0b", label: "Reserved"  },
        { x: 260, color: "#ef4444", label: "Sold"      },
      ].map(l => (
        <g key={l.label}>
          <rect x={l.x} y="248" width="10" height="10" rx="2" fill={l.color} fillOpacity="0.3" stroke={l.color} strokeWidth="0.8"/>
          <text x={l.x + 14} y="257" fill="white" fillOpacity="0.4" fontSize="8" fontFamily="monospace">{l.label}</text>
        </g>
      ))}
      <rect x="165" y="155" width="90" height="70" rx="4" fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4 2" opacity="0.7"/>
      <text x="210" y="228" fill="#60a5fa" fontSize="7" textAnchor="middle" fontFamily="monospace">SELECTED</text>
    </svg>
  );
}

const FEATURES = [
  {
    title: "Live Lot Status",
    desc:  "Each lot shows as Available, Reserved, or Sold — updated in real time from your builder dashboard. Buyers always see accurate availability, no phone calls required.",
    dot:   "bg-teal-400",
  },
  {
    title: "Linked Configurators",
    desc:  "Buyers click a lot, then configure the home model assigned to it. Their lot selection is captured with their lead — your team knows the lot and every selection before the first call.",
    dot:   "bg-blue-400",
  },
  {
    title: "Multi-Community Support",
    desc:  "Manage multiple site maps across different communities from a single dashboard. Each community has its own map, lot inventory, and model assignments.",
    dot:   "bg-violet-400",
  },
  {
    title: "Embed Anywhere",
    desc:  "Add your interactive site map to any page on your website with a single code snippet. Works on your existing domain — no platform migration required.",
    dot:   "bg-amber-400",
  },
];

export default function SiteMapsPage() {
  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden">
      <Nav />

      {/* Hero */}
      <section className="relative pt-32 pb-16 px-5 overflow-hidden">
        <div className="absolute inset-0 blueprint-grid opacity-30" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(8,8,8,0)_0%,#080808_80%)]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-teal-600/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-teal-500/20 bg-teal-500/8 text-[11px] font-semibold text-teal-400 uppercase tracking-wide mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400" /> Interactive site maps
          </div>
          <h1
            className="text-5xl md:text-[62px] font-extrabold leading-[1.04] tracking-[-0.03em] mb-6"
            style={{ fontFamily: "var(--font-syne), sans-serif" }}
          >
            Stop fielding calls
            <br />
            <span className="bg-gradient-to-r from-teal-400 to-cyan-500 bg-clip-text text-transparent">
              about lot availability.
            </span>
          </h1>
          <p className="text-lg text-white/45 leading-relaxed max-w-2xl mx-auto mb-10">
            Give buyers a live site map where they can browse available lots, click to configure their home on that specific lot, and submit a lead — all in one flow. Included in your $1,500/mo ProPlan subscription.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-5">
            <Link href="/auth/signup"
              className="flex items-center justify-center gap-2 px-7 py-3.5 bg-blue-600 hover:bg-blue-500 text-white text-[15px] font-semibold rounded-xl transition-colors shadow-2xl shadow-blue-600/25">
              Get started <Arrow />
            </Link>
            <Link href="/pricing"
              className="flex items-center justify-center px-7 py-3.5 bg-white/6 hover:bg-white/10 border border-white/10 text-white text-[15px] font-medium rounded-xl transition-all">
              See pricing
            </Link>
          </div>
          <p className="text-xs text-white/22">Included in the $1,500/mo ProPlan subscription · Unlimited communities</p>
        </div>
      </section>

      {/* Video */}
      <section className="py-8 px-5">
        <div className="max-w-4xl mx-auto">
          <VideoPlaceholder
            title="Interactive Site Map — buyer lot selection to configurator in one flow"
            duration="2:50"
            subtitle="Product demo"
          />
        </div>
      </section>

      {/* Site map illustration */}
      <section className="py-16 px-5 border-t border-white/6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <h2
              className="text-3xl font-extrabold tracking-tight"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              Live lot availability at a glance
            </h2>
            <p className="text-white/40 mt-2">Buyers browse your community and click any available lot to start configuring their home.</p>
          </div>
          <div className="rounded-2xl overflow-hidden border border-white/10 bg-[#080808] aspect-[530/300] shadow-2xl shadow-black/50">
            <SiteMapIllustration />
          </div>
          <div className="mt-4 flex items-center justify-center gap-6 text-xs text-white/35">
            {[
              { dot: "bg-blue-400",  label: "Available" },
              { dot: "bg-amber-400", label: "Reserved" },
              { dot: "bg-red-400",   label: "Sold" },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${s.dot}`} />
                {s.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-5 border-t border-white/6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-syne), sans-serif" }}>
              Everything in the site map
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-[#0e0e0e] border border-white/8 rounded-2xl p-6 hover:border-white/14 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-2 h-2 rounded-full ${f.dot}`} />
                  <h3 className="text-base font-bold text-white" style={{ fontFamily: "var(--font-syne), sans-serif" }}>{f.title}</h3>
                </div>
                <p className="text-sm text-white/42 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Buyer journey */}
      <section className="py-16 px-5 border-t border-white/6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-extrabold tracking-tight text-center mb-8" style={{ fontFamily: "var(--font-syne), sans-serif" }}>
            The complete buyer journey — no friction
          </h2>
          <div className="grid sm:grid-cols-4 gap-4">
            {[
              { n: "1", action: "Browse lots",    desc: "Buyer opens the site map on your website and sees all lots color-coded by availability." },
              { n: "2", action: "Pick a lot",     desc: "They click an available lot to see its details — size, price premium, orientation." },
              { n: "3", action: "Configure home", desc: "They're taken directly into the 3D configurator for the model assigned to that lot." },
              { n: "4", action: "Submit lead",    desc: "Their lead is saved with lot + full home configuration. Your team gets the complete picture." },
            ].map((step) => (
              <div key={step.n} className="text-center">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-600 to-cyan-600 flex items-center justify-center text-sm font-bold text-white mx-auto mb-3"
                  style={{ fontFamily: "var(--font-syne), sans-serif" }}>
                  {step.n}
                </div>
                <p className="text-sm font-bold text-white mb-1" style={{ fontFamily: "var(--font-syne), sans-serif" }}>{step.action}</p>
                <p className="text-xs text-white/38 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Included in */}
      <section className="py-16 px-5 border-t border-white/6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="bg-teal-500/6 border border-teal-500/20 rounded-2xl p-8">
            <p className="text-[10px] font-bold uppercase tracking-widest text-teal-400/60 mb-4">Plan inclusion</p>
            <p className="text-3xl font-extrabold text-white mb-2" style={{ fontFamily: "var(--font-syne), sans-serif" }}>Unlimited</p>
            <p className="text-base font-semibold text-teal-400 mb-1">Interactive site maps</p>
            <p className="text-sm text-white/35 mb-6">Included in the $1,500/mo ProPlan Studio subscription. No per-community fees.</p>
            <ul className="space-y-2 text-left max-w-xs mx-auto">
              {[
                "Live lot availability — updated from your dashboard",
                "Linked to your 3D configurators",
                "Embed on any website",
                "Multi-community support",
              ].map(i => (
                <li key={i} className="flex items-center gap-2.5 text-sm text-white/55"><Check />{i}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-5 border-t border-white/6">
        <div className="max-w-3xl mx-auto text-center">
          <h2
            className="text-3xl font-extrabold tracking-tight mb-4"
            style={{ fontFamily: "var(--font-syne), sans-serif" }}
          >
            Let buyers find their lot and configure their home in one visit
          </h2>
          <p className="text-white/40 mb-8 max-w-md mx-auto">
            Interactive site maps are included in your $1,500/mo ProPlan subscription. Subscribe, set up your community, and start capturing lot-specific leads.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/auth/signup"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors shadow-xl shadow-blue-600/20">
              Get started
            </Link>
            <Link href="/pricing"
              className="inline-flex items-center justify-center px-7 py-3.5 bg-white/6 hover:bg-white/10 border border-white/10 text-white font-medium rounded-xl transition-all">
              See full pricing
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
