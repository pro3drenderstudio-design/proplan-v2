"use client";

import { useEffect, useState, useRef } from "react";
import { FloorPlan, HomeStyle, Project } from "@/types/database";
import { getBuilderProjects } from "@/lib/builder-api";
import { supabase } from "@/lib/supabase";

const HOME_STYLES: { value: HomeStyle; label: string }[] = [
  { value: "ranch",         label: "Ranch" },
  { value: "two_story",     label: "Two Story" },
  { value: "craftsman",     label: "Craftsman" },
  { value: "modern",        label: "Modern" },
  { value: "colonial",      label: "Colonial" },
  { value: "cape_cod",      label: "Cape Cod" },
  { value: "mediterranean", label: "Mediterranean" },
  { value: "contemporary",  label: "Contemporary" },
];

function fmtPrice(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

const EMPTY_FORM = {
  name: "",
  description: "",
  beds: "",
  baths: "",
  floors: "",
  sqft: "",
  garage_spaces: "",
  home_style: "" as HomeStyle | "",
  base_price: "",
  project_id: "",
};

type FormState = typeof EMPTY_FORM;

export default function FloorPlansPage() {
  const [plans,     setPlans]     = useState<FloorPlan[]>([]);
  const [projects,  setProjects]  = useState<Project[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [builderId, setBuilderId] = useState<string | null>(null);

  // Modal state
  const [editing,   setEditing]   = useState<FloorPlan | null>(null); // null = new
  const [modalOpen, setModalOpen] = useState(false);
  const [form,      setForm]      = useState<FormState>(EMPTY_FORM);
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState<string | null>(null);
  const [toast,     setToast]     = useState("");

  // Thumbnail upload
  const thumbRef   = useRef<HTMLInputElement>(null);
  const [thumbUrl, setThumbUrl]   = useState<string | null>(null);
  const [thumbBusy, setThumbBusy] = useState(false);

  // Per-floor plan images
  const [floorImages, setFloorImages] = useState<(string | null)[]>([]);
  const [floorBusy,   setFloorBusy]   = useState<boolean[]>([]);
  const floorRefs = useRef<(HTMLInputElement | null)[]>([]);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3000); }

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile } = await (supabase.from("profiles") as any)
        .select("builder_id").eq("id", user.id).single();
      const bid = profile?.builder_id;
      if (!bid) { setLoading(false); return; }
      setBuilderId(bid);

      const [plansRes, projs] = await Promise.all([
        fetch(`/api/builder/floor-plans?builderId=${bid}`).then(r => r.json()),
        getBuilderProjects(),
      ]);
      setPlans(plansRes as FloorPlan[]);
      setProjects((projs as Project[]).filter(p => p.status === "live" || p.status === "in_development"));
      setLoading(false);
    })();
  }, []);

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setThumbUrl(null);
    setFloorImages([]);
    setFloorBusy([]);
    setModalOpen(true);
  }

  function openEdit(fp: FloorPlan) {
    setEditing(fp);
    const floorsNum = fp.floors ?? 0;
    const imgs = (fp.floor_plan_images ?? []) as { url: string; label?: string }[];
    setForm({
      name:          fp.name,
      description:   fp.description ?? "",
      beds:          fp.beds != null    ? String(fp.beds)          : "",
      baths:         fp.baths != null   ? String(fp.baths)         : "",
      floors:        fp.floors != null  ? String(fp.floors)        : "",
      sqft:          fp.sqft != null    ? String(fp.sqft)          : "",
      garage_spaces: fp.garage_spaces != null ? String(fp.garage_spaces) : "",
      home_style:    fp.home_style ?? "",
      base_price:    fp.base_price != null ? String(fp.base_price / 100) : "",
      project_id:    fp.project_id ?? "",
    });
    setThumbUrl(fp.thumbnail_url);
    setFloorImages(Array.from({ length: floorsNum }, (_, i) => imgs[i]?.url ?? null));
    setFloorBusy(Array.from({ length: floorsNum }, () => false));
    setModalOpen(true);
  }

  function closeModal() { setModalOpen(false); setEditing(null); }

  async function uploadThumbnail(file: File) {
    if (!builderId) return;
    setThumbBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("path", `floor-plan-thumbnails/${builderId}/${Date.now()}_${file.name}`);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (res.ok) {
      const { url } = await res.json() as { url: string };
      setThumbUrl(url);
    }
    setThumbBusy(false);
  }

  async function uploadFloorImage(file: File, floorIdx: number) {
    if (!builderId) return;
    setFloorBusy(prev => { const next = [...prev]; next[floorIdx] = true; return next; });
    const fd = new FormData();
    fd.append("file", file);
    fd.append("path", `floor-plan-images/${builderId}/${Date.now()}_floor${floorIdx + 1}_${file.name}`);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (res.ok) {
      const { url } = await res.json() as { url: string };
      setFloorImages(prev => { const next = [...prev]; next[floorIdx] = url; return next; });
    }
    setFloorBusy(prev => { const next = [...prev]; next[floorIdx] = false; return next; });
  }

  function onFloorsChange(val: string) {
    const n = Math.max(0, Math.min(10, parseInt(val) || 0));
    setFloorImages(prev => Array.from({ length: n }, (_, i) => prev[i] ?? null));
    setFloorBusy(prev => Array.from({ length: n }, (_, i) => prev[i] ?? false));
    setForm(f => ({ ...f, floors: val }));
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);

    const floorsNum = form.floors ? Number(form.floors) : 0;
    const payload = {
      name:              form.name.trim(),
      description:       form.description || null,
      beds:              form.beds          ? Number(form.beds)          : null,
      baths:             form.baths         ? Number(form.baths)         : null,
      floors:            floorsNum || null,
      sqft:              form.sqft          ? Number(form.sqft)          : null,
      garage_spaces:     form.garage_spaces ? Number(form.garage_spaces) : null,
      home_style:        form.home_style    || null,
      base_price:        form.base_price    ? Math.round(Number(form.base_price) * 100) : null,
      project_id:        form.project_id    || null,
      thumbnail_url:     thumbUrl,
      floor_plan_images: floorImages
        .map((url, i) => url ? { url, label: `Floor ${i + 1}` } : null)
        .filter((x): x is { url: string; label: string } => x !== null),
    };

    if (editing) {
      const res = await fetch(`/api/builder/floor-plans/${editing.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setPlans(prev => prev.map(p => p.id === editing.id ? { ...p, ...payload } as FloorPlan : p));
        showToast("Floor plan updated");
        closeModal();
      } else showToast("Save failed");
    } else {
      const res = await fetch("/api/builder/floor-plans", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const newPlan = await res.json() as FloorPlan;
        setPlans(prev => [...prev, newPlan]);
        showToast("Floor plan created");
        closeModal();
      } else showToast("Create failed");
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this floor plan? Lots assigned to it will lose the assignment.")) return;
    setDeleting(id);
    const res = await fetch(`/api/builder/floor-plans/${id}`, { method: "DELETE" });
    if (res.ok) {
      setPlans(prev => prev.filter(p => p.id !== id));
      showToast("Deleted");
    } else showToast("Delete failed");
    setDeleting(null);
  }

  const inputCls = "w-full bg-[#1a1a1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-blue-500/60 transition-colors placeholder-white/20";
  const labelCls = "block text-[9px] font-bold uppercase tracking-widest text-white/30 mb-1.5";

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#111] border border-white/15 text-white text-sm px-4 py-2.5 rounded-xl shadow-2xl">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white">Floor Plans</h1>
          <p className="text-xs text-white/35 mt-0.5">Your home model catalog — assign these to lots on your site maps</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Floor Plan
        </button>
      </div>

      {/* Grid */}
      {plans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4 border-2 border-dashed border-white/8 rounded-2xl">
          <div className="w-14 h-14 rounded-2xl bg-white/4 border border-white/8 flex items-center justify-center">
            <svg className="w-7 h-7 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-white/40">No floor plans yet</p>
            <p className="text-xs text-white/20 mt-1">Create your home model catalog to assign to site map lots</p>
          </div>
          <button onClick={openNew} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-sm text-white font-semibold rounded-xl transition-colors">
            Create your first floor plan
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map(fp => {
            const linkedProject = projects.find(p => p.id === fp.project_id);
            return (
              <div key={fp.id} className="bg-[#111] border border-white/8 rounded-2xl overflow-hidden hover:border-white/15 transition-colors group">
                {/* Thumbnail */}
                <div className="relative h-40 bg-[#0d0d0d]">
                  {fp.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={fp.thumbnail_url} alt={fp.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="w-12 h-12 text-white/8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21" />
                      </svg>
                    </div>
                  )}
                  {linkedProject && (
                    <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-600/90 text-white backdrop-blur-sm">
                      3D
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-sm font-bold text-white leading-tight">{fp.name}</p>
                      {fp.home_style && (
                        <p className="text-[10px] text-white/35 mt-0.5 capitalize">{fp.home_style.replace("_", " ")}</p>
                      )}
                    </div>
                    {fp.base_price != null && (
                      <p className="text-sm font-bold text-white/70 flex-shrink-0">{fmtPrice(fp.base_price)}</p>
                    )}
                  </div>

                  {/* Specs row */}
                  <div className="flex items-center gap-3 text-[10px] text-white/35 mb-3">
                    {fp.beds    != null && <span>{fp.beds} bd</span>}
                    {fp.baths   != null && <span>{fp.baths} ba</span>}
                    {fp.sqft    != null && <span>{fp.sqft.toLocaleString()} sqft</span>}
                    {fp.floors  != null && <span>{fp.floors} fl</span>}
                    {fp.garage_spaces != null && <span>{fp.garage_spaces} gar</span>}
                  </div>

                  {linkedProject && (
                    <p className="text-[10px] text-blue-400/70 mb-3 truncate">
                      → {linkedProject.name}
                    </p>
                  )}

                  <div className="flex gap-2">
                    <button onClick={() => openEdit(fp)}
                      className="flex-1 py-1.5 rounded-lg border border-white/10 text-xs text-white/50 hover:text-white hover:border-white/25 transition-colors">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(fp.id)} disabled={deleting === fp.id}
                      className="px-3 py-1.5 rounded-lg border border-red-500/20 text-xs text-red-400/60 hover:text-red-400 hover:border-red-500/40 transition-colors disabled:opacity-40">
                      {deleting === fp.id ? "…" : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative w-full max-w-xl bg-[#111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between flex-shrink-0">
              <h2 className="text-base font-bold text-white">{editing ? "Edit Floor Plan" : "New Floor Plan"}</h2>
              <button onClick={closeModal} className="w-8 h-8 flex items-center justify-center rounded-xl text-white/30 hover:text-white hover:bg-white/8 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Thumbnail */}
              <div>
                <label className={labelCls}>Thumbnail</label>
                <div className="flex items-center gap-3">
                  <div className="w-20 h-16 rounded-xl bg-[#1a1a1a] border border-white/10 overflow-hidden flex items-center justify-center flex-shrink-0">
                    {thumbUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumbUrl} alt="thumb" className="w-full h-full object-cover" />
                    ) : (
                      <svg className="w-6 h-6 text-white/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <input ref={thumbRef} type="file" accept="image/*" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadThumbnail(f); e.target.value = ""; }} />
                    <button onClick={() => thumbRef.current?.click()} disabled={thumbBusy}
                      className="px-3 py-1.5 border border-white/12 text-xs text-white/50 hover:text-white rounded-lg transition-colors disabled:opacity-40">
                      {thumbBusy ? "Uploading…" : "Upload image"}
                    </button>
                    {thumbUrl && (
                      <button onClick={() => setThumbUrl(null)} className="ml-2 text-xs text-white/25 hover:text-red-400 transition-colors">Remove</button>
                    )}
                  </div>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className={labelCls}>Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="The Willow" className={inputCls} />
              </div>

              {/* Description */}
              <div>
                <label className={labelCls}>Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2} placeholder="Brief overview of this home design…"
                  className={`${inputCls} resize-none`} />
              </div>

              {/* Home Style */}
              <div>
                <label className={labelCls}>Home Style</label>
                <select value={form.home_style} onChange={e => setForm(f => ({ ...f, home_style: e.target.value as HomeStyle | "" }))}
                  className={inputCls}>
                  <option value="">— Select style —</option>
                  {HOME_STYLES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>

              {/* Specs grid */}
              <div className="grid grid-cols-3 gap-3">
                {([
                  { key: "beds",          label: "Bedrooms",      placeholder: "3"       },
                  { key: "baths",         label: "Bathrooms",     placeholder: "2.5"     },
                  { key: "sqft",          label: "Sq Ft",         placeholder: "2400"    },
                  { key: "garage_spaces", label: "Garage Spaces", placeholder: "2"       },
                  { key: "base_price",    label: "Base Price ($)", placeholder: "450000" },
                ] as const).map(({ key, label, placeholder }) => (
                  <div key={key}>
                    <label className={labelCls}>{label}</label>
                    <input type="number" min={0} value={form[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder} className={inputCls} />
                  </div>
                ))}
                <div>
                  <label className={labelCls}>Floors</label>
                  <input type="number" min={0} max={10} value={form.floors}
                    onChange={e => onFloorsChange(e.target.value)}
                    placeholder="2" className={inputCls} />
                </div>
              </div>

              {/* Per-floor plan images */}
              {floorImages.length > 0 && (
                <div>
                  <label className={labelCls}>Floor Plan Images</label>
                  <p className="text-[10px] text-white/25 mb-3">Upload a top-down floor plan image for each floor</p>
                  <div className="space-y-2">
                    {floorImages.map((url, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-[#1a1a1a] border border-white/8 rounded-xl">
                        <div className="w-16 h-12 rounded-lg bg-[#111] border border-white/8 overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={url} alt={`Floor ${i + 1}`} className="w-full h-full object-cover" />
                          ) : (
                            <svg className="w-5 h-5 text-white/12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white/60">Floor {i + 1}</p>
                          <input
                            type="file" accept="image/*" className="hidden"
                            ref={el => { floorRefs.current[i] = el; }}
                            onChange={e => { const f = e.target.files?.[0]; if (f) uploadFloorImage(f, i); e.target.value = ""; }}
                          />
                          <button
                            onClick={() => floorRefs.current[i]?.click()}
                            disabled={floorBusy[i]}
                            className="text-[11px] text-blue-400/70 hover:text-blue-400 transition-colors mt-0.5 disabled:opacity-40">
                            {floorBusy[i] ? "Uploading…" : url ? "Replace image" : "Upload image"}
                          </button>
                        </div>
                        {url && (
                          <button
                            onClick={() => setFloorImages(prev => { const next = [...prev]; next[i] = null; return next; })}
                            className="text-white/20 hover:text-red-400 transition-colors flex-shrink-0">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3D Configurator link */}
              <div>
                <label className={labelCls}>Link to 3D Configurator (optional)</label>
                <select value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
                  className={inputCls}>
                  <option value="">— None (2D floor plan only) —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <p className="text-[10px] text-white/25 mt-1">When linked, buyers see a "Configure this home" button on the site map</p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-white/8 flex-shrink-0">
              <button onClick={handleSave} disabled={saving || !form.name.trim()}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm text-white font-semibold transition-colors disabled:opacity-50">
                {saving ? "Saving…" : editing ? "Save Changes" : "Create Floor Plan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
