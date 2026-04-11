import Link from "next/link";
import Nav  from "@/components/landing/Nav";
import Footer from "@/components/landing/Footer";
import VideoPlaceholder from "@/components/landing/VideoPlaceholder";
import AIRenderSlider from "@/components/landing/AIRenderSlider";
import { fetchActivePlan, fmtUSD } from "@/lib/plans";

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
  { url: "https://qvgsdrjkjtzwtxfepyoe.supabase.co/storage/v1/object/public/render-studio/1775607389780-elevation.jpg",  label: "Exterior — Dusk" },
  { url: "https://qvgsdrjkjtzwtxfepyoe.supabase.co/storage/v1/object/public/render-studio/1775156293099-interior.jpg",  label: "Interior — Golden Hour" },
  { url: "https://qvgsdrjkjtzwtxfepyoe.supabase.co/storage/v1/object/public/render-studio/1775502302584-elevation.jpg", label: "Exterior — Golden Hour" },
  { url: "https://qvgsdrjkjtzwtxfepyoe.supabase.co/storage/v1/object/public/render-studio/1775345418634-elevation.jpg", label: "Exterior — Night" },
];

export default async function AIRendersPage() {
  const plan         = await fetchActivePlan();
  const monthlyPrice = plan?.price_monthly     ?? 150000;
  const aiCredits    = plan?.ai_credits_monthly ?? 250;

  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden">
      <Nav />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-16 px-5 overflow-hidden">
        <div className="absolute inset-0 blueprint-grid opacity-30" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(8,8,8,0)_0%,#080808_80%)]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-amber-600/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/20 bg-amber-500/8 text-[11px] font-semibold text-amber-400 uppercase tracking-wide mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> AI Render Studio
          </div>
          <h1
            className="text-5xl md:text-[62px] font-extrabold leading-[1.04] tracking-[-0.03em] mb-6"
            style={{ fontFamily: "var(--font-syne), sans-serif" }}
          >
            The render that makes a buyer
            <br />
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              stop scrolling.
            </span>
          </h1>
          <p className="text-lg text-white/45 leading-relaxed max-w-2xl mx-auto mb-5">
            When a buyer finishes configuring their home in the 3D configurator, they see an AI-generated render of it — their choices, their finishes, their home. That moment of recognition is what turns a browser into a lead.
          </p>
          <p className="text-base text-white/30 max-w-xl mx-auto mb-10">
            {aiCredits} AI render credits per month, included in your subscription. Generated in seconds, built for residential construction — not generic scenes.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-5">
            <Link href="/auth/signup"
              className="flex items-center justify-center gap-2 px-7 py-3.5 bg-amber-500 hover:bg-amber-400 text-[#080808] text-[15px] font-bold rounded-xl transition-colors shadow-2xl shadow-amber-600/20">
              Get started <Arrow />
            </Link>
            <Link href="/pricing"
              className="flex items-center justify-center px-7 py-3.5 bg-white/6 hover:bg-white/10 border border-white/10 text-white text-[15px] font-medium rounded-xl transition-all">
              See pricing
            </Link>
          </div>
          <p className="text-xs text-white/22">{aiCredits} AI credits/mo included · Resets monthly · No per-render fees</p>
        </div>
      </section>

      {/* ── VIDEO ────────────────────────────────────────────────────────── */}
      <section className="py-8 px-5">
        <div className="max-w-4xl mx-auto">
          <VideoPlaceholder
            title="AI Render Studio — Floor plan to photorealistic render in seconds"
            duration="2:45"
            subtitle="Product demo"
          />
        </div>
      </section>

      {/* ── BEFORE / AFTER ────────────────────────────────────────────────── */}
      <section className="py-16 px-5 border-t border-white/6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2
              className="text-3xl font-extrabold tracking-tight"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              Brief in. Render out. Seconds.
            </h2>
            <p className="text-white/40 mt-2">Drag the slider to compare. Generated from real builder plans.</p>
          </div>
          <AIRenderSlider />
        </div>
      </section>

      {/* ── WHY IT'S DIFFERENT ────────────────────────────────────────────── */}
      <section className="py-20 px-5 border-t border-white/6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-3">Why it&apos;s different</p>
            <h2
              className="text-3xl md:text-4xl font-extrabold tracking-tight"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              Built for homes. Not for anything else.
            </h2>
            <p className="text-white/40 mt-3 max-w-xl mx-auto">
              Generic AI image tools weren&apos;t designed for residential construction. Ours was. The difference shows in every output.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-5 mb-10">
            {[
              {
                title: "Trained on residential construction",
                desc: "Our model has been trained specifically on custom homes, elevation styles, material finishes, and interior design categories used in the building industry. The outputs look like the work of a specialist studio — because they are.",
                dot: "bg-amber-400",
                color: "border-amber-500/20 bg-amber-500/5",
              },
              {
                title: "Buyer-facing by design",
                desc: "The render appears inside the 3D configurator flow — immediately after a buyer finalises their selections. It's not a tool builders use privately; it's the emotional payoff that makes the buyer's decision feel real.",
                dot: "bg-orange-400",
                color: "border-orange-500/20 bg-orange-500/5",
              },
              {
                title: "Seconds, not days",
                desc: "Traditional studios take 48 hours minimum for a single image. AI renders are generated in under a minute. Use them for instant buyer previews, quick design variations, social content, and pre-sale marketing — without waiting.",
                dot: "bg-blue-400",
                color: "border-blue-500/20 bg-blue-500/5",
              },
              {
                title: "Credits reset every month",
                desc: `Your ${aiCredits} AI credits refresh on your billing date, every month. Use them freely across all your projects — exterior concepts, interior mood boards, aerial previews, material variations. No rollover pressure.`,
                dot: "bg-teal-400",
                color: "border-teal-500/20 bg-teal-500/5",
              },
            ].map((f) => (
              <div key={f.title} className={`rounded-2xl border p-7 ${f.color}`}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-2 h-2 rounded-full ${f.dot}`} />
                  <h3 className="text-base font-bold text-white" style={{ fontFamily: "var(--font-syne), sans-serif" }}>{f.title}</h3>
                </div>
                <p className="text-sm text-white/45 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Render types */}
          <div className="bg-[#0e0e0e] border border-white/8 rounded-2xl p-7">
            <p className="text-sm font-bold text-white mb-5" style={{ fontFamily: "var(--font-syne), sans-serif" }}>What you can generate</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: "Exterior — Day",       desc: "Bright, kerb-appeal hero shots"      },
                { label: "Exterior — Dusk",      desc: "Golden hour with warm interior glow" },
                { label: "Aerial / Bird's-eye",  desc: "Community and site context"          },
                { label: "Interior — Kitchen",   desc: "Lifestyle-ready kitchen & dining"    },
                { label: "Interior — Living",    desc: "Feature walls, lighting, staging"    },
                { label: "Interior — Bedroom",   desc: "Master suite and secondary rooms"    },
              ].map((t) => (
                <div key={t.label} className="bg-white/3 border border-white/6 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <p className="text-sm font-semibold text-white">{t.label}</p>
                  </div>
                  <p className="text-xs text-white/38">{t.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── REAL RENDERS ──────────────────────────────────────────────────── */}
      <section className="py-16 px-5 border-t border-white/6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2
              className="text-3xl font-extrabold tracking-tight"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              Real outputs from our AI studio
            </h2>
            <p className="text-white/40 mt-2">Generated from actual builder floor plans — not stock imagery or mock-ups.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
        </div>
      </section>

      {/* ── CREDITS CALLOUT ───────────────────────────────────────────────── */}
      <section className="py-16 px-5 border-t border-white/6">
        <div className="max-w-3xl mx-auto">
          <div className="bg-amber-500/6 border border-amber-500/20 rounded-2xl p-8">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="text-center md:text-left flex-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400/60 mb-3">Included in your subscription</p>
                <div className="flex items-baseline gap-2 mb-2 justify-center md:justify-start">
                  <p className="text-5xl font-extrabold text-white" style={{ fontFamily: "var(--font-syne), sans-serif" }}>{aiCredits}</p>
                  <p className="text-base font-semibold text-amber-400">AI credits / month</p>
                </div>
                <p className="text-sm text-white/35">Part of the {fmtUSD(monthlyPrice)}/mo ProPlan Studio subscription. Resets every billing cycle.</p>
              </div>
              <div className="flex-shrink-0">
                <ul className="space-y-2 mb-5">
                  {[
                    "Exterior, interior, and aerial types",
                    "Generated in seconds — no queue",
                    "Used inside the configurator flow",
                    "Export for marketing and social",
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
          </div>
        </div>
      </section>

      {/* ── PART OF THE JOURNEY ───────────────────────────────────────────── */}
      <section className="py-8 px-5 border-t border-white/6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-[#0d0d14] border border-white/8 rounded-2xl p-8">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-5">Part of the complete buyer journey</p>
            <div className="grid sm:grid-cols-4 gap-3">
              {[
                { label: "Site Map",      sub: "Buyer picks their lot",            href: "/products/site-maps",    active: false },
                { label: "Configurator",  sub: "They design their home in 3D",     href: "/products/configurator", active: false },
                { label: "AI Render",     sub: "They see it come to life",          href: "/products/ai-renders",   active: true  },
                { label: "Quote Capture", sub: "You receive a qualified lead",      href: "/",                      active: false },
              ].map((item) => (
                <Link key={item.label} href={item.href}
                  className={`rounded-xl p-4 border text-center transition-all ${item.active ? "bg-amber-500/10 border-amber-500/35" : "bg-white/3 border-white/8 hover:border-white/15"}`}>
                  <p className={`text-xs font-bold mb-1 ${item.active ? "text-amber-300" : "text-white/60"}`}>{item.label}</p>
                  <p className="text-[10px] text-white/30 leading-relaxed">{item.sub}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="py-20 px-5 border-t border-white/6">
        <div className="max-w-3xl mx-auto text-center">
          <h2
            className="text-3xl font-extrabold tracking-tight mb-4"
            style={{ fontFamily: "var(--font-syne), sans-serif" }}
          >
            Give every buyer a render of their home.
          </h2>
          <p className="text-white/40 mb-8 max-w-md mx-auto">
            {aiCredits} AI credits and unlimited studio renders are included in your {fmtUSD(monthlyPrice)}/mo subscription. Stop paying $800 per image to an external studio.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/auth/signup"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors shadow-xl shadow-blue-600/20">
              Get started — {fmtUSD(monthlyPrice)}/mo <Arrow />
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
