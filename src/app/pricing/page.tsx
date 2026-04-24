"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Nav from "@/components/landing/Nav";
import CalendlyButton from "@/components/CalendlyButton";
import { fetchActivePlans, buildPlanFeatures, fmtUSD } from "@/lib/plans";
import { Plan } from "@/types/database";

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
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

export default function PricingPage() {
  const [billing, setBilling] = useState<"monthly" | "annually">("monthly");
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    fetchActivePlans().then(p => setPlans(p));
  }, []);

  const setupFee = plans[0]?.model_setup_fee ?? 100000;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <Nav />

      {/* Hero */}
      <section className="text-center pt-36 pb-14 px-6 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400 font-medium mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          3D Configurator + Site Maps + AI Renders + Lead Capture
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-5 leading-tight" style={{ fontFamily: "var(--font-syne), sans-serif" }}>
          Simple pricing.{" "}
          <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
            No surprises.
          </span>
        </h1>
        <p className="text-lg text-white/50 max-w-xl mx-auto mb-10">
          Start with one model. Scale as you add communities and floor plans. One-time setup fee per model, flat monthly subscription.
        </p>

        {/* Billing toggle */}
        <div className="inline-flex items-center bg-white/5 border border-white/10 rounded-xl p-1 gap-1">
          <button
            onClick={() => setBilling("monthly")}
            className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              billing === "monthly" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling("annually")}
            className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2.5 ${
              billing === "annually" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
            }`}
          >
            Yearly
            {plans[0] && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Save {fmtUSD(plans[0].price_monthly * 12 - plans[0].price_annually)}
              </span>
            )}
          </button>
        </div>
      </section>

      {/* Plan cards */}
      <section className="max-w-6xl mx-auto px-6 pb-6">
        <div className={`grid gap-6 ${
          plans.length >= 3 ? "md:grid-cols-3" :
          plans.length === 2 ? "md:grid-cols-2 max-w-3xl mx-auto" :
          "max-w-sm mx-auto"
        }`}>
          {plans.map((plan, i) => {
            const isPopular     = plans.length >= 2 && i === plans.length - 1;
            const perMonth      = billing === "annually" ? Math.round(plan.price_annually / 12) : plan.price_monthly;
            const annualSavings = plan.price_monthly * 12 - plan.price_annually;

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl p-7 flex flex-col ${
                  isPopular
                    ? "bg-blue-600/10 border-2 border-blue-500/60 shadow-xl shadow-blue-500/10"
                    : "bg-[#141414] border border-white/10"
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

                <div className="mb-1">
                  {billing === "annually" ? (
                    <div className="flex items-end gap-2">
                      <span className="text-5xl font-bold text-white" style={{ fontFamily: "var(--font-syne), sans-serif" }}>{fmtUSD(perMonth)}</span>
                      <div className="mb-1">
                        <span className="text-white/40 text-sm">/mo</span>
                        <span className="text-white/30 text-sm ml-1.5 line-through">{fmtUSD(plan.price_monthly)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-end gap-1">
                      <span className="text-5xl font-bold text-white" style={{ fontFamily: "var(--font-syne), sans-serif" }}>{fmtUSD(perMonth)}</span>
                      <span className="text-white/40 text-sm mb-1">/mo</span>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-white/30 mb-6">
                  {billing === "annually"
                    ? `Billed ${fmtUSD(plan.price_annually)}/yr · Save ${fmtUSD(annualSavings)}`
                    : "Billed monthly · Cancel anytime"}
                </p>

                {/* Quick stats */}
                <div className="grid grid-cols-3 gap-2 mb-6 bg-white/5 rounded-xl p-3">
                  <div className="text-center">
                    <p className="text-lg font-bold text-white">{plan.max_projects === -1 ? "∞" : plan.max_projects}</p>
                    <p className="text-[9px] text-white/30 mt-0.5">Models</p>
                  </div>
                  <div className="text-center border-x border-white/8">
                    <p className="text-lg font-bold text-white">
                      {plan.rendering_credits_monthly === -1 ? "∞" : (plan.rendering_credits_monthly === 0 ? "—" : plan.rendering_credits_monthly)}
                    </p>
                    <p className="text-[9px] text-white/30 mt-0.5">Renders/mo</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-white">{plan.ai_credits_monthly.toLocaleString()}</p>
                    <p className="text-[9px] text-white/30 mt-0.5">AI Credits</p>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-2.5 mb-8 flex-1">
                  {buildPlanFeatures(plan).map(f => (
                    <li key={f} className="flex items-start gap-2.5">
                      <CheckIcon />
                      <span className="text-sm text-white/65 leading-relaxed">{f}</span>
                    </li>
                  ))}
                </ul>

                <CalendlyButton
                  className={`w-full py-3.5 rounded-xl text-sm font-semibold transition-colors ${
                    isPopular
                      ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25"
                      : "bg-white/8 hover:bg-white/14 border border-white/10 text-white"
                  }`}
                >
                  Schedule a Demo
                </CalendlyButton>

                <p className="text-center text-[10px] text-white/25 mt-3">
                  + {fmtUSD(setupFee)} one-time setup per model
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Setup fee — full-width strip */}
      <section className="max-w-6xl mx-auto px-6 pb-12">
        <div className="bg-[#141414] border border-white/10 rounded-2xl p-7 grid md:grid-cols-[1fr_1fr_auto] gap-x-10 gap-y-6 items-start">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3">Per-Model Setup Fee</p>
            <div className="flex items-end gap-1 mb-2">
              <span className="text-3xl font-bold text-white" style={{ fontFamily: "var(--font-syne), sans-serif" }}>{fmtUSD(setupFee)}</span>
              <span className="text-white/40 text-sm mb-1">/ model</span>
            </div>
            <p className="text-xs text-white/40 leading-relaxed mb-4">
              One-time fee per 3D configurator model. Covers full production from geometry to live deployment.
            </p>
            <ul className="space-y-2">
              {[
                "3D model build & optimization",
                "Interior + exterior + option phases",
                "Category & pricing rules wired",
                "Tested and deployed live",
                "Revisions until you approve",
              ].map(item => (
                <li key={item} className="flex items-start gap-2">
                  <CheckIcon />
                  <span className="text-xs text-white/50">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold text-white/60 mb-4">How it works</p>
            <ol className="space-y-3">
              {[
                "Schedule a 30-min demo",
                "Pick your plan & pay setup fee",
                "We build — you review and approve",
                "Go live. Leads start coming in.",
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
          </div>
        </div>
      </section>

      {/* Value callout */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <div className="bg-gradient-to-br from-blue-600/10 to-violet-600/10 border border-white/10 rounded-2xl p-10 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Why bundle everything into one subscription?</h2>
          <p className="text-sm text-white/50 max-w-xl mx-auto mb-8 leading-relaxed">
            External studios charge $800–$2,000 per image. With ProPlan Studio, your configurator, AI renders, site maps, and lead capture are all managed by the same team — at a fraction of the cost.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8 text-center">
            {[
              { label: "Avg market rate / render", value: "$800",    sub: "From external studios" },
              { label: "Freelance configurator",   value: "$15k+",   sub: "One-time build, no CRM" },
              { label: "ProPlan Studio",
                value: plans[0] ? fmtUSD(plans[0].price_monthly) : "$750",
                sub: "/month — everything included" },
            ].map(stat => (
              <div key={stat.label}>
                <p className="text-3xl font-bold text-white">{stat.value}</p>
                <p className="text-xs text-white/50 mt-1">{stat.label}</p>
                <p className="text-[10px] text-white/30 mt-0.5">{stat.sub}</p>
              </div>
            ))}
          </div>
          <CalendlyButton className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-colors">
            Schedule a Demo
          </CalendlyButton>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/8 py-8 text-center text-xs text-white/25 px-6">
        <p>© {new Date().getFullYear()} ProPlan Studio. All rights reserved.</p>
        <p className="mt-1">Prices in USD. Taxes may apply depending on your jurisdiction.</p>
        <p className="mt-2">
          <Link href="/auth/login" className="text-white/30 hover:text-white/60 transition-colors">Sign in</Link>
          {" · "}
          <Link href="/terms" className="text-white/30 hover:text-white/60 transition-colors">Terms</Link>
          {" · "}
          <Link href="/privacy" className="text-white/30 hover:text-white/60 transition-colors">Privacy</Link>
        </p>
      </footer>
    </div>
  );
}
