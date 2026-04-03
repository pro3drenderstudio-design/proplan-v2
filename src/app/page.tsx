import Link from "next/link";
import Nav            from "@/components/landing/Nav";
import Footer         from "@/components/landing/Footer";
import VideoPlaceholder from "@/components/landing/VideoPlaceholder";
import AIRenderSlider  from "@/components/landing/AIRenderSlider";
import RenderCarousel  from "@/components/landing/RenderCarousel";

// ── Image constants (from Stitch, publicly served) ───────────────────────────
const IMG = {
  kitchen:  "https://lh3.googleusercontent.com/aida-public/AB6AXuAYhWuJp9MEDaj2XdONiX8cZFiq3XU_k5eOVCKfLHQurkUjeeaMlf0Mg6nrX6mKW-JhqeEwcO5f72JrAVd5h_1EJgZC5Xb6bCLCoqNNq_ZSeg4gAmicoDBFt8NvaQtnmqogmdaRafLUzasJ5OgpEfQyoqQLhvwlySuTLlfkjfIR5W5veGTkqp4zrw0AfZtrtlNpkKrj2uXPjhVeCiE-cj3zwHhPYuQnfSOkndAZ-1zKlPJb2RF0puWqY3tQJDN3-gAJ4trSg2cEBbA",
  living:   "https://lh3.googleusercontent.com/aida-public/AB6AXuAcgkk9ueCldLD-tmtfAS7WxGC3tIYXLlm4ONf0xo-EgKI_m1zjO-Calw4KN3Mrol8OJ9rrrE7IVgmOtzj_I3wNf1c6FW-tlHXzBLYIJSHeGGe6hGqV7TG1_g62OaMxBVuS79JnCHCoyatKyOl9wlStWdMvPxtUpDqUHM3XZii6YVQ0YlRyadzF6EQMtlwZwqgsYKLfAEk7hYe9Bhg6XVCPZXddIktOtd3z-nIAG5drof4x7HDwL1uWZ2rb2DttTUubAlWY_7XGnMs",
  exterior: "https://lh3.googleusercontent.com/aida-public/AB6AXuAs5y9iqUKoUIUsaabLSGQRHBzMJdLWRWfmzS72MbrngIpzW_NS5armTd4wMJSIx4KJUw0tim46YgW_DuQoITaRFsR-IO5vHYb87YZSw__khAtrwbPIHnphUx3wH7cQaNultfiz2C8QZA6vu6hDc6dBL2gdfdBTxD9T4I8Doq8zP8_oqsJa3gefzMn-i056pYlIMYXZNsQqtquOyEcOS68t1FYXONys2yjXn41MCXSVdDMC2eyKYJTPBcRngQa6JQBX0aTKK2fnJmo",
  bedroom:  "https://lh3.googleusercontent.com/aida-public/AB6AXuBLSmR4mmN38-KQHDIKqbE9zR-pcilUp4Py2PPFzSkYh9jU_XQDO7PGAa3pkRyGXsx81i2FGBfriMIl1ynP4YdNyK0ZQevakcZgahLd5WQhAxWGwmMsdCPgy3mGSYoPgw-U7pqVkQO2Bh3xOnzNMjuevY4ojcDeeNJmi7Cr4_OXZo8S4eL88eCJLmuI_5Bg_0QGzJtIcYM2CNxExHWAKTBaqtNrr_aepdn1mjj1r5aF_mlpvCDLNpnSwYfOe6AhP73DEDtyfP6-ThE",
};

// ── Atoms ────────────────────────────────────────────────────────────────────
function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-blue-500/20 bg-blue-500/8 text-[11px] font-semibold text-blue-400 tracking-wide uppercase">
      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />{children}
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

// ── Page data ────────────────────────────────────────────────────────────────
const STATS = [
  { value: "3D",   label: "Interactive configurators" },
  { value: "∞",    label: "Buyer leads captured"      },
  { value: "$0",   label: "Setup fees — ever"         },
  { value: "48hr", label: "Avg render turnaround"     },
];

