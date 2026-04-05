"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getAllPlans } from "@/lib/builder-api";
import { Plan } from "@/types/database";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function fmtPrice(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function CheckIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

const PLAN_HIGHLIGHT: Record<string, boolean> = { studio: true };

const PLAN_FEATURES: Record<string, string[]> = {
  launch: [
    "2 active home model configurators",
    "15 traditional 3D renders / mo",
    "150 AI concept renders / mo",
    "Lead CRM + contact management",
    "Basic analytics dashboard",
    "Email support",
  ],
  studio: [
    "5 active home model configurators",
    "50 traditional 3D renders / mo",
    "400 AI concept renders / mo",
    "Lead CRM + analytics + exports",
    "1 interactive site map",
    "Priority support",
    "Brand customization (logo + colors)",
  ],
  scale: [
    "Unlimited home model configurators",
    "Unlimited traditional 3D renders*",
    "1,000 AI concept renders / mo",
    "Full analytics suite + API access",
    "Unlimited interactive site maps",
    "Dedicated Customer Success Manager",
    "White-label configurator URL",
    "SLA-backed support",
  ],
};

function SubscribeContent() {
  const params  = useSearchParams();
  const canceled = params.get("canceled") === "1";

  const [plans,        setPlans]        = useState<Plan[]>([]);
  const [billing,      setBilling]      = useState<"monthly" | "annually">("monthly");
  const [loading,      setLoading]      = useState(true);
  const [loadingPlan,  setLoadingPlan]  = useState<string | null>(null);
  const [builderId,    setBuilderId]    = useState<string | null>(null);
  const [error,        setError]        = useState<string | null>(null);

  useEffect(() => {
    getAllPlans().then(p => { setPlans(p); setLoading(false); });

    // Get current builder ID
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (supabase.from("profiles") as any)
        .select("builder_id").eq("id", user.id).single();
      if (profile?.builder_id) setBuilderId(profile.builder_id);
    });
  }, []);

  async function handleSelect(plan: Plan) {
    if (!builderId) { setError("Unable to identify your account. Please refresh."); return; }

    const priceId = billing === "annually" ? plan.stripe_price_id_annually : plan.stripe_price_id_monthly;
    if (!priceId) {
      setError(`Stripe is not yet configured for the ${plan.display_name} plan. Please contact us.`);
      return;
    }

    setLoadingPlan(plan.id);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ builderId, planId: plan.id, billingCycle: billing }),
      });
      const { url, error: apiError } = await res.json();
      if (apiError || !url) { setError(apiError ?? "Failed to start checkout."); setLoadingPlan(null); return; }
      window.location.href = url;
    } catch {
      setError("Something went wrong. Please try again.");
      setLoadingPlan(null);
    }
  }

  const annualSaving = "Save 17%";

  return (
    <div className="min-h-screen bg-[#080808] text-white">

      {/* Header */}
      <div className="text-center pt-16 pb-10 px-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo_light.png" alt="ProPlan Studio" className="h-8 object-contain mx-auto mb-8" />
        <h1 className="text-3xl font-extrabold text-white mb-3">Choose your plan</h1>
        <p className="text-white/40 text-sm max-w-md mx-auto">
          Professional 3D renderings, configurators, and lead capture — all in one subscription.
        </p>

        {canceled && (
          <div className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
            Checkout was canceled. No charge was made.
          </div>
        )}

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3 mt-8">
          <button onClick={() => setBilling("monthly")}
            className={`text-sm font-medium transition-colors ${billing === "monthly" ? "text-white" : "text-white/30"}`}>
            Monthly
          </button>
          <button
            onClick={() => setBilling(b => b === "monthly" ? "annually" : "monthly")}
            className="relative w-11 h-6 rounded-full bg-blue-600 transition-colors"
          >
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${billing === "annually" ? "translate-x-6" : "translate-x-1"}`} />
          </button>
          <button onClick={() => setBilling("annually")}
            className={`text-sm font-medium transition-colors ${billing === "annually" ? "text-white" : "text-white/30"}`}>
            Annual
            <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 font-semibold">
              {annualSaving}
            </span>
          </button>
        </div>
      </div>

      {/* Plan cards */}
      <div className="max-w-5xl mx-auto px-6 pb-20">
        {loading ? (
          <div className="grid grid-cols-3 gap-5">
            {[1,2,3].map(i => <div key={i} className="h-96 bg-white/5 rounded-2xl animate-pulse" />)}
          </div>
        ) : error ? (
          <div className="text-center py-10">
            <p className="text-red-400 text-sm">{error}</p>
            <button onClick={() => setError(null)} className="mt-3 text-blue-400 text-xs">Try again</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {plans.map(plan => {
              const highlight  = !!PLAN_HIGHLIGHT[plan.name];
              const price      = billing === "annually" ? Math.round(plan.price_annually / 12) : plan.price_monthly;
              const isLoading  = loadingPlan === plan.id;
              const features   = PLAN_FEATURES[plan.name] ?? [];

              return (
                <div
                  key={plan.id}
                  className={`relative rounded-2xl p-6 flex flex-col ${
                    highlight
                      ? "bg-blue-600/10 border-2 border-blue-500/50 shadow-xl shadow-blue-500/10"
                      : "bg-[#141414] border border-white/10"
                  }`}
                >
                  {highlight && (
                    <div className="absolute -top-3 left-6 text-[10px] font-bold px-3 py-1 rounded-full bg-blue-500 text-white tracking-wider">
                      Most Popular
                    </div>
                  )}

                  <div className="mb-5">
                    <h2 className="text-base font-bold text-white mb-1">{plan.display_name}</h2>
                    <div className="flex items-end gap-1">
                      <span className="text-3xl font-extrabold text-white">{fmtPrice(price)}</span>
                      <span className="text-white/30 text-xs mb-1">/mo</span>
                    </div>
                    {billing === "annually" && (
                      <p className="text-[11px] text-white/30 mt-0.5">{fmtPrice(plan.price_annually)}/year billed annually</p>
                    )}
                  </div>

                  {/* Quick stats */}
                  <div className="grid grid-cols-3 gap-1.5 mb-5 bg-white/5 rounded-xl p-3">
                    <div className="text-center">
                      <p className="text-sm font-bold text-white">
                        {plan.max_projects === -1 ? "∞" : plan.max_projects}
                      </p>
                      <p className="text-[9px] text-white/25 mt-0.5">Models</p>
                    </div>
                    <div className="text-center border-x border-white/8">
                      <p className="text-sm font-bold text-white">
                        {plan.rendering_credits_monthly === -1 ? "∞" : plan.rendering_credits_monthly}
                      </p>
                      <p className="text-[9px] text-white/25 mt-0.5">Renders</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-white">
                        {plan.ai_credits_monthly.toLocaleString()}
                      </p>
                      <p className="text-[9px] text-white/25 mt-0.5">AI Credits</p>
                    </div>
                  </div>

                  <ul className="space-y-2 flex-1 mb-6">
                    {features.map(f => (
                      <li key={f} className="flex items-start gap-2">
                        <CheckIcon />
                        <span className="text-xs text-white/55 leading-relaxed">{f}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleSelect(plan)}
                    disabled={!!loadingPlan}
                    className={`w-full py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      highlight
                        ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25"
                        : "bg-white/10 hover:bg-white/15 text-white"
                    }`}
                  >
                    {isLoading ? "Redirecting to checkout…" : `Start with ${plan.display_name}`}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-[10px] text-white/20 mt-6">
          *Unlimited renders on Scale have a fair-use policy. · No setup fees. Cancel anytime.
        </p>
      </div>
    </div>
  );
}

export default function SubscribePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#080808] flex items-center justify-center"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <SubscribeContent />
    </Suspense>
  );
}
