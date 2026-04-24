import Link from "next/link";
import Nav  from "@/components/landing/Nav";
import Footer from "@/components/landing/Footer";
import VideoPlaceholder from "@/components/landing/VideoPlaceholder";
import CalendlyButton from "@/components/CalendlyButton";
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
  { url: "https://qvgsdrjkjtzwtxfepyoe.supabase.co/storage/v1/object/public/render-studio/1775608561463-elevation.jpg", label: "Exterior — Midday" },
  { url: "https://qvgsdrjkjtzwtxfepyoe.supabase.co/storage/v1/object/public/render-studio/1775090072907-interior.jpg",  label: "Interior — Natural Light" },
  { url: "https://qvgsdrjkjtzwtxfepyoe.supabase.co/storage/v1/object/public/render-studio/1775502302584-elevation.jpg", label: "Exterior — Golden Hour" },
  { url: "https://qvgsdrjkjtzwtxfepyoe.supabase.co/storage/v1/object/public/render-studio/1775122222672-elevation.jpg", label: "Contemporary — Dusk" },
];

export default async function ThreeDRenderingPage() {
  const plan         = await fetchActivePlan();
  const monthlyPrice = plan?.price_monthly ?? 150000;
  const renderCount  = plan?.rendering_credits_monthly === -1 ? "Unlimited" : (plan?.rendering_credits_monthly ?? "Unlimited");

  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden">
      <Nav />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-16 px-5 overflow-hidden">
        <div className="absolute inset-0 blueprint-grid opacity-30" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(8,8,8,0)_0%,#080808_80%)]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-violet-600/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-violet-500/20 bg-violet-500/8 text-[11px] font-semibold text-violet-400 uppercase tracking-wide mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400" /> In-House Studio
          </div>
          <h1
            className="text-5xl md:text-[62px] font-extrabold leading-[1.04] tracking-[-0.03em] mb-6"
            style={{ fontFamily: "var(--font-syne), sans-serif" }}
          >
            Studio-quality renders.
            <br />
            <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
              Already in your subscription.
            </span>
          </h1>
          <p className="text-lg text-white/45 leading-relaxed max-w-2xl mx-auto mb-5">
            When a scene needs the human touch — complex lighting, custom materials, marketing hero shots — our in-house studio team handles it. Submit a brief, review a draft in 48 hours, and receive final files ready for print, digital, and social.
          </p>
          <p className="text-base text-white/30 max-w-xl mx-auto mb-10">
            External studios charge $800–$2,000 per image. ProPlan includes {renderCount === "Unlimited" ? "unlimited" : renderCount} traditional renders per month. No separate invoicing. No per-image fees. Ever.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-5">
            <CalendlyButton
              className="flex items-center justify-center gap-2 px-7 py-3.5 bg-blue-600 hover:bg-blue-500 text-white text-[15px] font-semibold rounded-xl transition-colors shadow-2xl shadow-blue-600/25">
              Schedule a Demo <Arrow />
            </CalendlyButton>
            <Link href="/pricing"
              className="flex items-center justify-center px-7 py-3.5 bg-white/6 hover:bg-white/10 border border-white/10 text-white text-[15px] font-medium rounded-xl transition-all">
              See pricing
            </Link>
          </div>
          <p className="text-xs text-white/22">{renderCount} renders/mo · 48hr turnaround · Included in {fmtUSD(monthlyPrice)}/mo</p>
        </div>
      </section>

      {/* ── VIDEO ────────────────────────────────────────────────────────── */}
      <section className="py-8 px-5">
        <div className="max-w-4xl mx-auto">
          <VideoPlaceholder
            title="Studio rendering — brief to final delivery walkthrough"
            duration="3:00"
            subtitle="Behind the scenes"
          />
        </div>
      </section>

      {/* ── GALLERY ───────────────────────────────────────────────────────── */}
      <section className="py-16 px-5 border-t border-white/6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2
              className="text-3xl font-extrabold tracking-tight"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              Work from our studio team
            </h2>
            <p className="text-white/40 mt-2">Produced from builder-supplied floor plans. Every image included in the subscription.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
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

          {/* Cost comparison */}
          <div className="bg-[#0e0e0e] border border-white/8 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <p className="text-xs text-white/30 mb-1">External studio — 10 renders / month</p>
              <p className="text-2xl font-bold text-white/30 line-through" style={{ fontFamily: "var(--font-syne), sans-serif" }}>$8,000–$20,000/mo</p>
            </div>
            <div className="hidden md:flex items-center text-white/20 text-2xl font-light">→</div>
            <div className="text-center md:text-right">
              <p className="text-xs text-white/30 mb-1">ProPlan Studio — {renderCount} renders included</p>
              <p className="text-2xl font-bold text-white" style={{ fontFamily: "var(--font-syne), sans-serif" }}>{fmtUSD(monthlyPrice)}/mo</p>
              <p className="text-xs text-emerald-400 mt-1">Everything included — no extra invoices</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHY IT'S INCLUDED ─────────────────────────────────────────────── */}
      <section className="py-20 px-5 border-t border-white/6">
        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-14 items-start">
            <div>
              <p className="text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-4">Why renders are included</p>
              <h2
                className="text-3xl md:text-4xl font-extrabold tracking-tight mb-5 leading-tight"
                style={{ fontFamily: "var(--font-syne), sans-serif" }}
              >
                AI changed what&apos;s possible at this price.
              </h2>
              <p className="text-white/45 leading-relaxed mb-5">
                Traditional rendering studios charge $800–$2,000 per image because production is slow and labor-intensive. We use AI to accelerate every stage of the process — scene setup, lighting, material refinement — so our team produces the same quality output in a fraction of the time.
              </p>
              <p className="text-white/35 leading-relaxed mb-8">
                That efficiency gets passed directly to you. Not as a discount on a per-image rate, but as a complete removal of the per-image model altogether. Renders are part of the subscription, exactly like electricity is part of your office lease.
              </p>
              <ul className="space-y-3">
                {[
                  "Same studio quality — significantly faster production",
                  "Human artists on every job — AI handles the repetitive parts",
                  "Revisions handled in the same turnaround window",
                  "Usage rights included — yours to use anywhere, forever",
                ].map(item => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-white/55"><Check />{item}</li>
                ))}
              </ul>
            </div>

            <div className="space-y-4">
              {/* Deliverables */}
              <div className="bg-[#0e0e0e] border border-white/8 rounded-2xl p-6">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-4">What you receive</p>
                <ul className="space-y-2.5">
                  {[
                    "Full-resolution JPEG + PNG — print and web ready",
                    "Multiple camera angles per scene",
                    "Day and dusk lighting variants",
                    "2 rounds of revisions included per project",
                    "Delivered via your builder portal",
                    "Usage rights — yours forever",
                  ].map(d => (
                    <li key={d} className="flex items-start gap-2.5 text-sm text-white/55"><Check />{d}</li>
                  ))}
                </ul>
              </div>

              {/* Allocation */}
              <div className="bg-violet-500/5 border border-violet-500/20 rounded-2xl p-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-violet-400/60 mb-3">Monthly allocation</p>
                <div className="flex items-baseline gap-2 mb-1">
                  <p className="text-3xl font-extrabold text-white" style={{ fontFamily: "var(--font-syne), sans-serif" }}>{renderCount}</p>
                  <p className="text-sm text-violet-300">renders / month</p>
                </div>
                <p className="text-xs text-white/30">48hr average turnaround per project · One active project in queue at a time</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PROCESS ───────────────────────────────────────────────────────── */}
      <section className="py-20 px-5 border-t border-white/6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-syne), sans-serif" }}>
              From brief to final delivery
            </h2>
            <p className="text-white/40 mt-3">Submit through your builder portal and we handle the rest.</p>
          </div>
          <div className="relative">
            <div className="hidden md:block absolute left-[19px] top-10 bottom-10 w-px bg-gradient-to-b from-violet-600/40 to-transparent" />
            {[
              { n: "01", title: "Submit your brief",   desc: "Share floor plans, elevations, and any style references through your builder portal. The more context you provide, the closer the first draft will be." },
              { n: "02", title: "We build the scene",  desc: "Our artists model the exterior, landscape, and interior scenes from your plans using AI-accelerated production. You don't need to be involved." },
              { n: "03", title: "Review a draft",      desc: "You receive a preview within 48 hours. Review it, leave feedback in the portal, and we incorporate all changes." },
              { n: "04", title: "Receive final files", desc: "Full-resolution files land in your portal — ready for print campaigns, website, digital ads, and social media. Usage rights are yours permanently." },
            ].map((step, i) => (
              <div key={i} className="flex gap-5 pb-7 last:pb-0">
                <div className="w-10 h-10 flex-shrink-0 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-xs font-bold text-white z-10"
                  style={{ fontFamily: "var(--font-syne), sans-serif" }}>
                  {step.n}
                </div>
                <div className="pt-2">
                  <h3 className="text-base font-bold text-white mb-1.5" style={{ fontFamily: "var(--font-syne), sans-serif" }}>{step.title}</h3>
                  <p className="text-sm text-white/40 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
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
            Stop paying $800 per image.
          </h2>
          <p className="text-white/40 mb-8 max-w-md mx-auto">
            {renderCount} studio renders per month, included in your {fmtUSD(monthlyPrice)}/mo subscription. No separate invoicing. No waiting for quotes.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <CalendlyButton
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors shadow-xl shadow-blue-600/20">
              Schedule a Demo <Arrow />
            </CalendlyButton>
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