const PRODUCTS = [
  {
    href:    "/products/configurator",
    name:    "3D Configurator",
    desc:    "Buyers select elevations, finishes, and upgrades in real time. Every choice updates their price instantly — and becomes a structured lead.",
    label:   "Interactive",
    dot:     "bg-blue-400",
    ring:    "ring-blue-500/20",
    bg:      "from-blue-500/8 to-transparent",
    icon:    <CubeIcon />,
    iconBg:  "bg-blue-500/10 border-blue-500/20 text-blue-400",
  },
  {
    href:    "/products/ai-renders",
    name:    "AI Render Studio",
    desc:    "Upload a floor plan or brief and generate photorealistic exterior, interior, and aerial views in seconds. Included in every plan.",
    label:   "AI-powered",
    dot:     "bg-amber-400",
    ring:    "ring-amber-500/20",
    bg:      "from-amber-500/8 to-transparent",
    icon:    <SparkleIcon />,
    iconBg:  "bg-amber-500/10 border-amber-500/20 text-amber-400",
  },
  {
    href:    "/products/3d-rendering",
    name:    "3D Rendering Service",
    desc:    "Hand-crafted photorealistic renders by our in-house studio team. Marketing-grade quality, 48hr turnaround. Included in your monthly plan.",
    label:   "Studio",
    dot:     "bg-violet-400",
    ring:    "ring-violet-500/20",
    bg:      "from-violet-500/8 to-transparent",
    icon:    <CameraIcon />,
    iconBg:  "bg-violet-500/10 border-violet-500/20 text-violet-400",
  },
  {
    href:    "/products/site-maps",
    name:    "Interactive Site Maps",
    desc:    "Link available lots to your home models. Buyers pick their lot, configure their home, and you capture exactly what they want.",
    label:   "Coming soon",
    dot:     "bg-teal-400",
    ring:    "ring-teal-500/20",
    bg:      "from-teal-500/8 to-transparent",
    icon:    <MapIcon />,
    iconBg:  "bg-teal-500/10 border-teal-500/20 text-teal-400",
  },
];

const STEPS = [
  { n: "01", title: "Submit your floor plans",       desc: "Share your home model details and option list through your builder portal. Our team reviews scope and gets started." },
  { n: "02", title: "We build your 3D model",        desc: "Our artists construct the full model — geometry, materials, lighting — and configure your option categories and price rules." },
  { n: "03", title: "Review and go live",            desc: "Access a preview link on any device. Approve or request revisions. When ready, we publish to your buyers." },
  { n: "04", title: "Capture buyer configurations",  desc: "Buyers configure their home on your website. Each submission is saved as a structured lead with full selection data." },
  { n: "05", title: "Receive renders & AI images",   desc: "Your monthly render allocation and AI credits are delivered — ready for marketing, pre-sales, and social media." },
];

const TIERS = [
  {
    name: "Launch", price: 699, desc: "Perfect for your first configurator.",
    highlight: false,
    perks: ["2 active home model configurators", "15 traditional 3D renders / mo", "150 AI render credits / mo", "Lead CRM", "Basic analytics", "Email support"],
  },
  {
    name: "Studio", price: 1499, desc: "Built for active builders with multiple communities.",
    highlight: true, badge: "Most Popular",
    perks: ["5 active home model configurators", "50 traditional 3D renders / mo", "400 AI render credits / mo", "Lead CRM + analytics + exports", "1 interactive site map", "Priority support"],
  },
  {
    name: "Scale", price: 2499, desc: "Unlimited output for high-volume builders.",
    highlight: false,
    perks: ["Unlimited configurators", "Unlimited traditional renders*", "1,000 AI render credits / mo", "Unlimited site maps", "White-label configurator", "Dedicated success manager"],
  },
];

