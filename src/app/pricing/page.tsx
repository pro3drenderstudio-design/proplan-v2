import Link from "next/link";

const TIERS = [
  {
    name:        "Launch",
    price:       699,
    desc:        "Get your first configurator live and start capturing leads.",
    highlight:   false,
    badge:       null,
    renders:     15,
    aiRenders:   150,
    models:      2,
    sitemaps:    false,
    features: [
      "2 active home model configurators",
      "15 traditional 3D renders / mo",
      "150 AI concept renders / mo",
      "Lead CRM + contact management",
      "Basic analytics dashboard",
      "Email support",
    ],
  },
  {
    name:        "Studio",
    price:       1499,
    desc:        "For active builders with multiple communities and marketing needs.",
    highlight:   true,
    badge:       "Most Popular",
    renders:     50,
    aiRenders:   400,
    models:      5,
    sitemaps:    true,
    features: [
      "5 active home model configurators",
      "50 traditional 3D renders / mo",
      "400 AI concept renders / mo",
      "Lead CRM + analytics + exports",
      "1 interactive site map",
      "Priority support",
      "Brand customization (logo + colors)",
    ],
  },
  {
    name:        "Scale",
    price:       2499,
    desc:        "For high-volume builders with unlimited projects and white-label needs.",
    highlight:   false,
    badge:       "Enterprise",
    renders:     Infinity,
    aiRenders:   1000,
    models:      Infinity,
    sitemaps:    true,
    features: [
      "Unlimited home model configurators",
      "Unlimited traditional 3D renders*",
      "1,000 AI concept renders / mo",
      "Full analytics suite + API access",
      "Unlimited interactive site maps",
      "Dedicated Customer Success Manager",
      "White-label configurator URL",
      "SLA-backed support",
    ],
  },
];

