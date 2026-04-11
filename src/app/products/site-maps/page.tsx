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

function SiteMapIllustration() {
  const lots = [
    { x: 60,  y: 60,  w: 90, h: 70, status: "available", label: "Lot 1" },
    { x: 165, y: 60,  w: 90, h: 70, status: "reserved",  label: "Lot 2" },
    { x: 270, y: 60,  w: 90, h: 70, status: "available", label: "Lot 3" },
    { x: 375, y: 60,  w: 90, h: 70, status: "sold",      label: "Lot 4" },
    { x: 60,  y: 155, w: 90, h: 70, status: "sold",      label: "Lot 5" },
    { x: 165, y: 155, w: 90, h: 70, status: "available", label: "Lot 6" },
    { x: 270, y: 155, w: 90, h: 70, status: "available", label: "Lot 7" },
    { x: 375, y: 155, w: 90, h: 70, status: "reserved",  label: "Lot 8" },
  ];
  const colors: Record<string, { fill: string; stroke: string; label: string }> = {
    available: { fill: "rgba(59,130,246,0.15)",  stroke: "#3b82f6", label: "#60a5fa" },
    reserved:  { fill: "rgba(251,191,36,0.15)",  stroke: "#f59e0b", label: "#fbbf24" },
    sold:      { fill: "rgba(239,68,68,0.12)",   stroke: "#ef4444", label: "#f87171" },
  };
  return (
    <svg viewBox="0 0 530 300" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="530" height="300" fill="#080808"/>
      {Array.from({ length: 8 }).map((_, i) => (
        <line key={`h${i}`} x1="0" y1={i * 40} x2="530" y2={i * 40} stroke="#1a2535" strokeWidth="0.5"/>
      ))}
      {Array.from({ length: 14 }).map((_, i) => (
        <line key={`v${i}`} x1={i * 40} y1="0" x2={i * 40} y2="300" stroke="#1a2535" strokeWidth="0.5"/>
      ))}
      <rect x="0" y="115" width="530" height="24" fill="#111820" opacity="0.9"/>
      <line x1="0" y1="127" x2="530" y2="127" stroke="#2a3540" strokeWidth="1" strokeDasharray="12 8"/>
      <text x="265" y="131" fill="#2a3a50" fontSize="8" textAnchor="middle" fontFamily="monospace">COMMUNITY DRIVE</text>
      {lots.map((lot) => {
        const c = colors[lot.status];
        return (
          <g key={lot.label}>
            <rect x={lot.x} y={lot.y} width={lot.w} height={lot.h} rx="4" fill={c.fill} stroke={c.stroke} strokeWidth="1"/>
            <text x={lot.x + lot.w / 2} y={lot.y + lot.h / 2 - 6} fill={c.label} fontSize="8" textAnchor="middle" fontFamily="monospace" fontWeight="bold">{lot.label}</text>
            <text x={lot.x + lot.w / 2} y={lot.y + lot.h / 2 + 8} fill={c.label} fontSize="7" textAnchor="middle" fontFamily="monospace" opacity="0.7">{lot.status.toUpperCase()}</text>
          </g>
        );
      })}
      {[
        { x: 60,  color: "#3b82f6", label: "Available" },
        { x: 160, color: "#f59e0b", label: "Reserved"  },
        { x: 260, color: "#ef4444", label: "Sold"      },
      ].map(l => (
        <g key={l.label}>
          <rect x={l.x} y="248" width="10" height="10" rx="2" fill={l.color} fillOpacity="0.3" stroke={l.color} strokeWidth="0.8"/>
          <text x={l.x + 14} y="257" fill="white" fillOpacity="0.4" fontSize="8" fontFamily="monospace">{l.label}</text>
        </g>
      ))}
      <rect x="165" y="155" width="90" height="70" rx="4" fill="none" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4 2" opacity="0.7"/>
      <text x="210" y="228" fill="#60a5fa" fontSize="7" textAnchor="middle" fontFamily="monospace">SELECTED</text>
    </svg>
  );
}

