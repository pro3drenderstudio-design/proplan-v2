"use client";
// admin project request detail
import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getAllProjects, updateProjectStatus, updateProject, getBuilderByCompanySlug, getCategoriesWithOptions, getAllBuilders } from "@/lib/admin-api";
import { getProjectFiles, deleteProjectFile } from "@/lib/builder-api";
import { supabase } from "@/lib/supabase";
import { Project, Builder, CategoryWithOptions, ProjectFile } from "@/types/database";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ChatMsg = { id: string; project_id: string; sender_type: string; sender_id: string; sender_name: string; body: string | null; attachments: { url: string; name: string; type: string; size: number }[]; created_at: string; };
type ChatAtt = { url: string; name: string; type: string; size: number };
type ProjectStatus = NonNullable<Project["status"]>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyQuery = any;

const STATUS_MAP: Record<ProjectStatus, { label: string; style: string }> = {
  pending_review: { label: "New Request",   style: "text-amber-400 bg-amber-400/10 border-amber-400/30" },
  in_development: { label: "In Progress",   style: "text-blue-400 bg-blue-400/10 border-blue-400/30" },
  in_review:      { label: "Needs Mapping", style: "text-teal-300 bg-teal-400/10 border-teal-400/30" },
  live:           { label: "Live",          style: "text-green-400 bg-green-400/10 border-green-400/20" },
  archived:       { label: "Archived",      style: "text-white/30 bg-white/5 border-white/10" },
};

