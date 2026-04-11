import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/landing/Nav";
import Footer from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "Book a Demo — ProPlan Studio | See the Buyer Journey Live",
  description:
    "Schedule a free 30-minute demo and watch a buyer go from site map to configured home to AI render to quote — all without calling your sales team. Built for production home builders.",
  openGraph: {
    title: "Book a Demo — ProPlan Studio",
    description:
      "See the complete buyer journey live in 30 minutes. Interactive site maps, 3D configurator, AI renders, and lead capture — all in one walkthrough.",
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

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden">
      <Nav />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-12 px-5 overflow-hidden">
        <div className="absolute inset-0 blueprint-grid opacity-20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(8,8,8,0)_0%,#080808_80%)]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/20 bg-blue-500/8 text-[11px] font-semibold text-blue-400 uppercase tracking-wide mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" /> Free · 30 minutes · No commitment
          </div>
          <h1
            className="text-5xl md:text-[58px] font-extrabold leading-[1.05] tracking-[-0.03em] mb-5"
            style={{ fontFamily: "var(--font-syne), sans-serif" }}
          >
            See the complete
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
              buyer journey live.
            </span>
          </h1>
          <p className="text-lg text-white/45 leading-relaxed">
            In 30 minutes you&apos;ll see a buyer go from lot selection to full home configuration to AI render to quote request — without picking up the phone.
          </p>
        </div>
      </section>

      {/* ── MAIN: what to expect + Calendly ──────────────────────────────── */}
      <section className="py-12 px-5">
        <div className="max-w-5xl mx-auto grid lg:grid-cols-[1fr_420px] gap-10 items-start">

          {/* Left: what we cover */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-5">What we cover in 30 minutes</p>
            <div className="space-y-4 mb-10">
              {[
                {
                  n: "01",
                  title: "The buyer journey end to end",
                  desc: "We walk through every step a buyer takes — from the interactive site map on your website to the configured home to the AI render preview to the quote submission — in a live demo environment.",
                },
                {
                  n: "02",
                  title: "Your builder dashboard",
                  desc: "How leads arrive, what data is attached (lot, model, configuration, render), and how your sales team picks up from there. No integration required to get started.",
                },
                {
                  n: "03",
                  title: "Renders and the studio",
                  desc: "How the AI render studio works for instant previews, and how the in-house studio team handles complex marketing renders. Both are inside your subscription.",
                },
                {
                  n: "04",
                  title: "Your specific questions",
                  desc: "We leave time for your situation — your community count, your current tools, your sales process. The goal is for you to leave knowing exactly how this fits.",
                },
              ].map((item) => (
                <div key={item.n} className="flex gap-4 bg-[#0e0e0e] border border-white/8 rounded-xl p-5 hover:border-white/14 transition-colors">
                  <div className="w-9 h-9 flex-shrink-0 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-xs font-bold text-white"
                    style={{ fontFamily: "var(--font-syne), sans-serif" }}>
                    {item.n}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white mb-1" style={{ fontFamily: "var(--font-syne), sans-serif" }}>{item.title}</h3>
                    <p className="text-sm text-white/40 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-[#0e0e0e] border border-white/8 rounded-2xl p-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-4">You&apos;ll leave knowing</p>
              <ul className="space-y-2.5">
                {[
                  "Exactly what buyers see and how they interact with your site",
                  "How leads arrive and what data is attached to each one",
                  "What setup looks like and how long it takes",
                  "Whether ProPlan is the right fit for your business",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-white/55">
                    <Check /> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right: Calendly embed */}
          <div className="bg-[#0e0e0e] border border-white/8 rounded-2xl overflow-hidden sticky top-24">
            <div className="border-b border-white/6 px-5 py-4">
              <p className="text-sm font-semibold text-white">Schedule your 30-minute demo</p>
              <p className="text-xs text-white/35 mt-0.5">Pick any open slot — we&apos;ll send a calendar invite.</p>
            </div>
            <div className="relative">
              <iframe
                src="https://calendly.com/proplanstudiollc/30min?hide_event_type_details=1&hide_gdpr_banner=1&background_color=0e0e0e&text_color=ffffff&primary_color=3b82f6"
                width="100%"
                height="620"
                frameBorder="0"
                title="Schedule a ProPlan Studio demo"
                className="block"
              />
            </div>
            <div className="border-t border-white/6 px-5 py-3 text-center">
              <p className="text-xs text-white/22">
                Prefer email?{" "}
                <a href="mailto:hello@proplanstudio.com" className="text-blue-400 hover:text-blue-300 transition-colors">
                  hello@proplanstudio.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF / REASSURANCE ───────────────────────────────────── */}
      <section className="py-16 px-5 border-t border-white/6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-white/30 text-sm mb-8">Not ready to book? Explore first.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/for-builders"
              className="inline-flex items-center justify-center px-6 py-3 bg-white/6 hover:bg-white/10 border border-white/10 text-white text-sm font-medium rounded-xl transition-all">
              How it works for builders
            </Link>
            <Link href="/pricing"
              className="inline-flex items-center justify-center px-6 py-3 bg-white/6 hover:bg-white/10 border border-white/10 text-white text-sm font-medium rounded-xl transition-all">
              See pricing
            </Link>
            <Link href="/products/configurator"
              className="inline-flex items-center justify-center px-6 py-3 bg-white/6 hover:bg-white/10 border border-white/10 text-white text-sm font-medium rounded-xl transition-all">
              Explore products
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
