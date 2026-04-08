import Link from "next/link";
import Nav  from "@/components/landing/Nav";
import Footer from "@/components/landing/Footer";
import VideoPlaceholder from "@/components/landing/VideoPlaceholder";
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

const FEATURES = [
  {
    title: "Exterior & Interior Phases",
    desc: "Buyers switch between blueprint, exterior, and interior views of the same model. Each phase has its own selectable options and pricing — all in one experience.",
    color: "border-blue-500/20 bg-blue-500/6",
    dot: "bg-blue-400",
  },
  {
    title: "Real-Time Price Calculator",
    desc: "Every option selection updates the configuration total instantly. Buyers see exactly what they're spending before they submit — no sticker shock at the table.",
    color: "border-violet-500/20 bg-violet-500/6",
    dot: "bg-violet-400",
  },
  {
    title: "Structured Lead Capture",
    desc: "When a buyer submits their configuration, your team receives their full name, contact info, and every single option they selected — structured, actionable, CRM-ready.",
    color: "border-teal-500/20 bg-teal-500/6",
    dot: "bg-teal-400",
  },
  {
    title: "One-Line Website Embed",
    desc: "A single script tag embeds the configurator on any existing website — your custom domain, your branding. No platform migration, no iFrame jank.",
    color: "border-amber-500/20 bg-amber-500/6",
    dot: "bg-amber-400",
  },
];

export default async function ConfiguratorPage() {
  const plan        = await fetchActivePlan();
  const monthlyPrice = plan?.price_monthly  ?? 150000;
  const setupFee     = plan?.model_setup_fee ?? 100000;

  const STEPS = [
    { n: "01", title: "Subscribe and request your model",  desc: `Sign up for ${fmtUSD(monthlyPrice)}/mo and submit your floor plans through your builder portal. Pay the one-time ${fmtUSD(setupFee)} model setup fee and we begin immediately.` },
    { n: "02", title: "We build the 3D model",              desc: "Our team constructs the full model — geometry, materials, option categories, and price rules. You don't touch a single 3D tool." },
    { n: "03", title: "You review on any device",           desc: "Access a shareable preview link — test on mobile, tablet, and desktop. Request changes and we turn them around fast." },
    { n: "04", title: "Embed and start capturing leads",    desc: "Add one line of code to your website and go live. Every buyer interaction becomes a structured lead in your dashboard." },
  ];

  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden">
      <Nav />

      {/* Hero */}
      <section className="relative pt-32 pb-16 px-5 overflow-hidden">
        <div className="absolute inset-0 blueprint-grid opacity-30" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(8,8,8,0)_0%,#080808_80%)]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-blue-600/6 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/20 bg-blue-500/8 text-[11px] font-semibold text-blue-400 uppercase tracking-wide mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> 3D Configurator
          </div>
          <h1
            className="text-5xl md:text-[62px] font-extrabold leading-[1.04] tracking-[-0.03em] mb-6"
            style={{ fontFamily: "var(--font-syne), sans-serif" }}
          >
            Buyers who configure
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
              are ready to sign.
            </span>
          </h1>
          <p className="text-lg text-white/45 leading-relaxed max-w-2xl mx-auto mb-10">
            Give buyers an interactive 3D model they can customize — elevations, finishes, structural upgrades — with live pricing. Every submission is a fully structured lead with their complete selection. Your sales team walks into every meeting knowing exactly what that buyer wants.
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
          <p className="text-xs text-white/22">{fmtUSD(monthlyPrice)}/mo subscription · {fmtUSD(setupFee)} per model setup</p>
        </div>
      </section>

      {/* Video */}
      <section className="py-8 px-5">
        <div className="max-w-4xl mx-auto">
          <VideoPlaceholder
            title="Interactive 3D Configurator — Full walkthrough with lead capture demo"
            duration="4:15"
            subtitle="Product demo"
          />
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-5 border-t border-white/6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2
              className="text-3xl md:text-4xl font-extrabold tracking-tight"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              Not just a 3D viewer —
              <br />a complete buyer journey
            </h2>
            <p className="text-white/40 mt-3 max-w-lg mx-auto">Every interaction ends in a structured sales lead. Your team knows what each buyer wants before the first call.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className={`rounded-2xl border p-7 ${f.color}`}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-2 h-2 rounded-full ${f.dot}`} />
                  <h3 className="text-base font-bold text-white" style={{ fontFamily: "var(--font-syne), sans-serif" }}>{f.title}</h3>
                </div>
                <p className="text-sm text-white/45 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>

          {/* Lead data preview */}
          <div className="mt-10 bg-[#0e0e0e] border border-white/8 rounded-2xl p-8">
            <h3
              className="text-lg font-bold text-white mb-5"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              What your sales team receives after every configuration
            </h3>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { label: "Buyer details", items: ["Full name", "Email address", "Phone number"] },
                { label: "Configuration", items: ["Selected floor plan", "All chosen options", "Structural upgrades"] },
                { label: "Summary",       items: ["Total price calculated", "Timestamp", "Model version"] },
              ].map((col) => (
                <div key={col.label} className="bg-white/3 rounded-xl p-4 border border-white/6">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3">{col.label}</p>
                  <ul className="space-y-2">
                    {col.items.map(i => (
                      <li key={i} className="flex items-center gap-2 text-sm text-white/55"><Check />{i}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-5 border-t border-white/6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2
              className="text-3xl font-extrabold tracking-tight"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              From floor plans to live configurator in weeks
            </h2>
            <p className="text-white/40 mt-3">We handle all the 3D production. You focus on selling homes.</p>
          </div>
          <div className="relative">
            <div className="hidden md:block absolute left-[21px] top-10 bottom-10 w-px bg-gradient-to-b from-blue-600/40 to-transparent" />
            {STEPS.map((step, i) => (
              <div key={i} className="flex gap-6 pb-8 last:pb-0">
                <div className="w-11 h-11 flex-shrink-0 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-xs font-bold text-white z-10"
                  style={{ fontFamily: "var(--font-syne), sans-serif" }}>
                  {step.n}
                </div>
                <div className="pt-2.5">
                  <h3 className="text-base font-bold text-white mb-1" style={{ fontFamily: "var(--font-syne), sans-serif" }}>{step.title}</h3>
                  <p className="text-sm text-white/40 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
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
            Your first configurator is weeks away
          </h2>
          <p className="text-white/40 mb-2 max-w-md mx-auto">
            Subscribe for {fmtUSD(monthlyPrice)}/mo. Request your first model setup for {fmtUSD(setupFee)}. We build it — you start capturing leads.
          </p>
          <p className="text-xs text-white/25 mb-8">We handle all 3D production. No tools to learn.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/auth/signup"
              className="flex items-center justify-center gap-2 px-7 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors shadow-xl shadow-blue-600/20">
              Get started
            </Link>
            <Link href="/pricing"
              className="flex items-center justify-center px-7 py-3.5 bg-white/6 hover:bg-white/10 border border-white/10 text-white font-medium rounded-xl transition-all">
              See full pricing
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