export default async function SiteMapsPage() {
  const plan         = await fetchActivePlan();
  const monthlyPrice = plan?.price_monthly ?? 150000;

  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden">
      <Nav />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-16 px-5 overflow-hidden">
        <div className="absolute inset-0 blueprint-grid opacity-30" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(8,8,8,0)_0%,#080808_80%)]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-teal-600/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-teal-500/20 bg-teal-500/8 text-[11px] font-semibold text-teal-400 uppercase tracking-wide mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400" /> Step 1 of the buyer journey
          </div>
          <h1
            className="text-5xl md:text-[62px] font-extrabold leading-[1.04] tracking-[-0.03em] mb-6"
            style={{ fontFamily: "var(--font-syne), sans-serif" }}
          >
            Buyers arrive knowing
            <br />
            <span className="bg-gradient-to-r from-teal-400 to-cyan-500 bg-clip-text text-transparent">
              exactly which lot they want.
            </span>
          </h1>
          <p className="text-lg text-white/45 leading-relaxed max-w-2xl mx-auto mb-5">
            Your interactive site map is the first thing a serious buyer sees. They browse available lots, pick one that fits their lifestyle, and flow directly into configuring their home — all before your sales team picks up the phone.
          </p>
          <p className="text-base text-white/30 max-w-xl mx-auto mb-10">
            Most builders answer the same question — "which lots are left?" — dozens of times a week. An interactive site map eliminates those calls and turns passive visitors into leads that already know what they want.
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
          <p className="text-xs text-white/22">Included in {fmtUSD(monthlyPrice)}/mo · Unlimited communities · Embed anywhere</p>
        </div>
      </section>

      {/* ── VIDEO ────────────────────────────────────────────────────────── */}
      <section className="py-8 px-5">
        <div className="max-w-4xl mx-auto">
          <VideoPlaceholder
            title="Interactive Site Map — lot selection to configurator in one flow"
            duration="2:50"
            subtitle="Product demo"
          />
        </div>
      </section>

      {/* ── SITE MAP ILLUSTRATION ─────────────────────────────────────────── */}
      <section className="py-16 px-5 border-t border-white/6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <h2
              className="text-3xl font-extrabold tracking-tight"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              Live lot availability — always accurate
            </h2>
            <p className="text-white/40 mt-2">Buyers browse color-coded lots and click any available one to begin configuring their home.</p>
          </div>
          <div className="rounded-2xl overflow-hidden border border-white/10 bg-[#080808] aspect-[530/300] shadow-2xl shadow-black/50">
            <SiteMapIllustration />
          </div>
          <div className="mt-4 flex items-center justify-center gap-6 text-xs text-white/35">
            {[
              { dot: "bg-blue-400",  label: "Available" },
              { dot: "bg-amber-400", label: "Reserved" },
              { dot: "bg-red-400",   label: "Sold" },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${s.dot}`} />
                {s.label}
              </div>
            ))}
          </div>

          {/* What changes in the dashboard propagates live */}
          <div className="mt-8 bg-[#0e0e0e] border border-white/8 rounded-2xl p-6 flex flex-col md:flex-row gap-6 items-center">
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-widest text-white/25 mb-2">How it stays current</p>
              <p className="text-sm text-white/50 leading-relaxed">
                Every status change you make in your builder dashboard — marking a lot reserved after a deposit, flipping it to sold at contract — is reflected on the live site map immediately. Buyers never see stale inventory.
              </p>
            </div>
            <div className="flex-shrink-0 grid grid-cols-3 gap-3 text-center">
              {[
                { value: "Real-time", label: "Status updates" },
                { value: "0", label: "Calls about availability" },
                { value: "∞", label: "Communities" },
              ].map(s => (
                <div key={s.label} className="bg-[#080808] border border-white/8 rounded-xl p-4">
                  <p className="text-xl font-bold text-white" style={{ fontFamily: "var(--font-syne), sans-serif" }}>{s.value}</p>
                  <p className="text-[9px] text-white/30 mt-0.5 leading-tight">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── THE COMPLETE BUYER JOURNEY ────────────────────────────────────── */}
      <section className="py-20 px-5 border-t border-white/6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-3">Where it fits</p>
            <h2 className="text-3xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-syne), sans-serif" }}>
              Part of the complete buyer journey
            </h2>
            <p className="text-white/40 mt-3 max-w-lg mx-auto">The site map is where the journey starts. Every other ProPlan tool connects to it.</p>
          </div>
          <div className="grid sm:grid-cols-4 gap-3">
            {[
              {
                step: "01",
                label: "Site Map",
                color: "teal",
                active: true,
                desc: "Buyer finds an available lot that fits their criteria.",
              },
              {
                step: "02",
                label: "Configurator",
                color: "blue",
                active: false,
                desc: "They customize the home model assigned to that lot.",
              },
              {
                step: "03",
                label: "AI Render",
                color: "violet",
                active: false,
                desc: "An instant render shows exactly what their home will look like.",
              },
              {
                step: "04",
                label: "Quote Lead",
                color: "amber",
                active: false,
                desc: "Their lead is captured with lot, configuration, and render attached.",
              },
            ].map((s) => {
              const borderCls  = s.active ? "border-teal-500/40 bg-teal-500/5"  : "border-white/8 bg-[#0e0e0e]";
              const stepColor  = s.active ? "from-teal-600 to-cyan-600" : "from-white/10 to-white/5";
              const labelColor = s.active ? "text-teal-300" : "text-white/50";
              return (
                <div key={s.step} className={`rounded-2xl border p-5 ${borderCls}`}>
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${stepColor} flex items-center justify-center text-xs font-bold text-white mb-3`}
                    style={{ fontFamily: "var(--font-syne), sans-serif" }}>
                    {s.step}
                  </div>
                  <p className={`text-sm font-bold mb-1.5 ${labelColor}`} style={{ fontFamily: "var(--font-syne), sans-serif" }}>{s.label}</p>
                  <p className="text-xs text-white/35 leading-relaxed">{s.desc}</p>
                </div>
              );
            })}
          </div>
          <div className="mt-6 text-center">
            <p className="text-xs text-white/25">
              All four steps happen on your website. The buyer never leaves, never calls, never emails. They submit a fully-qualified lead.
            </p>
          </div>
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────────────────── */}
      <section className="py-20 px-5 border-t border-white/6">
        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-14 items-start">
            <div>
              <p className="text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-4">What's inside</p>
              <h2
                className="text-3xl md:text-4xl font-extrabold tracking-tight mb-5 leading-tight"
                style={{ fontFamily: "var(--font-syne), sans-serif" }}
              >
                Built for how buyers actually shop for new construction.
              </h2>
              <p className="text-white/45 leading-relaxed mb-5">
                New-construction buyers research differently than resale buyers. They care about orientation, lot size, proximity to amenities, and which models fit which lots. Your site map surfaces all of it — interactively, visually, and without your team on the phone.
              </p>
              <p className="text-white/35 leading-relaxed mb-8">
                Each lot click is a micro-commitment. By the time a buyer submits a lead, they&apos;ve already chosen a lot and configured a home. That&apos;s not a cold inquiry — that&apos;s a buyer ready for contract.
              </p>
              <ul className="space-y-3">
                {[
                  "Live lot status — available, reserved, sold — synced to your dashboard",
                  "Each lot links directly to its assigned home model configurator",
                  "Lot details: dimensions, price premium, orientation, notes",
                  "Multi-community — unlimited communities from one dashboard",
                ].map(item => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-white/55"><Check />{item}</li>
                ))}
              </ul>
            </div>

            <div className="space-y-4">
              {/* Embed widget */}
              <div className="bg-[#0e0e0e] border border-white/8 rounded-2xl p-6">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-4">How it goes on your site</p>
                <div className="bg-[#080808] rounded-xl border border-white/8 p-4 font-mono text-xs text-teal-400/70 mb-3">
                  <span className="text-white/20">{"<"}</span>
                  <span className="text-blue-400">iframe</span>
                  <span className="text-white/20">{" "}</span>
                  <span className="text-amber-400">src</span>
                  <span className="text-white/20">{"=\""}</span>
                  <span className="text-teal-400">proplan.studio/embed/sitemap/...</span>
                  <span className="text-white/20">{"\" />"}</span>
                </div>
                <ul className="space-y-2">
                  {[
                    "One snippet — paste into any page builder or CMS",
                    "Responsive — works on mobile, tablet, desktop",
                    "Runs on your existing domain — no migration",
                  ].map(d => (
                    <li key={d} className="flex items-start gap-2.5 text-sm text-white/55"><Check />{d}</li>
                  ))}
                </ul>
              </div>

              {/* Inclusion card */}
              <div className="bg-teal-500/5 border border-teal-500/20 rounded-2xl p-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-teal-400/60 mb-3">Plan inclusion</p>
                <div className="flex items-baseline gap-2 mb-1">
                  <p className="text-3xl font-extrabold text-white" style={{ fontFamily: "var(--font-syne), sans-serif" }}>Unlimited</p>
                  <p className="text-sm text-teal-300">communities</p>
                </div>
                <p className="text-xs text-white/30">No per-community fees · No per-lot fees · Included in {fmtUSD(monthlyPrice)}/mo</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── WHAT YOUR LEADS LOOK LIKE ─────────────────────────────────────── */}
      <section className="py-20 px-5 border-t border-white/6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-syne), sans-serif" }}>
              What your team receives
            </h2>
            <p className="text-white/40 mt-3">Every lead that flows through the buyer journey arrives with the full picture attached.</p>
          </div>

          <div className="bg-[#0e0e0e] border border-white/8 rounded-2xl overflow-hidden">
            <div className="border-b border-white/6 px-6 py-4">
              <p className="text-xs font-bold uppercase tracking-widest text-white/25">Sample lead record</p>
            </div>
            <div className="divide-y divide-white/5">
              {[
                { field: "Contact",       value: "Sarah M. · sarah@example.com · (214) 555-0182" },
                { field: "Community",     value: "Riverside Heights" },
                { field: "Lot selected",  value: "Lot 6 — 65×130, corner, east-facing, +$18,000 premium" },
                { field: "Model",         value: "The Meridian — 2,640 sq ft, 4BR / 3BA" },
                { field: "Configuration", value: "Elevation B · Stone + Board & Batten · Open kitchen · Study" },
                { field: "Render saved",  value: "AI render preview — daytime exterior, SW elevation" },
                { field: "Intent signal", value: "Spent 14 min on configurator · Requested quote" },
              ].map(row => (
                <div key={row.field} className="flex gap-4 px-6 py-3.5">
                  <p className="text-xs text-white/25 w-32 flex-shrink-0 pt-0.5">{row.field}</p>
                  <p className="text-sm text-white/65">{row.value}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-center text-xs text-white/25 mt-4">
            Your sales team opens this lead knowing the lot, the home, every upgrade selected, and how serious the buyer is. No qualification call needed.
          </p>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="py-20 px-5 border-t border-white/6">
        <div className="max-w-3xl mx-auto text-center">
          <h2
            className="text-3xl font-extrabold tracking-tight mb-4"
            style={{ fontFamily: "var(--font-syne), sans-serif" }}
          >
            Give buyers a map. Get leads that know what they want.
          </h2>
          <p className="text-white/40 mb-8 max-w-md mx-auto">
            Interactive site maps — and the complete buyer journey — are included in your {fmtUSD(monthlyPrice)}/mo subscription. No separate invoicing. No per-community fees.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/auth/signup"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors shadow-xl shadow-blue-600/20">
              Get started — {fmtUSD(monthlyPrice)}/mo <Arrow />
            </Link>
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
