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

const REAL_RENDERS = [
  { url: "https://qvgsdrjkjtzwtxfepyoe.supabase.co/storage/v1/object/public/render-studio/1775608561463-elevation.jpg", label: "Exterior — Midday" },
  { url: "https://qvgsdrjkjtzwtxfepyoe.supabase.co/storage/v1/object/public/render-studio/1775090072907-interior.jpg",  label: "Interior — Natural Light" },
  { url: "https://qvgsdrjkjtzwtxfepyoe.supabase.co/storage/v1/object/public/render-studio/1775502302584-elevation.jpg", label: "Exterior — Golden Hour" },
  { url: "https://qvgsdrjkjtzwtxfepyoe.supabase.co/storage/v1/object/public/render-studio/1775122222672-elevation.jpg", label: "Contemporary — Dusk" },
];

const DELIVERABLES = [
  "Full-resolution JPEG + PNG (print & web)",
  "Multiple camera angles per scene",
  "Day and dusk lighting variants",
  "2 rounds of revisions included",
  "Delivered via your builder portal",
  "Usage rights — yours forever",
];

const PROCESS = [
  { n: "01", title: "Submit your brief",  desc: "Share floor plans, elevations, and style references through your builder portal. The more detail, the better the result." },
  { n: "02", title: "We build the scene", desc: "Our artists model the exterior, landscape, and interior scenes from scratch using your plans as the source of truth." },
  { n: "03", title: "Preview & feedback", desc: "You receive a draft preview within 48 hours. Provide feedback and we incorporate your revisions." },
  { n: "04", title: "Final delivery",     desc: "Full-resolution files are delivered to your portal. Ready for print, digital ads, and social media." },
];

export default function ThreeDRenderingPage() {
  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden">
      <Nav />

      {/* Hero */}
      <section className="relative pt-32 pb-16 px-5 overflow-hidden">
        <div className="absolute inset-0 blueprint-grid opacity-30" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(8,8,8,0)_0%,#080808_80%)]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-violet-600/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-violet-500/20 bg-violet-500/8 text-[11px] font-semibold text-violet-400 uppercase tracking-wide mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400" /> Studio rendering
          </div>
          <h1
            className="text-5xl md:text-[62px] font-extrabold leading-[1.04] tracking-[-0.03em] mb-6"
            style={{ fontFamily: "var(--font-syne), sans-serif" }}
          >
            Marketing-grade renders —
            <br />
            <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
              not sold separately.
            </span>
          </h1>
          <p className="text-lg text-white/45 leading-relaxed max-w-2xl mx-auto mb-10">
            Hand-crafted renders by our in-house 3D artists — built from your floor plans, delivered in 48 hours. External studios charge $800–$2,000 per image. With ProPlan, unlimited renders are included in your $1,500/mo subscription.
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
          <p className="text-xs text-white/22">Unlimited renders/mo · 48hr turnaround · Included in $1,500/mo</p>
        </div>
      </section>

      {/* Video */}
      <section className="py-8 px-5">
        <div className="max-w-4xl mx-auto">
          <VideoPlaceholder
            title="Our studio rendering process — from brief to final delivery"
            duration="3:00"
            subtitle="Behind the scenes"
          />
        </div>
      </section>

      {/* Gallery — real renders */}
      <section className="py-16 px-5 border-t border-white/6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2
              className="text-3xl font-extrabold tracking-tight"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              Renders from our studio
            </h2>
            <p className="text-white/40 mt-2">Produced by our in-house team from builder-supplied floor plans.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {REAL_RENDERS.map((img) => (
              <div key={img.label} className="group">
                <div className="aspect-square rounded-xl overflow-hidden border border-white/8 mb-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={img.label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <p className="text-[10px] text-white/35 font-medium">{img.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Value callout */}
      <section className="py-8 px-5">
        <div className="max-w-4xl mx-auto">
          <div className="bg-[#0e0e0e] border border-white/8 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <p className="text-xs text-white/40 mb-1">External studio — 10 renders/month</p>
              <p className="text-2xl font-bold text-white/35 line-through">$8,000–$20,000/mo</p>
            </div>
            <div className="text-white/25 text-2xl font-light hidden md:block">→</div>
            <div className="text-center md:text-right">
              <p className="text-xs text-white/40 mb-1">ProPlan Studio — unlimited renders/month</p>
              <p className="text-2xl font-bold text-white">$1,500/mo</p>
              <p className="text-xs text-emerald-400 mt-1">Everything included</p>
            </div>
          </div>
        </div>
      </section>

      {/* Deliverables + Process */}
      <section className="py-16 px-5 border-t border-white/6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight mb-6" style={{ fontFamily: "var(--font-syne), sans-serif" }}>
              What you receive
            </h2>
            <ul className="space-y-3">
              {DELIVERABLES.map(d => (
                <li key={d} className="flex items-start gap-2.5 text-sm text-white/55"><Check />{d}</li>
              ))}
            </ul>
            <div className="mt-8 bg-[#0e0e0e] border border-white/8 rounded-xl p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-3">Monthly allocation</p>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-white/50">ProPlan Studio</span>
                <span className="text-sm font-bold text-white">Unlimited renders / mo</span>
              </div>
              <p className="text-xs text-white/30 mt-2">One project in queue at a time · 48hr average turnaround per project</p>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-extrabold tracking-tight mb-6" style={{ fontFamily: "var(--font-syne), sans-serif" }}>
              How it works
            </h2>
            <div className="relative">
              <div className="hidden md:block absolute left-[19px] top-10 bottom-10 w-px bg-gradient-to-b from-violet-600/40 to-transparent" />
              {PROCESS.map((step, i) => (
                <div key={i} className="flex gap-5 pb-7 last:pb-0">
                  <div className="w-10 h-10 flex-shrink-0 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white z-10"
                    style={{ fontFamily: "var(--font-syne), sans-serif" }}>
                    {step.n}
                  </div>
                  <div className="pt-2">
                    <h3 className="text-sm font-bold text-white mb-1" style={{ fontFamily: "var(--font-syne), sans-serif" }}>{step.title}</h3>
                    <p className="text-xs text-white/40 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
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
            Stop paying $800 per image
          </h2>
          <p className="text-white/40 mb-8 max-w-md mx-auto">
            Unlimited studio renders are included in your $1,500/mo ProPlan subscription. No separate invoicing, no waiting for quotes.
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
