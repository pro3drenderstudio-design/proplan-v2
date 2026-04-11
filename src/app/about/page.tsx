import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/landing/Nav";
import Footer from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "About ProPlan Studio — Built to Close the Physical-to-Digital Gap",
  description:
    "ProPlan Studio was founded by a 3D design veteran who discovered why home builders lose their best buyers. Learn the story behind the platform built to fix it.",
  openGraph: {
    title: "About ProPlan Studio",
    description:
      "We built ProPlan Studio to bridge the gap between a buyer walking your community and a signed contract. Here's the story behind it.",
  },
};

function Arrow() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
    </svg>
  );
}

const VALUES = [
  {
    title: "Intent over volume",
    desc: "A hundred unqualified form fills are worth less than one buyer who already knows which lot and floor plan they want. We build tools that separate those two.",
  },
  {
    title: "Builders deserve better tooling",
    desc: "Most real estate tech is built for agents and brokers. Production home builders have a completely different sales process. We build exclusively for them.",
  },
  {
    title: "One price, no surprises",
    desc: "Per-render fees, per-seat licenses, and platform add-ons fragment your budget and hide the real cost. We put everything in one subscription.",
  },
  {
    title: "AI should accelerate people, not replace them",
    desc: "Our AI tools speed up render production and site configuration. A human artist reviews every studio render. Speed and quality aren't a trade-off.",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden">
      <Nav />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-20 px-5 overflow-hidden">
        <div className="absolute inset-0 blueprint-grid opacity-20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(8,8,8,0)_0%,#080808_80%)]" />
        <div className="relative max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/20 bg-blue-500/8 text-[11px] font-semibold text-blue-400 uppercase tracking-wide mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> Our story
          </div>
          <h1
            className="text-5xl md:text-[58px] font-extrabold leading-[1.05] tracking-[-0.03em] mb-6"
            style={{ fontFamily: "var(--font-syne), sans-serif" }}
          >
            Built to capture the buyers
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
              builders were already losing.
            </span>
          </h1>
          <p className="text-lg text-white/45 leading-relaxed">
            ProPlan Studio exists because the best leads a builder will ever see — buyers already driving through their communities — were walking away with nothing but a paper flyer.
          </p>
        </div>
      </section>

      {/* ── FOUNDING STORY ───────────────────────────────────────────────── */}
      <section className="py-20 px-5 border-t border-white/6">
        <div className="max-w-3xl mx-auto">
          <div className="space-y-6 text-white/55 leading-relaxed text-[17px]">
            <p>
              After years working as a 3D designer — collaborating with builders and real estate developers across the country — a pattern became impossible to ignore.
            </p>
            <p>
              Builders were pouring serious money into advertising. Driving traffic to their websites. Running campaigns. And converting almost none of it.
            </p>
            <p>
              But it wasn&apos;t a marketing problem. The ads were working. The leads were arriving.
            </p>
            <p className="text-white/75">
              The problem was <em>intent</em>.
            </p>
            <p>
              The leads that came in from ads were curious browsers, unqualified buyers, and tire-kickers. Meanwhile, the buyers with real intent — the ones already walking the community on a Saturday afternoon, standing in front of a lot and trying to picture their future home there — weren&apos;t being captured at all.
            </p>
            <p>
              What did those buyers find? A paper flyer. Maybe a QR code linking to a PDF. Nothing that let them explore floor plans, visualize the finished home, or take any action while their interest was highest.
            </p>
            <p>
              So they left. And that moment of genuine buyer intent disappeared.
            </p>
            <div className="border-l-2 border-blue-500/40 pl-6 my-8">
              <p className="text-white/70 italic text-lg">
                &ldquo;That&apos;s the Physical-to-Digital Gap — the distance between a buyer standing in your community and a qualified lead in your CRM. ProPlan Studio was built to close it.&rdquo;
              </p>
            </div>
            <p>
              ProPlan Studio gives buyers an interactive site map the moment they arrive — on their phone, in the driveway — so they can browse available lots, configure a home model, see an AI render of what it will look like, and submit a quote request. All before your sales team picks up the phone.
            </p>
            <p>
              And because the entire journey lives inside one subscription, builders aren&apos;t managing five vendors, five invoices, and five sets of credentials. It&apos;s one platform, one price, built for the specific way production home builders sell.
            </p>
          </div>
        </div>
      </section>

      {/* ── VALUES ───────────────────────────────────────────────────────── */}
      <section className="py-20 px-5 border-t border-white/6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-3">What guides us</p>
            <h2 className="text-3xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-syne), sans-serif" }}>
              How we think about this
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {VALUES.map((v) => (
              <div key={v.title} className="bg-[#0e0e0e] border border-white/8 rounded-2xl p-7 hover:border-white/14 transition-colors">
                <h3 className="text-base font-bold text-white mb-3" style={{ fontFamily: "var(--font-syne), sans-serif" }}>
                  {v.title}
                </h3>
                <p className="text-sm text-white/45 leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMPANY FACTS ────────────────────────────────────────────────── */}
      <section className="py-20 px-5 border-t border-white/6">
        <div className="max-w-4xl mx-auto">
          <div className="grid sm:grid-cols-3 gap-4 text-center">
            {[
              { value: "Delaware, USA", label: "Incorporated" },
              { value: "Home Builders", label: "Built exclusively for" },
              { value: "One subscription", label: "Everything included" },
            ].map((s) => (
              <div key={s.label} className="bg-[#0e0e0e] border border-white/8 rounded-2xl p-8">
                <p className="text-xl font-bold text-white mb-1.5" style={{ fontFamily: "var(--font-syne), sans-serif" }}>{s.value}</p>
                <p className="text-xs text-white/30">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="py-20 px-5 border-t border-white/6">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-extrabold tracking-tight mb-4" style={{ fontFamily: "var(--font-syne), sans-serif" }}>
            See it in action
          </h2>
          <p className="text-white/40 mb-8">
            30 minutes. We&apos;ll walk through the full buyer journey live — site map to signed quote request.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/demo"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors shadow-xl shadow-blue-600/20">
              Book a demo <Arrow />
            </Link>
            <Link href="/contact"
              className="inline-flex items-center justify-center px-7 py-3.5 bg-white/6 hover:bg-white/10 border border-white/10 text-white font-medium rounded-xl transition-all">
              Get in touch
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
