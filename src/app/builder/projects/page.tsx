"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  getBuilderProjects,
  getProjectRequests,
  createProjectRequest,
  ProjectRequest,
} from "@/lib/builder-api";
import { Project, RequestCategory } from "@/types/database";

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, string> = {
  live:            "bg-emerald-500/12 text-emerald-400 border border-emerald-500/20",
  in_development:  "bg-blue-500/12 text-blue-400 border border-blue-500/20",
  in_review:       "bg-amber-500/12 text-amber-400 border border-amber-500/20",
  pending_review:  "bg-white/6 text-white/40 border border-white/10",
  archived:        "bg-white/4 text-white/25 border border-white/6",
};
const STATUS_LABEL: Record<string, string> = {
  live: "Live", in_development: "In Development",
  in_review: "In Review", pending_review: "Pending Review", archived: "Archived",
};
const HOME_TYPES = [
  { id: "single_family", label: "Single Family" },
  { id: "townhome",      label: "Townhome"      },
  { id: "duplex",        label: "Duplex"        },
  { id: "condo",         label: "Condo"         },
  { id: "custom",        label: "Custom"        },
];
const BUDGET_RANGES = ["Under $300K", "$300K–$500K", "$500K–$750K", "$750K–$1M", "$1M+"];
const PHASES = [
  { id: "exterior",  label: "Exterior"  },
  { id: "interior",  label: "Interior"  },
  { id: "blueprint", label: "Blueprint" },
];