const ROADMAP = [
  {
    icon: <ShareIcon />,
    name: "Buyer Share Link",
    desc: "Every configuration gets a unique URL — buyers bookmark it, share it with their partner, or revisit it before signing.",
  },
  {
    icon: <QRIcon />,
    name: "QR Code Generator",
    desc: "Generate print-ready QR codes for model home signage. Buyers scan and open your configurator instantly on their phone.",
  },
  {
    icon: <PDFIcon />,
    name: "Configuration PDF",
    desc: "Buyers receive an auto-generated PDF summary of their selections, sent to their email immediately after configuring.",
  },
];

const TESTIMONIALS = [
  {
    quote: "Before ProPlan, buyers waited two weeks for a rendering. Now they configure their home and we get a qualified lead with every selection before the first sales meeting.",
    name: "Marcus T.", role: "Sales Director", company: "Meridian Custom Homes", init: "MT", grad: "from-blue-600 to-indigo-700",
  },
  {
    quote: "We were paying a rendering studio $1,200 per image. Now our renders and AI concepts are included. I can show five design variations in one meeting without waiting days.",
    name: "Sandra K.", role: "Marketing Manager", company: "Ridgeline Communities", init: "SK", grad: "from-violet-600 to-purple-800",
  },
  {
    quote: "The configurator captures buyer selections we never had before — elevation, finishes, upgrades. Our sales team walks into every meeting with full context.",
    name: "James P.", role: "VP of Sales", company: "Keystone Builders", init: "JP", grad: "from-teal-600 to-cyan-800",
  },
];

