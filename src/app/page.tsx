import Link from "next/link";
import Nav            from "@/components/landing/Nav";
import Footer         from "@/components/landing/Footer";
import AIRenderSlider  from "@/components/landing/AIRenderSlider";
import RenderCarousel  from "@/components/landing/RenderCarousel";
import CalendlyButton  from "@/components/CalendlyButton";
import { fetchActivePlans, buildPlanFeatures, fmtUSD as fmtPlanUSD } from "@/lib/plans";

// ── Image constants ───────────────────────────────────────────────────────────
const IMG = {
  kitchen:  "https://lh3.googleusercontent.com/aida-public/AB6AXuAYhWuJp9MEDaj2XdONiX8cZFiq3XU_k5eOVCKfLHQurkUjeeaMlf0Mg6nrX6mKW-JhqeEwcO5f72JrAVd5h_1EJgZC5Xb6bCLCoqNNq_ZSeg4gAmicoDBFt8NvaQtnmqogmdaRafLUzasJ5OgpEfQyoqQLhvwlySuTLlfkjfIR5W5veGTkqp4zrw0AfZtrtlNpkKrj2uXPjhVeCiE-cj3zwHhPYuQnfSOkndAZ-1zKlPJb2RF0puWqY3tQJDN3-gAJ4trSg2cEBbA",
  living:   "https://lh3.googleusercontent.com/aida-public/AB6AXuAcgkk9ueCldLD-tmtfAS7WxGC3tIYXLlm4ONf0xo-EgKI_m1zjO-Calw4KN3Mrol8OJ9rrrE7IVgmOtzj_I3wNf1c6FW-tlHXzBLYIJSHeGGe6hGqV7TG1_g62OaMxBVuS79JnCHCoyatKyOl9wlStWdMvPxtUpDqUHM3XZii6YVQ0YlRyadzF6EQMtlwZwqgsYKLfAEk7hYe9Bhg6XVCPZXddIktOtd3z-nIAG5drof4x7HDwL1uWZ2rb2DttTUubAlWY_7XGnMs",
  exterior: "https://lh3.googleusercontent.com/aida-public/AB6AXuAs5y9iqUKoUIUsaabLSGQRHBzMJdLWRWfmzS72MbrngIpzW_NS5armTd4wMJSIx4KJUw0tim46YgW_DuQoITaRFsR-IO5vHYb87YZSw__khAtrwbPIHnphUx3wH7cQaNultfiz2C8QZA6vu6hDc6dBL2gdfdBTxD9T4I8Doq8zP8_oqsJa3gefzMn-i056pYlIMYXZNsQqtquOyEcOS68t1FYXONys2yjXn41MCXSVdDMC2eyKYJTPBcRngQa6JQBX0aTKK2fnJmo",
  bedroom:  "https://lh3.googleusercontent.com/aida-public/AB6AXuBLSmR4mmN38-KQHDIKqbE9zR-pcilUp4Py2PPFzSkYh9jU_XQDO7PGAa3pkRyGXsx81i2FGBfriMIl1ynP4YdNyK0ZQevakcZgahLd5WAxWHAxWGwmMsdCPgy3mGSYoPgw-U7pqVkQO2Bh3xOnzNMjuevY4ojcDeeNJmi7Cr4_OXZo8S4eL88eCJLmuI_5Bg_0QGzJtIcYM2CNxExHWAKTBaqtNrr_aepdn1mjj1r5aF_mlpvCDLNpnSwYfOe6AhP73DEDtyfP6-ThE",
};

