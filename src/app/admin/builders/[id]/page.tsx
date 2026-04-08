"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { IMPERSONATE_KEY } from "@/lib/builder-api";
import {
  getBuilderById,
  updateBuilder,
  getBuilderProjects,
  getBuilderLeads,
  getCategoriesWithOptions,
} from "@/lib/admin-api";
import { Builder, Project, Lead, CategoryWithOptions } from "@/types/database";

type Tab = "overview" | "quotes" | "projects" | "categories" | "settings";

const PLAN_LABEL: Record<string, string> = {
  launch:     "Launch",
  studio:     "Studio",
  scale:      "Scale",
  starter:    "Launch",      // legacy mapping
  pro:        "Studio",      // legacy mapping
  enterprise: "Scale",       // legacy mapping
};
const PLAN_PRICE: Record<string, string> = {
  launch:     "$699/mo",
  studio:     "$1,499/mo",
  scale:      "$2,499/mo",
  starter:    "$699/mo",
  pro:        "$1,499/mo",
  enterprise: "$2,499/mo",
};
const PLAN_STYLE: Record<string, string> = {
  launch:     "text-white/60 bg-white/8 border-white/15",
  studio:     "text-blue-300 bg-blue-500/15 border-blue-400/30",
  scale:      "text-violet-300 bg-violet-500/15 border-violet-400/30",
  starter:    "text-white/60 bg-white/8 border-white/15",
  pro:        "text-blue-300 bg-blue-500/15 border-blue-400/30",
  enterprise: "text-violet-300 bg-violet-500/15 border-violet-400/30",
};
const STATUS_STYLE: Record<string, string> = {
  active:    "text-green-400 bg-green-400/10 border-green-400/20",
  inactive:  "text-white/30 bg-white/5 border-white/10",
  suspended: "text-red-400 bg-red-400/10 border-red-400/20",
  trial:     "text-amber-400 bg-amber-400/10 border-amber-400/20",
};
const QUOTE_STATUS_STYLE: Record<string, string> = {
  new:       "text-blue-400 bg-blue-400/10",
  contacted: "text-amber-400 bg-amber-400/10",
  qualified: "text-violet-400 bg-violet-400/10",
  converted: "text-green-400 bg-green-400/10",
  lost:      "text-white/30 bg-white/5",
};
const PROJECT_STATUS_STYLE: Record<string, string> = {
  live:           "text-green-400 bg-green-400/10",
  in_development: "text-blue-400 bg-blue-400/10",
  in_review:      "text-violet-400 bg-violet-400/10",
  pending_review: "text-amber-400 bg-amber-400/10",
  archived:       "text-white/30 bg-white/5",
};

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
function timeAgo(s: string) {
  const d = Date.now() - new Date(s).getTime();
  const m = Math.floor(d / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}
function quoteId(id: string) {
  return `#QT-${id.slice(-4).toUpperCase()}`;
}

export default function BuilderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tab,        setTab]        = useState<Tab>("overview");
  const [builder,    setBuilder]    = useState<Builder | null>(null);
  const [projects,   setProjects]   = useState<Project[]>([]);
  const [leads,      setLeads]      = useState<Lead[]>([]);
  const [categories, setCategories] = useState<CategoryWithOptions[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [editing,      setEditing]      = useState(false);
  const [editForm,     setEditForm]     = useState<Partial<Builder>>({});
  const [saving,         setSaving]         = useState(false);
  const [syncing,        setSyncing]        = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    const b = await getBuilderById(id);
    if (!b) { setLoading(false); return; }
    setBuilder(b);
    setEditForm(b);

    const projs = await getBuilderProjects(b.company_slug);
    setProjects(projs);

    const [leadsData, ...catArrays] = await Promise.all([
      getBuilderLeads(projs.map(p => p.id)),
      ...projs.map(p => getCategoriesWithOptions(p.id)),
    ]);
    setLeads(leadsData);
    setCategories(catArrays.flat());
    setLoading(false);
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleLogoUpload(file: File) {
    if (!builder) return;
    setLogoUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("builder_id", builder.id); // route persists via service role, bypasses RLS
    const res = await fetch("/api/builders/logo", { method: "POST", body: fd });
    if (res.ok) {
      const { url } = await res.json() as { url: string };
      setEditForm(f => ({ ...f, logo_url: url }));
      setBuilder(b => b ? { ...b, logo_url: url } : b);
    } else {
      const body = await res.json().catch(() => ({})) as { error?: string };
      alert(`Logo upload failed: ${body.error ?? res.statusText}`);
    }
    setLogoUploading(false);
  }

  async function handleSave() {
    if (!builder) return;
    setSaving(true);
    await updateBuilder(builder.id, editForm);
    setBuilder({ ...builder, ...editForm } as Builder);
    setEditing(false);
    setSaving(false);
  }

  async function handleSyncStripe() {
    if (!builder) return;
    setSyncing(true);
    const res = await fetch("/api/admin/builders/sync-stripe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ builder_id: builder.id }),
    });
    if (res.ok) {
      await loadData();
    } else {
      const body = await res.json().catch(() => ({})) as { error?: string };
      alert(`Sync failed: ${body.error ?? res.statusText}`);
    }
    setSyncing(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!builder) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-white/40 text-sm">Builder not found.</p>
        <Link href="/admin/builders" className="text-xs text-blue-400 hover:underline">← Back to CRM</Link>
      </div>
    );
  }

  const activeProjects = projects.filter(p => p.status === "live" || p.status === "in_development");
  const renewalDate = new Date(builder.client_since);
  renewalDate.setFullYear(renewalDate.getFullYear() + 1);

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Builder Header */}
      <div className="px-6 py-4 border-b border-white/8 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin/builders" className="text-white/35 hover:text-white transition-colors">
              <BackIcon className="w-4 h-4" />
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold text-white">{builder.company_name}</h1>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide ${PLAN_STYLE[builder.plan_tier]}`}>
                {PLAN_LABEL[builder.plan_tier]}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide ${STATUS_STYLE[builder.status]}`}>
                {builder.status}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.localStorage.setItem(IMPERSONATE_KEY, builder.id);
                }
                router.push("/builder/dashboard");
              }}
              className="px-3 py-1.5 border border-amber-500/30 text-xs text-amber-400 rounded-lg hover:bg-amber-500/10 transition-colors"
              title="View builder portal as this builder (support view)"
            >
              Impersonate Builder ↗
            </button>
            {editing ? (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-3 py-1.5 bg-blue-600 text-xs text-white font-medium rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <button
                  onClick={() => { setEditing(false); setEditForm(builder); }}
                  className="px-3 py-1.5 border border-white/12 text-xs text-white/50 rounded-lg hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-xs text-white font-medium rounded-lg hover:bg-blue-500 transition-colors"
              >
                <EditIcon className="w-3.5 h-3.5" /> Edit Details
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-white/35 mt-1.5 ml-7">
          Client since {new Date(builder.client_since).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
          {builder.location && ` • ${builder.location}`}
        </p>

        {/* Tabs */}
        <div className="flex items-center gap-0 mt-4 -mb-4 border-b border-white/8">
          {(["overview", "quotes", "projects", "categories", "settings"] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors capitalize ${
                tab === t
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-white/40 hover:text-white"
              }`}
            >
              {t === "categories" ? "Categories & Finishes" : t}
              {t === "quotes"    && leads.length    > 0 && <span className="ml-1.5 text-[9px] bg-white/10 px-1.5 py-0.5 rounded-full">{leads.length}</span>}
              {t === "projects"  && projects.length > 0 && <span className="ml-1.5 text-[9px] bg-white/10 px-1.5 py-0.5 rounded-full">{projects.length}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">

        {/* ── OVERVIEW ── */}
        {tab === "overview" && (
          <div className="p-6 grid grid-cols-3 gap-5">

            {/* Left column */}
            <div className="space-y-5">

              {/* Company Details */}
              <div className="bg-[#1a1a1a] border border-white/8 rounded-xl p-5">
                <h3 className="text-xs font-bold text-white mb-4">Company Details</h3>

                {builder.website_url && (
                  <div className="mb-3">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1">Website</p>
                    <a href={builder.website_url} target="_blank" rel="noreferrer"
                      className="text-xs text-blue-400 hover:underline flex items-center gap-1">
                      {builder.website_url.replace(/^https?:\/\//, "")} <ExternalIcon className="w-3 h-3" />
                    </a>
                  </div>
                )}

                {builder.primary_contact_name && (
                  <div className="mb-3">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1">Primary Contact</p>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-600/30 flex items-center justify-center flex-shrink-0">
                        <span className="text-[9px] font-bold text-blue-300">{initials(builder.primary_contact_name)}</span>
                      </div>
                      <p className="text-xs text-white/80 font-medium">{builder.primary_contact_name}</p>
                    </div>
                  </div>
                )}

                {(builder.contact_email || builder.phone) && (
                  <div className="mb-3">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1">Contact Info</p>
                    {builder.contact_email && <p className="text-xs text-white/60 flex items-center gap-1.5"><MailIcon className="w-3 h-3 text-white/25" /> {builder.contact_email}</p>}
                    {builder.phone        && <p className="text-xs text-white/60 flex items-center gap-1.5 mt-0.5"><PhoneIcon className="w-3 h-3 text-white/25" /> {builder.phone}</p>}
                  </div>
                )}

                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1">Billing</p>
                  <p className="text-xs text-white/60">
                    {builder.billing_cycle === "annually" ? "Annually" : "Monthly"}
                    {" • Renews "}{renewalDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                  {builder.ein && <p className="text-[10px] text-white/25 mt-0.5">EIN: {builder.ein}</p>}
                </div>
              </div>

              {/* Usage Limits */}
              <div className="bg-[#1a1a1a] border border-white/8 rounded-xl p-5">
                <h3 className="text-xs font-bold text-white mb-4">Usage Limits</h3>
                {[
                  { label: "Active Projects",  val: builder.active_projects_count, max: builder.max_projects,        bar: "bg-blue-500" },
                  { label: "Monthly Quotes",   val: builder.monthly_quotes_count,  max: builder.max_monthly_quotes,   bar: "bg-green-500" },
                  { label: "Storage",          val: `${builder.storage_used_gb}GB`, maxLabel: `${builder.max_storage_gb}GB`, pct: builder.storage_used_gb / builder.max_storage_gb, bar: "bg-violet-500" },
                ].map((u, i) => (
                  <div key={i} className="mb-3.5 last:mb-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] text-white/50">{u.label}</p>
                      <p className="text-[10px] text-white/40">
                        {typeof u.val === "number" ? `${u.val} / ${u.max}` : `${u.val} / ${u.maxLabel}`}
                      </p>
                    </div>
                    <div className="w-full bg-white/6 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${u.bar}`}
                        style={{ width: `${Math.min(100, ((u.pct ?? (u.val as number) / (u.max as number)) * 100))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right columns */}
            <div className="col-span-2 space-y-5">

              {/* Recent Quotes */}
              <div className="bg-[#1a1a1a] border border-white/8 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
                  <h3 className="text-xs font-bold text-white">Recent Quotes</h3>
                  <button onClick={() => setTab("quotes")} className="text-xs text-white/35 hover:text-blue-400 transition-colors">
                    View All Quotes →
                  </button>
                </div>
                {leads.length === 0 ? (
                  <div className="py-8 text-center text-white/25 text-xs">No quotes yet</div>
                ) : (
                  <div>
                    <div className="grid grid-cols-5 gap-4 px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-white/25 border-b border-white/5">
                      <span>Quote ID</span><span className="col-span-2">Model</span><span>Total Price</span><span>Status</span>
                    </div>
                    {leads.slice(0, 4).map(l => (
                      <div key={l.id} className="grid grid-cols-5 gap-4 items-center px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors">
                        <span className="text-[10px] font-mono text-white/40">{quoteId(l.id)}</span>
                        <div className="col-span-2">
                          <p className="text-xs text-white/80">
                            {projects.find(p => p.id === l.project_id)?.name ?? "—"}
                          </p>
                          <p className="text-[10px] text-white/30">{l.first_name} {l.last_name}</p>
                        </div>
                        <span className="text-xs font-medium text-white/70">{l.total_value ? fmt(l.total_value) : "—"}</span>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full w-fit ${QUOTE_STATUS_STYLE[l.status]}`}>
                          {l.status.charAt(0).toUpperCase() + l.status.slice(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Active Projects */}
              <div className="bg-[#1a1a1a] border border-white/8 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
                  <h3 className="text-xs font-bold text-white">Active Projects</h3>
                  <button onClick={() => setTab("projects")} className="text-xs text-white/35 hover:text-blue-400 transition-colors">
                    View All Projects →
                  </button>
                </div>
                {activeProjects.length === 0 ? (
                  <div className="py-8 text-center text-white/25 text-xs">No active projects</div>
                ) : (
                  <div>
                    <div className="grid grid-cols-5 gap-4 px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-white/25 border-b border-white/5">
                      <span className="col-span-2">Project Name</span><span>Model</span><span>Status</span><span>Last Activity</span>
                    </div>
                    {activeProjects.slice(0, 3).map(p => (
                      <div key={p.id} className="grid grid-cols-5 gap-4 items-center px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors">
                        <div className="col-span-2 flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-600/40 to-violet-600/40 flex items-center justify-center flex-shrink-0">
                            <span className="text-[9px] font-bold text-white/60">{initials(p.name)}</span>
                          </div>
                          <p className="text-xs text-white/80 truncate">{p.name}</p>
                        </div>
                        <span className="text-xs text-white/40 truncate">{p.home_type ?? "—"}</span>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full w-fit ${PROJECT_STATUS_STYLE[p.status ?? "pending_review"]}`}>
                          {p.status === "live" ? "Live" : p.status === "in_development" ? "In Dev" : "Setup"}
                        </span>
                        <span className="text-[10px] text-white/30">{timeAgo(p.updated_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Categories & Finishes preview */}
              <div className="bg-[#1a1a1a] border border-white/8 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
                  <h3 className="text-xs font-bold text-white">Categories & Finishes Configured</h3>
                  <button onClick={() => setTab("categories")} className="text-[10px] text-white/35 hover:text-blue-400 transition-colors">
                    Read-only view →
                  </button>
                </div>
                {categories.length === 0 ? (
                  <div className="py-8 text-center text-white/25 text-xs">No categories configured</div>
                ) : (
                  <div className="flex gap-2 p-4 flex-wrap">
                    {categories.slice(0, 6).map(c => (
                      <div key={c.id} className="bg-[#111] border border-white/8 rounded-xl p-3 w-28 text-center">
                        <p className="text-[10px] font-medium text-white/70 truncate">{c.name}</p>
                        <p className="text-[9px] text-white/30 mt-0.5">{c.options.length} options</p>
                      </div>
                    ))}
                    {categories.length > 6 && (
                      <div className="bg-[#111] border border-white/8 rounded-xl p-3 w-28 text-center flex items-center justify-center">
                        <p className="text-[10px] text-white/30">+{categories.length - 6} more</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── QUOTES ── */}
        {tab === "quotes" && (
          <div className="p-6">
            <div className="bg-[#1a1a1a] border border-white/8 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
                <h3 className="text-sm font-bold text-white">All Quotes Generated</h3>
                <p className="text-xs text-white/30">Showing {leads.length} quotes</p>
              </div>
              {leads.length === 0 ? (
                <div className="py-16 text-center text-white/25 text-sm">No quotes yet for this builder</div>
              ) : (
                <>
                  <div className="grid grid-cols-12 gap-4 px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-white/25 border-b border-white/5">
                    <span className="col-span-2">Quote ID</span>
                    <span className="col-span-3">Model Configured</span>
                    <span className="col-span-2">Total Price</span>
                    <span className="col-span-2">Status</span>
                    <span className="col-span-2">Date Generated</span>
                    <span className="col-span-1">Actions</span>
                  </div>
                  {leads.map(l => (
                    <div key={l.id} className="grid grid-cols-12 gap-4 items-center px-4 py-3.5 border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors">
                      <div className="col-span-2">
                        <p className="text-[10px] font-mono text-white/50">{quoteId(l.id)}</p>
                      </div>
                      <div className="col-span-3">
                        <p className="text-xs text-white/80 truncate">
                          {projects.find(p => p.id === l.project_id)?.name ?? "Unknown Model"}
                        </p>
                        <p className="text-[10px] text-white/30">Client: {l.first_name} {l.last_name}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-sm font-bold text-white/80">{l.total_value ? fmt(l.total_value) : "—"}</p>
                      </div>
                      <div className="col-span-2">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${QUOTE_STATUS_STYLE[l.status]}`}>
                          {l.status.charAt(0).toUpperCase() + l.status.slice(1)}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-white/40">
                          {new Date(l.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </div>
                      <div className="col-span-1 flex items-center gap-1">
                        <button className="text-[10px] px-2 py-1 rounded bg-white/6 text-white/40 hover:text-white hover:bg-white/10 transition-colors">PDF</button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── PROJECTS ── */}
        {tab === "projects" && (
          <div className="p-6">
            <div className="bg-[#1a1a1a] border border-white/8 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
                <h3 className="text-sm font-bold text-white">All Projects</h3>
                <p className="text-xs text-white/30">{projects.length} projects</p>
              </div>
              {projects.length === 0 ? (
                <div className="py-16 text-center text-white/25 text-sm">
                  No projects linked to this builder yet.
                  <p className="text-xs mt-1">Projects are linked via <code className="text-white/40">company_slug: {builder.company_slug}</code></p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-12 gap-4 px-4 py-2 text-[9px] font-bold uppercase tracking-widest text-white/25 border-b border-white/5">
                    <span className="col-span-4">Project</span>
                    <span className="col-span-2">Status</span>
                    <span className="col-span-2">Type</span>
                    <span className="col-span-2">Beds / Baths</span>
                    <span className="col-span-2">Actions</span>
                  </div>
                  {projects.map(p => (
                    <div key={p.id} className="grid grid-cols-12 gap-4 items-center px-4 py-3.5 border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors">
                      <div className="col-span-4 flex items-center gap-3">
                        {p.thumbnail_url ? (
                          <img src={p.thumbnail_url} alt={p.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600/30 to-violet-600/30 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-white/40">{initials(p.name)}</span>
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-medium text-white/80">{p.name}</p>
                          <p className="text-[10px] text-white/30">{p.slug}</p>
                        </div>
                      </div>
                      <div className="col-span-2">
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${PROJECT_STATUS_STYLE[p.status ?? "pending_review"]}`}>
                          {(p.status ?? "pending").replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-white/50 capitalize">{p.home_type ?? "—"}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-white/50">{p.beds ?? "—"}bd / {p.baths ?? "—"}ba</p>
                      </div>
                      <div className="col-span-2 flex items-center gap-1.5 flex-wrap">
                        <Link
                          href={`/admin/requests/${p.id}`}
                          className="text-[10px] px-2 py-1 rounded bg-white/6 text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                        >
                          Details
                        </Link>
                        <Link
                          href={`/admin/node-bridge?project=${p.id}`}
                          className="text-[10px] px-2 py-1 rounded bg-white/6 text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                        >
                          Node Bridge
                        </Link>
                        {p.status === "live" && p.slug && p.company_slug && (
                          <a href={`/project/${p.company_slug}/${p.slug}`} target="_blank" rel="noreferrer"
                            className="text-[10px] px-2 py-1 rounded bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-colors border border-green-400/20">
                            Preview ↗
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── CATEGORIES & FINISHES ── */}
        {tab === "categories" && (
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-2 text-xs text-white/35 bg-white/4 border border-white/8 rounded-lg px-3 py-2 w-fit">
              <EyeIcon className="w-3.5 h-3.5" /> Read-only view — categories are configured per project in Node Bridge
            </div>

            {projects.map(project => {
              const projCats = categories.filter(c => c.project_id === project.id);
              if (projCats.length === 0) return null;
              return (
                <div key={project.id} className="bg-[#1a1a1a] border border-white/8 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-white/8">
                    <div className="w-5 h-5 rounded bg-blue-600/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-[9px] font-bold text-blue-300">{initials(project.name)}</span>
                    </div>
                    <h3 className="text-xs font-bold text-white">{project.name}</h3>
                    <span className="text-[10px] text-white/30">{projCats.length} categories</span>
                  </div>
                  <div className="divide-y divide-white/5">
                    {projCats.map(cat => (
                      <div key={cat.id} className="px-4 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium text-white/80">{cat.name}</p>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium capitalize ${
                            cat.phase === "exterior" ? "text-amber-400 bg-amber-400/10" :
                            cat.phase === "interior" ? "text-blue-400 bg-blue-400/10" :
                            "text-white/40 bg-white/6"
                          }`}>
                            {cat.phase}
                          </span>
                        </div>
                        <div className="flex gap-1.5 flex-wrap">
                          {cat.options.map(opt => (
                            <span key={opt.id} className="text-[10px] px-2 py-0.5 bg-white/6 border border-white/8 rounded-lg text-white/50">
                              {opt.friendly_name}
                              {opt.price_impact !== 0 && (
                                <span className="ml-1 text-white/30">
                                  {opt.price_impact > 0 ? "+" : ""}{fmt(opt.price_impact)}
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {projects.every(p => categories.filter(c => c.project_id === p.id).length === 0) && (
              <div className="py-16 text-center text-white/25 text-sm">
                No categories configured for any project yet.
              </div>
            )}
          </div>
        )}

        {/* ── SETTINGS ── */}
        {tab === "settings" && (
          <div className="p-6 space-y-5 max-w-2xl">
            <h2 className="text-sm font-bold text-white">Builder Account Settings</h2>
            <p className="text-xs text-white/35 -mt-3">Manage account details, billing, notification preferences, and system integrations for this builder profile.</p>

            {/* Branding */}
            <div className="bg-[#1a1a1a] border border-white/8 rounded-xl p-5">
              <h3 className="text-xs font-bold text-white mb-4">Branding</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1">Company Logo</p>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleLogoUpload(file);
                    }}
                  />
                  {editing ? (
                    <div
                      onClick={() => !logoUploading && logoInputRef.current?.click()}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => {
                        e.preventDefault();
                        const file = e.dataTransfer.files[0];
                        if (file?.type.startsWith("image/")) handleLogoUpload(file);
                      }}
                      className="flex flex-col items-center justify-center gap-1.5 border border-dashed border-white/15 rounded-lg h-16 cursor-pointer hover:border-blue-500/50 hover:bg-blue-500/5 transition-colors"
                    >
                      {logoUploading ? (
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      ) : (editForm.logo_url ?? builder.logo_url) ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={editForm.logo_url ?? builder.logo_url!} alt="Logo" className="h-8 max-w-full object-contain" />
                          <span className="text-[9px] text-white/30">Click to replace</span>
                        </>
                      ) : (
                        <>
                          <UploadIcon className="w-4 h-4 text-white/25" />
                          <span className="text-[10px] text-white/40">Click or drag to upload</span>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 bg-[#111] border border-white/8 rounded-lg px-3 py-2">
                      {builder.logo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={builder.logo_url} alt="Logo" className="h-6 object-contain" />
                      ) : null}
                      <p className="text-xs text-white/50 truncate">{builder.logo_url ? "Logo set" : "No logo uploaded"}</p>
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1">Brand Accent Color</p>
                  {editing ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={editForm.accent_color ?? "#3B82F6"}
                        onChange={e => setEditForm(f => ({ ...f, accent_color: e.target.value }))}
                        className="w-9 h-9 rounded-lg border border-white/12 bg-transparent cursor-pointer p-1 flex-shrink-0"
                      />
                      <input
                        value={editForm.accent_color ?? "#3B82F6"}
                        onChange={e => setEditForm(f => ({ ...f, accent_color: e.target.value }))}
                        placeholder="#3B82F6"
                        className="w-full bg-[#111] border border-white/12 rounded-lg px-3 py-2 text-xs text-white font-mono outline-none focus:border-blue-500/60"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 bg-[#111] border border-white/8 rounded-lg px-3 py-2">
                      <div
                        className="w-5 h-5 rounded flex-shrink-0"
                        style={{ background: builder.accent_color ?? "#3B82F6" }}
                      />
                      <p className="text-xs text-white/60 font-mono">{builder.accent_color ?? "#3B82F6"}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Plan Tier Details */}
            <div className="bg-[#1a1a1a] border border-white/8 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-xs font-bold text-white">Plan Tier Details</h3>
                <span className="text-[9px] text-white/25 uppercase tracking-widest font-medium">Read Only</span>
              </div>
              <div className="bg-[#111] rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-bold text-white">{PLAN_LABEL[builder.plan_tier]}</p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${STATUS_STYLE[builder.status]}`}>
                      {builder.status.charAt(0).toUpperCase() + builder.status.slice(1)}
                    </span>
                  </div>
                  <p className="text-xs text-white/40">
                    {PLAN_PRICE[builder.plan_tier]} / month • Renews {renewalDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                  <p className="text-xs text-white/30 mt-0.5">{builder.seats_included} Seats Included ({builder.seats_used} Used)</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] uppercase tracking-widest text-white/25 mb-1">Rendering Credits</p>
                  {builder.rendering_credits_total === -1 || builder.rendering_credits_total >= 9999 ? (
                    <p className="text-lg font-bold text-white">∞ <span className="text-white/30 font-normal text-sm">Unlimited</span></p>
                  ) : (
                    <>
                      <p className="text-lg font-bold text-white">
                        {builder.rendering_credits.toLocaleString()}
                        <span className="text-white/30 font-normal text-sm"> / {builder.rendering_credits_total.toLocaleString()}</span>
                      </p>
                      <div className="w-32 bg-white/6 rounded-full h-1.5 mt-1 ml-auto">
                        <div
                          className="h-1.5 rounded-full bg-blue-500"
                          style={{ width: `${Math.min((builder.rendering_credits / builder.rendering_credits_total) * 100, 100)}%` }}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Billing Information */}
            <div className="bg-[#1a1a1a] border border-white/8 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold text-white">Billing Information</h3>
                <button
                  onClick={handleSyncStripe}
                  disabled={syncing}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] text-white/50 hover:text-white/70 rounded-lg transition-colors disabled:opacity-40"
                >
                  {syncing ? (
                    <div className="w-3 h-3 border border-white/40 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                  Sync from Stripe
                </button>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1">Billing Email</p>
                    {editing ? (
                      <input
                        value={editForm.billing_email ?? ""}
                        onChange={e => setEditForm(f => ({ ...f, billing_email: e.target.value }))}
                        className="w-full bg-[#111] border border-white/12 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500/60"
                      />
                    ) : (
                      <p className="text-xs text-white/60 bg-[#111] border border-white/8 rounded-lg px-3 py-2">{builder.billing_email ?? "—"}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1">VAT / Tax ID</p>
                    {editing ? (
                      <input
                        value={editForm.vat_tax_id ?? ""}
                        onChange={e => setEditForm(f => ({ ...f, vat_tax_id: e.target.value }))}
                        className="w-full bg-[#111] border border-white/12 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500/60"
                      />
                    ) : (
                      <p className="text-xs text-white/60 bg-[#111] border border-white/8 rounded-lg px-3 py-2">{builder.vat_tax_id ?? "—"}</p>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1">Billing Address</p>
                  {editing ? (
                    <input
                      value={editForm.billing_address ?? ""}
                      onChange={e => setEditForm(f => ({ ...f, billing_address: e.target.value }))}
                      className="w-full bg-[#111] border border-white/12 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500/60"
                    />
                  ) : (
                    <p className="text-xs text-white/60 bg-[#111] border border-white/8 rounded-lg px-3 py-2">
                      {[builder.billing_address, builder.city, builder.state, builder.zip].filter(Boolean).join(", ") || "—"}
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1">Payment Method</p>
                  {builder.payment_method_last4 ? (
                    <div className="flex items-center gap-2 bg-[#111] border border-white/8 rounded-lg px-3 py-2">
                      <div className="w-8 h-5 bg-blue-600/20 border border-blue-500/20 rounded flex items-center justify-center flex-shrink-0">
                        <span className="text-[8px] font-bold text-blue-400 uppercase">{builder.payment_method_type ?? "CARD"}</span>
                      </div>
                      <p className="text-xs text-white/60">
                        {builder.payment_method_type ?? "Card"} •••• {builder.payment_method_last4}
                        {builder.payment_method_expiry && <span className="text-white/30"> · Expires {builder.payment_method_expiry}</span>}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-white/30 bg-[#111] border border-white/8 rounded-lg px-3 py-2 italic">No payment method on file</p>
                  )}
                </div>
              </div>
            </div>

            {editing && (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-5 py-2.5 bg-blue-600 text-sm text-white font-medium rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <button
                  onClick={() => { setEditing(false); setEditForm(builder); }}
                  className="px-5 py-2.5 border border-white/12 text-sm text-white/50 font-medium rounded-lg hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Icons
function BackIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>;
}
function EditIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>;
}
function ExternalIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>;
}
function MailIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>;
}
function PhoneIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>;
}
function EyeIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>;
}
function UploadIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/></svg>;
}
