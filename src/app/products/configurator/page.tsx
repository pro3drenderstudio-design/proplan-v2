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

export default async function ConfiguratorPage() {
  const plan         = await fetchActivePlan();
  const monthlyPrice = plan?.price_monthly  ?? 150000;
  const setupFee     = plan?.model_setup_fee ?? 100000;

  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden">
      <Nav />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
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
              already know what they want.
            </span>
          </h1>
          <p className="text-lg text-white/45 leading-relaxed max-w-2xl mx-auto mb-5">
            Give buyers a live 3D model on your website where they choose the elevation, finishes, and upgrades — with the price updating in real time. Every session ends with a structured lead: their name, contact, and every single selection they made.
          </p>
          <p className="text-base text-white/30 max-w-xl mx-auto mb-10">
            Your sales team stops guessing what buyers want. They walk into every conversation with a complete picture.
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
          <p className="text-xs text-white/22">{fmtUSD(monthlyPrice)}/mo subscription · {fmtUSD(setupFee)} per model setup · No dev work required</p>
        </div>
      </section>

      {/* ── VIDEO ────────────────────────────────────────────────────────── */}
      <section className="py-8 px-5">
        <div className="max-w-4xl mx-auto">
          <VideoPlaceholder
            title="3D Configurator — Live walkthrough: buyer experience + lead capture"
            duration="4:15"
            subtitle="Product demo"
          />
        </div>
      </section>

      {/* ── HOW A BUYER EXPERIENCES IT ───────────────────────────────────── */}
      <section className="py-20 px-5 border-t border-white/6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-3">The buyer experience</p>
            <h2
              className="text-3xl md:text-4xl font-extrabold tracking-tight"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              What a buyer sees — from first click to qualified lead
            </h2>
            <p className="text-white/40 mt-3 max-w-lg mx-auto">The configurator turns passive browsers into buyers who have already committed emotionally before speaking to your team.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-5 mb-10">
            {[
              {
                step: "01",
                color: "from-blue-500/10 to-transparent border-blue-500/20",
                accent: "text-blue-400",
                title: "They explore the model in 3D",
                desc: "The full home rotates in the browser — exterior, interior, floor plan. Buyers can inspect every angle before they've selected a single option. First impression: this builder is serious.",
              },
              {
                step: "02",
                color: "from-violet-500/10 to-transparent border-violet-500/20",
                accent: "text-violet-400",
                title: "They configure it to their taste",
                desc: "Elevation style. Roof color. Flooring. Kitchen finishes. Each choice visually updates the model in real time, and the price at the bottom updates with every tap. They're not browsing anymore — they're designing.",
              },
              {
                step: "03",
                color: "from-teal-500/10 to-transparent border-teal-500/20",
                accent: "text-teal-400",
                title: "They submit — and you receive a brief",
                desc: "Name, email, phone, and every selection they made — packaged into a structured lead that lands in your dashboard instantly. Your team knows this buyer's taste, budget, and priorities before the first word is spoken.",
              },
            ].map((item) => (
              <div key={item.step} className={`bg-gradient-to-b ${item.color} border rounded-2xl p-7`}>
                <p className={`text-[11px] font-bold uppercase tracking-widest mb-3 ${item.accent}`}>{item.step}</p>
                <h3
                  className="text-base font-bold text-white mb-2"
                  style={{ fontFamily: "var(--font-syne), sans-serif" }}
                >{item.title}</h3>
                <p className="text-sm text-white/42 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Lead data preview */}
          <div className="bg-[#0e0e0e] border border-white/8 rounded-2xl p-8">
            <h3
              className="text-base font-bold text-white mb-1"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              What lands in your dashboard after every configuration
            </h3>
            <p className="text-sm text-white/35 mb-6">Every submission is structured, exportable, and CRM-ready.</p>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { label: "Buyer details",  items: ["Full name", "Email address", "Phone number"] },
                { label: "Configuration", items: ["Elevation and exterior selections", "Interior finishes and upgrades", "Structural options chosen"] },
                { label: "Summary",       items: ["Live price at time of submission", "Timestamp + model version", "Lot selection (if via site map)"] },
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

      {/* ── FEATURES ──────────────────────────────────────────────────────── */}
      <section className="py-20 px-5 border-t border-white/6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2
              className="text-3xl md:text-4xl font-extrabold tracking-tight"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              Built for builders. Not developers.
            </h2>
            <p className="text-white/40 mt-3 max-w-lg mx-auto">We handle all the 3D production. You review, approve, and go live. No tools to learn.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              {
                title: "Three-phase experience — blueprint, exterior, interior",
                desc: "Buyers switch between a floor plan overview, exterior configuration, and interior customization — all within the same model. Each phase has its own selectable options and pricing impact.",
                color: "border-blue-500/20 bg-blue-500/6",
                dot: "bg-blue-400",
              },
              {
                title: "Live price calculator — no sticker shock",
                desc: "Every option selection updates the configuration total instantly. Buyers see the full price as they build — which means they arrive at your sales table with realistic expectations and genuine intent.",
                color: "border-violet-500/20 bg-violet-500/6",
                dot: "bg-violet-400",
              },
              {
                title: "One embed — any website, your branding",
                desc: "A single line of code embeds the configurator on your existing website under your custom domain. Your logo, your colors, your experience. No platform migration. No iframe jank.",
                color: "border-amber-500/20 bg-amber-500/6",
                dot: "bg-amber-400",
              },
              {
                title: "We build it. You sell it.",
                desc: "You provide the floor plans and style references. Our team constructs the full 3D model, sets up every option category, wires the pricing rules, and deploys it live. You never touch a 3D tool.",
                color: "border-teal-500/20 bg-teal-500/6",
                dot: "bg-teal-400",
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
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────── */}
      <section className="py-20 px-5 border-t border-white/6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2
              className="text-3xl font-extrabold tracking-tight"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              From floor plans to live configurator in weeks
            </h2>
            <p className="text-white/40 mt-3">We handle all the 3D production. You just review and approve.</p>
          </div>
          <div className="relative">
            <div className="hidden md:block absolute left-[21px] top-10 bottom-10 w-px bg-gradient-to-b from-blue-600/40 to-transparent" />
            {[
              { n: "01", title: "Subscribe and request your first model",  desc: `Sign up for ${fmtUSD(monthlyPrice)}/mo and submit your floor plans and style preferences through your builder portal. Pay the one-time ${fmtUSD(setupFee)} model setup fee and we begin immediately.` },
              { n: "02", title: "We build the full 3D model",              desc: "Our team constructs the geometry, sets up materials, maps every option category to the correct model nodes, and wires the pricing rules. You don't touch a single 3D tool." },
              { n: "03", title: "You review on any device",                desc: "We send you a shareable preview link — test it on your phone, tablet, and desktop exactly as a buyer would. Request changes and we turn them around fast." },
              { n: "04", title: "Go live and start capturing leads",       desc: "One line of code on your website and the configurator is live. Every buyer session becomes a structured lead in your dashboard — name, contact, every selection made." },
            ].map((step, i) => (
              <div key={i} className="flex gap-6 pb-8 last:pb-0">
                <div className="w-11 h-11 flex-shrink-0 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-xs font-bold text-white z-10"
                  style={{ fontFamily: "var(--font-syne), sans-serif" }}>
                  {step.n}
                </div>
                <div className="pt-2.5">
                  <h3 className="text-base font-bold text-white mb-1.5" style={{ fontFamily: "var(--font-syne), sans-serif" }}>{step.title}</h3>
                  <p className="text-sm text-white/40 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PART OF THE JOURNEY ───────────────────────────────────────────── */}
      <section className="py-16 px-5 border-t border-white/6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-[#0d0d14] border border-white/8 rounded-2xl p-8">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-5">Part of the complete buyer journey</p>
            <div className="grid sm:grid-cols-4 gap-3">
              {[
                { label: "Site Map",      sub: "Buyer picks their lot",            href: "/products/site-maps",    active: false },
                { label: "Configurator",  sub: "They design their home in 3D",     href: "/products/configurator", active: true  },
                { label: "AI Render",     sub: "They see it come to life",          href: "/products/ai-renders",   active: false },
                { label: "Quote Capture", sub: "You receive a qualified lead",      href: "/",                      active: false },
              ].map((item) => (
                <Link key={item.label} href={item.href}
                  className={`rounded-xl p-4 border text-center transition-all ${item.active ? "bg-blue-600/15 border-blue-500/40" : "bg-white/3 border-white/8 hover:border-white/15"}`}>
                  <p className={`text-xs font-bold mb-1 ${item.active ? "text-blue-300" : "text-white/60"}`}>{item.label}</p>
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
            Your buyers deserve better than a brochure.
          </h2>
          <p className="text-white/40 mb-2 max-w-md mx-auto">
            Subscribe for {fmtUSD(monthlyPrice)}/mo. Request your first model setup for {fmtUSD(setupFee)}. We build it — you start capturing leads that are ready to close.
          </p>
          <p className="text-xs text-white/25 mb-8">No 3D tools. No dev team. Live in weeks.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/auth/signup"
              className="flex items-center justify-center gap-2 px-7 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors shadow-xl shadow-blue-600/20">
              Get started — {fmtUSD(monthlyPrice)}/mo <Arrow />
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