// ── Atoms ─────────────────────────────────────────────────────────────────────
function Pill({ children, color = "blue" }: { children: React.ReactNode; color?: "blue" | "amber" | "violet" | "teal" }) {
  const styles = {
    blue:   "border-blue-500/20 bg-blue-500/8 text-blue-400",
    amber:  "border-amber-500/20 bg-amber-500/8 text-amber-400",
    violet: "border-violet-500/20 bg-violet-500/8 text-violet-400",
    teal:   "border-teal-500/20 bg-teal-500/8 text-teal-400",
  };
  const dots = { blue: "bg-blue-400", amber: "bg-amber-400", violet: "bg-violet-400", teal: "bg-teal-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-semibold tracking-wide uppercase ${styles[color]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dots[color]}`} />{children}
    </span>
  );
}
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

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function LandingPage() {
  const activePlans = await fetchActivePlans();
  // Fallback plan for display while DB is empty
  const activePlan = activePlans[0] ?? null;
  const monthlyPrice   = activePlan?.price_monthly  ?? 150000;
  const annualPrice    = activePlan?.price_annually  ?? 1650000;
  const annualPerMonth = Math.round(annualPrice / 12);
  const annualSavings  = monthlyPrice * 12 - annualPrice;
  function fmtUSD(cents: number) {
    return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  }

  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden">
      <Nav />

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="relative pt-24 pb-4 px-5 overflow-hidden">
        {/* Background atmosphere */}
        <div className="absolute inset-0 blueprint-grid opacity-30" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(8,8,8,0)_0%,#080808_70%)]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-blue-600/4 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-20 left-[15%] w-64 h-64 bg-amber-500/3 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto text-center pt-14 pb-8">
          <div className="flex justify-center mb-7">
            <Pill>The complete home buying experience</Pill>
          </div>

          <h1
            className="text-5xl md:text-[72px] font-extrabold leading-[1.02] tracking-[-0.03em] text-white mb-7"
            style={{ fontFamily: "var(--font-syne), sans-serif" }}
          >
            Give buyers the experience
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent">
              that earns the sale.
            </span>
          </h1>

          <p className="text-xl text-white/45 leading-relaxed mb-4 max-w-2xl mx-auto">
            ProPlan Studio is the only platform that takes a buyer from
            <span className="text-white/70"> browsing your community</span> →{" "}
            <span className="text-white/70">designing their home in 3D</span> →{" "}
            <span className="text-white/70">seeing an AI render of it</span> →{" "}
            <span className="text-white/70">submitting a qualified quote</span> — all in one session.
          </p>
          <p className="text-base text-white/30 mb-10 max-w-xl mx-auto">
            Every tool your team needs. One subscription. Built for builders who want to close more and spend less.
          </p>

          <div className="flex justify-center mb-4">
            <CalendlyButton className="flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white text-[15px] font-semibold rounded-xl transition-colors shadow-2xl shadow-blue-600/25">
              Schedule a Demo <Arrow />
            </CalendlyButton>
          </div>
          <p className="text-xs text-white/20 mb-10">No commitment · Live demo in 30 minutes · Cancel anytime</p>

          <div className="max-w-4xl mx-auto rounded-2xl overflow-hidden border border-white/8">
            <video
              src="https://pub-771cb4534de742a8876353182e3b5c47.r2.dev/Site%20Assets/Homepage%20Demo%20video(2k).mp4"
              autoPlay
              loop
              muted
              playsInline
              className="w-full aspect-video object-cover"
            />
          </div>
        </div>
      </section>

      {/* ── THE BUYER JOURNEY ─────────────────────────────────────────────── */}
      <section className="py-20 px-5 border-t border-white/6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <Pill>The buyer journey</Pill>
            <h2
              className="text-4xl md:text-5xl font-extrabold tracking-tight mt-5 mb-4 leading-tight"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              One seamless experience.{" "}
              <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
                From lot to quote.
              </span>
            </h2>
            <p className="text-white/40 text-lg max-w-xl mx-auto">
              Most builders lose buyers between interest and commitment. ProPlan fills every gap in that journey — automatically.
            </p>
          </div>

          {/* Journey steps */}
          <div className="grid md:grid-cols-4 gap-4 mb-10">
            {[
              {
                step: "01",
                color: "teal",
                icon: <MapIcon />,
                iconBg: "bg-teal-500/10 border-teal-500/20 text-teal-400",
                title: "Explore the Community",
                desc: "Buyers land on your interactive site map — browse available lots, see what's reserved, pick their plot. It's their first moment of ownership.",
                badge: "Interactive Site Map",
                badgeColor: "text-teal-400 bg-teal-500/8 border-teal-500/20",
              },
              {
                step: "02",
                color: "blue",
                icon: <CubeIcon />,
                iconBg: "bg-blue-500/10 border-blue-500/20 text-blue-400",
                title: "Design Their Home in 3D",
                desc: "One click from the lot, they're inside a full 3D configurator. Elevation, exterior finish, flooring, fixtures — every choice updates the price live.",
                badge: "3D Configurator",
                badgeColor: "text-blue-400 bg-blue-500/8 border-blue-500/20",
              },
              {
                step: "03",
                color: "amber",
                icon: <SparkleIcon />,
                iconBg: "bg-amber-500/10 border-amber-500/20 text-amber-400",
                title: "See It Come to Life",
                desc: "Before they leave, they see an AI render of the home they just configured. Not a stock image — their home, their choices. That's the moment emotion takes over.",
                badge: "AI Render Preview",
                badgeColor: "text-amber-400 bg-amber-500/8 border-amber-500/20",
              },
              {
                step: "04",
                color: "violet",
                icon: <LeadIcon />,
                iconBg: "bg-violet-500/10 border-violet-500/20 text-violet-400",
                title: "A Qualified Lead Lands on Your Desk",
                desc: "Name, email, lot selection, every configuration choice, and total price — captured automatically. Your sales team walks into every call already knowing what that buyer wants.",
                badge: "High-Intent Quote",
                badgeColor: "text-violet-400 bg-violet-500/8 border-violet-500/20",
              },
            ].map((item, i) => (
              <div key={i} className="relative">
                {/* Connector line */}
                {i < 3 && (
                  <div className="hidden md:block absolute top-8 left-[calc(100%+0px)] w-4 h-px bg-gradient-to-r from-white/15 to-white/5 z-10" />
                )}
                <div className="bg-[#0e0e0e] border border-white/8 rounded-2xl p-6 h-full flex flex-col hover:border-white/14 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${item.iconBg}`}>
                      {item.icon}
                    </div>
                    <span
                      className="text-[10px] font-bold text-white/20 tabular-nums"
                      style={{ fontFamily: "var(--font-syne), sans-serif" }}
                    >{item.step}</span>
                  </div>
                  <span className={`inline-flex items-center self-start gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold mb-3 ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                  <h3
                    className="text-sm font-bold text-white mb-2"
                    style={{ fontFamily: "var(--font-syne), sans-serif" }}
                  >{item.title}</h3>
                  <p className="text-xs text-white/40 leading-relaxed flex-1">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Outcome callout */}
          <div className="bg-gradient-to-r from-blue-600/8 via-violet-600/6 to-transparent border border-blue-500/20 rounded-2xl px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <p className="text-white font-semibold mb-1">The result: buyers who already know what they want.</p>
              <p className="text-white/40 text-sm">No more cold conversations. Every lead arrives with their configuration, budget, and emotional investment already in place.</p>
            </div>
            <CalendlyButton className="flex-shrink-0 flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap">
              Schedule a Demo <Arrow />
            </CalendlyButton>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ─────────────────────────────────────────────────────── */}
      <section className="border-y border-white/6 bg-[#0a0a0a]/60">
        <div className="max-w-5xl mx-auto px-5 grid grid-cols-2 md:grid-cols-4">
          {[
            { value: "$800+",    label: "Saved per render vs. any external studio" },
            { value: "48hr",     label: "Turnaround on traditional studio renders" },
            { value: `${activePlan?.ai_credits_monthly ?? 250}`, label: "AI render credits included monthly" },
            { value: "30 min",   label: "To see a live demo of your model" },
          ].map((s, i) => (
            <div key={i} className="flex flex-col items-center justify-center py-8 text-center border-r border-white/5 last:border-0">
              <p
                className="text-4xl font-extrabold tracking-tight text-white mb-1"
                style={{ fontFamily: "var(--font-syne), sans-serif" }}
              >{s.value}</p>
              <p className="text-xs text-white/35 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── WHY THIS PRICE ────────────────────────────────────────────────── */}
      <section className="py-24 px-5 border-b border-white/6">
        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <Pill color="amber">How we do it</Pill>
              <h2
                className="text-4xl md:text-5xl font-extrabold tracking-tight mt-5 mb-5 leading-tight"
                style={{ fontFamily: "var(--font-syne), sans-serif" }}
              >
                Why one subscription covers{" "}
                <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                  everything.
                </span>
              </h2>
              <p className="text-white/45 leading-relaxed mb-6 text-lg">
                Building this kind of platform used to require a large team, six-figure budgets, and months of development. We changed that equation.
              </p>
              <p className="text-white/40 leading-relaxed mb-8">
                We use the latest AI technology across our entire operation — to speed up 3D production, to power the render studio, to generate AI previews instantly. What used to cost $800 per image and weeks of back-and-forth now happens in seconds. That efficiency is what lets us include everything at one flat price, without compromising quality.
              </p>
              <div className="space-y-3">
                {[
                  { icon: "⚡", text: "AI-accelerated 3D model production cuts build time by weeks" },
                  { icon: "🎨", text: "Industry-trained AI Render Studio — built specifically for residential construction" },
                  { icon: "🏗️", text: "Traditional studio renders by our in-house team — included in Builder plans" },
                  { icon: "🔄", text: "One unified platform — no integrations, no middleware, no extra seats to buy" },
                ].map((item) => (
                  <div key={item.text} className="flex items-start gap-3">
                    <span className="text-base flex-shrink-0 mt-px">{item.icon}</span>
                    <p className="text-sm text-white/55 leading-relaxed">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Comparison */}
            <div className="space-y-3">
              <div className="bg-[#0e0e0e] border border-white/8 rounded-2xl p-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-4">What builders used to pay</p>
                <div className="space-y-3">
                  {[
                    { label: "External rendering studio", cost: "$800–$2,000", per: "per image" },
                    { label: "Freelance 3D configurator", cost: "$15,000–$50,000", per: "one-time build" },
                    { label: "Interactive site map tool", cost: "$5,000–$20,000", per: "custom build" },
                    { label: "Lead capture CRM", cost: "$200–$500", per: "per month" },
                  ].map((row) => (
                    <div key={row.label} className="flex items-center justify-between">
                      <p className="text-sm text-white/35">{row.label}</p>
                      <div className="text-right">
                        <p className="text-sm font-bold text-white/30 line-through">{row.cost}</p>
                        <p className="text-[10px] text-white/20">{row.per}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-blue-600/10 border-2 border-blue-500/40 rounded-2xl p-5 shadow-xl shadow-blue-500/8">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500 text-white uppercase tracking-wider">ProPlan Studio</span>
                    <p className="text-sm font-semibold text-white">All of the above</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-extrabold text-white" style={{ fontFamily: "var(--font-syne), sans-serif" }}>{fmtUSD(monthlyPrice)}</p>
                    <p className="text-[11px] text-white/40">/month, all-in</p>
                  </div>
                </div>
                <p className="text-xs text-blue-300/60 mt-3">One subscription. Every tool. No per-render fees, no per-lead charges, no add-on costs.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── AI RENDER STUDIO ──────────────────────────────────────────────── */}
      <section id="ai-renders" className="py-24 px-5 border-b border-white/6 scroll-mt-20">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-[1fr_2fr] gap-12 items-start mb-10">
            <div>
              <Pill color="amber">AI Render Studio</Pill>
              <h2
                className="text-4xl font-extrabold tracking-tight mt-5 mb-4 leading-tight"
                style={{ fontFamily: "var(--font-syne), sans-serif" }}
              >
                Visuals that move buyers —{" "}
                <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
                  generated in seconds.
                </span>
              </h2>
              <p className="text-white/45 leading-relaxed mb-4">
                Our AI Render Studio is trained on residential and custom home construction — not generic scenes. Upload a floor plan brief and get photorealistic exteriors, interiors, and aerials back in seconds.
              </p>
              <p className="text-white/35 leading-relaxed mb-6">
                Use AI renders for buyer previews in the configurator, social media content, pre-sale marketing, and design variations — without waiting on a studio or paying per image.
              </p>
              <ul className="space-y-2">
                {[
                  "Exterior — dusk, golden hour, overcast",
                  "Interior — kitchen, living, bedroom lifestyle",
                  "Aerial community views",
                  "Generated in seconds, not days",
                ].map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-white/55">
                    <Check />{f}
                  </li>
                ))}
              </ul>
              <Link href="/products/ai-renders"
                className="inline-flex items-center gap-2 mt-6 text-sm font-semibold text-amber-400 hover:text-amber-300 transition-colors">
                Explore AI Render Studio <Arrow />
              </Link>
            </div>
            <div className="space-y-4">
              <AIRenderSlider />
              <div className="flex flex-wrap gap-2">
                {["Exterior dusk & golden hour", "Interior lifestyle scenes", "Aerial views", "Material variations", "Marketing-ready resolution"].map(f => (
                  <span key={f} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/4 border border-white/7 rounded-full text-[11px] text-white/45 font-medium">
                    <Check />{f}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <RenderCarousel />

          {/* AI vs Traditional */}
          <div className="grid md:grid-cols-2 gap-4 mt-8">
            {[
              {
                dot: "bg-amber-400",
                label: "AI Renders — Included",
                value: `${activePlan?.ai_credits_monthly ?? 250} credits / month`,
                sub: "Generate instant concepts, buyer previews, and variations. Our AI is trained on residential construction — results look like the work of a specialist studio.",
              },
              {
                dot: "bg-blue-400",
                label: "Traditional Studio Renders — Also Included",
                value: "Hand-crafted, marketing-grade",
                sub: "Complex scenes, materials, and lighting that require a human eye — handled by our in-house studio team. 48hr average turnaround. No queue, no per-render billing.",
              },
            ].map(c => (
              <div key={c.label} className="bg-[#0e0e0e] border border-white/8 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-2 h-2 rounded-full ${c.dot}`} />
                  <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">{c.label}</p>
                </div>
                <p className="text-xl font-bold text-white mb-2" style={{ fontFamily: "var(--font-syne), sans-serif" }}>{c.value}</p>
                <p className="text-sm text-white/38 leading-relaxed">{c.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRODUCTS GRID ─────────────────────────────────────────────────── */}
      <section className="py-24 px-5 border-b border-white/6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <Pill>Four tools. One subscription.</Pill>
            <h2
              className="text-4xl md:text-5xl font-extrabold tracking-tight mt-5 mb-4 leading-tight"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              Everything a modern builder needs to compete
            </h2>
            <p className="text-white/45">
              Buyers today expect more than a brochure. These four tools work together seamlessly — and they all come with your subscription.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {[
              {
                href:    "/products/configurator",
                name:    "3D Configurator",
                tagline: "Let buyers build their dream home on your website.",
                desc:    "Elevation, exterior finish, flooring, fixtures — buyers configure every detail in real time and watch the price update as they go. Every session is captured as a structured lead with their exact selections.",
                label:   "Interactive",
                dot:     "bg-blue-400",
                bg:      "from-blue-500/8 to-transparent",
                icon:    <CubeIcon />,
                iconBg:  "bg-blue-500/10 border-blue-500/20 text-blue-400",
                checks:  ["Real-time price calculator", "Photorealistic 3D viewer", "Automatic lead capture"],
              },
              {
                href:    "/products/ai-renders",
                name:    "AI Render Studio",
                tagline: "Photorealistic visuals in seconds, not days.",
                desc:    "Upload a floor plan and generate exterior, interior, and aerial views instantly. Built specifically for residential construction — not generic AI. Use for buyer previews, marketing, and social content.",
                label:   "AI-Powered",
                dot:     "bg-amber-400",
                bg:      "from-amber-500/8 to-transparent",
                icon:    <SparkleIcon />,
                iconBg:  "bg-amber-500/10 border-amber-500/20 text-amber-400",
                checks:  [`${activePlan?.ai_credits_monthly ?? 250} credits included monthly`, "Trained on residential homes", "Seconds to generate"],
              },
              {
                href:    "/products/3d-rendering",
                name:    "3D Rendering Service",
                tagline: "Studio-quality renders. In your subscription.",
                desc:    "When a scene needs the human touch — complex lighting, custom materials, marketing hero shots — our in-house studio team handles it. 48hr average turnaround, revisions included, no per-render billing.",
                label:   "In-House Studio",
                dot:     "bg-violet-400",
                bg:      "from-violet-500/8 to-transparent",
                icon:    <CameraIcon />,
                iconBg:  "bg-violet-500/10 border-violet-500/20 text-violet-400",
                checks:  ["48hr average turnaround", "Revisions included", "No per-render fees"],
              },
              {
                href:    "/products/site-maps",
                name:    "Interactive Site Maps",
                tagline: "Buyers choose their lot before your first call.",
                desc:    "Upload your community site map and link each lot to your 3D home models. Buyers explore, pick their lot, configure their home, and submit a complete quote — all without needing to speak to anyone first.",
                label:   "Interactive",
                dot:     "bg-teal-400",
                bg:      "from-teal-500/8 to-transparent",
                icon:    <MapIcon />,
                iconBg:  "bg-teal-500/10 border-teal-500/20 text-teal-400",
                checks:  ["Lot availability at a glance", "Links directly into configurator", "Full preference capture"],
              },
            ].map((p) => (
              <div key={p.href}
                className={`relative group rounded-2xl border border-white/8 bg-gradient-to-br ${p.bg} bg-[#0e0e0e] hover:border-white/14 transition-all overflow-hidden`}>
                <div className="absolute inset-0 blueprint-grid opacity-20" />
                <div className="relative p-8">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${p.iconBg}`}>
                      {p.icon}
                    </div>
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full border border-white/8 text-white/40 bg-white/4 flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
                      {p.label}
                    </span>
                  </div>
                  <h3
                    className="text-xl font-bold text-white mb-1"
                    style={{ fontFamily: "var(--font-syne), sans-serif" }}
                  >{p.name}</h3>
                  <p className="text-sm font-medium text-white/60 mb-3 italic">{p.tagline}</p>
                  <p className="text-sm text-white/40 leading-relaxed mb-5">{p.desc}</p>
                  <ul className="space-y-1.5 mb-6">
                    {p.checks.map(c => (
                      <li key={c} className="flex items-center gap-2 text-xs text-white/50">
                        <Check />{c}
                      </li>
                    ))}
                  </ul>
                  <Link href={p.href}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-blue-400 hover:text-blue-300 group-hover:gap-3 transition-all">
                    Learn more <Arrow />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── RENDERS SHOWCASE ──────────────────────────────────────────────── */}
      <section className="py-24 px-5 border-b border-white/6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div className="grid grid-cols-2 gap-3">
            {[
              { src: IMG.kitchen,  alt: "Modern kitchen render"    },
              { src: IMG.living,   alt: "Contemporary living room" },
              { src: IMG.exterior, alt: "House exterior at dusk"   },
              { src: IMG.bedroom,  alt: "Luxury master bedroom"    },
            ].map((img) => (
              <div key={img.alt} className="aspect-square rounded-2xl overflow-hidden border border-white/8">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.src} alt={img.alt} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
          <div>
            <Pill color="violet">Studio rendering</Pill>
            <h2
              className="text-4xl md:text-5xl font-extrabold tracking-tight mt-5 mb-5 leading-tight"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              Renders that win clients —{" "}
              <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
                included, not invoiced.
              </span>
            </h2>
            <p className="text-white/45 text-lg leading-relaxed mb-5">
              External studios charge $800–$2,000 per image. With ProPlan, studio renders are included in your subscription — 48hr turnaround, handled by our team. Run more campaigns, test more variations, post more content — without watching the budget.
            </p>
            <div className="bg-[#0e0e0e] border border-white/8 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/30 mb-1">External studio — 5 renders / month</p>
                  <p className="text-xl font-bold text-white/35 line-through">$4,000–$10,000/mo</p>
                </div>
                <div className="w-px h-10 bg-white/8" />
                <div className="text-right">
                  <p className="text-xs text-white/30 mb-1">ProPlan Studio — included in plan</p>
                  <p className="text-xl font-bold text-white">{fmtUSD(monthlyPrice)}/mo</p>
                </div>
              </div>
            </div>
            <ul className="space-y-3 mb-8">
              {[
                "Exterior — dusk, daylight, aerial",
                "Interior — kitchen, living, master bedroom",
                "48hr average turnaround from brief",
                "Unlimited revisions",
              ].map(f => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-white/55"><Check />{f}</li>
              ))}
            </ul>
            <Link href="/products/3d-rendering"
              className="inline-flex items-center gap-2 text-sm font-semibold text-violet-400 hover:text-violet-300 transition-colors">
              See how our studio works <Arrow />
            </Link>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────────────── */}
      <section className="py-24 px-5 border-b border-white/6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <Pill>Simple onboarding</Pill>
            <h2
              className="text-4xl md:text-5xl font-extrabold tracking-tight mt-5 mb-4"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              You focus on selling.{" "}
              <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
                We handle everything else.
              </span>
            </h2>
            <p className="text-white/40 text-lg max-w-md mx-auto">
              No 3D software. No dev team. No agency dependency. Just tell us what you're building and we get to work.
            </p>
          </div>
          <div className="relative">
            <div className="hidden md:block absolute left-[21px] top-10 bottom-10 w-px bg-gradient-to-b from-blue-600/40 via-violet-600/30 to-transparent" />
            <div className="space-y-0">
              {[
                {
                  n: "01",
                  title: "Subscribe and request your first model",
                  desc: `Sign up for ${fmtUSD(monthlyPrice)}/mo and submit your first model request through your builder dashboard. Pay the one-time ${fmtPlanUSD(activePlan?.model_setup_fee ?? 100000)} setup fee and our team starts immediately.`,
                },
                {
                  n: "02",
                  title: "We build your 3D model — you don't touch a single tool",
                  desc: "Our team constructs the full model: geometry, materials, lighting, option categories, and pricing rules. AI accelerates our production so what used to take months takes weeks.",
                },
                {
                  n: "03",
                  title: "Review on any device, approve, go live",
                  desc: "We send you a preview link. Walk through it like a buyer would. Request changes until it's right. When you approve, we publish it to your website.",
                },
                {
                  n: "04",
                  title: "Buyers configure. You get qualified leads.",
                  desc: "Every buyer session generates a structured lead — lot selection, elevation, finishes, upgrades, and price. Your sales team has full context before the first conversation.",
                },
                {
                  n: "05",
                  title: "Renders and AI credits refresh every month",
                  desc: `Your ${activePlan?.ai_credits_monthly ?? 250} AI credits and traditional render allocation reset monthly. Keep feeding your marketing, social media, and pre-sales presentations without thinking about cost.`,
                },
              ].map((step, i) => (
                <div key={i} className="flex gap-6 pb-10 last:pb-0">
                  <div className="flex-shrink-0">
                    <div
                      className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-xs font-bold text-white shadow-lg shadow-blue-600/20"
                      style={{ fontFamily: "var(--font-syne), sans-serif" }}
                    >
                      {step.n}
                    </div>
                  </div>
                  <div className="pt-2.5 pb-4">
                    <h3
                      className="text-base font-bold text-white mb-1.5"
                      style={{ fontFamily: "var(--font-syne), sans-serif" }}
                    >{step.title}</h3>
                    <p className="text-sm text-white/40 leading-relaxed max-w-lg">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ───────────────────────────────────────────────────────── */}
      <section className="py-24 px-5 border-b border-white/6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <Pill>Pricing</Pill>
            <h2
              className="text-4xl md:text-5xl font-extrabold tracking-tight mt-5 mb-4"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              Simple pricing.{" "}
              <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
                No surprises.
              </span>
            </h2>
            <p className="text-white/40 text-lg max-w-lg mx-auto">
              Start with one model. Scale as you grow. One-time setup fee per model, then a flat monthly subscription.
            </p>
          </div>

          {/* Plan cards */}
          <div className={`grid gap-5 mb-5 ${
            activePlans.length >= 3 ? "md:grid-cols-3" :
            activePlans.length === 2 ? "md:grid-cols-2 max-w-3xl mx-auto" :
            "max-w-sm mx-auto"
          }`}>
            {activePlans.map((plan, i) => {
              const isPopular = activePlans.length >= 2 && i === activePlans.length - 1;
              const planAnnualPerMonth = Math.round(plan.price_annually / 12);
              const planAnnualSavings  = plan.price_monthly * 12 - plan.price_annually;
              return (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl p-7 flex flex-col ${
                    isPopular
                      ? "bg-blue-600/10 border-2 border-blue-500/50 shadow-xl shadow-blue-500/10"
                      : "bg-[#0e0e0e] border border-white/10"
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-blue-500 text-white tracking-wider uppercase whitespace-nowrap">
                        Most Popular
                      </span>
                    </div>
                  )}
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3">{plan.display_name}</p>
                  <div className="flex items-end gap-1 mb-1">
                    <span className="text-4xl font-bold text-white" style={{ fontFamily: "var(--font-syne), sans-serif" }}>
                      {fmtUSD(plan.price_monthly)}
                    </span>
                    <span className="text-white/40 text-sm mb-1">/mo</span>
                  </div>
                  <p className="text-[11px] text-white/25 mb-6">
                    or {fmtUSD(planAnnualPerMonth)}/mo billed annually{" "}
                    <span className="text-emerald-400/70">— save {fmtUSD(planAnnualSavings)}</span>
                  </p>

                  <div className="grid grid-cols-3 gap-2 mb-6 bg-white/5 rounded-xl p-3">
                    <div className="text-center">
                      <p className="text-base font-bold text-white">{plan.max_projects === -1 ? "∞" : plan.max_projects}</p>
                      <p className="text-[9px] text-white/30 mt-0.5">Models</p>
                    </div>
                    <div className="text-center border-x border-white/8">
                      <p className="text-base font-bold text-white">{plan.rendering_credits_monthly === -1 ? "∞" : (plan.rendering_credits_monthly === 0 ? "—" : plan.rendering_credits_monthly)}</p>
                      <p className="text-[9px] text-white/30 mt-0.5">Renders/mo</p>
                    </div>
                    <div className="text-center">
                      <p className="text-base font-bold text-white">{plan.ai_credits_monthly}</p>
                      <p className="text-[9px] text-white/30 mt-0.5">AI Credits</p>
                    </div>
                  </div>

                  <ul className="space-y-2.5 mb-7 flex-1">
                    {buildPlanFeatures(plan).map(f => (
                      <li key={f} className="flex items-start gap-2.5">
                        <Check />
                        <span className="text-xs text-white/60 leading-relaxed">{f}</span>
                      </li>
                    ))}
                  </ul>

                  <CalendlyButton
                    className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors ${
                      isPopular
                        ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25"
                        : "bg-white/8 hover:bg-white/14 border border-white/10 text-white"
                    }`}
                  >
                    Schedule a Demo
                  </CalendlyButton>
                </div>
              );
            })}
          </div>

          {/* Setup fee — full-width strip below plan cards */}
          <div className="bg-[#141414] border border-white/10 rounded-2xl p-7 grid md:grid-cols-[1fr_1fr_auto] gap-x-10 gap-y-6 items-start">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3">Per-Model Setup Fee</p>
              <div className="flex items-end gap-1 mb-2">
                <span className="text-3xl font-bold text-white" style={{ fontFamily: "var(--font-syne), sans-serif" }}>
                  {fmtPlanUSD(activePlan?.model_setup_fee ?? 100000)}
                </span>
                <span className="text-white/40 text-sm mb-1">/ model</span>
              </div>
              <p className="text-xs text-white/40 leading-relaxed mb-4">
                One-time fee per model — paid once, yours forever. We handle full production from geometry to live deployment.
              </p>
              <ul className="space-y-2">
                {[
                  "Full 3D model build & optimization",
                  "Interior, exterior & option phases",
                  "Option categories & pricing rules wired",
                  "Tested and deployed live",
                  "Revisions until you approve",
                ].map(item => (
                  <li key={item} className="flex items-start gap-2">
                    <Check />
                    <span className="text-xs text-white/50">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold text-white/60 mb-4">How it works</p>
              <ol className="space-y-3">
                {[
                  "Schedule a 30-min demo call",
                  "Pick your plan, pay setup fee",
                  "We build your model — you review & approve",
                  "Go live. Buyers configure. Leads flow in.",
                ].map((step, idx) => (
                  <li key={step} className="flex items-start gap-2.5 text-xs text-white/40">
                    <span className="w-4 h-4 rounded-full bg-white/8 text-white/40 text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            <div className="flex flex-col gap-3 justify-center">
              <CalendlyButton className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-colors whitespace-nowrap">
                Book a Free Demo <Arrow />
              </CalendlyButton>
              <Link href="/pricing"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium border border-white/12 text-white/50 hover:text-white hover:border-white/25 transition-all whitespace-nowrap">
                Full pricing details <Arrow />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="py-24 px-5">
        <div className="max-w-4xl mx-auto">
          <div className="relative rounded-3xl overflow-hidden border border-white/10 bg-[#0d0d14] p-12 md:p-16 text-center">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-violet-600/6 to-transparent pointer-events-none" />
            <div className="absolute inset-0 blueprint-grid opacity-20 pointer-events-none" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
            <div className="relative">
              <div className="flex justify-center mb-6">
                <Pill>Book a demo</Pill>
              </div>
              <h2
                className="text-4xl md:text-5xl font-extrabold tracking-tight mb-5 leading-tight"
                style={{ fontFamily: "var(--font-syne), sans-serif" }}
              >
                See it live on your model
                <br />
                <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent">
                  in 30 minutes.
                </span>
              </h2>
              <p className="text-white/40 text-lg mb-10 max-w-lg mx-auto leading-relaxed">
                No slides. No generic demo. We show you the full buyer journey — site map, 3D configurator, AI render, PDF quote — using your actual home plans.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
                <CalendlyButton className="flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white text-[15px] font-semibold rounded-xl transition-colors shadow-2xl shadow-blue-600/25">
                  Schedule a Demo <Arrow />
                </CalendlyButton>
                <Link href="/pricing"
                  className="flex items-center justify-center px-8 py-4 bg-white/6 hover:bg-white/10 border border-white/10 text-white text-[15px] font-medium rounded-xl transition-all">
                  See pricing
                </Link>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/25">
                <span className="flex items-center gap-1.5"><Check />30-minute call, no pressure</span>
                <span className="flex items-center gap-1.5"><Check />{fmtPlanUSD(activePlan?.model_setup_fee ?? 100000)} per model setup</span>
                <span className="flex items-center gap-1.5"><Check />Cancel anytime</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────
function CubeIcon() {
  return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"/></svg>;
}
function SparkleIcon() {
  return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"/></svg>;
}
function CameraIcon() {
  return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"/><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"/></svg>;
}
function MapIcon() {
  return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z"/></svg>;
}
function LeadIcon() {
  return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/></svg>;
}
