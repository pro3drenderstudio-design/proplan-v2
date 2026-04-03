"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  getBuilderProjects,
  getProjectRequests,
  createProjectRequest,
  ProjectRequest,
} from "@/lib/builder-api";
import { Project, RequestCategory } from "@/types/database";

// ── Configuration ─────────────────────────────────────────────────────────────
export const dynamic = "force-dynamic";

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

const INPUT = "w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/60 focus:border-blue-500/40 transition-colors";
const SELECT = "w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 focus:outline-none focus:ring-1 focus:ring-blue-500/60 focus:border-blue-500/40 transition-colors";

// ── Logic Component ───────────────────────────────────────────────────────────
function ProjectsList() {
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

  const liveCount  = projects.filter(p => (p as any).status === "live").length;
  const devCount   = projects.filter(p => (p as any).status === "in_development").length;
  const pendCount  = requests.filter(r => r.status === "pending_review").length;

  return (
    <div className="p-8 max-w-7xl mx-auto text-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">My Models</h1>
          <p className="text-sm text-white/30 mt-0.5">Manage configurators and track pricing.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-semibold transition-colors">
          + New Model Request
        </button>
      </div>

      {!loading && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total", value: projects.length, accent: "text-white" },
            { label: "Live", value: liveCount, accent: "text-emerald-400" },
            { label: "In Development", value: devCount, accent: "text-blue-400" },
            { label: "Pending", value: pendCount, accent: "text-amber-400" },
          ].map(s => (
            <div key={s.label} className="bg-[#0e0e0e] rounded-2xl border border-white/8 px-5 py-4">
              <p className="text-[10px] text-white/25 uppercase tracking-widest font-semibold">{s.label}</p>
              <p className={`text-3xl font-extrabold mt-1 ${s.accent}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white/4 border border-white/8 rounded-xl w-fit mb-6">
        {(["live", "requests"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              tab === t ? "bg-[#141414] text-white border border-white/10" : "text-white/30"
            }`}>
            {t === "live" ? `Active (${projects.length})` : `Requests (${requests.length})`}
          </button>
        ))}
      </div>

      {tab === "live" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-3 h-64 bg-[#0e0e0e] rounded-2xl animate-pulse" />
          ) : projects.length === 0 ? (
            <div className="col-span-3 bg-[#0e0e0e] rounded-2xl border border-white/8 py-20 text-center">
              <p className="text-white/30 text-sm mb-3">No active models yet.</p>
              <button onClick={() => setShowForm(true)} className="text-blue-400 text-sm font-medium">Submit Request →</button>
            </div>
          ) : (
            projects.map(project => {
              const status = (project as any).status ?? "live";
              return (
                <Link key={project.id} href={`/builder/projects/${project.id}`} className="group bg-[#0e0e0e] rounded-2xl border border-white/8 overflow-hidden transition-all block">
                  <div className="relative h-40 bg-[#080808]">
                    {(project as any).thumbnail_url && (
                      <img src={(project as any).thumbnail_url} alt={project.name} className="w-full h-full object-cover" />
                    )}
                    <span className={`absolute top-3 right-3 text-xs px-2.5 py-1 rounded-full font-semibold ${STATUS_STYLE[status]}`}>
                      {STATUS_LABEL[status]}
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-white/80 text-sm">{project.name}</h3>
                    <p className="text-xs text-white/30 mt-1">{project.beds}bd · {project.baths}ba</p>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      )}

      {/* Slide-over Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={resetForm} />
          <div ref={panelRef} className="w-[520px] bg-[#0a0a0a] border-l border-white/8 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/8">
               <h2 className="font-bold text-white text-lg">Request New Model</h2>
               <button onClick={resetForm} className="text-white/25 text-xl leading-none">×</button>
            </div>
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Model Name *</label>
                <input required value={form.project_name} onChange={e => set("project_name", e.target.value)} className={INPUT} />
              </div>
              <button type="submit" className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold">
                Submit Request
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── FINAL EXPORT WITH SUSPENSE ──
export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-white/20">Loading ProPlan Studio Builder...</div>}>
      <ProjectsList />
    </Suspense>
  );
}