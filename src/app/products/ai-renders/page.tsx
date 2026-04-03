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

const RENDER_TYPES = [
  { label: "Exterior — Day",   desc: "Bright, inviting kerb-appeal shots" },
  { label: "Exterior — Dusk",  desc: "Golden hour with warm interior glow" },
  { label: "Aerial / Bird's-eye", desc: "Community and site context" },
  { label: "Interior — Kitchen",  desc: "Lifestyle-ready kitchen & dining" },
  { label: "Interior — Living",   desc: "Feature walls, lighting, staging" },
  { label: "Interior — Bedroom",  desc: "Master suite and secondary rooms" },
];

const IMG = {
  kitchen:  "https://lh3.googleusercontent.com/aida-public/AB6AXuAYhWuJp9MEDaj2XdONiX8cZFiq3XU_k5eOVCKfLHQurkUjeeaMlf0Mg6nrX6mKW-JhqeEwcO5f72JrAVd5h_1EJgZC5Xb6bCLCoqNNq_ZSeg4gAmicoDBFt8NvaQtnmqogmdaRafLUzasJ5OgpEfQyoqQLhvwlySuTLlfkjfIR5W5veGTkqp4zrw0AfZtrtlNpkKrj2uXPjhVeCiE-cj3zwHhPYuQnfSOkndAZ-1zKlPJb2RF0puWqY3tQJDN3-gAJ4trSg2cEBbA",
  exterior: "https://lh3.googleusercontent.com/aida-public/AB6AXuAs5y9iqUKoUIUsaabLSGQRHBzMJdLWRWfmzS72MbrngIpzW_NS5armTd4wMJSIx4KJUw0tim46YgW_DuQoITaRFsR-IO5vHYb87YZSw__khAtrwbPIHnphUx3wH7cQaNultfiz2C8QZA6vu6hDc6dBL2gdfdBTxD9T4I8Doq8zP8_oqsJa3gefzMn-i056pYlIMYXZNsQqtquOyEcOS68t1FYXONys2yjXn41MCXSVdDMC2eyKYJTPBcRngQa6JQBX0aTKK2fnJmo",
};

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
            Your floor plan.
            <br />
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              Studio-quality renders. Seconds.
            </span>
          </h1>
          <p className="text-lg text-white/45 leading-relaxed max-w-2xl mx-auto mb-10">
            Upload a floor plan or brief and our AI Render Studio generates photorealistic exterior, interior, and aerial views instantly. No waiting. No separate invoices. Included in every ProPlan plan.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/auth/signup"
              className="flex items-center justify-center gap-2 px-7 py-3.5 bg-blue-600 hover:bg-blue-500 text-white text-[15px] font-semibold rounded-xl transition-colors shadow-2xl shadow-blue-600/25">
              Start generating renders
            </Link>
            <Link href="/pricing"
              className="flex items-center justify-center px-7 py-3.5 bg-white/6 hover:bg-white/10 border border-white/10 text-white text-[15px] font-medium rounded-xl transition-all">
              See credits per plan
            </Link>
          </div>
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
              Same project — floor plan vs. AI render
            </h2>
            <p className="text-white/40 mt-2">Drag to compare. Generated from actual plan data.</p>
          </div>
          <AIRenderSlider />
        </div>
      </section>

      {/* Render types grid */}
      <section className="py-16 px-5 border-t border-white/6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2
              className="text-3xl font-extrabold tracking-tight"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              Every render type, included
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-10">
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

          {/* Sample renders */}
          <div className="grid grid-cols-2 gap-3">
            <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-white/8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={IMG.kitchen} alt="Kitchen AI render" className="w-full h-full object-cover" />
            </div>
            <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-white/8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={IMG.exterior} alt="Exterior AI render" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </section>

      {/* Credits comparison */}
      <section className="py-16 px-5 border-t border-white/6">
        <div className="max-w-3xl mx-auto">
          <h2
            className="text-2xl font-extrabold tracking-tight text-center mb-8"
            style={{ fontFamily: "var(--font-syne), sans-serif" }}
          >
            AI credits per plan
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { name: "Launch", credits: 150, price: "$699/mo" },
              { name: "Studio", credits: 400, price: "$1,499/mo", highlight: true },
              { name: "Scale",  credits: 1000, price: "$2,499/mo" },
            ].map((t) => (
              <div key={t.name}
                className={`rounded-2xl p-6 border text-center ${
                  t.highlight ? "border-amber-500/30 bg-amber-500/6" : "border-white/8 bg-[#0e0e0e]"
                }`}>
                <p className="text-sm font-bold text-white/50 mb-1" style={{ fontFamily: "var(--font-syne), sans-serif" }}>{t.name}</p>
                <p className="text-3xl font-extrabold text-white mb-1" style={{ fontFamily: "var(--font-syne), sans-serif" }}>{t.credits}</p>
                <p className="text-xs text-white/35 mb-3">AI render credits / mo</p>
                <p className="text-xs font-semibold text-white/50">{t.price}</p>
              </div>
            ))}
          </div>
          <ul className="mt-6 space-y-2">
            {["All credit types included (exterior, interior, aerial)", "Unused credits do not roll over", "Additional credits available as add-ons"].map(i => (
              <li key={i} className="flex items-center gap-2.5 text-sm text-white/45"><Check />{i}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-5 border-t border-white/6">
        <div className="max-w-3xl mx-auto text-center">
          <h2
            className="text-3xl font-extrabold tracking-tight mb-4"
            style={{ fontFamily: "var(--font-syne), sans-serif" }}
          >
            Stop waiting days for a single image
          </h2>
          <p className="text-white/40 mb-8 max-w-md mx-auto">
            Every ProPlan plan includes AI render credits. Start generating photorealistic views the moment your model is live.
          </p>
          <Link href="/auth/signup"
            className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors shadow-xl shadow-blue-600/20">
            Get started free
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
