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

// Features are built dynamically from the active plan via buildPlanFeatures()

function SubscribeContent() {
  const params   = useSearchParams();
  const canceled = params.get("canceled") === "1";

  const [plan,          setPlan]         = useState<Plan | null>(null);
  const [loading,       setLoading]      = useState(true);
  const [authLoading,   setAuthLoading]  = useState(true);
  const [submitting,    setSubmitting]   = useState(false);
  const [builderId,     setBuilderId]    = useState<string | null>(null);
  const [error,         setError]        = useState<string | null>(null);
  const [billing,       setBilling]      = useState<"monthly" | "annually">("monthly");

  useEffect(() => {
    getAllPlans().then(plans => {
      setPlan(plans[0] ?? null);
      setLoading(false);
    });

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setAuthLoading(false); return; }

      try {
        // Primary: look up builder_id via profiles
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: profile } = await (supabase.from("profiles") as any)
          .select("builder_id").eq("id", user.id).single();

        let resolvedId: string | null = profile?.builder_id ?? null;

        // Fallback: find builder by auth user email
        if (!resolvedId && user.email) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: builder } = await (supabase.from("builders") as any)
            .select("id").eq("contact_email", user.email).maybeSingle();
          if (builder?.id) {
            resolvedId = builder.id;
            // Heal the profile so next time the primary lookup works
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from("profiles") as any)
              .update({ builder_id: resolvedId }).eq("id", user.id);
          }
        }

        if (!resolvedId) { setAuthLoading(false); return; }
        setBuilderId(resolvedId);

        // If already subscribed, go straight to dashboard
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: builder } = await (supabase.from("builders") as any)
          .select("stripe_subscription_status").eq("id", resolvedId).single();
        if (builder?.stripe_subscription_status === "active") {
          window.location.href = "/builder/dashboard";
          return;
        }
      } catch {
        // auth lookup failed — button will show helpful message
      }

      setAuthLoading(false);
    });
  }, []);

  async function handleSubscribe() {
    if (!builderId || !plan) { setError("Unable to identify your account. Please refresh."); return; }
    const priceId = billing === "annually" ? plan.stripe_price_id_annually : plan.stripe_price_id_monthly;
    if (!priceId) {
      setError("This billing cycle is not yet configured. Please contact us.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ builderId, planId: plan.id, billingCycle: billing }),
      });
      const { url, error: apiError } = await res.json();
      if (apiError || !url) { setError(apiError ?? "Failed to start checkout."); setSubmitting(false); return; }
      window.location.href = url;
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  const monthlyPrice  = plan ? plan.price_monthly  : 150000;
  const annualPrice   = plan ? plan.price_annually  : 1650000;
  const annualPerMonth = Math.round(annualPrice / 12);
  const annualSavings  = monthlyPrice * 12 - annualPrice;

  return (
    <div className="min-h-screen bg-[#080808] text-white">

      {/* Header */}
      <div className="text-center pt-16 pb-12 px-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo_light.png" alt="ProPlan Studio" className="h-8 object-contain mx-auto mb-8" />
        <h1 className="text-3xl font-extrabold text-white mb-3">Start your subscription</h1>
        <p className="text-white/40 text-sm max-w-md mx-auto">
          {plan ? `${plan.display_name} — everything your team needs to capture and close buyers.` : "Everything your team needs to capture and close buyers."}
        </p>

        {canceled && (
          <div className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
            Checkout was canceled. No charge was made.
          </div>
        )}
      </div>

      {/* Billing toggle */}
      <div className="flex justify-center mb-8 px-6">
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
              1 mo free
            </span>
          </button>
        </div>
      </div>

      {/* Plan card */}
      <div className="max-w-lg mx-auto px-6 pb-20">
        {loading ? (
          <div className="h-96 bg-white/5 rounded-2xl animate-pulse" />
        ) : error && !plan ? (
          <div className="text-center py-10">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        ) : plan ? (
          <div className="bg-blue-600/10 border-2 border-blue-500/50 rounded-2xl p-8 shadow-xl shadow-blue-500/10">
            <div className="mb-1">
              <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-blue-500 text-white tracking-wider uppercase">
                {plan.display_name}
              </span>
            </div>
            <p className="text-xs text-white/35 mt-3 mb-6">Full platform access — cancel anytime.</p>

            <div className="mb-6">
              {billing === "annually" ? (
                <>
                  <div className="flex items-end gap-2">
                    <span className="text-4xl font-extrabold text-white">{fmtPrice(annualPerMonth)}</span>
                    <span className="text-white/30 text-sm mb-1.5">/mo</span>
                    <span className="text-white/30 text-sm mb-1.5 line-through">{fmtPrice(monthlyPrice)}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <p className="text-[11px] text-white/25">Billed {fmtPrice(annualPrice)}/yr</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                      Save {fmtPrice(annualSavings)}/yr
                    </span>
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
            <div className="grid grid-cols-3 gap-2 mb-7 bg-white/5 rounded-xl p-3">
              <div className="text-center">
                <p className="text-base font-bold text-white">
                  {plan.max_projects === -1 ? "∞" : plan.max_projects}
                </p>
                <p className="text-[9px] text-white/25 mt-0.5">Models</p>
              </div>
              <div className="text-center border-x border-white/8">
                <p className="text-base font-bold text-white">
                  {plan.rendering_credits_monthly === -1 ? "∞" : plan.rendering_credits_monthly}
                </p>
                <p className="text-[9px] text-white/25 mt-0.5">Renders</p>
              </div>
              <div className="text-center">
                <p className="text-base font-bold text-white">
                  {plan.ai_credits_monthly.toLocaleString()}
                </p>
                <p className="text-[9px] text-white/25 mt-0.5">AI Credits</p>
              </div>
            </div>

            <ul className="space-y-2.5 mb-8">
              {buildPlanFeatures(plan).map(f => (
                <li key={f} className="flex items-start gap-2">
                  <CheckIcon />
                  <span className="text-sm text-white/55 leading-relaxed">{f}</span>
                </li>
              ))}
            </ul>

            {/* Setup fee note */}
            <div className="bg-white/4 border border-white/8 rounded-xl px-4 py-3 mb-6">
              <p className="text-xs text-white/50 leading-relaxed">
                <span className="text-white/80 font-semibold">+{fmtPrice(plan.model_setup_fee ?? 100000)} setup fee</span> per model configurator — charged separately when you request a new model setup.
              </p>
            </div>

            {error && <p className="text-red-400 text-sm mb-4 text-center">{error}</p>}

            {!authLoading && !builderId ? (
              <div className="w-full py-3.5 rounded-xl text-sm text-center bg-white/5 border border-white/10 text-white/40">
                Account not linked — please contact support to activate your subscription.
              </div>
            ) : (
              <button
                onClick={handleSubscribe}
                disabled={submitting || authLoading || !builderId}
                className="w-full py-3.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-lg shadow-blue-500/25 transition-colors"
              >
                {authLoading
                  ? "Loading account…"
                  : submitting
                    ? "Redirecting to checkout…"
                    : billing === "annually"
                      ? `Subscribe — ${fmtPrice(annualPrice)} / yr`
                      : `Subscribe — ${fmtPrice(monthlyPrice)} / mo`}
              </button>
            )}
          </div>
        ) : (
          <div className="text-center py-10 text-white/30 text-sm">
            No plan available. Please contact us.
          </div>
        )}

        <p className="text-center text-[10px] text-white/20 mt-6">
          Secure checkout via Stripe · No setup fees for the subscription itself
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
