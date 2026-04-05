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
const CAD_EXTS = ["dwg","dxf","rvt","ifc","skp","obj","fbx","stl"];

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

type StagedFile = { file: File; label: string; ext: string };

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(dateStr: string) {
  const diff  = Date.now() - new Date(dateStr).getTime();
  const days  = Math.floor(diff / 86400000);
  if (days < 1)  return "Today";
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fileLabel(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg","jpeg","png","webp","gif","svg"].includes(ext)) return "IMG";
  if (CAD_EXTS.includes(ext)) return "CAD";
  if (ext === "pdf") return "PDF";
  return "REF";
}

const INPUT  = "w-full bg-[#111] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/60 focus:border-blue-500/40 transition-colors";
const SELECT = "w-full bg-[#111] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 focus:outline-none focus:ring-1 focus:ring-blue-500/60 focus:border-blue-500/40 transition-colors appearance-none";
const LABEL  = "block text-[10px] font-bold uppercase tracking-widest text-white/35 mb-1.5";

// ── Logic Component ───────────────────────────────────────────────────────────
function ProjectsList() {
  const searchParams = useSearchParams();
  const [projects,    setProjects]    = useState<Project[]>([]);
  const [requests,    setRequests]    = useState<ProjectRequest[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(searchParams.get("new") === "1");
  const [tab,         setTab]         = useState<"live" | "requests">("live");

  // Form state
  const [form,        setForm]        = useState(EMPTY_FORM);
  const [categories,  setCategories]  = useState<RequestCategory[]>([]);
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [submitting,  setSubmitting]  = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [success,     setSuccess]     = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef      = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([getBuilderProjects(), getProjectRequests()]).then(([p, r]) => {
      setProjects(p); setRequests(r); setLoading(false);
    });
  }, []);

  function resetForm() {
    setForm(EMPTY_FORM);
    setCategories([]);
    setStagedFiles([]);
    setSubmitting(false);
    setUploadingFiles(false);
    setSubmitError("");
    setSuccess(false);
    setShowForm(false);
  }

  function set(key: keyof typeof EMPTY_FORM, val: string | number) {
    setForm(prev => ({ ...prev, [key]: val }));
  }

  // ── Category helpers ───────────────────────────────────────────────────────
  function addCategory() {
    setCategories(prev => [...prev, { name: "", phase: "exterior", options: [] }]);
  }
  function removeCategory(i: number) {
    setCategories(prev => prev.filter((_, idx) => idx !== i));
  }
  function setCatField(i: number, field: keyof RequestCategory, val: string) {
    setCategories(prev => prev.map((c, idx) => idx !== i ? c : { ...c, [field]: val }));
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
        ...c,
        options: c.options.map((o, j) =>
          j !== optIdx ? o : { ...o, [field]: field === "price" ? Number(val) : val }
        ),
      }
    ));
  }

  // ── File staging ───────────────────────────────────────────────────────────
  function stageFiles(fileList: FileList | File[]) {
    const newFiles = Array.from(fileList).map(f => ({
      file: f,
      label: fileLabel(f.name),
      ext: f.name.split(".").pop()?.toLowerCase() ?? "",
    }));
    setStagedFiles(prev => [...prev, ...newFiles]);
  }
  function removeStaged(idx: number) {
    setStagedFiles(prev => prev.filter((_, i) => i !== idx));
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.project_name.trim()) return;
    setSubmitting(true);
    setSubmitError("");

    const result = await createProjectRequest({
      project_name:      form.project_name.trim(),
      home_type:         form.home_type,
      floors:            Number(form.floors),
      beds:              form.beds   ? Number(form.beds)   : null,
      baths:             form.baths  ? Number(form.baths)  : null,
      square_footage:    form.square_footage ? Number(form.square_footage) : null,
      budget_range:      form.budget_range   || null,
      starting_price:    form.starting_price ? Number(form.starting_price) : null,
      description:       form.description   || null,
      categories_config: categories.filter(c => c.name.trim()).length > 0
        ? categories.filter(c => c.name.trim())
        : null,
    });

    if (!result) {
      setSubmitError("Something went wrong. Please try again.");
      setSubmitting(false);
      return;
    }

    // Upload staged files to the new project
    const projectId = result._projectId;
    if (projectId && stagedFiles.length > 0) {
      setUploadingFiles(true);
      await Promise.all(stagedFiles.map(async sf => {
        const fd = new FormData();
        fd.append("file", sf.file);
        fd.append("file_type", sf.label === "IMG" ? "image" : sf.label === "CAD" ? "cad" : "reference");
        try {
          await fetch(`/api/projects/${projectId}/files`, { method: "POST", body: fd });
        } catch {/* non-fatal */}
      }));
      setUploadingFiles(false);
    }

    setRequests(prev => [result, ...prev]);
    setSuccess(true);
    setTimeout(() => { resetForm(); setTab("requests"); }, 2500);
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
        <button onClick={() => setShowForm(true)}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-semibold transition-colors">
          + New Model Setup
        </button>
      </div>

      {!loading && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total",          value: projects.length, accent: "text-white" },
            { label: "Live",           value: liveCount,       accent: "text-emerald-400" },
            { label: "In Development", value: devCount,        accent: "text-blue-400" },
            { label: "Pending",        value: pendCount,       accent: "text-amber-400" },
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

      {tab === "requests" && (
        <div className="space-y-3">
          {loading ? (
            <div className="h-32 bg-[#0e0e0e] rounded-2xl animate-pulse" />
          ) : requests.length === 0 ? (
            <div className="bg-[#0e0e0e] rounded-2xl border border-white/8 py-20 text-center">
              <p className="text-white/30 text-sm mb-3">No requests yet.</p>
              <button onClick={() => setShowForm(true)} className="text-blue-400 text-sm font-medium">
                Submit a Request →
              </button>
            </div>
          ) : (
            requests.map(req => {
              const matched = projects.find(p => p.name === req.project_name);
              const inner = (
                <div className="bg-[#0e0e0e] border border-white/8 rounded-2xl p-5 flex items-center justify-between gap-4 hover:border-white/15 transition-colors group cursor-pointer">
                  <div className="min-w-0">
                    <h3 className="font-bold text-white/85 text-sm truncate">{req.project_name}</h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${STATUS_STYLE[req.status] ?? STATUS_STYLE.pending_review}`}>
                        {STATUS_LABEL[req.status] ?? req.status}
                      </span>
                      {req.home_type && <span className="text-xs text-white/25">{req.home_type.replace(/_/g, " ")}</span>}
                    </div>
                    <p className="text-xs text-white/20 mt-1">Submitted {timeAgo(req.created_at)}</p>
                  </div>
                  <svg className="w-4 h-4 text-white/20 group-hover:text-white/50 flex-shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              );
              return matched ? (
                <Link key={req.id} href={`/builder/projects/${matched.id}`}>{inner}</Link>
              ) : (
                <div key={req.id}>{inner}</div>
              );
            })
          )}
        </div>
      )}

      {tab === "live" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-3 h-64 bg-[#0e0e0e] rounded-2xl animate-pulse" />
          ) : projects.length === 0 ? (
            <div className="col-span-3 bg-[#0e0e0e] rounded-2xl border border-white/8 py-20 text-center">
              <p className="text-white/30 text-sm mb-3">No active models yet.</p>
              <button onClick={() => setShowForm(true)} className="text-blue-400 text-sm font-medium">
                Submit Request →
              </button>
            </div>
          ) : (
            projects.map(project => {
              const status = (project as any).status ?? "live";
              return (
                <Link key={project.id} href={`/builder/projects/${project.id}`}
                  className="group bg-[#0e0e0e] rounded-2xl border border-white/8 overflow-hidden transition-all block">
                  <div className="relative h-40 bg-[#080808]">
                    {(project as any).thumbnail_url && (
                      // eslint-disable-next-line @next/next/no-img-element
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

      {/* ── Slide-over Form ──────────────────────────────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={resetForm} />
          <div className="w-[660px] bg-[#0a0a0a] border-l border-white/8 shadow-2xl flex flex-col">

            {/* Drawer header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/8 flex-shrink-0">
              <div>
                <h2 className="font-bold text-white text-lg">New Model Setup</h2>
                <p className="text-xs text-white/30 mt-0.5">Tell us about your 3D configurator project</p>
              </div>
              <button onClick={resetForm} className="text-white/25 hover:text-white/60 text-2xl leading-none transition-colors">×</button>
            </div>

            {/* Success state */}
            {success ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
                <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                  <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-white font-bold text-lg">Setup Submitted!</p>
                <p className="text-white/40 text-sm text-center">
                  Your model setup has been received. We'll review it and be in touch shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">

                {/* ─── Section 1: Model Details ──────────────────────────────── */}
                <div className="px-6 py-5 space-y-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Model Details</p>

                  <div>
                    <label className={LABEL}>Model Name *</label>
                    <input
                      required
                      value={form.project_name}
                      onChange={e => set("project_name", e.target.value)}
                      placeholder="e.g. The Oakwood 3BR"
                      className={INPUT}
                    />
                  </div>

                  <div>
                    <label className={LABEL}>Home Type</label>
                    <div className="relative">
                      <select value={form.home_type} onChange={e => set("home_type", e.target.value)} className={SELECT}>
                        {HOME_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                      </select>
                      <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                      </svg>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className={LABEL}>Floors</label>
                      <input type="number" min={1} max={10} value={form.floors} onChange={e => set("floors", e.target.value)} className={INPUT} />
                    </div>
                    <div>
                      <label className={LABEL}>Bedrooms</label>
                      <input type="number" min={0} value={form.beds} onChange={e => set("beds", e.target.value)} className={INPUT} />
                    </div>
                    <div>
                      <label className={LABEL}>Bathrooms</label>
                      <input type="number" min={0} step={0.5} value={form.baths} onChange={e => set("baths", e.target.value)} className={INPUT} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={LABEL}>Square Footage</label>
                      <input type="number" min={0} value={form.square_footage} onChange={e => set("square_footage", e.target.value)} placeholder="e.g. 2400" className={INPUT} />
                    </div>
                    <div>
                      <label className={LABEL}>Starting Price ($)</label>
                      <input type="number" min={0} value={form.starting_price} onChange={e => set("starting_price", e.target.value)} placeholder="e.g. 350000" className={INPUT} />
                    </div>
                  </div>

                  <div>
                    <label className={LABEL}>Budget Range</label>
                    <div className="relative">
                      <select value={form.budget_range} onChange={e => set("budget_range", e.target.value)} className={SELECT}>
                        <option value="">— Select —</option>
                        {BUDGET_RANGES.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                      <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                      </svg>
                    </div>
                  </div>

                  <div>
                    <label className={LABEL}>Description / Notes</label>
                    <textarea
                      value={form.description}
                      onChange={e => set("description", e.target.value)}
                      rows={3}
                      placeholder="Describe the model, special features, style, etc."
                      className={`${INPUT} resize-none`}
                    />
                  </div>
                </div>

                <div className="border-t border-white/6" />

                {/* ─── Section 2: Reference Files ───────────────────────────── */}
                <div className="px-6 py-5 space-y-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Reference Files</p>
                  <p className="text-xs text-white/30">Upload floor plans, elevations, CAD files, images, or any reference material.</p>

                  {/* Drop zone */}
                  <div
                    ref={dropRef}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); dropRef.current?.classList.add("border-blue-500/50", "bg-blue-600/5"); }}
                    onDragLeave={() => { dropRef.current?.classList.remove("border-blue-500/50", "bg-blue-600/5"); }}
                    onDrop={e => {
                      e.preventDefault();
                      dropRef.current?.classList.remove("border-blue-500/50", "bg-blue-600/5");
                      stageFiles(e.dataTransfer.files);
                    }}
                    className="border-2 border-dashed border-white/12 rounded-xl px-6 py-8 text-center cursor-pointer hover:border-white/25 hover:bg-white/3 transition-all">
                    <svg className="w-8 h-8 text-white/20 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    <p className="text-sm text-white/40 font-medium">Click to browse or drag & drop</p>
                    <p className="text-xs text-white/20 mt-1">Images, PDFs, DWG, DXF, RVT, SKP, OBJ, FBX, STL</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    accept="image/*,.pdf,.dwg,.dxf,.rvt,.ifc,.skp,.obj,.fbx,.stl,.zip"
                    onChange={e => { if (e.target.files) stageFiles(e.target.files); e.target.value = ""; }}
                  />

                  {stagedFiles.length > 0 && (
                    <div className="space-y-2">
                      {stagedFiles.map((sf, i) => (
                        <div key={i} className="flex items-center gap-3 bg-white/5 border border-white/8 rounded-xl px-3 py-2.5">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex-shrink-0 ${
                            sf.label === "IMG" ? "bg-blue-500/20 text-blue-400" :
                            sf.label === "CAD" ? "bg-violet-500/20 text-violet-400" :
                            sf.label === "PDF" ? "bg-rose-500/20 text-rose-400" :
                            "bg-white/8 text-white/40"
                          }`}>{sf.label}</span>
                          <p className="text-xs text-white/60 flex-1 truncate">{sf.file.name}</p>
                          <p className="text-xs text-white/25 flex-shrink-0">{(sf.file.size / 1024).toFixed(0)} KB</p>
                          <button type="button" onClick={() => removeStaged(i)}
                            className="text-white/25 hover:text-white/60 text-base leading-none flex-shrink-0 transition-colors">×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-white/6" />

                {/* ─── Section 3: Categories & Options ──────────────────────── */}
                <div className="px-6 py-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-white/25">Categories & Options</p>
                      <p className="text-xs text-white/25 mt-0.5">Define what buyers can customise and the price impact per option.</p>
                    </div>
                    <button type="button" onClick={addCategory}
                      className="text-xs px-3 py-1.5 rounded-lg bg-white/6 border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-colors flex-shrink-0">
                      + Add Category
                    </button>
                  </div>

                  {categories.length === 0 && (
                    <div className="border border-dashed border-white/10 rounded-xl px-4 py-6 text-center">
                      <p className="text-xs text-white/25">No categories yet. Add one to define configurable options.</p>
                    </div>
                  )}

                  {categories.map((cat, catIdx) => (
                    <div key={catIdx} className="bg-[#111] border border-white/10 rounded-xl p-4 space-y-3">
                      {/* Category header */}
                      <div className="flex items-center gap-2">
                        <input
                          value={cat.name}
                          onChange={e => setCatField(catIdx, "name", e.target.value)}
                          placeholder="Category name (e.g. Roofing)"
                          className="flex-1 bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 placeholder-white/20 focus:outline-none focus:border-blue-500/50 transition-colors"
                        />
                        <div className="relative flex-shrink-0">
                          <select
                            value={cat.phase}
                            onChange={e => setCatField(catIdx, "phase", e.target.value)}
                            className="bg-[#0a0a0a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/60 focus:outline-none focus:border-blue-500/50 transition-colors appearance-none pr-7">
                            {PHASES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                          </select>
                          <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                          </svg>
                        </div>
                        <button type="button" onClick={() => removeCategory(catIdx)}
                          className="text-white/20 hover:text-red-400 text-lg leading-none transition-colors flex-shrink-0">×</button>
                      </div>

                      {/* Options */}
                      <div className="space-y-2 pl-1">
                        {cat.options.map((opt, optIdx) => (
                          <div key={optIdx} className="flex items-center gap-2">
                            <input
                              value={opt.name}
                              onChange={e => setOptField(catIdx, optIdx, "name", e.target.value)}
                              placeholder="Option name (e.g. Charcoal Shingle)"
                              className="flex-1 bg-[#0a0a0a] border border-white/8 rounded-lg px-3 py-1.5 text-sm text-white/70 placeholder-white/15 focus:outline-none focus:border-blue-500/40 transition-colors"
                            />
                            <div className="relative w-28 flex-shrink-0">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">$</span>
                              <input
                                type="number"
                                min={0}
                                value={opt.price}
                                onChange={e => setOptField(catIdx, optIdx, "price", e.target.value)}
                                className="w-full bg-[#0a0a0a] border border-white/8 rounded-lg pl-6 pr-3 py-1.5 text-sm text-white/70 focus:outline-none focus:border-blue-500/40 transition-colors"
                              />
                            </div>
                            <button type="button" onClick={() => removeOption(catIdx, optIdx)}
                              className="text-white/20 hover:text-red-400 text-base leading-none transition-colors flex-shrink-0">×</button>
                          </div>
                        ))}
                        <button type="button" onClick={() => addOption(catIdx)}
                          className="text-xs text-white/30 hover:text-white/60 transition-colors flex items-center gap-1">
                          <span className="text-base leading-none">+</span> Add Option
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* ─── Footer ───────────────────────────────────────────────── */}
                <div className="px-6 py-5 border-t border-white/8 space-y-3 flex-shrink-0">
                  {submitError && (
                    <p className="text-sm text-red-400 text-center">{submitError}</p>
                  )}
                  <button
                    type="submit"
                    disabled={submitting || uploadingFiles || !form.project_name.trim()}
                    className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors">
                    {uploadingFiles ? "Uploading files…" : submitting ? "Submitting…" : "Submit Model Setup"}
                  </button>
                  <p className="text-xs text-white/25 text-center">
                    Our team will review your setup and reach out within 1–2 business days.
                  </p>
                </div>

              </form>
            )}
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
