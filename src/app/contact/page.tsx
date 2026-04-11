import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/landing/Nav";
import Footer from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "Contact ProPlan Studio — Talk to a Real Person",
  description:
    "Questions about our 3D configurator, AI render studio, or pricing? Reach the ProPlan Studio team at hello@proplanstudio.com or book a live demo.",
  openGraph: {
    title: "Contact ProPlan Studio",
    description:
      "Reach our team at hello@proplanstudio.com or book a 30-minute demo to see the full buyer journey live.",
  },
};

function Arrow() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
    </svg>
  );
}

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden">
      <Nav />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-16 px-5 overflow-hidden">
        <div className="absolute inset-0 blueprint-grid opacity-20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(8,8,8,0)_0%,#080808_80%)]" />
        <div className="relative max-w-2xl mx-auto text-center">
          <h1
            className="text-5xl md:text-[56px] font-extrabold leading-[1.05] tracking-[-0.03em] mb-5"
            style={{ fontFamily: "var(--font-syne), sans-serif" }}
          >
            Let&apos;s talk.
          </h1>
          <p className="text-lg text-white/45 leading-relaxed">
            Whether you have a question about pricing, a specific product, or want to see the buyer journey live — we&apos;re easy to reach.
          </p>
        </div>
      </section>

      {/* ── CONTACT OPTIONS ──────────────────────────────────────────────── */}
      <section className="py-16 px-5">
        <div className="max-w-3xl mx-auto grid md:grid-cols-2 gap-5">

          {/* Email */}
          <div className="bg-[#0e0e0e] border border-white/8 rounded-2xl p-8 flex flex-col">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-5">
              <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-2">Email us</p>
            <p className="text-base font-semibold text-white mb-2">hello@proplanstudio.com</p>
            <p className="text-sm text-white/40 leading-relaxed mb-6 flex-1">
              Pricing questions, partnership inquiries, technical support — one inbox handles it all. We respond within one business day.
            </p>
            <a
              href="mailto:hello@proplanstudio.com"
              className="inline-flex items-center gap-2 text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors"
            >
              Send an email <Arrow />
            </a>
          </div>

          {/* Demo */}
          <div className="bg-blue-600/8 border border-blue-500/25 rounded-2xl p-8 flex flex-col">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center mb-5">
              <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400/60 mb-2">Book a demo</p>
            <p className="text-base font-semibold text-white mb-2">30-minute live walkthrough</p>
            <p className="text-sm text-white/40 leading-relaxed mb-6 flex-1">
              See the full buyer journey — site map, configurator, AI render, lead capture — in a live session. Pick any open slot on our calendar.
            </p>
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors"
            >
              Schedule now <Arrow />
            </Link>
          </div>
        </div>
      </section>

      {/* ── FAQ-STYLE ROUTING ────────────────────────────────────────────── */}
      <section className="py-16 px-5 border-t border-white/6">
        <div className="max-w-3xl mx-auto">
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-6">Not sure where to start?</p>
          <div className="space-y-3">
            {[
              {
                q: "I want to understand pricing before I reach out.",
                href: "/pricing",
                label: "See full pricing",
              },
              {
                q: "I want to see what the buyer experience actually looks like.",
                href: "/demo",
                label: "Book a demo",
              },
              {
                q: "I want to understand how ProPlan fits my business.",
                href: "/for-builders",
                label: "See how it works for builders",
              },
              {
                q: "I have a question about a specific product.",
                href: "/products/configurator",
                label: "Explore the products",
              },
            ].map((item) => (
              <div key={item.q} className="flex items-center justify-between gap-6 bg-[#0e0e0e] border border-white/8 rounded-xl px-5 py-4 hover:border-white/14 transition-colors group">
                <p className="text-sm text-white/55">{item.q}</p>
                <Link href={item.href} className="flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 whitespace-nowrap transition-colors">
                  {item.label} <Arrow />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
