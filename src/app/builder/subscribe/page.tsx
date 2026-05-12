"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Addon, CrmType } from "@/types/database";

export const dynamic = "force-dynamic";

// ── helpers ──────────────────────────────────────────────────────────────────

function fmtPrice(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function annualMonthly(monthly: number) { return Math.round(monthly * 12 * 0.85 / 12); }
function annualTotal(monthly: number)   { return Math.round(monthly * 12 * 0.85); }
function annualSavings(monthly: number) { return Math.round(monthly * 12 * 0.15); }

// ── atoms ─────────────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function StepDot({ n, current }: { n: number; current: number }) {
  const done   = n < current;
  const active = n === current;
  return (
    <div className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold transition-all
      ${done   ? "bg-blue-600 border-blue-600 text-white" :
        active  ? "bg-white/10 border-blue-500 text-white" :
                  "bg-white/5  border-white/15 text-white/30"}`}>
      {done ? (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : n}
    </div>
  );
}

// ── addon inclusions copy ─────────────────────────────────────────────────────

const ADDON_DETAILS: Record<string, { icon: string; bullets: string[] }> = {
  "configurator": {
    icon: "🏠",
    bullets: [
      "Embed 3D home configurator on your site",
      "Buyers design their home live",
      "Categories, options & pricing rules",
      "$1,000 setup fee per model (billed separately)",
    ],
  },
  "ai-renders": {
    icon: "✨",
    bullets: [
      "250 AI render credits / month",
      "Exterior, interior & floor plan renders",
      "Buy additional packs anytime",
      "Instant generation, no wait time",
    ],
  },
  "site-maps": {
    icon: "🗺️",
    bullets: [
      "Interactive plat maps on your site",
      "Live lot availability (available / reserved / sold)",
      "Custom CTA per lot",
      "Setup fee per community (billed separately)",
    ],
  },
  "traditional-renders": {
    icon: "🎨",
    bullets: [
      "10 professional studio renders / month",
      "Exterior elevations, interiors, aerials",
      "5-day standard · 2-day rush delivery",
      "Revision requests included",
    ],
  },
};

const CRM_OPTIONS: { type: CrmType; label: string; hasApiKey: boolean; hasPortalId: boolean; hasWebhook: boolean; placeholder?: string }[] = [
  { type: "hubspot",       label: "HubSpot",          hasApiKey: true,  hasPortalId: true,  hasWebhook: false, placeholder: "Private App Token" },
  { type: "followupboss",  label: "Follow Up Boss",   hasApiKey: true,  hasPortalId: false, hasWebhook: false, placeholder: "API Key" },
  { type: "lasso",         label: "Lasso CRM",        hasApiKey: true,  hasPortalId: false, hasWebhook: false, placeholder: "API Key" },
  { type: "zapier",        label: "Zapier Webhook",   hasApiKey: false, hasPortalId: false, hasWebhook: true  },
  { type: "csv",           label: "CSV Export Only",  hasApiKey: false, hasPortalId: false, hasWebhook: false },
];

// ── main wizard content ───────────────────────────────────────────────────────

function SubscribeContent() {
  const params   = useSearchParams();
  const canceled = params.get("canceled") === "1";

  const [step,        setStep]       = useState(1);          // 1–4
  const [addons,      setAddons]     = useState<Addon[]>([]);
  const [loading,     setLoading]    = useState(true);
  const [builderId,   setBuilderId]  = useState<string | null>(null);
  const [billing,     setBilling]    = useState<"monthly" | "annually">("monthly");
  const [selected,    setSelected]   = useState<Set<string>>(new Set());
  const [crmType,     setCrmType]    = useState<CrmType | "skip">("skip");
  const [crmApiKey,   setCrmApiKey]  = useState("");
  const [crmPortalId, setCrmPortalId] = useState("");
  const [crmWebhook,  setCrmWebhook] = useState("");
  const [crmTesting,  setCrmTesting] = useState(false);
  const [crmTestResult, setCrmTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [submitting,  setSubmitting] = useState(false);
  const [error,       setError]      = useState<string | null>(null);

  // Auth: resolve builderId
  useEffect(() => {
    fetch("/api/addons").then(r => r.json()).then((data: Addon[]) => {
      setAddons(Array.isArray(data) ? data.sort((a, b) => a.sort_order - b.sort_order) : []);
      setLoading(false);
    });

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
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

        if (!resolvedId) return;
        setBuilderId(resolvedId);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: builder } = await (supabase.from("builders") as any)
          .select("stripe_subscription_status").eq("id", resolvedId).single();
        if (builder?.stripe_subscription_status === "active") {
          window.location.href = "/builder/dashboard";
        }
      } catch { /* ignore */ }
    });
  }, []);

  // ── computed ────────────────────────────────────────────────────────────────

  const selectedAddons = addons.filter(a => selected.has(a.slug));

  const monthlyTotal = selectedAddons.reduce((s, a) => s + a.monthly_price_cents, 0);

  const displayedTotal = billing === "annually"
    ? annualMonthly(monthlyTotal)
    : monthlyTotal;

  function toggleAddon(slug: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug); else next.add(slug);
      return next;
    });
  }

  // ── CRM test ────────────────────────────────────────────────────────────────

  async function handleCrmTest() {
    setCrmTesting(true); setCrmTestResult(null);
    try {
      const res = await fetch("/api/builder/crm/test", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crm_type:    crmType,
          api_key:     crmApiKey || undefined,
          portal_id:   crmPortalId || undefined,
          webhook_url: crmWebhook || undefined,
        }),
      });
      const json = await res.json();
      setCrmTestResult({ ok: json.ok, message: json.ok ? "Connected successfully" : (json.error ?? "Connection failed") });
    } catch {
      setCrmTestResult({ ok: false, message: "Network error" });
    }
    setCrmTesting(false);
  }

  // ── checkout ─────────────────────────────────────────────────────────────────

  async function handleCheckout() {
    if (!builderId) { setError("Account not found. Please refresh."); return; }
    if (selected.size === 0) { setError("Please select at least one addon."); return; }
    setSubmitting(true); setError(null);

    const crmConfig = (crmType !== "skip" && crmType !== "csv")
      ? { crm_type: crmType, api_key: crmApiKey || undefined, portal_id: crmPortalId || undefined, webhook_url: crmWebhook || undefined }
      : (crmType === "csv" ? { crm_type: "csv" as CrmType } : null);

    try {
      const res = await fetch("/api/stripe/addon-checkout", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ builderId, addonSlugs: [...selected], billingCycle: billing, crmConfig }),
      });
      const { url, error: apiErr } = await res.json();
      if (apiErr || !url) { setError(apiErr ?? "Checkout failed."); setSubmitting(false); return; }
      window.location.href = url;
    } catch {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  // ── render ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      {/* Header */}
      <div className="text-center pt-12 pb-8 px-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo_light.png" alt="ProPlan Studio" className="h-8 object-contain mx-auto mb-8" />
        {canceled && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm mb-6">
            Checkout was canceled. No charge was made.
          </div>
        )}

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3, 4].map((n, i) => (
            <div key={n} className="flex items-center gap-2">
              <StepDot n={n} current={step} />
              {i < 3 && <div className={`w-8 h-px ${step > n ? "bg-blue-600" : "bg-white/12"}`} />}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-24">

        {/* ── Step 1: Welcome ── */}
        {step === 1 && (
          <div className="max-w-lg mx-auto text-center">
            <h1 className="text-3xl font-extrabold text-white mb-3">Set up your workspace</h1>
            <p className="text-white/40 text-sm mb-10">
              Choose only the tools you need. Add more anytime from your dashboard.
            </p>

            <div className="grid grid-cols-2 gap-3 text-left mb-10">
              {[
                ["Interactive site maps", "Let buyers explore your community"],
                ["3D home configurator", "Buyers design in real time"],
                ["AI render studio", "Instant renders from selections"],
                ["Traditional 3D renders", "Professional studio renders on demand"],
              ].map(([title, desc]) => (
                <div key={title} className="bg-white/4 border border-white/8 rounded-xl p-4 flex gap-3">
                  <CheckIcon />
                  <div>
                    <p className="text-xs font-semibold text-white">{title}</p>
                    <p className="text-[11px] text-white/35 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={() => setStep(2)}
              className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm transition-colors shadow-xl shadow-blue-600/20">
              Choose my tools →
            </button>
          </div>
        )}

        {/* ── Step 2: Choose addons ── */}
        {step === 2 && (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-2xl font-extrabold text-white mb-2">Choose your tools</h2>
              <p className="text-white/40 text-sm mb-5">Select the services you want. Pricing is per workspace, not per community.</p>
              <div className="inline-flex items-center bg-white/5 border border-white/10 rounded-xl p-1 gap-1">
                <button onClick={() => setBilling("monthly")}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${billing === "monthly" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}>
                  Monthly
                </button>
                <button onClick={() => setBilling("annually")}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${billing === "annually" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}>
                  Annual
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Save 15%
                  </span>
                </button>
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1,2,3,4].map(i => <div key={i} className="h-64 bg-white/5 rounded-2xl animate-pulse" />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                {addons.map(addon => {
                  const isOn    = selected.has(addon.slug);
                  const details = ADDON_DETAILS[addon.slug];
                  const price   = billing === "annually"
                    ? annualMonthly(addon.monthly_price_cents)
                    : addon.monthly_price_cents;

                  return (
                    <button key={addon.slug} onClick={() => toggleAddon(addon.slug)}
                      className={`relative text-left rounded-2xl border p-5 transition-all duration-200
                        ${isOn
                          ? "bg-blue-600/10 border-blue-500/50 shadow-lg shadow-blue-500/10"
                          : "bg-white/4 border-white/10 hover:border-white/20 hover:bg-white/6"}`}>
                      {/* Toggle */}
                      <div className={`absolute top-4 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all
                        ${isOn ? "bg-blue-600 border-blue-600" : "border-white/25 bg-transparent"}`}>
                        {isOn && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>

                      <div className="text-2xl mb-2">{details?.icon ?? "📦"}</div>
                      <p className="text-sm font-bold text-white mb-0.5">{addon.name}</p>
                      <div className="flex items-baseline gap-1 mb-3">
                        <span className={`text-lg font-extrabold ${isOn ? "text-blue-300" : "text-white/80"}`}>
                          {fmtPrice(price)}
                        </span>
                        <span className="text-[11px] text-white/30">/mo</span>
                        {billing === "annually" && (
                          <span className="text-[10px] text-emerald-400 ml-1">
                            Save {fmtPrice(annualSavings(addon.monthly_price_cents))}/yr
                          </span>
                        )}
                      </div>
                      <ul className="space-y-1.5">
                        {details?.bullets.map(b => (
                          <li key={b} className="flex items-start gap-2">
                            <svg className={`w-3 h-3 flex-shrink-0 mt-0.5 ${isOn ? "text-blue-400" : "text-white/25"}`}
                              fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                            <span className="text-[11px] text-white/40 leading-relaxed">{b}</span>
                          </li>
                        ))}
                      </ul>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Running total */}
            <div className="sticky bottom-6 bg-[#111] border border-white/10 rounded-2xl px-5 py-4 flex items-center justify-between shadow-2xl">
              <div>
                {selected.size === 0 ? (
                  <p className="text-sm text-white/35">No tools selected yet</p>
                ) : (
                  <>
                    <p className="text-xs text-white/35 mb-0.5">{selected.size} tool{selected.size > 1 ? "s" : ""} selected</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-extrabold text-white">{fmtPrice(displayedTotal)}</span>
                      <span className="text-xs text-white/30">/mo</span>
                      {billing === "annually" && (
                        <span className="text-xs text-white/20 ml-1">billed {fmtPrice(annualTotal(monthlyTotal))}/yr</span>
                      )}
                    </div>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep(1)}
                  className="px-4 py-2 rounded-xl border border-white/10 text-white/50 hover:text-white text-sm transition-colors">
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={selected.size === 0}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors">
                  Next →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: CRM ── */}
        {step === 3 && (
          <div className="max-w-lg mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-extrabold text-white mb-2">Connect your CRM</h2>
              <p className="text-white/40 text-sm">
                When a buyer interacts with your site map or submits a quote, the lead gets pushed to your CRM automatically.
              </p>
            </div>

            {/* CRM selector */}
            <div className="space-y-2 mb-6">
              {CRM_OPTIONS.map(opt => (
                <button key={opt.type} onClick={() => { setCrmType(opt.type); setCrmTestResult(null); }}
                  className={`w-full text-left flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all
                    ${crmType === opt.type
                      ? "bg-blue-600/10 border-blue-500/40 text-white"
                      : "bg-white/4 border-white/8 text-white/55 hover:border-white/20 hover:text-white/80"}`}>
                  <span className="text-sm font-semibold">{opt.label}</span>
                  {crmType === opt.type && (
                    <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                  )}
                </button>
              ))}
              <button onClick={() => { setCrmType("skip"); setCrmTestResult(null); }}
                className={`w-full text-left flex items-center justify-between px-4 py-3.5 rounded-xl border transition-all
                  ${crmType === "skip"
                    ? "bg-white/8 border-white/20 text-white"
                    : "bg-white/4 border-white/8 text-white/35 hover:border-white/15"}`}>
                <span className="text-sm font-semibold">Skip for now</span>
                <span className="text-[11px] text-white/30">Set up later in Settings</span>
              </button>
            </div>

            {/* CRM credentials */}
            {crmType !== "skip" && crmType !== "csv" && (() => {
              const opt = CRM_OPTIONS.find(o => o.type === crmType)!;
              return (
                <div className="bg-white/4 border border-white/10 rounded-2xl p-5 space-y-3 mb-6">
                  {opt.hasApiKey && (
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-white/30 block mb-1.5">
                        {opt.placeholder ?? "API Key"}
                      </label>
                      <input
                        type="password"
                        value={crmApiKey}
                        onChange={e => { setCrmApiKey(e.target.value); setCrmTestResult(null); }}
                        placeholder={`Paste your ${opt.label} ${opt.placeholder ?? "API key"}`}
                        className="w-full bg-[#111] border border-white/12 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-blue-500/50"
                      />
                    </div>
                  )}
                  {opt.hasPortalId && (
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-white/30 block mb-1.5">Portal ID</label>
                      <input
                        type="text"
                        value={crmPortalId}
                        onChange={e => { setCrmPortalId(e.target.value); setCrmTestResult(null); }}
                        placeholder="Your HubSpot Portal ID"
                        className="w-full bg-[#111] border border-white/12 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-blue-500/50"
                      />
                    </div>
                  )}
                  {opt.hasWebhook && (
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-white/30 block mb-1.5">Webhook URL</label>
                      <input
                        type="url"
                        value={crmWebhook}
                        onChange={e => { setCrmWebhook(e.target.value); setCrmTestResult(null); }}
                        placeholder="https://hooks.zapier.com/..."
                        className="w-full bg-[#111] border border-white/12 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-blue-500/50"
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      onClick={handleCrmTest}
                      disabled={crmTesting || (!crmApiKey && !crmWebhook)}
                      className="px-4 py-2 rounded-xl border border-white/15 text-white/60 hover:text-white hover:border-white/30 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold transition-all">
                      {crmTesting ? "Testing…" : "Test connection"}
                    </button>
                    {crmTestResult && (
                      <span className={`text-xs font-semibold ${crmTestResult.ok ? "text-emerald-400" : "text-red-400"}`}>
                        {crmTestResult.ok ? "✓ " : "✗ "}{crmTestResult.message}
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}

            {crmType === "csv" && (
              <div className="bg-white/4 border border-white/10 rounded-2xl p-5 mb-6">
                <p className="text-sm text-white/50">
                  Leads will be stored in ProPlan and available to download as CSV from your Leads page.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setStep(2)}
                className="flex-1 py-3 rounded-xl border border-white/10 text-white/50 hover:text-white text-sm font-semibold transition-colors">
                Back
              </button>
              <button onClick={() => setStep(4)}
                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-colors">
                {crmType === "skip" ? "Skip, continue →" : "Save & continue →"}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Review & Pay ── */}
        {step === 4 && (
          <div className="max-w-lg mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-extrabold text-white mb-2">Review & pay</h2>
              <p className="text-white/40 text-sm">Secure checkout via Stripe. Cancel or add tools anytime.</p>
            </div>

            {/* Order summary */}
            <div className="bg-white/4 border border-white/10 rounded-2xl p-5 mb-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-4">Selected addons</p>
              <div className="space-y-3 mb-4">
                {selectedAddons.map(a => {
                  const price = billing === "annually" ? annualMonthly(a.monthly_price_cents) : a.monthly_price_cents;
                  return (
                    <div key={a.slug} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{ADDON_DETAILS[a.slug]?.icon ?? "📦"}</span>
                        <span className="text-sm text-white/80">{a.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-white">{fmtPrice(price)}<span className="text-white/30 text-xs">/mo</span></span>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-white/8 pt-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-white/40">Total</p>
                  {billing === "annually" && (
                    <p className="text-[11px] text-emerald-400">
                      You save {fmtPrice(annualSavings(monthlyTotal))}/yr with annual billing
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xl font-extrabold text-white">{fmtPrice(displayedTotal)}<span className="text-sm font-normal text-white/30">/mo</span></p>
                  {billing === "annually" && (
                    <p className="text-xs text-white/30">billed {fmtPrice(annualTotal(monthlyTotal))}/yr</p>
                  )}
                </div>
              </div>
            </div>

            {/* CRM summary */}
            {crmType !== "skip" && (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-white/4 border border-white/8 rounded-xl mb-4">
                <svg className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-xs text-white/50">
                  CRM: <span className="text-white/70 font-semibold">
                    {CRM_OPTIONS.find(o => o.type === crmType)?.label ?? crmType}
                  </span> will be connected after checkout
                </span>
              </div>
            )}

            {/* Notice about setup fees */}
            <div className="flex items-start gap-2 px-4 py-3 bg-amber-500/6 border border-amber-500/15 rounded-xl mb-6">
              <svg className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-amber-400/70 leading-relaxed">
                Setup fees (e.g. per model or per community plat map) are charged separately when you submit each request — not today.
              </p>
            </div>

            {error && <p className="text-red-400 text-sm text-center mb-4">{error}</p>}

            <div className="flex gap-3">
              <button onClick={() => setStep(3)}
                className="flex-shrink-0 px-5 py-3.5 rounded-xl border border-white/10 text-white/50 hover:text-white text-sm font-semibold transition-colors">
                Back
              </button>
              <button
                onClick={handleCheckout}
                disabled={submitting || !builderId}
                className="flex-1 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors shadow-xl shadow-blue-600/20">
                {submitting ? "Redirecting to Stripe…" : !builderId ? "Loading…" : "Subscribe via Stripe →"}
              </button>
            </div>
            <p className="text-center text-[10px] text-white/20 mt-4">
              Secure checkout · Cancel anytime · No setup fees charged today
            </p>
          </div>
        )}
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
