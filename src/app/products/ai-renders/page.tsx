import Link from "next/link";
import Nav  from "@/components/landing/Nav";
import Footer from "@/components/landing/Footer";
import VideoPlaceholder from "@/components/landing/VideoPlaceholder";
import AIRenderSlider from "@/components/landing/AIRenderSlider";

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

const RENDER_TYPES = [
  { label: "Exterior — Day",        desc: "Bright, inviting kerb-appeal shots" },
  { label: "Exterior — Dusk",       desc: "Golden hour with warm interior glow" },
  { label: "Aerial / Bird's-eye",   desc: "Community and site context" },
  { label: "Interior — Kitchen",    desc: "Lifestyle-ready kitchen & dining" },
  { label: "Interior — Living",     desc: "Feature walls, lighting, staging" },
  { label: "Interior — Bedroom",    desc: "Master suite and secondary rooms" },
];

const REAL_RENDERS = [
  {
    url:   "https://qvgsdrjkjtzwtxfepyoe.supabase.co/storage/v1/object/public/render-studio/1775607389780-elevation.jpg",
    label: "Exterior — Dusk",
  },
  {
    url:   "https://qvgsdrjkjtzwtxfepyoe.supabase.co/storage/v1/object/public/render-studio/1775156293099-interior.jpg",
    label: "Interior — Golden Hour",
  },
  {
    url:   "https://qvgsdrjkjtzwtxfepyoe.supabase.co/storage/v1/object/public/render-studio/1775502302584-elevation.jpg",
    label: "Exterior — Golden Hour",
  },
  {
    url:   "https://qvgsdrjkjtzwtxfepyoe.supabase.co/storage/v1/object/public/render-studio/1775345418634-elevation.jpg",
    label: "Exterior — Night",
  },
];

export default function AIRendersPage() {
  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden">
      <Nav />

      {/* Hero */}
      <section className="relative pt-32 pb-16 px-5 overflow-hidden">
        <div className="absolute inset-0 blueprint-grid opacity-30" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(8,8,8,0)_0%,#080808_80%)]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-amber-600/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/20 bg-amber-500/8 text-[11px] font-semibold text-amber-400 uppercase tracking-wide mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> AI-powered
          </div>
          <h1
            className="text-5xl md:text-[62px] font-extrabold leading-[1.04] tracking-[-0.03em] mb-6"
            style={{ fontFamily: "var(--font-syne), sans-serif" }}
          >
            Stop waiting days
            <br />
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              for a single image.
            </span>
          </h1>
          <p className="text-lg text-white/45 leading-relaxed max-w-2xl mx-auto mb-10">
            Upload a floor plan and our AI Render Studio generates photorealistic exteriors, interiors, and aerials in seconds. 250 AI credits included every month at no extra charge — part of your $1,500/mo subscription.
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
          <p className="text-xs text-white/22">250 AI credits/mo included · Resets monthly · No add-on fees</p>
        </div>
      </section>

      {/* Video */}
      <section className="py-8 px-5">
        <div className="max-w-4xl mx-auto">
          <VideoPlaceholder
            title="AI Render Studio — Live demo: floor plan to render in under a minute"
            duration="2:45"
            subtitle="Product demo"
          />
        </div>
      </section>

      {/* Before/after slider */}
      <section className="py-16 px-5 border-t border-white/6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2
              className="text-3xl font-extrabold tracking-tight"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              Floor plan → photorealistic render
            </h2>
            <p className="text-white/40 mt-2">Drag to compare. Generated from actual plan data in seconds.</p>
          </div>
          <AIRenderSlider />
        </div>
      </section>

      {/* Real renders grid */}
      <section className="py-16 px-5 border-t border-white/6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2
              className="text-3xl font-extrabold tracking-tight"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              Real renders from our AI studio
            </h2>
            <p className="text-white/40 mt-2">Generated from actual builder floor plans — not stock imagery.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
            {REAL_RENDERS.map((r) => (
              <div key={r.label} className="group">
                <div className="aspect-square rounded-xl overflow-hidden border border-white/8 mb-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.url} alt={r.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <p className="text-[10px] text-white/35 font-medium">{r.label}</p>
              </div>
            ))}
          </div>

          {/* Render types */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {RENDER_TYPES.map((t) => (
              <div key={t.label} className="bg-[#0e0e0e] border border-white/8 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <p className="text-sm font-semibold text-white">{t.label}</p>
                </div>
                <p className="text-xs text-white/40">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Credits */}
      <section className="py-16 px-5 border-t border-white/6">
        <div className="max-w-3xl mx-auto">
          <div className="bg-amber-500/6 border border-amber-500/20 rounded-2xl p-8 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400/60 mb-4">Included in your subscription</p>
            <p className="text-5xl font-extrabold text-white mb-2" style={{ fontFamily: "var(--font-syne), sans-serif" }}>250</p>
            <p className="text-base font-semibold text-amber-400 mb-1">AI render credits / month</p>
            <p className="text-sm text-white/35 mb-6">Included in the $1,500/mo ProPlan Studio subscription. Credits reset every month.</p>
            <ul className="space-y-2 text-left max-w-xs mx-auto mb-6">
              {[
                "Exterior, interior, and aerial types",
                "Generate in seconds — no waiting",
                "Credits reset monthly",
                "Use for concepts, variations, mood boards",
              ].map(i => (
                <li key={i} className="flex items-center gap-2.5 text-sm text-white/55"><Check />{i}</li>
              ))}
            </ul>
            <Link href="/auth/signup"
              className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-[#080808] font-bold rounded-xl transition-colors">
              Get started <Arrow />
            </Link>
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
            Every render you need — in one flat price
          </h2>
          <p className="text-white/40 mb-8 max-w-md mx-auto">
            250 AI credits and unlimited studio renders are included in your $1,500/mo subscription. Stop paying $800 per image to an external studio.
          </p>
          <Link href="/auth/signup"
            className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors shadow-xl shadow-blue-600/20">
            Get started
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
