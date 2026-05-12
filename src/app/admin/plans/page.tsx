"use client";

import { useEffect, useState } from "react";
import { getPlans } from "@/lib/admin-api";
import { Addon, Plan } from "@/types/database";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPrice(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

// Resolved at render time — first active plan gets blue accent, rest get neutral
function planStyle(_name: string, index: number): string {
  return index === 0
    ? "from-blue-600/10 to-blue-600/5 border-blue-500/25"
    : "from-white/5 to-white/3 border-white/10";
}
function planAccent(_name: string, index: number): string {
  return index === 0 ? "text-blue-400" : "text-white/70";
}

// ── Inline editable number field ──────────────────────────────────────────────

function EditableNumber({
  value,
  onChange,
  label,
  suffix,
  min,
  allowInfinite,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  suffix?: string;
  min?: number;
  allowInfinite?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [raw,     setRaw]     = useState(String(value === -1 ? "" : value));

  function commit() {
    setEditing(false);
    if (allowInfinite && raw.trim() === "") { onChange(-1); return; }
    const n = parseInt(raw, 10);
    if (!isNaN(n) && n >= (min ?? 0)) onChange(n);
    else setRaw(String(value === -1 ? "" : value));
  }

  const display = value === -1 ? "∞" : value.toLocaleString();

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[9px] font-bold uppercase tracking-widest text-white/25">{label}</span>
      {editing ? (
        <input
          autoFocus
          type="text"
          value={raw}
          onChange={e => setRaw(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setEditing(false); setRaw(String(value === -1 ? "" : value)); } }}
          placeholder={allowInfinite ? "∞ for unlimited" : ""}
          className="w-full bg-[#1a1a1a] border border-blue-500/40 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500/40"
        />
      ) : (
        <button
          onClick={() => { setEditing(true); setRaw(String(value === -1 ? "" : value)); }}
          className="text-left px-2 py-1.5 rounded-lg bg-white/4 hover:bg-white/8 border border-transparent hover:border-white/10 transition-all group"
        >
          <span className="text-sm font-bold text-white">{display}</span>
          {suffix && <span className="text-xs text-white/30 ml-1">{suffix}</span>}
          <span className="ml-2 text-[10px] text-white/20 group-hover:text-white/40 transition-colors">edit</span>
        </button>
      )}
    </div>
  );
}

function EditableText({ value, onChange, label, placeholder }: { value: string; onChange: (v: string) => void; label: string; placeholder?: string }) {
  const [editing, setEditing] = useState(false);
  const [raw,     setRaw]     = useState(value);

  function commit() {
    setEditing(false);
    const trimmed = raw.trim();
    if (trimmed) onChange(trimmed);
    else setRaw(value);
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[9px] font-bold uppercase tracking-widest text-white/25">{label}</span>
      {editing ? (
        <input
          autoFocus
          type="text"
          value={raw}
          onChange={e => setRaw(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setEditing(false); setRaw(value); } }}
          placeholder={placeholder}
          className="w-full bg-[#1a1a1a] border border-blue-500/40 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500/40"
        />
      ) : (
        <button
          onClick={() => { setEditing(true); setRaw(value); }}
          className="text-left px-2 py-1.5 rounded-lg bg-white/4 hover:bg-white/8 border border-transparent hover:border-white/10 transition-all group"
        >
          <span className="text-sm font-bold text-white">{value || <span className="text-white/20">Not set</span>}</span>
          <span className="ml-2 text-[10px] text-white/20 group-hover:text-white/40 transition-colors">edit</span>
        </button>
      )}
    </div>
  );
}

function EditableToggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-white/50">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${value ? "bg-blue-600" : "bg-white/15"}`}
      >
        <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${value ? "translate-x-4" : "translate-x-0"}`} />
      </button>
    </div>
  );
}

function EditablePrice({
  value,
  onChange,
  label,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  suffix?: string;
}) {
  const [editing, setEditing] = useState(false);
  // Display in dollars, store in cents
  const [raw, setRaw] = useState(String(value / 100));

  function commit() {
    setEditing(false);
    const dollars = parseFloat(raw.replace(/[^0-9.]/g, ""));
    if (!isNaN(dollars) && dollars > 0) onChange(Math.round(dollars * 100));
    else setRaw(String(value / 100));
  }

  const display = (value / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[9px] font-bold uppercase tracking-widest text-white/25">{label}</span>
      {editing ? (
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-white/40">$</span>
          <input
            autoFocus
            type="text"
            value={raw}
            onChange={e => setRaw(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setEditing(false); setRaw(String(value / 100)); } }}
            className="w-full bg-[#1a1a1a] border border-blue-500/40 rounded-lg pl-5 pr-2 py-1.5 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500/40"
          />
        </div>
      ) : (
        <button
          onClick={() => { setEditing(true); setRaw(String(value / 100)); }}
          className="text-left px-2 py-1.5 rounded-lg bg-white/4 hover:bg-white/8 border border-transparent hover:border-white/10 transition-all group"
        >
          <span className="text-sm font-bold text-white">{display}</span>
          {suffix && <span className="text-xs text-white/30 ml-1">{suffix}</span>}
          <span className="ml-2 text-[10px] text-white/20 group-hover:text-white/40 transition-colors">edit</span>
        </button>
      )}
    </div>
  );
}

function EditableStripeId({ value, onChange, label }: { value: string | null; onChange: (v: string | null) => void; label: string }) {
  const [editing, setEditing] = useState(false);
  const [raw,     setRaw]     = useState(value ?? "");

  function commit() {
    setEditing(false);
    onChange(raw.trim() || null);
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[9px] font-bold uppercase tracking-widest text-white/25">{label}</span>
      {editing ? (
        <input
          autoFocus
          type="text"
          value={raw}
          onChange={e => setRaw(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
          placeholder="price_xxx…"
          className="w-full bg-[#1a1a1a] border border-blue-500/40 rounded-lg px-2 py-1.5 text-xs text-white/80 outline-none font-mono focus:ring-1 focus:ring-blue-500/40"
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="text-left px-2 py-1.5 rounded-lg bg-white/4 hover:bg-white/8 border border-transparent hover:border-white/10 transition-all group"
        >
          {value ? (
            <span className="text-xs font-mono text-white/60 truncate block max-w-[180px]">{value}</span>
          ) : (
            <span className="text-xs text-white/20">Not set</span>
          )}
          <span className="text-[10px] text-white/20 group-hover:text-white/40 transition-colors ml-1">edit</span>
        </button>
      )}
    </div>
  );
}

// ── Plan Card ─────────────────────────────────────────────────────────────────

function PlanCard({ plan, index, onSave }: { plan: Plan; index: number; onSave: (id: string, updates: Partial<Plan>) => Promise<{ stripe_price_id_monthly?: string; stripe_price_id_annually?: string; error?: string } | null> }) {
  const [draft,   setDraft]   = useState<Plan>({ ...plan });
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [dirty,   setDirty]   = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  function update<K extends keyof Plan>(key: K, val: Plan[K]) {
    setDraft(prev => ({ ...prev, [key]: val }));
    setDirty(true);
  }

  async function handleSave() {
    setSaving(true);
    setSaveErr(null);
    const result = await onSave(draft.id, {
      display_name:               draft.display_name,
      price_monthly:              draft.price_monthly,
      price_annually:             draft.price_annually,
      rendering_credits_monthly:  draft.rendering_credits_monthly,
      ai_credits_monthly:         draft.ai_credits_monthly,
      max_projects:               draft.max_projects,
      max_communities:            (draft as any).max_communities ?? -1,
      seats_included:             draft.seats_included,
      max_storage_gb:             draft.max_storage_gb,
      includes_sitemaps:          draft.includes_sitemaps,
      stripe_price_id_monthly:    draft.stripe_price_id_monthly,
      stripe_price_id_annually:   draft.stripe_price_id_annually,
      model_setup_fee:            draft.model_setup_fee,
      extra_ai_pack_qty:          draft.extra_ai_pack_qty,
      extra_ai_pack_price:        draft.extra_ai_pack_price,
      extra_render_pack_qty:      draft.extra_render_pack_qty,
      extra_render_pack_price:    draft.extra_render_pack_price,
      is_active:                  draft.is_active,
    });
    setSaving(false);
    if (result?.error) {
      setSaveErr(result.error);
    } else {
      // Reflect newly created Stripe price IDs in the draft immediately
      if (result?.stripe_price_id_monthly)  setDraft(prev => ({ ...prev, stripe_price_id_monthly: result.stripe_price_id_monthly! }));
      if (result?.stripe_price_id_annually) setDraft(prev => ({ ...prev, stripe_price_id_annually: result.stripe_price_id_annually! }));
      setSaved(true);
      setDirty(false);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  function handleReset() {
    setDraft({ ...plan });
    setDirty(false);
  }

  return (
    <div className={`bg-gradient-to-b ${planStyle(plan.name, index)} border rounded-2xl overflow-hidden`}>

      {/* Header */}
      <div className="px-6 py-5 border-b border-white/8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {!draft.is_active && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 font-semibold">Inactive</span>
              )}
            </div>
            <EditableText
              value={draft.display_name}
              onChange={v => update("display_name", v)}
              label="Plan Name"
              placeholder="e.g. Starter"
            />
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-xl font-bold text-white">{fmtPrice(draft.price_monthly)}</span>
              <span className="text-white/30 text-xs">/mo</span>
              <span className="text-white/20 text-xs ml-2">· {fmtPrice(draft.price_annually)}/yr</span>
            </div>
          </div>
          <EditableToggle value={draft.is_active} onChange={v => update("is_active", v)} label="Active" />
        </div>
      </div>

      {/* Editable limits */}
      <div className="p-6 space-y-4">
        {/* Pricing */}
        <div className="pb-4 border-b border-white/8 space-y-3">
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/25">Pricing</p>
          <div className="grid grid-cols-2 gap-4">
            <EditablePrice
              value={draft.price_monthly}
              onChange={v => update("price_monthly", v)}
              label="Monthly Price"
              suffix="/mo"
            />
            <EditablePrice
              value={draft.price_annually}
              onChange={v => update("price_annually", v)}
              label="Annual Price"
              suffix="/yr"
            />
          </div>
        </div>

        <p className="text-[9px] font-bold uppercase tracking-widest text-white/25 mb-3">Plan Limits</p>

        <div className="grid grid-cols-2 gap-4">
          <EditableNumber
            value={draft.rendering_credits_monthly}
            onChange={v => update("rendering_credits_monthly", v)}
            label="Traditional Renders / mo"
            suffix="renders"
            allowInfinite
          />
          <EditableNumber
            value={draft.ai_credits_monthly}
            onChange={v => update("ai_credits_monthly", v)}
            label="AI Renders / mo"
            suffix="credits"
            allowInfinite
          />
          <EditableNumber
            value={draft.max_projects}
            onChange={v => update("max_projects", v)}
            label="Max Models"
            suffix="models"
            allowInfinite
          />
          <EditableNumber
            value={draft.max_communities ?? -1}
            onChange={v => update("max_communities" as keyof Plan, v as any)}
            label="Max Communities"
            suffix="communities"
            allowInfinite
          />
          <EditableNumber
            value={draft.seats_included}
            onChange={v => update("seats_included", v)}
            label="Team Seats"
            suffix="seats"
            min={1}
          />
          <EditableNumber
            value={draft.max_storage_gb}
            onChange={v => update("max_storage_gb", v)}
            label="Storage"
            suffix="GB"
            min={1}
          />
        </div>

        <EditableToggle value={draft.includes_sitemaps} onChange={v => update("includes_sitemaps", v)} label="Includes Site Maps" />

        {/* Credits & Fees */}
        <div className="pt-4 border-t border-white/8 space-y-4">
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/25">Credits &amp; Fees</p>

          <EditablePrice
            value={draft.model_setup_fee}
            onChange={v => update("model_setup_fee", v)}
            label="Model Setup Fee (one-time per model)"
            suffix="/model"
          />

          <div className="bg-white/3 rounded-xl p-3 space-y-3">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-amber-400/60">AI Credit Top-up Pack</p>
            <div className="grid grid-cols-2 gap-3">
              <EditableNumber
                value={draft.extra_ai_pack_qty}
                onChange={v => update("extra_ai_pack_qty", v)}
                label="Credits per Pack"
                suffix="credits"
                min={1}
              />
              <EditablePrice
                value={draft.extra_ai_pack_price}
                onChange={v => update("extra_ai_pack_price", v)}
                label="Pack Price"
                suffix="/pack"
              />
            </div>
          </div>

          {draft.rendering_credits_monthly !== -1 && (
            <div className="bg-white/3 rounded-xl p-3 space-y-3">
              <p className="text-[9px] font-semibold uppercase tracking-widest text-violet-400/60">Render Credit Top-up Pack</p>
              <div className="grid grid-cols-2 gap-3">
                <EditableNumber
                  value={draft.extra_render_pack_qty}
                  onChange={v => update("extra_render_pack_qty", v)}
                  label="Renders per Pack"
                  suffix="renders"
                  min={1}
                />
                <EditablePrice
                  value={draft.extra_render_pack_price}
                  onChange={v => update("extra_render_pack_price", v)}
                  label="Pack Price"
                  suffix="/pack"
                />
              </div>
            </div>
          )}
        </div>

        {/* Stripe IDs */}
        <div className="pt-4 border-t border-white/8 space-y-3">
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/25">Stripe Price IDs</p>
          <EditableStripeId
            value={draft.stripe_price_id_monthly}
            onChange={v => update("stripe_price_id_monthly", v)}
            label="Monthly Price ID"
          />
          <EditableStripeId
            value={draft.stripe_price_id_annually}
            onChange={v => update("stripe_price_id_annually", v)}
            label="Annual Price ID"
          />
        </div>
      </div>

      {/* Save bar */}
      <div className={`px-6 py-4 border-t border-white/8 space-y-2 transition-opacity ${dirty || saveErr ? "opacity-100" : "opacity-40"}`}>
        {saveErr && (
          <p className="text-xs text-red-400 text-center">{saveErr}</p>
        )}
        <div className="flex items-center justify-between">
          <button onClick={handleReset} disabled={!dirty || saving}
            className="text-xs text-white/40 hover:text-white/60 disabled:cursor-not-allowed transition-colors">
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors"
          >
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Addon Card ────────────────────────────────────────────────────────────────

const ADDON_ICONS: Record<string, string> = {
  "configurator":        "🏠",
  "ai-renders":          "✨",
  "site-maps":           "🗺️",
  "traditional-renders": "🎨",
};

function AddonCard({ addon, onSave }: {
  addon: Addon;
  onSave: (slug: string, updates: Partial<Addon>) => Promise<{ stripe_price_id_monthly?: string; stripe_price_id_annually?: string; error?: string } | null>;
}) {
  const [draft,   setDraft]   = useState<Addon>({ ...addon });
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [dirty,   setDirty]   = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  function update<K extends keyof Addon>(key: K, val: Addon[K]) {
    setDraft(prev => ({ ...prev, [key]: val }));
    setDirty(true);
  }

  async function handleSave() {
    setSaving(true); setSaveErr(null);
    const result = await onSave(draft.slug, draft);
    setSaving(false);
    if (result?.error) {
      setSaveErr(result.error);
    } else {
      if (result?.stripe_price_id_monthly)  setDraft(p => ({ ...p, stripe_price_id_monthly:  result.stripe_price_id_monthly! }));
      if (result?.stripe_price_id_annually) setDraft(p => ({ ...p, stripe_price_id_annually: result.stripe_price_id_annually! }));
      setSaved(true); setDirty(false);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  const hasOverage = draft.overage_block_size !== null && draft.overage_block_price_cents !== null;

  return (
    <div className="bg-gradient-to-b from-white/5 to-white/3 border border-white/10 rounded-2xl overflow-hidden">
      <div className="px-6 py-5 border-b border-white/8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{ADDON_ICONS[draft.slug] ?? "📦"}</span>
              <span className="text-sm font-bold text-white">{draft.name}</span>
            </div>
            <p className="text-xs text-white/35">{draft.description}</p>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-xl font-bold text-white">{fmtPrice(draft.monthly_price_cents)}</span>
              <span className="text-white/30 text-xs">/mo</span>
            </div>
          </div>
          <EditableToggle value={draft.is_active} onChange={v => update("is_active", v)} label="Active" />
        </div>
      </div>

      <div className="p-6 space-y-4">
        {/* Pricing */}
        <div className="pb-4 border-b border-white/8 space-y-3">
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/25">Pricing</p>
          <EditablePrice value={draft.monthly_price_cents} onChange={v => update("monthly_price_cents", v)} label="Monthly Price" suffix="/mo" />
          <EditablePrice value={draft.setup_fee_cents} onChange={v => update("setup_fee_cents", v)} label="Setup Fee (per request)" suffix="one-time" />
        </div>

        {/* Credits / units */}
        <div className="pb-4 border-b border-white/8 space-y-3">
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/25">Included Units</p>
          <div className="grid grid-cols-2 gap-3">
            <EditableNumber
              value={draft.included_units ?? -1}
              onChange={v => update("included_units", v === -1 ? null : v)}
              label={draft.unit_label ? `Included ${draft.unit_label}` : "Included Units"}
              suffix={draft.unit_label ?? ""}
              allowInfinite
            />
            {hasOverage && (
              <>
                <EditableNumber
                  value={draft.overage_block_size ?? 0}
                  onChange={v => update("overage_block_size", v)}
                  label="Overage Block Size"
                  suffix={draft.unit_label ?? "units"}
                  min={1}
                />
                <EditablePrice
                  value={draft.overage_block_price_cents ?? 0}
                  onChange={v => update("overage_block_price_cents", v)}
                  label="Overage Block Price"
                  suffix="/block"
                />
              </>
            )}
          </div>
        </div>

        {/* Stripe IDs */}
        <div className="space-y-3">
          <p className="text-[9px] font-bold uppercase tracking-widest text-white/25">Stripe Price IDs</p>
          <EditableStripeId value={draft.stripe_price_id_monthly}  onChange={v => update("stripe_price_id_monthly", v)}  label="Monthly Price ID" />
          <EditableStripeId value={draft.stripe_price_id_annually} onChange={v => update("stripe_price_id_annually", v)} label="Annual Price ID" />
        </div>

        <EditableToggle value={draft.show_when_locked} onChange={v => update("show_when_locked", v)} label="Show in nav when locked (upsell)" />
      </div>

      <div className={`px-6 py-4 border-t border-white/8 space-y-2 transition-opacity ${dirty || saveErr ? "opacity-100" : "opacity-40"}`}>
        {saveErr && <p className="text-xs text-red-400 text-center">{saveErr}</p>}
        <div className="flex items-center justify-between">
          <button onClick={() => { setDraft({ ...addon }); setDirty(false); }} disabled={!dirty || saving}
            className="text-xs text-white/40 hover:text-white/60 disabled:cursor-not-allowed transition-colors">
            Reset
          </button>
          <button onClick={handleSave} disabled={!dirty || saving}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors">
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminPlansPage() {
  const [tab,     setTab]     = useState<"plans" | "addons">("addons");
  const [plans,   setPlans]   = useState<Plan[]>([]);
  const [addons,  setAddons]  = useState<Addon[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getPlans(),
      fetch("/api/admin/addons").then(r => r.json()).catch(() => []),
    ]).then(([p, a]) => {
      setPlans(p);
      setAddons(Array.isArray(a) ? a : []);
      setLoading(false);
    });
  }, []);

  async function handlePlanSave(id: string, updates: Partial<Plan>) {
    const res = await fetch(`/api/admin/plans/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return { error: json?.error ?? "Save failed." };
    const merged: Partial<Plan> = { ...updates };
    if (json?.stripe_price_id_monthly)  merged.stripe_price_id_monthly  = json.stripe_price_id_monthly;
    if (json?.stripe_price_id_annually) merged.stripe_price_id_annually = json.stripe_price_id_annually;
    setPlans(prev => prev.map(p => p.id === id ? { ...p, ...merged } : p));
    return json;
  }

  async function handleAddonSave(slug: string, updates: Partial<Addon>) {
    const res = await fetch(`/api/admin/addons/${slug}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return { error: json?.error ?? "Save failed." };
    setAddons(prev => prev.map(a => a.slug === slug ? { ...a, ...updates, ...json } : a));
    return json;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 py-4 border-b border-white/8 flex-shrink-0">
        <h1 className="text-base font-bold text-white">Billing Configuration</h1>
        <p className="text-xs text-white/35 mt-0.5">Manage addon pricing and legacy plan limits.</p>
        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {(["addons", "plans"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors capitalize
                ${tab === t ? "bg-blue-600 text-white" : "text-white/40 hover:text-white/70"}`}>
              {t === "addons" ? "Modular Addons" : "Legacy Plans"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[1,2,3,4].map(i => <div key={i} className="h-80 bg-[#0e0e0e] rounded-2xl animate-pulse" />)}
          </div>
        ) : tab === "addons" ? (
          <>
            <div className="bg-blue-500/8 border border-blue-500/20 rounded-xl px-4 py-3 mb-6 flex items-start gap-3">
              <svg className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-xs font-semibold text-blue-300">Addon pricing applies to all new builder subscriptions</p>
                <p className="text-xs text-blue-400/60 mt-0.5">
                  Setup fees are charged per request (e.g. per community plat map). Updating the monthly price auto-creates a new Stripe price and archives the old one.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
              {addons.map(a => <AddonCard key={a.slug} addon={a} onSave={handleAddonSave} />)}
            </div>
          </>
        ) : (
          <>
            <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-3 mb-6 flex items-start gap-3">
              <svg className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <div>
                <p className="text-xs font-semibold text-amber-300">Legacy tiered plans — existing builders only</p>
                <p className="text-xs text-amber-400/60 mt-0.5">New builders use the modular addon system above. These plans remain active for existing subscribers.</p>
              </div>
            </div>
            <div className={`grid grid-cols-1 ${plans.length > 1 ? "lg:grid-cols-3" : "lg:grid-cols-2 max-w-2xl"} gap-6`}>
              {plans.map((plan, i) => (
                <PlanCard key={plan.id} plan={plan} index={i} onSave={handlePlanSave} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
