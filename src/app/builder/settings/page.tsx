"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getBuilderSubscription } from "@/lib/builder-api";
import type { Plan } from "@/types/database";

type Tab = "company" | "billing" | "notifications";

const TABS: { id: Tab; label: string }[] = [
  { id: "company",       label: "Company Profile" },
  { id: "billing",       label: "Billing & Plan"  },
  { id: "notifications", label: "Notifications"   },
];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-200 focus:outline-none ${checked ? "bg-blue-600" : "bg-white/15"}`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md transform transition-transform duration-200 mt-0.5 ${checked ? "translate-x-5" : "translate-x-0.5"}`}
      />
    </button>
  );
}

const INPUT = "w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/60 focus:border-blue-500/40 transition-colors";

function SettingsContent() {
  const searchParams = useSearchParams();
  const initialTab   = (searchParams.get("tab") as Tab) ?? "company";
  const [tab,     setTab]     = useState<Tab>(initialTab);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [loading, setLoading] = useState(true);
  const [builderId, setBuilderId] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoPreview,   setLogoPreview]   = useState<string | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  // Billing
  const [subscription, setSubscription] = useState<{
    builder: { plan_tier: string; stripe_subscription_status: string | null; current_period_end: string | null; billing_cycle: string; rendering_credits: number; rendering_credits_total: number; seats_included: number; seats_used: number };
    plan: Plan | null;
  } | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const [company, setCompany] = useState({
    company_name:    "",
    website_url:     "",
    phone:           "",
    billing_address: "",
    city:            "",
    state:           "",
    logo_url:        "",
    accent_color:    "#3b82f6",
  });

  const [notifs, setNotifs] = useState({
    new_lead:       true,
    lead_status:    true,
    project_update: true,
    weekly_report:  false,
  });

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (supabase as any)
        .from("profiles").select("builder_id").eq("id", user.id).single();

      if (!profile?.builder_id) { setLoading(false); return; }
      setBuilderId(profile.builder_id);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: builder } = await (supabase as any)
        .from("builders")
        .select("company_name,website_url,phone,billing_address,city,state,logo_url,accent_color,location,notification_prefs")
        .eq("id", profile.builder_id)
        .single();

      if (builder) {
        let city  = builder.city  ?? "";
        let state = builder.state ?? "";
        if (!city && !state && builder.location) {
          const parts = (builder.location as string).split(",").map((s: string) => s.trim());
          city  = parts[0] ?? "";
          state = parts[1] ?? "";
        }
        setCompany({
          company_name:    builder.company_name    ?? "",
          website_url:     builder.website_url     ?? "",
          phone:           builder.phone           ?? "",
          billing_address: builder.billing_address ?? "",
          city,
          state,
          logo_url:        builder.logo_url        ?? "",
          accent_color:    builder.accent_color    ?? "#3b82f6",
        });
        if (builder.logo_url) setLogoPreview(builder.logo_url);

        // Load saved notification preferences
        if (builder.notification_prefs) {
          setNotifs(prev => ({ ...prev, ...builder.notification_prefs }));
        }
      }
      setLoading(false);

      // Load subscription info
      getBuilderSubscription().then(sub => { if (sub) setSubscription(sub as typeof subscription); });
    }
    load();
  }, []);

  async function handleLogoUpload(file: File) {
    if (!builderId) return;
    setLogoUploading(true);
    setLogoPreview(URL.createObjectURL(file));
    const fd = new FormData();
    fd.append("file", file);
    fd.append("builder_id", builderId); // route persists via service role, bypasses RLS
    const res = await fetch("/api/builders/logo", { method: "POST", body: fd });
    if (res.ok) {
      const { url } = await res.json() as { url: string };
      setCompany(c => ({ ...c, logo_url: url }));
    } else {
      const body = await res.json().catch(() => ({})) as { error?: string };
      console.error("Logo upload failed:", body.error ?? res.statusText);
    }
    setLogoUploading(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!builderId) return;
    setSaving(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("builders").update({
      company_name:    company.company_name,
      website_url:     company.website_url   || null,
      phone:           company.phone         || null,
      billing_address: company.billing_address || null,
      city:            company.city          || null,
      state:           company.state         || null,
      logo_url:        company.logo_url      || null,
      accent_color:    company.accent_color,
      updated_at:      new Date().toISOString(),
    }).eq("id", builderId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1
          className="text-2xl font-extrabold text-white tracking-tight"
          style={{ fontFamily: "var(--font-syne), sans-serif" }}
        >
          Settings
        </h1>
        <p className="text-sm text-white/30 mt-0.5">Manage your company profile and preferences.</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-white/8 mb-8">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              tab === t.id
                ? "border-blue-500 text-blue-400"
                : "border-transparent text-white/35 hover:text-white/60"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Billing & Plan ── */}
      {tab === "billing" && (
        <div className="space-y-5">
          {/* Current plan card */}
          <div className="bg-[#0e0e0e] rounded-2xl border border-white/8 p-6">
            <h2 className="text-sm font-bold text-white/80 mb-4">Current Plan</h2>
            {subscription ? (
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl font-extrabold text-white capitalize">
                      {subscription.plan?.display_name ?? subscription.builder.plan_tier}
                    </span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border font-semibold ${
                      subscription.builder.stripe_subscription_status === "active"   ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" :
                      subscription.builder.stripe_subscription_status === "trialing" ? "text-blue-400 bg-blue-500/10 border-blue-500/20" :
                      subscription.builder.stripe_subscription_status === "past_due" ? "text-red-400 bg-red-500/10 border-red-500/20" :
                      "text-white/40 bg-white/6 border-white/10"
                    }`}>
                      {subscription.builder.stripe_subscription_status ?? "active"}
                    </span>
                  </div>
                  <p className="text-sm text-white/40 capitalize">
                    {subscription.builder.billing_cycle} billing
                    {subscription.builder.current_period_end && (
                      <> · renews {new Date(subscription.builder.current_period_end).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</>
                    )}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    if (!builderId) return;
                    setPortalLoading(true);
                    const res = await fetch("/api/stripe/portal", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ builderId }),
                    });
                    const { url, error } = await res.json();
                    setPortalLoading(false);
                    if (url) window.location.href = url;
                    else alert(error ?? "Could not open billing portal.");
                  }}
                  disabled={portalLoading}
                  className="px-4 py-2.5 rounded-xl bg-white/8 hover:bg-white/12 border border-white/10 text-white text-sm font-semibold disabled:opacity-40 transition-colors"
                >
                  {portalLoading ? "Opening…" : "Manage Subscription →"}
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm text-white/40">No active subscription.</p>
                <a href="/builder/subscribe"
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors">
                  Choose a Plan →
                </a>
              </div>
            )}
          </div>

          {/* Usage */}
          {subscription && (
            <div className="bg-[#0e0e0e] rounded-2xl border border-white/8 p-6">
              <h2 className="text-sm font-bold text-white/80 mb-4">Usage This Month</h2>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Render Credits", used: Math.max(0, (subscription.builder.rendering_credits_total ?? 0) - (subscription.builder.rendering_credits ?? 0)), total: subscription.builder.rendering_credits_total },
                  { label: "Team Seats",     used: subscription.builder.seats_used,     total: subscription.builder.seats_included },
                ].map(item => {
                  const unlimited = item.total === null || item.total === -1 || item.total >= 9999;
                  const pct = (!unlimited && item.total > 0) ? Math.min((item.used / item.total) * 100, 100) : 0;
                  const isLow = pct >= 80;
                  return (
                    <div key={item.label}>
                      <div className="flex justify-between mb-1.5">
                        <span className="text-xs text-white/40">{item.label}</span>
                        <span className={`text-xs font-semibold ${isLow ? "text-orange-400" : "text-white/50"}`}>
                          {unlimited ? `${item.used} used · ∞` : `${item.used} / ${item.total}`}
                        </span>
                      </div>
                      {!unlimited && (
                        <div className="h-1.5 bg-white/6 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${isLow ? "bg-orange-500" : "bg-blue-500"}`} style={{ width: `${pct}%` }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {subscription?.builder.stripe_subscription_status === "past_due" && (
            <div className="bg-red-500/8 border border-red-500/25 rounded-xl px-5 py-4">
              <p className="text-sm font-semibold text-red-400 mb-1">Payment failed</p>
              <p className="text-xs text-red-400/70">Your last payment was unsuccessful. Please update your payment method to avoid service interruption.</p>
              <button onClick={async () => {
                if (!builderId) return;
                setPortalLoading(true);
                const res = await fetch("/api/stripe/portal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ builderId }) });
                const { url } = await res.json();
                setPortalLoading(false);
                if (url) window.location.href = url;
              }} className="mt-3 text-xs text-red-300 underline">Update payment method →</button>
            </div>
          )}
        </div>
      )}

      {/* ── Company Profile ── */}
      {tab === "company" && (
        <form onSubmit={handleSave} className="space-y-5">

          <div className="bg-[#0e0e0e] rounded-2xl border border-white/8 p-6 space-y-5">
            <h2
              className="font-bold text-white text-sm"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              Company Information
            </h2>
            <div className="grid grid-cols-2 gap-5">
              {[
                { key: "company_name" as const,    label: "Company Name",   placeholder: "Acme Homes",           type: "text" },
                { key: "website_url"  as const,    label: "Website",        placeholder: "https://acmehomes.com", type: "url"  },
                { key: "phone"        as const,    label: "Phone",          placeholder: "(555) 000-0000",        type: "tel"  },
                { key: "billing_address" as const, label: "Address",        placeholder: "123 Main St",           type: "text" },
                { key: "city"         as const,    label: "City",           placeholder: "Austin",                type: "text" },
                { key: "state"        as const,    label: "State",          placeholder: "TX",                    type: "text" },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">{f.label}</label>
                  <input type={f.type} value={company[f.key]} placeholder={f.placeholder}
                    onChange={e => setCompany(c => ({ ...c, [f.key]: e.target.value }))}
                    className={INPUT} />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#0e0e0e] rounded-2xl border border-white/8 p-6 space-y-5">
            <h2
              className="font-bold text-white text-sm"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              Branding
            </h2>

            {/* Logo upload */}
            <div>
              <label className="block text-xs font-semibold text-white/40 mb-2 uppercase tracking-wide">Company Logo</label>
              <p className="text-xs text-white/25 mb-3">Appears in the configurator, quotes, and PDF exports.</p>
              <input ref={logoRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }} />
              <div
                onClick={() => !logoUploading && logoRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith("image/")) handleLogoUpload(f); }}
                className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-white/10 rounded-xl p-8 cursor-pointer hover:border-blue-500/40 hover:bg-blue-600/5 transition-colors"
              >
                {logoUploading ? (
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                ) : logoPreview ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoPreview} alt="Logo" className="h-12 max-w-full object-contain" />
                    <span className="text-xs text-white/30">Click to replace</span>
                  </>
                ) : (
                  <>
                    <svg className="w-8 h-8 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <span className="text-sm text-white/40">Drop your logo here, or <span className="text-blue-400 font-medium">browse</span></span>
                    <span className="text-xs text-white/20">PNG, SVG, WEBP recommended</span>
                  </>
                )}
              </div>
            </div>

            {/* Accent color */}
            <div>
              <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Brand Accent Color</label>
              <p className="text-xs text-white/25 mb-2">Used for configurator UI, quote buttons, and PDF highlights.</p>
              <div className="flex items-center gap-3">
                <input type="color" value={company.accent_color}
                  onChange={e => setCompany(c => ({ ...c, accent_color: e.target.value }))}
                  className="w-10 h-10 rounded-lg border border-white/10 cursor-pointer p-1 bg-[#141414]" />
                <input type="text" value={company.accent_color}
                  onChange={e => setCompany(c => ({ ...c, accent_color: e.target.value }))}
                  className="bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm font-mono text-white/70 w-32 focus:outline-none focus:ring-1 focus:ring-blue-500/60 transition-colors" />
                <div className="w-8 h-8 rounded-lg flex-shrink-0 border border-white/10" style={{ background: company.accent_color }} />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl border border-white/10 text-sm font-medium text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 shadow-lg ${
                saved ? "bg-emerald-600 text-white shadow-emerald-600/20" : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20"
              }`}>
              {saved ? "✓ Saved" : saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      )}

      {/* ── Notifications ── */}

      {tab === "notifications" && (
        <div className="bg-[#0e0e0e] rounded-2xl border border-white/8 divide-y divide-white/6">
          {[
            { key: "new_lead",       label: "New Lead",          desc: "Get notified when someone submits their configuration." },
            { key: "lead_status",    label: "Lead Status Change", desc: "Alerts when a lead status is updated." },
            { key: "project_update", label: "Project Updates",    desc: "Development status changes for your projects." },
            { key: "weekly_report",  label: "Weekly Report",      desc: "A summary of leads and views every Monday." },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between px-6 py-4">
              <div>
                <p className="text-sm font-semibold text-white/70">{item.label}</p>
                <p className="text-xs text-white/30 mt-0.5">{item.desc}</p>
              </div>
              <Toggle
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                checked={(notifs as any)[item.key]}
                onChange={v => setNotifs(prev => ({ ...prev, [item.key]: v }))}
              />
            </div>
          ))}
          <div className="px-6 py-4 flex justify-end">
            <button
              onClick={async () => {
                if (!builderId) return;
                setSaving(true);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabase as any)
                  .from("builders")
                  .update({ notification_prefs: notifs, updated_at: new Date().toISOString() })
                  .eq("id", builderId);
                setSaving(false);
                setSaved(true);
                setTimeout(() => setSaved(false), 2500);
              }}
              disabled={saving || !builderId}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-lg disabled:opacity-50 ${
                saved ? "bg-emerald-600 text-white shadow-emerald-600/20" : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20"
              }`}>
              {saved ? "✓ Saved" : saving ? "Saving…" : "Save Preferences"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-8 flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <SettingsContent />
    </Suspense>
  );
}