// ── Page ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden">
      <Nav />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative pt-24 pb-8 px-5 overflow-hidden">
        {/* Blueprint grid background */}
        <div className="absolute inset-0 blueprint-grid opacity-40" />
        {/* Radial vignette over grid */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(8,8,8,0)_0%,#080808_70%)]" />
        {/* Blue glow top-center */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-4xl mx-auto text-center pt-12 pb-6">
          <div className="flex justify-center mb-6">
            <Pill>Interactive 3D for home builders</Pill>
          </div>
          <h1
            className="text-5xl md:text-[70px] font-extrabold leading-[1.03] tracking-[-0.03em] text-white mb-7"
            style={{ fontFamily: "var(--font-syne), sans-serif" }}
          >
            Turn floor plans into
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent">
              interactive experiences
            </span>
          </h1>
          <p className="text-xl text-white/42 leading-relaxed mb-10 max-w-2xl mx-auto">
            Stop selling flat blueprints. Give buyers the power to customize and visualize their future home in stunning 3D — before the first brick is laid.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-5">
            <Link href="/auth/signup"
              className="flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white text-[15px] font-semibold rounded-xl transition-colors shadow-2xl shadow-blue-600/25">
              Start building now <Arrow />
            </Link>
            <Link href="/pricing"
              className="flex items-center justify-center gap-2 px-8 py-4 bg-white/6 hover:bg-white/10 border border-white/10 text-white text-[15px] font-medium rounded-xl transition-all">
              See plans — from $699/mo
            </Link>
          </div>
          <p className="text-xs text-white/20">No credit card required · No setup fees · Cancel anytime</p>
        </div>
      </section>

      {/* ── VIDEO OVERVIEW ───────────────────────────────────────────────── */}
      <section className="py-10 px-5">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-6">
            <p className="text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-2">Platform overview</p>
            <h2
              className="text-2xl font-bold text-white/70"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              See how it works in 3 minutes
            </h2>
          </div>
          <VideoPlaceholder
            title="ProPlan Studio — Complete Platform Walkthrough"
            duration="3:20"
            subtitle="Overview"
          />
        </div>
      </section>

      {/* ── STATS ────────────────────────────────────────────────────────── */}
      <section className="border-y border-white/6 bg-[#0a0a0a]/60">
        <div className="max-w-5xl mx-auto px-5 grid grid-cols-2 md:grid-cols-4">
          {STATS.map((s, i) => (
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

      {/* ── AI RENDER STUDIO ─────────────────────────────────────────────── */}
      <section id="ai-renders" className="py-24 px-5 scroll-mt-20">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-[1fr_2fr] gap-12 items-start mb-10">
            <div>
              <Pill>AI Render Studio</Pill>
              <h2
                className="text-4xl font-extrabold tracking-tight mt-5 mb-4 leading-tight"
                style={{ fontFamily: "var(--font-syne), sans-serif" }}
              >
                From floor plan to{" "}
                <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
                  photorealistic render
                </span>
              </h2>
              <p className="text-white/45 leading-relaxed mb-6">
                Upload your brief and our AI generates exterior, interior, and aerial views in seconds. Included in every plan — no extra charge.
              </p>
              <ul className="space-y-2">
                {["Exterior dusk & golden hour", "Interior lifestyle scenes", "Aerial community views", "Generated in seconds"].map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-white/55">
                    <Check />{f}
                  </li>
                ))}
              </ul>
              <Link href="/products/ai-renders"
                className="inline-flex items-center gap-2 mt-6 text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors">
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

          {/* Carousel */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4 px-8">
              <p className="text-sm font-semibold text-white/50">Sample AI renders — generated from home model data</p>
              <Link href="/auth/signup" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors">
                Generate yours <Arrow />
              </Link>
            </div>
            <RenderCarousel />
          </div>

          {/* AI vs Traditional */}
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { dot: "bg-amber-400", label: "AI Renders — Included", value: "400 / month", sub: "on Studio plan — generate concepts, variations, and mood boards instantly. Delivered in seconds." },
              { dot: "bg-blue-400",  label: "Traditional Renders — Also Included", value: "50 / month", sub: "on Studio plan — hand-crafted by our studio team. Photorealistic, marketing-grade. 48hr turnaround." },
            ].map(c => (
              <div key={c.label} className="bg-[#0e0e0e] border border-white/8 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-2 h-2 rounded-full ${c.dot}`} />
                  <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">{c.label}</p>
                </div>
                <p className="text-2xl font-bold text-white mb-1" style={{ fontFamily: "var(--font-syne), sans-serif" }}>{c.value}</p>
                <p className="text-sm text-white/38">{c.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRODUCTS GRID ────────────────────────────────────────────────── */}
      <section className="py-24 px-5 border-t border-white/6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-xl mx-auto mb-14">
            <Pill>Full platform</Pill>
            <h2
              className="text-4xl md:text-5xl font-extrabold tracking-tight mt-5 mb-4 leading-tight"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              Everything your sales team needs
            </h2>
            <p className="text-white/45">One subscription. Four tools. Total control over your sales journey.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {PRODUCTS.map((p) => (
              <div key={p.href}
                className={`relative group rounded-2xl border border-white/8 bg-gradient-to-br ${p.bg} bg-[#0e0e0e] hover:border-white/14 transition-all overflow-hidden`}>
                {/* Subtle grid in card */}
                <div className="absolute inset-0 blueprint-grid opacity-30" />
                <div className="relative p-8">
                  <div className="flex items-start justify-between mb-6">
                    <div className={`w-11 h-11 rounded-xl border flex items-center justify-center ${p.iconBg}`}>
                      {p.icon}
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${
                      p.label === "Coming soon"
                        ? "border-white/10 text-white/30 bg-white/4"
                        : "border-white/8 text-white/40 bg-white/4"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
                      {p.label}
                    </span>
                  </div>
                  <h3
                    className="text-xl font-bold text-white mb-2"
                    style={{ fontFamily: "var(--font-syne), sans-serif" }}
                  >{p.name}</h3>
                  <p className="text-sm text-white/45 leading-relaxed mb-6">{p.desc}</p>
                  <Link href={p.href}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-blue-400 hover:text-blue-300 group-hover:gap-3 transition-all">
                    Explore {p.name} <Arrow />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── RENDERS SHOWCASE ─────────────────────────────────────────────── */}
      <section className="py-24 px-5 border-t border-white/6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          {/* Images */}
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

          {/* Copy */}
          <div>
            <Pill>Studio rendering</Pill>
            <h2
              className="text-4xl md:text-5xl font-extrabold tracking-tight mt-5 mb-5 leading-tight"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              Professional renders included,{" "}
              <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
                not sold separately
              </span>
            </h2>
            <p className="text-white/45 text-lg leading-relaxed mb-8">
              Every plan includes a monthly allocation of hand-crafted renders by our studio team — marketing-grade quality, 48-hour turnaround.
            </p>
            <ul className="space-y-3 mb-8">
              {[
                "Exterior — dusk, day, aerial",
                "Interior — kitchen, living, bedroom",
                "48hr avg turnaround from brief",
                "Revisions included",
              ].map(f => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-white/55"><Check />{f}</li>
              ))}
            </ul>
            <Link href="/products/3d-rendering"
              className="inline-flex items-center gap-2 text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors">
              See how our studio works <Arrow />
            </Link>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-5 border-t border-white/6 scroll-mt-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <Pill>Simple onboarding</Pill>
            <h2
              className="text-4xl md:text-5xl font-extrabold tracking-tight mt-5 mb-4"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              Live in weeks, not months
            </h2>
            <p className="text-white/45 text-lg max-w-md mx-auto">We handle all the 3D production. You stay focused on selling homes.</p>
          </div>
          <div className="relative">
            <div className="hidden md:block absolute left-[21px] top-10 bottom-10 w-px bg-gradient-to-b from-blue-600/40 via-violet-600/30 to-transparent" />
            <div className="space-y-0">
              {STEPS.map((step, i) => (
                <div key={i} className="flex gap-6 pb-10 last:pb-0">
                  <div className="flex-shrink-0">
                    <div
                      className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-xs font-bold text-white shadow-lg shadow-blue-600/20 z-10"
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

      {/* ── PRICING ──────────────────────────────────────────────────────── */}
      <section className="py-24 px-5 border-t border-white/6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <Pill>Pricing</Pill>
            <h2
              className="text-4xl md:text-5xl font-extrabold tracking-tight mt-5 mb-4"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              Renders, configurators, and leads —{" "}
              <br />
              <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
                one flat monthly plan
              </span>
            </h2>
            <p className="text-white/40 text-lg">No setup fees. No per-render charges. No per-lead fees.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            {TIERS.map((tier) => (
              <div key={tier.name}
                className={`relative rounded-2xl p-7 flex flex-col border transition-all ${
                  tier.highlight
                    ? "bg-gradient-to-b from-blue-600/10 to-transparent border-blue-500/40 shadow-xl shadow-blue-600/8"
                    : "bg-[#0e0e0e] border-white/8"
                }`}>
                {(tier as typeof tier & { badge?: string }).badge && (
                  <div className="absolute -top-3 left-6 px-3 py-1 rounded-full bg-blue-500 text-[10px] font-bold text-white tracking-wider uppercase">
                    {(tier as typeof tier & { badge?: string }).badge}
                  </div>
                )}
                <div className="mb-5">
                  <p className="text-sm font-semibold text-white/55 mb-1" style={{ fontFamily: "var(--font-syne), sans-serif" }}>{tier.name}</p>
                  <div className="flex items-end gap-1 mb-2">
                    <span className="text-4xl font-extrabold text-white tracking-tight" style={{ fontFamily: "var(--font-syne), sans-serif" }}>${tier.price.toLocaleString()}</span>
                    <span className="text-white/30 text-sm pb-1.5">/mo</span>
                  </div>
                  <p className="text-xs text-white/35">{tier.desc}</p>
                </div>
                <ul className="space-y-2.5 flex-1 mb-7">
                  {tier.perks.map(p => (
                    <li key={p} className="flex items-start gap-2.5 text-xs text-white/50"><Check />{p}</li>
                  ))}
                </ul>
                <Link href="/auth/signup"
                  className={`w-full py-3 rounded-xl text-sm font-semibold text-center transition-colors ${
                    tier.highlight
                      ? "bg-blue-600 hover:bg-blue-500 text-white"
                      : "bg-white/8 hover:bg-white/12 text-white"
                  }`}>
                  Get started with {tier.name}
                </Link>
              </div>
            ))}
          </div>
          <p className="text-center text-[11px] text-white/20">
            *Unlimited renders on Scale subject to fair-use: one project in queue at a time, 5-day turnaround. · Annual billing saves 2 months.
          </p>
        </div>
      </section>

      {/* ── ROADMAP / SUGGESTED FEATURES ─────────────────────────────────── */}
      <section className="py-20 px-5 border-t border-white/6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-10">
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/25 px-3 py-1 rounded-full border border-white/10">On the roadmap</span>
            <div className="flex-1 h-px bg-white/6" />
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {ROADMAP.map((f) => (
              <div key={f.name} className="bg-[#0e0e0e] border border-dashed border-white/10 rounded-2xl p-6">
                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-white/30 mb-4">
                  {f.icon}
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-sm font-bold text-white/60" style={{ fontFamily: "var(--font-syne), sans-serif" }}>{f.name}</h3>
                  <span className="text-[9px] font-bold text-white/20 uppercase tracking-wider">Soon</span>
                </div>
                <p className="text-xs text-white/35 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────────────────────── */}
      <section className="py-24 px-5 border-t border-white/6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <Pill>Builder stories</Pill>
            <h2
              className="text-3xl md:text-4xl font-extrabold tracking-tight mt-5"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              Builders close more — with less friction
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="bg-[#0e0e0e] border border-white/8 rounded-2xl p-7 flex flex-col">
                <div className="flex mb-4">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-3.5 h-3.5 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  ))}
                </div>
                <p className="text-sm text-white/50 leading-relaxed flex-1 mb-6">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${t.grad} flex items-center justify-center flex-shrink-0`}>
                    <span className="text-[11px] font-bold text-white">{t.init}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{t.name}</p>
                    <p className="text-[11px] text-white/30">{t.role} · {t.company}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="py-24 px-5">
        <div className="max-w-4xl mx-auto">
          <div className="relative rounded-3xl overflow-hidden border border-white/10 bg-[#0d0d14] p-12 md:p-16 text-center">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-violet-600/6 to-transparent pointer-events-none" />
            <div className="absolute inset-0 blueprint-grid opacity-20 pointer-events-none" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
            <div className="relative">
              <div className="flex justify-center mb-6"><Pill>Start today — no setup fee</Pill></div>
              <h2
                className="text-4xl md:text-5xl font-extrabold tracking-tight mb-5 leading-tight"
                style={{ fontFamily: "var(--font-syne), sans-serif" }}
              >
                Ready to sell homes
                <br />
                <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-indigo-400 bg-clip-text text-transparent">
                  before they&apos;re built?
                </span>
              </h2>
              <p className="text-white/40 text-lg mb-10 max-w-md mx-auto leading-relaxed">
                Join builders using ProPlan Studio to capture more leads, deliver better buyer experiences, and close faster.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
                <Link href="/auth/signup"
                  className="flex items-center justify-center gap-2 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white text-[15px] font-semibold rounded-xl transition-colors shadow-2xl shadow-blue-600/25">
                  Get started free <Arrow />
                </Link>
                <Link href="/pricing"
                  className="flex items-center justify-center px-8 py-4 bg-white/6 hover:bg-white/10 border border-white/10 text-white text-[15px] font-medium rounded-xl transition-all">
                  Compare plans
                </Link>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-white/25">
                <span className="flex items-center gap-1.5"><Check />No credit card required</span>
                <span className="flex items-center gap-1.5"><Check />First model onboarding included</span>
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
function ShareIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"/></svg>;
}
function QRIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z"/></svg>;
}
function PDFIcon() {
  return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>;
}