const TIMELINE: { status: ProjectStatus; label: string; actor: string; color: string }[] = [
  { status: "pending_review", label: "New Job created",          actor: "by Admin",         color: "bg-amber-400" },
  { status: "in_development", label: "Moved to In Progress",     actor: "by Admin User",    color: "bg-blue-400" },
  { status: "in_review",      label: "Ready for Node Mapping",   actor: "by System (Auto)", color: "bg-violet-400" },
  { status: "live",           label: "Published & Live",         actor: "by Admin User",    color: "bg-green-400" },
];

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
function timeAgo(s: string) {
  const h = Math.floor((Date.now() - new Date(s).getTime()) / 3_600_000);
  if (h < 24) return `Today, ${new Date(s).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  if (h < 48) return `Yesterday, ${new Date(s).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function shortId(id: string) {
  return id.slice(0, 4).toUpperCase() + "-" + id.slice(4, 8).toUpperCase();
}
function turnaroundDays(s: string) {
  const d = Math.floor((Date.now() - new Date(s).getTime()) / 86_400_000);
  return d === 0 ? "< 1 Day" : d === 1 ? "1 Day" : `${d} Days`;
}
function buildTimeline(project: Project) {
  const order: ProjectStatus[] = ["pending_review", "in_development", "in_review", "live"];
  const idx = order.indexOf(project.status ?? "pending_review");
  const base = new Date(project.created_at).getTime();
  return TIMELINE
    .filter((_, i) => i <= idx)
    .reverse()
    .map((stage, i) => ({ ...stage, timestamp: new Date(base + i * 4 * 3_600_000).toISOString() }));
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project,     setProject]     = useState<Project | null>(null);
  const [builder,     setBuilder]     = useState<Builder | null>(null);
  const [allBuilders, setAllBuilders] = useState<Builder[]>([]);
  const [categories,  setCategories]  = useState<CategoryWithOptions[]>([]);
  const [files,       setFiles]       = useState<ProjectFile[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [updating,    setUpdating]    = useState(false);
  const [reassigning, setReassigning] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [toast,       setToast]       = useState("");
  const [editing,     setEditing]     = useState(false);
  const [editForm,    setEditForm]    = useState<{
    name: string; slug: string; sketchfab_uid: string; home_type: string;
    description: string; beds: string; baths: string; floors: string;
    sqft: string; base_price: string; thumbnail_url: string;
  } | null>(null);
  const [saving,         setSaving]         = useState(false);
  const [thumbUploading, setThumbUploading] = useState(false);
  const [thumbPreview,   setThumbPreview]   = useState<string | null>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  // Chat state
  const [chatMsgs,      setChatMsgs]      = useState<ChatMsg[]>([]);
  const [chatBody,      setChatBody]      = useState("");
  const [chatFiles,     setChatFiles]     = useState<ChatAtt[]>([]);
  const [chatUploading, setChatUploading] = useState(false);
  const [chatSending,   setChatSending]   = useState(false);
  const [adminId,       setAdminId]       = useState("");
  const [adminName,     setAdminName]     = useState("Admin");
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatFileRef   = useRef<HTMLInputElement>(null);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  useEffect(() => {
    getAllProjects().then(async all => {
      const proj = all.find(p => p.id === id) ?? null;
      setProject(proj);
      if (proj) {
        const [cats, bld, builders, fls] = await Promise.all([
          getCategoriesWithOptions(proj.id),
          proj.company_slug ? getBuilderByCompanySlug(proj.company_slug) : Promise.resolve(null),
          getAllBuilders(),
          getProjectFiles(proj.id),
        ]);
        setCategories(cats); setBuilder(bld); setAllBuilders(builders); setFiles(fls);
      }
      setLoading(false);
    });
  }, [id]);

  // Chat identity + polling
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      setAdminId(user.id);
      const { data: prof } = await (supabase as AnyQuery).from("profiles").select("full_name").eq("id", user.id).single();
      setAdminName(prof?.full_name ?? "Admin");
    });
    const loadMsgs = () => fetch(`/api/project-messages/${id}`)
      .then(r => r.ok ? r.json() : [])
      .then(msgs => setChatMsgs(Array.isArray(msgs) ? msgs : []))
      .catch(() => {});
    loadMsgs();
    const t = setInterval(loadMsgs, 8000);
    return () => clearInterval(t);
  }, [id]);

  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMsgs]);

  async function handleChatFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setChatUploading(true);
    const uploads = await Promise.all(files.map(async file => {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/upload/render-attachment", { method: "POST", body: fd });
      return res.ok ? res.json() as Promise<ChatAtt> : null;
    }));
    setChatFiles(prev => [...prev, ...(uploads.filter(Boolean) as ChatAtt[])]);
    setChatUploading(false);
    if (chatFileRef.current) chatFileRef.current.value = "";
  }

  async function handleChatSend(e: React.FormEvent) {
    e.preventDefault();
    const bodyTrim = chatBody.trim();
    if (!bodyTrim && !chatFiles.length) return;
    setChatSending(true);
    const res = await fetch(`/api/project-messages/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sender_type: "admin",
        sender_id:   adminId,
        sender_name: adminName,
        body:        bodyTrim || null,
        attachments: chatFiles,
      }),
    });
    if (res.ok) {
      const newMsg = await res.json() as ChatMsg;
      setChatMsgs(prev => [...prev, newMsg]);
      setChatBody(""); setChatFiles([]);
    }
    setChatSending(false);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !project) return;
    setUploadingFile(true);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const isImg = ["jpg","jpeg","png","webp","gif","svg"].includes(ext);
    const isCad = ["dwg","dxf","rvt","ifc","skp","obj","fbx","stl","pdf"].includes(ext);
    const fileType = isImg ? "image" : isCad ? "cad" : "reference";
    const formData = new FormData();
    formData.append("file", file); formData.append("file_type", fileType);
    try {
      const res = await fetch(`/api/projects/${project.id}/files`, { method: "POST", body: formData });
      if (res.ok) { const newFile = await res.json() as ProjectFile; setFiles(prev => [newFile, ...prev]); showToast("File uploaded"); }
      else showToast("Upload failed");
    } catch { showToast("Upload failed"); }
    finally { setUploadingFile(false); e.target.value = ""; }
  }

  async function handleDeleteFile(fileId: string) {
    if (!confirm("Delete this file?")) return;
    const ok = await deleteProjectFile(fileId);
    if (ok) { setFiles(prev => prev.filter(f => f.id !== fileId)); showToast("File deleted"); }
  }

  async function handleReassign(companySlug: string) {
    if (!project) return;
    setReassigning(true);
    await (supabase.from("projects") as AnyQuery).update({ company_slug: companySlug, updated_at: new Date().toISOString() }).eq("id", project.id);
    const newBuilder = companySlug ? await getBuilderByCompanySlug(companySlug) : null;
    setProject(prev => prev ? { ...prev, company_slug: companySlug } : null);
    setBuilder(newBuilder);
    setReassigning(false);
  }

  async function moveStatus(status: ProjectStatus) {
    if (!project) return;
    setUpdating(true);
    const ok = await updateProjectStatus(project.id, status);
    if (ok) setProject(prev => prev ? { ...prev, status, updated_at: new Date().toISOString() } : null);
    setUpdating(false);
  }

  function startEdit() {
    if (!project) return;
    setEditForm({
      name: project.name ?? "", slug: project.slug ?? "", sketchfab_uid: project.sketchfab_uid ?? "",
      home_type: project.home_type ?? "", description: project.description ?? "",
      beds: String(project.beds ?? ""), baths: String(project.baths ?? ""),
      floors: String(project.floors ?? ""), sqft: String(project.sqft ?? ""),
      base_price: String(project.base_price ?? ""), thumbnail_url: project.thumbnail_url ?? "",
    });
    setThumbPreview(null);
    setEditing(true);
  }

  async function handleSaveEdit() {
    if (!project || !editForm) return;
    setSaving(true);
    const payload = {
      name:          editForm.name || project.name,
      slug:          editForm.slug || undefined,
      sketchfab_uid: editForm.sketchfab_uid || project.sketchfab_uid,
      home_type:     editForm.home_type || undefined,
      description:   editForm.description || undefined,
      beds:          editForm.beds   ? Number(editForm.beds)   : project.beds,
      baths:         editForm.baths  ? Number(editForm.baths)  : project.baths,
      floors:        editForm.floors ? Number(editForm.floors) : undefined,
      sqft:          editForm.sqft   ? Number(editForm.sqft)   : undefined,
      base_price:    editForm.base_price ? Number(editForm.base_price) : project.base_price,
      thumbnail_url: editForm.thumbnail_url || undefined,
    };
    const ok = await updateProject(project.id, payload);
    if (ok) {
      setProject(prev => prev ? { ...prev, ...payload, updated_at: new Date().toISOString() } : null);
      showToast("Project saved"); setEditing(false); setEditForm(null);
    } else showToast("Save failed — check RLS");
    setSaving(false);
  }

  const handleThumbnailUpload = useCallback(async (file: File) => {
    if (!project) return;
    setThumbUploading(true);
    setThumbPreview(URL.createObjectURL(file));
    const fd = new FormData(); fd.append("file", file);
    try {
      const res = await fetch(`/api/projects/${project.id}/thumbnail`, { method: "POST", body: fd });
      if (res.ok) {
        const { url } = await res.json() as { url: string };
        setEditForm(f => f ? { ...f, thumbnail_url: url } : f);
        setProject(prev => prev ? { ...prev, thumbnail_url: url } : null);
        showToast("Thumbnail updated");
      } else {
        const body = await res.json().catch(() => ({})) as { error?: string };
        showToast(`Upload failed: ${body.error ?? res.statusText}`);
        setThumbPreview(null);
      }
    } catch { showToast("Upload failed"); setThumbPreview(null); }
    finally { setThumbUploading(false); }
  }, [project]);

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!project) return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <p className="text-white/40 text-sm">Project not found.</p>
      <Link href="/admin/requests" className="text-xs text-blue-400 hover:underline">← Back to Queue</Link>
    </div>
  );

  const status   = STATUS_MAP[project.status ?? "pending_review"];
  const timeline = buildTimeline(project);

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#111] border border-white/15 text-white text-sm px-4 py-2.5 rounded-xl shadow-2xl">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="px-6 py-4 border-b border-white/8 flex-shrink-0">
        <div className="flex items-center gap-1.5 text-[10px] text-white/30 mb-3">
          <Link href="/admin/requests" className="hover:text-white transition-colors">Production Queue</Link>
          <span>›</span>
          {builder && <><span className="text-white/50">{builder.company_name}</span><span>›</span></>}
          <span className="text-white/50 font-mono">ID: {shortId(project.id)}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {project.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={project.thumbnail_url} alt={project.name} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-[#111] border border-white/10 flex items-center justify-center flex-shrink-0">
                <HouseIcon className="w-5 h-5 text-white/40" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg font-bold text-white">{project.name}</h1>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${status.style}`}>{status.label}</span>
              </div>
              <p className="text-xs text-white/35 mt-0.5 flex items-center gap-2">
                {builder && <span className="text-white/50">{builder.company_name}</span>}
                {builder && <span className="text-white/20">•</span>}
                <span className="font-mono">{shortId(project.id)}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {project.status === "live" && project.slug && project.company_slug && (
              <a href={`/project/${project.company_slug}/${project.slug}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/15 border border-green-400/25 text-xs text-green-400 font-medium rounded-lg hover:bg-green-500/25 transition-colors">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Preview Configurator
              </a>
            )}
            <button onClick={() => moveStatus("archived")} disabled={updating || project.status === "archived"}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-white/12 text-xs text-white/50 rounded-lg hover:text-white hover:border-white/25 transition-colors disabled:opacity-40">
              Archive
            </button>
            <Link href={`/admin/node-bridge?project=${project.id}`}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-xs text-white font-medium rounded-lg hover:bg-blue-500 transition-colors">
              Enter Node Bridge
            </Link>
          </div>
        </div>
      </div>

      {/* Two-column body */}
      <div className="flex-1 overflow-hidden flex">

        {/* ── Left: Project Info ───────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Meta cards */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Created",     value: new Date(project.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) },
              { label: "Builder",     value: builder?.company_name ?? project.company_slug ?? "—" },
              { label: "In Pipeline", value: turnaroundDays(project.created_at) },
              { label: "Priority",    value: Date.now() - new Date(project.created_at).getTime() < 86_400_000 ? "High" : "Normal",
                valueColor: Date.now() - new Date(project.created_at).getTime() < 86_400_000 ? "text-amber-400" : "text-white/70" },
            ].map((c, i) => (
              <div key={i} className="bg-[#1a1a1a] border border-white/8 rounded-xl p-3.5">
                <p className="text-[9px] font-bold uppercase tracking-widest text-white/25 mb-2">{c.label}</p>
                <p className={`text-sm font-bold truncate ${c.valueColor ?? "text-white/80"}`}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* Project Details */}
          <div className="bg-[#1a1a1a] border border-white/8 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
              <h3 className="text-xs font-bold text-white">Project Details</h3>
              <div className="flex items-center gap-2">
                {project.slug && project.company_slug && !editing && (
                  <a href={`/project/${project.company_slug}/${project.slug}`} target="_blank" rel="noreferrer"
                    className="text-xs text-white/35 hover:text-blue-400 transition-colors">
                    View Configurator →
                  </a>
                )}
                {editing ? (
                  <>
                    <button onClick={() => { setEditing(false); setEditForm(null); setThumbPreview(null); }}
                      className="text-xs px-2.5 py-1 rounded-lg border border-white/12 text-white/40 hover:text-white transition-colors">
                      Cancel
                    </button>
                    <button onClick={handleSaveEdit} disabled={saving}
                      className="text-xs px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-50">
                      {saving ? "Saving…" : "Save"}
                    </button>
                  </>
                ) : (
                  <button onClick={startEdit}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg border border-white/12 text-white/40 hover:text-white hover:border-white/25 transition-colors">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                    </svg>
                    Edit
                  </button>
                )}
              </div>
            </div>
            <div className="p-4 space-y-4">
              {editing && editForm ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1.5">Project Name</label>
                    <input value={editForm.name} onChange={e => setEditForm(f => f && ({ ...f, name: e.target.value }))}
                      className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/60 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1.5">URL Slug</label>
                    <input value={editForm.slug} onChange={e => setEditForm(f => f && ({ ...f, slug: e.target.value }))}
                      className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-xs text-white/80 font-mono focus:outline-none focus:border-blue-500/60 transition-colors" placeholder="e.g. oakwood-3br" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1.5">Sketchfab UID</label>
                    <input value={editForm.sketchfab_uid} onChange={e => setEditForm(f => f && ({ ...f, sketchfab_uid: e.target.value }))}
                      className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-xs text-white/80 font-mono focus:outline-none focus:border-blue-500/60 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1.5">Home Type</label>
                    <select value={editForm.home_type} onChange={e => setEditForm(f => f && ({ ...f, home_type: e.target.value }))}
                      className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/60 transition-colors">
                      <option value="">— Select —</option>
                      {["single_family","multi_family","townhome","condo","duplex","custom"].map(t => (
                        <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1.5">Base Price ($)</label>
                    <input type="number" value={editForm.base_price} onChange={e => setEditForm(f => f && ({ ...f, base_price: e.target.value }))}
                      className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/60 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1.5">Beds</label>
                    <input type="number" value={editForm.beds} onChange={e => setEditForm(f => f && ({ ...f, beds: e.target.value }))}
                      className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/60 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1.5">Baths</label>
                    <input type="number" value={editForm.baths} onChange={e => setEditForm(f => f && ({ ...f, baths: e.target.value }))}
                      className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/60 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1.5">Floors</label>
                    <input type="number" value={editForm.floors} onChange={e => setEditForm(f => f && ({ ...f, floors: e.target.value }))}
                      className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/60 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1.5">Sqft</label>
                    <input type="number" value={editForm.sqft} onChange={e => setEditForm(f => f && ({ ...f, sqft: e.target.value }))}
                      className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/60 transition-colors" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1.5">Thumbnail</label>
                    <input ref={thumbInputRef} type="file" accept="image/*" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleThumbnailUpload(f); e.target.value = ""; }} />
                    <div onClick={() => !thumbUploading && thumbInputRef.current?.click()}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith("image/")) handleThumbnailUpload(f); }}
                      className="flex items-center gap-3 border border-dashed border-white/15 rounded-lg px-3 py-2.5 cursor-pointer hover:border-blue-500/40 hover:bg-blue-600/5 transition-colors">
                      {thumbUploading ? (
                        <div className="w-4 h-4 border border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                      ) : (thumbPreview ?? editForm.thumbnail_url) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumbPreview ?? editForm.thumbnail_url} alt="Thumbnail"
                          className="w-12 h-9 rounded object-cover flex-shrink-0 border border-white/10" />
                      ) : (
                        <div className="w-12 h-9 rounded bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M4.5 4.5h15a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75h-15a.75.75 0 01-.75-.75V5.25a.75.75 0 01.75-.75z" />
                          </svg>
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-xs text-white/40">{thumbUploading ? "Uploading…" : "Click or drop to replace thumbnail"}</p>
                        <p className="text-[10px] text-white/20 mt-0.5">PNG, JPG, WEBP</p>
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1.5">Description</label>
                    <textarea value={editForm.description} onChange={e => setEditForm(f => f && ({ ...f, description: e.target.value }))}
                      rows={3} className="w-full bg-[#111] border border-white/10 rounded-lg px-3 py-2 text-xs text-white/80 focus:outline-none focus:border-blue-500/60 transition-colors resize-none" />
                  </div>
                </div>
              ) : (
                <>
                  {project.description && (
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-white/25 mb-2">Description</p>
                      <div className="bg-[#111] border border-white/8 rounded-xl px-4 py-3">
                        <p className="text-xs text-white/65 leading-relaxed">{project.description}</p>
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-white/25 mb-2">Specifications</p>
                      <div className="space-y-1.5">
                        {[
                          ["Type",       project.home_type?.replace(/_/g, " ") ?? "—"],
                          ["Beds",       project.beds ?? "—"],
                          ["Baths",      project.baths ?? "—"],
                          ["Floors",     project.floors ?? "—"],
                          ["Sqft",       project.sqft ? `${project.sqft.toLocaleString()} sqft` : "—"],
                          ["Base Price", project.base_price ? fmt(project.base_price) : "—"],
                        ].map(([k, v]) => (
                          <div key={k} className="flex items-center justify-between text-xs">
                            <span className="text-white/35">{k}</span>
                            <span className="text-white/65 capitalize">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-white/25 mb-2">Categories Configured</p>
                      {categories.length === 0 ? (
                        <p className="text-xs text-white/25">No categories yet</p>
                      ) : (
                        <div className="space-y-1.5">
                          {categories.slice(0, 6).map(cat => (
                            <div key={cat.id} className="flex items-center justify-between text-xs">
                              <span className="text-white/60">{cat.name}</span>
                              <span className="text-white/30">{cat.options.length} options</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 3D Asset Status */}
          <div className="bg-[#1a1a1a] border border-white/8 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
              <h3 className="text-xs font-bold text-white">3D Asset Status</h3>
              {project.sketchfab_uid ? (
                <span className="text-[10px] font-bold text-green-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" /> Model Linked
                </span>
              ) : (
                <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> No Model Yet
                </span>
              )}
            </div>
            <div className="grid grid-cols-3">
              <div className="border-r border-white/8 flex items-center justify-center py-10">
                <div className="text-center">
                  {project.thumbnail_url ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={project.thumbnail_url} alt={project.name} className="w-20 h-20 rounded-2xl object-cover mx-auto mb-2 border border-white/10" />
                      <p className="text-[10px] text-white/25">Thumbnail</p>
                    </>
                  ) : (
                    <>
                      <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-2">
                        <HouseIcon className="w-7 h-7 text-white/20" />
                      </div>
                      <p className="text-[10px] text-white/25">No Thumbnail</p>
                    </>
                  )}
                </div>
              </div>
              <div className="col-span-2 grid grid-cols-2 divide-x divide-y divide-white/5">
                {[
                  { label: "Sketchfab UID",  value: project.sketchfab_uid || "—", color: project.sketchfab_uid ? "text-blue-400" : "text-white/30" },
                  { label: "Categories",     value: `${categories.length} configured`, color: "text-white/60" },
                  { label: "Mapping Status", value: project.status === "in_review" ? "Pending Nodes" : project.status === "live" ? "Complete" : "Not Started",
                    color: project.status === "in_review" ? "text-amber-400" : project.status === "live" ? "text-green-400" : "text-white/40" },
                  { label: "Total Options",  value: `${categories.reduce((s,c) => s + c.options.length, 0)} options`, color: "text-white/60" },
                ].map((s, i) => (
                  <div key={i} className="px-4 py-4">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-white/25 mb-1">{s.label}</p>
                    <p className={`text-xs font-medium ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Stage controls */}
          <div className="bg-[#1a1a1a] border border-white/8 rounded-xl p-4">
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/25 mb-3">Move Pipeline Stage</p>
            <div className="flex items-center gap-2 flex-wrap">
              {(["pending_review", "in_development", "in_review", "live"] as ProjectStatus[]).map(s => {
                const st = STATUS_MAP[s];
                const active = (project.status ?? "pending_review") === s;
                return (
                  <button key={s} onClick={() => moveStatus(s)} disabled={updating || active}
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
                      active ? `${st.style} cursor-default` : "border-white/12 text-white/40 hover:text-white hover:border-white/25"
                    }`}>
                    {st.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* File Uploads */}
          <div className="bg-[#1a1a1a] border border-white/8 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
              <div>
                <h3 className="text-xs font-bold text-white">Project Files</h3>
                <p className="text-[10px] text-white/30 mt-0.5">CAD files, blueprints, references</p>
              </div>
              <button onClick={() => fileInputRef.current?.click()} disabled={uploadingFile}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-600/20 border border-blue-500/30 text-xs text-blue-400 rounded-lg hover:bg-blue-600/30 transition-colors disabled:opacity-50">
                {uploadingFile ? (
                  <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                )}
                Upload
              </button>
              <input ref={fileInputRef} type="file" className="hidden"
                accept="image/*,.pdf,.dwg,.dxf,.rvt,.ifc,.skp,.obj,.fbx,.stl,.zip"
                onChange={handleFileUpload} />
            </div>
            <div onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (!file || !project) return; const fakeEvt = { target: { files: e.dataTransfer.files, value: "" } } as unknown as React.ChangeEvent<HTMLInputElement>; handleFileUpload(fakeEvt); }}
              className="px-4 py-2">
              {files.length === 0 ? (
                <div className="py-6 text-center border border-dashed border-white/10 rounded-lg">
                  <p className="text-xs text-white/25">No files yet. Drop files here or click Upload.</p>
                  <p className="text-[10px] text-white/15 mt-1">Supports: images, PDFs, CAD (.dwg, .dxf, .rvt, .ifc, .skp)</p>
                </div>
              ) : (
                <div className="space-y-1.5 py-2">
                  {files.map(f => (
                    <div key={f.id} className="flex items-center gap-3 px-3 py-2 bg-[#111] border border-white/6 rounded-lg group">
                      <div className={`w-7 h-7 rounded flex items-center justify-center flex-shrink-0 text-[9px] font-bold ${
                        f.file_type === "image" ? "bg-blue-500/20 text-blue-400" :
                        f.file_type === "cad"   ? "bg-violet-500/20 text-violet-400" :
                        "bg-white/8 text-white/40"
                      }`}>
                        {f.file_type === "image" ? "IMG" : f.file_type === "cad" ? "CAD" : "REF"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <a href={f.file_url} target="_blank" rel="noreferrer"
                          className="text-xs text-white/70 hover:text-blue-400 transition-colors truncate block">
                          {f.file_name}
                        </a>
                        <p className="text-[10px] text-white/25">
                          {new Date(f.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          {f.size_bytes ? ` · ${(f.size_bytes / 1024).toFixed(0)} KB` : ""}
                        </p>
                      </div>
                      <button onClick={() => handleDeleteFile(f.id)}
                        className="opacity-0 group-hover:opacity-100 text-white/25 hover:text-red-400 transition-all text-sm leading-none">
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Builder Info + Reassign */}
          <div className="bg-[#1a1a1a] border border-white/8 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/8 flex items-center gap-2">
              {builder?.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={builder.logo_url} alt={builder.company_name} className="w-6 h-6 rounded object-contain flex-shrink-0" />
              )}
              <h3 className="text-xs font-bold text-white">{builder?.company_name ?? "Unassigned"}</h3>
            </div>
            {builder && (
              <div className="divide-y divide-white/5">
                {[
                  { label: "Email",   value: builder.contact_email },
                  { label: "Phone",   value: builder.phone },
                  { label: "Address", value: [builder.billing_address, builder.city, builder.state].filter(Boolean).join(", ") },
                ].filter(r => r.value).map(r => (
                  <div key={r.label} className="flex items-start justify-between px-4 py-2.5 gap-2">
                    <span className="text-[10px] text-white/35 flex-shrink-0">{r.label}</span>
                    <span className="text-xs text-white/60 text-right">{r.value}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="px-4 py-3 space-y-2.5 border-t border-white/5">
              <p className="text-[9px] font-bold uppercase tracking-widest text-white/25">Reassign Builder</p>
              <select value={project.company_slug ?? ""} disabled={reassigning} onChange={e => handleReassign(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white/70 focus:outline-none focus:border-blue-500/60 disabled:opacity-50">
                <option value="">— Unassigned —</option>
                {allBuilders.map(b => <option key={b.id} value={b.company_slug}>{b.company_name}</option>)}
              </select>
              {builder && (
                <Link href="/admin/builders" className="text-[10px] text-blue-400 hover:underline block">
                  View Builder Profile →
                </Link>
              )}
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-[#1a1a1a] border border-white/8 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/8">
              <h3 className="text-xs font-bold text-white">Pricing</h3>
            </div>
            <div className="p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/40">Base Price</span>
                <span className="text-xs font-bold text-white/80">{project.base_price ? fmt(project.base_price) : "Not set"}</span>
              </div>
              {categories.map(cat => (
                cat.options.filter(o => o.price_impact > 0).length > 0 && (
                  <div key={cat.id} className="flex items-center justify-between">
                    <span className="text-xs text-white/35">{cat.name}</span>
                    <span className="text-xs text-white/40">{cat.options.filter(o => o.price_impact > 0).length} upgrades</span>
                  </div>
                )
              ))}
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="bg-[#1a1a1a] border border-white/8 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/8">
              <h3 className="text-xs font-bold text-white">Activity Timeline</h3>
            </div>
            <div className="p-4 space-y-4">
              {timeline.map((ev, i) => (
                <div key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-0.5 ${ev.color}`} />
                    {i < timeline.length - 1 && <div className="w-px flex-1 bg-white/8 mt-1" />}
                  </div>
                  <div className="pb-2">
                    <p className="text-[10px] text-white/30 mb-0.5">{timeAgo(ev.timestamp)}</p>
                    <p className="text-xs text-white/70 font-medium leading-snug">{ev.label}</p>
                    <p className="text-[10px] text-white/30">{ev.actor}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* ── Right: Chat ──────────────────────────────────────────────── */}
        <div className="w-[400px] flex-shrink-0 border-l border-white/8 flex flex-col bg-[#0d0d0d]">
          {/* Chat header */}
          <div className="px-5 py-3.5 border-b border-white/8 flex-shrink-0">
            <p className="text-xs font-bold text-white/50 uppercase tracking-wide">Messages · Builder Communication</p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {chatMsgs.length === 0 && (
              <p className="text-center text-white/25 text-sm py-10">No messages yet.</p>
            )}
            {chatMsgs.map(msg => {
              const isAdmin = msg.sender_type === "admin";
              const imgs  = (msg.attachments ?? []).filter(a => a.type.startsWith("image/"));
              const fls   = (msg.attachments ?? []).filter(a => !a.type.startsWith("image/"));
              return (
                <div key={msg.id} className={`flex flex-col gap-1 max-w-[85%] ${isAdmin ? "items-end ml-auto" : "items-start mr-auto"}`}>
                  <div className={`px-4 py-3 rounded-2xl ${isAdmin ? "bg-blue-600/80 text-white rounded-br-sm" : "bg-[#1a1a1a] border border-white/10 text-white/85 rounded-bl-sm"}`}>
                    {msg.body && <p className="text-sm whitespace-pre-wrap">{msg.body}</p>}
                    {imgs.length > 0 && (
                      <div className="grid grid-cols-3 gap-1.5 mt-2">
                        {imgs.map((att, i) => (
                          <a key={i} href={att.url} target="_blank" rel="noreferrer" className="block rounded-lg overflow-hidden aspect-square bg-white/5 hover:opacity-80">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
                          </a>
                        ))}
                      </div>
                    )}
                    {fls.map((att, i) => (
                      <a key={i} href={att.url} target="_blank" rel="noreferrer" download
                        className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/60 mt-1 hover:text-white/80 transition-colors">
                        <span className="truncate">{att.name}</span>
                        <span className="ml-auto text-white/25 flex-shrink-0">{(att.size / 1024).toFixed(0)}KB</span>
                      </a>
                    ))}
                  </div>
                  <p className="text-[11px] text-white/25 px-1">
                    {msg.sender_name} · {new Date(msg.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </p>
                </div>
              );
            })}
            <div ref={chatBottomRef} />
          </div>

          {/* Attachments preview */}
          {chatFiles.length > 0 && (
            <div className="px-4 pt-3 flex flex-wrap gap-2 border-t border-white/8">
              {chatFiles.map((f, i) => (
                <div key={i} className="flex items-center gap-1.5 bg-white/8 border border-white/10 rounded-lg px-2 py-1 text-xs text-white/60">
                  <span className="truncate max-w-[120px]">{f.name}</span>
                  <button onClick={() => setChatFiles(prev => prev.filter((_, j) => j !== i))} className="text-white/30 hover:text-white/70">×</button>
                </div>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t border-white/8 flex-shrink-0">
            <form onSubmit={handleChatSend} className="flex items-end gap-2">
              <input ref={chatFileRef} type="file" multiple className="hidden" onChange={handleChatFileSelect} />
              <button type="button" onClick={() => chatFileRef.current?.click()} disabled={chatUploading}
                className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-white/6 hover:bg-white/10 border border-white/10 text-white/40 hover:text-white/70 disabled:opacity-40 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"/>
                </svg>
              </button>
              <textarea value={chatBody} onChange={e => setChatBody(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (!chatSending && !chatUploading && (chatBody.trim() || chatFiles.length)) handleChatSend(e as unknown as React.FormEvent); } }}
                placeholder="Message builder… (Enter to send)"
                rows={2}
                className="flex-1 bg-[#141414] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white/80 placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-blue-500/60 focus:border-blue-500/40 resize-none transition-colors" />
              <button type="submit" disabled={chatSending || chatUploading || (!chatBody.trim() && !chatFiles.length)}
                className="flex-shrink-0 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors">
                {chatSending ? "…" : "Send"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function HouseIcon({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>;
}
