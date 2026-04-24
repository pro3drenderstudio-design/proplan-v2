"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getAllPlans } from "@/lib/builder-api";
import { Plan } from "@/types/database";
import { supabase } from "@/lib/supabase";
import { buildPlanFeatures } from "@/lib/plans";

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

function SubscribeContent() {
  const params   = useSearchParams();
  const canceled = params.get("canceled") === "1";

  const [plans,       setPlans]      = useState<Plan[]>([]);
  const [loading,     setLoading]    = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [submitting,  setSubmitting] = useState<string | null>(null); // plan id being submitted
  const [builderId,   setBuilderId]  = useState<string | null>(null);
  const [error,       setError]      = useState<string | null>(null);
  const [billing,     setBilling]    = useState<"monthly" | "annually">("monthly");

  useEffect(() => {
    getAllPlans().then(p => { setPlans(p); setLoading(false); });

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setAuthLoading(false); return; }

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: profile } = await (supabase.from("profiles") as any)
          .select("builder_id").eq("id", user.id).single();

        let resolvedId: string | null = profile?.builder_id ?? null;

        if (!resolvedId && user.email) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: builder } = await (supabase.from("builders") as any)
            .select("id").eq("contact_email", user.email).maybeSingle();
          if (builder?.id) {
            resolvedId = builder.id;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from("profiles") as any)
              .update({ builder_id: resolvedId }).eq("id", user.id);
          }
        }

        if (!resolvedId) { setAuthLoading(false); return; }
        setBuilderId(resolvedId);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: builder } = await (supabase.from("builders") as any)
          .select("stripe_subscription_status").eq("id", resolvedId).single();
        if (builder?.stripe_subscription_status === "active") {
          window.location.href = "/builder/dashboard";
          return;
        }
      } catch { /* auth lookup failed */ }

      setAuthLoading(false);
    });
  }, []);

  async function handleSubscribe(plan: Plan) {
    if (!builderId) { setError("Unable to identify your account. Please refresh."); return; }
    const priceId = billing === "annually" ? plan.stripe_price_id_annually : plan.stripe_price_id_monthly;
    if (!priceId) {
      setError(`${plan.display_name}: this billing cycle is not yet configured. Please contact us.`);
      return;
    }

    setSubmitting(plan.id);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ builderId, planId: plan.id, billingCycle: billing }),
      });
      const { url, error: apiError } = await res.json();
      if (apiError || !url) { setError(apiError ?? "Failed to start checkout."); setSubmitting(null); return; }
      window.location.href = url;
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(null);
    }
  }

  // Identify the "most popular" plan — middle plan, or first if only one
  const popularIndex = plans.length > 1 ? Math.floor(plans.length / 2) : 0;

  return (
    <div className="min-h-screen bg-[#080808] text-white">

      {/* Header */}
      <div className="text-center pt-16 pb-10 px-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo_light.png" alt="ProPlan Studio" className="h-8 object-contain mx-auto mb-8" />
        <h1 className="text-3xl font-extrabold text-white mb-3">Choose your plan</h1>
        <p className="text-white/40 text-sm max-w-md mx-auto">
          Everything your team needs to capture and close buyers — cancel anytime.
        </p>

        {canceled && (
          <div className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
            Checkout was canceled. No charge was made.
          </div>
        )}
      </div>

      {/* Billing toggle */}
      <div className="flex justify-center mb-10 px-6">
        <div className="inline-flex items-center bg-white/5 border border-white/10 rounded-xl p-1 gap-1">
          <button
            onClick={() => setBilling("monthly")}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
              billing === "monthly" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBilling("annually")}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${
              billing === "annually" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
            }`}
          >
            Yearly
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Save 1 mo
            </span>
          </button>
        </div>
      </div>

      {/* Plan cards */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-24">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map(i => <div key={i} className="h-[520px] bg-white/5 rounded-2xl animate-pulse" />)}
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center py-16 text-white/30 text-sm">
            No plans available. Please contact us.
          </div>
        ) : (
          <div className={`grid grid-cols-1 gap-5 ${
            plans.length === 1 ? "sm:max-w-md sm:mx-auto" :
            plans.length === 2 ? "sm:grid-cols-2 max-w-2xl mx-auto" :
            "sm:grid-cols-2 lg:grid-cols-3"
          }`}>
            {plans.map((plan, i) => {
              const isPopular       = i === popularIndex && plans.length > 1;
              const monthlyPrice    = plan.price_monthly;
              const annualPrice     = plan.price_annually;
              const annualPerMonth  = Math.round(annualPrice / 12);
              const annualSavings   = monthlyPrice * 12 - annualPrice;
              const features        = buildPlanFeatures(plan);
              const isSubmitting    = submitting === plan.id;
              const btnDisabled     = isSubmitting || authLoading || !builderId;

              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col rounded-2xl overflow-hidden transition-shadow ${
                    isPopular
                      ? "bg-blue-600/10 border-2 border-blue-500/60 shadow-xl shadow-blue-500/10"
                      : "bg-white/4 border border-white/10"
                  }`}
                >
                  {/* Popular badge */}
                  {isPopular && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                      <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-blue-500 text-white tracking-wider uppercase shadow-lg shadow-blue-500/30">
                        Most Popular
                      </span>
                    </div>
                  )}

                  <div className="p-6 flex flex-col flex-1">
                    {/* Plan name */}
                    <div className="mb-4">
                      <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${isPopular ? "text-blue-400" : "text-white/40"}`}>
                        {plan.display_name}
                      </p>
                    </div>

                    {/* Price */}
                    <div className="mb-5">
                      {billing === "annually" ? (
                        <>
                          <div className="flex items-end gap-1.5">
                            <span className="text-4xl font-extrabold text-white">{fmtPrice(annualPerMonth)}</span>
                            <span className="text-white/30 text-sm mb-1.5">/mo</span>
                            <span className="text-white/25 text-sm mb-1.5 line-through">{fmtPrice(monthlyPrice)}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1.5">
                            <p className="text-[11px] text-white/25">Billed {fmtPrice(annualPrice)}/yr</p>
                            {annualSavings > 0 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                                Save {fmtPrice(annualSavings)}/yr
                              </span>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-end gap-1">
                            <span className="text-4xl font-extrabold text-white">{fmtPrice(monthlyPrice)}</span>
                            <span className="text-white/30 text-sm mb-1.5">/mo</span>
                          </div>
                          <p className="text-[11px] text-white/25 mt-1">Billed monthly · Cancel anytime</p>
                        </>
                      )}
                    </div>

                    {/* Quick stats */}
                    <div className="grid grid-cols-3 gap-1.5 mb-5 bg-white/5 rounded-xl p-3">
                      <div className="text-center">
                        <p className="text-sm font-bold text-white">
                          {plan.max_projects === -1 ? "∞" : plan.max_projects}
                        </p>
                        <p className="text-[9px] text-white/30 mt-0.5">Models</p>
                      </div>
                      <div className="text-center border-x border-white/8">
                        <p className="text-sm font-bold text-white">
                          {plan.rendering_credits_monthly === -1 ? "∞" : plan.rendering_credits_monthly}
                        </p>
                        <p className="text-[9px] text-white/30 mt-0.5">Renders</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-white">
                          {plan.ai_credits_monthly.toLocaleString()}
                        </p>
                        <p className="text-[9px] text-white/30 mt-0.5">AI Credits</p>
                      </div>
                    </div>

                    {/* Features */}
                    <ul className="space-y-2 mb-5 flex-1">
                      {features.map(f => (
                        <li key={f} className="flex items-start gap-2">
                          <CheckIcon />
                          <span className="text-xs text-white/50 leading-relaxed">{f}</span>
                        </li>
                      ))}
                    </ul>

                    {/* Setup fee */}
                    {plan.model_setup_fee > 0 && (
                      <div className="bg-white/4 border border-white/8 rounded-xl px-3 py-2.5 mb-5">
                        <p className="text-[11px] text-white/40 leading-relaxed">
                          <span className="text-white/65 font-semibold">+{fmtPrice(plan.model_setup_fee)} setup fee</span>{" "}
                          per model — charged separately when you request a new model setup.
                        </p>
                      </div>
                    )}

                    {/* CTA */}
                    {error && submitting === null && (
                      <p className="text-red-400 text-xs mb-3 text-center">{error}</p>
                    )}

                    {!authLoading && !builderId ? (
                      <div className="w-full py-3 rounded-xl text-sm text-center bg-white/5 border border-white/10 text-white/35">
                        Contact support to activate
                      </div>
                    ) : (
                      <button
                        onClick={() => handleSubscribe(plan)}
                        disabled={btnDisabled}
                        className={`w-full py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          isPopular
                            ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25"
                            : "bg-white/10 hover:bg-white/15 text-white border border-white/10"
                        }`}
                      >
                        {authLoading
                          ? "Loading…"
                          : isSubmitting
                            ? "Redirecting…"
                            : billing === "annually"
                              ? `Subscribe — ${fmtPrice(annualPrice)}/yr`
                              : `Subscribe — ${fmtPrice(monthlyPrice)}/mo`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {error && submitting === null && plans.length > 0 && (
          <p className="text-center text-red-400 text-sm mt-6">{error}</p>
        )}

        <p className="text-center text-[10px] text-white/20 mt-8">
          Secure checkout via Stripe · Subscription fees do not include per-model setup fees
        </p>
      </div>
    </div>
  );
}

export default function SubscribePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SubscribeContent />
    </Suspense>
  );
}
