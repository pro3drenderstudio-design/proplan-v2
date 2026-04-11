import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/landing/Nav";
import Footer from "@/components/landing/Footer";
import { fetchActivePlan, fmtUSD } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Home Builder Sales & Lead Capture Platform | ProPlan Studio",
  description:
    "ProPlan Studio gives production home builders interactive site maps, 3D configurators, AI renders, and a built-in studio — all in one subscription. Capture high-intent leads and close more homes.",
  keywords: [
    "home builder software",
    "3D configurator for home builders",
    "home builder lead capture",
    "interactive site map for home builders",
    "new home builder sales tools",
    "production home builder technology",
    "home builder AI renders",
    "new construction lead generation",
  ],
  openGraph: {
    title: "Home Builder Sales Platform — ProPlan Studio",
    description:
      "Interactive site maps, 3D configurators, and AI renders built exclusively for production home builders. One subscription. One buyer journey. More closed homes.",
  },
};

function Check() {
  return (
    <svg className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-px" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" fill="#10b981" fillOpacity="0.12" />
      <path d="M5 8.5l2 2 4-4" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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

const PAIN_POINTS = [
  {
    before: "Buyers drive through your community on Saturday afternoon. The sales center is closed. They leave with a paper flyer.",
    after:  "They pull up your interactive site map on their phone, pick a lot, configure a home, and submit a quote request — in the driveway.",
    color:  "teal",
  },
  {
    before: "You run ads that bring in hundreds of leads. Most are curious browsers. Your team qualifies them one by one over the phone.",
    after:  "Leads arrive pre-qualified. Every one has a lot selected, a home configured, and an intent signal. Your team knows before the first call.",
    color:  "blue",
  },
  {
    before: "You pay an external rendering studio $800–$2,000 per image. Every campaign and every listing needs new renders. The invoices never stop.",
    after:  "AI renders are instant and included. Studio renders from our team are included. No per-image fees. No separate vendor to manage.",
    color:  "violet",
  },
  {
    before: "You manage separate tools for your website, configurator, renders, and CRM. They don't talk to each other. Data falls through the gaps.",
    after:  "One platform. The buyer journey, lead capture, renders, and studio requests are all connected and all in one subscription.",
    color:  "amber",
  },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Set up your communities",
    desc: "Upload your site plans and floor plans. Assign home models to lots. The interactive site map and 3D configurator are ready to embed on your website — typically within a day.",
    color: "teal",
  },
  {
    step: "02",
    title: "Buyers discover and configure",
    desc: "Buyers land on your site map, select an available lot, and configure the home model assigned to it — elevations, finishes, and options. They see an AI render of their configuration instantly.",
    color: "blue",
  },
  {
    step: "03",
    title: "Intent-qualified leads hit your dashboard",
    desc: "Every lead arrives with lot number, model, full configuration, AI render, and time-on-site. Your sales team knows exactly what each buyer wants before saying hello.",
    color: "violet",
  },
  {
    step: "04",
    title: "Studio renders for marketing",
    desc: "When you need hero-quality images for campaigns, listings, and signage, submit a brief in your builder portal. Our in-house studio team delivers in 48 hours — no separate invoice.",
    color: "amber",
  },
];

export default async function ForBuildersPage() {
  const plan         = await fetchActivePlan();
  const monthlyPrice = plan?.price_monthly ?? 150000;

  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden">
      <Nav />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-20 px-5 overflow-hidden">
        <div className="absolute inset-0 blueprint-grid opacity-25" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(8,8,8,0)_0%,#080808_80%)]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/20 bg-blue-500/8 text-[11px] font-semibold text-blue-400 uppercase tracking-wide mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> Built exclusively for production home builders
          </div>
          <h1
            className="text-5xl md:text-[62px] font-extrabold leading-[1.04] tracking-[-0.03em] mb-6"
            style={{ fontFamily: "var(--font-syne), sans-serif" }}
          >
            More homes closed.
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
              From the same traffic you already have.
            </span>
          </h1>
          <p className="text-lg text-white/45 leading-relaxed max-w-2xl mx-auto mb-5">
            ProPlan Studio gives your buyers an interactive experience — site map, 3D configurator, AI render, quote request — that qualifies them before your sales team ever picks up the phone.
          </p>
          <p className="text-base text-white/30 max-w-xl mx-auto mb-10">
            Every tool in the buyer journey is built into one subscription. No per-render fees. No per-seat licenses. No five different vendors.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/demo"
              className="flex items-center justify-center gap-2 px-7 py-3.5 bg-blue-600 hover:bg-blue-500 text-white text-[15px] font-semibold rounded-xl transition-colors shadow-2xl shadow-blue-600/25">
              Book a demo <Arrow />
            </Link>
            <Link href="/pricing"
              className="flex items-center justify-center px-7 py-3.5 bg-white/6 hover:bg-white/10 border border-white/10 text-white text-[15px] font-medium rounded-xl transition-all">
              See pricing
            </Link>
          </div>
        </div>
      </section>

      {/* ── THE PHYSICAL-TO-DIGITAL GAP ──────────────────────────────────── */}
      <section className="py-20 px-5 border-t border-white/6">
        <div className="max-w-3xl mx-auto text-center mb-14">
          <p className="text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-4">The problem ProPlan solves</p>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight mb-5" style={{ fontFamily: "var(--font-syne), sans-serif" }}>
            The Physical-to-Digital Gap
          </h2>
          <p className="text-white/45 leading-relaxed">
            Your best buyers are already in your communities — walking lots, imagining their future home, ready to commit. But when they arrive outside business hours, or on a weekend, or before they&apos;re ready to call — they find nothing. That moment of real buyer intent disappears.
          </p>
        </div>
        <div className="max-w-5xl mx-auto space-y-4">
          {PAIN_POINTS.map((p, i) => {
            const borderBefore = "border-red-500/15 bg-red-500/3";
            const borderAfter  = p.color === "teal"
              ? "border-teal-500/25 bg-teal-500/5"
              : p.color === "blue"
              ? "border-blue-500/25 bg-blue-500/5"
              : p.color === "violet"
              ? "border-violet-500/25 bg-violet-500/5"
              : "border-amber-500/25 bg-amber-500/5";
            return (
              <div key={i} className="grid md:grid-cols-2 gap-3">
                <div className={`rounded-2xl border ${borderBefore} p-6`}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-red-400/50 mb-3">Before ProPlan</p>
                  <p className="text-sm text-white/45 leading-relaxed">{p.before}</p>
                </div>
                <div className={`rounded-2xl border ${borderAfter} p-6`}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/60 mb-3">With ProPlan</p>
                  <p className="text-sm text-white/65 leading-relaxed">{p.after}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section className="py-20 px-5 border-t border-white/6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-3">Setup to first lead</p>
            <h2 className="text-3xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-syne), sans-serif" }}>
              How it works for your business
            </h2>
          </div>
          <div className="relative">
            <div className="hidden md:block absolute left-[19px] top-10 bottom-10 w-px bg-gradient-to-b from-blue-600/40 to-transparent" />
            {HOW_IT_WORKS.map((step, i) => (
              <div key={i} className="flex gap-5 pb-8 last:pb-0">
                <div className="w-10 h-10 flex-shrink-0 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-xs font-bold text-white z-10"
                  style={{ fontFamily: "var(--font-syne), sans-serif" }}>
                  {step.step}
                </div>
                <div className="pt-2 flex-1">
                  <h3 className="text-base font-bold text-white mb-1.5" style={{ fontFamily: "var(--font-syne), sans-serif" }}>{step.title}</h3>
                  <p className="text-sm text-white/40 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHAT'S INCLUDED ──────────────────────────────────────────────── */}
      <section className="py-20 px-5 border-t border-white/6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-syne), sans-serif" }}>
              One subscription covers everything
            </h2>
            <p className="text-white/40 mt-3">Everything a builder needs to take a buyer from driveway to contract.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                href:  "/products/site-maps",
                label: "Interactive Site Maps",
                color: "teal",
                desc:  "Live lot availability. Buyers browse, click, and select before calling.",
                items: ["Real-time lot status", "Unlimited communities", "Embed anywhere"],
              },
              {
                href:  "/products/configurator",
                label: "3D Configurator",
                color: "blue",
                desc:  "Buyers customize their home — elevation, finishes, options — in 3D.",
                items: ["Linked to each lot", "Full options control", "Lead data attached"],
              },
              {
                href:  "/products/ai-renders",
                label: "AI Render Studio",
                color: "violet",
                desc:  "Instant photorealistic preview of every buyer's exact configuration.",
                items: ["Instant generation", "Home-trained model", "Saved with the lead"],
              },
              {
                href:  "/products/3d-rendering",
                label: "Studio Renders",
                color: "amber",
                desc:  "Marketing-quality renders from our in-house team. 48-hour delivery.",
                items: ["Full-res JPEG + PNG", "Usage rights included", "Included in plan"],
              },
            ].map((card) => {
              const borderCls =
                card.color === "teal"   ? "border-teal-500/20 hover:border-teal-500/35" :
                card.color === "blue"   ? "border-blue-500/20 hover:border-blue-500/35" :
                card.color === "violet" ? "border-violet-500/20 hover:border-violet-500/35" :
                                          "border-amber-500/20 hover:border-amber-500/35";
              const labelCls =
                card.color === "teal"   ? "text-teal-400" :
                card.color === "blue"   ? "text-blue-400" :
                card.color === "violet" ? "text-violet-400" :
                                          "text-amber-400";
              return (
                <Link key={card.label} href={card.href}
                  className={`bg-[#0e0e0e] border ${borderCls} rounded-2xl p-6 flex flex-col transition-colors group`}>
                  <p className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${labelCls}`}>{card.label}</p>
                  <p className="text-sm text-white/55 leading-relaxed mb-4 flex-1">{card.desc}</p>
                  <ul className="space-y-1.5 mb-4">
                    {card.items.map(i => (
                      <li key={i} className="flex items-center gap-2 text-xs text-white/40"><Check />{i}</li>
                    ))}
                  </ul>
                  <p className={`text-xs font-semibold ${labelCls} group-hover:underline`}>Learn more →</p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── WHO IT'S FOR ─────────────────────────────────────────────────── */}
      <section className="py-20 px-5 border-t border-white/6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-syne), sans-serif" }}>
              Built for production home builders
            </h2>
            <p className="text-white/40 mt-3 max-w-xl mx-auto">Not agents. Not architects. Not developers. ProPlan is designed around how production builders sell.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              {
                title: "If you build in communities",
                desc: "Site maps and configurators are designed for subdivisions with multiple lots and multiple floor plans per community.",
              },
              {
                title: "If you have a sales center",
                desc: "Your sales team gets pre-qualified leads with full configuration data — so the first conversation starts where it should: at the contract.",
              },
              {
                title: "If you run paid advertising",
                desc: "Stop paying to qualify leads on the phone. Let the buyer journey do the qualification before a lead ever hits your CRM.",
              },
            ].map((c) => (
              <div key={c.title} className="bg-[#0e0e0e] border border-white/8 rounded-2xl p-6 hover:border-white/14 transition-colors">
                <h3 className="text-sm font-bold text-white mb-2" style={{ fontFamily: "var(--font-syne), sans-serif" }}>{c.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING CALLOUT ──────────────────────────────────────────────── */}
      <section className="py-20 px-5 border-t border-white/6">
        <div className="max-w-3xl mx-auto">
          <div className="bg-[#0e0e0e] border border-white/8 rounded-2xl p-8 text-center">
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-3">Pricing</p>
            <div className="flex items-baseline justify-center gap-2 mb-2">
              <p className="text-4xl font-extrabold text-white" style={{ fontFamily: "var(--font-syne), sans-serif" }}>
                {fmtUSD(monthlyPrice)}
              </p>
              <p className="text-lg text-white/35">/mo</p>
            </div>
            <p className="text-white/40 mb-6 max-w-md mx-auto">
              Everything above — site maps, configurator, AI render studio, and in-house studio renders — in one subscription. No per-image fees. No per-seat pricing.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/demo"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors shadow-xl shadow-blue-600/20">
                Book a demo <Arrow />
              </Link>
              <Link href="/pricing"
                className="inline-flex items-center justify-center px-7 py-3.5 bg-white/6 hover:bg-white/10 border border-white/10 text-white font-medium rounded-xl transition-all">
                See full pricing
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
