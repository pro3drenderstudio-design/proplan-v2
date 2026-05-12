"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getBuilderSubscription } from "@/lib/builder-api";
import type { Plan, Addon } from "@/types/database";
import AddonUpgradeModal, { type AddonInfo } from "@/components/builder/AddonUpgradeModal";

type Tab = "company" | "billing" | "notifications" | "integrations";

const TABS: { id: Tab; label: string }[] = [
  { id: "company",       label: "Company Profile" },
  { id: "billing",       label: "Billing & Plan"  },
  { id: "notifications", label: "Notifications"   },
  { id: "integrations",  label: "Integrations"    },
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

  // CRM integration
  const [crm, setCrm] = useState({ crm_type: "none", api_key: "", webhook_url: "", portal_id: "", enabled: true });
  const [crmTesting,  setCrmTesting]  = useState(false);
  const [crmTestResult, setCrmTestResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [crmSaving,   setCrmSaving]   = useState(false);
  const [crmSaved,    setCrmSaved]    = useState(false);

  // Addon cards
  const [allAddons,       setAllAddons]       = useState<Addon[]>([]);
  const [activeAddonSlugs, setActiveAddonSlugs] = useState<Set<string>>(new Set());
  const [upgradeAddon,    setUpgradeAddon]    = useState<AddonInfo | null>(null);

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

      // Load CRM config
      fetch(`/api/builder/crm?builderId=${profile.builder_id}`)
        .then(r => r.ok ? r.json() : null)
        .then((data: { crm_type?: string; api_key?: string; webhook_url?: string; portal_id?: string; enabled?: boolean } | null) => {
          if (data?.crm_type) {
            setCrm({ crm_type: data.crm_type, api_key: data.api_key ?? "", webhook_url: data.webhook_url ?? "", portal_id: data.portal_id ?? "", enabled: data.enabled ?? true });
          }
        })
        .catch(() => {});

      // Load addons catalog + builder's active addons
      fetch("/api/addons")
        .then(r => r.json())
        .then((data: Addon[]) => { if (Array.isArray(data)) setAllAddons(data.sort((a, b) => a.sort_order - b.sort_order)); })
        .catch(() => {});

      fetch(`/api/builder/addons?builderId=${profile.builder_id}`)
        .then(r => r.json())
        .then((data: { addon_slug: string }[]) => {
          if (Array.isArray(data)) setActiveAddonSlugs(new Set(data.map(d => d.addon_slug)));
        })
        .catch(() => {});
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

          {/* Addon cards */}
          {allAddons.length > 0 && (
            <div className="bg-[#0e0e0e] rounded-2xl border border-white/8 p-6">
              <h2 className="text-sm font-bold text-white/80 mb-4">Your Add-ons</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {allAddons.map(addon => {
                  const active = activeAddonSlugs.has(addon.slug);
                  const price  = (addon.monthly_price_cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
                  return (
                    <div key={addon.slug}
                      className={`rounded-xl border p-4 flex items-center justify-between gap-3 ${active ? "bg-blue-600/8 border-blue-500/25" : "bg-white/3 border-white/8"}`}>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{addon.name}</p>
                        <p className="text-xs text-white/35 mt-0.5">{active ? `${price}/mo · Active` : `${price}/mo`}</p>
                      </div>
                      {active ? (
                        <button onClick={async () => {
                          if (!builderId) return;
                          setPortalLoading(true);
                          const res = await fetch("/api/stripe/portal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ builderId }) });
                          const { url } = await res.json();
                          setPortalLoading(false);
                          if (url) window.location.href = url;
                        }}
                          className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-white/6 hover:bg-white/10 border border-white/10 text-xs text-white/60 hover:text-white transition-colors">
                          Manage
                        </button>
                      ) : (
                        <button onClick={() => {
                          if (!builderId) return;
                          setUpgradeAddon({
                            slug:        addon.slug,
                            name:        addon.name,
                            description: addon.description ?? "",
                            price:       `${price}/mo`,
                            included:    addon.included_units != null
                              ? `${addon.included_units} ${addon.unit_label ?? "units"}/mo`
                              : "Unlimited",
                          });
                        }}
                          className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition-colors">
                          Add
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {upgradeAddon && builderId && (
            <AddonUpgradeModal
              addon={upgradeAddon}
              builderId={builderId}
              cancelPath="/builder/settings?tab=billing"
              onClose={() => setUpgradeAddon(null)}
            />
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

      {/* ── Integrations ── */}
      {tab === "integrations" && (
        <div className="max-w-2xl space-y-6">
          <div>
            <h2 className="text-sm font-bold text-white mb-0.5">CRM Integration</h2>
            <p className="text-xs text-white/35">Connect your CRM to automatically sync leads from site map inquiries and configurator submissions.</p>
          </div>

          {/* Provider selector */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">CRM Provider</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { key: "hubspot",      label: "HubSpot" },
                { key: "followupboss", label: "Follow Up Boss" },
                { key: "lasso",        label: "Lasso" },
                { key: "zapier",       label: "Zapier" },
                { key: "csv",          label: "CSV / Manual" },
                { key: "none",         label: "Not connected" },
              ].map(p => (
                <button key={p.key} onClick={() => { setCrm(c => ({ ...c, crm_type: p.key })); setCrmTestResult(null); }}
                  className="px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left"
                  style={crm.crm_type === p.key
                    ? { background: "rgba(37,99,235,0.2)", border: "1px solid rgba(59,130,246,0.5)", color: "rgba(147,197,253,1)" }
                    : { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Credential fields */}
          {(crm.crm_type === "hubspot" || crm.crm_type === "followupboss" || crm.crm_type === "lasso") && (
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">
                  {crm.crm_type === "hubspot" ? "Private App Token" : "API Key"}
                </label>
                <input type="password" value={crm.api_key}
                  onChange={e => setCrm(c => ({ ...c, api_key: e.target.value }))}
                  placeholder={crm.crm_type === "hubspot" ? "pat-na1-…" : "Your API key"}
                  className={INPUT} />
              </div>
              {crm.crm_type === "hubspot" && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">Portal ID (optional)</label>
                  <input value={crm.portal_id} onChange={e => setCrm(c => ({ ...c, portal_id: e.target.value }))}
                    placeholder="12345678" className={INPUT} />
                </div>
              )}
            </div>
          )}

          {crm.crm_type === "zapier" && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1.5">Webhook URL</label>
              <input value={crm.webhook_url} onChange={e => setCrm(c => ({ ...c, webhook_url: e.target.value }))}
                placeholder="https://hooks.zapier.com/hooks/catch/…" className={INPUT} />
            </div>
          )}

          {crm.crm_type === "csv" && (
            <div className="rounded-xl px-4 py-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <p className="text-sm text-white/50">Leads are stored in your dashboard and available for CSV export. No external sync needed.</p>
            </div>
          )}

          {crm.crm_type !== "none" && crm.crm_type !== "csv" && (
            <div className="flex items-center gap-3">
              <button onClick={async () => {
                setCrmTesting(true); setCrmTestResult(null);
                const res = await fetch("/api/builder/crm/test", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ crm_type: crm.crm_type, api_key: crm.api_key || undefined, webhook_url: crm.webhook_url || undefined, portal_id: crm.portal_id || undefined }),
                });
                const j = await res.json().catch(() => ({ ok: false, error: "Request failed" }));
                setCrmTestResult(j as { ok: boolean; error?: string });
                setCrmTesting(false);
              }} disabled={crmTesting}
                className="px-4 py-2 rounded-xl text-sm font-medium border border-white/12 text-white/50 hover:text-white hover:border-white/25 disabled:opacity-40 transition-colors">
                {crmTesting ? "Testing…" : "Test Connection"}
              </button>
              {crmTestResult && (
                <span className={`text-sm font-medium ${crmTestResult.ok ? "text-green-400" : "text-red-400"}`}>
                  {crmTestResult.ok ? "✓ Connected" : `✗ ${crmTestResult.error ?? "Failed"}`}
                </span>
              )}
            </div>
          )}

          {/* Enable toggle */}
          {crm.crm_type !== "none" && (
            <label className="flex items-center gap-3 cursor-pointer">
              <Toggle checked={crm.enabled} onChange={v => setCrm(c => ({ ...c, enabled: v }))} />
              <span className="text-sm text-white/60">Enable CRM sync</span>
            </label>
          )}

          {/* Save / Disconnect */}
          <div className="flex items-center gap-3 pt-2">
            {crm.crm_type !== "none" && (
              <button onClick={async () => {
                setCrmSaving(true);
                await fetch("/api/builder/crm", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ builderId, ...crm }),
                });
                setCrmSaving(false); setCrmSaved(true);
                setTimeout(() => setCrmSaved(false), 2500);
              }} disabled={crmSaving || !builderId}
                className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-lg disabled:opacity-50 ${
                  crmSaved ? "bg-emerald-600 text-white" : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20"
                }`}>
                {crmSaved ? "✓ Saved" : crmSaving ? "Saving…" : "Save Integration"}
              </button>
            )}
            {crm.crm_type !== "none" && (
              <button onClick={async () => {
                if (!confirm("Disconnect CRM integration?")) return;
                await fetch(`/api/builder/crm?builderId=${builderId}`, { method: "DELETE" });
                setCrm({ crm_type: "none", api_key: "", webhook_url: "", portal_id: "", enabled: true });
              }} className="text-xs text-red-400/60 hover:text-red-400 transition-colors">
                Disconnect
              </button>
            )}
          </div>

          <div className="pt-4 border-t border-white/6">
            <p className="text-[10px] text-white/20 uppercase tracking-widest font-semibold mb-3">Coming Soon</p>
            <div className="flex items-center gap-3 text-sm text-white/25">
              <span className="px-3 py-1.5 rounded-lg border border-white/8 text-xs">Salesforce</span>
              <span className="px-3 py-1.5 rounded-lg border border-white/8 text-xs">Realtor.com</span>
              <span className="px-3 py-1.5 rounded-lg border border-white/8 text-xs">BuildTopia</span>
            </div>
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
