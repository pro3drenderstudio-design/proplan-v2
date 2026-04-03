"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  getProjectById, updateProjectMeta,
  getProjectFiles, deleteProjectFile,
  getProjectCategoriesWithOptions,
  createCategory, updateCategory, deleteCategory,
  createOption, updateOption, deleteOption,
} from "@/lib/builder-api";
import { Project, CategoryWithOptions, Option, ProjectFile } from "@/types/database";

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { id: "pending_review",  label: "Pending Review",  dot: "bg-orange-400" },
  { id: "in_development",  label: "In Development",  dot: "bg-blue-500"   },
  { id: "in_review",       label: "In Review",       dot: "bg-yellow-400" },
  { id: "live",            label: "Live",            dot: "bg-green-500"  },
  { id: "archived",        label: "Archived",        dot: "bg-gray-400"   },
];
const STATUS_STYLE: Record<string, string> = {
  live:           "bg-emerald-500/12 text-emerald-400 border border-emerald-500/20",
  in_development: "bg-blue-500/12 text-blue-400 border border-blue-500/20",
  in_review:      "bg-amber-500/12 text-amber-400 border border-amber-500/20",
  pending_review: "bg-orange-500/12 text-orange-400 border border-orange-500/20",
  archived:       "bg-white/5 text-white/25 border border-white/8",
};
const HOME_TYPES = [
  { id: "single_family", label: "Single Family" },
  { id: "townhome",      label: "Townhome"      },
  { id: "duplex",        label: "Duplex"        },
  { id: "condo",         label: "Condo"         },
  { id: "custom",        label: "Custom"        },
];
const PHASES = [
  { id: "exterior",  label: "Exterior"  },
  { id: "interior",  label: "Interior"  },
  { id: "blueprint", label: "Blueprint" },
];
const FILE_TYPE_OPTIONS = [
  { id: "image",     label: "Reference Image" },
  { id: "cad",       label: "CAD File"        },
  { id: "reference", label: "Other Reference" },
];
const PHASE_COLORS: Record<string, string> = {
  exterior:  "bg-blue-500/12 text-blue-400 border border-blue-500/20",
  interior:  "bg-emerald-500/12 text-emerald-400 border border-emerald-500/20",
  blueprint: "bg-violet-500/12 text-violet-400 border border-violet-500/20",
};

const INPUT = "w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/60 focus:border-blue-500/40 transition-colors";
const SELECT = "w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 focus:outline-none focus:ring-1 focus:ring-blue-500/60 transition-colors";