const EMPTY_FORM = {
  project_name:   "",
  home_type:      "single_family",
  floors:         1,
  beds:           3,
  baths:          2,
  square_footage: "",
  budget_range:   "",
  starting_price: "",
  description:    "",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPrice(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function timeAgo(dateStr: string) {
  const diff  = Date.now() - new Date(dateStr).getTime();
  const days  = Math.floor(diff / 86400000);
  if (days < 1)  return "Today";
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Shared dark input/select classes
const INPUT = "w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/60 focus:border-blue-500/40 transition-colors";
const SELECT = "w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 focus:outline-none focus:ring-1 focus:ring-blue-500/60 focus:border-blue-500/40 transition-colors";

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const searchParams = useSearchParams();
  const [projects,   setProjects]   = useState<Project[]>([]);
  const [requests,   setRequests]   = useState<ProjectRequest[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [showForm,   setShowForm]   = useState(searchParams.get("new") === "1");
  const [tab,        setTab]        = useState<"live" | "requests">("live");
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [step,       setStep]       = useState<"info" | "categories" | "success">("info");
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<RequestCategory[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([getBuilderProjects(), getProjectRequests()]).then(([p, r]) => {
      setProjects(p); setRequests(r); setLoading(false);
    });
  }, []);

  function resetForm() {
    setForm(EMPTY_FORM);
    setCategories([]);
    setStep("info");
    setShowForm(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (step === "info") { setStep("categories"); return; }
    setSubmitting(true);
    const result = await createProjectRequest({
      project_name:      form.project_name,
      home_type:         form.home_type,
      floors:            Number(form.floors),
      beds:              form.beds   ? Number(form.beds)   : null,
      baths:             form.baths  ? Number(form.baths)  : null,
      square_footage:    form.square_footage ? Number(form.square_footage) : null,
      budget_range:      form.budget_range   || null,
      starting_price:    form.starting_price ? Number(form.starting_price) : null,
      description:       form.description   || null,
      categories_config: categories.length > 0 ? categories : null,
    });
    setSubmitting(false);
    if (result) {
      setRequests(prev => [result, ...prev]);
      setStep("success");
      setTimeout(() => { resetForm(); setTab("requests"); }, 2500);
    }
  }

  function set(key: keyof typeof EMPTY_FORM, val: string | number) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  function addCategory() {
    setCategories(prev => [...prev, { name: "", phase: "exterior", options: [] }]);
  }
  function removeCategory(i: number) {
    setCategories(prev => prev.filter((_, idx) => idx !== i));
  }
  function setCatField(i: number, field: keyof RequestCategory, val: string) {
    setCategories(prev => prev.map((c, idx) =>
      idx !== i ? c : { ...c, [field]: val }
    ));
  }
  function addOption(catIdx: number) {
    setCategories(prev => prev.map((c, i) =>
      i !== catIdx ? c : { ...c, options: [...c.options, { name: "", price: 0 }] }
    ));
  }
  function removeOption(catIdx: number, optIdx: number) {
    setCategories(prev => prev.map((c, i) =>
      i !== catIdx ? c : { ...c, options: c.options.filter((_, j) => j !== optIdx) }
    ));
  }
  function setOptField(catIdx: number, optIdx: number, field: "name" | "price", val: string | number) {
    setCategories(prev => prev.map((c, i) =>
      i !== catIdx ? c : {
        ...c, options: c.options.map((o, j) =>
          j !== optIdx ? o : { ...o, [field]: field === "price" ? Number(val) : val }
        ),
      }
    ));
  }

  // ── Stats ────────────────────────────────────────────────────────────────────
  const liveCount  = projects.filter(p => (p as any).status === "live").length;
  const devCount   = projects.filter(p => (p as any).status === "in_development").length;
  const pendCount  = requests.filter(r => r.status === "pending_review").length;

  return (
    <div className="p-8 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-extrabold text-white tracking-tight"
            style={{ fontFamily: "var(--font-syne), sans-serif" }}
          >
            My Models
          </h1>
          <p className="text-sm text-white/30 mt-0.5">Manage configurators, track requests and pricing options.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-blue-600/20"
        >
          <span className="text-base leading-none">+</span> New Model Request
        </button>
      </div>

      {/* Stats bar */}
      {!loading && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total",          value: projects.length, accent: "text-white"        },
            { label: "Live",           value: liveCount,       accent: "text-emerald-400"  },
            { label: "In Development", value: devCount,        accent: "text-blue-400"     },
            { label: "Pending",        value: pendCount,       accent: "text-amber-400"    },
          ].map(s => (
            <div key={s.label} className="bg-[#0e0e0e] rounded-2xl border border-white/8 px-5 py-4 hover:border-white/14 transition-colors">
              <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold">{s.label}</p>
              <p
                className={`text-3xl font-extrabold mt-1 ${s.accent}`}
                style={{ fontFamily: "var(--font-syne), sans-serif" }}
              >
                {s.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white/4 border border-white/8 rounded-xl w-fit mb-6">
        {(["live", "requests"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              tab === t
                ? "bg-[#141414] shadow-sm text-white border border-white/10"
                : "text-white/30 hover:text-white/60"
            }`}>
            {t === "live" ? `Active (${projects.length})` : `Requests (${requests.length})`}
          </button>
        ))}
      </div>

      {/* ── Active projects grid ── */}
      {tab === "live" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-[#0e0e0e] rounded-2xl border border-white/8 h-64 animate-pulse" />
            ))
          ) : projects.length === 0 ? (
            <div className="col-span-3 bg-[#0e0e0e] rounded-2xl border border-white/8 py-20 text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-center mx-auto mb-3">
                <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} className="w-7 h-7">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21" />
                </svg>
              </div>
              <p className="text-white/30 text-sm mb-3">No active models yet.</p>
              <button onClick={() => setShowForm(true)} className="text-blue-400 text-sm font-medium hover:text-blue-300 transition-colors">
                Submit your first model request →
              </button>
            </div>
          ) : (
            projects.map(project => {
              const status = (project as any).status ?? "live";
              return (
                <Link
                  key={project.id}
                  href={`/builder/projects/${project.id}`}
                  className="group bg-[#0e0e0e] rounded-2xl border border-white/8 overflow-hidden hover:border-white/18 hover:shadow-2xl hover:shadow-black/40 transition-all block"
                >
                  {/* Thumbnail */}
                  <div className="relative h-40 overflow-hidden">
                    {(project as any).thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={(project as any).thumbnail_url}
                        alt={project.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-[#080808] relative flex items-center justify-center">
                        <div className="absolute inset-0 blueprint-grid opacity-40" />
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 via-transparent to-violet-900/10" />
                        <svg viewBox="0 0 24 24" fill="none" stroke="rgba(59,130,246,0.25)" strokeWidth="0.8" className="w-20 h-20 relative z-10">
                          <path strokeLinecap="round" strokeLinejoin="round"
                            d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21" />
                        </svg>
                      </div>
                    )}
                    <span className={`absolute top-3 right-3 text-xs px-2.5 py-1 rounded-full font-semibold ${STATUS_STYLE[status]}`}>
                      {STATUS_LABEL[status]}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <h3
                      className="font-bold text-white/80 text-sm leading-tight group-hover:text-white transition-colors"
                      style={{ fontFamily: "var(--font-syne), sans-serif" }}
                    >
                      {project.name}
                    </h3>
                    <p className="text-xs text-white/30 mt-1">
                      {project.beds}bd · {project.baths}ba
                      {project.floors ? ` · ${project.floors} fl` : ""}
                      {project.sqft ? ` · ${project.sqft.toLocaleString()} sqft` : ""}
                    </p>
                    {project.base_price > 0 && (
                      <p className="text-sm font-bold text-white/70 mt-2">
                        {fmtPrice(project.base_price)} <span className="text-xs font-normal text-white/25">starting</span>
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/6">
                      <p className="text-[11px] text-white/20">{timeAgo(project.created_at)}</p>
                      <span className="text-xs text-blue-400 font-medium group-hover:text-blue-300 transition-colors">
                        View details →
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      )}

      {/* ── Project requests table ── */}
      {tab === "requests" && (
        <div className="bg-[#0e0e0e] rounded-2xl border border-white/8 overflow-hidden">
          {requests.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-white/30 text-sm mb-3">No model requests yet.</p>
              <button onClick={() => setShowForm(true)} className="text-blue-400 text-sm font-medium hover:text-blue-300 transition-colors">
                Submit a request →
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 bg-white/3">
                  {["Project", "Type", "Specs", "Starting Price", "Status", "Submitted"].map(h => (
                    <th key={h} className="text-left px-5 py-3 font-semibold text-white/25 text-[10px] uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {requests.map(req => (
                  <tr key={req.id} className="hover:bg-white/3 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-white/80">{req.project_name}</p>
                      {req.description && <p className="text-xs text-white/25 truncate max-w-xs mt-0.5">{req.description}</p>}
                    </td>
                    <td className="px-4 py-4 text-white/40 capitalize text-xs">{req.home_type.replace("_", " ")}</td>
                    <td className="px-4 py-4 text-white/40 text-xs">
                      {req.beds}bd · {req.baths}ba · {req.floors}fl
                      {req.square_footage ? ` · ${req.square_footage.toLocaleString()} sqft` : ""}
                    </td>
                    <td className="px-4 py-4 text-white/60 text-sm font-semibold">
                      {req.starting_price ? fmtPrice(req.starting_price) : <span className="text-white/15">—</span>}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STATUS_STYLE[req.status]}`}>
                        {STATUS_LABEL[req.status]}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-white/25 text-xs">
                      {new Date(req.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── New Project Request slide-over ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={resetForm} />
          <div ref={panelRef} className="w-[520px] bg-[#0a0a0a] border-l border-white/8 shadow-2xl flex flex-col overflow-hidden">

            {/* Panel header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
              <div>
                <h2
                  className="font-bold text-white text-lg"
                  style={{ fontFamily: "var(--font-syne), sans-serif" }}
                >
                  Request New Model
                </h2>
                {/* Step indicator */}
                <div className="flex items-center gap-2 mt-2">
                  {["info", "categories"].map((s, i) => (
                    <div key={s} className="flex items-center gap-1.5">
                      {i > 0 && <div className="w-6 h-px bg-white/10" />}
                      <div className={`flex items-center gap-1.5 text-xs font-medium ${
                        step === s ? "text-blue-400" : step === "success" || (s === "info" && step === "categories") ? "text-emerald-400" : "text-white/25"
                      }`}>
                        <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          step === s ? "bg-blue-600 text-white" : (step === "success" || (s === "info" && step === "categories")) ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-white/6 text-white/25"
                        }`}>{i + 1}</span>
                        {s === "info" ? "Details" : "Options"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={resetForm} className="text-white/25 hover:text-white/60 text-xl leading-none transition-colors">×</button>
            </div>

            {/* Success */}
            {step === "success" ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/12 border border-emerald-500/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p
                    className="font-bold text-white text-xl"
                    style={{ fontFamily: "var(--font-syne), sans-serif" }}
                  >
                    Request Submitted
                  </p>
                  <p className="text-white/40 text-sm mt-1">Our team will review and reach out shortly.</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto p-6 space-y-5">

                  {/* ── Step 1: Basic info ── */}
                  {step === "info" && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Model Name *</label>
                        <input required value={form.project_name} onChange={e => set("project_name", e.target.value)}
                          placeholder="e.g. The Oakwood, The Summit"
                          className={INPUT} />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Home Type *</label>
                          <select required value={form.home_type} onChange={e => set("home_type", e.target.value)} className={SELECT}>
                            {HOME_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Starting Price</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 text-sm">$</span>
                            <input type="number" value={form.starting_price} onChange={e => set("starting_price", e.target.value)}
                              placeholder="350,000"
                              className={INPUT + " pl-7"} />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-3">
                        {[
                          { key: "floors" as const, label: "Floors", min: 1, max: 4 },
                          { key: "beds"   as const, label: "Beds",   min: 1 },
                        ].map(f => (
                          <div key={f.key}>
                            <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">{f.label}</label>
                            <input type="number" min={f.min} max={f.max} value={form[f.key]} onChange={e => set(f.key, e.target.value)}
                              className={INPUT} />
                          </div>
                        ))}
                        <div>
                          <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Baths</label>
                          <input type="number" min={1} step={0.5} value={form.baths} onChange={e => set("baths", e.target.value)}
                            className={INPUT} />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Sqft</label>
                          <input type="number" value={form.square_footage} onChange={e => set("square_footage", e.target.value)}
                            placeholder="2400" className={INPUT} />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Budget Range</label>
                        <select value={form.budget_range} onChange={e => set("budget_range", e.target.value)} className={SELECT}>
                          <option value="">Select range…</option>
                          {BUDGET_RANGES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Description & Notes</label>
                        <textarea rows={3} value={form.description} onChange={e => set("description", e.target.value)}
                          placeholder="Style preferences, special requirements, reference inspirations…"
                          className={INPUT + " resize-none"} />
                      </div>

                      <div className="bg-blue-600/8 border border-blue-500/15 rounded-xl p-4 text-xs text-blue-300/70">
                        <p className="font-semibold text-blue-300 mb-0.5">Next: Pre-configure options (optional)</p>
                        <p>Define categories and pricing options, or skip and let the team set them up.</p>
                      </div>
                    </>
                  )}

                  {/* ── Step 2: Categories ── */}
                  {step === "categories" && (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-white/70">Pre-configure Categories</p>
                          <p className="text-xs text-white/30 mt-0.5">Optional — define what buyers can customise and at what price</p>
                        </div>
                        <button type="button" onClick={addCategory}
                          className="flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-blue-300 px-3 py-1.5 border border-blue-500/25 rounded-lg hover:bg-blue-600/8 transition-colors">
                          + Add Category
                        </button>
                      </div>

                      {categories.length === 0 ? (
                        <div className="border-2 border-dashed border-white/10 rounded-xl py-10 text-center">
                          <p className="text-sm text-white/25">No categories yet.</p>
                          <button type="button" onClick={addCategory}
                            className="mt-2 text-sm text-blue-400 font-medium hover:text-blue-300 transition-colors">
                            Add your first category
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {categories.map((cat, ci) => (
                            <div key={ci} className="border border-white/8 rounded-xl overflow-hidden">
                              {/* Category header */}
                              <div className="bg-white/4 px-4 py-3 flex items-center gap-3">
                                <input
                                  value={cat.name}
                                  onChange={e => setCatField(ci, "name", e.target.value)}
                                  placeholder="Category name (e.g. Roof Style)"
                                  className="flex-1 text-sm font-medium bg-transparent border-none outline-none text-white/70 placeholder-white/20"
                                />
                                <select
                                  value={cat.phase}
                                  onChange={e => setCatField(ci, "phase", e.target.value)}
                                  className="text-xs bg-[#141414] border border-white/10 rounded-lg px-2 py-1 text-white/50 focus:outline-none"
                                >
                                  {PHASES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                                </select>
                                <button type="button" onClick={() => removeCategory(ci)}
                                  className="text-white/20 hover:text-red-400 text-sm transition-colors">✕</button>
                              </div>

                              {/* Options */}
                              <div className="p-3 space-y-2">
                                {cat.options.map((opt, oi) => (
                                  <div key={oi} className="flex items-center gap-2">
                                    <input
                                      value={opt.name}
                                      onChange={e => setOptField(ci, oi, "name", e.target.value)}
                                      placeholder="Option name"
                                      className="flex-1 text-xs bg-[#141414] border border-white/8 rounded-lg px-2.5 py-1.5 text-white/60 placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                                    />
                                    <div className="relative w-28">
                                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-white/25 text-xs">+$</span>
                                      <input
                                        type="number" min={0} value={opt.price}
                                        onChange={e => setOptField(ci, oi, "price", e.target.value)}
                                        placeholder="0"
                                        className="w-full text-xs bg-[#141414] border border-white/8 rounded-lg pl-6 pr-2 py-1.5 text-white/60 placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/40"
                                      />
                                    </div>
                                    <button type="button" onClick={() => removeOption(ci, oi)}
                                      className="text-white/20 hover:text-red-400 text-xs transition-colors">✕</button>
                                  </div>
                                ))}
                                <button type="button" onClick={() => addOption(ci)}
                                  className="text-xs text-blue-400 hover:text-blue-300 font-medium mt-1 transition-colors">
                                  + Add option
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-white/8 flex gap-3">
                  {step === "categories" && (
                    <button type="button" onClick={() => setStep("info")}
                      className="px-4 py-2.5 rounded-xl border border-white/10 text-sm font-medium text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors">
                      ← Back
                    </button>
                  )}
                  <button type="button" onClick={resetForm}
                    className="px-4 py-2.5 rounded-xl border border-white/10 text-sm font-medium text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting}
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors shadow-lg shadow-blue-600/20">
                    {step === "info" ? "Next: Options →" : submitting ? "Submitting…" : "Submit Request"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
