"use client";

import { useEffect, useState } from "react";
import { getPlans, updatePlan } from "@/lib/admin-api";
import { Plan } from "@/types/database";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPrice(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

const PLAN_STYLE: Record<string, string> = {
  launch: "from-white/5 to-white/3 border-white/10",
  studio: "from-blue-600/10 to-blue-600/5 border-blue-500/25",
  scale:  "from-violet-600/10 to-violet-600/5 border-violet-500/25",
};
const PLAN_ACCENT: Record<string, string> = {
  launch: "text-white/70",
  studio: "text-blue-400",
  scale:  "text-violet-400",
};

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

function PlanCard({ plan, onSave }: { plan: Plan; onSave: (id: string, updates: Partial<Plan>) => Promise<void> }) {
  const [draft,   setDraft]   = useState<Plan>({ ...plan });
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [dirty,   setDirty]   = useState(false);

  function update<K extends keyof Plan>(key: K, val: Plan[K]) {
    setDraft(prev => ({ ...prev, [key]: val }));
    setDirty(true);
  }

  async function handleSave() {
    setSaving(true);
    await onSave(draft.id, {
      rendering_credits_monthly:  draft.rendering_credits_monthly,
      ai_credits_monthly:         draft.ai_credits_monthly,
      max_projects:               draft.max_projects,
      seats_included:             draft.seats_included,
      max_storage_gb:             draft.max_storage_gb,
      includes_sitemaps:          draft.includes_sitemaps,
      stripe_price_id_monthly:    draft.stripe_price_id_monthly,
      stripe_price_id_annually:   draft.stripe_price_id_annually,
      is_active:                  draft.is_active,
    });
    setSaving(false);
    setSaved(true);
    setDirty(false);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleReset() {
    setDraft({ ...plan });
    setDirty(false);
  }

  return (
    <div className={`bg-gradient-to-b ${PLAN_STYLE[plan.name] ?? PLAN_STYLE.launch} border rounded-2xl overflow-hidden`}>

      {/* Header */}
      <div className="px-6 py-5 border-b border-white/8">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className={`text-lg font-extrabold ${PLAN_ACCENT[plan.name] ?? "text-white"}`}>{plan.display_name}</h2>
              {!draft.is_active && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 font-semibold">Inactive</span>
              )}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-white">{fmtPrice(plan.price_monthly)}</span>
              <span className="text-white/30 text-xs">/mo</span>
              <span className="text-white/20 text-xs ml-2">· {fmtPrice(plan.price_annually)}/yr</span>
            </div>
          </div>
          <EditableToggle value={draft.is_active} onChange={v => update("is_active", v)} label="Active" />
        </div>
      </div>

      {/* Editable limits */}
      <div className="p-6 space-y-4">
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
      <div className={`px-6 py-4 border-t border-white/8 flex items-center justify-between transition-opacity ${dirty ? "opacity-100" : "opacity-40"}`}>
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
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AdminPlansPage() {
  const [plans,   setPlans]   = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPlans().then(p => { setPlans(p); setLoading(false); });
  }, []);

  async function handleSave(id: string, updates: Partial<Plan>) {
    await updatePlan(id, updates);
    setPlans(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 py-4 border-b border-white/8 flex-shrink-0">
        <h1 className="text-base font-bold text-white">Plan Configuration</h1>
        <p className="text-xs text-white/35 mt-0.5">
          Adjust limits for each plan. Changes apply to new subscriptions and monthly credit resets.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="grid grid-cols-3 gap-6">
            {[1,2,3].map(i => <div key={i} className="h-96 bg-[#0e0e0e] rounded-2xl animate-pulse" />)}
          </div>
        ) : (
          <>
            <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-3 mb-6 flex items-start gap-3">
              <svg className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <div>
                <p className="text-xs font-semibold text-amber-300">Changing limits affects new subscriptions only</p>
                <p className="text-xs text-amber-400/60 mt-0.5">
                  Existing builders keep their current limits until their next renewal or until you manually update their account in Builder CRM.
                  Stripe price changes must be done in the Stripe dashboard — update the Price ID here after.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {plans.map(plan => (
                <PlanCard key={plan.id} plan={plan} onSave={handleSave} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