function fmtPrice(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
function fmtBytes(n: number | null) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
function timeAgo(dateStr: string) {
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return "Just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30)  return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── File icon ─────────────────────────────────────────────────────────────────

function FileIcon({ mime }: { mime: string | null }) {
  const isImage = mime?.startsWith("image/");
  const isPdf   = mime === "application/pdf";
  return (
    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
      isImage ? "bg-blue-500/12" : isPdf ? "bg-red-500/12" : "bg-white/6"
    }`}>
      <svg viewBox="0 0 20 20" fill="currentColor" className={`w-4 h-4 ${isImage ? "text-blue-400" : isPdf ? "text-red-400" : "text-white/30"}`}>
        {isImage
          ? <path fillRule="evenodd" d="M1 5.25A2.25 2.25 0 013.25 3h13.5A2.25 2.25 0 0119 5.25v9.5A2.25 2.25 0 0116.75 17H3.25A2.25 2.25 0 011 14.75v-9.5zm1.5 5.81v3.69c0 .414.336.75.75.75h13.5a.75.75 0 00.75-.75v-2.69l-2.22-2.219a.75.75 0 00-1.06 0l-1.91 1.909-.47-.47a.75.75 0 00-1.06 0L2.5 11.06zm3.25-7.56a1.25 1.25 0 100 2.5 1.25 1.25 0 000-2.5z" clipRule="evenodd" />
          : <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
        }
      </svg>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProjectDetailClient({ id }: { id: string }) {
  const [project,    setProject]    = useState<Project | null>(null);
  const [categories, setCategories] = useState<CategoryWithOptions[]>([]);
  const [files,      setFiles]      = useState<ProjectFile[]>([]);
  const [loading,    setLoading]    = useState(true);

  // UI state
  const [editingMeta,   setEditingMeta]   = useState(false);
  const [editingCats,   setEditingCats]   = useState(false);
  const [notes,         setNotes]         = useState("");
  const [savingNotes,   setSavingNotes]   = useState(false);
  const [toast,         setToast]         = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [copied,        setCopied]        = useState(false);
  const [requestModal,  setRequestModal]  = useState(false);
  const [requestNote,   setRequestNote]   = useState("");
  const [requestingUpd, setRequestingUpd] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load all data
  useEffect(() => {
    Promise.all([
      getProjectById(id),
      getProjectCategoriesWithOptions(id),
      getProjectFiles(id),
    ]).then(([proj, cats, fls]) => {
      if (proj) { setProject(proj); setNotes(proj.notes ?? ""); }
      setCategories(cats);
      setFiles(fls);
      setLoading(false);
    });
  }, [id]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  // ── Notes save ────────────────────────────────────────────────────────────
  async function saveNotes() {
    if (!project) return;
    setSavingNotes(true);
    const ok = await updateProjectMeta(id, { notes });
    setSavingNotes(false);
    if (ok) { setProject(p => p ? { ...p, notes } : p); showToast("Notes saved"); }
    else showToast("Failed to save notes");
  }

  // ── File upload ───────────────────────────────────────────────────────────
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    const ext   = file.name.split(".").pop()?.toLowerCase() ?? "";
    const isImg = ["jpg","jpeg","png","webp","gif","svg"].includes(ext);
    const isCad = ["dwg","dxf","rvt","ifc","skp","obj","fbx","stl"].includes(ext);
    const fileType = isImg ? "image" : isCad ? "cad" : "reference";

    const formData = new FormData();
    formData.append("file", file);
    formData.append("file_type", fileType);

    try {
      const res = await fetch(`/api/projects/${id}/files`, { method: "POST", body: formData });
      if (res.ok) {
        const newFile = await res.json() as ProjectFile;
        setFiles(prev => [newFile, ...prev]);
        showToast("File uploaded");
      } else {
        showToast("Upload failed");
      }
    } catch { showToast("Upload failed"); }
    finally { setUploadingFile(false); e.target.value = ""; }
  }

  // ── Delete file ───────────────────────────────────────────────────────────
  async function handleDeleteFile(fileId: string) {
    if (!confirm("Delete this file?")) return;
    const ok = await deleteProjectFile(fileId);
    if (ok) { setFiles(prev => prev.filter(f => f.id !== fileId)); showToast("File deleted"); }
  }

  // ── Category / Option inline actions ─────────────────────────────────────
  async function handleAddCategory() {
    const name = prompt("Category name:");
    if (!name) return;
    const phase = (prompt("Phase (exterior / interior / blueprint):", "exterior") ?? "exterior") as "exterior" | "interior" | "blueprint";
    const cat = await createCategory({
      project_id: id,
      name,
      phase,
      sort_order: categories.length,
    });
    if (cat) { setCategories(prev => [...prev, { ...cat, options: [] }]); showToast("Category added"); }
  }

  async function handleDeleteCategory(catId: string) {
    if (!confirm("Delete this category and all its options?")) return;
    const ok = await deleteCategory(catId);
    if (ok) { setCategories(prev => prev.filter(c => c.id !== catId)); showToast("Category deleted"); }
  }

  async function handleAddOption(catId: string) {
    const name  = prompt("Option name:");
    if (!name) return;
    const priceStr = prompt("Price add-on ($):", "0") ?? "0";
    const price    = parseFloat(priceStr) || 0;
    const cat      = categories.find(c => c.id === catId);
    const opt = await createOption({
      category_id:  catId,
      friendly_name: name,
      price_impact:  price,
      sort_order:    cat?.options.length ?? 0,
    });
    if (opt) {
      setCategories(prev => prev.map(c =>
        c.id === catId ? { ...c, options: [...c.options, opt] } : c
      ));
      showToast("Option added");
    }
  }

  async function handleDeleteOption(catId: string, optId: string) {
    if (!confirm("Delete this option?")) return;
    const ok = await deleteOption(optId);
    if (ok) {
      setCategories(prev => prev.map(c =>
        c.id === catId ? { ...c, options: c.options.filter(o => o.id !== optId) } : c
      ));
      showToast("Option deleted");
    }
  }

  // ── Copy link ─────────────────────────────────────────────────────────────
  function copyLink() {
    if (!project) return;
    const url = project.slug && project.company_slug
      ? `${window.location.origin}/project/${project.company_slug}/${project.slug}`
      : window.location.origin;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Request update ────────────────────────────────────────────────────────
  async function handleRequestUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!project) return;
    setRequestingUpd(true);
    await fetch("/api/projects/request-update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: id, project_name: project.name, note: requestNote }),
    }).catch(() => {});
    setRequestingUpd(false);
    setRequestModal(false);
    setRequestNote("");
    showToast("Update request submitted");
  }

  const confUrl = project?.slug && project.company_slug
    ? `/project/${project.company_slug}/${project.slug}`
    : null;

  const totalOptions = categories.reduce((n, c) => n + c.options.length, 0);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-4">
        {[1,2,3].map(i => (
          <div key={i} className="bg-white/4 rounded-2xl h-32 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-8 max-w-7xl mx-auto text-center py-24">
        <p className="text-white/30 text-sm">Project not found.</p>
        <Link href="/builder/projects" className="mt-3 inline-block text-blue-400 text-sm hover:underline">← Back to Projects</Link>
      </div>
    );
  }

  const status = project.status ?? "in_development";

  return (
    <div className="p-8 max-w-7xl mx-auto">

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1a1a1a] border border-white/10 text-white text-sm px-4 py-2.5 rounded-xl shadow-2xl shadow-black/40">
          {toast}
        </div>
      )}

      {/* ── Breadcrumb + Header ── */}
      <div className="mb-6">
        <Link href="/builder/projects" className="text-xs text-white/30 hover:text-white/60 flex items-center gap-1 mb-3 transition-colors">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd"/></svg>
          My Projects
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <h1
              className="text-2xl font-extrabold text-white tracking-tight truncate"
              style={{ fontFamily: "var(--font-syne), sans-serif" }}
            >
              {project.name}
            </h1>
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0 ${STATUS_STYLE[status]}`}>
              {STATUS_OPTIONS.find(s => s.id === status)?.label ?? status}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setRequestModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/10 text-sm font-medium text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
            >
              Request Update
            </button>
            <button
              onClick={() => setEditingMeta(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/10 text-sm font-medium text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
            >
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
              </svg>
              Edit Metadata
            </button>
            {confUrl && (
              <Link
                href={confUrl}
                target="_blank"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-blue-600/20"
              >
                Preview Configurator
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z" clipRule="evenodd"/><path fillRule="evenodd" d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z" clipRule="evenodd"/></svg>
              </Link>
            )}
          </div>
        </div>

        <p className="text-sm text-white/30 mt-1.5">
          {HOME_TYPES.find(h => h.id === (project.home_type ?? "single_family"))?.label ?? "Single Family"}
          {project.beds  ? ` · ${project.beds} Bed`  : ""}
          {project.baths ? ` / ${project.baths} Bath` : ""}
          {project.floors ? ` · ${project.floors} Story` : ""}
          {project.sqft   ? ` · ${project.sqft.toLocaleString()} sqft` : ""}
        </p>
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">

        {/* ── Left: Main content ── */}
        <div className="space-y-5">

          {/* Model Details */}
          <div className="bg-[#0e0e0e] rounded-2xl border border-white/8 overflow-hidden">
            <div className="p-5 flex gap-5">
              {/* Thumbnail */}
              <div
                className="relative flex-shrink-0 w-52 h-36 rounded-xl overflow-hidden cursor-pointer group bg-[#141414]"
                onClick={() => setEditingMeta(true)}
              >
                {project.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={project.thumbnail_url} alt={project.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center blueprint-grid opacity-40">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1" className="w-12 h-12 relative z-10">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21" />
                    </svg>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-white text-xs font-semibold">Change Thumbnail</span>
                </div>
              </div>

              {/* Stats */}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-1">Base Starting Price</p>
                <p
                  className="text-3xl font-extrabold text-white tracking-tight"
                  style={{ fontFamily: "var(--font-syne), sans-serif" }}
                >
                  {fmtPrice(project.base_price ?? 0)}
                </p>

                <div className="grid grid-cols-4 gap-3 mt-4">
                  {[
                    { label: "Bedrooms",   value: project.beds   ?? "—" },
                    { label: "Bathrooms",  value: project.baths  ?? "—" },
                    { label: "Stories",    value: project.floors ?? "—" },
                    { label: "Total Area", value: project.sqft ? `${project.sqft.toLocaleString()} sqft` : "—" },
                  ].map(s => (
                    <div key={s.label} className="bg-white/4 rounded-xl px-3 py-2">
                      <p className="text-[10px] text-white/30 font-medium uppercase tracking-wide">{s.label}</p>
                      <p className="text-sm font-bold text-white/80 mt-0.5">{s.value}</p>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => document.getElementById("options-section")?.scrollIntoView({ behavior: "smooth" })}
                  className="mt-3 flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors"
                >
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h7.5M8.25 10h7.5m-7.5 3.25h7.5M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 10h.007v.008H3.75V10zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 3.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                  {categories.length} categor{categories.length !== 1 ? "ies" : "y"}, {totalOptions} option{totalOptions !== 1 ? "s" : ""}
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd"/></svg>
                </button>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="bg-[#0e0e0e] rounded-2xl border border-white/8 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-white/80">Project Description</h2>
              <button onClick={() => setEditingMeta(true)} className="text-xs text-white/30 hover:text-blue-400 transition-colors">Edit</button>
            </div>
            {project.description ? (
              <p className="text-sm text-white/50 leading-relaxed">{project.description}</p>
            ) : (
              <button onClick={() => setEditingMeta(true)} className="text-sm text-white/25 hover:text-blue-400 transition-colors">
                + Add a project description…
              </button>
            )}
          </div>

          {/* Options & Pricing */}
          <div id="options-section" className="bg-[#0e0e0e] rounded-2xl border border-white/8">
            <div className="px-5 py-4 border-b border-white/6 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white/80">Available Options &amp; Pricing</h2>
                <p className="text-xs text-white/30 mt-0.5">Structural &amp; material options available in configurator</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingCats(e => !e)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors font-medium ${
                    editingCats
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "border-white/10 text-white/40 hover:border-blue-500/40 hover:text-blue-400"
                  }`}
                >
                  {editingCats ? "Done Editing" : "Manage Options"}
                </button>
                {editingCats && (
                  <button
                    onClick={handleAddCategory}
                    className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/12 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors font-medium"
                  >
                    + Add Category
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-[420px] overflow-y-auto divide-y divide-white/4">
              {categories.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-white/25 mb-2">No options configured yet.</p>
                  <button onClick={() => { setEditingCats(true); handleAddCategory(); }}
                    className="text-sm text-blue-400 font-medium hover:underline">
                    Add first category
                  </button>
                </div>
              ) : (
                categories.map(cat => (
                  <div key={cat.id}>
                    {/* Category header row */}
                    <div className="px-5 py-2.5 bg-white/[0.02] flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-bold text-white/70">{cat.name}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize ${PHASE_COLORS[cat.phase] ?? "bg-white/6 text-white/30"}`}>
                          {cat.phase}
                        </span>
                        <span className="text-[10px] text-white/25">{cat.options.length} option{cat.options.length !== 1 ? "s" : ""}</span>
                      </div>
                      {editingCats && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleAddOption(cat.id)}
                            className="text-[11px] text-blue-400 hover:text-blue-300 font-medium px-2 py-1 hover:bg-blue-500/8 rounded transition-colors"
                          >
                            + Option
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="text-[11px] text-red-400 hover:text-red-300 font-medium px-2 py-1 hover:bg-red-500/8 rounded transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Option rows */}
                    {cat.options.map((opt, oi) => (
                      <OptionRow
                        key={opt.id}
                        opt={opt}
                        editing={editingCats}
                        odd={oi % 2 !== 0}
                        onSave={async (updates) => {
                          const ok = await updateOption(opt.id, updates);
                          if (ok) {
                            setCategories(prev => prev.map(c =>
                              c.id === cat.id
                                ? { ...c, options: c.options.map(o => o.id === opt.id ? { ...o, ...updates } : o) }
                                : c
                            ));
                            showToast("Option updated");
                          }
                        }}
                        onDelete={() => handleDeleteOption(cat.id, opt.id)}
                      />
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Reference Files */}
          <div className="bg-[#0e0e0e] rounded-2xl border border-white/8">
            <div className="px-5 py-4 border-b border-white/6 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white/80">Reference Files</h2>
                <p className="text-xs text-white/30 mt-0.5">CAD drawings, renderings, and reference images</p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile}
                className="text-xs px-3.5 py-1.5 rounded-lg bg-blue-500/12 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-colors font-medium disabled:opacity-50"
              >
                {uploadingFile ? "Uploading…" : "+ Upload File"}
              </button>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload}
                accept=".jpg,.jpeg,.png,.webp,.pdf,.dwg,.dxf,.rvt,.ifc,.skp,.obj,.fbx,.stl,.zip" />
            </div>

            <div className="p-4">
              {files.length === 0 ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-white/8 rounded-xl py-10 flex flex-col items-center gap-2 cursor-pointer hover:border-blue-500/30 hover:bg-blue-600/5 transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={1.5} className="w-8 h-8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <p className="text-sm text-white/30">Drop files here or click to upload</p>
                  <p className="text-xs text-white/15">CAD, images, PDFs, reference files</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {files.map(f => (
                    <div key={f.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/3 transition-colors group">
                      <FileIcon mime={f.mime_type} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white/70 truncate">{f.file_name}</p>
                        <p className="text-xs text-white/30">
                          {FILE_TYPE_OPTIONS.find(t => t.id === f.file_type)?.label ?? f.file_type}
                          {f.size_bytes ? ` · ${fmtBytes(f.size_bytes)}` : ""}
                          {` · ${timeAgo(f.created_at)}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <a href={f.file_url} target="_blank" rel="noreferrer"
                          className="p-1.5 rounded-lg hover:bg-blue-500/12 text-white/25 hover:text-blue-400 transition-colors">
                          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z"/>
                            <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z"/>
                          </svg>
                        </a>
                        <button onClick={() => handleDeleteFile(f.id)}
                          className="p-1.5 rounded-lg hover:bg-red-500/12 text-white/20 hover:text-red-400 transition-colors">
                          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* ── Right: Sidebar ── */}
        <div className="space-y-4">

          {/* Project Overview */}
          <div className="bg-[#0e0e0e] rounded-2xl border border-white/8 p-5">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-4">Project Overview</h3>

            <div className="space-y-3">
              {/* Status */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40">Status</span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STATUS_STYLE[status]}`}>
                  {STATUS_OPTIONS.find(s => s.id === status)?.label ?? status}
                </span>
              </div>

              {/* Project ID */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40">Project ID</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-mono text-white/50 bg-white/4 px-2 py-0.5 rounded">{id.slice(0, 8).toUpperCase()}</span>
                  <button
                    onClick={() => { navigator.clipboard.writeText(id); showToast("ID copied"); }}
                    className="text-white/20 hover:text-white/50 transition-colors"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z"/><path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z"/></svg>
                  </button>
                </div>
              </div>

              {/* Dates */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40">Created</span>
                <span className="text-xs text-white/50">{new Date(project.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40">Last Updated</span>
                <span className="text-xs text-white/50">{timeAgo(project.updated_at)}</span>
              </div>

              {/* Views */}
              {(project.views_count ?? 0) > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40">Configurator Views</span>
                  <span className="text-xs font-semibold text-white/70">{project.views_count?.toLocaleString()}</span>
                </div>
              )}

              {/* Sketchfab UID */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40">3D Model</span>
                {project.sketchfab_uid ? (
                  <span className="text-xs font-mono text-white/40 truncate max-w-[120px]">{project.sketchfab_uid.slice(0, 12)}…</span>
                ) : (
                  <span className="text-xs text-white/20">Not linked</span>
                )}
              </div>
            </div>
          </div>

          {/* Share & Preview */}
          <div className="bg-[#0e0e0e] rounded-2xl border border-white/8 p-5">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-4">Share &amp; Publish</h3>
            <div className="space-y-2">
              <button
                onClick={copyLink}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-white/10 hover:border-blue-500/30 hover:bg-blue-600/8 transition-colors group"
              >
                <span className="text-sm text-white/50 group-hover:text-blue-400 font-medium transition-colors">
                  {copied ? "Copied!" : "Copy Configurator URL"}
                </span>
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-white/25 group-hover:text-blue-400 transition-colors">
                  <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z"/>
                  <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z"/>
                </svg>
              </button>

              {confUrl && (
                <button
                  onClick={() => { navigator.clipboard.writeText(`<iframe src="${window.location.origin}${confUrl}" width="100%" height="700" frameborder="0" allow="fullscreen"></iframe>`); showToast("Embed code copied"); }}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/5 transition-colors group"
                >
                  <span className="text-sm text-white/50 font-medium">&lt;/&gt; Copy Embed Code</span>
                  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-white/25"><path fillRule="evenodd" d="M6.28 5.22a.75.75 0 010 1.06L2.56 10l3.72 3.72a.75.75 0 01-1.06 1.06L.97 10.53a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 0zm7.44 0a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L17.44 10l-3.72-3.72a.75.75 0 010-1.06z" clipRule="evenodd"/></svg>
                </button>
              )}
            </div>
          </div>

          {/* Internal Notes */}
          <div className="bg-[#0e0e0e] rounded-2xl border border-white/8 p-5">
            <h3 className="text-[10px] font-semibold uppercase tracking-widest text-white/25 mb-3">Internal Notes</h3>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={5}
              placeholder="Add internal notes about this project…"
              className="w-full bg-[#141414] border border-white/8 rounded-xl px-3 py-2.5 text-sm text-white/60 placeholder-white/15 focus:outline-none focus:ring-1 focus:ring-blue-500/60 resize-none transition-colors italic"
            />
            <button
              onClick={saveNotes}
              disabled={savingNotes || notes === (project.notes ?? "")}
              className="mt-2 w-full py-2 rounded-xl bg-white/6 hover:bg-white/10 disabled:opacity-40 text-white/60 text-xs font-semibold transition-colors border border-white/8"
            >
              {savingNotes ? "Saving…" : "Save Note"}
            </button>
          </div>

        </div>
      </div>

      {/* ── Edit Metadata Modal ── */}
      {editingMeta && (
        <EditMetadataModal
          project={project}
          onClose={() => setEditingMeta(false)}
          onSave={async updates => {
            const ok = await updateProjectMeta(id, updates);
            if (ok) {
              setProject(p => p ? { ...p, ...updates } : p);
              setEditingMeta(false);
              showToast("Project updated");
            } else {
              showToast("Failed to save changes");
            }
          }}
        />
      )}

      {/* ── Request Update Modal ── */}
      {requestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#0e0e0e] border border-white/10 rounded-2xl shadow-2xl shadow-black/60 w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/6">
              <h2 className="font-bold text-white" style={{ fontFamily: "var(--font-syne), sans-serif" }}>Request Project Update</h2>
              <button onClick={() => setRequestModal(false)} className="text-white/30 hover:text-white/60 text-xl transition-colors">×</button>
            </div>
            <form onSubmit={handleRequestUpdate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Describe the changes needed *</label>
                <textarea
                  required rows={5} value={requestNote} onChange={e => setRequestNote(e.target.value)}
                  placeholder="e.g. Add a third bedroom option, update the roof style pricing, add a new garage size category…"
                  className="w-full bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/70 placeholder-white/15 focus:outline-none focus:ring-1 focus:ring-blue-500/60 resize-none transition-colors"
                />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setRequestModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-medium text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={requestingUpd}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-semibold shadow-lg shadow-blue-600/20 transition-colors">
                  {requestingUpd ? "Submitting…" : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

// ── OptionRow ─────────────────────────────────────────────────────────────────

function OptionRow({
  opt,
  editing,
  odd,
  onSave,
  onDelete,
}: {
  opt: Option;
  editing: boolean;
  odd: boolean;
  onSave: (u: Partial<Option>) => Promise<void>;
  onDelete: () => void;
}) {
  const [name,  setName]  = useState(opt.friendly_name);
  const [price, setPrice] = useState(opt.price_impact);
  const [dirty, setDirty] = useState(false);

  function markDirty<T>(setter: (v: T) => void, v: T) {
    setter(v); setDirty(true);
  }

  async function save() {
    await onSave({ friendly_name: name, price_impact: price });
    setDirty(false);
  }

  return (
    <div className={`flex items-center px-5 py-2 ${odd ? "bg-white/[0.015]" : ""}`}>
      {editing ? (
        <>
          <input
            value={name} onChange={e => markDirty(setName, e.target.value)}
            className="flex-1 text-sm bg-[#141414] border border-white/10 rounded-lg px-2.5 py-1 text-white/70 placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/60 mr-3 transition-colors"
          />
          <div className="relative w-28 mr-3">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-white/30 text-xs">+$</span>
            <input
              type="number" min={0} value={price}
              onChange={e => markDirty(setPrice, parseFloat(e.target.value) || 0)}
              className="w-full text-xs bg-[#141414] border border-white/10 rounded-lg pl-6 pr-2 py-1 text-white/70 focus:outline-none focus:ring-1 focus:ring-blue-500/60 transition-colors"
            />
          </div>
          <div className="flex items-center gap-1">
            {dirty && (
              <button onClick={save} className="text-xs px-2 py-1 bg-emerald-500/12 text-emerald-400 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 font-medium transition-colors">Save</button>
            )}
            <button onClick={onDelete} className="text-xs px-2 py-1 bg-red-500/12 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 font-medium transition-colors">Delete</button>
          </div>
        </>
      ) : (
        <>
          <span className="flex-1 text-sm text-white/60">{opt.friendly_name}</span>
          <span className={`text-sm font-medium ${opt.price_impact > 0 ? "text-blue-400" : "text-white/25"}`}>
            {opt.price_impact > 0
              ? `+${opt.price_impact.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}`
              : "Included"}
          </span>
        </>
      )}
    </div>
  );
}

// ── EditMetadataModal ─────────────────────────────────────────────────────────

function EditMetadataModal({
  project,
  onClose,
  onSave,
}: {
  project: Project;
  onClose: () => void;
  onSave: (u: Partial<Project>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    name:          project.name,
    home_type:     project.home_type      ?? "single_family",
    description:   project.description   ?? "",
    base_price:    project.base_price     ?? 0,
    beds:          project.beds           ?? 3,
    baths:         project.baths          ?? 2,
    floors:        project.floors         ?? 1,
    sqft:          project.sqft           ?? "",
    status:        project.status         ?? "in_development",
    sketchfab_uid: project.sketchfab_uid  ?? "",
    thumbnail_url: project.thumbnail_url  ?? "",
    slug:          project.slug           ?? "",
    company_slug:  project.company_slug   ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [thumbPreview, setThumbPreview] = useState<string>(project.thumbnail_url ?? "");
  const [thumbUploading, setThumbUploading] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(p => ({ ...p, [k]: v }));
  }

  function handleThumbChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setThumbFile(file);
    setThumbPreview(URL.createObjectURL(file));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    let thumbnailUrl = form.thumbnail_url;

    if (thumbFile) {
      setThumbUploading(true);
      const fd = new FormData();
      fd.append("file", thumbFile);
      fd.append("file_type", "image");
      const res = await fetch(`/api/projects/${project.id}/files`, { method: "POST", body: fd });
      if (res.ok) {
        const row = await res.json();
        thumbnailUrl = row.file_url;
        setForm(p => ({ ...p, thumbnail_url: thumbnailUrl }));
      }
      setThumbUploading(false);
    }

    await onSave({
      name:          form.name,
      home_type:     form.home_type,
      description:   form.description   || undefined,
      base_price:    Number(form.base_price),
      beds:          Number(form.beds),
      baths:         Number(form.baths),
      floors:        Number(form.floors),
      sqft:          form.sqft ? Number(form.sqft) : undefined,
      status:        form.status as Project["status"],
      sketchfab_uid: form.sketchfab_uid,
      thumbnail_url: thumbnailUrl || undefined,
      slug:          form.slug          || undefined,
      company_slug:  form.company_slug  || undefined,
    });
    setSaving(false);
  }

  const HOME_TYPES_MODAL = [
    { id: "single_family", label: "Single Family" },
    { id: "townhome",      label: "Townhome"      },
    { id: "duplex",        label: "Duplex"        },
    { id: "condo",         label: "Condo"         },
    { id: "custom",        label: "Custom"        },
  ];

  return (
    <div className="fixed inset-0 z-50 flex bg-black/60 backdrop-blur-sm">
      <div className="flex-1" onClick={onClose} />
      <div className="w-[520px] bg-[#0a0a0a] border-l border-white/8 shadow-2xl shadow-black/60 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/6 flex-shrink-0">
          <h2
            className="font-bold text-white text-lg"
            style={{ fontFamily: "var(--font-syne), sans-serif" }}
          >
            Edit Project Metadata
          </h2>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 text-xl transition-colors">×</button>
        </div>

        <form onSubmit={handleSave} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-5">

            <div>
              <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Project Name *</label>
              <input required value={form.name} onChange={e => set("name", e.target.value)}
                className={INPUT} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Home Type</label>
                <select value={form.home_type} onChange={e => set("home_type", e.target.value)}
                  className={SELECT}>
                  {HOME_TYPES_MODAL.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Status</label>
                <select value={form.status} onChange={e => set("status", e.target.value as "pending_review" | "in_development" | "in_review" | "live" | "archived")}
                  className={SELECT}>
                  {[
                    { id: "pending_review", label: "Pending Review" },
                    { id: "in_development", label: "In Development" },
                    { id: "in_review",      label: "In Review"      },
                    { id: "live",           label: "Live"           },
                    { id: "archived",       label: "Archived"       },
                  ].map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Description</label>
              <textarea rows={3} value={form.description} onChange={e => set("description", e.target.value)}
                placeholder="Describe this project…"
                className={`${INPUT} resize-none`} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Base Starting Price ($)</label>
              <input type="number" min={0} value={form.base_price} onChange={e => set("base_price", Number(e.target.value))}
                className={INPUT} />
            </div>

            <div className="grid grid-cols-4 gap-3">
              {[
                { key: "beds"   as const, label: "Beds",   type: "number", min: 1 },
                { key: "baths"  as const, label: "Baths",  type: "number", min: 0.5, step: 0.5 },
                { key: "floors" as const, label: "Floors", type: "number", min: 1 },
                { key: "sqft"   as const, label: "Sqft",   type: "number", min: 0 },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">{f.label}</label>
                  <input type={f.type} min={f.min} step={(f as { step?: number }).step}
                    value={form[f.key]} onChange={e => set(f.key, e.target.value as never)}
                    className={INPUT} />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Company Slug</label>
                <input value={form.company_slug} onChange={e => set("company_slug", e.target.value)}
                  placeholder="e.g. demo"
                  className={INPUT} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Project Slug</label>
                <input value={form.slug} onChange={e => set("slug", e.target.value)}
                  placeholder="e.g. the-cypress"
                  className={INPUT} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Sketchfab Model UID</label>
              <input value={form.sketchfab_uid} onChange={e => set("sketchfab_uid", e.target.value)}
                placeholder="32-character Sketchfab UID"
                className={`${INPUT} font-mono`} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Thumbnail</label>
              <label className="flex items-center gap-4 cursor-pointer group">
                <div className="w-24 h-16 rounded-lg overflow-hidden bg-[#141414] flex-shrink-0 border border-white/10">
                  {thumbPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumbPreview} alt="thumbnail" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/20">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7">
                        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                        <path d="m21 15-5-5L5 21"/>
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 text-xs font-medium text-white/50 bg-white/4 group-hover:bg-white/8 transition-colors">
                    {thumbUploading ? "Uploading…" : thumbFile ? "Change image" : thumbPreview ? "Replace image" : "Upload image"}
                  </span>
                  {thumbFile && <p className="mt-1 text-xs text-white/30 truncate max-w-[180px]">{thumbFile.name}</p>}
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={handleThumbChange} />
              </label>
            </div>

          </div>

          <div className="px-6 py-4 border-t border-white/6 flex gap-3 flex-shrink-0">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm font-medium text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-semibold shadow-lg shadow-blue-600/20 transition-colors">
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
