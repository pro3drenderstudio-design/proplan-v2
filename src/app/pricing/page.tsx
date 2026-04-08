"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Nav from "@/components/landing/Nav";
import { fetchActivePlan, buildPlanFeatures, fmtUSD } from "@/lib/plans";
import { Plan } from "@/types/database";

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

export default function PricingPage() {
  const [billing, setBilling] = useState<"monthly" | "annually">("monthly");
  const [plan, setPlan] = useState<Plan | null>(null);

  useEffect(() => {
    fetchActivePlan().then(p => setPlan(p));
  }, []);

  // Fall back to known defaults while loading so the page doesn't flash blank
  const monthlyPrice    = plan?.price_monthly  ?? 150000;
  const annualTotal     = plan?.price_annually  ?? 1650000;
  const annualPerMonth  = Math.round(annualTotal / 12);
  const annualSavings   = monthlyPrice * 12 - annualTotal;

  const displayPrice = billing === "annually" ? annualPerMonth : monthlyPrice;
  const displaySub   = billing === "annually"
    ? `Billed ${fmtUSD(annualTotal)}/yr · Cancel anytime`
    : "Billed monthly · Cancel anytime";

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <Nav />

      {/* Hero */}
      <section className="text-center pt-36 pb-14 px-6 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400 font-medium mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          Rendering + Configurators + Leads — All in one
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-5 leading-tight">
          One plan. <br />
          <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
            Everything included.
          </span>
        </h1>
        <p className="text-lg text-white/50 max-w-xl mx-auto mb-10">
          Interactive 3D configurators, professional renderings, AI concept images, and site maps — one subscription, no surprises.
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
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Save {fmtUSD(annualSavings)}
            </span>
          </button>
        </div>
      </section>

      {/* Plan card + Setup fee */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-start">

          {/* Main plan card */}
          <div className="md:col-span-3 bg-blue-600/10 border-2 border-blue-500/60 rounded-2xl p-8 shadow-xl shadow-blue-500/10">
            <div className="mb-2">
              <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-blue-500 text-white tracking-wider uppercase">
                {plan?.display_name ?? "ProPlan Studio"}
              </span>
            </div>
            <p className="text-sm text-white/45 mt-3 mb-6 leading-relaxed">
              Everything you need to run a professional 3D configurator operation.
            </p>

            <div className="mb-6">
              {billing === "annually" ? (
                <>
                  <div className="flex items-end gap-2">
                    <span className="text-5xl font-bold text-white">{fmtUSD(annualPerMonth)}</span>
                    <span className="text-white/40 text-sm mb-2">/mo</span>
                    <span className="text-white/30 text-base mb-2 line-through">{fmtUSD(monthlyPrice)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-[11px] text-white/30">{displaySub}</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                      1 month free
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-end gap-1">
                    <span className="text-5xl font-bold text-white">{fmtUSD(displayPrice)}</span>
                    <span className="text-white/40 text-sm mb-2">/mo</span>
                  </div>
                  <p className="text-[11px] text-white/30 mt-1">{displaySub}</p>
                </>
              )}
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-2 mb-7 bg-white/5 rounded-xl p-4">
              <div className="text-center">
                <p className="text-xl font-bold text-white">{plan?.max_projects === -1 ? "∞" : (plan?.max_projects ?? "∞")}</p>
                <p className="text-[9px] text-white/30 mt-0.5">Models</p>
              </div>
              <div className="text-center border-x border-white/8">
                <p className="text-xl font-bold text-white">{plan?.rendering_credits_monthly === -1 ? "∞" : (plan?.rendering_credits_monthly ?? "∞")}</p>
                <p className="text-[9px] text-white/30 mt-0.5">Renders</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-white">{(plan?.ai_credits_monthly ?? 250).toLocaleString()}</p>
                <p className="text-[9px] text-white/30 mt-0.5">AI Credits</p>
              </div>
            </div>

            {/* Features */}
            <ul className="space-y-3 mb-8">
              {(plan ? buildPlanFeatures(plan) : [
                "Unlimited home model configurators",
                "Unlimited traditional 3D renders / mo",
                "250 AI concept renders / mo",
                "Unlimited interactive site maps",
                "Lead CRM + analytics + exports",
                "Brand customization (logo + colors)",
                "Priority support",
              ]).map(f => (
                <li key={f} className="flex items-start gap-2.5">
                  <CheckIcon />
                  <span className="text-sm text-white/65 leading-relaxed">{f}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/auth/signup"
              className="w-full py-3.5 rounded-xl text-sm font-semibold text-center bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25 transition-colors block"
            >
              {billing === "annually"
                ? `Get started — ${fmtUSD(annualTotal)}/yr`
                : `Get started — ${fmtUSD(monthlyPrice)}/mo`}
            </Link>
          </div>

          {/* Setup fee callout */}
          <div className="md:col-span-2 space-y-4">
            <div className="bg-[#141414] border border-white/10 rounded-2xl p-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-4">Per-Model Setup Fee</p>
              <div className="flex items-end gap-1 mb-2">
                <span className="text-3xl font-bold text-white">{fmtUSD(plan?.model_setup_fee ?? 100000)}</span>
                <span className="text-white/40 text-sm mb-1">/ model</span>
              </div>
              <p className="text-xs text-white/40 leading-relaxed mb-5">
                One-time fee per 3D configurator model. Covers 3D modeling, Sketchfab setup, node mapping, and going live.
              </p>
              <ul className="space-y-2">
                {[
                  "3D model build & optimization",
                  "Sketchfab scene setup",
                  "Node mapping & phase config",
                  "Category & option wiring",
                  "Live deployment",
                ].map(item => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckIcon />
                    <span className="text-xs text-white/50">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-[#141414] border border-white/10 rounded-2xl p-5">
              <p className="text-xs font-semibold text-white/60 mb-1">How it works</p>
              <ol className="space-y-2">
                {[
                  billing === "annually"
                    ? `Subscribe for ${fmtUSD(annualTotal)}/yr`
                    : `Subscribe for ${fmtUSD(monthlyPrice)}/mo`,
                  "Request a new model setup",
                  `Pay ${fmtUSD(plan?.model_setup_fee ?? 100000)} setup fee per model`,
                  "We build and launch it — you own it",
                ].map((step, i) => (
                  <li key={step} className="flex items-start gap-2.5 text-xs text-white/40">
                    <span className="w-4 h-4 rounded-full bg-white/8 text-white/40 text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            {billing === "annually" && (
              <div className="bg-emerald-500/6 border border-emerald-500/20 rounded-2xl p-4 text-center">
                <p className="text-xs text-white/40 mb-1">Annual savings</p>
                <p className="text-2xl font-bold text-emerald-400">{fmtUSD(annualSavings)}/yr</p>
                <p className="text-[10px] text-white/30 mt-0.5">Compared to monthly billing</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Value callout */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <div className="bg-gradient-to-br from-blue-600/10 to-violet-600/10 border border-white/10 rounded-2xl p-10 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Why bundle everything into one subscription?</h2>
          <p className="text-sm text-white/50 max-w-xl mx-auto mb-8 leading-relaxed">
            Traditional rendering studios charge $500–2,000 per image. Marketing agencies add another layer.
            With ProPlan Studio, your renders, configurator, AI concepts, leads, and site maps are managed
            by the same team who built the 3D model — at a fraction of the cost.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8 text-center sm:text-left">
            {[
              { label: "Avg market rate / render", value: "$800",     sub: "From external studios" },
              { label: "Monthly renders included",  value: "∞",       sub: "Unlimited traditional renders" },
              { label: "Your monthly cost",
                value: billing === "annually" ? fmtUSD(annualPerMonth) : fmtUSD(monthlyPrice),
                sub:   billing === "annually" ? "Billed annually" : "Everything included" },
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
            Get started
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
