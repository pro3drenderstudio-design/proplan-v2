"use client";

import { useState } from "react";

// ── Real data from ProPlan Studio ─────────────────────────────────────────────

const COMMUNITY_SLUG = "Willowbrook";
const COMPANY_SLUG   = "pro-home-builders";
const SITEMAP_URL    = "https://pub-771cb4534de742a8876353182e3b5c47.r2.dev/migrated/community-site-maps/61437132-9f2e-423b-8f7e-01a124c0f655/1777072594367.png";
const CYPRESS_THUMB  = "https://pub-771cb4534de742a8876353182e3b5c47.r2.dev/migrated/project-thumbnails/5e6be2dc-4f9d-4e15-bd56-71be14d75c46/1777058558551.png";
const BUILDER_LOGO   = "https://pub-771cb4534de742a8876353182e3b5c47.r2.dev/builders/pro-home-builders/logo.svg";
const INTERACTIVE_MAP_URL = `/community/${COMPANY_SLUG}/${COMMUNITY_SLUG}`;
const CONFIGURATOR_URL    = `/project/${COMPANY_SLUG}/the-cypress`;

function fmtPrice(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WillowbrookPage() {
  const [activeTab, setActiveTab] = useState<"map" | "image">("map");
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", interest: "", message: "" });
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <div className="min-h-screen" style={{ background: "#FAFAF7", fontFamily: "'DM Sans', system-ui, sans-serif", color: "#1A1A1A" }}>

      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-stone-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-5 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Logo */}
            <div className="flex items-center flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={BUILDER_LOGO} alt="Pro Home Builders" className="h-8 object-contain" style={{ maxWidth: 160 }} />
            </div>
            <div className="hidden md:block w-px h-6 bg-stone-200" />
            <nav className="hidden md:flex items-center gap-0.5">
              {[
                { label: "Overview",    href: "#overview" },
                { label: "Site Map",    href: "#sitemap" },
                { label: "The Cypress", href: "#model" },
                { label: "Amenities",  href: "#amenities" },
                { label: "Contact",    href: "#contact" },
              ].map(n => (
                <a key={n.label} href={n.href}
                  className="px-3 py-1.5 text-sm text-stone-500 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition-colors">
                  {n.label}
                </a>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <a href="tel:+15125550147" className="hidden sm:flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
              </svg>
              (512) 555-0147
            </a>
            <a href="#contact"
              className="px-4 py-2 text-sm font-semibold text-white rounded-xl shadow-sm transition-all hover:brightness-110"
              style={{ background: "linear-gradient(135deg, #2E6B4E 0%, #1B4332 100%)" }}>
              Request Info
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ minHeight: "clamp(400px, 58vw, 580px)" }}>
        <div className="absolute inset-0" style={{
          background: "linear-gradient(135deg, #1B4332 0%, #2D6A4F 35%, #40916C 65%, #2D6A4F 100%)",
        }} />
        {/* Willow tree silhouette texture */}
        <div className="absolute inset-0" style={{
          backgroundImage: "radial-gradient(ellipse at 20% 80%, rgba(255,255,255,0.06) 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, rgba(255,220,100,0.06) 0%, transparent 50%)",
        }} />
        <div className="absolute inset-0 opacity-[0.07]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }} />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center h-full max-w-7xl mx-auto px-6 py-20">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider"
                style={{ background: "rgba(255,255,255,0.12)", color: "#B7E4C7", border: "1px solid rgba(255,255,255,0.18)" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Now Selling · Phase 2 Open
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium"
                style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.12)" }}>
                Cedar Park, TX
              </span>
            </div>

            <h1 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: "clamp(40px, 6vw, 72px)", lineHeight: 1.05, color: "white", letterSpacing: "-0.025em" }}>
              Willowbrook
            </h1>
            <p className="text-white/65 mt-3 text-base leading-relaxed max-w-lg">
              60 thoughtfully designed single-family homesites surrounded by protected greenbelts, creek trails, and a resort-style amenity center — 20 minutes from downtown Austin.
            </p>

            <div className="flex flex-wrap gap-3 mt-8">
              <a href="#sitemap"
                className="flex items-center gap-2 px-5 py-3 text-sm font-bold rounded-xl shadow-lg transition-all hover:brightness-105"
                style={{ background: "white", color: "#1B4332" }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
                </svg>
                Explore Site Map
              </a>
              <a href={CONFIGURATOR_URL} target="_blank"
                className="flex items-center gap-2 px-5 py-3 text-sm font-semibold rounded-xl transition-all"
                style={{ background: "rgba(255,255,255,0.14)", color: "white", border: "1px solid rgba(255,255,255,0.25)" }}>
                Configure The Cypress
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none" style={{ background: "linear-gradient(to bottom, transparent, #FAFAF7)" }} />
      </section>

      {/* ── Stats strip ────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-stone-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-stone-100">
            {[
              { label: "Total Homesites", value: "60",       sub: "master-planned community"         },
              { label: "Available Now",   value: "33",       sub: "ready to purchase", accent: "#2D6A4F" },
              { label: "Priced From",     value: "$350,000", sub: "The Cypress · 4 bed"              },
              { label: "Home Model",      value: "The Cypress", sub: "4 bed · 3.5 bath · 2 stories" },
            ].map(s => (
              <div key={s.label} className="py-5 px-6 text-center md:text-left">
                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">{s.label}</p>
                <p className="text-xl font-bold mt-0.5 truncate" style={{ color: s.accent ?? "#1A1A1A" }}>{s.value}</p>
                <p className="text-[11px] text-stone-400 mt-0.5 leading-snug">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Overview ───────────────────────────────────────────────────────── */}
      <section id="overview" className="py-16 max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: "#2D6A4F" }}>About Willowbrook</p>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "clamp(26px, 3vw, 36px)", lineHeight: 1.2, letterSpacing: "-0.02em" }}>
              Where nature shapes<br />the neighborhood
            </h2>
            <p className="text-stone-500 mt-4 leading-relaxed">
              Willowbrook was designed around what matters most: preserved green space, walkable streets, and homes built with integrity. Every lot backs to either a protected greenbelt or one of three neighborhood parks.
            </p>
            <p className="text-stone-500 mt-3 leading-relaxed">
              Pro Home Builders brings over 25 years of Texas craftsmanship to every home. Our single available model — The Cypress — offers generous spaces, elevated finishes, and a design that lives well for decades.
            </p>
            <div className="flex flex-wrap gap-3 mt-6">
              {[
                { label: "Cedar Park ISD",         icon: "🏫" },
                { label: "Barton Creek Trails",    icon: "🌿" },
                { label: "20 min to Downtown",     icon: "🏙️" },
                { label: "Energy Star Certified",  icon: "⚡" },
              ].map(f => (
                <div key={f.label} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100">
                  <span className="text-sm">{f.icon}</span>
                  <span className="text-xs font-medium text-emerald-800">{f.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Total Homesites",  value: "60",      bg: "#F0FDF4", text: "#166534"  },
              { label: "Available Today",  value: "33",      bg: "#DCFCE7", text: "#166534"  },
              { label: "Under Contract",   value: "15",      bg: "#FEF3C7", text: "#92400E"  },
              { label: "Delivered",        value: "12",      bg: "#F1F5F9", text: "#334155"  },
            ].map(s => (
              <div key={s.label} className="rounded-2xl p-5 border border-stone-200"
                style={{ background: s.bg }}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">{s.label}</p>
                <p className="text-3xl font-bold mt-1" style={{ color: s.text }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Interactive Site Map ────────────────────────────────────────────── */}
      <section id="sitemap" className="py-16 border-t border-stone-200" style={{ background: "#F0EDE6" }}>
        <div className="max-w-7xl mx-auto px-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: "#2D6A4F" }}>Interactive Site Map</p>
              <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "clamp(24px, 2.5vw, 32px)", letterSpacing: "-0.02em" }}>
                Find your lot in Willowbrook
              </h2>
              <p className="text-stone-500 text-sm mt-1">60 homesites · 33 available · Lots 287–346</p>
            </div>

            {/* Tab switcher */}
            <div className="flex items-center gap-1 bg-stone-200 rounded-xl p-1 self-start sm:self-auto flex-shrink-0">
              <button onClick={() => setActiveTab("map")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === "map" ? "bg-white text-stone-800 shadow-sm" : "text-stone-500 hover:text-stone-700"}`}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59" />
                </svg>
                Interactive
              </button>
              <button onClick={() => setActiveTab("image")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === "image" ? "bg-white text-stone-800 shadow-sm" : "text-stone-500 hover:text-stone-700"}`}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
                Plat Image
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 mb-4 text-xs text-stone-500">
            {[
              { dot: "#16a34a", label: "Available", count: 33 },
              { dot: "#d97706", label: "Under Contract", count: 15 },
              { dot: "#9ca3af", label: "Sold / Delivered", count: 12 },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm border inline-block" style={{ background: s.dot + "33", borderColor: s.dot }} />
                <span className="font-medium">{s.label}</span>
                <span className="font-bold text-stone-700">{s.count}</span>
              </div>
            ))}
          </div>

          {/* Map container */}
          <div className="rounded-2xl overflow-hidden border border-stone-300 shadow-lg bg-[#080808]" style={{ height: "clamp(480px, 64vw, 700px)" }}>
            {activeTab === "map" ? (
              <iframe
                src={INTERACTIVE_MAP_URL}
                className="w-full h-full"
                style={{ border: "none", display: "block" }}
                title="Willowbrook Interactive Site Map"
                allow="fullscreen"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={SITEMAP_URL}
                alt="Willowbrook Site Map"
                className="w-full h-full object-contain"
                style={{ background: "#080808" }}
              />
            )}
          </div>

          {activeTab === "map" && (
            <p className="text-center text-xs text-stone-400 mt-3">
              Click any lot to see details, pricing, and start configuring your home.
              <a href={INTERACTIVE_MAP_URL} target="_blank" className="ml-2 underline text-stone-500 hover:text-stone-700">Open full screen ↗</a>
            </p>
          )}
        </div>
      </section>

      {/* ── The Cypress ────────────────────────────────────────────────────── */}
      <section id="model" className="py-16 max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-10 items-start">
          {/* Thumbnail */}
          <div className="rounded-2xl overflow-hidden border border-stone-200 shadow-sm bg-stone-100" style={{ aspectRatio: "16/10" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={CYPRESS_THUMB}
              alt="The Cypress"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Details */}
          <div className="flex flex-col justify-center">
            <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: "#2D6A4F" }}>Featured Home Model</p>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "clamp(28px, 3.5vw, 42px)", letterSpacing: "-0.025em", lineHeight: 1.1 }}>
              The Cypress
            </h2>
            <p className="text-stone-500 mt-3 leading-relaxed">
              The Cypress is a two-story single-family home with generous proportions and thoughtful design throughout. A flowing open-plan main floor gives way to an upstairs sanctuary with four bedrooms, including a spacious primary suite with a luxury bath.
            </p>

            {/* Specs */}
            <div className="grid grid-cols-4 gap-3 mt-5">
              {[
                { l: "Beds",    v: "4"   },
                { l: "Baths",   v: "3.5" },
                { l: "Stories", v: "2"   },
                { l: "Type",    v: "SFH" },
              ].map(s => (
                <div key={s.l} className="flex flex-col items-center py-3 rounded-xl bg-stone-50 border border-stone-200">
                  <span className="text-lg font-bold text-stone-800">{s.v}</span>
                  <span className="text-[10px] uppercase tracking-wider text-stone-400 mt-0.5">{s.l}</span>
                </div>
              ))}
            </div>

            {/* Included */}
            <div className="mt-5 p-4 rounded-xl bg-emerald-50 border border-emerald-100">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 mb-2">Included in Every Cypress</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {[
                  "Open-concept main floor",
                  "Chef's kitchen with island",
                  "Primary suite with soaking tub",
                  "Covered back porch",
                  "Two-car garage",
                  "Smart-home pre-wiring",
                  "Engineered hardwood",
                  "Energy Star certified",
                ].map(f => (
                  <div key={f} className="flex items-center gap-1.5 text-xs text-emerald-800">
                    <svg className="w-3.5 h-3.5 flex-shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </div>
                ))}
              </div>
            </div>

            {/* Price + CTA */}
            <div className="mt-5 flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="rounded-xl px-5 py-3 border border-stone-200 bg-white flex-shrink-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">Starting From</p>
                <p className="text-2xl font-bold text-stone-900 mt-0.5">{fmtPrice(350000)}</p>
              </div>
              <a href={CONFIGURATOR_URL} target="_blank"
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white transition-all hover:brightness-110 shadow-md flex-1 sm:flex-initial"
                style={{ background: "linear-gradient(135deg, #2E6B4E 0%, #1B4332 100%)" }}>
                Configure This Home
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </a>
            </div>
            <p className="text-[11px] text-stone-400 mt-2">Base price. Lot premiums and upgrades vary. Contact us for a personalised quote.</p>
          </div>
        </div>
      </section>

      {/* ── Amenities ───────────────────────────────────────────────────────── */}
      <section id="amenities" className="py-16 border-t border-stone-200" style={{ background: "#F0EDE6" }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: "#2D6A4F" }}>Life at Willowbrook</p>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "clamp(26px, 3vw, 36px)", letterSpacing: "-0.02em" }}>
              Community amenities
            </h2>
            <p className="text-stone-500 text-sm mt-2 max-w-xl mx-auto">Every Willowbrook homesite is within a five-minute walk of the community centre and creek trailhead.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: "🏊‍♂️", title: "Resort Pool & Spa",     desc: "Lagoon-style pool with zero-entry beach shelf, heated spa, and shaded cabanas." },
              { icon: "🏋️‍♀️", title: "Fitness Centre",         desc: "2,800 sqft gym with cardio, free weights, yoga studio, and on-demand classes." },
              { icon: "🌿", title: "Creek Trail System",     desc: "2.4 miles of paved trails winding along the protected Barton Creek greenbelt." },
              { icon: "🐕", title: "Off-Leash Dog Park",    desc: "Dedicated large and small dog areas with agility equipment and water stations." },
              { icon: "🛝", title: "Neighbourhood Parks",   desc: "Three pocket parks with shaded playgrounds, picnic tables, and open turf." },
              { icon: "🎉", title: "Clubhouse & Event Lawn",desc: "Rentable clubhouse with catering kitchen plus a 5,000 sqft outdoor event lawn." },
            ].map(a => (
              <div key={a.title} className="bg-white rounded-2xl p-5 border border-stone-200 hover:border-emerald-200 hover:shadow-md transition-all group">
                <div className="text-2xl mb-3">{a.icon}</div>
                <h3 className="font-bold text-stone-800 text-sm mb-1 group-hover:text-emerald-800 transition-colors">{a.title}</h3>
                <p className="text-xs text-stone-500 leading-relaxed">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Location ────────────────────────────────────────────────────────── */}
      <section className="py-16 max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: "#2D6A4F" }}>Location</p>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "clamp(24px, 2.5vw, 32px)", letterSpacing: "-0.02em" }}>
              Connected to everything,<br />removed from the noise
            </h2>
            <p className="text-stone-500 mt-3 text-sm leading-relaxed">
              Off TX-45 and Parmer Lane, Willowbrook sits in the fast-growing Cedar Park corridor — near top employers, excellent schools, and Austin&apos;s best recreation, yet far enough to feel like a retreat.
            </p>
            <div className="mt-6 space-y-0">
              {[
                { place: "H-E-B Grocery",                dist: "5 min"  },
                { place: "Cedar Park Regional Medical",   dist: "9 min"  },
                { place: "Apple Campus (NW Austin)",      dist: "14 min" },
                { place: "Domain Northside",             dist: "18 min" },
                { place: "Downtown Austin",              dist: "22 min" },
                { place: "Austin–Bergstrom Airport",     dist: "40 min" },
              ].map(r => (
                <div key={r.place} className="flex items-center justify-between py-2.5 border-b border-stone-100">
                  <span className="text-sm text-stone-600">{r.place}</span>
                  <span className="text-sm font-semibold text-stone-800">{r.dist}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Map illustration */}
          <div className="rounded-2xl overflow-hidden border border-stone-200 shadow-md" style={{ height: 360 }}>
            <div className="w-full h-full relative flex items-center justify-center" style={{ background: "linear-gradient(150deg, #B7E4C7 0%, #74C69D 40%, #52B788 100%)" }}>
              <div className="absolute inset-0 opacity-15" style={{
                backgroundImage: "linear-gradient(rgba(0,0,0,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.3) 1px, transparent 1px)",
                backgroundSize: "36px 36px",
              }} />
              {/* Roads */}
              <div className="absolute" style={{ top: "44%", left: 0, right: 0, height: 12, background: "rgba(255,255,255,0.65)", borderTop: "1px solid rgba(255,255,255,0.9)", borderBottom: "1px solid rgba(255,255,255,0.9)" }} />
              <div className="absolute" style={{ top: 0, bottom: 0, left: "52%", width: 12, background: "rgba(255,255,255,0.65)", borderLeft: "1px solid rgba(255,255,255,0.9)", borderRight: "1px solid rgba(255,255,255,0.9)" }} />
              <div className="relative z-10 flex flex-col items-center">
                <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-xl border-2 border-white" style={{ background: "#1B4332" }}>
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                  </svg>
                </div>
                <div className="mt-2 px-3 py-1.5 rounded-full bg-white shadow-lg text-xs font-bold text-stone-800">Willowbrook</div>
                <div className="mt-1 text-xs text-white/80 font-medium">Cedar Park, TX 78613</div>
              </div>
              <p className="absolute bottom-3 right-4 text-[10px] text-white/50 font-medium">~20 min from Downtown Austin</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Contact ─────────────────────────────────────────────────────────── */}
      <section id="contact" className="py-16 border-t border-stone-200" style={{ background: "#1B4332" }}>
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-[11px] font-bold uppercase tracking-widest mb-2 text-white/50">Get Started Today</p>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "clamp(26px, 3vw, 38px)", letterSpacing: "-0.02em", color: "white" }}>
              Request information
            </h2>
            <p className="text-white/55 text-sm mt-2">Our sales team will contact you within one business day.</p>
          </div>

          {submitted ? (
            <div className="text-center py-14">
              <div className="w-16 h-16 rounded-full border border-white/20 flex items-center justify-center mx-auto mb-5" style={{ background: "rgba(255,255,255,0.1)" }}>
                <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Thanks — we&apos;ll be in touch!</h3>
              <p className="text-white/55 text-sm">While you wait, explore the interactive site map or configure your dream home.</p>
              <div className="flex flex-col sm:flex-row justify-center gap-3 mt-6">
                <a href="#sitemap" className="px-5 py-2.5 rounded-xl text-sm font-semibold text-[#1B4332] bg-white hover:brightness-105 transition-all">Explore Site Map</a>
                <a href={CONFIGURATOR_URL} target="_blank" className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white border border-white/25 hover:bg-white/10 transition-all">Configure The Cypress</a>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="rounded-2xl border border-white/15 p-6 space-y-4" style={{ background: "rgba(255,255,255,0.07)", backdropFilter: "blur(12px)" }}>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-white/50 mb-1.5">Full Name *</label>
                  <input type="text" required placeholder="Jane Smith"
                    value={formData.name} onChange={e => setFormData(d => ({ ...d, name: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm text-white bg-white/10 border border-white/15 placeholder-white/25 focus:outline-none focus:border-white/40 transition-colors" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-white/50 mb-1.5">Email *</label>
                  <input type="email" required placeholder="jane@example.com"
                    value={formData.email} onChange={e => setFormData(d => ({ ...d, email: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm text-white bg-white/10 border border-white/15 placeholder-white/25 focus:outline-none focus:border-white/40 transition-colors" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-white/50 mb-1.5">Phone</label>
                  <input type="tel" placeholder="(512) 555-0000"
                    value={formData.phone} onChange={e => setFormData(d => ({ ...d, phone: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm text-white bg-white/10 border border-white/15 placeholder-white/25 focus:outline-none focus:border-white/40 transition-colors" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-white/50 mb-1.5">Lot Interest</label>
                  <input type="text" placeholder="e.g. Lot 314, corner lots…"
                    value={formData.interest} onChange={e => setFormData(d => ({ ...d, interest: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl text-sm text-white bg-white/10 border border-white/15 placeholder-white/25 focus:outline-none focus:border-white/40 transition-colors" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-white/50 mb-1.5">Message</label>
                <textarea rows={3} placeholder="Timeline, questions, specific lots you've had your eye on…"
                  value={formData.message} onChange={e => setFormData(d => ({ ...d, message: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm text-white bg-white/10 border border-white/15 placeholder-white/25 focus:outline-none focus:border-white/40 transition-colors resize-none" />
              </div>
              <button type="submit"
                className="w-full py-3 rounded-xl text-sm font-bold transition-all hover:brightness-105 shadow-lg"
                style={{ background: "white", color: "#1B4332" }}>
                Send Request
              </button>
              <p className="text-center text-[11px] text-white/30">No spam. Unsubscribe at any time. TREC #789456.</p>
            </form>
          )}
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="bg-stone-900 py-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={BUILDER_LOGO} alt="Pro Home Builders" className="h-7 object-contain brightness-0 invert" style={{ maxWidth: 140 }} />
            <p className="text-[11px] text-stone-500">5800 Balcones Dr · Austin, TX 78731 · TREC #789456</p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <p className="text-[11px] text-stone-500 text-center">© 2025 Pro Home Builders · All rights reserved</p>
            <p className="text-[10px] text-stone-600 flex items-center gap-1">
              Interactive site map &amp; 3D configurator powered by
              <a href="/" target="_blank" className="font-semibold text-stone-400 hover:text-stone-300 ml-1 transition-colors">ProPlan Studio</a>
            </p>
          </div>
          <div className="flex items-center gap-5 text-sm text-stone-500">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="tel:+15125550147" className="hover:text-white transition-colors">(512) 555-0147</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