const ADDONS = [
  { label: "Additional configurator model",   price: "Included in plan",   note: "No per-model setup fee" },
  { label: "Site map setup (per community)",  price: "Included in Studio+", note: null },
  { label: "Extra traditional renders",       price: "Contact us",         note: "For burst usage over plan limits" },
  { label: "Additional AI render credits",    price: "$0.05 / render",     note: "Top-up at any time" },
  { label: "White-label setup",               price: "Included in Scale",  note: "Custom domain + branding" },
  { label: "Annual billing discount",         price: "2 months free",      note: "Pay annually, save 17%" },
];

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">

      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/8 max-w-7xl mx-auto">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo_light.png" alt="ProPlan Studio" className="h-7 object-contain" />
        <div className="flex items-center gap-4">
          <Link href="/auth/login" className="text-sm text-white/60 hover:text-white transition-colors">Sign in</Link>
          <Link href="/auth/signup" className="text-sm px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors">
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="text-center py-20 px-6 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400 font-medium mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          Rendering + Configurators + Leads — All in one
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-5 leading-tight">
          Simple pricing for <br />
          <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
            home builders
          </span>
        </h1>
        <p className="text-lg text-white/50 max-w-xl mx-auto">
          Interactive 3D configurators, professional renderings, and AI concept images — bundled into one monthly plan. No setup fees. Cancel anytime.
        </p>
      </section>

      {/* Pricing cards */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TIERS.map(tier => (
            <div
              key={tier.name}
              className={`relative rounded-2xl p-7 flex flex-col ${
                tier.highlight
                  ? "bg-blue-600/10 border-2 border-blue-500/60 shadow-xl shadow-blue-500/10"
                  : "bg-[#141414] border border-white/10"
              }`}
            >
              {tier.badge && (
                <div className={`absolute -top-3 left-6 text-[10px] font-bold px-3 py-1 rounded-full tracking-wider ${
                  tier.highlight ? "bg-blue-500 text-white" : "bg-white/10 text-white/60"
                }`}>
                  {tier.badge}
                </div>
              )}

              <div className="mb-6">
                <h2 className="text-lg font-bold text-white mb-1">{tier.name}</h2>
                <p className="text-xs text-white/45 leading-relaxed">{tier.desc}</p>
              </div>

              <div className="mb-6">
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-bold text-white">${tier.price.toLocaleString()}</span>
                  <span className="text-white/40 text-sm mb-1.5">/mo</span>
                </div>
                <p className="text-[10px] text-white/30 mt-1">Billed monthly · Save 17% annually</p>
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-2 mb-6 bg-white/5 rounded-xl p-3">
                <div className="text-center">
                  <p className="text-base font-bold text-white">
                    {tier.models === Infinity ? "∞" : tier.models}
                  </p>
                  <p className="text-[9px] text-white/30 mt-0.5">Models</p>
                </div>
                <div className="text-center border-x border-white/8">
                  <p className="text-base font-bold text-white">
                    {tier.renders === Infinity ? "∞" : tier.renders}
                  </p>
                  <p className="text-[9px] text-white/30 mt-0.5">Renders</p>
                </div>
                <div className="text-center">
                  <p className="text-base font-bold text-white">{tier.aiRenders.toLocaleString()}</p>
                  <p className="text-[9px] text-white/30 mt-0.5">AI Credits</p>
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-2.5 flex-1 mb-7">
                {tier.features.map(f => (
                  <li key={f} className="flex items-start gap-2.5">
                    <CheckIcon />
                    <span className="text-xs text-white/60 leading-relaxed">{f}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/auth/signup"
                className={`w-full py-3 rounded-xl text-sm font-semibold text-center transition-colors ${
                  tier.highlight
                    ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25"
                    : "bg-white/10 hover:bg-white/15 text-white"
                }`}
              >
                Start with {tier.name}
              </Link>
            </div>
          ))}
        </div>

        <p className="text-center text-[10px] text-white/25 mt-4">
          *Unlimited renders on Scale have a fair-use policy: one project in the render queue at a time, standard 5-day turnaround.
        </p>
      </section>

      {/* Add-ons / extras */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <h2 className="text-center text-xl font-bold text-white mb-2">Add-ons & Details</h2>
        <p className="text-center text-sm text-white/40 mb-10">Everything is transparent — no hidden fees.</p>

        <div className="bg-[#141414] border border-white/8 rounded-2xl divide-y divide-white/6">
          {ADDONS.map(addon => (
            <div key={addon.label} className="flex items-center justify-between px-6 py-4">
              <div>
                <p className="text-sm text-white/80">{addon.label}</p>
                {addon.note && <p className="text-xs text-white/35 mt-0.5">{addon.note}</p>}
              </div>
              <p className="text-sm font-semibold text-blue-400 flex-shrink-0 ml-4">{addon.price}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ / comparison callout */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <div className="bg-gradient-to-br from-blue-600/10 to-violet-600/10 border border-white/10 rounded-2xl p-10 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Why bundle renderings with your configurator?</h2>
          <p className="text-sm text-white/50 max-w-xl mx-auto mb-8 leading-relaxed">
            Traditional rendering studios charge $500–2,000 per image. Marketing agencies add another layer. With ProPlan Studio, your renders, interactive configurator, AI concepts, lead CRM, and site maps are all in one workflow — managed by the same team who built the 3D model.
          </p>
          <div className="grid grid-cols-3 gap-6 mb-8">
            {[
              { label: "Avg market rate / render", value: "$800", sub: "From external studios" },
              { label: "Studio plan value", value: "$40,000+", sub: "50 renders at market rate" },
              { label: "Your monthly cost", value: "$1,499", sub: "Everything included" },
            ].map(stat => (
              <div key={stat.label}>
                <p className="text-3xl font-bold text-white">{stat.value}</p>
                <p className="text-xs text-white/50 mt-1">{stat.label}</p>
                <p className="text-[10px] text-white/30 mt-0.5">{stat.sub}</p>
              </div>
            ))}
          </div>
          <Link href="/auth/signup"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-colors">
            Get started — no setup fees
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/8 py-8 text-center text-xs text-white/25 px-6">
        <p>© {new Date().getFullYear()} ProPlan Studio. All rights reserved.</p>
        <p className="mt-1">Prices in USD. Taxes may apply depending on your jurisdiction.</p>
      </footer>
    </div>
  );
}
