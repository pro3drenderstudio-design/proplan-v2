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

const IMG = {
  kitchen:  "https://lh3.googleusercontent.com/aida-public/AB6AXuAYhWuJp9MEDaj2XdONiX8cZFiq3XU_k5eOVCKfLHQurkUjeeaMlf0Mg6nrX6mKW-JhqeEwcO5f72JrAVd5h_1EJgZC5Xb6bCLCoqNNq_ZSeg4gAmicoDBFt8NvaQtnmqogmdaRafLUzasJ5OgpEfQyoqQLhvwlySuTLlfkjfIR5W5veGTkqp4zrw0AfZtrtlNpkKrj2uXPjhVeCiE-cj3zwHhPYuQnfSOkndAZ-1zKlPJb2RF0puWqY3tQJDN3-gAJ4trSg2cEBbA",
  living:   "https://lh3.googleusercontent.com/aida-public/AB6AXuAcgkk9ueCldLD-tmtfAS7WxGC3tIYXLlm4ONf0xo-EgKI_m1zjO-Calw4KN3Mrol8OJ9rrrE7IVgmOtzj_I3wNf1c6FW-tlHXzBLYIJSHeGGe6hGqV7TG1_g62OaMxBVuS79JnCHCoyatKyOl9wlStWdMvPxtUpDqUHM3XZii6YVQ0YlRyadzF6EQMtlwZwqgsYKLfAEk7hYe9Bhg6XVCPZXddIktOtd3z-nIAG5drof4x7HDwL1uWZ2rb2DttTUubAlWY_7XGnMs",
  exterior: "https://lh3.googleusercontent.com/aida-public/AB6AXuAs5y9iqUKoUIUsaabLSGQRHBzMJdLWRWfmzS72MbrngIpzW_NS5armTd4wMJSIx4KJUw0tim46YgW_DuQoITaRFsR-IO5vHYb87YZSw__khAtrwbPIHnphUx3wH7cQaNultfiz2C8QZA6vu6hDc6dBL2gdfdBTxD9T4I8Doq8zP8_oqsJa3gefzMn-i056pYlIMYXZNsQqtquOyEcOS68t1FYXONys2yjXn41MCXSVdDMC2eyKYJTPBcRngQa6JQBX0aTKK2fnJmo",
  bedroom:  "https://lh3.googleusercontent.com/aida-public/AB6AXuBLSmR4mmN38-KQHDIKqbE9zR-pcilUp4Py2PPFzSkYh9jU_XQDO7PGAa3pkRyGXsx81i2FGBfriMIl1ynP4YdNyK0ZQevakcZgahLd5WQhAxWGwmMsdCPgy3mGSYoPgw-U7pqVkQO2Bh3xOnzNMjuevY4ojcDeeNJmi7Cr4_OXZo8S4eL88eCJLmuI_5Bg_0QGzJtIcYM2CNxExHWAKTBaqtNrr_aepdn1mjj1r5aF_mlpvCDLNpnSwYfOe6AhP73DEDtyfP6-ThE",
};

const DELIVERABLES = [
  "Full-resolution JPEG + PNG files (print & web)",
  "Multiple camera angles per scene",
  "Day and dusk lighting variants",
  "2 rounds of revisions included",
  "Delivered via your builder portal",
  "Usage rights — yours forever",
];

const PROCESS = [
  { n: "01", title: "Submit your brief",     desc: "Share floor plans, elevations, and style references through your builder portal. The more detail, the better." },
  { n: "02", title: "We build the scene",    desc: "Our artists model the exterior, landscape, and interior scenes from scratch using your plans as the source of truth." },
  { n: "03", title: "Preview & feedback",    desc: "You receive a draft preview within 48 hours. Provide feedback and we incorporate your revisions." },
  { n: "04", title: "Final delivery",        desc: "Full-resolution files are delivered to your portal. Ready for print, digital ads, and social media." },
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
            Photorealistic renders
            <br />
            <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
              by our studio team.
            </span>
          </h1>
          <p className="text-lg text-white/45 leading-relaxed max-w-2xl mx-auto mb-10">
            Hand-crafted renders built by our in-house 3D artists from your floor plans. Marketing-grade quality, 48-hour turnaround, included in your monthly plan allocation — not billed per image.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/auth/signup"
              className="flex items-center justify-center gap-2 px-7 py-3.5 bg-blue-600 hover:bg-blue-500 text-white text-[15px] font-semibold rounded-xl transition-colors shadow-2xl shadow-blue-600/25">
              Get renders included in your plan
            </Link>
          </div>
          <p className="mt-4 text-xs text-white/22">15 renders/mo on Launch · 50/mo on Studio · Unlimited on Scale</p>
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

      {/* Gallery */}
      <section className="py-16 px-5 border-t border-white/6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2
              className="text-3xl font-extrabold tracking-tight"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              Sample renders from our studio
            </h2>
            <p className="text-white/40 mt-2">All renders below were produced by our in-house team from builder-supplied floor plans.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { src: IMG.kitchen,  alt: "Modern kitchen render",       label: "Interior — Kitchen" },
              { src: IMG.living,   alt: "Contemporary living room",    label: "Interior — Living" },
              { src: IMG.exterior, alt: "House exterior golden hour",  label: "Exterior — Dusk" },
              { src: IMG.bedroom,  alt: "Luxury master bedroom",       label: "Interior — Bedroom" },
            ].map((img) => (
              <div key={img.label} className="group">
                <div className="aspect-square rounded-xl overflow-hidden border border-white/8 mb-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.src} alt={img.alt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <p className="text-[10px] text-white/35 font-medium">{img.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Deliverables + Process side-by-side */}
      <section className="py-16 px-5 border-t border-white/6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12">
          {/* Deliverables */}
          <div>
            <h2
              className="text-2xl font-extrabold tracking-tight mb-6"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              What you receive
            </h2>
            <ul className="space-y-3">
              {DELIVERABLES.map(d => (
                <li key={d} className="flex items-start gap-2.5 text-sm text-white/55"><Check />{d}</li>
              ))}
            </ul>
            <div className="mt-8 bg-[#0e0e0e] border border-white/8 rounded-xl p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-3">Monthly allocation</p>
              <div className="space-y-2">
                {[
                  { plan: "Launch",  n: "15 renders / mo" },
                  { plan: "Studio",  n: "50 renders / mo" },
                  { plan: "Scale",   n: "Unlimited*" },
                ].map(t => (
                  <div key={t.plan} className="flex items-center justify-between py-2 border-b border-white/6 last:border-0">
                    <span className="text-sm text-white/50" style={{ fontFamily: "var(--font-syne), sans-serif" }}>{t.plan}</span>
                    <span className="text-sm font-semibold text-white">{t.n}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Process */}
          <div>
            <h2
              className="text-2xl font-extrabold tracking-tight mb-6"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
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
            Stop paying $1,200 per image
          </h2>
          <p className="text-white/40 mb-8 max-w-md mx-auto">
            Every ProPlan plan includes a monthly render allocation from our studio team. No separate invoicing, no waiting for quotes.
          </p>
          <Link href="/pricing"
            className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors shadow-xl shadow-blue-600/20">
            See plans and render allocations
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
